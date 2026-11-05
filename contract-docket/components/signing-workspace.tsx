"use client";

import { useEffect, useState } from "react";
import type { ContractRecord } from "@/lib/contracts";
import { Icon } from "@/components/icons";
import { SignaturePad } from "@/components/signature-pad";

type PublicContract = Omit<ContractRecord, "tokenHash" | "senderSignature">;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function SigningWorkspace({ token }: { token: string }) {
  const [contract, setContract] = useState<PublicContract>();
  const [signature, setSignature] = useState<string>();
  const [signerName, setSignerName] = useState("");
  const [message, setMessage] = useState("");
  const [declineMessage, setDeclineMessage] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notificationSent, setNotificationSent] = useState<boolean>();

  useEffect(() => {
    let active = true;
    fetch(`/api/sign/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as PublicContract & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "서명 링크를 열 수 없습니다.");
        if (active) {
          setContract(result);
          setSignerName(result.recipientName);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "서명 링크를 열 수 없습니다.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  async function submit(action: "sign" | "decline") {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "sign"
            ? { action, signerName, signature, message }
            : { action, message: declineMessage },
        ),
      });
      const result = (await response.json()) as { error?: string; notificationSent?: boolean };
      if (!response.ok) throw new Error(result.error ?? "회신을 처리하지 못했습니다.");
      setNotificationSent(result.notificationSent);
      setContract((current) =>
        current
          ? {
              ...current,
              status: action === "sign" ? "signed" : "declined",
              signerName: action === "sign" ? signerName : current.signerName,
              recipientSignature: action === "sign" ? signature : undefined,
              responseMessage: action === "sign" ? message : declineMessage,
              signedAt: new Date().toISOString(),
            }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "회신을 처리하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="sign-loading"><span /><p>계약서를 안전하게 불러오고 있습니다.</p></main>;
  }

  if (!contract) {
    return (
      <main className="sign-state-page">
        <SignBrand />
        <section className="sign-state-card">
          <span className="state-symbol state-error"><Icon name="close" size={22} /></span>
          <h1>서명 링크를 열 수 없습니다</h1>
          <p>{error || "링크가 만료되었거나 올바르지 않습니다."}</p>
          <p className="state-help">메일을 보낸 담당자에게 새 링크를 요청해 주세요.</p>
        </section>
      </main>
    );
  }

  if (contract.status === "signed" || contract.status === "declined") {
    const signed = contract.status === "signed";
    return (
      <main className="sign-state-page">
        <SignBrand />
        <section className="sign-state-card">
          <span className={`state-symbol ${signed ? "state-success" : "state-neutral"}`}><Icon name={signed ? "check" : "mail"} size={22} /></span>
          <h1>{signed ? "서명을 완료했습니다" : "회신을 보냈습니다"}</h1>
          <p><strong>{contract.title}</strong></p>
          <p>{signed ? "계약 서명이 접수되었습니다." : "서명 요청에 대한 답변이 발신자에게 전달되었습니다."}</p>
          {notificationSent === false && <p className="state-help">회신은 접수됐지만 알림 메일은 전송되지 않았습니다. 발신자에게 별도로 알려 주세요.</p>}
          <p className="state-help">이 화면을 닫아도 됩니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="sign-page">
      <header className="sign-topbar"><SignBrand /><span>안전한 서명 요청</span></header>
      <div className="sign-content">
        <section className="sign-intro">
          <span className="section-overline">계약서 검토 및 서명</span>
          <h1>{contract.title}</h1>
          <p><strong>{contract.senderName}</strong>님이 서명을 요청했습니다.</p>
          <div className="sign-meta"><span><Icon name="file" size={15} /> 요청일 {contract.sentAt ? formatDate(contract.sentAt) : formatDate(contract.createdAt)}</span><span className="sign-expiry">링크 만료 {contract.expiresAt ? formatDate(contract.expiresAt) : "-"}</span></div>
        </section>
        <section aria-label="계약서 내용" className="sign-document">
          {contract.storedFilename ? (
            <iframe
              className="sign-pdf"
              src={`/api/contracts/${contract.id}/file?token=${encodeURIComponent(token)}#toolbar=0&navpanes=0`}
              title={`${contract.title} 계약서`}
            />
          ) : (
            <article className="contract-paper sign-paper">
              <div className="paper-heading"><span>AGREEMENT</span><span>{formatDate(contract.createdAt)}</span></div>
              <h2>{contract.title}</h2>
              <div className="paper-parties"><span>갑 <strong>{contract.senderName}</strong></span><span>을 <strong>{contract.recipientName}</strong></span></div>
              <div className="paper-body">{contract.body.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
              <div className="paper-signatures"><div><span>갑 · {contract.senderName}</span><i /></div><div><span>을 · {contract.recipientName}</span><i /></div></div>
              <div className="paper-page">1</div>
            </article>
          )}
        </section>
        <form className="sign-response" onSubmit={(event) => { event.preventDefault(); void submit("sign"); }}>
          <div className="response-heading"><span className="form-step">01</span><div><h2>계약 내용을 확인해 주세요</h2><p>서명 전 계약 조건을 충분히 검토해 주세요.</p></div></div>
          <label className="field-label">서명자 이름<input autoComplete="name" maxLength={100} onChange={(event) => setSignerName(event.target.value)} required value={signerName} /></label>
          <SignaturePad id="recipient-signature" label="아래에 서명해 주세요" onChange={setSignature} value={signature} />
          <label className="field-label">발신자에게 남길 메모 <span className="optional">(선택)</span><textarea maxLength={1000} onChange={(event) => setMessage(event.target.value)} placeholder="전달할 내용을 입력하세요" rows={3} value={message} /></label>
          <p className="sign-consent">서명하면 입력한 이름과 서명이 계약 발신자에게 전달됩니다.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {showDecline ? (
            <div className="decline-panel">
              <label className="field-label">거절 사유 또는 메시지 <span className="optional">(선택)</span><textarea maxLength={1000} onChange={(event) => setDeclineMessage(event.target.value)} rows={3} value={declineMessage} /></label>
              <div className="response-actions"><button className="button button-secondary" onClick={() => setShowDecline(false)} type="button">돌아가기</button><button className="button button-danger" disabled={submitting} onClick={() => void submit("decline")} type="button">서명 거절 회신</button></div>
            </div>
          ) : (
            <div className="response-actions">
              <button className="button button-secondary decline-button" onClick={() => setShowDecline(true)} type="button">서명하지 않겠습니다</button>
              <button className="button button-primary" disabled={submitting || !signature || !signerName.trim()} type="submit"><Icon name="check" size={16} /> {submitting ? "회신 중…" : "서명 완료"}</button>
            </div>
          )}
        </form>
        <footer className="sign-footer">이 전자계약 화면은 계약 당사자 간 서명 요청 및 회신을 돕습니다. 신원 확인이나 법률 자문을 제공하지 않습니다.</footer>
      </div>
    </main>
  );
}

function SignBrand() {
  return <a className="brand sign-brand" href="/" aria-label="계약 파일"><span className="brand-mark"><Icon name="contract" size={19} /></span><span className="brand-word">계약 파일</span></a>;
}
