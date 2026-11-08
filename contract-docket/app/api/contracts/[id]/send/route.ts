import { NextResponse } from "next/server";
import { createSigningToken, updateContract } from "@/lib/contracts";
import { sendSigningRequest } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { token, tokenHash } = createSigningToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const sending = await updateContract(id, (contract) => {
    if (contract.status !== "draft") return contract;
    return {
      ...contract,
      status: "sending",
      tokenHash,
      expiresAt,
      updatedAt: new Date().toISOString(),
      events: [{ at: new Date().toISOString(), label: "메일 발송 준비" }, ...contract.events],
    };
  });
  if (!sending) {
    return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
  }
  if (sending.status !== "sending" || sending.tokenHash !== tokenHash) {
    return NextResponse.json(
      { error: "발송 전 초안만 서명을 요청할 수 있습니다." },
      { status: 409 },
    );
  }

  try {
    await sendSigningRequest(sending, token);
    const sent = await updateContract(id, (contract) => ({
      ...contract,
      status: "sent",
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [{ at: new Date().toISOString(), label: "서명 요청 메일 발송" }, ...contract.events],
    }));
    if (!sent) throw new Error("Contract disappeared after mail delivery.");
    return NextResponse.json({ status: "sent", sentAt: sent.sentAt });
  } catch (error) {
    await updateContract(id, (contract) => ({
      ...contract,
      status: "draft",
      tokenHash: undefined,
      expiresAt: undefined,
      updatedAt: new Date().toISOString(),
      events: [{ at: new Date().toISOString(), label: "메일 발송 실패" }, ...contract.events],
    }));
    console.error("Signing request email delivery failed.", error);
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "SMTP 설정이 없습니다. 환경 변수를 설정한 뒤 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    if (error instanceof Error && error.message.startsWith("APP_URL_")) {
      return NextResponse.json(
        { error: "APP_URL은 HTTPS 주소여야 합니다. localhost 개발 주소는 예외입니다." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "메일을 발송하지 못했습니다. SMTP 설정과 연결 상태를 확인해 주세요." },
      { status: 502 },
    );
  }
}
