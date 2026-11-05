"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractRecord, ContractStatus } from "@/lib/contracts";
import { Icon } from "@/components/icons";
import { SignaturePad } from "@/components/signature-pad";

type Filter = "all" | ContractStatus;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "draft", label: "작성 중" },
  { id: "sent", label: "서명 대기" },
  { id: "signed", label: "회신 완료" },
  { id: "declined", label: "거절" },
];

const statusNames: Record<ContractStatus, string> = {
  draft: "작성 중",
  sending: "발송 중",
  sent: "서명 대기",
  signed: "회신 완료",
  declined: "서명 거절",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: ContractStatus) {
  return `status status-${status}`;
}

export function ContractsWorkspace() {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRecord>();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string }>();

  const selected = contracts.find((contract) => contract.id === selectedId);
  const visibleContracts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    return contracts.filter((contract) => {
      const matchesFilter = filter === "all" || contract.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        `${contract.title} ${contract.recipientName} ${contract.recipientEmail}`
          .toLocaleLowerCase("ko")
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [contracts, filter, query]);

  async function loadContracts() {
    setLoading(true);
    try {
      const response = await fetch("/api/contracts", { cache: "no-store" });
      if (!response.ok) throw new Error("CONTRACT_LIST_FAILED");
      const records = (await response.json()) as ContractRecord[];
      setContracts(records);
      setSelectedId((current) =>
        current && records.some((contract) => contract.id === current)
          ? current
          : records[0]?.id,
      );
    } catch {
      setNotice({ kind: "error", text: "계약 목록을 불러오지 못했습니다. 다시 시도해 주세요." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, []);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("contract-search")?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  async function sendContract(contract: ContractRecord) {
    setNotice(undefined);
    try {
      const response = await fetch(`/api/contracts/${contract.id}/send`, { method: "POST" });
      const result = (await response.json()) as { error?: string; sentAt?: string };
      if (!response.ok) {
        setNotice({
          kind: "error",
          text: result.error ?? "서명 요청 메일을 보내지 못했습니다.",
        });
        await loadContracts();
        return;
      }
      setNotice({ kind: "success", text: `${contract.recipientEmail}로 서명 요청 메일을 보냈습니다.` });
      await loadContracts();
    } catch {
      setNotice({
        kind: "error",
        text: "메일 발송 결과를 확인하지 못했습니다. 목록을 새로고침해 상태를 확인해 주세요.",
      });
      await loadContracts();
    }
  }

  function openNewContract() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEditContract(contract: ContractRecord) {
    setEditing(contract);
    setDialogOpen(true);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="계약 파일 홈">
          <span className="brand-mark"><Icon name="contract" size={20} /></span>
          <span className="brand-word">계약 파일</span>
        </a>
        <div className="workspace-label">워크스페이스</div>
        <nav aria-label="주 메뉴" className="main-nav">
          <a aria-current="page" className="nav-item active" href="#contracts">
            <Icon name="archive" size={18} />
            <span>계약 관리</span>
            <span className="nav-count">{contracts.length}</span>
          </a>
          <button className="nav-item" onClick={openNewContract} type="button">
            <Icon name="plus" size={18} />
            <span>새 계약 만들기</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-rule" />
            <p>초안에서 회신까지,<br />계약의 흐름을 기록합니다.</p>
          </div>
          <div className="workspace-user">
            <span className="avatar">계</span>
            <span><strong>내 워크스페이스</strong><small>로컬 MVP</small></span>
            <Icon name="chevron" size={15} />
          </div>
        </div>
      </aside>

      <main className="workspace" id="contracts">
        <header className="topbar">
          <div className="breadcrumb"><span>워크스페이스</span><Icon name="chevron" size={14} /><strong>계약 관리</strong></div>
          <div className="topbar-actions">
            <span className="local-indicator"><i /> 로컬 작업 공간</span>
            <button aria-label="도움말" className="icon-button" onClick={() => setNotice({ kind: "success", text: "SMTP 설정은 프로젝트의 .env.local 파일에서 관리할 수 있습니다." })} type="button"><Icon name="help" /></button>
            <span className="avatar avatar-small">계</span>
          </div>
        </header>

        <section className="page-content">
          <div className="page-heading">
            <div>
              <p className="date-line">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" }).format(new Date())}</p>
              <h1>계약 파일</h1>
              <p className="page-intro">작성부터 서명 회신까지, 계약의 다음 단계를 놓치지 않도록.</p>
            </div>
            <button className="button button-primary" onClick={openNewContract} type="button">
              <Icon name="plus" size={17} /> 새 계약 작성
            </button>
          </div>

          <section aria-label="계약 요약" className="ledger-stats">
            <div className="ledger-stat"><span>전체 계약</span><strong>{contracts.length}<small>건</small></strong></div>
            <div className="ledger-stat"><span>서명 대기</span><strong>{contracts.filter((item) => item.status === "sent" || item.status === "sending").length}<small>건</small></strong></div>
            <div className="ledger-stat"><span>회신 완료</span><strong>{contracts.filter((item) => item.status === "signed").length}<small>건</small></strong></div>
            <p>계약의 현재 상태와 최근 변경 내역을 확인하세요.</p>
          </section>

          {notice && (
            <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
              <span>{notice.text}</span>
              <button aria-label="알림 닫기" className="notice-close" onClick={() => setNotice(undefined)} type="button"><Icon name="close" size={16} /></button>
            </div>
          )}

          <div className="contracts-toolbar">
            <div aria-label="계약 상태 필터" className="filter-tabs" role="tablist">
              {filters.map((item) => (
                <button
                  aria-selected={filter === item.id}
                  className={`filter-tab ${filter === item.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  role="tab"
                  type="button"
                >
                  {item.label}
                  {item.id === "sent" && contracts.some((contract) => contract.status === "sent") && (
                    <span className="filter-dot" />
                  )}
                </button>
              ))}
            </div>
            <label className="search-field">
              <Icon name="search" size={17} />
              <span className="visually-hidden">계약명 또는 수신자 검색</span>
              <input id="contract-search" onChange={(event) => setQuery(event.target.value)} placeholder="계약명, 수신자 검색" value={query} />
              <kbd>⌘ K</kbd>
            </label>
          </div>

          {loading ? (
            <div aria-label="계약 목록 불러오는 중" className="loading-ledger">
              <span /><span /><span /><span />
            </div>
          ) : contracts.length === 0 ? (
            <EmptyState onCreate={openNewContract} />
          ) : visibleContracts.length === 0 ? (
            <div className="filtered-empty">
              <Icon name="search" size={22} />
              <h2>검색 결과가 없습니다</h2>
              <p>다른 계약명이나 수신자 이름으로 검색해 보세요.</p>
              <button className="text-button" onClick={() => { setQuery(""); setFilter("all"); }} type="button">검색 초기화</button>
            </div>
          ) : (
            <div className="contract-layout">
              <section aria-label="계약 목록" className="docket-list">
                <div className="list-heading">
                  <span>계약명 / 수신자</span><span>상태</span><span>수정일</span>
                </div>
                {visibleContracts.map((contract, index) => (
                  <button
                    aria-current={selectedId === contract.id ? "true" : undefined}
                    className={`docket-row ${selectedId === contract.id ? "current" : ""}`}
                    key={contract.id}
                    onClick={() => setSelectedId(contract.id)}
                    type="button"
                  >
                    <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="docket-main">
                      <strong>{contract.title}</strong>
                      <small>{contract.recipientName} · {contract.recipientEmail}</small>
                    </span>
                    <span className={statusClass(contract.status)}>{statusNames[contract.status]}</span>
                    <time>{formatDate(contract.updatedAt)}</time>
                  </button>
                ))}
              </section>
              {selected && (
                <ContractDetail
                  contract={selected}
                  onEdit={() => openEditContract(selected)}
                  onSend={() => void sendContract(selected)}
                />
              )}
            </div>
          )}
        </section>
      </main>

      <ContractEditor
        contract={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={(contract) => {
          setDialogOpen(false);
          setNotice({ kind: "success", text: "계약 초안을 저장했습니다. 미리보기를 확인해 주세요." });
          void loadContracts().then(() => setSelectedId(contract.id));
        }}
        open={dialogOpen}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-document">
        <span /><span /><span /><b><Icon name="plus" size={17} /></b>
      </div>
      <div className="empty-copy">
        <h2>첫 계약 파일을 만들어 보세요</h2>
        <p>계약 내용을 작성하거나 PDF를 올린 뒤, 미리보기에서 확인하고 서명을 요청할 수 있습니다.</p>
        <button className="button button-primary" onClick={onCreate} type="button"><Icon name="plus" size={16} /> 계약 초안 만들기</button>
      </div>
      <div className="empty-steps">
        <span><i>1</i> 초안 작성</span><span className="step-rule" /><span><i>2</i> 미리보기</span><span className="step-rule" /><span><i>3</i> 서명 요청</span>
      </div>
    </div>
  );
}

function ContractDetail({
  contract,
  onEdit,
  onSend,
}: {
  contract: ContractRecord;
  onEdit: () => void;
  onSend: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  async function confirmAndSend() {
    setSending(true);
    setConfirmSend(false);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="선택한 계약 상세" className="contract-detail">
      <div className="detail-topline">
        <span className="section-overline">계약 상세</span>
        <span className={statusClass(contract.status)}>{statusNames[contract.status]}</span>
      </div>
      <div className="detail-title-row">
        <h2>{contract.title}</h2>
        <span className="detail-number">#{contract.id.slice(0, 6).toUpperCase()}</span>
      </div>
      <div className="participants">
        <div className="participant"><span className="participant-initial">{contract.senderName.slice(0, 1)}</span><div><small>보내는 사람</small><strong>{contract.senderName}</strong></div></div>
        <span className="participant-arrow"><Icon name="arrow" size={15} /></span>
        <div className="participant"><span className="participant-initial recipient-initial">{contract.recipientName.slice(0, 1)}</span><div><small>서명자</small><strong>{contract.recipientName}</strong></div></div>
      </div>
      <div className="document-frame">
        <div className="paper-toolbar"><span><Icon name="file" size={15} /> 계약 미리보기</span><span>{contract.originalFilename ?? "계약 본문"}</span></div>
        {contract.storedFilename ? (
          <iframe
            className="pdf-preview"
            src={`/api/contracts/${contract.id}/file#toolbar=0&navpanes=0`}
            title={`${contract.title} PDF 미리보기`}
          />
        ) : (
          <ContractPaper contract={contract} />
        )}
      </div>
      {contract.status === "signed" && (
        <div className="signed-result">
          <div className="signed-copy"><span className="signed-check"><Icon name="check" size={16} /></span><div><strong>{contract.signerName ?? contract.recipientName}님이 서명했습니다</strong><small>{contract.signedAt ? formatDateTime(contract.signedAt) : ""}</small></div></div>
          {contract.recipientSignature && <img alt={`${contract.signerName ?? contract.recipientName}의 서명`} src={contract.recipientSignature} />}
          {contract.responseMessage && <p>{contract.responseMessage}</p>}
        </div>
      )}
      {contract.status === "declined" && contract.responseMessage && <p className="decline-message">회신: {contract.responseMessage}</p>}
      {contract.status === "sent" && (
        <div className="awaiting-note"><Icon name="mail" size={16} /><span><strong>{contract.recipientEmail}</strong>로 서명 링크를 보냈습니다.</span></div>
      )}
      <div className="detail-activity">
        <div className="activity-heading"><h3>진행 기록</h3><span>{contract.events.length}개</span></div>
        {contract.events.slice(0, 4).map((event, index) => (
          <div className="activity-row" key={`${event.at}-${index}`}>
            <span className={`activity-mark ${index === 0 ? "latest" : ""}`} />
            <span>{event.label}</span><time>{formatDateTime(event.at)}</time>
          </div>
        ))}
      </div>
      <div className="detail-actions">
        {contract.status === "draft" ? (
          <>
            <button className="button button-secondary" onClick={onEdit} type="button"><Icon name="edit" size={16} /> 초안 수정</button>
            <button className="button button-primary" disabled={sending} onClick={() => setConfirmSend(true)} type="button">
              <Icon name="send" size={16} /> {sending ? "발송 중…" : "서명 요청 보내기"}
            </button>
          </>
        ) : contract.status === "sent" ? (
          <p className="action-note"><Icon name="bell" size={16} /> 서명 회신을 기다리고 있습니다.</p>
        ) : contract.status === "signed" ? (
          <p className="action-note action-complete"><Icon name="check" size={16} /> 서명 회신이 완료되었습니다.</p>
        ) : contract.status === "declined" ? (
          <p className="action-note">거절 회신을 확인하고 새 초안을 작성해 주세요.</p>
        ) : (
          <p className="action-note">메일을 발송하고 있습니다.</p>
        )}
      </div>
      {confirmSend && (
        <div className="inline-confirm" role="alertdialog" aria-labelledby="send-confirm-title">
          <div><h3 id="send-confirm-title">서명 요청 메일을 보낼까요?</h3><p><strong>{contract.recipientName}</strong> · {contract.recipientEmail}<br />수신자는 이메일의 링크에서 계약서를 확인하고 서명합니다.</p></div>
          <div className="confirm-actions"><button className="button button-secondary" onClick={() => setConfirmSend(false)} type="button">취소</button><button className="button button-primary" onClick={() => void confirmAndSend()} type="button"><Icon name="send" size={15} /> 메일 발송</button></div>
        </div>
      )}
    </section>
  );
}

function ContractPaper({ contract }: { contract: ContractRecord }) {
  return (
    <article className="contract-paper">
      <div className="paper-heading">
        <span>AGREEMENT</span>
        <span>{formatDate(contract.createdAt)}</span>
      </div>
      <h3>{contract.title}</h3>
      <div className="paper-parties">
        <span>갑 <strong>{contract.senderName}</strong></span>
        <span>을 <strong>{contract.recipientName}</strong></span>
      </div>
      <div className="paper-body">
        {contract.body.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      <div className="paper-signatures">
        <div><span>갑 · {contract.senderName}</span>{contract.senderSignature ? <img alt={`${contract.senderName}의 서명`} src={contract.senderSignature} /> : <i />}</div>
        <div><span>을 · {contract.recipientName}</span>{contract.recipientSignature ? <img alt={`${contract.recipientName}의 서명`} src={contract.recipientSignature} /> : <i />}</div>
      </div>
      <div className="paper-page">1</div>
    </article>
  );
}

function ContractEditor({
  contract,
  open,
  onClose,
  onSaved,
}: {
  contract?: ContractRecord;
  open: boolean;
  onClose: () => void;
  onSaved: (contract: ContractRecord) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sourceMode, setSourceMode] = useState<"write" | "pdf">("write");
  const [signature, setSignature] = useState<string>();
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSourceMode(contract?.storedFilename ? "pdf" : "write");
    setSignature(contract?.senderSignature);
    setFilename(contract?.originalFilename ?? "");
    setError("");
  }, [contract, open]);

  async function saveContract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("senderSignature", signature ?? "");
    formData.set(
      "removeFile",
      sourceMode === "write" && Boolean(contract?.storedFilename) ? "true" : "false",
    );
    if (sourceMode === "write") formData.set("file", new File([], ""));
    if (contract) formData.set("id", contract.id);
    try {
      const response = await fetch("/api/contracts", {
        method: contract ? "PATCH" : "POST",
        body: formData,
      });
      const result = (await response.json()) as ContractRecord & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "계약을 저장하지 못했습니다.");
        return;
      }
      onSaved(result);
    } catch {
      setError("서버에 연결하지 못했습니다. 연결 상태를 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      aria-labelledby="editor-title"
      className="editor-dialog"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      ref={dialogRef}
    >
      <div className="editor-header">
        <div><span className="section-overline">{contract ? "계약 파일 수정" : "새 계약 파일"}</span><h2 id="editor-title">{contract ? "초안 수정" : "계약 초안 작성"}</h2></div>
        <button aria-label="작성 창 닫기" className="icon-button" onClick={onClose} type="button"><Icon name="close" /></button>
      </div>
      <form className="editor-form" onSubmit={(event) => void saveContract(event)}>
        <div className="form-section">
          <div className="form-section-heading"><span className="form-step">A</span><div><h3>계약 정보</h3><p>계약명과 원문을 입력합니다.</p></div></div>
          <label className="field-label">계약명<input autoFocus defaultValue={contract?.title} maxLength={120} name="title" placeholder="예: 2026년 서비스 이용 계약" required /></label>
          <div className="source-toggle" aria-label="계약서 작성 방법">
            <button aria-pressed={sourceMode === "write"} className={sourceMode === "write" ? "chosen" : ""} onClick={() => setSourceMode("write")} type="button"><Icon name="edit" size={16} /> 내용 직접 작성</button>
            <button aria-pressed={sourceMode === "pdf"} className={sourceMode === "pdf" ? "chosen" : ""} onClick={() => setSourceMode("pdf")} type="button"><Icon name="upload" size={16} /> PDF 업로드</button>
          </div>
          {sourceMode === "write" ? (
            <label className="field-label">계약 내용<textarea defaultValue={contract?.body} name="body" placeholder={"제1조 (목적)\n본 계약은 양 당사자 간의 권리와 의무를 정함을 목적으로 합니다.\n\n제2조 (계약 기간)\n계약 기간은 양 당사자가 서명한 날부터 시작합니다."} rows={8} required={!contract?.storedFilename} /></label>
          ) : (
            <div className="upload-field">
              <label className="upload-drop" htmlFor="contract-pdf">
                <Icon name="upload" size={20} />
                <strong>{filename || "PDF 파일을 선택해 주세요"}</strong>
                <span>15MB 이하 · PDF 형식</span>
                <input accept="application/pdf,.pdf" className="visually-hidden" id="contract-pdf" name="file" onChange={(event) => setFilename(event.target.files?.[0]?.name ?? contract?.originalFilename ?? "")} type="file" />
              </label>
              {contract?.storedFilename && !filename && <p className="upload-hint">기존 파일: {contract.originalFilename}</p>}
              <p className="upload-hint">업로드한 PDF는 미리보기와 서명 요청 메일에 첨부된 링크에서 확인할 수 있습니다.</p>
            </div>
          )}
        </div>
        <div className="form-section">
          <div className="form-section-heading"><span className="form-step">B</span><div><h3>계약 당사자</h3><p>서명 요청을 보낼 사람을 지정합니다.</p></div></div>
          <div className="form-grid">
            <label className="field-label">보내는 사람<input defaultValue={contract?.senderName} maxLength={100} name="senderName" placeholder="담당자 이름" required /></label>
            <label className="field-label">보내는 사람 이메일<input defaultValue={contract?.senderEmail} name="senderEmail" placeholder="you@company.com" required type="email" /></label>
            <label className="field-label">서명자<input defaultValue={contract?.recipientName} maxLength={100} name="recipientName" placeholder="거래처 담당자" required /></label>
            <label className="field-label">서명자 이메일<input defaultValue={contract?.recipientEmail} name="recipientEmail" placeholder="signer@company.com" required type="email" /></label>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-heading"><span className="form-step">C</span><div><h3>보내는 사람 서명</h3><p>필요하면 직접 그리거나 이미지로 넣을 수 있습니다.</p></div></div>
          <SignaturePad id="sender-signature" label="보내는 사람 서명 (선택)" onChange={setSignature} value={signature} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="editor-footer">
          <button className="button button-secondary" onClick={onClose} type="button">취소</button>
          <button className="button button-primary" disabled={saving} type="submit"><Icon name="check" size={16} /> {saving ? "저장 중…" : "저장하고 미리보기"}</button>
        </div>
      </form>
    </dialog>
  );
}
