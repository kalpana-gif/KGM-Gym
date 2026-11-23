import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CircleUserRound, Dumbbell, Ruler, Utensils } from 'lucide-react';
import { useApp } from '../context';
import { Modal } from './ui';
import { SegmentHighlight, SlidingContent } from './motion';
import { activities, energy, localDate, macroTargets, proposedTarget } from '../lib/calories';
import { save } from '../lib/db';
import type { Profile, Weight } from '../types';

const tabs = [
  { key: 'body', label: 'Body', icon: Ruler },
  { key: 'meals', label: 'Meals & everyday life', icon: Utensils },
  { key: 'movement', label: 'Movement & health', icon: Dumbbell },
] as const;
type ProfileTab = typeof tabs[number]['key'];

export default function ProfileEditor({ close }: { close: () => void }) {
  const a = useApp();
  const [p, setP] = useState<Profile>({ ...a.profile });
  const [reviewed, setReviewed] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('body');
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const e = energy(p);
  const today = localDate(p.timezone);
  const target = proposedTarget(p, today);
  const macros = target && macroTargets(target);
  const field = (key: keyof Profile, value: unknown) => {
    setP(prev => ({ ...prev, [key]: value }));
    setReviewed(false);
  };
  const selectTab = (next: ProfileTab) => {
    if (next === tab) return;
    setDirection(tabs.findIndex(item => item.key === next) > tabs.findIndex(item => item.key === tab) ? 1 : -1);
    setTab(next);
  };

  useEffect(() => {
    form.current?.closest('.modal-body')?.scrollTo({ top: 0 });
  }, [tab]);

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next].key);
    tabButtons.current[next]?.focus();
  };

  const commit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await a.run(async () => {
        // Every tab shares one draft. Validate body fields even when another tab is open.
        if (!Number.isFinite(p.age) || !Number.isFinite(p.height) || !Number.isFinite(p.weight)
          || p.age < 18 || p.age > 100 || p.height < 100 || p.height > 230 || p.weight < 30 || p.weight > 350) {
          selectTab('body');
          throw new Error('Enter valid adult age, height and weight.');
        }
        if (p.targetWeight !== undefined && (!Number.isFinite(p.targetWeight) || p.targetWeight < 30 || p.targetWeight >= p.weight)) {
          selectTab('body');
          throw new Error('Choose a lower target weight of at least 30 kg, or leave it blank.');
        }
        if (!Number.isFinite(p.deficit) || p.deficit < 0 || p.deficit > 15
          || !Number.isFinite(p.proteinPercent) || p.proteinPercent < 10 || p.proteinPercent > 35
          || !Number.isFinite(p.fatPercent) || p.fatPercent < 20 || p.fatPercent > 40) {
          throw new Error('Use the supported moderate deficit and macro ranges.');
        }
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
      }, 'Your profile is saved.');
    } finally {
      setSaving(false);
    }
  };

  return <Modal title="Your profile" headingIcon={<CircleUserRound size={24} aria-hidden="true" />}
    close={close} wide busy={saving} className="profile-modal"
    navigation={<div className="profile-navigation">
      <div className="profile-tabs segmented-control" role="tablist" aria-label="Profile sections">
        {tabs.map((item, index) => <button key={item.key} type="button" role="tab"
          id={`${id}-tab-${item.key}`} aria-controls={`${id}-panel-${item.key}`}
          aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1}
          ref={element => { tabButtons.current[index] = element; }}
          onKeyDown={event => moveTab(event, index)} onClick={() => selectTab(item.key)}>
          {tab === item.key && <SegmentHighlight id={`${id}-selection`} />}
          <item.icon size={18} aria-hidden="true" /><span>{item.label}</span>
        </button>)}
      </div>
    </div>}
    footer={<div className="profile-footer">
      {target && macros && <>
        <div className="profile-target">
          <strong>{target.kcal.toLocaleString()} <span>kcal / day</span></strong>
          <span>{Math.round(macros.protein)} g protein · {Math.round(macros.carbs)} g carbs · {Math.round(macros.fat)} g fat</span>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={saving} />
          <span>I’ve reviewed this estimated target and macro allocation. Apply it from today; keep earlier daily targets.</span>
        </label>
      </>}
      <button className="btn primary full" type="submit" form={`${id}-form`} disabled={saving}>
        {saving ? 'Saving your profile…' : target ? 'Confirm & save my target' : 'Save details · keep estimates as a range'}
      </button>
    </div>}>
    <form ref={form} id={`${id}-form`} noValidate onSubmit={event => { event.preventDefault(); void commit(); }}>
      <SlidingContent activeKey={tab} direction={direction}>
      <section role="tabpanel" tabIndex={0} id={`${id}-panel-body`} aria-labelledby={`${id}-tab-body`} hidden={tab !== 'body'}>
          <p className="subtext">Your measurements help estimate your daily food target.</p>
          <div className="form-grid three">
            <label>Age<input type="number" required min="18" max="100" value={p.age} onChange={event => field('age', +event.target.value)} /></label>
            <label>Height · cm<input type="number" required min="100" max="230" value={p.height} onChange={event => field('height', +event.target.value)} /></label>
            <label>Weight · kg<input type="number" required min="30" max="350" step=".1" value={p.weight} onChange={event => field('weight', +event.target.value)} /></label>
          </div>
          <div className="form-grid">
            <label>Sex input for energy equation<select value={p.sex} onChange={event => field('sex', event.target.value)}><option value="unspecified">Not selected · show a range</option><option value="male">Male equation</option><option value="female">Female equation</option></select></label>
            <label>Activity level<select value={p.activity} onChange={event => field('activity', event.target.value)}><option value="unspecified">Not selected · show a range</option>{Object.entries(activities).map(([key, item]) => <option key={key} value={key}>{item.label} · {item.factor}×</option>)}</select></label>
          </div>
          {p.activity !== 'unspecified' && <p className="fineprint">{activities[p.activity].detail}. This multiplier is an approximate starting assumption.</p>}
          <div className="form-grid">
            <label>Optional goal weight · kg<input type="number" min="30" max={p.weight - .1} step=".1" placeholder="Choose when you’re ready" value={p.targetWeight ?? ''} onChange={event => field('targetWeight', event.target.value ? +event.target.value : undefined)} /></label>
            <label>Moderate deficit · {p.deficit}%<input type="range" min="0" max="15" step="1" value={p.deficit} onChange={event => field('deficit', +event.target.value)} /></label>
          </div>
          <div className="calculator-result">
            <p className="eyebrow">YOUR ESTIMATES</p>
            <div className="calc-values">
              <div><small>Resting energy</small><strong>{e.restingMin === e.restingMax ? e.restingMin : `${e.restingMin}–${e.restingMax}`}</strong><small>kcal / day</small></div>
              <div><small>Maintenance</small><strong>{e.complete ? e.min : `${e.min}–${e.max}`}</strong><small>kcal / day</small></div>
              <div><small>Proposed food target</small><strong>{target?.kcal ?? '—'}</strong><small>{target ? 'kcal / day' : 'Complete inputs first'}</small></div>
            </div>
            <p className="fineprint">Simplified Mifflin–St Jeor equation. Resting energy is the estimate at rest; maintenance includes assumed daily activity. Neither is a precise measurement.</p>
          </div>
          {e.complete && !target && <p className="warning">This calculation needs individual review. KGM-FIT only creates automatic food targets from 1,500 to 4,000 kcal; those limits do not mean every target inside the range suits everyone. Save your details and discuss an appropriate target with a dietitian.</p>}
      </section>
      <section role="tabpanel" tabIndex={0} id={`${id}-panel-meals`} aria-labelledby={`${id}-tab-meals`} hidden={tab !== 'meals'}>
          <p className="subtext">Make your meal suggestions fit your everyday routine.</p>
          <div className="form-grid">
            <label>Food preference<select value={p.preference} onChange={event => field('preference', event.target.value)}><option value="all">Mixed diet</option><option value="vegetarian">Vegetarian · eggs/dairy allowed</option></select></label>
            <label>Food budget<select value={p.budget} onChange={event => field('budget', event.target.value)}><option value="low">Budget conscious</option><option value="standard">Flexible</option></select></label>
            <label>Cooking access<select value={p.cooking} onChange={event => field('cooking', event.target.value)}><option value="kitchen">Kitchen available</option><option value="limited">Limited · simple / prepared foods</option></select></label>
            <label>Allergies · comma separated<input placeholder="e.g. egg, milk, wheat, coconut, fish" value={p.allergies} onChange={event => field('allergies', event.target.value)} /></label>
          </div>
          <p className="fineprint">Check ingredients and cross-contact yourself. The catalog filter cannot guarantee an allergy-safe meal.</p>
          <div className="profile-allocation">
            <h3>Daily macro allocation</h3>
            <div className="form-grid">
              <label>Protein allocation · {p.proteinPercent}%<input type="range" min="10" max="35" value={p.proteinPercent} onChange={event => field('proteinPercent', +event.target.value)} /></label>
              <label>Fat allocation · {p.fatPercent}%<input type="range" min="20" max="40" value={p.fatPercent} onChange={event => field('fatPercent', +event.target.value)} /></label>
            </div>
            <p className="fineprint">Carbohydrate uses the remaining {100 - p.proteinPercent - p.fatPercent}%. Protein/carbohydrate: 4 kcal/g; fat: 9 kcal/g.</p>
          </div>
      </section>
      <section role="tabpanel" tabIndex={0} id={`${id}-panel-movement`} aria-labelledby={`${id}-tab-movement`} hidden={tab !== 'movement'}>
          <p className="subtext">Choose a starting pace and share what your body needs.</p>
          <div className="form-grid">
            <label>Experience<select value={p.experience} onChange={event => field('experience', event.target.value)}><option value="beginner">Starting gently</option><option value="returning">Returning to exercise</option></select></label>
            <label>Equipment<select value={p.equipment} onChange={event => field('equipment', event.target.value)}><option value="none">Home · no equipment</option><option value="bands">Resistance bands</option><option value="gym">Gym access</option></select></label>
            <label>Injuries / movement limitations<textarea placeholder="Anything to work around?" value={p.injuries} onChange={event => field('injuries', event.target.value)} /></label>
            <label>Relevant health conditions<textarea placeholder="Anything your plan should consider?" value={p.conditions} onChange={event => field('conditions', event.target.value)} /></label>
          </div>
          <p className="fineprint">General adult wellness guidance. Seek an individualized plan for pregnancy, eating disorders or health conditions affecting nutrition/exercise. No workout calories are automatically added to your food allowance.</p>
      </section>
      </SlidingContent>
    </form>
  </Modal>;
}
