import type { Food, Macros } from '../types';

type SupplementLabel = {
  id: string; name: string; aliases: string[];
  serving: { label: string; grams: number };
  kcal: number; macros: Macros; allergens: string[];
  source: string; sourceUrl: string;
};

// Nutrition is transcribed per labelled serving, then scaled to the catalog's
// per-100-g basis. Keep the flavour and label version attached to each product.
const labels: SupplementLabel[] = [
  {
    id: 'on-gold-standard-whey-chocolate',
    name: 'ON Gold Standard 100% Whey — Double Rich Chocolate',
    aliases: ['gold standard', 'gold standard whey', 'gold standard protein', 'gold standard shake', 'on whey', 'optimum nutrition whey', 'gold standard double rich chocolate', 'glod standard', 'glod standerd', 'gold standerd'],
    serving: { label: '1 scoop', grams: 30.4 }, kcal: 120,
    macros: { protein: 24, carbs: 3, fat: 1.5 }, allergens: ['milk', 'soy'],
    source: 'Optimum Nutrition US manufacturer label, NIH DSLD 332030 (entered 24 July 2025). Double Rich Chocolate: 120 kcal, 24 g protein, 3 g carbs and 1.5 g fat per 30.4 g scoop. General Gold Standard aliases use this flavour; choose the matching flavour on your tub.',
    sourceUrl: 'https://dsld.od.nih.gov/label/332030',
  },
  {
    id: 'on-gold-standard-whey-vanilla',
    name: 'ON Gold Standard 100% Whey — Vanilla Ice Cream',
    aliases: ['gold standard vanilla', 'gold standard whey vanilla', 'on whey vanilla', 'optimum nutrition vanilla whey'],
    serving: { label: '1 scoop', grams: 31 }, kcal: 120,
    macros: { protein: 24, carbs: 4, fat: 1 }, allergens: ['milk', 'soy'],
    source: 'Optimum Nutrition US manufacturer label, NIH DSLD 332124 (entered 24 July 2025). Vanilla Ice Cream: 120 kcal, 24 g protein, 4 g carbs and 1 g fat per 31 g scoop.',
    sourceUrl: 'https://dsld.od.nih.gov/label/332124',
  },
  {
    id: 'on-gold-standard-isolate',
    name: 'ON Gold Standard 100% Isolate — Chocolate Bliss',
    aliases: ['gold standard isolate', 'gold standard whey isolate', 'on isolate', 'optimum nutrition isolate', 'gold standard chocolate bliss'],
    serving: { label: '1 scoop', grams: 31 }, kcal: 110,
    macros: { protein: 25, carbs: 1, fat: 0.5 }, allergens: ['milk', 'soy'],
    source: 'Optimum Nutrition US manufacturer label, NIH DSLD 331938 (entered 24 July 2025). Chocolate Bliss: 110 kcal, 25 g protein, 1 g carbs and 0.5 g fat per 31 g scoop. The label declares milk and soy.',
    sourceUrl: 'https://dsld.od.nih.gov/label/331938',
  },
  {
    id: 'on-gold-standard-casein',
    name: 'ON Gold Standard 100% Casein — Creamy Vanilla',
    aliases: ['gold standard casein', 'on casein', 'optimum nutrition casein', 'gold standard casein vanilla'],
    serving: { label: '1 heaping scoop', grams: 32 }, kcal: 120,
    macros: { protein: 24, carbs: 3, fat: 1 }, allergens: ['milk', 'soy'],
    source: 'Optimum Nutrition US manufacturer label, NIH DSLD 331937 (entered 24 July 2025; label carries copyright 2008). Creamy Vanilla, 32 g label version: 120 kcal, 24 g protein, 3 g carbs and 1 g fat per heaping scoop. Match the serving weight on your pack.',
    sourceUrl: 'https://dsld.od.nih.gov/label/331937',
  },
  {
    id: 'myprotein-impact-whey',
    name: 'Myprotein Impact Whey — Unflavoured',
    aliases: ['myprotein impact whey', 'impact whey protein', 'myprotein whey', 'my protein impact whey', 'impact whey unflavoured', 'impact whey unflavored'],
    serving: { label: '1 scoop', grams: 25 }, kcal: 103,
    macros: { protein: 21, carbs: 1, fat: 1.9 }, allergens: ['milk', 'soy'],
    source: 'Myprotein Singapore manufacturer nutrition table, Unflavoured 25 g label version, checked 23 November 2026. Per scoop: 103 kcal, 21 g protein, 1 g carbs and 1.9 g fat. The rounded per-serving values are used for logging. Whey contains milk; check your pack for lecithin and other allergens.',
    sourceUrl: 'https://www.myprotein.com.sg/p/sports-nutrition/myprotein-impact-whey-protein-unflavoured/12207745/',
  },
  {
    id: 'myprotein-impact-isolate',
    name: 'Myprotein Impact Whey Isolate — Unflavoured',
    aliases: ['myprotein impact whey isolate', 'myprotein isolate', 'my protein isolate', 'impact whey isolate', 'impact isolate unflavoured', 'impact isolate unflavored'],
    serving: { label: '1 scoop', grams: 25 }, kcal: 93,
    macros: { protein: 23, carbs: 0.6, fat: 0.1 }, allergens: ['milk', 'soy'],
    source: 'Myprotein Singapore manufacturer nutrition table, Unflavoured Informed Sport Range, 25 g version, checked 23 November 2026. Per scoop: 93 kcal, 23 g protein, 0.6 g carbs and 0.1 g fat. Rounded per-serving values are used. The manufacturer notes batch variation and possible gluten and egg cross-contact.',
    sourceUrl: 'https://www.myprotein.com.sg/p/sports-nutrition/impact-whey-isolate-batch-tested-range/10872834/',
  },
  {
    id: 'dymatize-iso100',
    name: 'Dymatize ISO100 — Gourmet Chocolate',
    aliases: ['dymatize iso100', 'dymatize iso 100', 'iso100', 'iso 100', 'iso100 gourmet chocolate', 'dymatize hydrolyzed whey'],
    serving: { label: '1 scoop', grams: 32 }, kcal: 120,
    macros: { protein: 25, carbs: 2, fat: 1 }, allergens: ['milk', 'soy'],
    source: 'Dymatize US manufacturer nutrition facts, Gourmet Chocolate, checked 23 November 2026. Per 32 g scoop: 120 kcal, 25 g protein, 2 g carbs and 1 g fat. Hydrolyzed whey isolate and whey isolate blend.',
    sourceUrl: 'https://dymatize.com/products/iso100-gourmet-chocolate',
  },
  {
    id: 'dymatize-super-mass-gainer',
    name: 'Dymatize Super Mass Gainer — Rich Chocolate',
    aliases: ['dymatize super mass gainer', 'super mass gainer', 'dymatize mass gainer'],
    serving: { label: '1 full serving (2½ cups powder)', grams: 335 }, kcal: 1280,
    macros: { protein: 52, carbs: 245, fat: 11 }, allergens: ['milk', 'soy'],
    source: 'Dymatize US manufacturer nutrition facts, Rich Chocolate, checked 23 November 2026. Full serving is 335 g powder (2½ cups): 1,280 kcal, 52 g protein, 245 g carbs and 11 g fat. This is a mass gainer; the full serving is substantially larger than a whey scoop. The label is prepared with water.',
    sourceUrl: 'https://dymatize.com/products/super-mass-gainer-rich-chocolate',
  },
  {
    id: 'muscletech-nitro-tech',
    name: 'MuscleTech Nitro-Tech — Milk Chocolate',
    aliases: ['muscletech nitro tech', 'nitro tech', 'nitrotech', 'nitro-tech', 'muscletech protein'],
    serving: { label: '1 scoop', grams: 45 }, kcal: 160,
    macros: { protein: 30, carbs: 4, fat: 3 }, allergens: ['milk', 'soy'],
    source: 'MuscleTech international manufacturer supplement facts, Milk Chocolate, checked 23 November 2026. Per 45 g scoop: 160 kcal, 30 g protein, 4 g carbs and 3 g fat. Includes 3 g creatine monohydrate. Manufacturer also lists facility cross-contact allergens.',
    sourceUrl: 'https://international.muscletech.com/products/all/protein/nitro-tech/',
  },
  {
    id: 'muscletech-whey-gold',
    name: 'MuscleTech Nitro-Tech Whey Gold — Double Rich Chocolate',
    aliases: ['muscletech whey gold', 'nitro tech whey gold', 'nitrotech whey gold', 'nitro-tech whey gold'],
    serving: { label: '1 scoop', grams: 34 }, kcal: 130,
    macros: { protein: 24, carbs: 3, fat: 2.5 }, allergens: ['milk', 'soy'],
    source: 'MuscleTech international manufacturer supplement facts, Double Rich Chocolate, checked 23 November 2026. Per 34 g scoop: 130 kcal, 24 g protein, 3 g carbs and 2.5 g fat. This Whey Gold formula differs from original Nitro-Tech. Manufacturer also lists facility cross-contact allergens.',
    sourceUrl: 'https://international.muscletech.com/products/all/protein/nitro-tech-100-whey-gold/',
  },
  {
    id: 'now-pea-protein',
    name: 'NOW Sports Pea Protein — Unflavoured',
    aliases: ['now pea protein', 'now sports pea protein', 'pea protein', 'pea protein isolate', 'plant protein pea', 'vegan pea protein'],
    serving: { label: '1 level scoop', grams: 33 }, kcal: 120,
    macros: { protein: 24, carbs: 1, fat: 2 }, allergens: [],
    source: 'NOW Foods US manufacturer nutrition facts, Unflavored, checked 23 November 2026. Per 33 g level scoop: 120 kcal, 24 g protein, 1 g carbs and 2 g fat. Pea protein isolate; the manufacturer labels this product vegan and lists facility cross-contact allergens.',
    sourceUrl: 'https://www.nowfoods.com/products/sports-nutrition/pea-protein-unflavored-powder',
  },
  {
    id: 'now-soy-protein',
    name: 'NOW Sports Soy Protein Isolate — Unflavoured',
    aliases: ['now soy protein', 'now sports soy protein', 'soy protein', 'soy protein isolate', 'soya protein', 'vegan soy protein'],
    serving: { label: '1 serving (⅓ cup powder)', grams: 24 }, kcal: 90,
    macros: { protein: 20, carbs: 0, fat: 0.5 }, allergens: ['soy'],
    source: 'NOW Foods US manufacturer nutrition facts, Unflavored, checked 23 November 2026. Per 24 g serving (⅓ cup powder): 90 kcal, 20 g protein, 0 g carbs and 0.5 g fat. Soy protein isolate; the manufacturer labels this product vegan and lists facility cross-contact allergens.',
    sourceUrl: 'https://www.nowfoods.com/products/sports-nutrition/soy-protein-isolate-unflavored-powder',
  },
];

export const supplements: Food[] = labels.map(label => {
  const ratio = 100 / label.serving.grams;
  return {
    id: label.id, name: label.name, aliases: label.aliases,
    kcal: label.kcal * ratio,
    macros: { protein: label.macros.protein * ratio, carbs: label.macros.carbs * ratio, fat: label.macros.fat * ratio },
    state: 'ready', group: 'supplements', vegetarian: true, allergens: label.allergens,
    servings: [
      { ...label.serving, approximate: true },
      { label: '½ serving', grams: label.serving.grams / 2, approximate: true },
      { label: '2 servings', grams: label.serving.grams * 2, approximate: true },
      { label: '100 g', grams: 100, approximate: false },
    ],
    source: `${label.source} Label reference, not an independent analysis. Flavours, markets and formulations vary; use your pack's values if different.`,
    sourceUrl: label.sourceUrl, uncertainty: 'reference',
    instructions: 'Log the dry powder weight, not the weight of the mixed shake. Water adds no calories. Add milk, fruit, sugar or other ingredients as separate foods in the same meal. Scoop and cup measures are approximate; weighing powder gives a closer portion.',
  };
});
