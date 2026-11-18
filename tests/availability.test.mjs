import test from "node:test";
import assert from "node:assert/strict";
import {
  addAvailabilityWindow, assertBookable, calendarFor, readAvailability,
  removeAvailabilityWindow, slotsFor,
} from "../lib/availability.mjs";
import { createRequest, readActivity, transitionRequest } from "../lib/requests.mjs";
import { emptyLedger, ensureAccount, readLedger, WALLET_KEY } from "../lib/wallet.mjs";

const provider = { name: "Данияр", email: "provider@example.com" };
const customer = { name: "Алия", email: "customer@example.com" };
const anotherCustomer = { name: "Айша", email: "another@example.com" };
const anotherProvider = { name: "Марат", email: "teacher@example.com" };
const now = "2030-11-18T08:00:00.000Z";
const startAt = "2030-11-19T10:00:00.000Z";
const endAt = "2030-11-19T12:00:00.000Z";
const timeZone = "Asia/Qyzylorda";
const offer = { id: "offer-1", email: provider.email, n: provider.name, t: "Практика JavaScript", cat: "Разработка", m1: 15, m2: 120 };
const secondOffer = { ...offer, id: "offer-2" };
const foreignOffer = { ...offer, id: "foreign-offer", email: anotherProvider.email, n: anotherProvider.name };
const initial = () => [provider, customer, anotherCustomer, anotherProvider].reduce((ledger, actor) => ensureAccount(ledger, actor, now), emptyLedger());
const calendar = (ledger = initial(), actor = provider, id = "window-1") => addAvailabilityWindow(ledger, actor, { startAt, endAt, timeZone }, id, now);
const book = (ledger, id = "request-1", actor = customer, service = offer, scheduledAt = startAt, minutes = 60) => createRequest(ledger, actor, service, { scheduledAt, minutes }, id, now);
const getRequest = (ledger, id = "request-1") => readActivity(ledger).requests.find((request) => request.id === id);

test("calendar mutations preserve snapshots and isolate each owner's windows", () => {
  const original = initial(), serialized = JSON.stringify(original);
  let ledger = calendar(original);
  ledger = calendar(ledger, anotherProvider, "foreign-window");
  assert.equal(calendarFor(ledger, " PROVIDER@EXAMPLE.COM ").timeZone, timeZone);
  assert.equal(calendarFor(ledger, customer.email), null);
  assert.throws(() => removeAvailabilityWindow(ledger, customer, "window-1", now), /не найдено/);
  assert.throws(() => removeAvailabilityWindow(ledger, provider, "foreign-window", now), /не найдено/);
  assert.throws(() => addAvailabilityWindow(ledger, null, { startAt, endAt, timeZone }, "guest", now), /Войдите/);
  const removed = removeAvailabilityWindow(ledger, provider, "window-1", now);
  assert.deepEqual(calendarFor(removed, provider.email).windows, []);
  assert.equal(calendarFor(removed, anotherProvider.email).windows.length, 1);
  assert.equal(calendarFor(ledger, provider.email).windows.length, 1);
  assert.equal(JSON.stringify(original), serialized);
});

test("windows require future, minute-precise UTC intervals with a valid zone and bounded duration", () => {
  for (const change of [
    { startAt: now }, { startAt: "2029-01-01T10:00:00Z" }, { startAt: "not-a-date" },
    { startAt: "2030-02-30T10:00:00Z" }, { startAt: "2030-11-19T10:00:01Z" },
    { startAt: "2030-11-19T10:00:00.001Z" }, { startAt: "2030-11-19T15:00:00+05:00" },
    { endAt: "2030-11-19T10:14:00Z" }, { endAt: startAt }, { endAt: "2030-11-20T10:01:00Z" },
    { timeZone: "Imaginary/City" }, { timeZone: "+05:00" }, { timeZone: "" },
  ]) assert.throws(() => addAvailabilityWindow(initial(), provider, { startAt, endAt, timeZone, ...change }, "bad", now), JSON.stringify(change));
  const shortest = addAvailabilityWindow(initial(), provider, { startAt: "2030-11-19T10:00:00Z", endAt: "2030-11-19T10:15:00Z", timeZone: "UTC" }, "short", now);
  assert.equal(calendarFor(shortest, provider.email).windows[0].startAt, startAt);
  const longest = addAvailabilityWindow(initial(), provider, { startAt, endAt: "2030-11-20T10:00:00Z", timeZone }, "long", now);
  assert.equal(calendarFor(longest, provider.email).windows.length, 1);
});

