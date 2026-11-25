"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useWallet } from "./WalletContext";
import { readActivity } from "@/lib/requests.mjs";
import { readAvailability, calendarFor as getCalendar, slotsFor } from "@/lib/availability.mjs";

const RequestsContext = createContext(null);

export function RequestsProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const { ready, error, refresh, ledger, mutate, busyIntervals } = useWallet();
  const activity = useMemo(() => readActivity(ledger), [ledger]);
  const availability = useMemo(() => readAvailability(ledger), [ledger]);
  const calendarFor = useCallback((email) => getCalendar(ledger, email), [ledger]);
  const availableSlots = useCallback((email, minutes) => slotsFor(ledger, email, minutes, { customerEmail: user?.email })
    .filter((slot) => !busyIntervals.some((busy) => [email, user?.email].includes(busy.email) &&
      Date.parse(slot.startAt) < Date.parse(busy.endAt) && Date.parse(slot.endAt) > Date.parse(busy.startAt))),
  [ledger, user?.email, busyIntervals]);
  const addAvailableTime = useCallback(async (values) => {
    const id = crypto.randomUUID();
    await mutate("availability.add", values, id);
    return id;
  }, [mutate]);
  const removeAvailableTime = useCallback((id) => mutate("availability.remove", {}, id), [mutate]);
  const requests = useMemo(() => user ? activity.requests.filter((r) => isAdmin || [r.customer.email, r.provider.email].includes(user.email)) : [], [activity, user, isAdmin]);
  const notifications = useMemo(() => user ? activity.notifications.filter((n) => n.recipient === user.email) : [], [activity, user]);
  const requestIds = useMemo(() => new Set(requests.map((r) => r.id)), [requests]);
  const getMessages = useCallback((id) => requestIds.has(id) ? activity.messages.filter((m) => m.requestId === id) : [], [activity, requestIds]);
  const createRequest = useCallback(async (values) => {
    const id = crypto.randomUUID();
    await mutate("request.create", values, id);
    return id;
  }, [mutate]);
  const changeStatus = useCallback((id, status) => mutate("request.status", { status }, id), [mutate]);
  const sendMessage = useCallback((id, text) => mutate("request.message", { text, messageId: crypto.randomUUID() }, id), [mutate]);
  const markRequestRead = useCallback((id) => mutate("request.read", {}, id), [mutate]);
  const markNotificationRead = useCallback((id) => mutate("notification.read", {}, id), [mutate]);
  const markAllRead = useCallback(() => mutate("notification.readAll"), [mutate]);

  const value = { ready, error, refresh, requests, notifications, getMessages,
    availability, calendarFor, availableSlots, addAvailableTime, removeAvailableTime,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    unreadMessages: user ? activity.messages.filter((m) => requestIds.has(m.requestId) && m.authorEmail !== user.email && !m.readBy.includes(user.email)).length : 0,
    createRequest, changeStatus, sendMessage, markRequestRead, markNotificationRead, markAllRead };
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export function useRequests() { return useContext(RequestsContext); }
