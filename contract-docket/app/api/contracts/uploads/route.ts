import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import {
  createContractUpload,
  deleteContractFile,
  isOwnedContractFilePath,
} from "@/lib/contract-files";
import { listContracts } from "@/lib/contracts";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getDashboardUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "업로드 정보를 확인해 주세요." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "업로드 정보를 확인해 주세요." }, { status: 400 });
    }
    const { filename, size, contentType } = payload as {
      filename?: unknown;
      size?: unknown;
      contentType?: unknown;
    };
    if (
      typeof filename !== "string" ||
      !filename.toLowerCase().endsWith(".pdf") ||
      typeof size !== "number" ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > MAX_FILE_SIZE ||
      (typeof contentType === "string" && contentType && contentType !== "application/pdf")
    ) {
      return NextResponse.json(
        { error: "PDF 파일만 업로드할 수 있으며, 용량은 15MB 이하여야 합니다." },
        { status: 400 },
      );
    }

    const upload = await createContractUpload(user.id);
    const originalFilename = filename.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 160);
    return NextResponse.json(
      { ...upload, originalFilename },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not create a contract upload URL.", error);
    return NextResponse.json({ error: "PDF 업로드를 준비하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getDashboardUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "업로드 경로를 확인해 주세요." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "업로드 경로를 확인해 주세요." }, { status: 400 });
    }
    const objectPath = (payload as { path?: unknown }).path;
    if (typeof objectPath !== "string") {
      return NextResponse.json({ error: "업로드 경로를 확인해 주세요." }, { status: 400 });
    }
    if (!isOwnedContractFilePath(user.id, objectPath)) {
      return NextResponse.json({ error: "업로드 경로를 확인해 주세요." }, { status: 400 });
    }

    const contracts = await listContracts(user.id);
    if (contracts.some((contract) => contract.storedFilename === objectPath)) {
      return NextResponse.json({ error: "사용 중인 PDF는 삭제할 수 없습니다." }, { status: 409 });
    }
    await deleteContractFile(user.id, objectPath);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Could not remove an unused contract upload.", error);
    return NextResponse.json({ error: "업로드 파일을 정리하지 못했습니다." }, { status: 500 });
  }
}
