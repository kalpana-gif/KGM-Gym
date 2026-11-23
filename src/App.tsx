import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flame, Plus, LayoutDashboard, Utensils, CalendarDays, Dumbbell, ChartNoAxesCombined, History as HistoryIcon, CircleUserRound, Cloud, CloudCheck, CloudUpload, CircleAlert, WifiOff, X } from 'lucide-react';
import { Context } from './context';
import { catalog } from './data/catalog';
import { conflicts, records } from './lib/db';
import { savedAccountOwner, supabase } from './lib/cloud';
import { useCloudSync } from './lib/useCloudSync';
import { authLinkError, readSignInRequest, storeSignInRequest } from './lib/account';
import { localDate } from './lib/calories';
import { initialProfile, type Conflict, type Food, type LocalRecord, type Meal, type Profile, type Target } from './types';
import Today from './pages/Today';
import FoodPage from './pages/Food';
import Plan from './pages/Plan';
import Workouts from './pages/Workouts';
import Progress from './pages/Progress';
import History from './pages/History';
import ProfileEditor from './components/ProfileEditor';
import AccountPanel from './components/AccountPanel';
import FoodComposer from './components/FoodComposer';
import DatePicker from './components/DatePicker';
import BusyIndicator from './components/BusyIndicator';
import DotSpinner from './components/DotSpinner';
import { PageTransition } from './components/motion';

const pages = [{ key:'today',label:'Today',icon:LayoutDashboard },{ key:'food',label:'Food',icon:Utensils },{ key:'history',label:'History',icon:HistoryIcon },{ key:'plan',label:'Meal plan',icon:CalendarDays },{ key:'workouts',label:'Workouts',icon:Dumbbell },{ key:'progress',label:'Progress',icon:ChartNoAxesCombined }];
const currentPage = () => pages.find(p=>`/${p.key}`===window.location.pathname)?.key ?? 'today';
// Retain the original storage key so existing diaries survive the KGM-FIT rename.
function getGuest() { const key='lankafit-guest'; let id=localStorage.getItem(key); if (!id) { id=`guest:${crypto.randomUUID()}`; localStorage.setItem(key,id); } return id; }

