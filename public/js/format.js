export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const dateWithYearFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const listFormat = new Intl.ListFormat(undefined, { style: "long", type: "conjunction" });

export function millis(timestamp) {
  return timestamp?.toMillis() ?? 0;
}

export function formatList(words) {
  return listFormat.format(words);
}

export function formatTime(timestamp) {
  return timeFormat.format(timestamp.toDate());
}

export function formatFull(timestamp) {
  return fullFormat.format(timestamp.toDate());
}

export function formatWhen(timestamp, now = new Date()) {
  if (!timestamp) return "";
  const days = daysAgo(timestamp, now);
  const time = formatTime(timestamp);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  return `on ${formatCalendarDate(timestamp.toDate(), now)} at ${time}`;
}

export function formatDaysAgo(timestamp, now = new Date()) {
  const days = daysAgo(timestamp, now);
  if (days < 7) return relativeFormat.format(-days, "day");
  return `on ${formatCalendarDate(timestamp.toDate(), now)}`;
}

export function formatDay(timestamp, now = new Date()) {
  const days = daysAgo(timestamp, now);
  if (days < 2) return capitalize(relativeFormat.format(-days, "day"));
  return formatCalendarDate(timestamp.toDate(), now);
}

export function formatExpiry(timestamp, now = Date.now()) {
  const hours = Math.max(1, Math.round((millis(timestamp) - now) / HOUR_MS));
  if (hours < 24) return relativeFormat.format(hours, "hour");
  return relativeFormat.format(Math.round(hours / 24), "day");
}

export function daysAgo(timestamp, now = new Date()) {
  return Math.max(0, Math.round((startOfDay(now).getTime() - startOfDay(timestamp.toDate()).getTime()) / DAY_MS));
}

function formatCalendarDate(date, now) {
  const format = date.getFullYear() === now.getFullYear() ? dateFormat : dateWithYearFormat;
  return format.format(date);
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
