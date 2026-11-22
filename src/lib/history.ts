import { addDays, total } from './calories';
import type { LocalRecord, Meal } from '../types';

export function weekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function mealWeek(rows: LocalRecord[], date: string) {
  const start = weekStart(date);
  const meals = rows.filter((row): row is LocalRecord<Meal> => row.entity === 'meal_logs' && !row.deleted);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index);
    const entries = meals.filter(row => row.data.date === day).sort((a, b) =>
      a.data.timestamp.localeCompare(b.data.timestamp) || a.id.localeCompare(b.id));
    return { date: day, meals: entries, nutrition: total(entries.flatMap(row => row.data.items)) };
  });
  const kcal = days.reduce((sum, day) => sum + day.nutrition.kcal, 0);
  const loggedDays = days.filter(day => day.meals.length > 0).length;
  return { start, end: addDays(start, 6), days, kcal, loggedDays, average: loggedDays ? kcal / loggedDays : 0 };
}
