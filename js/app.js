// ============================================================
//  APP — Orquestador: auth, navegación, estado y acciones.
//  Las vistas (js/views/*) leen App.cache y llaman a estas acciones.
// ============================================================
const App = (() => {
  const $ = UI.$;
  const cache = { exercises:[], sets:[], legacyWeights:[], legacyMeasures:[], weights:[], measurements:[], foodLogs:[], photos:[], foods:[],
                  sleep:[], wellness:[], habits:[], habitLogs:[], injuries:[], goals:[], cardio:[], rehab:[],
                  recipes:[], supplements:[], supplementLogs:[], mesocycles:[], sessionsMeta:[], profile:null, salud:null };
  let currentTab = 'hoy', draft = null, lastRefresh = 0, lastDay = Logic.todayISO(), installEvt = null;

  // ---------- Datos derivados ----------
  function derive(){
    const med = cache.salud?.med || [];
    cache.weights = Logic.mergeWeights(cache.legacyWeights, med);
    cache.measurements = Logic.mergeMeasures(cache.legacyMeasures, med);
  }
  // Mi Salud manda en edad, estatura, sexo y meta de peso
  function profileView(){
    const p = cache.profile || {}, s = cache.salud?.perfil || {}, m = cache.salud?.metas || {};
    return { ...p, edad:Evidence.ageFrom(s.nacimiento) ?? p.edad, estatura_cm:s.estatura_cm ?? p.estatura_cm, sexo:s.sexo ?? p.sexo ?? 'h',
      peso_objetivo_kg:m.peso ?? p.peso_objetivo_kg };
  }
  function ctx(){
    const profile = profileView(), lastWeightRow = cache.weights[cache.weights.length-1] || null, lastWeight = lastWeightRow ? Number(lastWeightRow.peso_kg) : null;
    const latest = Logic.latestMeasures(cache.measurements), medidas = {};
    Object.keys(latest).forEach(k => medidas[k] = latest[k].valor_cm);
    const routines = Logic.routinesOf(cache.exercises);
    return { profile, lastWeight, lastWeightRow, medidas, routines, nextRoutine:Logic.nextDay(cache.sets, routines),
      targets:Logic.effectiveTargets(profile, lastWeight, medidas), fat:Logic.bestBodyFat(profile, lastWeight, cache.measurements),
      sessions:Logic.sessionsList(cache.sets), fcReposo:Number(Logic.saludLatest(cache.salud,'fc')?.valor)||null,
      goalCtx:{ lastWeight, measurements:cache.measurements, sets:cache.sets } };
  }
  const dismissed = () => { try { return JSON.parse(localStorage.getItem('kratos-dismissed')||'{}'); } catch { return {}; } };
  function alerts(){
    const c = ctx(), d = dismissed();
    return Logic.buildAlerts({ ...cache, profile:c.profile, lastWeight:c.lastWeight, medidas:c.medidas }).filter(a => !d[a.id]);
  }
  function dismissAlert(id){
    const d = dismissed(), cutoff = Logic.isoDaysAgo(30);
    Object.keys(d).forEach(k => { if (d[k] < cutoff) delete d[k]; });
    d[id] = Logic.todayISO();
    try { localStorage.setItem('kratos-dismissed', JSON.stringify(d)); } catch {}
    render();
  }

  // ---------- Carga ----------
  // Una tabla que falla conserva lo que había: nunca reemplaza datos buenos por vacío.
  async function loadAll(){
    const load = (key, fn) => fn().then(v => { cache[key] = v; });
    const results = await Promise.allSettled([
      load('profile',DB.getProfile), load('exercises',DB.getExercises), load('sets',DB.getAllSets),
      load('legacyWeights',DB.getWeights), load('legacyMeasures',DB.getMeasurements), load('foodLogs',DB.getFoodLogs),
      load('foods',DB.getFoods), load('sleep',DB.getSleep), load('wellness',DB.getWellness), load('habits',DB.getHabits),
      load('habitLogs',DB.getHabitLogs), load('injuries',DB.getInjuries), load('goals',DB.getGoals), load('cardio',DB.getCardio),
      load('rehab',DB.getRehab), load('recipes',DB.getRecipes), load('supplements',DB.getSupplements),
      load('supplementLogs',DB.getSupplementLogs), load('mesocycles',DB.getMesocycles), load('sessionsMeta',DB.getWorkoutSessions),
      load('salud',DB.getSalud),
    ]);
    if (results.slice(0,3).some(r => r.status==='rejected')) throw new Error('offline');
    derive();
    DB.getPhotos().then(p => { cache.photos = p; if (currentTab==='cuerpo' && !busy()) render(); }).catch(()=>{});
  }
  async function ensureSeed(){
    if (!cache.exercises.length) { await DB.bulkInsertExercises(SEED_EXERCISES.map(e=>({...e}))); cache.exercises = await DB.getExercises(); }
    if (!cache.profile) { await DB.saveProfile({ ...SEED_PROFILE }); cache.profile = await DB.getProfile(); }
  }
  // Recarga al volver a la app: mantiene avisos y datos de Mi Salud al día
  const busy = () => draft || UI.sheetOpen() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
  async function refresh(force){
    if (!DB.uid() || !navigator.onLine) return;
    if (!force && Date.now()-lastRefresh < 60000) return;
    lastRefresh = Date.now();
    try {
      if (Offline.pending()) await Offline.flush(DB);
      await loadAll(); Offline.saveCache(cache);
      if (!busy()) render();
    } catch {}
  }
  function checkDay(){ const t = Logic.todayISO(); if (t!==lastDay){ lastDay=t; if(!busy()) render(); refresh(true); } }

  // ---------- Escritura con respaldo offline ----------
  async function tryWrite(kind, dbCall, payload, applyLocal){
    try { await dbCall(); return true; }
    catch (e) {
      if (Offline.isOfflineError(e)) {
        Offline.enqueue({ kind, payload }); applyLocal && applyLocal(); derive(); Offline.saveCache(cache);
        UI.toast('📴 Guardado sin conexión · se sincroniza después');
        return false;
      }
      UI.toast('Error: ' + (e.message || 'no se pudo guardar'));
      throw e;
    }
  }
  // Ejecuta, recarga lo indicado y vuelve a dibujar (los avisos se recalculan solos)
  async function act(fn, reload, msg){
    try { await fn(); await reload?.(); derive(); Offline.saveCache(cache); if (msg) UI.toast(msg); }
    catch(e){ UI.toast(Offline.isOfflineError(e) ? '📴 Necesitas conexión para esto' : 'Error: '+(e.message||'no se pudo guardar')); }
    render();
  }
  const reload = (...keys) => async () => { const map = { exercises:DB.getExercises, sets:DB.getAllSets, foodLogs:DB.getFoodLogs, foods:DB.getFoods, sleep:DB.getSleep, wellness:DB.getWellness,
      habits:DB.getHabits, habitLogs:DB.getHabitLogs, injuries:DB.getInjuries, goals:DB.getGoals, cardio:DB.getCardio, rehab:DB.getRehab, recipes:DB.getRecipes,
      supplements:DB.getSupplements, supplementLogs:DB.getSupplementLogs, mesocycles:DB.getMesocycles, photos:DB.getPhotos, profile:DB.getProfile, salud:DB.getSalud,
      legacyWeights:DB.getWeights, legacyMeasures:DB.getMeasurements, sessionsMeta:DB.getWorkoutSessions };
    await Promise.all(keys.map(async k => { cache[k] = await map[k](); })); };

  // Medición en Mi Salud; si no hay señal se aplica localmente y queda en cola
  async function saveMedicion(m, msg){
    const ok = await tryWrite('medicion', ()=>DB.addMedicion({ ...m }), { ...m }, ()=>{
      if (cache.salud) cache.salud.med.push({ ...m, id:null, origen:'manual', created_at:new Date().toISOString() }); });
    if (ok) { await reload('salud')().catch(()=>{}); derive(); Offline.saveCache(cache); if (msg) UI.toast(msg); }
    render();
  }

  // ---------- Contexto para la IA ----------
  // Solo datos de entrenamiento y hábitos: nada del registro clínico sale hacia Gemini.
  function buildAIContext(){
    const c = ctx(), p = c.profile, t = c.targets, today = Logic.todayISO();
    const sum = Logic.sumFoods(cache.foodLogs.filter(l=>l.fecha===today)), trend = Logic.weeklyTrend(cache.weights);
    const ses = c.sessions.slice(0,3).map(s => `${s.fecha} (${s.rutina||'?'}): ${s.ejercicios.map(e => { const r=s.sets.filter(x=>x.ejercicio===e); return `${e} ${Math.max(...r.map(x=>x.peso_kg))}kg×${Math.max(...r.map(x=>x.reps))}`; }).join('; ')}`).join('\n');
    const week = Logic.muscleWeek(cache.sets, cache.exercises).map(m=>`${m.label} ${m.series}`).join(', ');
    const objetivos = cache.goals.filter(g=>g.estado==='activo').map(g=>`${g.titulo} (meta ${g.valor_objetivo}${g.unidad||''})`).join('; ');
    const lesiones = cache.injuries.filter(i=>i.estado==='activa').map(i=>i.zona).join(', ');
    return [
      `Perfil: ${p.edad||'?'} años, ${p.sexo==='m'?'mujer':'hombre'}, ${p.estatura_cm||'?'} cm, objetivo ${p.objetivo||'?'}.`,
      `Peso ${c.lastWeight||'?'} kg, tendencia ${trend!=null?trend+' kg/sem':'s/d'}, cintura ${c.medidas.cintura||'?'} cm.`,
      t.kcal?`Objetivo: ${t.kcal} kcal, ${t.prot} g proteína. Hoy lleva ${Math.round(sum.kcal)} kcal y ${Math.round(sum.prot)} g.`:'',
      `Sueño hoy: ${Logic.saludValue(cache.salud,'sueno',today)??'?'} h. Pasos hoy: ${Logic.saludValue(cache.salud,'pasos',today)??'?'}.`,
      `Series 7 días por grupo: ${week}.`, `Próxima rutina: ${c.nextRoutine||'libre'}.`,
      ses?`Últimas sesiones:\n${ses}`:'Sin sesiones registradas.', objetivos?`Objetivos: ${objetivos}.`:'', lesiones?`Lesiones activas: ${lesiones}.`:'',
    ].filter(Boolean).join('\n');
  }

  // ---------- Navegación ----------
  const TABS = { hoy:'hoy', entreno:'entreno', nutricion:'nutricion', cuerpo:'cuerpo', salud:'salud', ajustes:'ajustes' };
  function go(tab){ currentTab = TABS[tab] || 'hoy'; render(); window.scrollTo(0,0); }
  function render(){
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===currentTab));
    document.body.classList.toggle('in-session', !!draft && currentTab==='entreno');
    const y = window.scrollY; UI.setMain(Views[currentTab]()); window.scrollTo(0,y);
    const n = Offline.pending(), s = $('#sync-pill'); s.textContent = n ? `⏳ ${n}` : ''; s.classList.toggle('hidden', !n);
  }

  // ---------- Sesión ----------
  let wakeLock = null;
  async function reqWake(){ try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {} }
  async function relWake(){ try { await wakeLock?.release(); } catch {} wakeLock = null; }
  function beginDraft(d){ draft = d; Offline.saveDraft(d); reqWake(); go('entreno'); }
  function endDraft(){ draft = null; Offline.clearDraft(); relWake(); UI.stopRest(); render(); }
  let saving = false;
  async function saveSession(d, rows, meta){
    if (saving) return; saving = true;
    try {
      const prev = d.replaceIds ? cache.sets.filter(s=>!d.replaceIds.includes(s.id)) : cache.sets;
      const prs = Logic.newPRs(prev, rows);
      const ok = await tryWrite('sets', ()=>DB.addSets(rows), rows, ()=>{ cache.sets = cache.sets.concat(rows.map(r=>({...r}))); });
      if (ok) {
        if (d.replaceIds) await DB.deleteSetsByIds(d.replaceIds);
        if (meta.rpe || meta.notas || meta.duracion_min) await DB.saveWorkoutSession({ fecha:d.fecha, rutina:d.rutina, nombre:d.nombre, rpe:meta.rpe, duracion_min:meta.duracion_min, notas:meta.notas });
        for (const it of meta.routineChanges) await applyRoutineChange(d, it);
        await reload('sets','exercises','sessionsMeta')(); derive(); Offline.saveCache(cache);
      }
      draft = null; Offline.clearDraft(); relWake(); UI.stopRest(); go('hoy');
      if (ok) sessionSummary({ rows, prs, mins:meta.duracion_min });
    } finally { saving = false; }
  }
  // Un cambio confirmado en la sesión se vuelve parte de la rutina
  async function applyRoutineChange(d, it){
    const fields = { nombre:it.nombre, grupo:it.grupo, unidad:it.unidad };
    const target = it.replacesId && cache.exercises.find(e=>e.id===it.replacesId);
    if (target) return DB.updateExercise(target.id, fields);
    const orden = cache.exercises.filter(e=>e.dia===d.rutina).length+1;
    await DB.addExercise({ ...fields, ...it.obj, dia:d.rutina, orden });
  }

  // ---------- CSV (esquema Kratos) ----------
  function download(name, content){
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type:'text/csv;charset=utf-8' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  const csvField = v => { if(v==null) return ''; const s=String(v); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
  function exportCSV(kind){
    if (kind==='entrenamientos') download('entrenamientos.csv', ['fecha,rutina,ejercicio,serie,reps,peso_kg,rir,observaciones', ...cache.sets.map(s=>[s.fecha,s.rutina,s.ejercicio,s.serie,s.reps,s.peso_kg,s.rir,s.observaciones].map(csvField).join(','))].join('\n'));
    else download('peso_corporal.csv', ['fecha,peso_kg,observaciones', ...cache.weights.map(w=>[w.fecha,w.peso_kg,w.observaciones].map(csvField).join(','))].join('\n'));
    UI.toast('CSV exportado');
  }
  async function importCSV(file){
    const lines = (await file.text()).split(/\r?\n/).filter(l=>l.trim()), head = lines.shift().split(',').map(h=>h.trim()), idx = n => head.indexOf(n);
    const rows = lines.map(l=>{ const c=l.split(','); return { fecha:c[idx('fecha')], rutina:c[idx('rutina')]||null, ejercicio:c[idx('ejercicio')], serie:Number(c[idx('serie')])||1, reps:Number(c[idx('reps')])||0,
      peso_kg:Number(c[idx('peso_kg')])||0, rir:c[idx('rir')]?Number(c[idx('rir')]):null, observaciones:c[idx('observaciones')]||null }; }).filter(r=>r.ejercicio&&r.fecha);
    if(!rows.length) return UI.toast('CSV vacío o inválido');
    await act(()=>DB.addSets(rows), reload('sets'), `Importadas ${rows.length} series`);
  }

  // ---------- Auth ----------
  function show(view){ ['auth-view','config-view','app-view'].forEach(v=>$('#'+v).classList.toggle('hidden', v!==view)); }
  let mode = 'in';
  function initAuthUI(){
    $('#auth-toggle').onclick = () => { mode = mode==='in'?'up':'in';
      $('#auth-submit').textContent = mode==='in'?'Entrar':'Crear cuenta';
      $('#auth-toggle').textContent = mode==='in'?'¿Primera vez? Crear cuenta':'¿Ya tienes cuenta? Entrar'; $('#auth-msg').textContent=''; };
    $('#auth-form').onsubmit = async e => {
      e.preventDefault();
      const email=$('#auth-email').value.trim(), pass=$('#auth-pass').value, msg=$('#auth-msg');
      msg.className='auth-msg'; msg.textContent='Procesando...';
      try {
        if (mode==='in') await DB.signIn(email,pass); else await DB.signUp(email,pass);
        const u = await DB.currentUser();
        if(!u){ msg.className='auth-msg ok'; msg.textContent='Cuenta creada. Revisa tu email para confirmar, luego entra.'; return; }
        await startApp(email);
      } catch(err){ msg.className='auth-msg err'; msg.textContent = err.message || 'Error de autenticación'; }
    };
  }
  // Pinta al tiro con lo guardado y actualiza por detrás
  async function startApp(email){
    DB.currentUserEmail = email; show('app-view');
    draft = Offline.loadDraft();
    const c = Offline.loadCache();
    if (c) { Object.assign(cache, c); derive(); go(draft?'entreno':'hoy'); }
    else UI.setMain(UI.el('div','empty','Cargando…'));
    try {
      if (navigator.onLine && Offline.pending()) await Offline.flush(DB);
      await loadAll(); Offline.saveCache(cache); lastRefresh = Date.now();
      try { await ensureSeed(); } catch {}
      if (!busy() || !c) go(c ? currentTab : draft?'entreno':'hoy');
    } catch {
      if (c) UI.toast('📴 Sin conexión · usando datos guardados');
      else UI.setMain(UI.el('div','empty','Sin conexión y sin datos guardados. Conéctate para cargar.'));
    }
  }

  // ---------- Instalación ----------
  const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const canInstall = () => !!installEvt && !isInstalled();
  async function install(){ if(!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; render(); }

  // ---------- Tema ----------
  function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('kratos-theme', t);
    $('#theme-btn').textContent = t==='dark' ? '🌙' : '☀️';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t==='dark'?'#1b1613':'#f4ecdf'); }
  const initTheme = () => applyTheme(localStorage.getItem('kratos-theme2') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
  function toggleTheme(){ const t = document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'; localStorage.setItem('kratos-theme2',t); applyTheme(t); if (Object.keys(cache).length) render(); }

  // Registro rápido desde cualquier pestaña
  function quickAdd(){
    const n = UI.el('div','quick');
    [['⚖️','Peso',()=>weightSheet()],['💧','Agua',()=>addWater()],['🍽️','Comida',()=>App.quickFood()],['📏','Medida',()=>measureSheet()],
     ['🏃','Actividad',()=>App.activitySheet()],['🆓','Entreno libre',()=>App.startFree()]].forEach(([i,t,f]) => { const b=UI.el('button','q-btn',`<i>${i}</i><span>${t}</span>`); b.onclick=()=>{ s.close(); f(); }; n.appendChild(b); });
    const s = UI.sheet('Registrar', n);
  }
  const weightSheet = () => App.weightSheet(), measureSheet = () => App.measureSheet();
  const sessionSummary = a => App.sessionSummary(a);

  // ---------- Acciones de las vistas ----------
  const addWater = (ml, fecha = Logic.todayISO()) => saveMedicion({ fecha, tipo:'agua', valor:ml || cache.salud?.metas?.vaso || 250 }, '💧 Agua sumada');
  const api = {
    cache, ctx, alerts, dismissAlert, go, render, draft:()=>draft, beginDraft, endDraft, saveSession, exportCSV, importCSV, addWater,
    canInstall, isInstalled, install,
    openCoach:() => UI.startCoachChat(m => DB.askAI(m, buildAIContext())),
    saveCustomExercise:e => DB.addExercise({ nombre:e.nombre, grupo:e.grupo, unidad:e.unidad, dia:null, activo:true }).then(reload('exercises')).catch(()=>{}),
    saveExercise:e => { const { id, ...f } = e; return act(()=>id?DB.updateExercise(id,f):DB.addExercise(f), reload('exercises'), 'Guardado'); },
    deleteExercise:id => act(()=>DB.deleteExercise(id), reload('exercises'), 'Eliminado'),
    moveExercise:(list,i) => act(()=>{ const o=[...list]; [o[i-1],o[i]]=[o[i],o[i-1]]; return Promise.all(o.map((e,k)=>DB.updateExercise(e.id,{ orden:k+1 }))); }, reload('exercises')),
    renameRoutine:(a,b) => act(()=>Promise.all(cache.exercises.filter(e=>e.dia===a).map(e=>DB.updateExercise(e.id,{ dia:b }))), reload('exercises'), 'Rutina renombrada'),
    deleteRoutine:r => act(()=>Promise.all(cache.exercises.filter(e=>e.dia===r).map(e=>DB.deleteExercise(e.id))), reload('exercises'), 'Rutina eliminada'),
    applyTemplate:t => act(()=>DB.bulkInsertExercises(Object.entries(t.dias).flatMap(([dia,names])=>names.map((nombre,i)=>{ const l=EXERCISE_LIBRARY.find(x=>x.nombre===nombre)||{}, compound=['barra','maquina'].includes(l.unidad)&&l.patron!=='aislamiento';
      return { dia, orden:i+1, nombre, grupo:l.grupo||'', unidad:l.unidad||'mancuerna', series_obj:3, reps_min:compound?6:10, reps_max:compound?10:15, rir_obj:2, incremento_kg:l.unidad==='barra'?2.5:1, activo:true }; }))), reload('exercises'), 'Rutinas agregadas'),
    addMeso:m => act(()=>DB.addMesocycle(m), reload('mesocycles'), 'Bloque iniciado'),
    deleteMeso:id => act(()=>DB.deleteMesocycle(id), reload('mesocycles')),
    deleteSession:s => act(()=>DB.deleteSetsByIds(s.sets.map(x=>x.id).filter(Boolean)), reload('sets'), 'Sesión eliminada'),
    saveCardio:async c => { const ok = await tryWrite('cardio', ()=>DB.addCardio({...c}), {...c}, ()=>cache.cardio.unshift({...c})); if(ok){ await reload('cardio')(); Offline.saveCache(cache); UI.toast('Actividad registrada 💪'); } render(); },
    deleteCardio:id => act(()=>DB.deleteCardio(id), reload('cardio')),
    logFood:async l => { const ok = await tryWrite('food', ()=>DB.addFoodLog({...l}), {...l}, ()=>cache.foodLogs.push({...l})); if(ok){ await reload('foodLogs')(); Offline.saveCache(cache); UI.toast('Registrado'); } render(); },
    logFoods:ls => act(()=>Promise.all(ls.map(l=>DB.addFoodLog({...l}))), reload('foodLogs'), `${ls.length} alimentos agregados`),
    updateFood:(id,p) => act(()=>DB.updateFoodLog(id,p), reload('foodLogs'), 'Actualizado'),
    deleteFood:id => act(()=>DB.deleteFoodLog(id), reload('foodLogs')),
    saveFavorite:f => act(()=>DB.addFood(f), reload('foods'), '⭐ Guardado en favoritos'),
    addRecipe:r => act(()=>DB.addRecipe(r), reload('recipes'), 'Receta guardada'),
    addSupplement:s => act(()=>DB.addSupplement(s), reload('supplements')),
    deleteSupplement:id => act(()=>DB.deleteSupplement(id), reload('supplements')),
    toggleSupplement:(id,f,d) => act(()=>DB.setSupplementLog(id,f,d), reload('supplementLogs')),
    addWeight:w => saveMedicion({ fecha:w.fecha, tipo:'peso', valor:w.valor, condicion:w.condicion }, 'Peso guardado en Mi Salud'),
    deleteWeight:r => act(()=>r.origen==='salud'?DB.deleteMedicion(r.id):DB.deleteWeight(r.id), reload('salud','legacyWeights'), 'Eliminado'),
    addMeasure:m => m.medida==='cintura' ? saveMedicion({ fecha:m.fecha, tipo:'cintura', valor:m.valor_cm }, 'Cintura guardada en Mi Salud')
      : (async()=>{ const ok=await tryWrite('measure',()=>DB.addMeasurement({...m}),{...m},()=>cache.legacyMeasures.push({...m})); if(ok){ await reload('legacyMeasures')(); derive(); UI.toast('Medida guardada'); } render(); })(),
    addPhoto:(f,p,d) => act(()=>DB.uploadPhoto(f,p,d), reload('photos'), 'Foto guardada'),
    deletePhoto:(id,path) => act(()=>DB.deletePhoto(id,path), reload('photos')),
    // Las horas van a Mi Salud y sin tocar lo que subió el smartband; la calidad y el ánimo quedan aquí.
    saveCheckin:({ fecha, horas, calidad, animo, estres, energia }) => act(async()=>{
      await DB.addSleep({ fecha, horas, calidad }); await DB.addWellness({ fecha, animo, estres, energia });
      if (horas) { const rows=(cache.salud?.med||[]).filter(m=>m.tipo==='sueno'&&m.fecha===fecha), mine=rows.find(m=>m.origen!=='wearable');
        if (mine) await DB.updateMedicion(mine.id,{ valor:horas }); else if (!rows.length) await DB.addMedicion({ fecha, tipo:'sueno', valor:horas }); }
    }, reload('sleep','wellness','salud'), 'Check-in guardado'),
    addGoal:g => act(()=>DB.addGoal(g), reload('goals'), 'Objetivo creado'),
    deleteGoal:id => act(()=>DB.deleteGoal(id), reload('goals')),
    addHabit:h => act(()=>DB.addHabit(h), reload('habits')),
    deleteHabit:id => act(()=>DB.deleteHabit(id), reload('habits')),
    toggleHabit:(id,f,d) => act(()=>DB.setHabitLog(id,f,d), reload('habitLogs')),
    addInjury:i => act(()=>DB.addInjury(i), reload('injuries'), 'Lesión registrada'),
    updateInjury:(id,p) => act(()=>DB.updateInjury(id,p), reload('injuries')),
    addRehab:r => act(()=>DB.addRehab(r), reload('rehab'), 'Dolor registrado'),
    saveProfile:p => act(()=>DB.saveProfile({ ...cache.profile, ...p }), reload('profile'), 'Guardado'),
    saveReminders:r => act(()=>DB.saveReminders(r), reload('profile'), 'Recordatorios guardados'),
    pushEnable:async () => { try { await Push.enable(); UI.toast('🔔 Activadas'); } catch(e){ UI.toast(e.message||'Error'); } render(); },
    pushDisable:async () => { try { await Push.disable(); UI.toast('Desactivadas'); } catch(e){ UI.toast(e.message||'Error'); } render(); },
    pushTest:async () => { try { await Push.test(); } catch(e){ UI.toast(e.message||'Error'); } },
    signOut:async () => { Offline.clearCache(); Offline.clearDraft(); await DB.signOut(); location.reload(); },
  };

  // ---------- Boot ----------
  async function boot(){
    initTheme();
    $('#theme-btn').onclick = toggleTheme;
    $('#set-btn').onclick = () => go('ajustes');
    $('#fab').onclick = quickAdd;
    document.querySelectorAll('.tab').forEach(t => t.onclick = () => go(t.dataset.tab));
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (DB.uid()) render(); });
    window.addEventListener('appinstalled', () => { installEvt = null; UI.toast('App instalada 💪'); });
    window.addEventListener('offline', () => UI.toast('📴 Sin conexión'));
    window.addEventListener('online', () => refresh(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState==='visible'){ checkDay(); refresh(); if (draft) reqWake(); } });
    setInterval(checkDay, 60000);
    setInterval(() => { if (document.visibilityState==='visible') refresh(); }, 300000);

    if (!DB.configured()){ show('config-view'); return; }
    DB.init(); initAuthUI();
    const u = await DB.currentUser();
    if (u) await startApp(u.email); else show('auth-view');
  }
  document.addEventListener('DOMContentLoaded', boot);
  return api;
})();
