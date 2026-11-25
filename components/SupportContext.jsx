"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useWallet } from "./WalletContext";
import { balanceFor } from "@/lib/wallet.mjs";
import { availableBalanceFor, readActivity, reservedFor } from "@/lib/requests.mjs";
import { readSupport } from "@/lib/support.mjs";

const SupportContext = createContext(null);

export function SupportProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const { ready, error, refresh, ledger, mutate, participants: walletParticipants } = useWallet();
  const support = useMemo(() => readSupport(ledger), [ledger]);
  const activity = useMemo(() => readActivity(ledger), [ledger]);
  const cases = useMemo(() => support.cases.filter((item) => isAdmin || (user &&
    [item.customer.email, item.provider.email].includes(user.email))), [support, user, isAdmin]);
  const visibleIds = useMemo(() => new Set(cases.map((item) => item.id)), [cases]);
  const getCaseMessages = useCallback((id) => visibleIds.has(id) ? support.messages.filter((message) => message.caseId === id) : [], [support, visibleIds]);
  const getRequestMessages = useCallback((id) => isAdmin ? activity.messages.filter((message) => message.requestId === id) : [], [activity, isAdmin]);

  const createComplaint = useCallback(async (values) => {
    const id = crypto.randomUUID();
    await mutate("support.create", values, id);
    return id;
  }, [mutate]);
  const sendCaseMessage = useCallback((id, text) => mutate("support.message", { text, messageId: crypto.randomUUID() }, id), [mutate]);
  const markCaseRead = useCallback((id) => mutate("support.read", {}, id), [mutate]);
  const updateCaseStatus = useCallback((id, status, reason) => mutate("support.status", { status, reason }, id), [mutate]);
  const resolveCase = useCallback((id, options) => mutate("support.resolve", options, id), [mutate]);
  const adminRefundRequest = useCallback((id, options) => mutate("admin.refund", options, id), [mutate]);
  const adminChangeRequest = useCallback((id, options) => mutate("admin.requestStatus", options, id), [mutate]);
  const adminTransfer = useCallback((values) => mutate("admin.transfer", values, crypto.randomUUID()), [mutate]);

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

export function useSupport() { return useContext(SupportContext); }
