import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  createContract,
  getUploadsPath,
  isValidSignatureData,
  isValidEmail,
  listContracts,
  updateContract,
  validateContractInput,
} from "@/lib/contracts";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_SIGNATURE_SIZE = 1_500_000;

function isPdf(bytes: Buffer) {
  const tail = bytes.subarray(Math.max(0, bytes.length - 1024)).toString("latin1");
  return bytes.subarray(0, 5).toString("ascii") === "%PDF-" && tail.includes("%%EOF");
}

export async function GET() {
  try {
    const contracts = await listContracts();
    return NextResponse.json(
      contracts.map(({ tokenHash, ...contract }) => contract),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not read contract records.", error);
    return NextResponse.json({ error: "계약 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

async function parseInput(request: Request) {
  const form = await request.formData();
  const upload = form.get("file");
  let storedFilename: string | undefined;
  let originalFilename: string | undefined;

  if (upload instanceof File && upload.size > 0) {
    if (upload.size > MAX_FILE_SIZE || !upload.name.toLowerCase().endsWith(".pdf")) {
      return { error: "PDF 파일만 업로드할 수 있으며, 용량은 15MB 이하여야 합니다." };
    }
    const bytes = Buffer.from(await upload.arrayBuffer());
    if (!isPdf(bytes)) {
      return { error: "올바른 PDF 파일을 선택해 주세요." };
    }
    storedFilename = `${randomUUID()}.pdf`;
    originalFilename = upload.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 160);
    await mkdir(getUploadsPath(), { recursive: true });
    await writeFile(path.join(getUploadsPath(), storedFilename), bytes, { mode: 0o600 });
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
    if (storedFilename) {
      await rm(path.join(getUploadsPath(), storedFilename), { force: true });
    }
    return { error: "서명 이미지는 PNG 또는 JPG 형식이어야 합니다." };
  }
  const input = validateContractInput(value);
  if (!input) {
    if (storedFilename) {
      await rm(path.join(getUploadsPath(), storedFilename), { force: true });
    }
    return { error: "계약명, 담당자, 수신자 이메일과 계약 내용 또는 PDF를 확인해 주세요." };
  }
  return { input };
}

export async function POST(request: Request) {
  let uploadedPath: string | undefined;
  try {
    const parsed = await parseInput(request);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.input.storedFilename) {
      uploadedPath = path.join(getUploadsPath(), parsed.input.storedFilename);
    }
    const contract = await createContract(parsed.input);
    const { tokenHash, ...publicContract } = contract;
    return NextResponse.json(publicContract, { status: 201 });
  } catch (error) {
    if (uploadedPath) await rm(uploadedPath, { force: true });
    console.error("Could not create contract.", error);
    return NextResponse.json({ error: "계약 초안을 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let uploadedPath: string | undefined;
  try {
    const form = await request.formData();
    const id = form.get("id");
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 400 });
    }

    const existing = (await listContracts()).find((contract) => contract.id === id);
    if (!existing || existing.status !== "draft") {
      return NextResponse.json(
        { error: "발송 전 초안만 수정할 수 있습니다." },
        { status: 409 },
      );
    }
    const upload = form.get("file");
    let storedFilename = existing.storedFilename;
    let originalFilename = existing.originalFilename;
    const removeFile = form.get("removeFile") === "true";
    if (upload instanceof File && upload.size > 0) {
      if (upload.size > MAX_FILE_SIZE || !upload.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json(
          { error: "PDF 파일만 업로드할 수 있으며, 용량은 15MB 이하여야 합니다." },
          { status: 400 },
        );
      }
      const bytes = Buffer.from(await upload.arrayBuffer());
      if (!isPdf(bytes)) {
        return NextResponse.json({ error: "올바른 PDF 파일을 선택해 주세요." }, { status: 400 });
      }
      storedFilename = `${randomUUID()}.pdf`;
      originalFilename = upload.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 160);
      await writeFile(
        path.join(process.cwd(), ".local-data", "uploads", storedFilename),
        bytes,
        { mode: 0o600 },
      );
      uploadedPath = path.join(process.cwd(), ".local-data", "uploads", storedFilename);
    } else if (removeFile) {
      storedFilename = undefined;
      originalFilename = undefined;
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
      if (uploadedPath) await rm(uploadedPath, { force: true });
      return NextResponse.json(
        { error: "서명 이미지는 PNG 또는 JPG 형식이어야 합니다." },
        { status: 400 },
      );
    }
    const input = validateContractInput(value);
    if (!input) {
      if (uploadedPath) await rm(uploadedPath, { force: true });
      return NextResponse.json(
        { error: "계약명, 담당자, 수신자 이메일과 계약 내용 또는 PDF를 확인해 주세요." },
        { status: 400 },
      );
    }
    const updated = await updateContract(id, (contract) => ({
      ...contract,
      ...input,
      updatedAt: new Date().toISOString(),
      events: [{ at: new Date().toISOString(), label: "초안 수정" }, ...contract.events],
    }));
    if (!updated) {
      return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
    }
    if ((uploadedPath || removeFile) && existing.storedFilename) {
      await rm(path.join(getUploadsPath(), existing.storedFilename), { force: true });
    }
    const { tokenHash, ...publicContract } = updated;
    return NextResponse.json(publicContract);
  } catch (error) {
    if (uploadedPath) await rm(uploadedPath, { force: true });
    console.error("Could not update contract.", error);
    return NextResponse.json({ error: "계약 초안을 수정하지 못했습니다." }, { status: 500 });
  }
}
