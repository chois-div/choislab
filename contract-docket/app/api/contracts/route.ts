import { NextResponse } from "next/server";
import {
  deleteContractFile,
  isOwnedContractFilePath,
  verifyContractUpload,
} from "@/lib/contract-files";
import { getDashboardUser } from "@/lib/auth";
import {
  createContract,
  getContract,
  isValidSignatureData,
  isValidEmail,
  listContracts,
  updateContract,
  validateContractInput,
} from "@/lib/contracts";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_SIGNATURE_SIZE = 1_500_000;

function logContractError(message: string, error: unknown) {
  if (error instanceof Error) {
    const databaseError = error as Error & { code?: string };
    console.error(message, {
      name: error.name,
      message: error.message,
      code: databaseError.code,
    });
    return;
  }
  console.error(message, error);
}

function isPdf(bytes: Buffer) {
  const tail = bytes.subarray(Math.max(0, bytes.length - 1024)).toString("latin1");
  return bytes.subarray(0, 5).toString("ascii") === "%PDF-" && tail.includes("%%EOF");
}

function sanitizeFilename(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const filename = value.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 160);
  return filename || undefined;
}

async function parseInput(
  request: Request,
  userId: string,
  existing?: Awaited<ReturnType<typeof getContract>>,
) {
  const form = await request.formData();
  const removeFile = form.get("removeFile") === "true";
  const pathValue = form.get("storedFilename");
  const storedFilename = removeFile
    ? undefined
    : typeof pathValue === "string" && pathValue.trim()
      ? pathValue.trim()
      : undefined;
  const originalFilename = removeFile
    ? undefined
    : sanitizeFilename(form.get("originalFilename"));
  const isNewUpload = Boolean(
    storedFilename && storedFilename !== existing?.storedFilename,
  );

  if (storedFilename && isNewUpload) {
    if (!isOwnedContractFilePath(userId, storedFilename)) {
      return { error: "PDF 업로드를 다시 진행해 주세요." };
    }
    if (!originalFilename) {
      return {
        error: "PDF 파일 이름을 확인해 주세요.",
        uploadedPath: storedFilename,
      };
    }
    let bytes: Buffer;
    try {
      bytes = await verifyContractUpload(userId, storedFilename);
    } catch (error) {
      await cleanupUploadedFile(userId, storedFilename);
      throw error;
    }
    if (bytes.length > MAX_FILE_SIZE || !isPdf(bytes)) {
      await deleteContractFile(userId, storedFilename);
      return {
        error: "올바른 PDF 파일을 선택해 주세요. 파일 크기는 15MB 이하여야 합니다.",
      };
    }
  }

  if (storedFilename && !originalFilename) {
    return {
      error: "PDF 파일 이름을 확인해 주세요.",
      uploadedPath: isNewUpload ? storedFilename : undefined,
    };
  }

  const senderSignature = form.get("senderSignature");
  const value = {
    title: form.get("title"),
    senderName: form.get("senderName"),
    senderEmail: form.get("senderEmail"),
    recipientName: form.get("recipientName"),
    recipientEmail: form.get("recipientEmail"),
    body: form.get("body"),
    senderSignature:
      typeof senderSignature === "string" && senderSignature.length <= MAX_SIGNATURE_SIZE
        ? senderSignature
        : undefined,
    storedFilename,
    originalFilename,
  };

  if (senderSignature && !isValidSignatureData(senderSignature)) {
    return {
      error: "서명 이미지는 PNG 또는 JPG 형식이어야 합니다.",
      uploadedPath: isNewUpload ? storedFilename : undefined,
    };
  }
  const input = validateContractInput(value);
  if (!input) {
    return {
      error: "계약명, 담당자, 수신자 이메일과 계약 내용 또는 PDF를 확인해 주세요.",
      uploadedPath: isNewUpload ? storedFilename : undefined,
    };
  }
  if (!isValidEmail(input.senderEmail) || !isValidEmail(input.recipientEmail)) {
    return {
      error: "이메일 주소를 확인해 주세요.",
      uploadedPath: isNewUpload ? storedFilename : undefined,
    };
  }
  return { input, uploadedPath: isNewUpload ? storedFilename : undefined };
}

async function cleanupUploadedFile(userId: string, objectPath?: string) {
  if (!objectPath) return;
  try {
    await deleteContractFile(userId, objectPath);
  } catch (error) {
    console.error("Could not clean up an unused contract upload.", error);
  }
}

export async function GET() {
  try {
    const user = await getDashboardUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const contracts = await listContracts(user.id);
    return NextResponse.json(
      contracts.map(({ tokenHash, ...contract }) => contract),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logContractError("Could not read contract records.", error);
    return NextResponse.json({ error: "계약 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let userId: string | undefined;
  let uploadedPath: string | undefined;
  try {
    const user = await getDashboardUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    userId = user.id;
    const parsed = await parseInput(request, user.id);
    if ("error" in parsed) {
      await cleanupUploadedFile(user.id, parsed.uploadedPath);
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    uploadedPath = parsed.uploadedPath;
    const contract = await createContract(user.id, parsed.input);
    const { tokenHash, ...publicContract } = contract;
    return NextResponse.json(publicContract, { status: 201 });
  } catch (error) {
    await cleanupUploadedFile(userId ?? "", uploadedPath);
    logContractError("Could not create contract.", error);
    return NextResponse.json({ error: "계약 초안을 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let userId: string | undefined;
  let uploadedPath: string | undefined;
  try {
    const user = await getDashboardUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    userId = user.id;
    const form = await request.clone().formData();
    const id = form.get("id");
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 400 });
    }

    const existing = await getContract(user.id, id);
    if (!existing || existing.status !== "draft") {
      return NextResponse.json(
        { error: "발송 전 초안만 수정할 수 있습니다." },
        { status: 409 },
      );
    }
    const parsed = await parseInput(request, user.id, existing);
    if ("error" in parsed) {
      await cleanupUploadedFile(user.id, parsed.uploadedPath);
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    uploadedPath = parsed.uploadedPath;
    const updated = await updateContract(user.id, id, (contract) => {
      if (contract.status !== "draft") return contract;
      const now = new Date().toISOString();
      return {
        ...contract,
        ...parsed.input,
        updatedAt: now,
        events: [{ at: now, label: "초안 수정" }, ...contract.events],
      };
    });
    if (!updated || updated.status !== "draft") {
      await cleanupUploadedFile(user.id, uploadedPath);
      return NextResponse.json(
        { error: "발송 전 초안만 수정할 수 있습니다." },
        { status: 409 },
      );
    }
    if (
      existing.storedFilename &&
      existing.storedFilename !== updated.storedFilename
    ) {
      await cleanupUploadedFile(user.id, existing.storedFilename);
    }
    const { tokenHash, ...publicContract } = updated;
    return NextResponse.json(publicContract);
  } catch (error) {
    await cleanupUploadedFile(userId ?? "", uploadedPath);
    logContractError("Could not update contract.", error);
    return NextResponse.json({ error: "계약 초안을 수정하지 못했습니다." }, { status: 500 });
  }
}
