"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useSupport } from "@/components/SupportContext";
import LoadingState from "@/components/LoadingState";
import { RequestStatus, requestDate } from "@/components/RequestUI";
import { REQUEST_STATUS_LABELS } from "@/lib/requests.mjs";

const CASE_LABELS = { open: "Новая жалоба", reviewing: "На рассмотрении", resolved: "Решена", rejected: "Отклонена" };
const RESOLUTION_LABELS = { refund: "Вернуть минуты", cancel: "Отменить занятие", refund_cancel: "Отменить и вернуть минуты", reject: "Отклонить жалобу" };
const AUDIT_LABELS = {
  case_created: "Жалоба отправлена", complaint_created: "Жалоба отправлена", case_message: "Сообщение в поддержку",
  case_status: "Статус жалобы изменён", case_resolved: "Решение по жалобе", case_rejected: "Жалоба отклонена",
  refund: "Возврат минут", admin_refund: "Возврат минут", transfer: "Ручной перевод минут", admin_transfer: "Ручной перевод минут",
  request_status: "Статус заявки изменён", admin_status: "Статус заявки изменён", cancel: "Отмена занятия", cancel_request: "Отмена занятия", resolve_case: "Решение по жалобе", refund_cancel: "Отмена и возврат минут",
};
const buttonClass = "btn bg-y text-sm disabled:opacity-50";
const activeRequest = (request) => ["pending", "accepted", "in_progress", "awaiting_confirmation"].includes(request?.status);
const refundRemaining = (request) => request?.status === "completed" ? Math.max(0, request.minutes - (request.refundedMinutes || 0)) : 0;

function CaseStatus({ status }) {
  const { t } = useLanguage();
  return <span className={`inline-block border-2 border-ink px-2 py-1 text-xs font-bold text-k ${status === "resolved" ? "bg-lb" : status === "rejected" ? "bg-co" : status === "reviewing" ? "bg-pu" : "bg-y"}`}>{t(CASE_LABELS[status] || status)}</span>;
}

function Person({ person }) {
  return <div className="min-w-0"><span className="font-semibold break-words">{person?.name || "—"}</span><span className="block text-xs text-ink/60 break-all mt-1">{person?.email || "—"}</span></div>;
}

function Empty({ children }) {
  return <p className="border-2 border-dashed border-ink p-6 text-sm text-ink/70">{children}</p>;
}

function ReasonField({ value, onChange, disabled, id }) {
  const { t } = useLanguage();
  return <div><label className="lbl block mb-2" htmlFor={id}>{t("Основание решения")}</label><textarea id={id} className="fld min-h-28" required minLength={10} maxLength={2000} value={value} disabled={disabled} onChange={(event) => { event.target.setCustomValidity(event.target.value.trim().length < 10 ? t("Укажите причину: не менее 10 символов без крайних пробелов.") : ""); onChange(event.target.value); }} aria-describedby={`${id}-hint`} /><p id={`${id}-hint`} className="text-xs text-ink/60 mt-2">{t("От 10 до 2000 символов. Причину увидят участники, она сохранится в истории.")}</p></div>;
}

function Confirmation({ children, reason, warning, busy, onConfirm, onBack }) {
  const { t } = useLanguage();
  return <div className="border-2 border-ink bg-bg p-4 mt-4" aria-busy={busy}>
    <p className="font-bold text-sm">{t("Подтвердите операцию")}</p><div className="text-sm mt-3 break-words">{children}</div>
    {warning && <p className="border-l-4 border-ink pl-3 text-sm font-semibold mt-3">{warning}</p>}
    <p className="text-sm whitespace-pre-wrap break-words mt-3"><strong>{t("Причина:")}</strong> {reason}</p>
    <div className="flex flex-wrap gap-3 mt-4"><button type="button" className={buttonClass} disabled={busy} onClick={onConfirm}>{t(busy ? "Выполняем…" : "Подтвердить операцию")}</button><button type="button" className="text-sm underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={onBack}>{t("Вернуться к редактированию")}</button></div>
  </div>;
}

