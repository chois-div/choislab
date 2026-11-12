import { NextResponse } from "next/server";
import {
  readContractFileForOwner,
  readContractFileForSigner,
} from "@/lib/contract-files";
import { getDashboardUser } from "@/lib/auth";
import { findContractByToken, getContract } from "@/lib/contracts";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token");

  try {
    let contract;
    let contents: Buffer;
    if (token) {
      contract = await findContractByToken(token);
      if (
        contract?.id !== id ||
        !contract.expiresAt ||
        new Date(contract.expiresAt).getTime() < Date.now()
      ) {
        return NextResponse.json(
          { error: "문서 링크가 만료되었거나 올바르지 않습니다." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (!contract.storedFilename) {
        return NextResponse.json({ error: "첨부 문서를 찾을 수 없습니다." }, { status: 404 });
      }
      contents = await readContractFileForSigner(contract.storedFilename);
    } else {
      const user = await getDashboardUser();
      if (!user) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      contract = await getContract(user.id, id);
      if (!contract?.storedFilename) {
        return NextResponse.json({ error: "첨부 문서를 찾을 수 없습니다." }, { status: 404 });
      }
      contents = await readContractFileForOwner(user.id, contract.storedFilename);
    }

    const safeName = encodeURIComponent(contract.originalFilename ?? "contract.pdf");
    return new Response(new Uint8Array(contents), {
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
