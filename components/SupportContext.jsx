"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useWallet } from "./WalletContext";
import { balanceFor, ensureAccount } from "@/lib/wallet.mjs";
import { availableBalanceFor, readActivity, reservedFor } from "@/lib/requests.mjs";
import { addSupportMessage, adminRefundRequest as refundRequest, adminSetRequestStatus, adminTransferMinutes,
  changeSupportStatus, markSupportCaseRead, openComplaint, readSupport, resolveComplaint } from "@/lib/support.mjs";

const SupportContext = createContext(null);

export function SupportProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const { ready, error, refresh, ledger, mutateLedger, participants: walletParticipants } = useWallet();
  const support = useMemo(() => readSupport(ledger), [ledger]);
  const activity = useMemo(() => readActivity(ledger), [ledger]);
  const cases = useMemo(() => support.cases.filter((item) => isAdmin || (user &&
    [item.customer.email, item.provider.email].includes(user.email))), [support, user, isAdmin]);
  const visibleIds = useMemo(() => new Set(cases.map((item) => item.id)), [cases]);
  const getCaseMessages = useCallback((id) => visibleIds.has(id) ? support.messages.filter((message) => message.caseId === id) : [], [support, visibleIds]);
  const getRequestMessages = useCallback((id) => isAdmin ? activity.messages.filter((message) => message.requestId === id) : [], [activity, isAdmin]);

  const createComplaint = useCallback(async (values) => {
    const id = crypto.randomUUID();
    await mutateLedger((current) => openComplaint(current, user, values, id));
    return id;
  }, [mutateLedger, user]);
  const sendCaseMessage = useCallback((id, text) => {
    const messageId = crypto.randomUUID();
    return mutateLedger((current) => addSupportMessage(current, user, id, text, messageId));
  }, [mutateLedger, user]);
  const markCaseRead = useCallback((id) => mutateLedger((current) => markSupportCaseRead(current, user, id)), [mutateLedger, user]);
  const updateCaseStatus = useCallback((id, status, reason) => mutateLedger((current) => changeSupportStatus(current, user, id, status, reason)), [mutateLedger, user]);
  const resolveCase = useCallback((id, options) => mutateLedger((current) => resolveComplaint(current, user, id, options)), [mutateLedger, user]);
  const adminRefundRequest = useCallback((id, options) => mutateLedger((current) => refundRequest(current, user, id, options)), [mutateLedger, user]);
  const adminChangeRequest = useCallback((id, options) => mutateLedger((current) => adminSetRequestStatus(current, user, id, options)), [mutateLedger, user]);
  const adminTransfer = useCallback((values) => {
    const id = crypto.randomUUID();
    return mutateLedger((current) => {
      const registered = JSON.parse(localStorage.getItem("skillbarter-users") || "[]");
      let next = current;
      for (const email of [values.from, values.to]) {
        const account = registered.find((item) => item.email.toLowerCase() === email.toLowerCase());
        if (account) next = ensureAccount(next, account);
      }
      return adminTransferMinutes(next, user, values, id);
    });
  }, [mutateLedger, user]);

  const participants = useMemo(() => {
    if (!isAdmin) return [];
    const people = new Map([...walletParticipants, ...ledger.accounts].map((account) => [account.email, account]));
    return [...people.values()].map((account) => ({ email: account.email, name: account.name,
      balance: balanceFor(ledger, account.email), available: availableBalanceFor(ledger, account.email), reserved: reservedFor(ledger, account.email) }));
  }, [walletParticipants, ledger, isAdmin]);
  const unreadCount = user ? support.messages.filter((message) => visibleIds.has(message.caseId) &&
    message.authorEmail !== user.email && !message.readBy.includes(user.email)).length : 0;

  return <SupportContext.Provider value={{ ready, error, refresh, cases, getCaseMessages, getRequestMessages,
    createComplaint, sendCaseMessage, markCaseRead, updateCaseStatus, resolveCase, adminRefundRequest, adminChangeRequest, adminTransfer,
    allRequests: isAdmin ? activity.requests : [], audit: isAdmin ? support.audit : [], participants, unreadCount,
  }}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  return useContext(SupportContext);
}
