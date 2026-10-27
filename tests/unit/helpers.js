export function timestamp(date) {
  const value = new Date(date);
  return { toDate: () => new Date(value), toMillis: () => value.getTime() };
}

export const NOW = new Date(2026, 9, 27, 18, 0);

export function hoursBefore(hours, from = NOW) {
  return timestamp(from.getTime() - hours * 60 * 60 * 1000);
}

export function daysBefore(days, from = NOW) {
  const date = new Date(from);
  date.setDate(date.getDate() - days);
  return timestamp(date);
}
