import type { Food, MealItem } from '../types';
const normalize = (s: string) => s.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
export type Parsed = { text: string; item?: MealItem; reason?: string };
export function parseFoodText(text: string, catalog: Food[]): Parsed[] {
  return text.split(/[,;\n]|\s+and\s+/i).filter(s => s.trim()).map(raw => {
    const input = normalize(raw);
    const matched = catalog.flatMap(food => [food.name, ...food.aliases].map(alias => ({ food, alias: normalize(alias) })))
      .sort((a, b) => b.alias.length - a.alias.length)
      .find(({ alias }) => new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s)?($|\\s)`).test(input));
    if (!matched) return { text: raw.trim(), reason: 'Food not found. Choose a catalog match or add a custom food.' };
    if (/\b(raw|uncooked)\b/.test(input) && matched.food.state === 'cooked')
      return { text: raw.trim(), reason: 'The catalog match is cooked, but you entered raw food. Choose the correct preparation state.' };
    const amount = input.match(/(\d+(?:\.\d+)?)\s*(kg|grams?|g)\b/);
    let grams = amount ? Number(amount[1]) * (amount[2] === 'kg' ? 1000 : 1) : 0;
    if (!amount) {
      const quantity = input.match(/^(\d+(?:\.\d+)?)\s+/);
      const serving = matched.food.servings.find(s => !s.approximate && s.label === 'piece');
      if (quantity && serving && !/\b(plate|cup|bowl|spoon|roti|hopper)s?\b/.test(input)) grams = Number(quantity[1]) * serving.grams;
    }
    if (!grams || grams > 5000) return { text: raw.trim(), reason: `Choose grams or a defined serving for ${matched.food.name}.` };
    return { text: raw.trim(), item: { id: crypto.randomUUID(), food: matched.food, grams } };
  });
}
