import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { HOUR_MS, daysAgo, formatDay, formatDaysAgo, formatExpiry, formatTime, formatWhen, millis } from "../../public/js/format.js";
import { NOW, daysBefore, timestamp } from "./helpers.js";

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

describe("millis", () => {
  test("is zero for a missing timestamp", () => {
    assert.equal(millis(null), 0);
    assert.equal(millis(undefined), 0);
  });
});

describe("daysAgo", () => {
  test("counts calendar days, not 24-hour periods", () => {
    const lateLastNight = timestamp(new Date(2026, 9, 26, 23, 59));
    assert.equal(daysAgo(lateLastNight, NOW), 1);
  });

  test("treats future times as today", () => {
    assert.equal(daysAgo(timestamp(NOW.getTime() + 5 * HOUR_MS), NOW), 0);
  });
});

describe("formatWhen", () => {
  test("uses today and yesterday for recent times", () => {
    const today = timestamp(new Date(2026, 9, 27, 9, 30));
    const yesterday = timestamp(new Date(2026, 9, 26, 9, 30));
    assert.equal(formatWhen(today, NOW), `today at ${formatTime(today)}`);
    assert.equal(formatWhen(yesterday, NOW), `yesterday at ${formatTime(yesterday)}`);
  });

  test("uses a date for older times", () => {
    assert.match(formatWhen(daysBefore(5), NOW), /^on .+ at .+$/);
  });

  test("is empty for a missing timestamp", () => {
    assert.equal(formatWhen(null, NOW), "");
  });
});

describe("formatDaysAgo", () => {
  test("uses relative days within a week", () => {
    assert.equal(formatDaysAgo(daysBefore(0), NOW), relative.format(-0, "day"));
    assert.equal(formatDaysAgo(daysBefore(3), NOW), relative.format(-3, "day"));
  });

  test("uses a date after a week", () => {
    assert.match(formatDaysAgo(daysBefore(9), NOW), /^on /);
  });
});

describe("formatDay", () => {
  test("capitalises today and yesterday", () => {
    const today = relative.format(0, "day");
    assert.equal(formatDay(daysBefore(0), NOW), today.charAt(0).toLocaleUpperCase() + today.slice(1));
  });

  test("includes the year only for other years", () => {
    const lastYear = timestamp(new Date(2025, 2, 3, 12));
    assert.match(formatDay(lastYear, NOW), /2025/);
    assert.doesNotMatch(formatDay(daysBefore(20), NOW), /2026/);
  });
});

describe("formatExpiry", () => {
  const now = NOW.getTime();

  test("uses hours for less than a day", () => {
    assert.equal(formatExpiry(timestamp(now + 5 * HOUR_MS), now), relative.format(5, "hour"));
  });

  test("never says less than one hour", () => {
    assert.equal(formatExpiry(timestamp(now + 60_000), now), relative.format(1, "hour"));
  });

  test("uses days for longer", () => {
    assert.equal(formatExpiry(timestamp(now + 6 * 24 * HOUR_MS), now), relative.format(6, "day"));
  });
});
