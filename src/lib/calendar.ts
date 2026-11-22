import { addDays } from './calories';

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function calendarMonth(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function moveCalendarMonth(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const last = new Date(date);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  date.setUTCDate(Math.min(day, last.getUTCDate()));
  return date.toISOString().slice(0, 10);
}

// A fixed, Monday-first calendar keeps the panel steady between months.
export function calendarDays(month: string): string[] {
  const first = calendarMonth(month);
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const start = addDays(first, -(weekday + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}
