import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dayFromKey, localDateKey, parseLocalDateTime } from "../lib/calendar-dates.mjs";

test("calendar date-only keys reject invalid dates without drifting into another month", () => {
  assert.equal(dayFromKey("2028-02-29").toISOString(), "2028-02-29T12:00:00.000Z");
  for (const value of ["2027-02-29", "2026-11-31", "2026-13-01", "2026-1-01", "", null]) assert.equal(dayFromKey(value), null);
  assert.equal(localDateKey(new Date(NaN)), "");
});

test("calendar inputs preserve local day and minutes and reject normalized times", () => {
  const date = parseLocalDateTime("2027-06-20", "09:15");
  assert.equal(localDateKey(date), "2027-06-20");
  assert.equal(date.getHours(), 9);
  assert.equal(date.getMinutes(), 15);
  for (const time of ["24:00", "09:60", "9:00", "09:15:30", "", null]) assert.equal(parseLocalDateTime("2027-06-20", time), null);
  assert.equal(parseLocalDateTime("2027-02-30", "09:00"), null);
});

test("provider input rejects skipped daylight-saving times and stores real times as UTC", () => {
  const moduleHref = new URL("../lib/calendar-dates.mjs", import.meta.url).href;
  const source = `import {parseLocalDateTime} from ${JSON.stringify(moduleHref)}; console.log(JSON.stringify([parseLocalDateTime('2027-03-14','02:30'), parseLocalDateTime('2027-03-14','03:30')?.toISOString()]));`;
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", source], { env: { ...process.env, TZ: "America/New_York" }, encoding: "utf8", windowsHide: true });
  assert.deepEqual(JSON.parse(output), [null, "2027-03-14T07:30:00.000Z"]);
});