test("overlapping windows and duplicate IDs are rejected, adjacent windows remain independent", () => {
  const ledger = calendar();
  for (const [from, to] of [
    ["2030-11-19T09:45:00Z", "2030-11-19T10:15:00Z"],
    ["2030-11-19T10:15:00Z", "2030-11-19T10:45:00Z"],
    ["2030-11-19T11:45:00Z", "2030-11-19T12:15:00Z"],
  ]) assert.throws(() => addAvailabilityWindow(ledger, provider, { startAt: from, endAt: to, timeZone }, "overlap", now), /пересекается/);
  assert.throws(() => addAvailabilityWindow(ledger, provider, { startAt: endAt, endAt: "2030-11-19T13:00:00Z", timeZone }, "window-1", now), /уникальное/);
  const adjacent = addAvailabilityWindow(ledger, provider, { startAt: endAt, endAt: "2030-11-19T13:00:00Z", timeZone }, "adjacent", now);
  assert.equal(calendarFor(adjacent, provider.email).windows.length, 2);
  assert.throws(() => assertBookable(adjacent, provider.email, "2030-11-19T11:30:00Z", 60, { customerEmail: customer.email, now }), /недоступно/);
});

test("calendar validates all saved data and enforces the maximum of 365 windows", () => {
  const ledger = calendar();
  const windows = Array.from({ length: 365 }, (_, index) => ({ id: `window-${index}`, startAt: new Date(Date.parse(startAt) + index * 15 * 60000).toISOString(), endAt: new Date(Date.parse(startAt) + (index + 1) * 15 * 60000).toISOString() }));
  const full = { ...ledger, availability: { version: 1, calendars: [{ email: provider.email, timeZone, windows }] } };
  assert.doesNotThrow(() => readAvailability(full));
  assert.throws(() => addAvailabilityWindow(full, provider, { startAt: "2030-12-01T10:00:00Z", endAt: "2030-12-01T11:00:00Z", timeZone }, "overflow", now), /365/);
  const pruned = addAvailabilityWindow(full, provider, { startAt: "2030-12-02T10:00:00Z", endAt: "2030-12-02T11:00:00Z", timeZone }, "after-expiry", "2030-12-01T10:00:00Z");
  assert.equal(calendarFor(pruned, provider.email).windows.length, 1);
  const validCalendar = calendarFor(ledger, provider.email);
  const badCalendars = [
    null, { ...validCalendar, email: " Provider@example.com " }, { ...validCalendar, timeZone: "Bad/Zone" },
    { ...validCalendar, windows: {} }, { ...validCalendar, windows: [null] },
    { ...validCalendar, windows: [{ ...validCalendar.windows[0], id: "" }] },
    { ...validCalendar, windows: [validCalendar.windows[0], validCalendar.windows[0]] },
    { ...validCalendar, windows: [validCalendar.windows[0], { id: "distinct-overlap", startAt: "2030-11-19T11:00:00Z", endAt: "2030-11-19T13:00:00Z" }] },
    { ...validCalendar, windows: [{ ...validCalendar.windows[0], endAt: "2030-11-19T10:14:00Z" }] },
    { ...validCalendar, windows: [...windows, { ...windows[364], id: "excess" }] },
  ];
  for (const bad of badCalendars) assert.throws(() => readAvailability({ ...ledger, availability: { version: 1, calendars: [bad] } }), /Сохранённые данные не изменены/);
  for (const availability of [null, { version: 2, calendars: [] }, { version: 1, calendars: {} }, { version: 1, calendars: [validCalendar, validCalendar] }]) {
    assert.throws(() => readAvailability({ ...ledger, availability }), /Сохранённые данные не изменены/);
  }
});

