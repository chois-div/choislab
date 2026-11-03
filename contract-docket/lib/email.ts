import nodemailer from "nodemailer";
import type { ContractRecord } from "@/lib/contracts";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const appUrl = process.env.APP_URL?.trim();

  if (!host || !user || !pass || !from || !appUrl) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT_INVALID");
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    throw new Error("APP_URL_INVALID");
  }
  if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") {
    throw new Error("APP_URL_MUST_USE_HTTPS");
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    user,
    pass,
    from,
    baseUrl,
  };
}

export async function sendSigningRequest(contract: ContractRecord, token: string) {
  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  const signingUrl = new URL(`/sign/${token}`, config.baseUrl).toString();
  const title = escapeHtml(contract.title);
  const senderName = escapeHtml(contract.senderName);
  const recipientName = escapeHtml(contract.recipientName);

  await transporter.sendMail({
    from: config.from,
    to: contract.recipientEmail,
    replyTo: contract.senderEmail,
    subject: `[전자계약] ${contract.title} 서명을 요청합니다`,
    text: `${contract.recipientName}님 안녕하세요.\n\n${contract.senderName}님이 "${contract.title}" 계약의 서명을 요청했습니다.\n아래 링크에서 계약을 확인하고 서명해 주세요.\n\n${signingUrl}\n\n이 링크는 발송 후 14일 동안 유효합니다.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#262c32"><p style="font-size:13px;color:#5d6872">전자계약 서명 요청</p><h1 style="font-size:24px;line-height:1.35">${title}</h1><p>${recipientName}님, <strong>${senderName}</strong>님이 계약서 서명을 요청했습니다.</p><p style="margin:28px 0"><a href="${escapeHtml(signingUrl)}" style="display:inline-block;background:#2458df;color:#fff;text-decoration:none;padding:14px 22px;border-radius:6px">계약 확인 및 서명</a></p><p style="font-size:13px;color:#68717a">이 링크는 발송 후 14일 동안 유효합니다.</p><p style="font-size:12px;color:#899199">요청한 적이 없다면 이 메일을 무시해 주세요.</p></div>`,
  });
}

export async function sendResponseNotification(
  contract: ContractRecord,
  response: "signed" | "declined",
) {
  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  const action = response === "signed" ? "서명했습니다" : "서명 요청을 거절했습니다";
  await transporter.sendMail({
    from: config.from,
    to: contract.senderEmail,
    replyTo: contract.recipientEmail,
    subject: `[전자계약] ${contract.recipientName}님이 회신했습니다`,
    text: `${contract.recipientName}님이 "${contract.title}" 계약에 ${action}.\n\n계약 관리 화면에서 회신 내용을 확인해 주세요.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#262c32"><p style="font-size:13px;color:#5d6872">전자계약 회신 알림</p><h1 style="font-size:23px">${escapeHtml(contract.title)}</h1><p><strong>${escapeHtml(contract.recipientName)}</strong>님이 계약서에 ${action}.</p><p style="font-size:13px;color:#68717a">계약 관리 화면에서 회신 내용을 확인해 주세요.</p></div>`,
  });
}
