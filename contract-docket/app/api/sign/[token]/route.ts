import { NextResponse } from "next/server";
import {
  findContractByToken,
  isValidSignatureData,
  updateContractByToken,
} from "@/lib/contracts";
import { sendResponseNotification } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const contract = await findContractByToken(token);
  if (
    !contract ||
    !contract.expiresAt ||
    new Date(contract.expiresAt).getTime() < Date.now() ||
    !["sent", "signed", "declined"].includes(contract.status)
  ) {
    return NextResponse.json(
      { error: "서명 링크가 만료되었거나 올바르지 않습니다." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const { tokenHash, senderEmail, senderSignature, ...publicContract } = contract;
  return NextResponse.json(
    { ...publicContract, senderEmail },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const existing = await findContractByToken(token);
  if (
    !existing ||
    existing.status !== "sent" ||
    !existing.expiresAt ||
    new Date(existing.expiresAt).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "서명 링크가 만료되었거나 이미 회신되었습니다." },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
  }
  const data = payload as Record<string, unknown>;

  if (data.action === "decline") {
    const message = typeof data.message === "string" ? data.message.trim() : "";
    if (message.length > 1_000) {
      return NextResponse.json({ error: "메시지는 1,000자 이하여야 합니다." }, { status: 400 });
    }
    const updated = await updateContractByToken(token, (contract) => {
      const now = new Date().toISOString();
      return {
        ...contract,
        status: "declined",
        responseMessage: message || undefined,
        signedAt: now,
        updatedAt: now,
        events: [{ at: now, label: "서명 거절 회신" }, ...contract.events],
      };
    });
    if (!updated || updated.status !== "declined") {
      return NextResponse.json({ error: "이미 회신된 계약입니다." }, { status: 409 });
    }
    let notificationSent = true;
    try {
      await sendResponseNotification(updated, "declined");
    } catch (error) {
      notificationSent = false;
      console.error("Could not send decline notification.", error);
    }
    return NextResponse.json({ status: updated.status, notificationSent });
  }

  const signerName = typeof data.signerName === "string" ? data.signerName.trim() : "";
  const signature = data.signature;
  if (
    data.action !== "sign" ||
    !signerName ||
    signerName.length > 100 ||
    !isValidSignatureData(signature)
  ) {
    return NextResponse.json(
      { error: "이름과 서명을 확인해 주세요. 서명 파일은 PNG 또는 JPG여야 합니다." },
      { status: 400 },
    );
  }

  const updated = await updateContractByToken(token, (contract) => {
    const now = new Date().toISOString();
    return {
      ...contract,
      status: "signed",
      signerName,
      recipientSignature: signature,
      responseMessage:
        typeof data.message === "string" ? data.message.trim().slice(0, 1_000) : undefined,
      signedAt: now,
      updatedAt: now,
      events: [{ at: now, label: "서명 회신 완료" }, ...contract.events],
    };
  });
  if (!updated || updated.status !== "signed") {
    return NextResponse.json({ error: "이미 회신된 계약입니다." }, { status: 409 });
  }
  let notificationSent = true;
  try {
    await sendResponseNotification(updated, "signed");
  } catch (error) {
    notificationSent = false;
    console.error("Could not send signed notification.", error);
  }
  return NextResponse.json({ status: updated.status, notificationSent });
}