test("slots fit the requested duration on a 15-minute grid relative to the window start", () => {
  const ledger = calendar();
  assert.deepEqual(slotsFor(ledger, provider.email, 60, { customerEmail: customer.email, now }).map((slot) => slot.startAt), [
    startAt, "2030-11-19T10:15:00.000Z", "2030-11-19T10:30:00.000Z", "2030-11-19T10:45:00.000Z", "2030-11-19T11:00:00.000Z",
  ]);
  assert.equal(slotsFor(ledger, provider.email, 120, { now }).length, 1);
  assert.equal(slotsFor(ledger, provider.email, 121, { now }).length, 0);
  for (const minutes of [0, 14, 481, 60.5, "60", NaN]) assert.deepEqual(slotsFor(ledger, provider.email, minutes, { now }), []);
  const shifted = addAvailabilityWindow(initial(), provider, { startAt: "2030-11-19T10:07:00Z", endAt: "2030-11-19T11:00:00Z", timeZone }, "shifted", now);
  assert.deepEqual(slotsFor(shifted, provider.email, 30, { now }).map((slot) => slot.startAt), ["2030-11-19T10:07:00.000Z", "2030-11-19T10:22:00.000Z"]);
  assert.throws(() => assertBookable(shifted, provider.email, "2030-11-19T10:15:00Z", 30, { now }), /недоступно/);
  assert.equal(slotsFor(ledger, provider.email, 60, { now: startAt }).length, 4);
  assert.deepEqual(slotsFor(ledger, provider.email, 60, { now: endAt }), []);
  assert.throws(() => assertBookable(ledger, provider.email, startAt, 60, { now: startAt }), /недоступно/);
});

test("a calendar pending request atomically reserves time across all provider services", () => {
  const original = calendar();
  const first = book(original);
  assert.equal(getRequest(first).calendarBooking, true);
  assert.equal(getRequest(first).status, "pending");
  assert.throws(() => book(first, "concurrent-second", anotherCustomer, secondOffer), /уже занято/);
  assert.throws(() => book(first, "partial-overlap", anotherCustomer, secondOffer, "2030-11-19T10:45:00.000Z", 30), /уже занято/);
  assert.equal(readActivity(first).requests.length, 1);
  assert.equal(slotsFor(first, provider.email, 60, { now }).length, 1);
  const adjacent = book(first, "adjacent", anotherCustomer, secondOffer, "2030-11-19T11:00:00.000Z", 60);
  assert.equal(readActivity(adjacent).requests.length, 2);
  assert.equal(readActivity(original).requests.length, 0);
});

test("cancellation and decline release pending calendar bookings and accepted bookings", () => {
  for (const [actor, status] of [[customer, "cancelled"], [provider, "declined"]]) {
    const cancelled = transitionRequest(book(calendar()), actor, "request-1", status, now);
    assert.doesNotThrow(() => book(cancelled, "replacement", anotherCustomer));
    assert.equal(slotsFor(cancelled, provider.email, 60, { now }).length, 5);
  }
  const accepted = transitionRequest(book(calendar()), provider, "request-1", "accepted", now);
  const cancelled = transitionRequest(accepted, provider, "request-1", "cancelled", now);
  assert.doesNotThrow(() => book(cancelled, "replacement", anotherCustomer));
});

