import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Cloud, Download, LogOut, Trash2, RefreshCw, Mail, Check, ShieldCheck, Smartphone, ArrowUpRight, LoaderCircle, CloudUpload, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context';
import { Modal } from './ui';
import { authenticatedRequest, cloudConfigured, supabase, sync } from '../lib/cloud';
import { clearOwner, conflicts, dismissConflict, importOwner, pending, records, save } from '../lib/db';
import { inboxLink, readSignInRequest, signInError, storeSignInRequest, type SignInRequest } from '../lib/account';
import { total } from '../lib/calories';
import type { Meal } from '../types';

export default function AccountPanel({ close, guestOwner, rotateGuest, authError = '' }: { close: () => void; guestOwner: string; rotateGuest: () => void; authError?: string }) {
  const a = useApp();
  const reduce = useReducedMotion();
  const [request,setRequest] = useState<SignInRequest | null>(() => authError ? null : readSignInRequest());
  const [email,setEmail] = useState(() => readSignInRequest()?.email ?? '');
  const [error,setError] = useState(authError);
  const [sending,setSending] = useState(false);
  const [retryAt,setRetryAt] = useState(() => readSignInRequest()?.retryAt ?? 0);
  const [now,setNow] = useState(Date.now);
  const [confirmation,setConfirmation] = useState('');
  const [accountEmail,setAccountEmail] = useState('');
  const [guestCount,setGuestCount] = useState(0);
  const [queued,setQueued] = useState<number | null>(null);
  const [cloudState,setCloudState] = useState<'idle'|'busy'|'done'|'error'>('idle');
  const [cloudMessage,setCloudMessage] = useState('');
  const sendingRef = useRef(false);
  const cloudBusyRef = useRef(false);
  const emailStepRef = useRef<HTMLHeadingElement>(null);
  const loggedIn = a.owner.startsWith('user:');
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const mailbox = inboxLink(request?.email ?? email);
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= retryAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    if (request) emailStepRef.current?.focus();
  }, [request]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const [guestRows, accountRows, ops] = await Promise.all([
        records(guestOwner), loggedIn ? records(a.owner, undefined, true) : Promise.resolve([]),
        loggedIn ? pending(a.owner) : Promise.resolve([]),
      ]);
      if (!active) return;
      const existing = new Set(accountRows.map(row => row.id));
      setGuestCount(guestRows.filter(row => row.entity !== 'photo_metadata' && !existing.has(row.id)).length);
      setQueued(ops.length);
    };
    void refresh().catch(() => { if (active) setError('Couldn’t read the local backup status. Try reopening this screen.'); });
    const onChange = () => { void refresh().catch(() => { if (active) setError('Couldn’t read the local backup status. Try reopening this screen.'); }); };
    window.addEventListener('lankafit-data', onChange);
    if (loggedIn) void supabase?.auth.getSession().then(({ data }) => {
      if (active) setAccountEmail(data.session?.user.email ?? '');
    });
    return () => { active = false; window.removeEventListener('lankafit-data', onChange); };
  }, [a.owner, guestOwner, loggedIn]);
  const sendLink = async () => {
    if (sendingRef.current || Date.now() < retryAt || !supabase) return;
    if (!navigator.onLine) {
      setError('You’re offline. Connect to the internet to receive a sign-in link. Your diary still works here.');
      return;
    }
    sendingRef.current = true; setSending(true); setError('');
    try {
      const address = email.trim();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: address, options: { emailRedirectTo: window.location.origin },
      });
      if (sendError) throw sendError;
      const sentAt = Date.now();
      const next = { email: address, sentAt, retryAt: sentAt + 60000 };
      storeSignInRequest(next); setRequest(next); setRetryAt(next.retryAt); setNow(sentAt);
    } catch (sendError) {
      if ((sendError as { status?: number }).status === 429) {
        const time = Date.now(); setRetryAt(time + 60000); setNow(time);
      }
      setError(signInError(sendError));
    } finally { sendingRef.current = false; setSending(false); }
  };
  const syncDiary = async (includeGuest = false) => {
    if (cloudBusyRef.current) return;
    cloudBusyRef.current = true; setCloudState('busy'); setCloudMessage('');
    try {
      if (!navigator.onLine) throw new Error('You’re offline. Your changes are saved here; reconnect to back them up.');
      if (includeGuest) await importOwner(guestOwner, a.owner);
      const result = await sync(a.owner);
      const [ops, review, conflictRows] = await Promise.all([pending(a.owner), records(a.owner, undefined, true), conflicts(a.owner)]);
      setQueued(ops.length);
      const remainingGuest = (await records(guestOwner)).filter(row => row.entity !== 'photo_metadata' && !review.some(existing => existing.id === row.id)).length;
      setGuestCount(remainingGuest);
      if (ops.length || result !== 'All changes synced' || conflictRows.length) {
        setCloudState('idle'); setCloudMessage(conflictRows.length
          ? 'Review the conflicting edits below before completing your backup.'
          : 'Backup is still in progress. Your diary is saved on this device; check again in a moment.');
      } else {
        setCloudState('done');
        setCloudMessage(includeGuest ? 'Your device diary is now backed up to your account.' : 'Your diary is up to date across devices.');
      }
    } catch {
      setCloudState('error');
      setCloudMessage('Backup couldn’t finish. Your diary is saved on this device. Check your connection and try Sync now again.');
    } finally { cloudBusyRef.current = false; }
  };
  const download = (name: string, content: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([content],{ type:mime }));
    const el = document.createElement('a'); el.href=url; el.download=name; el.click(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  return <Modal title={loggedIn ? 'Your account & data' : 'Save your progress'} close={close}>
    <div className="account-flow">
      <div className="account-status"><span className="account-symbol">{loggedIn ? <ShieldCheck size={25}/> : <Smartphone size={25}/>}</span><div><strong>{loggedIn ? 'Your account is connected' : 'Your diary is safe on this device'}</strong><p>{loggedIn ? accountEmail || 'Private cloud backup is available.' : 'Sign in to keep it with you across devices.'}</p></div><span className="account-badge">{loggedIn ? 'Connected' : 'Guest'}</span></div>
      {!loggedIn && cloudConfigured && <>
        <ol className="account-steps" aria-label="Connect your account">
          {['Your email', 'Open the link', 'Back up diary'].map((label,index) => <li key={label} className={index === (request ? 1 : 0) ? 'current' : index === 0 && request ? 'complete' : ''} aria-current={index === (request ? 1 : 0) ? 'step' : undefined}><span>{index === 0 && request ? <Check size={13}/> : index + 1}</span>{label}</li>)}
        </ol>
        <AnimatePresence mode="wait" initial={false}>
          <motion.section key={request ? 'email-sent' : 'email-form'} className="account-connect" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .16 }} onAnimationComplete={() => { if (request) emailStepRef.current?.focus(); }}>
            {request ? <>
              <span className="account-mail-art" aria-hidden="true"><Mail size={32}/><span><Check size={14}/></span></span>
              <h3 ref={emailStepRef} tabIndex={-1}>Check your email</h3>
              <p>We sent a sign-in link to <strong className="account-email">{request.email}</strong></p>
              <div className="account-email-guide"><span>1</span><p>Open the newest email from <strong>Supabase Auth</strong>.</p><span>2</span><p>Tap <strong>Confirm email address</strong> or the sign-in link. KGM-FIT will open with your account connected.</p></div>
              <p className="fineprint">Use this browser so your device diary is ready to back up. Check Spam or Junk if the email hasn’t arrived.</p>
              {mailbox && <a className="btn primary full" href={mailbox.url} target="_blank" rel="noopener noreferrer"><Mail size={17}/>{mailbox.label}<ArrowUpRight size={17}/></a>}
              <div className="account-resend"><button className="text-btn" disabled={sending || remaining > 0} onClick={() => void sendLink()}>{sending ? 'Sending…' : remaining ? `Resend in ${remaining}s` : 'Send a new link'}</button><button className="text-btn" disabled={sending} onClick={() => { setRequest(null); setError(''); storeSignInRequest(null); }}>Use a different email</button></div>
            </> : <>
              <h3>A small step. A safer diary.</h3><p>Keep your meals, workouts and progress together. Sign in or create an account with your email.</p>
              <form onSubmit={e => { e.preventDefault(); void sendLink(); }}>
                <label>Email address<input type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={sending} aria-describedby="account-email-help"/></label>
                <p id="account-email-help" className="fineprint">We’ll email you a secure sign-in link. No password to remember.</p>
                <button className="btn primary full" disabled={sending || remaining > 0}>{sending ? <LoaderCircle size={17} className="account-spinner"/> : <Mail size={17}/>} {sending ? 'Sending your link…' : remaining ? `Try again in ${remaining}s` : 'Continue with email'}</button>
              </form>
            </>}
            {error && <p className="account-error" role="alert">{error}</p>}
          </motion.section>
        </AnimatePresence>
        <div className="account-trust"><ShieldCheck size={15}/><span>Your diary is private. You choose when to back up existing entries.</span></div>
      </>}
      {!cloudConfigured && <div className="notice"><strong>Cloud backup isn’t available yet.</strong><p>You can keep using your diary on this device and download a backup below.</p></div>}
      {loggedIn && <>
        {guestCount > 0 && <section className="account-import"><CloudUpload size={25}/><div><h3>Bring your device diary along</h3><p>{guestCount} saved {guestCount === 1 ? 'entry is' : 'entries are'} ready to add to your account. Existing account entries stay in place.</p></div><button className="btn primary full" disabled={cloudState === 'busy'} onClick={() => void syncDiary(true)}>{cloudState === 'busy' ? <LoaderCircle size={17} className="account-spinner"/> : <CloudUpload size={17}/>}Back up my device diary</button></section>}
        <section className="account-sync"><div><Cloud size={22}/><div><h3>Cloud backup</h3><p>{queued === null ? 'Checking your diary…' : queued > 0 ? `${queued} ${queued === 1 ? 'change waiting' : 'changes waiting'} to back up` : 'New entries back up automatically when online.'}</p></div></div><button className="btn secondary full" disabled={cloudState === 'busy'} onClick={() => void syncDiary()}><RefreshCw size={17} className={cloudState === 'busy' ? 'account-spinner' : undefined}/>{cloudState === 'busy' ? 'Backing up…' : 'Sync now'}</button>
          {cloudMessage && <p className={`account-sync-message ${cloudState}`} role={cloudState === 'error' ? 'alert' : 'status'}>{cloudState === 'done' && <CheckCircle2 size={17}/>} {cloudMessage}</p>}
        </section>
        <button className="text-btn account-signout" disabled={cloudState === 'busy'} onClick={() => void a.run(async () => {
          const { error: signOutError } = await supabase!.auth.signOut({ scope:'local' });
          if (signOutError) throw signOutError;
          rotateGuest(); close();
        },'Signed out. Unsynced entries will resume when you sign in to this account again.')}><LogOut size={16}/>Sign out</button>
        {error && <p className="account-error" role="alert">{error}</p>}
      </>}
      {!loggedIn && <button className="text-btn account-guest" onClick={close}>Continue on this device</button>}
    </div>
    {a.conflicts.length > 0 && <div className="warning"><h3>Conflicting edits need review</h3><p>The server version is active. Your local version is preserved below.</p>{a.conflicts.map(c => <div key={c.id}><p>{c.record.entity} · {c.record.modifiedAt}</p><details><summary>Compare versions</summary><p>Local: {JSON.stringify(c.record.data)}</p><p>Server: {JSON.stringify(c.remote.data)}</p></details><div className="button-row"><button className="btn secondary" onClick={() => void a.run(async () => { await save(a.owner,c.record.entity,c.record.data,c.record.id,c.record.deleted); await dismissConflict(c.id); },'Your local version is queued as a new change.')} >Restore my local edit</button><button className="text-btn" onClick={() => void a.run(() => dismissConflict(c.id),'Server version kept.')} >Keep server version</button></div></div>)}</div>}
    <details className="details account-downloads"><summary><span><Download size={18}/>Download a backup</span></summary><p>Keep a copy of your diary or open your meal history in a spreadsheet.</p><div className="button-row"><button className="btn secondary" onClick={() => void a.run(async () => { const all = await records(a.owner,undefined,true); download('kgm-fit-export.json',JSON.stringify({ version:1,exportedAt:new Date().toISOString(),records:all },null,2),'application/json'); })}><Download size={16} />Export JSON</button><button className="btn secondary" onClick={() => {
      const escape = (s: unknown) => `"${String(s).replace(/"/g,'""')}"`;
      const rows = a.rows.filter(r => r.entity === 'meal_logs').map(r => { const m=r.data as Meal; const n=total(m.items); return [m.date,m.slot,m.name,n.kcal.toFixed(1),n.protein.toFixed(1),n.carbs.toFixed(1),n.fat.toFixed(1)].map(escape).join(','); });
      download('kgm-fit-meals.csv',['date,meal,name,kcal,protein_g,carbs_g,fat_g',...rows].join('\n'),'text/csv');
    }}><Download size={16} />Export meals CSV</button></div>
    <p className="fineprint">Clearing browser storage can remove device entries. JSON backups may include local photo drafts; keep your downloaded files private.</p></details>
    {loggedIn && <details className="details"><summary>Manage cloud photos</summary><p>Remove any meal photos you chose to retain in your account.</p><button className="btn danger full" onClick={() => void a.run(async () => {
      while (true) {
        const { data,error }=await supabase!.storage.from('meal-photos').list(a.owner.slice(5),{ limit:100 });
        if (error) throw error; if (!data?.length) break;
        const { error: removeError }=await supabase!.storage.from('meal-photos').remove(data.map(f=>`${a.owner.slice(5)}/${f.name}`));
        if (removeError) throw removeError;
      }
    },'All retained cloud meal photos were deleted.')}><Trash2 size={16} />Delete retained cloud photos</button></details>}
    <details className="details"><summary>Delete {loggedIn ? 'account and all data' : 'this guest diary'}</summary><p>This removes {loggedIn ? 'your account, cloud records, retained cloud photos and this account’s local cache' : 'this guest diary, drafts and local records'}. Export anything you want to keep first.</p><label>Type DELETE to confirm<input value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button className="btn danger full" disabled={confirmation !== 'DELETE'} onClick={() => void a.run(async () => {
      if (loggedIn) { await authenticatedRequest('/api/delete-account',{ confirm:'DELETE' }); await supabase!.auth.signOut({ scope:'local' }); }
      await clearOwner(a.owner); rotateGuest(); close();
    }, 'Data deletion completed.')}><Trash2 size={16} />Permanently delete</button></details>
  </Modal>;
}
