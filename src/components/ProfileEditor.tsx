import { useState } from 'react';
import { useApp } from '../context';
import { Modal } from './ui';
import { activities, energy, localDate, macroTargets, proposedTarget } from '../lib/calories';
import { save } from '../lib/db';
import type { Profile, Weight } from '../types';

export default function ProfileEditor({ close }: { close: () => void }) {
  const a = useApp(); const [p, setP] = useState<Profile>({ ...a.profile });
  const [reviewed, setReviewed] = useState(false);
  const e = energy(p); const today = localDate(p.timezone); const target = proposedTarget(p, today);
  const macros = target && macroTargets(target);
  const field = (key: keyof Profile, value: unknown) => { setP(prev => ({ ...prev, [key]: value })); setReviewed(false); };
  const commit = () => a.run(async () => {
    if (p.age < 18 || p.age > 100 || p.height < 100 || p.height > 230 || p.weight < 30 || p.weight > 350 || !Number.isFinite(p.weight)) throw new Error('Enter valid adult age, height and weight.');
    if (p.targetWeight && (p.targetWeight < 30 || p.targetWeight >= p.weight)) throw new Error('Choose a lower target weight of at least 30 kg, or leave it blank.');
    if (p.deficit < 0 || p.deficit > 15 || p.proteinPercent < 10 || p.proteinPercent > 35 || p.fatPercent < 20 || p.fatPercent > 40) throw new Error('Use the supported moderate deficit and macro ranges.');
    if (target && !reviewed) throw new Error('Review and confirm the proposed target before applying it.');
    const existing = a.rows.find(r => r.entity === 'profiles');
    await save(a.owner, 'profiles', p, existing?.id);
    if (target) {
      const old = a.rows.find(r => r.entity === 'daily_targets' && (r.data as { date: string }).date === today);
      await save(a.owner, 'daily_targets', target, old?.id);
    }
    const oldWeight = a.rows.find(r => r.entity === 'weight_entries' && (r.data as Weight).date === today);
    await save(a.owner, 'weight_entries', { date: today, kg: p.weight }, oldWeight?.id);
    close();
  }, 'Your starting point is saved.');
  return <Modal title="Your starting point" close={close} wide>
    <p className="subtext">A few details help make this yours. You can change them any time.</p>
    <form onSubmit={e => { e.preventDefault(); void commit(); }}>
      <div className="form-grid three"><label>Age<input type="number" required min="18" max="100" value={p.age} onChange={e => field('age', +e.target.value)} /></label><label>Height · cm<input type="number" required min="100" max="230" value={p.height} onChange={e => field('height', +e.target.value)} /></label><label>Weight · kg<input type="number" required min="30" max="350" step=".1" value={p.weight} onChange={e => field('weight', +e.target.value)} /></label></div>
      <div className="form-grid"><label>Sex input for energy equation<select value={p.sex} onChange={e => field('sex', e.target.value)}><option value="unspecified">Not selected · show a range</option><option value="male">Male equation</option><option value="female">Female equation</option></select></label><label>Activity level<select value={p.activity} onChange={e => field('activity', e.target.value)}><option value="unspecified">Not selected · show a range</option>{Object.entries(activities).map(([key, item]) => <option key={key} value={key}>{item.label} · {item.factor}×</option>)}</select></label></div>
      {p.activity !== 'unspecified' && <p className="fineprint">{activities[p.activity].detail}. This multiplier is an approximate starting assumption.</p>}
      <div className="form-grid"><label>Optional goal weight · kg<input type="number" min="30" max={p.weight - .1} step=".1" placeholder="Choose when you’re ready" value={p.targetWeight ?? ''} onChange={e => field('targetWeight', e.target.value ? +e.target.value : undefined)} /></label><label>Moderate deficit · {p.deficit}%<input type="range" min="0" max="15" step="1" value={p.deficit} onChange={e => field('deficit', +e.target.value)} /></label></div>
      <div className="calculator-result"><p className="eyebrow">YOUR ESTIMATES</p><div className="calc-values"><div><small>Resting energy</small><strong>{e.restingMin === e.restingMax ? e.restingMin : `${e.restingMin}–${e.restingMax}`}</strong><small>kcal / day</small></div><div><small>Maintenance</small><strong>{e.complete ? e.min : `${e.min}–${e.max}`}</strong><small>kcal / day</small></div><div><small>Proposed food target</small><strong>{target?.kcal ?? '—'}</strong><small>{target ? 'kcal / day' : 'Complete inputs first'}</small></div></div>
        <p className="fineprint">Simplified Mifflin–St Jeor equation. Resting energy is the estimate at rest; maintenance also includes assumed daily activity. Neither is a precise measurement.</p>
      </div>
      {e.complete && !target && <p className="warning">This calculation needs individual review. KGM-FIT only creates automatic food targets from 1,500 to 4,000 kcal; those limits do not mean every target inside the range suits everyone. Save your details and discuss an appropriate target with a dietitian.</p>}
      <div className="form-grid"><label>Protein allocation · {p.proteinPercent}%<input type="range" min="10" max="35" value={p.proteinPercent} onChange={e => field('proteinPercent', +e.target.value)} /></label><label>Fat allocation · {p.fatPercent}%<input type="range" min="20" max="40" value={p.fatPercent} onChange={e => field('fatPercent', +e.target.value)} /></label></div>
      {macros && <p className="fineprint">Approximate allocation: {Math.round(macros.protein)} g protein · {Math.round(macros.carbs)} g carbohydrate · {Math.round(macros.fat)} g fat. Protein/carbohydrate: 4 kcal/g; fat: 9 kcal/g.</p>}
      <details className="details" open><summary>Meals & everyday life</summary><div className="form-grid"><label>Food preference<select value={p.preference} onChange={e => field('preference', e.target.value)}><option value="all">Mixed diet</option><option value="vegetarian">Vegetarian · eggs/dairy allowed</option></select></label><label>Food budget<select value={p.budget} onChange={e => field('budget', e.target.value)}><option value="low">Budget conscious</option><option value="standard">Flexible</option></select></label><label>Cooking access<select value={p.cooking} onChange={e => field('cooking', e.target.value)}><option value="kitchen">Kitchen available</option><option value="limited">Limited · simple / prepared foods</option></select></label><label>Allergies · comma separated<input placeholder="e.g. egg, milk, wheat, coconut, fish" value={p.allergies} onChange={e => field('allergies', e.target.value)} /></label></div><p className="fineprint">Check ingredients and cross-contact yourself. The catalog filter cannot guarantee an allergy-safe meal.</p></details>
      <details className="details"><summary>Movement & health</summary><div className="form-grid"><label>Experience<select value={p.experience} onChange={e => field('experience', e.target.value)}><option value="beginner">Starting gently</option><option value="returning">Returning to exercise</option></select></label><label>Equipment<select value={p.equipment} onChange={e => field('equipment', e.target.value)}><option value="none">Home · no equipment</option><option value="bands">Resistance bands</option><option value="gym">Gym access</option></select></label><label>Injuries / movement limitations<textarea value={p.injuries} onChange={e => field('injuries', e.target.value)} /></label><label>Relevant health conditions<textarea value={p.conditions} onChange={e => field('conditions', e.target.value)} /></label></div></details>
      <p className="fineprint">General adult wellness guidance. Seek an individualized plan for pregnancy, eating disorders or health conditions affecting nutrition/exercise. No workout calories are automatically added to your food allowance.</p>
      {target && <label className="checkbox"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} /><span>I’ve reviewed this estimated target and macro allocation. Apply it from today; keep earlier daily targets.</span></label>}
      <button className="btn primary full" type="submit">{target ? 'Confirm & save my target' : 'Save details · keep estimates as a range'}</button>
    </form>
  </Modal>;
}
