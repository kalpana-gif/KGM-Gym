import type { Food } from '../types';

export function primaryServing(food: Food) {
  if (food.group === 'supplements') return food.servings.find(serving => serving.label !== '100 g');
  if (food.group === 'bakery') return food.servings.find(serving => serving.label === 'piece');
}

export const defaultFoodGrams = (food: Food) => primaryServing(food)?.grams ?? 100;
