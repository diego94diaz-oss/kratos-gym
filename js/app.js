// ============================================================
//  APP — Orquestador: auth, navegación, estado y acciones
// ============================================================
(() => {
  const $ = UI.$;
  let cache = { exercises:[], sets:[], weights:[], measurements:[], foodLogs:[], photos:[],
                sleep:[], wellness:[], habits:[], habitLogs:[], injuries:[], goals:[], profile:null };
  let currentTab = 'hoy';
  let pickedDay = null;
  let trainingMode = false;
  let nutriDate = null;
  const lastWeightKg = () => cache.weights.length ? Number(cache.weights[cache.weights.length-1].peso_kg) : null;

  // ---------- Wake lock (pantalla activa al entrenar) ----------
  let wakeLock = null;
  async function reqWake(){ try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {} }
  async function relWake(){ try { await wakeLock?.release(); } catch {} wakeLock = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState==='visible' && trainingMode) reqWake(); });

  // ---------- Escritura con respaldo offline ----------
  // Intenta el insert online; si falla por falta de red, encola y aplica localmente.
  // Devuelve true si fue online, false si quedó offline (encolado).
  async function tryWrite(kind, dbCall, payload, applyLocal){
    try { await dbCall(); return true; }
    catch (e) {
      if (Offline.isOfflineError(e)) {
        Offline.enqueue({ kind, payload });
        applyLocal && applyLocal();
        Offline.saveCache(cache);
        UI.toast('📴 Guardado offline · se sincroniza al reconectar');
        return false;
      }
      UI.toast('Error: ' + (e.message || 'no se pudo guardar'));
      throw e;
    }
  }

  // ---------- Tema ----------
  function applyTheme(t){ document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('kratos-theme', t);
    $('#theme-btn').textContent = t==='dark' ? '🌙' : '☀️';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t==='dark'?'#07080c':'#f3f6fb'); }
  function initTheme(){ applyTheme(localStorage.getItem('kratos-theme') || 'dark'); }
  function toggleTheme(){ applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); }

  function show(view){ ['auth-view','config-view','app-view'].forEach(v=>$('#'+v).classList.toggle('hidden', v!==view)); }

  // ---------- Carga de datos ----------
  async function loadAll(){
    cache.profile  = await DB.getProfile();
    cache.exercises= await DB.getExercises();
    cache.sets     = await DB.getAllSets();
    cache.weights  = await DB.getWeights();
    cache.measurements = await DB.getMeasurements();
    // Tablas de Fase 1 (nutrición/fotos): pueden no existir aún si no se corrió la migración.
    try { cache.foodLogs = await DB.getFoodLogs(); } catch { cache.foodLogs = []; }
    try { cache.photos   = await DB.getPhotos();   } catch { cache.photos = []; }
    // Tablas de Fase 2 (salud/objetivos): idem.
    try { cache.sleep     = await DB.getSleep();     } catch { cache.sleep = []; }
    try { cache.wellness  = await DB.getWellness();  } catch { cache.wellness = []; }
    try { cache.habits    = await DB.getHabits();    } catch { cache.habits = []; }
    try { cache.habitLogs = await DB.getHabitLogs(); } catch { cache.habitLogs = []; }
    try { cache.injuries  = await DB.getInjuries();  } catch { cache.injuries = []; }
    try { cache.goals     = await DB.getGoals();     } catch { cache.goals = []; }
  }

  async function ensureSeed(){
    if (!cache.exercises.length) {
      await DB.bulkInsertExercises(SEED_EXERCISES.map(e=>({...e})));
      cache.exercises = await DB.getExercises();
    }
    if (!cache.profile) {
      await DB.saveProfile({ ...SEED_PROFILE });
      cache.profile = await DB.getProfile();
    }
  }

  // ---------- Navegación ----------
  function setTab(tab){
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
    render();
  }

  function render(){
    if (currentTab==='hoy') {
      const day = pickedDay || Logic.nextDay(cache.sets);
      pickedDay = day;
      if (trainingMode) {
        UI.setMain(UI.renderHoy({ day, exercises:cache.exercises, sets:cache.sets,
          onChangeDay: d => { pickedDay=d; render(); },
          onSave: saveSession,
          onBack: () => { trainingMode=false; relWake(); render(); } }));
      } else {
        UI.setMain(UI.renderDashboard({ profile:cache.profile, exercises:cache.exercises, sets:cache.sets,
          weights:cache.weights, measurements:cache.measurements, foodLogs:cache.foodLogs, lastWeight:lastWeightKg(), day,
          sleep:cache.sleep, wellness:cache.wellness, injuries:cache.injuries,
          onTrain: () => { trainingMode=true; reqWake(); render(); },
          onGo: tab => setTab(tab) }));
      }
    } else if (currentTab==='rutina') {
      UI.setMain(UI.renderRutina({ exercises:cache.exercises,
        onAdd: day => UI.setMain(UI.exerciseForm(null, day, onExForm)),
        onAddFromLib: (day, lib) => UI.setMain(UI.exerciseForm({ dia:day, nombre:lib.nombre, grupo:lib.grupo, unidad:lib.unidad }, day, onExForm)),
        onEdit: ex => UI.setMain(UI.exerciseForm(ex, ex.dia, onExForm)),
        onDelete: async id => { await DB.deleteExercise(id); cache.exercises=await DB.getExercises(); render(); UI.toast('Eliminado'); } }));
    } else if (currentTab==='avances') {
      UI.setMain(UI.renderAvances({ sets:cache.sets, exercises:cache.exercises,
        weights:cache.weights, foodLogs:cache.foodLogs, profile:cache.profile, lastWeight:lastWeightKg() }));
    } else if (currentTab==='peso') {
      UI.setMain(UI.renderPeso({ weights:cache.weights, profile:cache.profile, measurements:cache.measurements, photos:cache.photos,
        onAdd: async w => { const ok = await tryWrite('weight', ()=>DB.addWeight(w), w,
            ()=>{ cache.weights=[...cache.weights.filter(x=>x.fecha!==w.fecha), {...w}].sort((a,b)=>a.fecha<b.fecha?-1:1); });
          if(ok){ cache.weights=await DB.getWeights(); Offline.saveCache(cache); UI.toast('Peso guardado'); } render(); },
        onDelete: async id => { await DB.deleteWeight(id); cache.weights=await DB.getWeights(); Offline.saveCache(cache); render(); },
        onAddMeasure: async m => { const ok = await tryWrite('measure', ()=>DB.addMeasurement(m), m,
            ()=>{ cache.measurements=[...cache.measurements, {...m}]; });
          if(ok){ cache.measurements=await DB.getMeasurements(); Offline.saveCache(cache); UI.toast('Medida guardada'); } render(); },
        onDeleteMeasure: async id => { await DB.deleteMeasurement(id); cache.measurements=await DB.getMeasurements(); Offline.saveCache(cache); render(); },
        onAddPhoto: async (f, pose, fecha) => { try { UI.toast('Subiendo foto...'); await DB.uploadPhoto(f, pose, fecha); cache.photos=await DB.getPhotos(); render(); UI.toast('Foto guardada'); } catch(e){ UI.toast('Error al subir: '+(e.message||'')); } },
        onDeletePhoto: async (id, path) => { await DB.deletePhoto(id, path); cache.photos=await DB.getPhotos(); render(); } }));
    } else if (currentTab==='nutricion') {
      nutriDate = nutriDate || Logic.todayISO();
      UI.setMain(UI.renderNutricion({ logs:cache.foodLogs, profile:cache.profile, lastWeight:lastWeightKg(), weights:cache.weights, date:nutriDate,
        onChangeDate: d => { nutriDate=d; render(); },
        onSearch: term => DB.searchFoods(term),
        onScan: code => DB.searchFoodByBarcode(code),
        onLog: async l => { const ok = await tryWrite('food', ()=>DB.addFoodLog(l), l,
            ()=>{ cache.foodLogs=[...cache.foodLogs, {...l}]; });
          if(ok){ cache.foodLogs=await DB.getFoodLogs(); Offline.saveCache(cache); UI.toast('Registrado'); } render(); },
        onDeleteLog: async id => { await DB.deleteFoodLog(id); cache.foodLogs=await DB.getFoodLogs(); Offline.saveCache(cache); render(); } }));
    } else if (currentTab==='salud') {
      const reload = async () => { try {
        cache.sleep=await DB.getSleep(); cache.wellness=await DB.getWellness();
        cache.habits=await DB.getHabits(); cache.habitLogs=await DB.getHabitLogs();
        cache.injuries=await DB.getInjuries(); cache.goals=await DB.getGoals();
        Offline.saveCache(cache);
      } catch(e){ UI.toast('Error: '+(e.message||'')); } render(); };
      UI.setMain(UI.renderSalud({
        sleep:cache.sleep, wellness:cache.wellness, habits:cache.habits, habitLogs:cache.habitLogs,
        injuries:cache.injuries, goals:cache.goals,
        ctx:{ lastWeight:lastWeightKg(), measurements:cache.measurements, sets:cache.sets },
        onSleep: async s => { await DB.addSleep(s); await reload(); UI.toast('Sueño guardado'); },
        onWellness: async w => { await DB.addWellness(w); await reload(); UI.toast('Estado guardado'); },
        onAddHabit: async h => { await DB.addHabit(h); await reload(); },
        onDeleteHabit: async id => { await DB.deleteHabit(id); await reload(); },
        onToggleHabit: async (hid, fecha, done) => { await DB.setHabitLog(hid, fecha, done); await reload(); },
        onAddInjury: async i => { await DB.addInjury(i); await reload(); UI.toast('Lesión registrada'); },
        onUpdateInjury: async (id, patch) => { await DB.updateInjury(id, patch); await reload(); },
        onDeleteInjury: async id => { await DB.deleteInjury(id); await reload(); },
        onAddGoal: async g => { await DB.addGoal(g); await reload(); UI.toast('Objetivo creado'); },
        onDeleteGoal: async id => { await DB.deleteGoal(id); await reload(); } }));
    } else if (currentTab==='ajustes') {
      UI.setMain(UI.renderAjustes({ profile:cache.profile, email:(DB.currentUserEmail||''), lastWeight:lastWeightKg(),
        onSaveProfile: async p => { await DB.saveProfile({...cache.profile, ...p}); cache.profile=await DB.getProfile(); UI.toast('Perfil guardado'); render(); },
        onExport: exportCSV, onImport: importCSV,
        onPushEnable: async () => { try { await Push.enable(); UI.toast('🔔 Notificaciones activadas'); } catch(e){ UI.toast(e.message||'Error'); } render(); },
        onPushDisable: async () => { try { await Push.disable(); UI.toast('Notificaciones desactivadas'); } catch(e){ UI.toast(e.message||'Error'); } render(); },
        onPushTest: async () => { try { await Push.test(); } catch(e){ UI.toast(e.message||'Error'); } },
        onSaveReminders: async r => { try { await DB.saveReminders(r); cache.profile=await DB.getProfile(); Offline.saveCache(cache); UI.toast('Recordatorios guardados'); } catch(e){ UI.toast(e.message||'Error'); } },
        onSignOut: async () => { await DB.signOut(); location.reload(); } }));
    }
  }

  async function onExForm(data){
    if (data === null) { setTab('rutina'); return; }
    if (data.id) await DB.updateExercise(data.id, data);
    else await DB.addExercise(data);
    cache.exercises = await DB.getExercises();
    UI.toast('Guardado'); setTab('rutina');
  }

  async function saveSession(rows){
    const prs = Logic.newPRs(cache.sets, rows);
    const ok = await tryWrite('sets', ()=>DB.addSets(rows), rows,
      ()=>{ cache.sets = cache.sets.concat(rows.map(r=>({...r}))); });
    if (ok) { cache.sets = await DB.getAllSets(); Offline.saveCache(cache); }
    pickedDay = null; // próxima vez alterna
    trainingMode = false; relWake();
    if (ok) UI.toast(prs.length ? '🏆 ¡Nuevo PR en ' + prs[0].ejercicio + '!' : '💪 Sesión guardada');
    setTab('avances');
  }

  // ---------- CSV (esquema Kratos) ----------
  function download(name, content){
    const blob = new Blob([content], { type:'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  }
  function csvField(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
  function exportCSV(kind){
    if (kind==='entrenamientos'){
      const head='fecha,rutina,ejercicio,serie,reps,peso_kg,rir,observaciones';
      const lines = cache.sets.map(s=>[s.fecha,s.rutina,s.ejercicio,s.serie,s.reps,s.peso_kg,s.rir,s.observaciones].map(csvField).join(','));
      download('entrenamientos.csv', [head,...lines].join('\n'));
    } else {
      const head='fecha,peso_kg,observaciones';
      const lines = cache.weights.map(w=>[w.fecha,w.peso_kg,w.observaciones].map(csvField).join(','));
      download('peso_corporal.csv', [head,...lines].join('\n'));
    }
    UI.toast('CSV exportado');
  }
  async function importCSV(file){
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    const head = lines.shift().split(',').map(h=>h.trim());
    const idx = n => head.indexOf(n);
    const rows = lines.map(l=>{
      const c = l.split(','); // import simple (sin comillas complejas)
      return { fecha:c[idx('fecha')], rutina:c[idx('rutina')]||null, ejercicio:c[idx('ejercicio')],
        serie:Number(c[idx('serie')])||1, reps:Number(c[idx('reps')])||0,
        peso_kg:Number(c[idx('peso_kg')])||0, rir:c[idx('rir')]?Number(c[idx('rir')]):null,
        observaciones:c[idx('observaciones')]||null };
    }).filter(r=>r.ejercicio && r.fecha);
    if(!rows.length) return UI.toast('CSV vacío o inválido');
    await DB.addSets(rows);
    cache.sets = await DB.getAllSets();
    UI.toast(`Importadas ${rows.length} series`); setTab('avances');
  }

  // ---------- Auth UI ----------
  let mode = 'in';
  function initAuthUI(){
    $('#auth-toggle').onclick = () => { mode = mode==='in'?'up':'in';
      $('#auth-submit').textContent = mode==='in'?'Entrar':'Crear cuenta';
      $('#auth-toggle').textContent = mode==='in'?'¿Primera vez? Crear cuenta':'¿Ya tienes cuenta? Entrar';
      $('#auth-msg').textContent=''; };
    $('#auth-form').onsubmit = async e => {
      e.preventDefault();
      const email=$('#auth-email').value.trim(), pass=$('#auth-pass').value;
      const msg=$('#auth-msg'); msg.className='auth-msg'; msg.textContent='Procesando...';
      try {
        if (mode==='in') await DB.signIn(email,pass);
        else { await DB.signUp(email,pass); }
        DB.currentUserEmail = email;
        const u = await DB.currentUser();
        if(!u){ msg.className='auth-msg ok'; msg.textContent='Cuenta creada. Revisa tu email para confirmar, luego entra.'; return; }
        await startApp(email);
      } catch(err){ msg.className='auth-msg err'; msg.textContent = err.message || 'Error de autenticación'; }
    };
  }

  async function startApp(email){
    DB.currentUserEmail = email;
    show('app-view');
    UI.setMain(UI.el('div','empty','Cargando...'));
    try {
      await loadAll();
      Offline.saveCache(cache);
      try { await ensureSeed(); } catch {}
      if (navigator.onLine && Offline.pending()) { const n = await Offline.flush(DB); if(n){ await loadAll(); Offline.saveCache(cache); } }
    } catch (e) {
      // Sin conexión: hidrata desde la caché local para seguir usable.
      const c = Offline.loadCache();
      if (c) { Object.assign(cache, c); UI.toast('📴 Modo offline · datos guardados'); }
      else { UI.setMain(UI.el('div','empty','Sin conexión y sin datos en caché. Conéctate para cargar.')); return; }
    }
    setTab('hoy');
  }

  // ---------- Boot ----------
  async function boot(){
    initTheme();
    $('#theme-btn').onclick = toggleTheme;
    document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{ if(t.dataset.tab==='hoy'){ pickedDay=null; trainingMode=false; relWake(); } setTab(t.dataset.tab); });

    // Sincronización al recuperar conexión
    window.addEventListener('offline', () => UI.toast('📴 Sin conexión'));
    window.addEventListener('online', async () => {
      if (!Offline.pending()) return;
      const n = await Offline.flush(DB);
      if (n) { try { await loadAll(); Offline.saveCache(cache); render(); } catch {} UI.toast('✅ Sincronizado (' + n + ')'); }
    });

    if (!DB.configured()){ show('config-view'); return; }
    DB.init();
    initAuthUI();
    const u = await DB.currentUser();
    if (u){ await startApp(u.email); }
    else show('auth-view');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
