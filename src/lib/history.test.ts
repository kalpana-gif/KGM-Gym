import { describe, expect, it } from 'vitest';
import { foodById } from '../data/catalog';
import { mealWeek, weekStart } from './history';
import type { LocalRecord, Meal } from '../types';

function meal(id: string, date: string, grams: number, overrides: Partial<LocalRecord<Meal>> = {}): LocalRecord<Meal> {
  return {
    id, owner: 'guest:history-test', entity: 'meal_logs', version: 1, deleted: false,
    syncedVersion: 0, modifiedAt: `${date}T10:00:00Z`,
    data: { name: id, slot: 'lunch', date, timestamp: `${date}T10:00:00Z`, timezone: 'Asia/Colombo',
      items: [{ id: `${id}-food`, food: foodById('rice-white'), grams }] },
    ...overrides,
  };
}

describe('food history weeks', () => {
  it('uses Monday through Sunday across month, year and leap-year boundaries', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(mealWeek([], '2024-02-29').days.map(day => day.date)).toEqual([
      '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02', '2024-03-03',
    ]);
  });
  it('sums saved portions per day and excludes deleted meals, plans and other weeks', () => {
    const rows = [
      meal('Monday lunch', '2026-11-16', 150),
      meal('Monday dinner', '2026-11-16', 50),
      meal('Tuesday lunch', '2026-11-17', 100),
      meal('Deleted meal', '2026-11-18', 1000, { deleted: true }),
      meal('Earlier week', '2026-11-15', 1000),
      meal('Later week', '2026-11-23', 1000),
      { ...meal('Planned meal', '2026-11-19', 1000), entity: 'meal_plans' as const },
    ];
    const week = mealWeek(rows, '2026-11-22');
    expect(week.days[0].nutrition).toEqual({ kcal: 260, protein: 5.38, carbs: 56.34, fat: 0.56 });
    expect(week.days[0].meals).toHaveLength(2);
    expect(week.days[1].nutrition.kcal).toBe(130);
    expect(week.days.slice(2).every(day => day.meals.length === 0 && day.nutrition.kcal === 0)).toBe(true);
    expect(week.kcal).toBe(390);
    expect(week.loggedDays).toBe(2);
    expect(week.average).toBe(195);
  });
  it('counts a saved zero-calorie meal as a logged day and keeps empty weeks empty', () => {
    const row = meal('Tea', '2026-11-16', 100);
    row.data.items[0].food = foodById('water');
    const week = mealWeek([row], '2026-11-22');
    expect(week.loggedDays).toBe(1);
    expect(week.days[0].meals).toHaveLength(1);
    expect(week.kcal).toBe(0);
    expect(week.average).toBe(0);
    const empty = mealWeek([], '2026-11-22');
    expect(empty.loggedDays).toBe(0);
    expect(empty.days).toHaveLength(7);
    expect(empty.average).toBe(0);
  });
  it('calculates from saved nutrition snapshots and reflects edits without rounding portions early', () => {
    const row = meal('Saved custom portion', '2026-11-16', 125.5);
    row.data.items[0].food = { ...row.data.items[0].food, kcal: 101.5 };
    expect(mealWeek([row], '2026-11-22').kcal).toBeCloseTo(127.3825);
    row.data.items[0].grams = 200;
    expect(mealWeek([row], '2026-11-22').kcal).toBe(203);
  });
});
