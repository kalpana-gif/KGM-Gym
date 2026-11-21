import { describe, expect, it } from 'vitest';
import { initialProfile, type Profile } from '../types';
import { addDays, energy, localDate, macroTargets, nutrients, proposedTarget, resting, total } from './calories';
import { catalog, foodById } from '../data/catalog';
import { parseFoodText } from './parser';
import { allowed, makePlan, shoppingList } from './plans';

describe('energy and food calculations', () => {
  it('uses the given body measurements and does not invent missing inputs', () => {
    expect(resting(initialProfile,'male')).toBe(2033.75);
    expect(resting(initialProfile,'female')).toBe(1867.75);
    expect(energy(initialProfile).complete).toBe(false);
    expect(proposedTarget(initialProfile,'2026-11-21')).toBeNull();
    const p: Profile={...initialProfile,sex:'male',activity:'sedentary'};
    expect(proposedTarget(p,'2026-11-21')?.kcal).toBe(2148);
  });
  it('keeps macro allocations consistent with the approved energy target', () => {
    const target=proposedTarget({...initialProfile,sex:'female',activity:'light'},'2026-11-21')!;
    const m=macroTargets(target);
    expect(m.protein*4+m.carbs*4+m.fat*9).toBeCloseTo(target.kcal,8);
  });
  it('scales food by edible grams, distinguishes raw and cooked rice, and includes recipe oil', () => {
    const rice=foodById('rice-white');
    expect(nutrients(rice,150).kcal).toBe(rice.kcal*1.5);
    expect(foodById('rice-raw').kcal).toBeGreaterThan(rice.kcal*2);
    const curry=foodById('dhal');
    expect(curry.ingredients!.some(i=>i.foodId==='oil')).toBe(true);
    expect(curry.ingredients!.some(i=>i.foodId==='coconut-milk')).toBe(true);
    const ingredientKcal=curry.ingredients!.reduce((sum,i)=>sum+nutrients(foodById(i.foodId),i.grams).kcal,0);
    expect(curry.kcal*curry.yieldGrams!/100).toBeCloseTo(ingredientKcal,8);
  });
  it('keeps the local diary date across UTC midnight and daylight changes', () => {
    expect(localDate('Asia/Colombo',new Date('2026-11-20T20:00:00Z'))).toBe('2026-11-21');
    expect(addDays('2026-12-31',1)).toBe('2027-01-01');
  });
});
describe('local food parser',()=>{
  it('parses the requested real meal including plural egg counts',()=>{
    const parsed=parseFoodText('150 g cooked red rice, 100 g chicken curry, and 2 eggs',catalog);
    expect(parsed.filter(p=>p.item)).toHaveLength(3);
    expect(parsed.map(p=>p.item?.grams)).toEqual([150,100,100]);
    expect(total(parsed.flatMap(p=>p.item?[p.item]:[])).kcal).toBeGreaterThan(300);
  });
  it('does not guess unknown foods, plate portions, cups or missing quantities',()=>{
    for(const input of ['one plate rice','1 cup cooked white rice','mystery curry','chicken curry','2 roti'])
      expect(parseFoodText(input,catalog)[0].item).toBeUndefined();
  });
});
describe('calculated meal plans',()=>{
  it('produces seven days whose ingredient totals match the target within rounding',()=>{
    const plan=makePlan({...initialProfile,sex:'male',activity:'light'},2300,'2026-11-21');
    expect(plan).toHaveLength(7);
    for(const day of plan)expect(Math.abs(total(day.meals.flatMap(m=>m.items)).kcal-2300)).toBeLessThan(15);
    const shopping=shoppingList(plan);
    expect(shopping.some(i=>i.food.id==='oil')).toBe(true);
    expect(shopping.some(i=>i.food.id==='coconut-milk')).toBe(true);
    expect(shopping.every(i=>i.grams>0)).toBe(true);
  });
  it('respects supported allergies and vegetarian preferences',()=>{
    const p={...initialProfile,preference:'vegetarian' as const,allergies:'egg, milk, coconut'};
    const plan=makePlan(p,2100,'2026-11-21');
    expect(plan.flatMap(d=>d.meals.flatMap(m=>m.items)).every(i=>allowed(i.food,p))).toBe(true);
  });
});