test("a participant's provider and customer commitments both block conflicting calendar slots", () => {
  let ledger = calendar(calendar(initial(), anotherProvider, "other-window"));
  ledger = book(ledger);
  assert.throws(() => book(ledger, "customer-overlap", customer, foreignOffer), /уже занято/);
  assert.throws(() => book(ledger, "provider-as-customer", provider, foreignOffer), /уже занято/);
  // Add the original customer's calendar; their role as provider now shares the same busy time.
  ledger = calendar(ledger, customer, "customer-window");
  assert.throws(() => book(ledger, "customer-now-provider", anotherCustomer, { ...foreignOffer, email: customer.email, n: customer.name }), /уже занято/);
  assert.deepEqual(slotsFor(ledger, anotherProvider.email, 60, { customerEmail: customer.email, now }).map((slot) => slot.startAt), ["2030-11-19T11:00:00.000Z"]);
});

test("removing windows does not revoke requests and accepted bookings exclude themselves from conflicts", () => {
  let ledger = book(calendar());
  assert.equal(assertBookable(ledger, provider.email, startAt, 60, { customerEmail: customer.email, excludeRequestId: "request-1", now }).windowId, "window-1");
  ledger = removeAvailabilityWindow(ledger, provider, "window-1", now);
  assert.equal(getRequest(ledger).status, "pending");
  ledger = transitionRequest(ledger, provider, "request-1", "accepted", now);
  assert.equal(getRequest(ledger).status, "accepted");
  assert.throws(() => book(ledger, "no-window", anotherCustomer, offer, "2030-11-20T10:00:00.000Z"), /недоступно/);
  assert.deepEqual(slotsFor(ledger, provider.email, 60, { now }), []);
});

test("manual pending requests stay compatible but cannot be accepted over a new calendar booking", () => {
  let ledger = book(initial(), "manual");
  assert.equal(getRequest(ledger, "manual").calendarBooking, undefined);
  ledger = calendar(ledger);
  assert.equal(slotsFor(ledger, provider.email, 60, { now }).length, 5);
  ledger = book(ledger, "calendar-booking", anotherCustomer);
  assert.throws(() => transitionRequest(ledger, provider, "manual", "accepted", now), /другое занятие/);
  assert.doesNotThrow(() => transitionRequest(ledger, provider, "calendar-booking", "accepted", now));
  const acceptedManual = transitionRequest(book(initial()), provider, "request-1", "accepted", now);
  assert.throws(() => book(calendar(acceptedManual), "new-booking", anotherCustomer), /уже занято/);
  const legacy = book(book(initial()), "second-manual", anotherCustomer);
  assert.equal(readActivity(legacy).requests.length, 2);
});

test("accepted, active, awaiting confirmation and completed sessions all occupy their original time", () => {
  let ledger = book(calendar());
  for (const [actor, status] of [[provider, "accepted"], [provider, "in_progress"], [provider, "awaiting_confirmation"], [customer, "completed"]]) {
    ledger = transitionRequest(ledger, actor, "request-1", status, now);
    assert.throws(() => book(ledger, `conflict-${status}`, anotherCustomer), /уже занято/);
    assert.equal(slotsFor(ledger, provider.email, 60, { now }).length, 1);
  }
});

test("calendar data and booking flags survive storage and malformed optional flags are rejected", () => {
  const ledger = book(calendar());
  const restored = readLedger({ getItem: (key) => key === WALLET_KEY ? JSON.stringify(ledger) : null });
  assert.deepEqual(readAvailability(restored), readAvailability(ledger));
  assert.equal(getRequest(restored).calendarBooking, true);
  for (const flag of [null, "true", 1, {}, []]) {
    const bad = { ...ledger, activity: { ...ledger.activity, requests: [{ ...getRequest(ledger), calendarBooking: flag }] } };
    assert.throws(() => readActivity(bad), /Сохранённые данные не изменены/);
    assert.throws(() => slotsFor(bad, provider.email, 60, { now }), /Сохранённые данные не изменены/);
  }
  const explicitFalse = { ...ledger, activity: { ...ledger.activity, requests: [{ ...getRequest(ledger), calendarBooking: false }] } };
  assert.doesNotThrow(() => readActivity(explicitFalse));
  assert.deepEqual(readAvailability(emptyLedger()), { version: 1, calendars: [] });
  assert.equal(calendarFor(emptyLedger(), provider.email), null);
});
