import type { Food, MealItem, Profile, Target } from '../types';

export const activities = {
  sedentary: { label: 'Mostly sitting', detail: 'Desk work; little regular exercise', factor: 1.2 },
  light: { label: 'Lightly active', detail: 'Some walking; exercise 1–3 days/week', factor: 1.375 },
  moderate: { label: 'Moderately active', detail: 'Regular movement; exercise 3–5 days/week', factor: 1.55 },
  active: { label: 'Very active', detail: 'Physical job or frequent training', factor: 1.725 },
};
export function resting(p: Pick<Profile, 'age' | 'weight' | 'height'>, sex: 'male' | 'female') {
  return 10 * p.weight + 6.25 * p.height - 5 * p.age + (sex === 'male' ? 5 : -161);
}
export function energy(p: Profile) {
  const sexes = p.sex === 'unspecified' ? ['female', 'male'] as const : [p.sex];
  const factors = p.activity === 'unspecified' ? [1.2, 1.725] : [activities[p.activity].factor];
  const restingValues = sexes.map(sex => resting(p, sex));
  const values = restingValues.flatMap(value => factors.map(factor => value * factor));
  return { restingMin: Math.round(Math.min(...restingValues)), restingMax: Math.round(Math.max(...restingValues)),
    min: Math.round(Math.min(...values)), max: Math.round(Math.max(...values)),
    complete: p.sex !== 'unspecified' && p.activity !== 'unspecified' };
}
export function proposedTarget(p: Profile, date: string): Target | null {
  if (!energy(p).complete || !Number.isFinite(p.deficit) || p.deficit < 0 || p.deficit > 15) return null;
  const maintenance = energy(p).min;
  const kcal = Math.round(maintenance * (1 - p.deficit / 100));
  // A conservative product limit, not a universal medical threshold.
  if (kcal < 1500 || kcal > 4000) return null;
  return { date, kcal, maintenance, deficit: p.deficit, proteinPercent: p.proteinPercent, fatPercent: p.fatPercent };
}
export function nutrients(food: Food, grams: number) {
  const ratio = grams / 100;
  return { kcal: food.kcal * ratio, protein: food.macros.protein * ratio, carbs: food.macros.carbs * ratio, fat: food.macros.fat * ratio };
}
export function total(items: MealItem[]) {
  return items.reduce((a, item) => {
    const n = nutrients(item.food, item.grams);
    return { kcal: a.kcal + n.kcal, protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
export function macroTargets(t: Target) {
  return { protein: t.kcal * t.proteinPercent / 100 / 4, fat: t.kcal * t.fatPercent / 100 / 9, carbs: t.kcal * (100 - t.proteinPercent - t.fatPercent) / 100 / 4 };
}
export function localDate(timezone = 'Asia/Colombo', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
export function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10);
}
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}
export function round(value: number) { return Math.round(value); }
