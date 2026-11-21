import { catalog, foodById } from '../data/catalog';
import { addDays, total } from './calories';
import type { Food, MealItem, Profile } from '../types';
export type PlannedMeal = { name: string; slot: 'breakfast' | 'lunch' | 'dinner' | 'snacks'; items: MealItem[] };
export type PlannedDay = { date: string; meals: PlannedMeal[] };
export function allowed(food: Food, profile: Profile) {
  const aliases: Record<string, string> = { dairy: 'milk', gluten: 'wheat', eggs: 'egg', seafood: 'fish' };
  const avoid = profile.allergies.toLowerCase().split(/[,;\n]/).map(s => aliases[s.trim()] ?? s.trim()).filter(Boolean);
  return (profile.preference !== 'vegetarian' || food.vegetarian) && !food.allergens.some(a => avoid.some(v => v.includes(a) || a.includes(v)));
}
const item = (id: string, grams: number): MealItem => ({ id: crypto.randomUUID(), food: foodById(id), grams });
export function makePlan(p: Profile, kcal: number, start: string): PlannedDay[] {
  const usable = catalog.filter(f => allowed(f, p));
  const choose = (ids: string[], fallback: string, rotation: number) => {
    const options = ids.map(foodById).filter(f => allowed(f, p));
    const chosen = options[rotation % options.length] ?? usable.find(f => f.id === fallback) ?? usable.find(f => f.group === 'protein');
    if (!chosen) throw new Error('No suitable food choices. Review dietary preferences and allergies.');
    return chosen.id;
  };
  return Array.from({ length: 7 }, (_, i) => {
    const protein = choose(p.preference === 'vegetarian' ? ['chickpeas', 'mung', 'dhal', 'egg'] : p.budget === 'low' ? ['chickpeas', 'egg', 'dhal', 'chicken-curry', 'fish-curry'] : ['chicken-curry', 'fish-curry', 'chickpeas', 'egg'], 'chickpeas', i);
    const breakfast = choose(p.cooking === 'limited' ? ['bread', 'chickpeas', 'mung'] : ['string-hoppers', 'hopper', 'bread', 'kiribath', 'mung'], 'rice-white', i);
    const side = choose(['dhal', 'egg', 'chickpeas'], 'mung', i);
    const rice = choose(['rice-red', 'rice-white'], 'rice-white', i);
    const greens = choose(['mallung', 'gotukola', 'veg-curry'], 'beans', i);
    const snack = choose(['curd', 'banana', 'papaya', 'chickpeas'], 'papaya', i);
    const dinner = choose(p.cooking === 'limited' ? ['bread', 'rice-white'] : ['roti', 'pittu', 'rice-white', 'string-hoppers'], 'rice-white', i + 1);
    const vegetables = choose(['veg-curry', 'beans', 'carrot'], 'beans', i);
    const fruit = choose(['banana', 'papaya'], 'papaya', i);
    const otherFruit = choose(['papaya', 'banana'], 'banana', i);
    const meals: PlannedMeal[] = [
      { name: 'A familiar start', slot: 'breakfast', items: [item(breakfast, 150), item(side, 120), item(vegetables, 80), item(fruit, 120)] },
      { name: 'Rice & curry, balanced', slot: 'lunch', items: [item(rice, 210), item(protein, 130), item(side, 80), item(greens, 120), item(vegetables, 100)] },
      { name: 'A simple evening plate', slot: 'dinner', items: [item(dinner, 150), item(side, 140), item(vegetables, 160)] },
      { name: 'Something between meals', slot: 'snacks', items: [item(snack, 100), item(otherFruit, 150)] },
    ];
    const base = total(meals.flatMap(m => m.items)).kcal;
    if (base <= 0) throw new Error('Unable to calculate a suitable plan.');
    for (const meal of meals) for (const entry of meal.items) entry.grams = Math.round(entry.grams * kcal / base);
    return { date: addDays(start, i), meals };
  });
}
export function shoppingList(days: PlannedDay[]) {
  const combined = new Map<string, { food: Food; grams: number }>();
  function add(food: Food, grams: number) {
    if (food.ingredients && food.yieldGrams) for (const ingredient of food.ingredients) add(foodById(ingredient.foodId), ingredient.grams * grams / food.yieldGrams);
    else if (food.id !== 'water') {
      const old = combined.get(food.id); combined.set(food.id, { food, grams: (old?.grams ?? 0) + grams });
    }
  }
  for (const day of days) for (const meal of day.meals) for (const entry of meal.items) add(entry.food, entry.grams);
  return [...combined.values()].sort((a, b) => a.food.group.localeCompare(b.food.group));
}
