import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Plus, Search, Trash2, Check, Save, Sparkles } from 'lucide-react';
import { useApp } from '../context';
import { FoodMark, Modal } from './ui';
import { SegmentHighlight, SlidingContent } from './motion';
import DatePicker from './DatePicker';
import BusyIndicator, { BusyGlyph } from './BusyIndicator';
import { records, remove, save } from '../lib/db';
import { parseFoodText, type Parsed } from '../lib/parser';
import { supabase } from '../lib/cloud';
import { preparePhoto } from '../lib/photo';
import { total } from '../lib/calories';
import { defaultFoodGrams } from '../lib/servings';
import { estimatePhoto, photoMealItems, type PhotoEstimate } from '../lib/ai';
import type { Food, LocalRecord, Meal, MealItem, PhotoDraft } from '../types';

type PendingFood = Parsed & { grams?: number; source?: 'photo' };
type Activity = 'preparing' | 'analyzing' | 'saving' | 'draft' | 'copying' | 'deleting';
const modes = ['manual', 'text', 'photo'] as const;
type EntryMode = typeof modes[number];

export default function FoodComposer({ close, slot = 'lunch', meal, food, initialMode = 'manual' }: { close: () => void; slot?: Meal['slot']; meal?: LocalRecord<Meal>; food?: Food; initialMode?: 'manual' | 'text' | 'photo' }) {
  const a = useApp();
  const [mode, setMode] = useState<EntryMode>(initialMode);
  const [direction, setDirection] = useState(1);
  const id = useId();
  const selectMode = (next: EntryMode) => {
    if (next === mode) return;
    setDirection(modes.indexOf(next) > modes.indexOf(mode) ? 1 : -1);
    setMode(next);
  };
  const [name, setName] = useState(meal?.data.name ?? '');
  const [mealSlot, setMealSlot] = useState<Meal['slot']>(meal?.data.slot ?? slot);
  const [date, setDate] = useState(meal?.data.date ?? a.date);
  const [items, setItems] = useState<MealItem[]>(meal?.data.items.map(i => ({ ...i })) ?? (food ? [{ id: crypto.randomUUID(), food, grams: defaultFoodGrams(food) }] : []));
  const [search, setSearch] = useState(''); const [text, setText] = useState('');
  const [unresolved, setUnresolved] = useState<PendingFood[]>([]);
  const [photo, setPhoto] = useState<{ mime: string; base64: string } | null>(null);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(a.profile.aiConsent);
  const [activity, setActivity] = useState<Activity | null>(null);
  const busy = activity !== null;
  const [estimate, setEstimate] = useState<PhotoEstimate | null>(meal?.data.photoEstimate ?? null);
  const [aiItemIds, setAiItemIds] = useState<string[]>(meal?.data.items.filter(item => item.source === 'photo').map(item => item.id) ?? []);
  const [aiError, setAiError] = useState('');
  const [aiStatus, setAiStatus] = useState<'checking' | 'configured' | 'unavailable'>('checking');
  const [online, setOnline] = useState(navigator.onLine);
  const active = useRef(false);
  const savedMealId = useRef(meal?.id);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [retain, setRetain] = useState(false);
  const start = (next: Activity) => {
    if (active.current) return false;
    active.current = true; setActivity(next); return true;
  };
  const finish = () => { active.current = false; setActivity(null); };
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (mode !== 'photo' || !online) return;
    const controller = new AbortController();
    setAiStatus('checking');
    void fetch('/api/ai-status', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) }).then(async response => {
      const result = response.ok ? await response.json() : null;
      if (!controller.signal.aborted) setAiStatus(result?.configured === true ? 'configured' : 'unavailable');
    }).catch(() => { if (!controller.signal.aborted) setAiStatus('unavailable'); });
    return () => controller.abort();
  }, [mode, online]);
  const sum = total(items);
  const add = (f: Food, grams = defaultFoodGrams(f)) => { setItems(prev => [...prev, { id: crypto.randomUUID(), food: f, grams }]); setSearch(''); };
  const matches = a.foods.filter(f => `${f.name} ${f.aliases.join(' ')}`.toLowerCase().includes(search.toLowerCase())).slice(0, 7);
  const parse = () => {
    const rows = parseFoodText(text, a.foods); setItems(prev => [...prev, ...rows.flatMap(r => r.item ? [r.item] : [])]);
    setUnresolved(prev => [...prev, ...rows.filter(r => !r.item)]); setText('');
  };
  const resetPhotoReview = () => {
    setItems(previous => previous.filter(item => !aiItemIds.includes(item.id)));
    setUnresolved(previous => previous.filter(row => row.source !== 'photo'));
    setAiItemIds([]); setEstimate(null); setAiError('');
  };
  const unavailable = !online ? 'You’re offline. Save this photo for later or search foods now.'
    : aiStatus === 'checking' ? 'Checking photo AI…'
    : aiStatus === 'unavailable' ? 'Photo AI is not connected yet. You can still save a photo or search foods.'
    : '';
  const analyze = async () => {
    if (active.current) return;
    if (unavailable || !consent) { setAiError(unavailable || 'Allow photo sharing before requesting an estimate.'); return; }
    if (!start('analyzing')) return;
    setAiError('');
    try {
      if (!photo) throw new Error('Choose a meal photo first.');
      const result = await estimatePhoto({ ...photo, description, consent: true });
      const added = photoMealItems(result, a.foods);
      setItems(previous => [...previous.filter(item => !aiItemIds.includes(item.id)), ...added]);
      setUnresolved(previous => previous.filter(row => row.source !== 'photo'));
      setAiItemIds(added.map(item => item.id));
      setEstimate(result);
      a.toast('Photo estimated. Check the foods and portions below before saving.');
      const profile = a.rows.find(r => r.entity === 'profiles');
      if (profile && !a.profile.aiConsent) await a.run(() => save(a.owner, 'profiles', { ...a.profile, aiConsent: true }, profile.id));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Photo AI is unavailable. Try again or search foods.');
    } finally { finish(); }
  };
  const prepare = async (file: File) => {
    if (!start('preparing')) return;
    try { await a.run(async () => { const prepared = await preparePhoto(file); resetPhotoReview(); setPhoto(prepared); setDraftId(undefined); }); }
    finally { finish(); }
  };
  const write = async (next: Activity, task: () => Promise<unknown>, message: string) => {
    if (!start(next)) return;
    try { await a.run(task, message); } finally { finish(); }
  };
  const storeDraft = () => write('draft', async () => {
    if (!photo) throw new Error('Choose a photo first.');
    const record = await save(a.owner, 'photo_metadata', { ...photo, description, date, analyzed: false }, draftId); setDraftId(record.id);
  }, 'Photo draft saved on this device. Analyze it when you’re online.');
  const commit = async () => {
    if (!start('saving')) return;
    try { await a.run(async () => {
    if (unresolved.length) throw new Error('Resolve or explicitly remove unmatched foods before saving.');
    if (!items.length || items.some(i => !Number.isFinite(i.grams) || i.grams <= 0 || i.grams > 5000)) throw new Error('Add foods with portions between 1 and 5,000 g.');
    if (items.some(item => !item.food.name.trim() || !Number.isFinite(item.food.kcal) || item.food.kcal < 0 || item.food.kcal > 1000))
      throw new Error('Enter a food name and valid calories before saving.');
    if (!date) throw new Error('Choose the meal date.');
    if (retain && photo) {
      if (!supabase || !a.owner.startsWith('user:')) throw new Error('Sign in before retaining a photo in private cloud storage, or turn retention off.');
      const bytes = Uint8Array.from(atob(photo.base64), c => c.charCodeAt(0));
      const path = `${a.owner.slice(5)}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('meal-photos').upload(path, bytes, { contentType: photo.mime, upsert: false });
      if (error) throw new Error('Photo retention failed. Turn it off to save the food entry without a cloud photo.');
    }
    const saved = await save(a.owner, 'meal_logs', { name: name.trim() || items.map(i => i.food.name).slice(0, 2).join(' & '), slot: mealSlot, date,
      timestamp: meal?.data.timestamp ?? new Date().toISOString(), timezone: a.profile.timezone, items, ...(estimate ? { photoEstimate: estimate } : {}) }, savedMealId.current);
    savedMealId.current = saved.id;
    if (draftId) { const draft = (await records(a.owner, 'photo_metadata')).find(r => r.id === draftId); if (draft) await remove(draft); }
    close();
    }, meal ? 'Meal updated.' : 'Meal saved. Your daily totals are updated.'); }
    finally { finish(); }
  };
  const draftRows = a.rows.filter(r => r.entity === 'photo_metadata');
  const activityTitle = activity === 'analyzing' ? 'Estimating your meal…' : activity === 'preparing' ? 'Preparing your photo…'
    : activity === 'draft' ? 'Saving your photo draft…' : activity === 'copying' ? 'Copying your meal…'
    : activity === 'deleting' ? 'Removing your meal…' : 'Saving your meal…';
  return <Modal title={meal ? 'Review your meal' : 'What’s on your plate?'} close={close} wide busy={busy}
    activity={busy ? <BusyIndicator kind={activity === 'analyzing' ? 'ai' : activity === 'preparing' ? 'photo' : 'save'} title={activityTitle}
      detail={activity === 'analyzing' ? 'Finding foods, portions and calories. You can review the estimate next.'
        : activity === 'preparing' ? 'Getting your image ready for review.'
        : activity === 'draft' ? 'Keeping this photo on your device.'
        : activity === 'saving' ? 'Saving this meal and updating your calories.'
        : 'Updating your diary and daily totals.'} /> : undefined}>
    <fieldset className="composer-fields" disabled={busy} aria-busy={busy}>
    <div className="tabs segmented-control" role="group" aria-label="Meal entry method">{modes.map(v => <button key={v} type="button" aria-pressed={mode === v} className={mode === v ? 'active' : ''} onClick={() => selectMode(v)}>{mode === v && <SegmentHighlight id={`${id}-selection`} />}{v === 'manual' ? <Search size={16} aria-hidden="true" /> : v === 'text' ? <Plus size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}<span>{v === 'manual' ? 'Search foods' : v === 'text' ? 'Type a meal' : 'Meal photo'}</span></button>)}</div>
    <SlidingContent activeKey={mode} direction={direction}>
    {mode === 'manual' && <><label className="search-field"><Search size={18} /><input aria-label="Search foods" placeholder="Rice, parippu, chicken curry…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="food-results">{matches.map(f => <button key={f.id} className="food-result" onClick={() => add(f)}><FoodMark food={f} /><span><strong>{f.name}</strong><small>{Math.round(f.kcal)} kcal / 100 g · {f.state}</small></span><Plus size={17} /></button>)}</div>{!matches.length && <p className="subtext">No match. Add a custom food from the Food screen, or select a familiar alternative.</p>}</>}
    {mode === 'text' && <><label>Describe your meal<textarea rows={3} placeholder="150 g cooked red rice, 100 g chicken curry, and 2 eggs" value={text} onChange={e => setText(e.target.value)} /></label><p className="fineprint">Works offline for known foods. Grams are best; cups and plates need a serving selection.</p><button className="btn secondary" disabled={!text.trim()} onClick={parse}><Plus size={16} />Review foods</button></>}
    {mode === 'photo' && <div className="photo-section">
      <ol className="photo-steps" aria-label="Photo meal steps"><li><span>1</span>Choose photo</li><li><span>2</span>Check foods</li><li><span>3</span>Save meal</li></ol>
      <p className="subtext">No sign-in needed. AI suggests foods and portions; you check them before saving.</p>
      {unavailable && (online && aiStatus === 'checking'
        ? <div className="photo-ai-check"><BusyIndicator kind="ai" title={unavailable} /></div>
        : <div className="notice" role="status">{unavailable}</div>)}
      <label className={`photo-picker ${activity === 'analyzing' ? 'photo-analyzing' : ''}`}>{photo ? <img src={`data:${photo.mime};base64,${photo.base64}`} alt="Your meal draft" /> : <><Camera size={30} /><strong>Take or choose a meal photo</strong><span>JPEG, PNG or WebP · up to 12 MB before resizing</span></>}<input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) void prepare(f); }} />{activity === 'analyzing' && <span className="photo-scan" aria-hidden="true"><i /></span>}</label>
      <label>Optional description<textarea disabled={busy} placeholder="For example: rice, chicken curry, extra coconut milk" value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label className="checkbox"><input type="checkbox" disabled={busy} checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Allow Google Gemini to analyze this photo and description. Free-tier content may be used to improve its products.</span></label>
      <p className="fineprint">Only this meal is shared. Your identity, health profile and diary are excluded.</p>
      <div className="button-row"><button className={`btn primary ${activity === 'analyzing' ? 'btn-busy' : ''}`} disabled={busy || !photo || !consent || Boolean(unavailable)} onClick={() => void analyze()}>{activity === 'analyzing' ? <BusyGlyph /> : <Sparkles size={16} />}{activity === 'analyzing' ? 'Estimating…' : estimate ? 'Estimate again' : 'Estimate calories'}</button><button className="btn secondary" disabled={!photo || busy} onClick={() => void storeDraft()}>{activity === 'draft' ? <BusyGlyph /> : <Save size={16} />}{activity === 'draft' ? 'Saving draft…' : 'Save offline draft'}</button></div>
      {aiError && <div className="warning" role="alert"><p>{aiError}</p><button className="btn secondary" onClick={() => selectMode('manual')}>Search foods instead</button></div>}
      <p className="fineprint">Photo calories are approximate. Oil, sauces and portion sizes can change the result.</p>
      {draftRows.length > 0 && <details className="details"><summary>Saved photo drafts ({draftRows.length})</summary>{draftRows.map(r => <div className="button-row" key={r.id}><button className="text-btn" disabled={busy} onClick={() => { resetPhotoReview(); const d = r.data as PhotoDraft; setPhoto({ mime: d.mime, base64: d.base64 }); setDescription(d.description); setDate(d.date); setDraftId(r.id); }}>Open {((r.data as PhotoDraft).description || 'meal draft').slice(0, 40)} · {(r.data as PhotoDraft).date}</button><button className="icon-btn" aria-label="Delete photo draft" onClick={() => void a.run(() => remove(r), 'Photo draft deleted.')}><Trash2 size={15} /></button></div>)}</details>}
      {estimate && <div className="estimate-box" role="region" aria-label="Photo estimate"><h3>Photo estimate: {Math.round(estimate.foods.reduce((sum, food) => sum + food.kcalMin, 0))}–{Math.round(estimate.foods.reduce((sum, food) => sum + food.kcalMax, 0))} kcal</h3><p>The foods are filled in below. Check their names, portions and calories before saving.</p><p>Known foods use their nutrition references. Other foods use editable AI estimates.</p><details><summary>What AI saw & why it may vary</summary><p className="fineprint">{estimate.uncertainty}</p>{estimate.foods.map((food, index) => <div key={index} className="ai-item"><strong>{food.name} · about {Math.round(food.grams)} g</strong><small>{Math.round(food.kcalMin)}–{Math.round(food.kcalMax)} kcal</small><p>{food.assumptions}</p></div>)}</details></div>}
      {photo && <details className="details"><summary>Photo storage options</summary><label className="checkbox"><input type="checkbox" checked={retain} onChange={e => setRetain(e.target.checked)} /><span>Keep a copy in my private cloud storage. Optional; requires sign-in and internet.</span></label></details>}
    </div>}
    </SlidingContent>
    {unresolved.length > 0 && <div className="warning"><strong>These foods need a choice</strong>{unresolved.map((row, i) => <div key={i}><p>“{row.text}” · {row.reason}</p><div className="button-row"><select aria-label={`Resolve ${row.text}`} defaultValue="" onChange={e => { const food = a.foods.find(x => x.id === e.target.value); if (food) { const id = crypto.randomUUID(); setItems(previous => [...previous, { id, food, grams: row.grams ?? 100 }]); if (row.source === 'photo') setAiItemIds(previous => [...previous, id]); setUnresolved(rows => rows.filter((_, j) => j !== i)); } }}><option value="">Choose food · then edit grams</option>{a.foods.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select><button className="icon-btn" aria-label={`Remove unmatched ${row.text}`} onClick={() => setUnresolved(rows => rows.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div></div>)}</div>}
    <div className="review-section"><h3>Your meal review <span className="badge">{Math.round(sum.kcal)} kcal</span></h3>{items.length === 0 && <p className="subtext">Add a food above to begin.</p>}
      {items.some(i => i.food.group === 'supplements') && <p className="subtext">Use dry powder grams. Water adds no calories; add milk and other shake ingredients as separate foods.</p>}
      {items.map(i => <div className="review-item" key={i.id}><FoodMark food={i.food} /><div className="review-food"><strong>{i.food.name}</strong><small>{i.food.uncertainty} · {Math.round(i.food.kcal * i.grams / 100)} kcal</small>{i.food.uncertainty === 'ai estimate' && <label>Food name<input aria-label={`Food name for ${i.food.name}`} value={i.food.name} onChange={event => setItems(rows => rows.map(row => row.id === i.id ? { ...row, food: { ...row.food, name: event.target.value } } : row))} /></label>}<details><summary>Nutrition source</summary><p className="fineprint">{i.food.source}</p>{i.food.instructions && <p className="fineprint">{i.food.instructions}</p>}</details></div><div className="portion"><label>Grams<input type="number" min="1" max="5000" step=".1" value={i.grams || ''} onChange={e => setItems(rows => rows.map(r => r.id === i.id ? { ...r, grams: +e.target.value } : r))} /></label>{i.food.uncertainty === 'ai estimate' && <label>Calories · kcal<input aria-label={`Calories for ${i.food.name}`} type="number" min="0" max="10000" step="1" value={Math.round(i.food.kcal * i.grams / 100)} onChange={event => { const calories = +event.target.value; if (i.grams > 0) setItems(rows => rows.map(row => row.id === i.id ? { ...row, food: { ...row.food, kcal: calories / row.grams * 100 } } : row)); }} /></label>}<select aria-label={`Serving for ${i.food.name}`} value="" onChange={e => { const grams = +e.target.value; if (grams) setItems(rows => rows.map(r => r.id === i.id ? { ...r, grams } : r)); }}><option value="">Use serving…</option>{i.food.servings.map((s, j) => <option value={s.grams} key={j}>{s.label} · {s.grams} g{s.approximate ? ' approx.' : ''}</option>)}</select></div><button className="icon-btn" aria-label={`Remove ${i.food.name}`} onClick={() => setItems(rows => rows.filter(r => r.id !== i.id))}><Trash2 size={16} /></button></div>)}
    </div>
    <div className="form-grid"><label>Meal name<input placeholder="e.g. Rice & curry" value={name} onChange={e => setName(e.target.value)} /></label><label>Meal<select value={mealSlot} onChange={e => setMealSlot(e.target.value as Meal['slot'])}>{['breakfast', 'lunch', 'dinner', 'snacks'].map(s => <option key={s} value={s}>{s}</option>)}</select></label><DatePicker value={date} onChange={setDate} timezone={a.profile.timezone} /><div className="macro-summary">{Math.round(sum.protein)} g protein · {Math.round(sum.carbs)} g carbs · {Math.round(sum.fat)} g fat</div></div>
    <div className="button-row composer-actions"><button className={`btn primary ${activity === 'saving' ? 'btn-busy' : ''}`} disabled={!items.length || busy || unresolved.length > 0} onClick={() => void commit()}>{activity === 'saving' ? <BusyGlyph /> : <Check size={17} />}{activity === 'saving' ? 'Saving meal…' : `Confirm & ${meal ? 'update' : 'save'} meal`}</button>{meal && <><button className="btn secondary" onClick={() => void write('copying', async () => {
      if (!date || !items.length || unresolved.length || items.some(i => !Number.isFinite(i.grams) || i.grams <= 0 || i.grams > 5000)) throw new Error('Choose a diary date, resolve foods and enter valid portions before copying.');
      await save(a.owner, 'meal_logs', { ...meal.data, name: name.trim() || meal.data.name, slot: mealSlot, date, timestamp: new Date().toISOString(), items: items.map(i => ({ ...i, id: crypto.randomUUID() })) }); close();
    }, 'Meal copied to the selected diary day.')}>{activity === 'copying' ? <BusyGlyph /> : <Plus size={16} />}{activity === 'copying' ? 'Copying meal…' : `Copy to ${date}`}</button><button className="btn danger" onClick={() => void write('deleting', async () => { await remove(meal); close(); }, 'Meal deleted. Restore it from the Food screen if needed.')}>{activity === 'deleting' ? <BusyGlyph /> : <Trash2 size={16} />}{activity === 'deleting' ? 'Removing meal…' : 'Delete'}</button></>}</div>
    </fieldset>
  </Modal>;
}
