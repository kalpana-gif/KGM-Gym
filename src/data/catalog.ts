import data from './usda.json' with { type: 'json' };
import type { Food } from '../types';
import { nutrients } from '../lib/calories.ts';
export const basics: Food[] = data as Food[];
basics.push({ id: 'water', name: 'Water / plain unsweetened tea', aliases: ['water', 'plain tea', 'unsweetened tea'], kcal: 0,
  macros: { protein: 0, fat: 0, carbs: 0 }, state: 'ready', group: 'extra',
  servings: [{ label: 'cup', grams: 200, approximate: true }], source: 'Water: zero food energy. Plain tea is treated as negligible; add milk and sugar separately.',
  uncertainty: 'recipe estimate', allergens: [], vegetarian: true });

type RecipeDef = [string, string, string[], number, [string, number][], string, Food['group']];
const definitions: RecipeDef[] = [
  ['dhal', 'Dhal curry', ['dhal', 'parippu', 'dhal curry', 'lentil curry'], 500, [['lentils', 400], ['coconut-milk', 60], ['onion', 35], ['oil', 5]], 'Simmer boiled lentils with onion and spices. Stir in measured coconut milk and oil. Add water as needed; weigh the finished batch.', 'protein'],
  ['chicken-curry', 'Chicken curry', ['chicken curry'], 500, [['chicken', 350], ['onion', 70], ['tomato', 50], ['coconut-milk', 50], ['oil', 10]], 'Simmer cooked chicken with onion, tomato, curry spices, measured coconut milk and oil. Adjust water and weigh the finished batch.', 'protein'],
  ['fish-curry', 'Fish curry', ['fish curry', 'malu'], 500, [['fish', 350], ['onion', 60], ['tomato', 80], ['coconut-milk', 30], ['oil', 8]], 'Simmer fish with onion, tomato, spices, measured coconut milk and oil. Weigh the cooked batch.', 'protein'],
  ['veg-curry', 'Vegetable curry', ['vegetable curry', 'vegetables'], 500, [['beans', 250], ['carrot', 200], ['coconut-milk', 40], ['oil', 5], ['onion', 30]], 'Warm vegetables with spices, onion, measured oil and coconut milk. Add water as needed.', 'vegetable'],
  ['mallung', 'Leafy-green mallung', ['mallung', 'mallum'], 300, [['greens', 260], ['coconut', 30], ['oil', 3], ['onion', 20]], 'Warm chopped greens with grated coconut, onion and spices. Use a measured amount of oil.', 'vegetable'],
  ['gotukola', 'Gotukola sambol (greens proxy)', ['gotukola sambol', 'gotukola'], 300, [['greens-raw', 200], ['coconut', 60], ['onion', 30], ['lime', 10]], 'Mix finely chopped leaves, coconut, onion and lime. This estimate uses spinach as a leaf proxy; actual gotukola differs.', 'vegetable'],
  ['pol-sambol', 'Pol sambol', ['pol sambol', 'coconut sambol'], 200, [['coconut', 150], ['onion', 40], ['lime', 10]], 'Mix coconut, onion, lime and chilli. No Maldive fish is included in this vegetarian recipe.', 'extra'],
  ['string-hoppers', 'String hoppers', ['string hoppers', 'idiyappam', 'indiappa'], 600, [['rice-flour', 250], ['water', 350]], 'Make a dough from rice flour and hot water, press into nests and steam. Finished weight is assumed; weigh your actual batch.', 'grain'],
  ['hopper', 'Plain hopper', ['plain hopper', 'hopper', 'appa'], 600, [['rice-flour', 220], ['coconut-milk', 100], ['sugar', 10], ['oil', 5], ['water', 300]], 'Ferment rice-flour batter using your usual starter. Add measured coconut milk and sugar; lightly oil the pan. Weigh finished hoppers.', 'grain'],
  ['egg-hopper', 'Egg hopper', ['egg hopper'], 140, [['hopper', 90], ['egg', 50]], 'Make a plain hopper and cook one egg in its centre. Weigh the finished hopper.', 'grain'],
  ['pittu', 'Pittu', ['pittu'], 500, [['rice-flour', 230], ['coconut', 100], ['water', 170]], 'Moisten rice flour, mix with measured coconut and steam in a pittu mould. Weigh the finished batch.', 'grain'],
  ['roti', 'Coconut roti', ['roti', 'pol roti'], 500, [['wheat-flour', 250], ['coconut', 100], ['water', 150]], 'Mix flour, grated coconut and water. Flatten and cook on a dry pan. Added oil must be logged separately.', 'grain'],
  ['kiribath', 'Kiribath', ['kiribath', 'milk rice'], 600, [['rice-white', 450], ['coconut-milk', 150]], 'Warm cooked rice with coconut milk until absorbed. Portion and weigh the finished batch.', 'grain'],
  ['kottu', 'Chicken kottu (sample recipe)', ['chicken kottu', 'kottu'], 800, [['roti', 300], ['chicken', 180], ['egg', 100], ['carrot', 100], ['onion', 80], ['oil', 20]], 'Chop cooked roti and stir-fry with vegetables, chicken, eggs and measured oil. Restaurant sauces and portions can differ substantially.', 'grain'],
  ['veg-kottu', 'Vegetarian kottu (sample recipe)', ['vegetarian kottu', 'veg kottu'], 800, [['roti', 280], ['chickpeas', 200], ['carrot', 160], ['onion', 120], ['oil', 15]], 'Stir-fry chopped roti, chickpeas and vegetables with measured oil and spices.', 'grain'],
  ['milk-tea', 'Milk tea with sugar', ['milk tea', 'tea with milk'], 200, [['water', 145], ['milk', 50], ['sugar', 5]], 'Brew tea and add the measured milk and sugar. Change the recipe for your usual amounts.', 'extra'],
];
const built: Food[] = [...basics];
for (const [id, name, aliases, yieldGrams, ingredients, instructions, group] of definitions) {
  const parts = ingredients.map(([foodId, grams]) => ({ food: built.find(f => f.id === foodId)!, grams }));
  if (parts.some(p => !p.food)) throw new Error(`Missing ingredient in ${id}`);
  const sums = parts.reduce((a, p) => {
    const n = nutrients(p.food, p.grams); return { kcal: a.kcal + n.kcal, protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat };
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  const ratio = 100 / yieldGrams;
  built.push({ id, name, aliases, kcal: sums.kcal * ratio, macros: { protein: sums.protein * ratio, fat: sums.fat * ratio, carbs: sums.carbs * ratio },
    state: 'cooked', group, vegetarian: parts.every(p => p.food.vegetarian), allergens: [...new Set(parts.flatMap(p => p.food.allergens))],
    servings: [{ label: '100 g', grams: 100, approximate: false }, { label: 'piece / serving', grams: ['string-hoppers', 'hopper'].includes(id) ? 50 : id === 'egg-hopper' ? 140 : 100, approximate: true }],
    source: 'LankaFit provisional recipe: calculated from linked USDA ingredient references and an assumed cooked yield. Spices and salt are not included; adjust the recipe and weigh your finished batch.',
    uncertainty: 'recipe estimate', ingredients: ingredients.map(([foodId, grams]) => ({ foodId, grams })), yieldGrams, instructions });
}
export const catalog = built;
export const foodById = (id: string) => catalog.find(f => f.id === id)!;
