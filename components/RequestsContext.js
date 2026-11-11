"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useWallet } from "./WalletContext";
import { OFFERS } from "./data";
import { allOffers, readCatalog } from "@/lib/catalog.mjs";
import { addRequestMessage, createRequest as addRequest, markAllNotificationsRead,
  markNotificationRead as readNotification, markRequestRead as readRequest, readActivity, transitionRequest } from "@/lib/requests.mjs";

const RequestsContext = createContext(null);

export function RequestsProvider({ children }) {
  const { user } = useAuth();
  const { ready, error, refresh, ledger, mutateLedger } = useWallet();
  const activity = useMemo(() => readActivity(ledger), [ledger]);
  const requests = useMemo(() => user ? activity.requests.filter((r) => [r.customer.email, r.provider.email].includes(user.email)) : [], [activity, user]);
  const notifications = useMemo(() => user ? activity.notifications.filter((n) => n.recipient === user.email) : [], [activity, user]);
  const requestIds = useMemo(() => new Set(requests.map((r) => r.id)), [requests]);
  const getMessages = useCallback((id) => requestIds.has(id) ? activity.messages.filter((m) => m.requestId === id) : [], [activity, requestIds]);

  const createRequest = useCallback(async (values) => {
    const id = crypto.randomUUID();
    await mutateLedger((current) => {
      const offer = allOffers(readCatalog(localStorage), OFFERS).find((o) => o.id === values.offerId);
      return addRequest(current, user, offer, values, id);
    });
    return id;
  }, [mutateLedger, user]);
  const changeStatus = useCallback((id, status) => mutateLedger((current) => transitionRequest(current, user, id, status)), [mutateLedger, user]);
  const sendMessage = useCallback((id, text) => {
    const messageId = crypto.randomUUID();
    return mutateLedger((current) => addRequestMessage(current, user, id, text, messageId));
  }, [mutateLedger, user]);
  const markRequestRead = useCallback((id) => mutateLedger((current) => readRequest(current, user, id)), [mutateLedger, user]);
  const markNotificationRead = useCallback((id) => mutateLedger((current) => readNotification(current, user, id)), [mutateLedger, user]);
  const markAllRead = useCallback(() => mutateLedger((current) => markAllNotificationsRead(current, user)), [mutateLedger, user]);

  const value = { ready, error, refresh, requests, notifications, getMessages,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    unreadMessages: user ? activity.messages.filter((m) => requestIds.has(m.requestId) && m.authorEmail !== user.email && !m.readBy.includes(user.email)).length : 0,
    createRequest, changeStatus, sendMessage, markRequestRead, markNotificationRead, markAllRead };
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export function useRequests() { return useContext(RequestsContext); }
