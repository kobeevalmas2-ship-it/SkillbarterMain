import { isAdminActor } from "../admin-auth.mjs";
import { emptyCatalog, saveOffer, serviceQuote, setFavorite } from "../catalog.mjs";
import { createTransfer, emptyLedger, ensureAccount, normalizeEmail, readLedger, WALLET_KEY } from "../wallet.mjs";
import { addRequestMessage, createRequest, markAllNotificationsRead, markNotificationRead, markRequestRead, readActivity, transitionRequest } from "../requests.mjs";
import { addAvailabilityWindow, readAvailability, removeAvailabilityWindow, requestOccupiesTime } from "../availability.mjs";
import { addSupportMessage, adminRefundRequest, adminSetRequestStatus, adminTransferMinutes, changeSupportStatus, markSupportCaseRead, openComplaint, readSupport, resolveComplaint } from "../support.mjs";

export function emptyState() {
  return { version: 1, ledger: emptyLedger(), catalog: emptyCatalog(), reviews: [] };
}

function failure(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function operationId(value) {
  // User-created IDs cannot collide with reserved welcome/request/refund IDs.
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) {
    throw failure("Не удалось определить номер операции. Обновите страницу.");
  }
  return value;
}

export function initializeState(state, actor, participants = [], now = new Date().toISOString()) {
  // Historical admin addresses remain valid audit authors after demotion;
  // authorization always uses the freshly verified actor's current role.
  const adminEmails = [...new Set([...(state.ledger.adminEmails || []),
    ...participants.filter((person) => person.role === "admin").map((person) => normalizeEmail(person.email))])].sort();
  let ledger = state.ledger;
  if (JSON.stringify(ledger.adminEmails || []) !== JSON.stringify(adminEmails)) ledger = { ...ledger, adminEmails };
  const accountEmails = { ...(state.accountEmails || {}) };
  let identitiesChanged = false;
  for (const person of [...participants, ...(actor ? [actor] : [])]) {
    if (person.id && !Object.hasOwn(accountEmails, person.id)) {
      // The immutable Auth UID stops an email change from earning a second
      // registration bonus in the existing email-based business ledger.
      if (Object.entries(accountEmails).some(([id, email]) => id !== person.id && email === person.email)) {
        if (person.id === actor?.id) throw failure("Этот адрес связан с предыдущим аккаунтом. Обратитесь в поддержку.", 409);
        continue;
      }
      accountEmails[person.id] = person.email;
      identitiesChanged = true;
    }
  }
  if (actor?.id && accountEmails[actor.id] !== actor.email) {
    throw failure("Адрес аккаунта изменён. Для переноса истории и баланса обратитесь в поддержку.", 409);
  }
  if (actor) ledger = ensureAccount(ledger, actor, now);
  return ledger === state.ledger && !identitiesChanged ? state : { ...state, ledger, accountEmails };
}

function participantAccount(ledger, participants, email, now, accountEmails) {
  const normalized = normalizeEmail(email);
  const person = participants.find((item) => normalizeEmail(item.email) === normalized);
  if (!person) throw failure("Участник с такой почтой не найден.");
  if (person.id && accountEmails[person.id] !== normalized) throw failure("Адрес участника изменён. Обратитесь в поддержку.", 409);
  return ensureAccount(ledger, person, now);
}

