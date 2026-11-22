import { describe, expect, it } from 'vitest';
import { calendarDays, moveCalendarMonth, validCalendarDate } from './calendar';

describe('diary calendar', () => {
  it('rejects impossible dates and handles leap years', () => {
    expect(validCalendarDate('2024-02-29')).toBe(true);
    for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-1-01', 'not-a-date'])
      expect(validCalendarDate(value)).toBe(false);
  });
  it('moves between months and years without overflowing a shorter month', () => {
    expect(moveCalendarMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(moveCalendarMonth('2024-01-31', 1)).toBe('2024-02-29');
    expect(moveCalendarMonth('2026-12-31', 1)).toBe('2027-01-31');
    expect(moveCalendarMonth('2024-02-29', 12)).toBe('2025-02-28');
  });
  it('builds a Monday-first calendar with every date exactly once across year boundaries', () => {
    const days = calendarDays('2026-11-01');
    expect(days).toHaveLength(42);
    expect(new Set(days).size).toBe(42);
    expect(days[0]).toBe('2026-10-26');
    expect(days[6]).toBe('2026-11-01');
    expect(calendarDays('2027-01-01')[0]).toBe('2026-12-28');
  });
});