export default function App() {
  const reduce = useReducedMotion();
  const [guestOwner,setGuestOwner]=useState(getGuest);
  const [owner,setOwner]=useState(() => savedAccountOwner() ?? guestOwner);
  const rotateGuest=useCallback(()=>{
    const id=`guest:${crypto.randomUUID()}`;
    localStorage.setItem('lankafit-guest',id);setGuestOwner(id);setOwner(id);
  },[]);
  const ownerRef=useRef(owner); ownerRef.current=owner;
  const [snapshot,setSnapshot]=useState<{ owner:string; rows:LocalRecord[] }>({ owner,rows:[] });
  const [loading,setLoading]=useState(true); const [loadError,setLoadError]=useState('');
  const [page,setPage]=useState(currentPage);
  const [date,setDate]=useState(localDate());
  const [modal,setModal]=useState<'profile'|'account'|null>(null);
  const [authError,setAuthError]=useState(() => authLinkError(new URL(window.location.href)) ?? '');
  const [composer,setComposer]=useState<{ slot?:Meal['slot']; meal?:LocalRecord<Meal>; food?:Food; initialMode?:'manual'|'text'|'photo' }|null>(null);
  const mealFab=useRef<HTMLButtonElement>(null);
  const [notification,setNotification]=useState('');
  const [pendingTasks,setPendingTasks]=useState(0);
  const [online,setOnline]=useState(navigator.onLine);
  const [authReady,setAuthReady]=useState(() => !supabase || Boolean(savedAccountOwner()));
  const [authRevision,setAuthRevision]=useState(0);
  const { syncState, syncNow } = useCloudSync(owner, guestOwner, authRevision);
  const [conflictRows,setConflictRows]=useState<Conflict[]>([]);
  useEffect(()=>{
    setComposer(null);setConflictRows([]);
    if(owner.startsWith('user:') && readSignInRequest()){
      storeSignInRequest(null);setAuthError('');setModal('account');
    } else setModal(null);
  },[owner]);
  useEffect(()=>{
    if(!authError)return;
    const url=new URL(window.location.href);
    for(const key of ['error','error_code','error_description'])url.searchParams.delete(key);
    const hash=new URLSearchParams(url.hash.slice(1));
    for(const key of ['error','error_code','error_description'])hash.delete(key);
    url.hash=hash.toString();
    window.history.replaceState({},'',url.pathname+url.search+url.hash);
    setModal('account');
  },[authError]);
  const toast=useCallback((s:string)=>setNotification(s),[]);
  const run=useCallback(async(task:()=>Promise<unknown>,message?:string)=>{
    setPendingTasks(count=>count+1);
    try { await task(); if(message) toast(message); } catch(error) { toast(error instanceof Error?error.message:'Something went wrong. Please try again.'); }
    finally { setPendingTasks(count=>count-1); }
  },[toast]);
  const refresh=useCallback(async()=>{
    const requested=owner;
    try {
      const [rows,conflictData]=await Promise.all([records(requested),conflicts(requested)]);
      if(ownerRef.current!==requested)return;
      setSnapshot({ owner:requested,rows });setConflictRows(conflictData);setLoading(false);setLoadError('');
    } catch { if(ownerRef.current===requested){ setLoading(false);setLoadError('Local storage could not open. Enable site storage or leave private browsing, then reload.'); } }
  },[owner]);
  useEffect(()=>{
    setLoading(true);setConflictRows([]);void refresh();
    let timeout:number|undefined;
    const update=()=>{ window.clearTimeout(timeout);timeout=window.setTimeout(()=>void refresh(),30); };
    window.addEventListener('lankafit-data',update);
    return()=>{window.removeEventListener('lankafit-data',update);window.clearTimeout(timeout);};
  },[refresh]);
  useEffect(()=>{
    if(!supabase)return;
    let active = true;
    let revision = 0;
    let restoring = false;
    let restoreAgain = false;
    let retryTimer: number | undefined;
    let failures = 0;
    const scheduleRestore = (delay: number) => {
      window.clearTimeout(retryTimer);
      if(active) retryTimer = window.setTimeout(() => { void restore(); }, delay);
    };
    const restore = async () => {
      if(!active)return;
      if(restoring) { restoreAgain = true;return; }
      restoring = true;
      const requestedRevision = revision;
      try {
        const { data, error } = await supabase!.auth.getSession();
        if(!active || requestedRevision !== revision)return;
        if(error)throw error;
        if(data.session) {
          setOwner(`user:${data.session.user.id}`);setAuthError('');
          setAuthRevision(value=>value+1);
        } else if(savedAccountOwner()) {
          // An expired session can remain in storage while a temporary
          // refresh failure makes getSession/INITIAL_SESSION return null.
          throw new Error('Session restoration pending');
        } else setOwner(getGuest());
        failures = 0;
      } catch {
        if(active && requestedRevision === revision) {
          failures++;
          scheduleRestore(Math.min(5000 * 2 ** (failures - 1),60000));
        }
      } finally {
        restoring = false;
        if(active) {
          setAuthReady(true);
          if(restoreAgain) { restoreAgain=false;scheduleRestore(0); }
        }
      }
    };
    const { data:{ subscription } }=supabase.auth.onAuthStateChange((event,session)=>{
      if(!active)return;
      revision++;
      window.clearTimeout(retryTimer);
      // Switch to a fresh guest diary inside the event, before signOut()
      // resolves or a navigation can reopen the previously imported diary.
      if(event === 'SIGNED_OUT') rotateGuest();
      else if(session) { setOwner(`user:${session.user.id}`);setAuthError('');failures=0; }
      else {
        const saved = savedAccountOwner();
        setOwner(saved ?? getGuest());
        if(saved)scheduleRestore(0);
      }
      setAuthReady(true);
      if(event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setAuthRevision(value=>value+1);
      if(event === 'SIGNED_OUT' || (session && ownerRef.current !== `user:${session.user.id}`)) setComposer(null);
    });
    const resume = () => { if(navigator.onLine) scheduleRestore(0); };
    const visible = () => { if(document.visibilityState === 'visible')resume(); };
    scheduleRestore(0);
    window.addEventListener('online',resume);window.addEventListener('focus',resume);
    document.addEventListener('visibilitychange',visible);
    return()=>{
      active=false;window.clearTimeout(retryTimer);subscription.unsubscribe();
      window.removeEventListener('online',resume);window.removeEventListener('focus',resume);
      document.removeEventListener('visibilitychange',visible);
    };
  },[rotateGuest]);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);
    window.addEventListener('online',update);window.addEventListener('offline',update);
    const navigate=()=>setPage(currentPage());window.addEventListener('popstate',navigate);
    return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener('popstate',navigate);};
  },[]);
  useEffect(()=>{ if(!notification)return;const timer=window.setTimeout(()=>setNotification(''),7000);return()=>window.clearTimeout(timer);},[notification]);
  const rows=snapshot.owner===owner?snapshot.rows:[];
  const profile=useMemo(()=> (rows.filter(r=>r.entity==='profiles').sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt))[0]?.data as Profile|undefined)??initialProfile,[rows]);
  const target=useMemo(()=> rows.filter(r=>r.entity==='daily_targets'&&(r.data as Target).date<=date).sort((x,y)=>(y.data as Target).date.localeCompare((x.data as Target).date)||y.modifiedAt.localeCompare(x.modifiedAt))[0]?.data as Target|undefined,[rows,date]);
  const foods=useMemo(()=> [...catalog,...rows.filter(r=>r.entity==='custom_foods'||r.entity==='recipes').map(r=>r.data as Food)],[rows]);
  const navigate=(key:string)=>{setPage(key);window.history.pushState({},'',key==='today'?'/':`/${key}`);window.scrollTo({top:0,behavior:reduce?'instant':'smooth'});};
  const openFood=(slot?:Meal['slot'],meal?:LocalRecord<Meal>,food?:Food)=>{
    if(!meal){setComposer({slot,food});return;}
    const requestedOwner=owner;
    void run(async()=>{
      const latest=(await records<Meal>(requestedOwner,'meal_logs')).find(row=>row.id===meal.id);
      if(ownerRef.current!==requestedOwner)return;
      if(!latest)throw new Error('This meal was removed. Refresh your diary to see the latest entries.');
      setComposer({slot,meal:latest,food});
    });
  };
  const connected = owner.startsWith('user:');
  const syncBusy = syncState.status === 'checking' || syncState.status === 'syncing';
  const syncIssue = syncState.status === 'error' || syncState.status === 'conflict';
  const statusLabel=pendingTasks>0 ? 'Updating your space…' : connected ? syncIssue ? 'Cloud sync needs attention' : !online ? 'Offline · sync waiting'
    : syncBusy ? 'Syncing to Supabase…' : syncState.status === 'synced' ? 'Synced to Supabase' : 'Checking cloud sync'
    : online?'Saved on device':'Offline mode';
  const StatusIcon = !online ? WifiOff : syncIssue ? CircleAlert : syncState.status === 'synced' ? CloudCheck : CloudUpload;
  const content=page==='food'?<FoodPage/>:page==='history'?<History/>:page==='plan'?<Plan/>:page==='workouts'?<Workouts/>:page==='progress'?<Progress/>:<Today/>;
  return <Context.Provider value={{owner,rows,profile,date,setDate,target,foods,toast,run,working:pendingTasks>0,openProfile:()=>setModal('profile'),openAccount:()=>setModal('account'),openFood,navigate,conflicts:conflictRows,syncState,syncNow}}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-body">
          <a className="brand" href="/" onClick={e=>{e.preventDefault();navigate('today');}}><span><Flame size={24}/></span>KGM<span className="brand-fit">-FIT</span><small>YOUR EVERYDAY COMPANION</small></a>
          <div className="nav-label">YOUR SPACE</div>
          <nav aria-label="Main navigation">{pages.map(p=><motion.button key={p.key} aria-current={page===p.key?'page':undefined} className={page===p.key?'active':''} whileTap={reduce?undefined:{scale:.98}} onClick={()=>navigate(p.key)}>{page===p.key&&<motion.span aria-hidden="true" className="nav-highlight" layoutId="desktop-nav" transition={{type:'spring',stiffness:420,damping:36,duration:reduce?0:undefined}}/>}<p.icon size={20}/><span>{p.label}</span>{page===p.key&&<i/>}</motion.button>)}</nav>
        </div>
        <div className="sidebar-note"><Flame size={24}/><h3>A little better,<br/>every day.</h3><p>You don’t have to change everything to change something.</p><div className="palette-dots" aria-hidden="true"><i/><i/><i/><i/></div></div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a className="mobile-brand" href="/" onClick={e=>{e.preventDefault();navigate('today');}}><Flame size={22}/>KGM-FIT</a>
          <div className="breadcrumb">My space <span>/</span> <strong>{pages.find(p=>p.key===page)?.label}</strong></div>
          <div className="top-actions">
            <span className={`connection ${online?'':'offline'} ${syncIssue?'sync-error':''}`} title={pendingTasks>0?statusLabel:connected?syncState.message:statusLabel} aria-label={statusLabel} role={pendingTasks>0?'status':undefined}>{pendingTasks>0 ? <DotSpinner compact/> : connected || !online ? (syncBusy&&connected&&online ? <DotSpinner compact/> : <StatusIcon size={15}/>) : <span className="status-dot"/>}<span className="connection-label">{statusLabel}</span></span>
            <div className="header-profile" role="group" aria-label="Your account">
              <button className="header-account" aria-label="Account and data" title="Account and data" onClick={()=>setModal('account')}>
                <span className="avatar" aria-hidden="true">KG</span>
                <span className="header-account-copy"><strong>My journey</strong><small>{connected?'Connected account':'Device-only guest'}</small></span>
                <Cloud size={16} aria-hidden="true"/>
              </button>
              <button className="icon-btn header-profile-settings" aria-label="Your profile" title="Your profile" onClick={()=>setModal('profile')}><CircleUserRound size={20} aria-hidden="true"/></button>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}><DatePicker value={date} onChange={setDate} timezone={profile.timezone} navigation />
          {loadError?<div className="warning">{loadError}</div>:loading||!authReady?<div className="loading"><BusyIndicator title="Opening your space…" detail="Getting your diary ready." /></div>:<PageTransition key={`${owner}:${page}`}>{content}</PageTransition>}
          <footer className="page-footer"><span><Flame size={14}/>KGM-FIT</span><p>Small steps. Lasting change.</p><button className="text-btn" onClick={()=>setModal('account')}>Privacy & your data</button></footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">{pages.map(p=><motion.button key={p.key} aria-current={page===p.key?'page':undefined} className={page===p.key?'active':''} whileTap={reduce?undefined:{scale:.94}} onClick={()=>navigate(p.key)}>{page===p.key&&<motion.span aria-hidden="true" className="nav-highlight" layoutId="mobile-nav" transition={{type:'spring',stiffness:420,damping:36,duration:reduce?0:undefined}}/>}<p.icon size={20}/><span>{p.key==='plan'?'Plan':p.label}</span></motion.button>)}</nav>
    </div>
    {!composer&&!modal&&!loading&&authReady&&!loadError&&<motion.button ref={mealFab} type="button" className="meal-fab" aria-label="Add meal from photo" title="Take a photo and estimate meal calories" whileTap={reduce?undefined:{scale:.95}} onClick={()=>setComposer({initialMode:'photo'})}>
      <Plus size={30} strokeWidth={2} aria-hidden="true"/>
    </motion.button>}
    {pendingTasks>0&&!composer&&!modal&&<div className="app-activity"><BusyIndicator title="Updating your space…" detail="Finishing your changes." /></div>}
    {composer&&<FoodComposer {...composer} close={()=>{setComposer(null);if(composer.initialMode==='photo')requestAnimationFrame(()=>mealFab.current?.focus({preventScroll:true}));}}/>}
    {modal==='profile'&&<ProfileEditor close={()=>setModal(null)}/>}
    {modal==='account'&&<AccountPanel close={()=>{setModal(null);setAuthError('');}} guestOwner={guestOwner} rotateGuest={rotateGuest} authError={authError}/>}
    <div className="toast-anchor"><AnimatePresence>{notification&&<motion.div key={notification} className="toast" role="status"
      initial={reduce?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduce?0:6}} transition={{duration:reduce?0:.18}}
    ><span>{notification}</span><button className="icon-btn" aria-label="Dismiss message" onClick={()=>setNotification('')}><X size={16}/></button></motion.div>}</AnimatePresence></div>
  </Context.Provider>;
}
