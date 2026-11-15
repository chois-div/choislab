"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

const authenticationMessages: Record<string, string> = {
  "invalid-link": "로그인 링크가 없거나 만료되었습니다. 새 링크를 요청해 주세요.",
  "not-authorized": "이 이메일은 워크스페이스 접근 권한이 없습니다.",
  "authentication-failed": "로그인 링크를 확인하지 못했습니다. 다시 요청해 주세요.",
};

export function LoginWorkspace({ errorCode }: { errorCode?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(
    errorCode ? authenticationMessages[errorCode] ?? authenticationMessages["authentication-failed"] : "",
  );
  const [isError, setIsError] = useState(Boolean(errorCode));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "로그인 링크를 보내지 못했습니다.");
        setIsError(true);
        return;
      }
      setSent(true);
      setMessage(result.message ?? "이메일을 확인해 주세요.");
    } catch {
      setMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setIsError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <a className="brand" href="/" aria-label="계약 파일">
          <span className="brand-mark"><Icon name="contract" size={20} /></span>
          <span className="brand-word">계약 파일</span>
        </a>
      </header>
      <main className="auth-main">
        <section aria-labelledby="auth-title" className="auth-panel">
          <h1 id="auth-title">{sent ? "이메일을 확인해 주세요" : "워크스페이스 로그인"}</h1>
          <p>
            {sent
              ? "접근 권한이 있는 이메일이라면 로그인 링크를 받을 수 있습니다."
              : "등록된 담당자 이메일로 일회용 로그인 링크를 보냅니다."}
          </p>
          {!sent && (
            <form className="auth-form" onSubmit={(event) => void requestLink(event)}>
              <label className="field-label" htmlFor="login-email">
                이메일 주소
                <input
                  autoComplete="email"
                  id="login-email"
                  maxLength={254}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button className="button button-primary auth-submit" disabled={sending} type="submit">
                {sending ? "로그인 링크 보내는 중…" : "로그인 링크 받기"}
              </button>
            </form>
          )}
          {message && (
            <p className={`auth-message ${isError ? "auth-message-error" : ""}`} role={isError ? "alert" : "status"}>
              {message}
            </p>
          )}
          <p className="auth-note">계약 기록은 승인된 계정에서만 확인할 수 있습니다.</p>
        </section>
      </main>
    </div>
  );
}
