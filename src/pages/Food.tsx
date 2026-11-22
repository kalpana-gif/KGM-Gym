import { useState } from 'react';
import { Search, Plus, Star, RotateCcw } from 'lucide-react';
import { useApp } from '../context';
import { FoodMark, Modal, SectionHead } from '../components/ui';
import { records, remove, save } from '../lib/db';
import { total } from '../lib/calories';
import type { Food as FoodType, LocalRecord, Meal } from '../types';

export default function Food() {
  const a = useApp(); const [search, setSearch] = useState(''); const [group, setGroup] = useState('all');
  const [custom, setCustom] = useState(false); const [recipe, setRecipe] = useState(false);
  const [deleted, setDeleted] = useState<LocalRecord<Meal>[]>([]);
  const favorites = a.rows.filter(r => r.entity === 'favorites');
  const favoriteIds = favorites.map(r => (r.data as { foodId: string }).foodId);
  const found = a.foods.filter(f => (group === 'all' || group === 'favorites' ? group !== 'favorites' || favoriteIds.includes(f.id) : f.group === group) && `${f.name} ${f.aliases.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (f: FoodType) => a.run(async () => {
    const existing = favorites.find(r => (r.data as { foodId: string }).foodId === f.id);
    if (existing) await remove(existing); else await save(a.owner, 'favorites', { foodId: f.id });
  });
  return <>
    <div className="page-heading"><div><p className="eyebrow">FAMILIAR FOODS, BETTER AWARENESS</p><h1>What’s on your plate<span>?</span></h1><p>Search Sri Lankan staples, or create a food that’s yours.</p></div><button className="btn primary" onClick={() => a.openFood()}><Plus size={17} />Log a meal</button></div>
    <section className="card food-search-card"><label className="search-field"><Search size={19} /><input aria-label="Search food catalog" placeholder="Search rice, parippu, hoppers…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="filter-row" role="group" aria-label="Food categories">{['all', 'favorites', 'grain', 'protein', 'vegetable', 'fruit', 'extra'].map(g => <button key={g} className={group === g ? 'active' : ''} aria-pressed={group === g} onClick={() => setGroup(g)}>{g === 'all' ? 'All foods' : g[0].toUpperCase() + g.slice(1)}</button>)}</div></section>
    <div className="button-row food-tools"><button className="btn secondary" onClick={() => setCustom(true)}><Plus size={16} />Custom food</button><button className="btn secondary" onClick={() => setRecipe(true)}><Plus size={16} />Custom recipe</button><button className="text-btn" onClick={() => void a.run(async () => setDeleted((await records<Meal>(a.owner, 'meal_logs', true)).filter(r => r.deleted)))}><RotateCcw size={16} />Recently deleted meals</button></div>
    <SectionHead title={`${found.length} foods to explore`} text="Values per 100 g of edible food. Recipes and local-food proxies are estimates." />
    <ul className="catalog-grid" aria-label="Food catalog">{found.map(f => <li className="card food-card" key={f.id}>
      <div className="food-card-head">
        <div className="food-identity"><FoodMark food={f} /><div className="food-title"><h3 id={`food-name-${f.id}`}>{f.name}</h3><p className="food-mobile-kcal"><strong>{Math.round(f.kcal)}</strong> kcal <span>/ 100 g</span></p></div></div>
        <button className={`icon-btn ${favoriteIds.includes(f.id) ? 'favorited' : ''}`} aria-label={`${favoriteIds.includes(f.id) ? 'Unfavorite' : 'Favorite'} ${f.name}`} aria-pressed={favoriteIds.includes(f.id)} onClick={() => void toggle(f)}><Star size={18} fill={favoriteIds.includes(f.id) ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="food-nutrition">
        <p className="food-kcal"><strong>{Math.round(f.kcal)}</strong> kcal <span>/ 100 g</span></p>
        <p className="food-macros"><span><strong>{Math.round(f.macros.protein)} g</strong> protein</span><span className="food-macro-separator" aria-hidden="true"> · </span><span><strong>{Math.round(f.macros.carbs)} g</strong> carbs</span><span className="food-macro-separator" aria-hidden="true"> · </span><span><strong>{Math.round(f.macros.fat)} g</strong> fat</span></p>
      </div>
      <div className="food-metadata">
        <div className="food-tags"><span>{f.state}</span><span>{f.uncertainty}</span></div>
        <details><summary>Source & recipe</summary><p className="fineprint">{f.source}</p>{f.instructions && <p>{f.instructions}</p>}{f.ingredients && <p className="fineprint">Batch: {f.ingredients.map(i => `${i.grams} g ${a.foods.find(x => x.id === i.foodId)?.name ?? i.foodId}`).join(' · ')}. Assumed yield: {f.yieldGrams} g.</p>}</details>
      </div>
      <button className="btn secondary full food-add" aria-label="Add to meal" aria-describedby={`food-name-${f.id}`} title={`Add ${f.name} to meal`} onClick={() => a.openFood(undefined, undefined, f)}><Plus size={18} aria-hidden="true" /><span className="food-add-label">Add to meal</span></button>
    </li>)}</ul>
    {!found.length && <div className="empty"><h3>No foods found</h3><p>Try another name, or add a custom food.</p></div>}

    {deleted.map(r => <div className="card restore-row" key={r.id}><span>{r.data.name} · {r.data.date}</span><button className="text-btn" onClick={() => void a.run(async () => { await save(a.owner, 'meal_logs', r.data, r.id); setDeleted(rows => rows.filter(x => x.id !== r.id)); }, 'Meal restored.')}><RotateCcw size={15} />Restore</button></div>)}
    {custom && <CustomFood close={() => setCustom(false)} />}
    {recipe && <CustomRecipe close={() => setRecipe(false)} />}
  </>;
}
function CustomFood({ close }: { close: () => void }) {
  const a = useApp(); const [name, setName] = useState(''); const [kcal, setKcal] = useState(''); const [protein, setProtein] = useState(''); const [carbs, setCarbs] = useState(''); const [fat, setFat] = useState('');
  const [source, setSource] = useState(''); const [allergens, setAllergens] = useState(''); const [vegetarian, setVegetarian] = useState(true);
  return <Modal title="Add a custom food" close={close}><form onSubmit={e => { e.preventDefault(); void a.run(async () => {
    const values = [+kcal, +protein, +carbs, +fat]; if (values.some(v => !Number.isFinite(v) || v < 0) || +kcal > 1000) throw new Error('Enter sensible nonnegative values per 100 g.');
    const id = crypto.randomUUID();
    const food: FoodType = { id, name: name.trim(), aliases: [], kcal: +kcal, macros: { protein: +protein, carbs: +carbs, fat: +fat }, state: 'ready', group: 'extra', servings: [{ label: '100 g', grams: 100, approximate: false }], source: source || 'User-supplied nutrition; not independently verified.', uncertainty: 'user supplied', allergens: allergens.split(',').map(s => s.trim()).filter(Boolean), vegetarian };
    await save(a.owner, 'custom_foods', food, id); close();
  }, 'Custom food saved.'); }}><label>Food name<input required value={name} onChange={e => setName(e.target.value)} /></label><p className="subtext">Use the package’s values per 100 g. Calories can differ slightly from macro arithmetic.</p><div className="form-grid nutrition-grid">{[[kcal,setKcal,'Calories · kcal'],[protein,setProtein,'Protein · g'],[carbs,setCarbs,'Carbohydrate · g'],[fat,setFat,'Fat · g']].map(([value,setter,label]) => <label key={label as string}>{label as string}<input type="number" required min="0" step=".1" value={value as string} onChange={e => (setter as (s: string) => void)(e.target.value)} /></label>)}</div><label>Source / package notes<input value={source} onChange={e => setSource(e.target.value)} /></label><label>Allergens · comma separated<input value={allergens} onChange={e => setAllergens(e.target.value)} /></label><label className="checkbox"><input type="checkbox" checked={vegetarian} onChange={e => setVegetarian(e.target.checked)} />Vegetarian</label><button className="btn primary full">Save custom food</button></form></Modal>;
}
function CustomRecipe({ close }: { close: () => void }) {
  const a = useApp(); const [name, setName] = useState(''); const [yieldGrams, setYield] = useState(500); const [selected, setSelected] = useState('rice-white'); const [grams, setGrams] = useState(100); const [parts, setParts] = useState<{ foodId: string; grams: number }[]>([]); const [instructions, setInstructions] = useState('');
  const entries = parts.map((p, i) => ({ id: String(i), food: a.foods.find(f => f.id === p.foodId)!, grams: p.grams }));
  const sum = total(entries);
  return <Modal title="Your recipe, your portions" close={close}><label>Recipe name<input value={name} onChange={e => setName(e.target.value)} /></label><div className="form-grid"><label>Ingredient<select value={selected} onChange={e => setSelected(e.target.value)}>{a.foods.map(f => <option key={f.id} value={f.id}>{f.name} · {f.state}</option>)}</select></label><label>Ingredient grams<input type="number" min="1" value={grams} onChange={e => setGrams(+e.target.value)} /></label></div><button className="btn secondary" onClick={() => { if (grams > 0) setParts(p => [...p, { foodId: selected, grams }]); }}><Plus size={16} />Add ingredient</button>{parts.map((p,i) => <div className="restore-row" key={i}><span>{p.grams} g {a.foods.find(f => f.id === p.foodId)?.name}</span><button className="text-btn" onClick={() => setParts(rows => rows.filter((_,j) => i !== j))}>Remove</button></div>)}<label>Finished edible batch weight · g<input type="number" min="1" value={yieldGrams} onChange={e => setYield(+e.target.value)} /></label><label>Cooking instructions<textarea value={instructions} onChange={e => setInstructions(e.target.value)} /></label><p className="subtext">Include oil, coconut milk, sugar and sauces. Weigh the cooked batch; water loss changes values per 100 g.</p><p>Batch: {Math.round(sum.kcal)} kcal · {yieldGrams > 0 ? Math.round(sum.kcal / yieldGrams * 100) : '—'} kcal / 100 g</p><button className="btn primary full" onClick={() => void a.run(async () => {
    if (!name.trim() || !parts.length || yieldGrams <= 0) throw new Error('Add a name, ingredients and a valid finished batch weight.');
    const id = crypto.randomUUID(); const ratio = 100 / yieldGrams;
    await save(a.owner, 'recipes', { id, name, aliases: [], kcal: sum.kcal * ratio, macros: { protein: sum.protein * ratio, carbs: sum.carbs * ratio, fat: sum.fat * ratio }, state: 'cooked', group: 'extra', servings: [{ label: '100 g', grams: 100, approximate: false }], source: 'User recipe; calculated from ingredient references and your supplied batch yield.', uncertainty: 'recipe estimate', ingredients: parts, yieldGrams, instructions, vegetarian: entries.every(e => e.food.vegetarian), allergens: [...new Set(entries.flatMap(e => e.food.allergens))] }, id);
    close();
  }, 'Recipe saved.')}><CheckIcon />Save recipe</button></Modal>;
}
function CheckIcon() { return <span aria-hidden="true">✓</span>; }
