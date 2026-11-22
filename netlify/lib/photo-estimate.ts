import { z } from 'zod';

export const photoEstimateSchema = z.object({
  foods: z.array(z.object({
    name: z.string().min(1).max(150), grams: z.number().min(1).max(5000),
    kcalMin: z.number().min(0).max(10000), kcalMax: z.number().min(0).max(10000),
    proteinGrams: z.number().min(0).max(1000), carbsGrams: z.number().min(0).max(1000), fatGrams: z.number().min(0).max(1000),
    assumptions: z.string().max(1500),
  })).min(1).max(20),
  uncertainty: z.string().max(2000),
}).refine(value => value.foods.every(food =>
  food.kcalMax >= food.kcalMin && food.kcalMax / food.grams <= 10 &&
  food.proteinGrams + food.carbsGrams + food.fatGrams <= food.grams + 1), 'Invalid food amounts or calorie range.');

export const photoResponseSchema = {
  type: 'object', properties: {
    foods: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, grams: { type: 'number' }, kcalMin: { type: 'number' }, kcalMax: { type: 'number' },
      proteinGrams: { type: 'number' }, carbsGrams: { type: 'number' }, fatGrams: { type: 'number' }, assumptions: { type: 'string' },
    }, required: ['name', 'grams', 'kcalMin', 'kcalMax', 'proteinGrams', 'carbsGrams', 'fatGrams', 'assumptions'], additionalProperties: false } },
    uncertainty: { type: 'string' },
  }, required: ['foods', 'uncertainty'], additionalProperties: false,
};
