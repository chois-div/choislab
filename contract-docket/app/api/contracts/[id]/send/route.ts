import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { createSigningToken, getContract, updateContract } from "@/lib/contracts";
import { sendSigningRequest } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let userId: string | undefined;
  let tokenHash: string | undefined;
  let sendingStarted = false;
  let mailDelivered = false;
  try {
    const user = await getDashboardUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    userId = user.id;
    const existing = await getContract(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
    }
    const { token, tokenHash: createdTokenHash } = createSigningToken();
    tokenHash = createdTokenHash;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const sending = await updateContract(user.id, id, (contract) => {
      if (contract.status !== "draft") return contract;
      const now = new Date().toISOString();
      return {
        ...contract,
        status: "sending",
        tokenHash: createdTokenHash,
        expiresAt,
        updatedAt: now,
        events: [{ at: now, label: "메일 발송 준비" }, ...contract.events],
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
    sendingStarted = true;

    await sendSigningRequest(sending, token);
    mailDelivered = true;
    const sent = await updateContract(user.id, id, (contract) => ({
      ...contract,
      status: "sent",
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [{ at: new Date().toISOString(), label: "서명 요청 메일 발송" }, ...contract.events],
    }));
    if (!sent) throw new Error("Contract disappeared after mail delivery.");
    return NextResponse.json({ status: "sent", sentAt: sent.sentAt });
  } catch (error) {
    console.error("Signing request email delivery failed.", error);
    if (userId && tokenHash && sendingStarted && !mailDelivered) {
      try {
        await updateContract(userId, id, (contract) => {
          if (contract.status !== "sending" || contract.tokenHash !== tokenHash) {
            return contract;
          }
          const now = new Date().toISOString();
          return {
            ...contract,
            status: "draft",
            tokenHash: undefined,
            expiresAt: undefined,
            updatedAt: now,
            events: [{ at: now, label: "메일 발송 실패" }, ...contract.events],
          };
        });
      } catch (rollbackError) {
        console.error("Could not restore the contract draft after mail failure.", rollbackError);
      }
    }
    if (mailDelivered) {
      return NextResponse.json(
        { error: "메일 발송은 완료되었지만 상태 저장을 확인하지 못했습니다. 목록을 새로고침해 주세요." },
        { status: 500 },
      );
    }
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
