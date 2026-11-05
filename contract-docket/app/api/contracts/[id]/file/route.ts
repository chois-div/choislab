import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { findContractByToken, getContract, getUploadsPath } from "@/lib/contracts";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract?.storedFilename) {
    return NextResponse.json({ error: "첨부 문서를 찾을 수 없습니다." }, { status: 404 });
  }
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    const matched = await findContractByToken(token);
    if (
      matched?.id !== contract.id ||
      !contract.expiresAt ||
      new Date(contract.expiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json({ error: "문서 링크가 만료되었거나 올바르지 않습니다." }, { status: 403 });
    }
  }

  try {
    const filename = path.basename(contract.storedFilename);
    const contents = await readFile(path.join(getUploadsPath(), filename));
    const safeName = encodeURIComponent(contract.originalFilename ?? "contract.pdf");
    return new Response(contents, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Could not read uploaded contract file.", error);
    return NextResponse.json({ error: "첨부 문서를 불러오지 못했습니다." }, { status: 500 });
  }
}
