import { useMemo, useState } from 'react';
import { ShoppingBasket, Plus, RefreshCw, ChefHat } from 'lucide-react';
import { useApp } from '../context';
import { allowed, makePlan, shoppingList } from '../lib/plans';
import { dateLabel, total } from '../lib/calories';
import { save } from '../lib/db';
import { Empty, FoodMark, Modal, SectionHead } from '../components/ui';
import type { MealItem } from '../types';

export default function Plan() {
  const a = useApp(); const [index, setIndex] = useState(0); const [shopping, setShopping] = useState(false);
  const [swap, setSwap] = useState<{ mealName: string; items: MealItem[]; itemId: string; date: string } | null>(null);
  const [selected, setSelected] = useState('');
  const [servings, setServings] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<string[]>([]);
  const result = useMemo(() => {
    try { return { days: a.target ? makePlan(a.profile, a.target.kcal, a.date) : [], error: '' }; }
    catch (error) { return { days: [], error: error instanceof Error ? error.message : 'Review preferences to generate a suitable plan.' }; }
  }, [a.target?.kcal, a.profile, a.date]);
  const basePlan = result.days;
  const overrides = a.rows.filter(r => r.entity === 'meal_plans');
  const days = basePlan.map(d => ({ ...d, meals: d.meals.map(m => {
    const override = overrides.filter(r => (r.data as { date: string; name: string }).date === d.date && (r.data as { name: string }).name === m.name).sort((x,y) => y.modifiedAt.localeCompare(x.modifiedAt))[0];
    return { ...m, items: override ? (override.data as { items: MealItem[] }).items : m.items };
  }) }));
  if (!a.target) return <><div className="page-heading"><div><p className="eyebrow">FAMILIAR MEALS. THOUGHTFUL PORTIONS.</p><h1>Your week, made simpler<span>.</span></h1></div></div><section className="card"><Empty title="Let’s set your starting point" text="Review your calorie target so the seven-day plan can calculate portions for you." action={a.openProfile} actionLabel="Review my calculator" /></section></>;
  if (result.error) return <section className="card"><Empty title="Review your meal preferences" text={result.error} action={a.openProfile} actionLabel="Adjust preferences" /></section>;
  const day = days[index]; const sums = total(day.meals.flatMap(m => m.items));
  const list = shoppingList(days);
  return <>
    <div className="page-heading"><div><p className="eyebrow">FAMILIAR MEALS. THOUGHTFUL PORTIONS.</p><h1>Your week, made simpler<span>.</span></h1><p>Seven days of practical Sri Lankan meals, portioned around your reviewed target.</p></div><button className="btn secondary" onClick={() => setShopping(true)}><ShoppingBasket size={17} />Shopping list</button></div>
    <div className="plan-summary card"><ChefHat size={25} /><div><strong>{a.target.kcal.toLocaleString()} kcal daily target</strong><p>{a.profile.preference === 'vegetarian' ? 'Vegetarian' : 'Mixed diet'} · {a.profile.budget === 'low' ? 'Budget conscious' : 'Flexible budget'} · {a.profile.cooking === 'limited' ? 'Simple prepared-food options' : 'Kitchen-friendly recipes'}</p></div><button className="text-btn" onClick={a.openProfile}>Adjust preferences</button></div>
    {(a.profile.allergies || a.profile.conditions) && <div className="warning">Check this general plan with your clinician or dietitian when needed. Verify all ingredients and allergy cross-contact; filtering cannot guarantee safety.</div>}
    <div className="day-tabs" role="group" aria-label="Meal plan days">{days.map((d,i) => <button key={d.date} aria-pressed={index === i} className={index === i ? 'active' : ''} onClick={() => setIndex(i)}><span>{dateLabel(d.date, { weekday: 'short' })}</span><strong>{new Date(`${d.date}T12:00Z`).getUTCDate()}</strong></button>)}</div>
    <SectionHead title={dateLabel(day.date)} text={`Calculated plan: ${Math.round(sums.kcal)} kcal · ${Math.round(sums.protein)} g protein · ${Math.round(sums.carbs)} g carbs · ${Math.round(sums.fat)} g fat`} />
    <div className="plan-grid">{day.meals.map(m => {
      const factor = servings[m.slot] ?? 1;
      const scaled = m.items.map(i => ({ ...i, grams: Math.round(i.grams * factor) }));
      return <section className="card plan-card" key={m.slot}><div className="card-top"><span className="pill">{m.slot}</span><strong>{Math.round(total(scaled).kcal)} kcal</strong></div><h2>{m.name}</h2>{scaled.map(i => <div className="plan-item" key={i.id}><FoodMark food={i.food} /><div><strong>{i.food.name}</strong><small>{i.grams} g · approx. {Math.round(i.grams / 100 * i.food.kcal)} kcal</small>{i.food.servings.some(s => s.approximate) && <small>About {(i.grams / i.food.servings.find(s => s.approximate)!.grams).toFixed(1)} {i.food.servings.find(s => s.approximate)!.label}{i.food.servings.find(s => s.approximate)!.label === 'cup' ? 's' : ''} · estimate</small>}</div><button className="icon-btn" aria-label={`Swap ${i.food.name}`} onClick={() => { setSwap({ mealName: m.name, items: m.items, itemId: i.id, date: day.date }); setSelected(''); }}><RefreshCw size={15} /></button></div>)}
        <details className="details"><summary>How to prepare & easy swaps</summary>{scaled.filter(i => i.food.instructions).map(i => <p key={i.id}><strong>{i.food.name}:</strong> {i.food.instructions}</p>)}<p className="fineprint">For a lower-cost protein swap, choose legumes or eggs when suitable. Use seasonal vegetables. Values include each sample recipe’s oil and coconut milk; change the recipe for your actual cooking.</p></details>
        <label>Portion multiplier<select value={factor} onChange={e => setServings(p => ({ ...p, [m.slot]: +e.target.value }))}>{[.5,.75,1,1.25,1.5].map(n => <option key={n} value={n}>{n}× serving</option>)}</select></label>
        <button className="btn primary full" onClick={() => void a.run(() => save(a.owner, 'meal_logs', { name: m.name, slot: m.slot, date: day.date, timezone: a.profile.timezone, timestamp: new Date().toISOString(), items: scaled.map(i => ({ ...i, id: crypto.randomUUID() })) }), 'Eaten meal added to the diary.')}><Plus size={16} />I ate this · add to diary</button></section>;
    })}</div><p className="fineprint">Planned meals do not count as eaten until you add them. Calories are matched to your target; actual meal macros may differ from the calculator allocation. Review the displayed amounts and swap foods as appropriate. This general meal pattern is not a medically individualized diet. Recipe and household-measure estimates vary.</p>
    {shopping && <Modal title="Your seven-day shopping list" close={() => setShopping(false)}><p className="subtext">Calculated from your current plan. Cooked foods show cooked weights; purchase raw quantities with allowance for cooking yield.</p>{list.map(i => <label className="shopping-row" key={i.food.id}><input type="checkbox" checked={checked.includes(i.food.id)} onChange={() => setChecked(p => p.includes(i.food.id) ? p.filter(x => x !== i.food.id) : [...p,i.food.id])} /><span>{i.food.name}<small>{i.food.state} weight</small></span><strong>{Math.round(i.grams)} g</strong></label>)}<p className="fineprint">Add spices and salt to taste. No local price claims are included; choose seasonal vegetables and affordable protein options.</p></Modal>}
    {swap && <Modal title="Swap a food" close={() => setSwap(null)}><p className="subtext">The replacement keeps approximately the same calories; verify its portion.</p><label>Replacement<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a suitable food…</option>{a.foods.filter(f => f.kcal > 0 && allowed(f,a.profile)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button className="btn primary full" disabled={!selected} onClick={() => void a.run(async () => {
      const replacement = a.foods.find(f => f.id === selected)!;
      const newItems = swap.items.map(i => i.id === swap.itemId ? { ...i, food: replacement, grams: Math.max(1,Math.round(i.food.kcal * i.grams / replacement.kcal)) } : i);
      const old = overrides.find(r => (r.data as { date: string; name: string }).date === swap.date && (r.data as { name: string }).name === swap.mealName);
      await save(a.owner, 'meal_plans', { date: swap.date, name: swap.mealName, items: newItems }, old?.id); setSwap(null);
    }, 'Meal swap saved.')}><RefreshCw size={16} />Save swap</button></Modal>}
  </>;
}