function ComplaintDetail({ item, request, support, busy, perform }) {
  const { t, locale } = useLanguage();
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [minutes, setMinutes] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const closed = ["resolved", "rejected"].includes(item.status);
  const remaining = refundRemaining(request);
  const actions = [
    ...(!closed && item.status === "open" ? [["reviewing", "Взять на рассмотрение"]] : []),
    ...(!closed && item.status === "reviewing" ? [["open", "Вернуть в новые жалобы"]] : []),
    ...(!closed && remaining > 0 ? [["refund", "Вернуть минуты"], ["refund_cancel", "Отменить и вернуть минуты"]] : []),
    ...(!closed && activeRequest(request) ? [["cancel", "Отменить занятие"]] : []),
    ...(!closed ? [["reject", "Отклонить жалобу"]] : []),
  ];
  const selectedAction = actions.some(([value]) => value === action) ? action : actions[0]?.[0] || "";
  const isRefund = selectedAction === "refund";

  function review(event) {
    event.preventDefault();
    if (busy || !selectedAction || reason.trim().length < 10) return;
    setConfirmation({ action: selectedAction, reason: reason.trim(), ...(["refund", "refund_cancel"].includes(selectedAction) ? { minutes: selectedAction === "refund_cancel" ? remaining : Number(minutes ?? remaining) } : {}) });
  }
  async function apply() {
    if (!confirmation) return;
    const decision = confirmation;
    const ok = await perform(() => ["open", "reviewing"].includes(decision.action)
      ? support.updateCaseStatus(item.id, decision.action, decision.reason)
      : support.resolveCase(item.id, decision), "Решение сохранено. Участники получили уведомление.");
    if (ok) { setConfirmation(null); setReason(""); setMinutes(null); }
  }

  return <article className="min-w-0 border-2 border-ink bg-card p-5 sm:p-6 shs">
    <div className="flex flex-wrap gap-3 justify-between items-start"><h2 className="font-head font-extrabold text-2xl break-words">{item.title}</h2><CaseStatus status={item.status} /></div>
    <p className="text-xs text-ink/60 mt-3">{t("Создана {date}", { date: requestDate(item.createdAt, locale) })}</p>
    <div className="mt-5"><span className="lbl">{t("Автор жалобы")}</span><div className="mt-2"><Person person={item.reporter} /></div></div>
    <p className="whitespace-pre-wrap break-words border-l-4 border-ink pl-4 mt-5 text-sm">{item.text}</p>
    <div className="grid sm:grid-cols-2 gap-4 mt-5"><div><span className="lbl">{t("Заказчик")}</span><div className="mt-2"><Person person={item.customer || request?.customer} /></div></div><div><span className="lbl">{t("Исполнитель")}</span><div className="mt-2"><Person person={item.provider || request?.provider} /></div></div></div>
    {request && <div className="border-2 border-ink p-3 mt-5 flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-semibold">{t("Занятие: {minutes} мин", { minutes: request.minutes })}</span><RequestStatus status={request.status} /></div>}
    <Link href={`/support/${encodeURIComponent(item.id)}`} className="btn bg-lb text-k inline-block text-sm mt-5">{t("Открыть переписку по жалобе ↗")}</Link>
    {item.resolution && <div className="border-2 border-ink bg-bg p-4 mt-6"><h3 className="font-bold">{t("Итог рассмотрения")}</h3><p className="text-sm mt-3">{t(RESOLUTION_LABELS[item.resolution.action] || item.resolution.action)}{item.resolution.minutes > 0 && ` · ${item.resolution.minutes} ${t("мин")}`}</p><p className="text-sm whitespace-pre-wrap break-words mt-3">{item.resolution.reason}</p><p className="text-xs text-ink/60 mt-3">{requestDate(item.resolution.createdAt, locale)}</p></div>}
    {!closed && <form onSubmit={review} className="border-t-2 border-ink pt-5 mt-6">
      <h3 className="font-head font-extrabold text-xl mb-4">{t("Решение администратора")}</h3>
      <label htmlFor="case-action" className="lbl block mb-2">{t("Действие")}</label><select id="case-action" className="fld mb-4" value={selectedAction} onChange={(event) => { setAction(event.target.value); setConfirmation(null); }} disabled={busy || Boolean(confirmation)}>{actions.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
      {isRefund && <div className="mb-4"><label className="lbl block mb-2" htmlFor="case-refund-minutes">{t("Сумма возврата, мин")}</label><input id="case-refund-minutes" className="fld" type="number" min="1" max={remaining} step="1" required value={minutes ?? remaining} onChange={(event) => setMinutes(event.target.value)} disabled={busy || Boolean(confirmation)} /><p className="text-xs text-ink/60 mt-2">{t("Можно вернуть до {minutes} мин с учётом прошлых возвратов.", { minutes: remaining })}</p></div>}
      {selectedAction === "refund_cancel" && <p className="text-sm mb-4">{t("При отмене вернутся все оставшиеся оплаченные минуты: {minutes} мин.", { minutes: remaining })}</p>}
      <ReasonField id="case-reason" value={reason} onChange={setReason} disabled={busy || Boolean(confirmation)} />
      {!confirmation && <button type="submit" className={`${buttonClass} mt-4`} disabled={busy || !selectedAction}>{t("Проверить решение")}</button>}
      {confirmation && <Confirmation busy={busy} reason={confirmation.reason} warning={["refund", "refund_cancel"].includes(confirmation.action) ? t("Минуты спишутся у исполнителя и вернутся заказчику. Баланс исполнителя может стать отрицательным.") : null} onBack={() => setConfirmation(null)} onConfirm={apply}><p>{t(actions.find(([value]) => value === confirmation.action)?.[1] || RESOLUTION_LABELS[confirmation.action] || confirmation.action)}{confirmation.minutes > 0 && ` · ${confirmation.minutes} ${t("мин")}`}</p></Confirmation>}
    </form>}
  </article>;
}

function RequestDetail({ request, support, busy, perform }) {
  const { t, locale } = useLanguage();
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const remaining = refundRemaining(request);
  const next = { pending: "accepted", accepted: "in_progress", in_progress: "awaiting_confirmation", awaiting_confirmation: "completed" }[request.status];
  const actions = [
    ...(activeRequest(request) ? [["cancelled", "Отменить занятие"]] : []),
    ...(next ? [[next, { accepted: "Принять заявку", in_progress: "Начать занятие", awaiting_confirmation: "Занятие проведено", completed: "Подтвердить завершение" }[next]]] : []),
    ...(remaining > 0 ? [["refund", "Вернуть минуты"]] : []),
  ];
  const selectedAction = actions.some(([value]) => value === action) ? action : actions[0]?.[0] || "";
  const messages = support.getRequestMessages(request.id) || [];

  function review(event) {
    event.preventDefault();
    if (busy || !selectedAction || reason.trim().length < 10) return;
    setConfirmation({ action: selectedAction, reason: reason.trim(), ...(selectedAction === "refund" ? { minutes: Number(minutes ?? remaining) } : {}) });
  }
  async function apply() {
    if (!confirmation) return;
    const decision = confirmation;
    const ok = await perform(() => decision.action === "refund"
      ? support.adminRefundRequest(request.id, { reason: decision.reason, minutes: decision.minutes })
      : support.adminChangeRequest(request.id, { status: decision.action, reason: decision.reason }), "Операция по заявке сохранена.");
    if (ok) { setConfirmation(null); setReason(""); setMinutes(null); }
  }

  return <article className="min-w-0 border-2 border-ink bg-card p-5 sm:p-6 shs">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="font-head font-extrabold text-2xl break-words">{request.title}</h2><RequestStatus status={request.status} /></div>
    <p className="text-sm mt-3">{t("Занятие: {minutes} мин", { minutes: request.minutes })} · {requestDate(request.scheduledAt, locale)}</p>
    <p className="text-xs break-all text-ink/60 mt-2">{t("Номер заявки:")} {request.id}</p>
    {(request.refundedMinutes || 0) > 0 && <p className="text-sm font-semibold mt-3">{t("Возвращено: {minutes} мин", { minutes: request.refundedMinutes })}</p>}
    <div className="grid sm:grid-cols-2 gap-4 mt-5"><div><span className="lbl">{t("Заказчик")}</span><div className="mt-2"><Person person={request.customer} /></div></div><div><span className="lbl">{t("Исполнитель")}</span><div className="mt-2"><Person person={request.provider} /></div></div></div>
    {actions.length > 0 && <form onSubmit={review} className="border-t-2 border-ink pt-5 mt-6"><h3 className="font-head font-extrabold text-xl mb-4">{t("Управление заявкой")}</h3>
      <label className="lbl block mb-2" htmlFor="request-admin-action">{t("Действие")}</label><select id="request-admin-action" className="fld mb-4" value={selectedAction} disabled={busy || Boolean(confirmation)} onChange={(event) => { setAction(event.target.value); setConfirmation(null); }}>{actions.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
      {selectedAction === "refund" && <div className="mb-4"><label className="lbl block mb-2" htmlFor="request-refund-minutes">{t("Сумма возврата, мин")}</label><input id="request-refund-minutes" className="fld" type="number" min="1" max={remaining} step="1" required value={minutes ?? remaining} disabled={busy || Boolean(confirmation)} onChange={(event) => setMinutes(event.target.value)} /><p className="text-xs text-ink/60 mt-2">{t("Можно вернуть до {minutes} мин с учётом прошлых возвратов.", { minutes: remaining })}</p></div>}
      <ReasonField id="request-admin-reason" value={reason} onChange={setReason} disabled={busy || Boolean(confirmation)} />
      {!confirmation && <button type="submit" className={`${buttonClass} mt-4`} disabled={busy}>{t("Проверить операцию")}</button>}
      {confirmation && <Confirmation busy={busy} reason={confirmation.reason} onBack={() => setConfirmation(null)} onConfirm={apply} warning={confirmation.action === "refund" ? t("Минуты спишутся у исполнителя и вернутся заказчику. Баланс исполнителя может стать отрицательным.") : confirmation.action === "completed" ? t("Завершение спишет {minutes} мин у заказчика и переведёт их исполнителю. Баланс заказчика может стать отрицательным.", { minutes: request.minutes }) : confirmation.action === "cancelled" ? t("Занятие будет отменено, зарезервированные минуты освободятся.") : null}>{t(actions.find(([value]) => value === confirmation.action)?.[1] || confirmation.action)}{confirmation.minutes > 0 && ` · ${confirmation.minutes} ${t("мин")}`}</Confirmation>}
    </form>}
    <section className="mt-7"><h3 className="font-head font-extrabold text-xl">{t("Переписка участников")}</h3><p className="text-xs text-ink/60 mt-2">{t("Полная переписка помогает проверить обстоятельства жалобы.")}</p>
      {messages.length ? <ol className="grid gap-3 mt-4 max-h-96 overflow-y-auto pr-1" aria-label={t("Переписка участников")}>{messages.map((message) => <li key={message.id} className="border-2 border-ink p-3"><p className="font-semibold text-sm break-words">{message.authorName}<span className="block text-xs font-normal text-ink/60 break-all mt-1">{message.authorEmail}</span></p><p className="whitespace-pre-wrap break-words text-sm mt-3">{message.text}</p><time dateTime={message.createdAt} className="block text-xs text-ink/60 mt-3">{requestDate(message.createdAt, locale)}</time></li>)}</ol> : <p className="text-sm text-ink/60 mt-4">{t("В заявке пока нет сообщений.")}</p>}
    </section>
    <section className="mt-7"><h3 className="font-head font-extrabold text-xl">{t("История статусов")}</h3><ol className="border-l-2 border-ink pl-4 mt-4 grid gap-4">{(request.history || []).map((entry, index) => <li key={`${entry.createdAt}-${index}`} className="text-sm"><span className="font-semibold">{t(REQUEST_STATUS_LABELS[entry.status] || entry.status)}</span><span className="block text-xs text-ink/60 break-all mt-1">{entry.by} · {requestDate(entry.createdAt, locale)}</span>{entry.reason && <p className="whitespace-pre-wrap break-words mt-2">{entry.reason}</p>}</li>)}</ol></section>
  </article>;
}

function BalancePanel({ participants, support, busy, perform }) {
  const { t, locale } = useLanguage();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [validation, setValidation] = useState("");
  const chosenFrom = participants.find((person) => person.email === from);
  function review(event) {
    event.preventDefault();
    if (busy) return;
    if (from === to) { setValidation("Выберите двух разных участников."); return; }
    if (!Number.isSafeInteger(Number(minutes)) || Number(minutes) <= 0) { setValidation("Укажите положительное целое число минут."); return; }
    if (reason.trim().length < 10) return;
    setValidation(""); setConfirmation({ from, to, minutes: Number(minutes), reason: reason.trim() });
  }
  async function apply() {
    if (!confirmation) return;
    if (await perform(() => support.adminTransfer(confirmation), "Минуты переведены. Операция записана в историю.")) { setConfirmation(null); setReason(""); setMinutes(""); }
  }
  return <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
    <section className="min-w-0"><h2 className="font-head font-extrabold text-2xl mb-4">{t("Балансы участников")}</h2><p className="text-sm text-ink/65 mb-5">{t("Общий баланс учитывает все операции. Доступный остаток учитывает резерв по занятиям.")}</p>
      {participants.length ? <div className="overflow-x-auto border-2 border-ink bg-card"><table className="w-full text-left text-sm"><thead className="bg-lb text-k border-b-2 border-ink"><tr>{["Участник", "Баланс", "Доступно", "В резерве"].map((label) => <th key={label} className="p-3 align-top">{t(label)}</th>)}</tr></thead><tbody>{participants.map((person) => <tr key={person.email} className="border-t-2 border-ink"><td className="p-3 min-w-40"><Person person={person} />{person.balance < 0 && <span className="inline-block border border-ink bg-co text-k px-2 py-1 text-xs mt-2">{t("Задолженность")}</span>}</td>{[person.balance, person.available, person.reserved].map((value, index) => <td key={index} className={`p-3 align-top tabular-nums font-semibold ${value < 0 ? "text-acc" : ""}`}>{Number(value || 0).toLocaleString(locale)} <span className="text-xs font-normal">{t("мин")}</span></td>)}</tr>)}</tbody></table></div> : <Empty>{t("Участников пока нет.")}</Empty>}
    </section>
    <form onSubmit={review} className="border-2 border-ink bg-card p-5 sm:p-6 shs min-w-0"><h2 className="font-head font-extrabold text-2xl">{t("Ручной перевод минут")}</h2><p className="text-sm text-ink/65 mt-3 mb-5">{t("Используйте перевод для исправления ошибок. Операция требует причины и сохраняется в журнале.")}</p>
      <label htmlFor="transfer-from" className="lbl block mb-2">{t("Списать у участника")}</label><select id="transfer-from" className="fld" required value={from} disabled={busy || Boolean(confirmation)} onChange={(event) => { setFrom(event.target.value); setValidation(""); }}><option value="">{t("Выберите участника")}</option>{participants.map((person) => <option key={person.email} value={person.email}>{person.name} · {person.email}</option>)}</select>
      {chosenFrom && <p className="text-xs text-ink/65 mt-2">{t("Доступно: {minutes} мин", { minutes: chosenFrom.available })}</p>}
      <label htmlFor="transfer-to" className="lbl block mb-2 mt-4">{t("Начислить участнику")}</label><select id="transfer-to" className="fld" required value={to} disabled={busy || Boolean(confirmation)} onChange={(event) => { setTo(event.target.value); setValidation(""); }}><option value="">{t("Выберите участника")}</option>{participants.map((person) => <option key={person.email} value={person.email}>{person.name} · {person.email}</option>)}</select>
      <label htmlFor="transfer-minutes" className="lbl block mb-2 mt-4">{t("Количество минут")}</label><input id="transfer-minutes" className="fld mb-4" type="number" min="1" step="1" required value={minutes} disabled={busy || Boolean(confirmation)} onChange={(event) => setMinutes(event.target.value)} />
      <ReasonField id="transfer-reason" value={reason} onChange={setReason} disabled={busy || Boolean(confirmation)} />
      {validation && <p role="alert" className="text-sm bg-co text-k border-2 border-ink p-3 mt-4">{t(validation)}</p>}
      {!confirmation && <button type="submit" className={`${buttonClass} mt-4`} disabled={busy || participants.length < 2}>{t("Проверить перевод")}</button>}
      {confirmation && <Confirmation busy={busy} reason={confirmation.reason} warning={t("Баланс отправителя может стать отрицательным. Резервы активных занятий сохранятся.")} onBack={() => setConfirmation(null)} onConfirm={apply}><p>{t("Перевести {minutes} мин", { minutes: confirmation.minutes })}</p><p className="break-all mt-2">{confirmation.from} → {confirmation.to}</p></Confirmation>}
    </form>
  </div>;
}

function AuditPanel({ audit }) {
  const { t, locale } = useLanguage();
  return <section><h2 className="font-head font-extrabold text-2xl">{t("Журнал действий администратора")}</h2><p className="text-sm text-ink/65 mt-3 mb-5">{t("История сохраняет причину, автора и сумму каждой операции.")}</p>
    {audit.length ? <ol className="grid gap-4">{[...audit].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((entry) => <li key={entry.id} className="border-2 border-ink bg-card p-5">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="font-bold">{t(AUDIT_LABELS[entry.action] || entry.action)}{entry.minutes > 0 && ` · ${entry.minutes} ${t("мин")}`}</h3><time dateTime={entry.createdAt} className="text-xs text-ink/60">{requestDate(entry.createdAt, locale)}</time></div>
      <p className="text-xs text-ink/60 break-all mt-2">{entry.actorEmail || entry.by}</p>
      {entry.status && <div className="mt-3">{CASE_LABELS[entry.status] ? <CaseStatus status={entry.status} /> : <RequestStatus status={entry.status} />}</div>}
      {(entry.from || entry.to) && <p className="text-sm break-all mt-3">{entry.from || "—"} → {entry.to || "—"}</p>}
      {entry.reason && <p className="text-sm whitespace-pre-wrap break-words mt-3">{entry.reason}</p>}
      <div className="flex flex-wrap gap-4 text-xs mt-3">{entry.caseId && <Link href={`/support/${encodeURIComponent(entry.caseId)}`} className="underline underline-offset-4">{t("Открыть жалобу ↗")}</Link>}{entry.requestId && <span className="break-all text-ink/60">{t("Номер заявки:")} {entry.requestId}</span>}</div>
    </li>)}</ol> : <Empty>{t("Административных операций пока нет.")}</Empty>}
  </section>;
}

export default function AdminPage() {
  const { t, locale } = useLanguage();
  const queryCase = useSearchParams().get("case")?.trim() || "";
  const { user, ready: authReady, isAdmin } = useAuth();
  const support = useSupport();
  const { ready, error, refresh, cases = [], allRequests = [], participants = [], audit = [] } = support;
  const [tab, setTab] = useState("cases");
  const [caseFilter, setCaseFilter] = useState("active");
  const [requestFilter, setRequestFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [selectedRequest, setSelectedRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [success, setSuccess] = useState("");
  const operationPending = useRef(false);

  useEffect(() => {
    if (!queryCase) return;
    setTab("cases"); setCaseFilter("all"); setSearch(""); setSelectedCase(queryCase);
  }, [queryCase]);

  async function perform(operation, successMessage) {
    if (operationPending.current) return false;
    operationPending.current = true; setBusy(true); setOperationError(""); setSuccess("");
    try { await operation(); setSuccess(successMessage); return true; }
    catch (err) { setOperationError(err?.message || "Не удалось выполнить операцию. Попробуйте ещё раз."); return false; }
    finally { operationPending.current = false; setBusy(false); }
  }

  if (!authReady || (user && isAdmin && !ready && !error)) return <div className="max-w-6xl mx-auto px-4 py-10"><LoadingState variant="dashboard" label="Загружаем панель администратора…" /></div>;
  if (!user || !isAdmin) return <section className="max-w-2xl mx-auto px-4 py-14"><div className="border-2 border-ink bg-card p-7 sh"><span className="lbl text-acc">{t("Управление SkillBarter")}</span><h1 className="font-head font-extrabold text-4xl mt-4">{t("Доступ для администратора")}</h1><p className="text-sm text-ink/70 mt-4">{t("Для рассмотрения жалоб и управления минутами войдите в аккаунт администратора.")}</p><Link href="/login?next=%2Fadmin" className="btn bg-y inline-block mt-6">{t("Войти в аккаунт ↗")}</Link></div></section>;
  if (error) return <section className="max-w-4xl mx-auto px-4 py-14"><p role="alert" className="border-2 border-ink bg-co text-k p-5">{t(error.message || error)}</p><button type="button" onClick={refresh} className="btn bg-y mt-5">{t("Повторить загрузку")}</button></section>;

  const query = search.trim().toLocaleLowerCase(locale);
  const matches = (item) => !query || [item.id, item.requestId, item.title, item.reporter?.name, item.reporter?.email, item.customer?.name, item.customer?.email, item.provider?.name, item.provider?.email].filter(Boolean).some((value) => value.toLocaleLowerCase(locale).includes(query));
  const visibleCases = [...cases].filter((item) => (caseFilter === "all" || caseFilter === "active" && ["open", "reviewing"].includes(item.status) || caseFilter === item.status) && matches(item)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const visibleRequests = [...allRequests].filter((item) => (requestFilter === "all" || item.status === requestFilter) && matches(item)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const focusedCase = visibleCases.find((item) => item.id === selectedCase) || visibleCases[0];
  const focusedRequest = visibleRequests.find((item) => item.id === selectedRequest) || visibleRequests[0];
  const openCount = cases.filter((item) => ["open", "reviewing"].includes(item.status)).length;

  return <section className="max-w-6xl mx-auto px-4 py-10 md:py-14" aria-busy={busy}>
    <div className="flex flex-wrap justify-between items-end gap-5"><div><span className="lbl text-acc">{t("Поддержка и контроль обменов")}</span><h1 className="font-head font-extrabold text-4xl md:text-6xl mt-3">{t("Панель администратора")}</h1><p className="text-sm text-ink/65 mt-4">{t("Рассматривайте жалобы, проверяйте занятия и возвращайте минуты при нарушениях.")}</p></div><Link href="/support" className="border-2 border-ink bg-card px-4 py-3 text-sm font-bold">{t("Центр поддержки ↗")}</Link></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">{[["Ждут решения", openCount, "bg-y"], ["Всего заявок", allRequests.length, "bg-lb"], ["Участников", participants.length, "bg-pu"], ["Операций в журнале", audit.length, "bg-co"]].map(([label, value, color]) => <div key={label} className={`border-2 border-ink p-4 sm:p-5 ${color} text-k shs`}><span className="lbl">{t(label)}</span><p className="font-head font-extrabold text-3xl mt-3">{Number(value).toLocaleString(locale)}</p></div>)}</div>
    <nav className="flex flex-wrap gap-3 mt-8" aria-label={t("Разделы панели администратора")}>{[["cases", "Жалобы"], ["requests", "Все заявки"], ["balances", "Минуты и участники"], ["audit", "История операций"]].map(([value, label]) => <button key={value} type="button" disabled={busy} aria-current={tab === value ? "page" : undefined} onClick={() => { setTab(value); setOperationError(""); setSuccess(""); }} className={`border-2 border-ink px-4 py-3 text-sm font-bold disabled:opacity-50 ${tab === value ? "bg-y text-k" : "bg-card"}`}>{t(label)}</button>)}</nav>
    {operationError && <p role="alert" className="border-2 border-ink bg-co text-k p-4 mt-6">{t(operationError)}</p>}
    {success && <p role="status" className="border-2 border-ink bg-lb text-k p-4 mt-6">{t(success)}</p>}
    {["cases", "requests"].includes(tab) && <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(13rem,.55fr)] gap-4 mt-7"><div><label className="lbl block mb-2" htmlFor="admin-search">{t("Поиск по имени, почте или заявке")}</label><input id="admin-search" className="fld" type="search" value={search} disabled={busy} onChange={(event) => setSearch(event.target.value)} /></div><div><label className="lbl block mb-2" htmlFor="admin-filter">{t("Статус")}</label>{tab === "cases" ? <select id="admin-filter" className="fld" value={caseFilter} disabled={busy} onChange={(event) => setCaseFilter(event.target.value)}>{[["active", "Требуют решения"], ["all", "Все жалобы"], ...Object.entries(CASE_LABELS)].map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select> : <select id="admin-filter" className="fld" value={requestFilter} disabled={busy} onChange={(event) => setRequestFilter(event.target.value)}><option value="all">{t("Все статусы")}</option>{Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>}</div></div>}
    {tab === "cases" && <div className="mt-6">{visibleCases.length ? <div className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.3fr)] gap-6 items-start"><div className="grid gap-4">{visibleCases.map((item) => <button key={item.id} type="button" disabled={busy} aria-pressed={focusedCase?.id === item.id} onClick={() => setSelectedCase(item.id)} className={`text-left border-2 border-ink p-4 disabled:opacity-50 ${focusedCase?.id === item.id ? "bg-y text-k shs" : "bg-card"}`}><CaseStatus status={item.status} /><span className="block font-head font-extrabold text-xl mt-3 break-words">{item.title}</span><span className="block text-sm mt-2 break-words">{item.reporter?.name}</span><span className="block text-xs mt-2 opacity-65">{requestDate(item.createdAt, locale)}</span></button>)}</div><ComplaintDetail key={focusedCase.id} item={focusedCase} request={allRequests.find((item) => item.id === focusedCase.requestId)} support={support} busy={busy} perform={perform} /></div> : <Empty>{t(query || caseFilter !== "active" ? "По вашему запросу ничего не найдено." : "Новых жалоб нет. Все обращения рассмотрены.")}</Empty>}</div>}
    {tab === "requests" && <div className="mt-6">{visibleRequests.length ? <div className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.3fr)] gap-6 items-start"><div className="grid gap-4">{visibleRequests.map((request) => <button key={request.id} type="button" disabled={busy} aria-pressed={focusedRequest?.id === request.id} onClick={() => setSelectedRequest(request.id)} className={`text-left border-2 border-ink p-4 disabled:opacity-50 ${focusedRequest?.id === request.id ? "bg-y text-k shs" : "bg-card"}`}><RequestStatus status={request.status} /><span className="block font-head font-extrabold text-xl mt-3 break-words">{request.title}</span><span className="block text-sm mt-2 break-words">{request.customer.name} → {request.provider.name}</span><span className="block text-xs mt-2 opacity-65">{requestDate(request.scheduledAt, locale)} · {request.minutes} {t("мин")}</span></button>)}</div><RequestDetail key={focusedRequest.id} request={focusedRequest} support={support} busy={busy} perform={perform} /></div> : <Empty>{t("По вашему запросу ничего не найдено.")}</Empty>}</div>}
    {tab === "balances" && <div className="mt-7"><BalancePanel participants={participants} support={support} busy={busy} perform={perform} /></div>}
    {tab === "audit" && <div className="mt-7"><AuditPanel audit={audit} /></div>}
  </section>;
}
