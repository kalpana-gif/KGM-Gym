import type { Food, MealItem, PhotoEstimate } from '../types';
export type { PhotoEstimate } from '../types';

// Use a catalog reference only for an unambiguous name/alias match.
export function matchPhotoFood(name: string, foods: Food[]): Food | undefined {
  const normalize = (value: string) => value.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  const wanted = normalize(name);
  const matches = foods.filter(food => [food.name, ...food.aliases].some(alias => normalize(alias) === wanted));
  return matches.length === 1 ? matches[0] : undefined;
}

export function photoMealItems(estimate: PhotoEstimate, foods: Food[]): MealItem[] {
  return estimate.foods.map(suggestion => {
    const ratio = 100 / suggestion.grams;
    const food = matchPhotoFood(suggestion.name, foods) ?? {
      id: `photo-food:${crypto.randomUUID()}`,
      name: suggestion.name,
      aliases: [],
      kcal: (suggestion.kcalMin + suggestion.kcalMax) / 2 * ratio,
      macros: { protein: suggestion.proteinGrams * ratio, carbs: suggestion.carbsGrams * ratio, fat: suggestion.fatGrams * ratio },
      state: 'ready' as const,
      group: 'extra' as const,
      servings: [{ label: '100 g', grams: 100, approximate: false }],
      source: `AI meal-photo estimate. Original portion: about ${suggestion.grams} g, ${suggestion.kcalMin}–${suggestion.kcalMax} kcal. ${suggestion.assumptions} ${estimate.uncertainty}`,
      uncertainty: 'ai estimate' as const,
      allergens: [], vegetarian: false,
    };
    return { id: crypto.randomUUID(), food, grams: suggestion.grams, source: 'photo' };
  });
}

export async function estimatePhoto(body: { mime: string; base64: string; description: string; consent: true }): Promise<PhotoEstimate> {
  if (!navigator.onLine) throw new Error('You’re offline. Save this photo for later or search foods.');
  const response = await fetch('/api/analyze-food', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  if (response.status === 429 && !response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Please wait a moment before estimating another photo. You can still search foods.');
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Photo AI is not connected on this server. You can still search foods.');
  const result = await response.json().catch(() => { throw new Error('The photo estimate could not be read. Try again or search foods.'); });
  if (!response.ok) throw new Error(result.error || 'Photo AI is unavailable. Try again or search foods.');
  return result;
}
