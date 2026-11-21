import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Plus, Utensils, Footprints, TrendingDown, Check, Sun, Moon, Coffee, ArrowUpRight, Dumbbell, CalendarDays, ChartNoAxesCombined, Sparkles } from 'lucide-react';
import { useApp } from '../context';
import { energy, macroTargets, round, total } from '../lib/calories';
import { FitnessArt, PlateArt, SectionHead } from '../components/ui';
import { workoutFor } from '../data/workouts';
import type { LocalRecord, Meal, Session } from '../types';
import { AnimatedNumber, Reveal } from '../components/motion';

export default function Today() {
  const reduce = useReducedMotion();
  const a = useApp();
  const meals = a.rows.filter(r => r.entity === 'meal_logs' && (r.data as Meal).date === a.date);
  const eaten = total(meals.flatMap(r => (r.data as Meal).items));
  const macro = a.target ? macroTargets(a.target) : null;
  const budget = a.target?.kcal ?? 0;
  const pct = budget ? Math.min(100, eaten.kcal / budget * 100) : 0;
  const workout = workoutFor(new Date(`${a.date}T12:00:00Z`).getUTCDay(), a.profile);
  const sessions = a.rows.filter(r => r.entity === 'workout_sessions' && (r.data as Session).date === a.date);
  const remaining = budget - eaten.kcal;
  const slots = [
    { id: 'breakfast', label: 'Breakfast', Icon: Coffee },
    { id: 'lunch', label: 'Lunch', Icon: Sun },
    { id: 'dinner', label: 'Dinner', Icon: Moon },
    { id: 'snacks', label: 'Snacks', Icon: Utensils },
  ] as const;
  return <>
    <div className="page-heading today-heading"><div className="heading-copy"><p className="eyebrow"><Sparkles size={13}/> YOUR DAILY RESET</p><h1>Small steps.<br /><span>Lasting change.</span></h1><p>Eat well. Move a little. Build your rhythm.</p></div><div className="heading-art" aria-hidden="true"><FitnessArt/><span className="equipment-label">MAKE TODAY COUNT <ArrowUpRight size={13}/></span></div></div>
    {!a.target && <button className="setup-banner" onClick={a.openProfile}><span className="setup-icon"><LeafIcon /></span><span><strong>Let’s find your starting point</strong><small>Review your details to set a daily calorie target.</small></span><ArrowRight size={20} /></button>}
    <section className="quick-access" aria-label="Quick access"><div className="quick-access-heading"><h2>Quick access</h2><span>A little action, every day</span></div><div className="quick-actions">{[
      {key:'food',label:'Food diary',Icon:Utensils},
      {key:'plan',label:'Meal plan',Icon:CalendarDays},
      {key:'workouts',label:'Movement',Icon:Dumbbell},
      {key:'progress',label:'My progress',Icon:ChartNoAxesCombined},
    ].map(({key,label,Icon})=><motion.button key={key} className="quick-action" whileTap={reduce?undefined:{scale:.97}} onClick={()=>a.navigate(key)}><span><Icon size={22}/></span><strong>{label}</strong><ArrowUpRight className="quick-arrow" size={15}/></motion.button>)}</div></section>
    <Reveal className="dashboard-grid">
      <section className="card calorie-card">
        <div className="card-top"><div><p className="eyebrow">TODAY’S BALANCE</p><h2>Make every meal count</h2></div><span className="badge">kcal</span></div>
        <div className="calorie-body"><div className="calorie-ring">
          <svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="76" fill="none" stroke="var(--well)" strokeWidth="9" /><motion.circle className="energy-arc" cx="90" cy="90" r="76" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
            initial={reduce?false:{strokeDasharray:'0 477.5'}} animate={{strokeDasharray:`${pct / 100 * 477.5} 477.5`}} transition={{duration:reduce?0:.65,ease:[.22,1,.36,1]}} transform="rotate(-90 90 90)" /></svg>
          <div><strong>{budget ? <AnimatedNumber value={round(Math.abs(remaining))}/> : '—'}</strong><span>{budget ? remaining < 0 ? 'kcal above target' : 'kcal remaining' : 'set your target'}</span></div>
        </div><div className="calorie-stats"><div><span className="dot accent" /><div><p>Eaten</p><strong>{round(eaten.kcal).toLocaleString()} <small>kcal</small></strong></div></div><div><span className="dot pale" /><div><p>Daily target</p><strong>{budget ? budget.toLocaleString() : '—'} <small>kcal</small></strong></div></div><button className="text-btn" onClick={a.openProfile}>Review calculator <ArrowRight size={14} /></button></div></div>
        <div className="macro-grid">{(['protein', 'carbs', 'fat'] as const).map((key, i) => <div key={key}><div><span>{key[0].toUpperCase() + key.slice(1)}</span><strong>{round(eaten[key])}<small> / {macro ? round(macro[key]) : '—'} g</small></strong></div><div className="track"><motion.i className={`macro-${i}`} initial={false} animate={{width:`${macro ? Math.min(100, eaten[key] / macro[key] * 100) : 0}%`}} transition={{duration:reduce?0:.5}} /></div></div>)}</div>
        <motion.button className="btn primary full" whileTap={reduce?undefined:{scale:.985}} onClick={() => a.openFood()}><Plus size={18} /> Log a meal</motion.button>
      </section>
      <section className="food-hero"><span className="pill light">FAMILIAR FOOD. FRESH BALANCE.</span><div className="food-hero-content"><div className="food-hero-copy"><h2>Your plate.<br /><span>Your pace.</span></h2><p>Rice & curry belongs here.<br />Find portions that work for you.</p></div><PlateArt /></div><button className="hero-link" onClick={() => a.navigate('plan')}>Explore your meal plan <ArrowUpRight size={16}/></button><span className="hero-note">SRI LANKAN MEALS, THOUGHTFULLY PORTIONED</span></section>
    </Reveal>
    <div className="mini-grid">
      <motion.button className="mini-card" whileHover={reduce?undefined:{y:-2}} whileTap={reduce?undefined:{scale:.99}} onClick={() => a.navigate('workouts')}><span className="mini-icon lime"><Footprints size={22} /></span><div><p>Today’s movement</p><strong>{sessions.length ? 'Session logged. Nicely done.' : workout.name}</strong><small>{workout.minutes ? `${workout.minutes} min · at your own pace` : 'A little recovery goes a long way'}</small></div><ArrowUpRight size={18} /></motion.button>
      <motion.button className="mini-card" whileHover={reduce?undefined:{y:-2}} whileTap={reduce?undefined:{scale:.99}} onClick={() => a.navigate('progress')}><span className="mini-icon electric"><TrendingDown size={22} /></span><div><p>Your journey</p><strong>{a.profile.weight} kg <span className="muted">current profile</span></strong><small>Progress is a trend, not a single day.</small></div><ArrowUpRight size={18} /></motion.button>
    </div>
    <SectionHead title="Your food diary" text="A little awareness makes a big difference." action={() => a.navigate('food')} label="Browse foods" />
    <div className="diary-grid">{slots.map(({ id, label, Icon }) => {
      const rows = meals.filter(r => (r.data as Meal).slot === id);
      return <motion.section className="card diary-card" key={id} initial={reduce?false:{opacity:0,y:8}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.1}} transition={{duration:reduce?0:.25,delay:reduce?0:slots.findIndex(s=>s.id===id)*.035}}><div className="card-top"><h3><Icon size={18} />{label}</h3><span>{round(total(rows.flatMap(r => (r.data as Meal).items)).kcal)} kcal</span></div>
        {rows.length ? rows.map(r => <button className="diary-entry" key={r.id} onClick={() => a.openFood(id, r as LocalRecord<Meal>)}><span><strong>{(r.data as Meal).name}</strong><small>{(r.data as Meal).items.map(i => `${round(i.grams)} g ${i.food.name}`).join(' · ')}</small></span><Check size={16} /></button>) : <p className="diary-empty">Nothing logged yet.<br />Start with what’s on your plate.</p>}
        <button className="add-food" onClick={() => a.openFood(id)}><Plus size={15} />Add {label.toLowerCase()}</button></motion.section>;
    })}</div>
    <div className="gentle-note"><span>✦</span><p>Consistency beats perfection. Your next meal is a new opportunity.</p></div>
    {!energy(a.profile).complete && <p className="fineprint">Your age, height and weight are prefilled. Choose the equation input and activity level before applying a personalized calorie target.</p>}
  </>;
}
function LeafIcon() { return <svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M19 4C8 3 3 9 7 15c6 5 12-2 12-11Z M5 20l10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>; }