export function applyAction(state, actor, command, participants = [], now = new Date().toISOString()) {
  if (!actor?.email || !actor?.name) throw failure("Войдите в аккаунт.", 401);
  if (!command || typeof command.action !== "string" || (command.values !== undefined &&
      (!command.values || typeof command.values !== "object" || Array.isArray(command.values)))) {
    throw failure("Некорректный запрос.");
  }
  const current = initializeState(state, actor, participants, now);
  const values = command.values || {};
  const id = command.id;
  let ledger = current.ledger;
  let catalog = current.catalog;
  let reviews = current.reviews;
  const offerFor = (offerId) => catalog.offers.find((offer) => offer.id === offerId);

  switch (command.action) {
    case "offer.add":
      catalog = saveOffer(catalog, [], actor, values, operationId(id), false, now);
      break;
    case "offer.update":
      catalog = saveOffer(catalog, [], actor, values, operationId(id), true, now);
      break;
    case "favorite.set":
      if (typeof values.selected !== "boolean") throw failure("Укажите состояние избранного.");
      catalog = setFavorite(catalog, actor.email, id, values.selected, []);
      break;
    case "wallet.transfer": {
      ledger = participantAccount(ledger, participants, values.to, now, current.accountEmails || {});
      const transfer = { id: operationId(id || values.id), from: actor.email, to: normalizeEmail(values.to),
        minutes: values.minutes, note: values.note || "", type: values.type || "transfer" };
      if (values.type !== undefined && !["transfer", "service"].includes(values.type)) throw failure("Неизвестный тип операции.");
      if (values.offerId) {
        const quote = serviceQuote(offerFor(values.offerId), values.minutes);
        if (quote.to !== transfer.to || quote.note !== transfer.note) throw failure("Условия услуги изменились. Обновите страницу.");
        Object.assign(transfer, quote);
      }
      ledger = createTransfer(ledger, transfer, now);
      break;
    }
    case "request.create": {
      const offer = offerFor(values.offerId);
      if (offer) ledger = participantAccount(ledger, participants, offer.email, now, current.accountEmails || {});
      ledger = createRequest(ledger, actor, offer, values, operationId(id), now);
      break;
    }
    case "request.status": ledger = transitionRequest(ledger, actor, id, values.status, now); break;
    case "request.message": ledger = addRequestMessage(ledger, actor, id, values.text, operationId(values.messageId), now); break;
    case "request.read": ledger = markRequestRead(ledger, actor, id, now); break;
    case "notification.read": ledger = markNotificationRead(ledger, actor, id, now); break;
    case "notification.readAll": ledger = markAllNotificationsRead(ledger, actor, now); break;
    case "availability.add": ledger = addAvailabilityWindow(ledger, actor, values, operationId(id), now); break;
    case "availability.remove": ledger = removeAvailabilityWindow(ledger, actor, id, now); break;
    case "support.create": ledger = openComplaint(ledger, actor, values, operationId(id), now); break;
    case "support.message": ledger = addSupportMessage(ledger, actor, id, values.text, operationId(values.messageId), now); break;
    case "support.read": ledger = markSupportCaseRead(ledger, actor, id, now); break;
    case "support.status": ledger = changeSupportStatus(ledger, actor, id, values.status, values.reason, now); break;
    case "support.resolve": ledger = resolveComplaint(ledger, actor, id, values, now); break;
    case "admin.refund": ledger = adminRefundRequest(ledger, actor, id, values, now); break;
    case "admin.requestStatus": ledger = adminSetRequestStatus(ledger, actor, id, values, now); break;
    case "admin.transfer":
      if (!isAdminActor(actor)) throw failure("Это действие доступно только администратору.", 403);
      ledger = participantAccount(ledger, participants, values.from, now, current.accountEmails || {});
      ledger = participantAccount(ledger, participants, values.to, now, current.accountEmails || {});
      ledger = adminTransferMinutes(ledger, actor, values, operationId(id), now);
      break;
    case "review.add": {
      const text = typeof values.text === "string" ? values.text.trim() : "";
      if (text.length < 10 || text.length > 1000 || !Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) {
        throw failure("Укажите оценку и отзыв от 10 до 1000 символов.");
      }
      const reviewId = operationId(id);
      const previous = reviews.find((review) => review.id === reviewId);
      if (previous) {
        if (previous.authorId !== actor.id || previous.text !== text || previous.rating !== values.rating) throw failure("Этот номер отзыва уже использован.");
        break;
      }
      reviews = [{ id: reviewId, authorId: actor.id, name: actor.name, text, rating: values.rating, date: now }, ...reviews];
      break;
    }
    default: throw failure("Неизвестная операция.");
  }
  // Validate the complete result before one atomic database commit.
  readLedger({ getItem: (key) => key === WALLET_KEY ? JSON.stringify(ledger) : null });
  readActivity(ledger);
  readSupport(ledger);
  readAvailability(ledger);
  return { ...current, ledger, catalog, reviews };
}

export function filterSnapshot(state, actor = null, participants = []) {
  const admin = isAdminActor(actor);
  const email = actor?.email;
  const source = state.ledger;
  const activity = readActivity(source);
  const support = readSupport(source);
  const owns = (record) => email && [record.customer.email, record.provider.email].includes(email);
  const requests = activity.requests.filter((request) => admin || owns(request));
  const requestIds = new Set(requests.map((request) => request.id));
  const cases = support.cases.filter((item) => admin || owns(item));
  const caseIds = new Set(cases.map((item) => item.id));
  const availability = readAvailability(source);
  const publicPeople = new Set([...state.catalog.offers.map((offer) => offer.email),
    ...availability.calendars.map((calendar) => calendar.email), ...(email ? [email] : [])]);
  const busyIntervals = activity.requests.filter(requestOccupiesTime).flatMap((request) =>
    [request.provider.email, request.customer.email].filter((person) => publicPeople.has(person)).map((person) => ({ email: person, startAt: request.scheduledAt,
      endAt: new Date(Date.parse(request.scheduledAt) + request.minutes * 60000).toISOString() })));
  const ledger = {
    ...emptyLedger(), adminEmails: source.adminEmails || [],
    accounts: actor ? source.accounts.filter((account) => admin || account.email === email) : [],
    transactions: actor ? source.transactions.filter((transaction) => admin || transaction.from === email || transaction.to === email) : [],
    activity: { version: 1, requests,
      messages: activity.messages.filter((message) => requestIds.has(message.requestId)),
      notifications: activity.notifications.filter((notice) => notice.recipient === email && requestIds.has(notice.requestId)) },
    support: { version: 1, cases,
      messages: support.messages.filter((message) => caseIds.has(message.caseId)), audit: admin ? support.audit : [] },
    availability,
  };
  return { actorId: actor?.id || null, ledger, participants: actor ? participants.map((person) => ({ email: person.email, name: person.name })) : [],
    catalog: { ...state.catalog, favorites: email ? { [email]: state.catalog.favorites[email] || [] } : {} },
    reviews: state.reviews.map(({ authorId, ...review }) => review), busyIntervals };
}
