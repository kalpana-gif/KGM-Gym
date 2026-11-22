import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { matchPhotoFood, photoMealItems } from './ai';
import { total } from './calories';

describe('photo food matching', () => {
  it('prefills only a unique exact food name or alias', () => {
    const food = catalog.find(food => food.aliases.length > 0)!;
    expect(matchPhotoFood(`  ${food.name.toUpperCase()}  `, catalog)?.id).toBe(food.id);
    expect(matchPhotoFood(food.aliases[0], [food])?.id).toBe(food.id);
  });
  it('requires a choice for ambiguous, partial or unknown descriptions', () => {
    const first = { ...catalog[0], aliases: ['rice'] };
    const second = { ...catalog[1], aliases: ['rice'] };
    expect(matchPhotoFood('rice', [first, second])).toBeUndefined();
    expect(matchPhotoFood('rice with mystery sauce', [first])).toBeUndefined();
    expect(matchPhotoFood('unknown restaurant dish', catalog)).toBeUndefined();
  });
  it('creates an editable estimate for unknown food and preserves portion calories and macros', () => {
    const estimate = { foods: [{ name: 'Unknown mixed curry', grams: 125, kcalMin: 100, kcalMax: 220, proteinGrams: 10, carbsGrams: 15, fatGrams: 7, assumptions: 'Recipe unknown.' }], uncertainty: 'Approximate.' };
    const items = photoMealItems(estimate, catalog);
    expect(items[0].food.uncertainty).toBe('ai estimate');
    expect(items[0].source).toBe('photo');
    expect(total(items).kcal).toBe(160);
    expect(total(items).protein).toBeCloseTo(10);
    expect(total(items).carbs).toBeCloseTo(15);
    expect(total(items).fat).toBeCloseTo(7);
    expect(items[0].food.source).toContain('100–220 kcal');
    expect(total([{ ...items[0], grams: 250 }]).kcal).toBe(320);
  });
  it('uses the catalog reference for a known food', () => {
    const food = catalog[0];
    const items = photoMealItems({ foods: [{ name: food.name, grams: 150, kcalMin: 10, kcalMax: 20, proteinGrams: 1, carbsGrams: 1, fatGrams: 1, assumptions: '' }], uncertainty: '' }, catalog);
    expect(items[0].food).toBe(food);
    expect(total(items).kcal).toBeCloseTo(food.kcal * 1.5);
  });
});
