import { describe, expect, it } from 'vitest';
import { catalog, foodById } from '../data/catalog';
import { supplements } from '../data/supplements';
import { initialProfile } from '../types';
import { matchPhotoFood } from './ai';
import { nutrients, total } from './calories';
import { parseFoodText } from './parser';
import { allowed } from './plans';
import { defaultFoodGrams } from './servings';

describe('protein supplement logging', () => {
  it('uses the labelled chocolate scoop and preserves decimal portions when scaled', () => {
    const whey = foodById('on-gold-standard-whey-chocolate');
    expect(defaultFoodGrams(whey)).toBe(30.4);
    const serving = nutrients(whey, defaultFoodGrams(whey));
    expect(serving.kcal).toBeCloseTo(120);
    expect(serving.protein).toBeCloseTo(24);
    expect(serving.carbs).toBeCloseTo(3);
    expect(serving.fat).toBeCloseTo(1.5);
    expect(nutrients(whey, 15.2).kcal).toBeCloseTo(60);
    expect(nutrients(whey, 60.8).protein).toBeCloseTo(48);
  });
  it('adds milk energy separately from powder and keeps water energy at zero', () => {
    const powder = { id: 'powder', food: foodById('on-gold-standard-whey-chocolate'), grams: 30.4 };
    expect(total([powder, { id: 'water', food: foodById('water'), grams: 250 }]).kcal).toBeCloseTo(120);
    const milk = { id: 'milk', food: foodById('milk'), grams: 200 };
    expect(total([powder, milk]).kcal).toBeCloseTo(120 + nutrients(milk.food, 200).kcal);
  });
  it('recognizes specific product aliases and weighted amounts without guessing scoop counts', () => {
    expect(parseFoodText('30.4 g gold standard, 31 g gold standard vanilla, 32 g iso100', catalog)
      .map(row => row.item?.food.id)).toEqual([
      'on-gold-standard-whey-chocolate', 'on-gold-standard-whey-vanilla', 'dymatize-iso100',
    ]);
    expect(parseFoodText('30.4 g glod standerd', catalog)[0].item?.food.id).toBe('on-gold-standard-whey-chocolate');
    expect(parseFoodText('1 scoop gold standard', catalog)[0].reason).toMatch(/Choose grams/);
    expect(matchPhotoFood('gold standard whey', catalog)?.id).toBe('on-gold-standard-whey-chocolate');
    expect(matchPhotoFood('gold standard vanilla', catalog)?.id).toBe('on-gold-standard-whey-vanilla');
  });
  it('keeps mass-gainer full servings distinct from regular whey scoops', () => {
    const gainer = foodById('dymatize-super-mass-gainer');
    expect(defaultFoodGrams(gainer)).toBe(335);
    expect(nutrients(gainer, 335).kcal).toBeCloseTo(1280);
    expect(nutrients(gainer, 167.5).kcal).toBeCloseTo(640);
    expect(nutrients(gainer, 335).protein).toBeCloseTo(52);
  });
  it('filters milk and soy while allowing the labelled pea protein alternative', () => {
    const dairy = { ...initialProfile, allergies: 'dairy' };
    expect(allowed(foodById('on-gold-standard-whey-chocolate'), dairy)).toBe(false);
    expect(allowed(foodById('now-pea-protein'), dairy)).toBe(true);
    const soy = { ...initialProfile, allergies: 'soy' };
    expect(allowed(foodById('now-soy-protein'), soy)).toBe(false);
    expect(allowed(foodById('on-gold-standard-isolate'), soy)).toBe(false);
  });
  it('bundles distinct labelled products with source links and finite per-100-g nutrition', () => {
    expect(new Set(catalog.map(food => food.id)).size).toBe(catalog.length);
    for (const food of supplements) {
      expect(foodById(food.id)).toBe(food);
      expect(food.sourceUrl).toMatch(/^https:\/\//);
      expect(food.uncertainty).toBe('reference');
      expect(food.kcal).toBeGreaterThan(0);
      expect(food.kcal).toBeLessThan(1000);
      for (const value of Object.values(food.macros)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
