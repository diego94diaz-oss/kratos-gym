// ============================================================
//  APP — Orquestador: auth, navegación, estado y acciones
// ============================================================
(() => {
  const $ = UI.$;
  let cache = { exercises:[], sets:[], weights:[], profile:null };
  let currentTab = 'hoy';
  let pickedDay = null;

  // ---------- Tema ----------
  function applyTheme(t){ document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('kratos-theme', t);
    $('#theme-btn').textContent = t==='dark' ? '🌙' : '☀️';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t==='dark'?'#0f1115':'#f4f6fa'); }
  function initTheme(){ applyTheme(localStorage.getItem('kratos-theme') || 'dark'); }
  function toggleTheme(){ applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); }

  function show(view){ ['auth-view','config-view','app-view'].forEach(v=>$('#'+v).classList.toggle('hidden', v!==view)); }

  // ---------- Carga de datos ----------
  async function loadAll(){
    cache.profile  = await DB.getProfile();
    cache.exercises= await DB.getExercises();
    cache.sets     = await DB.getAllSets();
    cache.weights  = await DB.getWeights();
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
      UI.setMain(UI.renderHoy({ day, exercises:cache.exercises, sets:cache.sets,
        onChangeDay: d => { pickedDay=d; render(); },
        onSave: saveSession }));
    } else if (currentTab==='rutina') {
      UI.setMain(UI.renderRutina({ exercises:cache.exercises,
        onAdd: day => UI.setMain(UI.exerciseForm(null, day, onExForm)),
        onEdit: ex => UI.setMain(UI.exerciseForm(ex, ex.dia, onExForm)),
        onDelete: async id => { await DB.deleteExercise(id); cache.exercises=await DB.getExercises(); render(); UI.toast('Eliminado'); } }));
    } else if (currentTab==='avances') {
      UI.setMain(UI.renderAvances({ sets:cache.sets, exercises:cache.exercises }));
    } else if (currentTab==='peso') {
      UI.setMain(UI.renderPeso({ weights:cache.weights, profile:cache.profile,
        onAdd: async w => { await DB.addWeight(w); cache.weights=await DB.getWeights(); render(); UI.toast('Peso guardado'); },
        onDelete: async id => { await DB.deleteWeight(id); cache.weights=await DB.getWeights(); render(); } }));
    } else if (currentTab==='ajustes') {
      UI.setMain(UI.renderAjustes({ profile:cache.profile, email:(DB.currentUserEmail||''),
        onSaveProfile: async p => { await DB.saveProfile({...cache.profile, ...p}); cache.profile=await DB.getProfile(); UI.toast('Perfil guardado'); render(); },
        onExport: exportCSV, onImport: importCSV,
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
    await DB.addSets(rows);
    cache.sets = await DB.getAllSets();
    pickedDay = null; // próxima vez alterna
    if (prs.length) UI.toast('🏆 ¡Nuevo PR en ' + prs[0].ejercicio + '!');
    else UI.toast('💪 Sesión guardada');
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
    await loadAll();
    await ensureSeed();
    setTab('hoy');
  }

  // ---------- Boot ----------
  async function boot(){
    initTheme();
    $('#theme-btn').onclick = toggleTheme;
    document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{ if(t.dataset.tab==='hoy') pickedDay=null; setTab(t.dataset.tab); });

    if (!DB.configured()){ show('config-view'); return; }
    DB.init();
    initAuthUI();
    const u = await DB.currentUser();
    if (u){ await startApp(u.email); }
    else show('auth-view');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
