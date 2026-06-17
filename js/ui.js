// ============================================================
//  UI — Render de vistas + utilidades de DOM
// ============================================================
const UI = (() => {
  const $ = (s, r=document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; };
  const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let toastT, sessionTimer;
  function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.add('hidden'),2200); }

  function setMain(node){ const m=$('#main'); m.innerHTML=''; m.appendChild(node); m.scrollTop=0; }

  // ---------- SESIÓN (registrar entrenamiento) ----------
  function renderHoy({ day, exercises, sets, onSave, onChangeDay, onBack }) {
    const wrap = el('div');
    const dayEx = exercises.filter(e => e.dia === day && e.activo !== false)
                           .sort((a,b)=>a.orden-b.orden);
    if (onBack) {
      const back = el('button','btn btn-ghost','← Volver al inicio');
      back.style.marginBottom = '12px';
      back.onclick = onBack;
      wrap.appendChild(back);
    }
    // Barra de sesión en vivo (timer + selector de esfuerzo)
    const effMode = localStorage.getItem('kratos-effort') || 'rir';
    clearInterval(sessionTimer);
    const live = el('div','live-head');
    live.innerHTML = `<div><div class="ttl">Sesión en vivo · Día ${day}</div>
        <div class="timer" id="sess-timer">00:00</div></div>
      <div class="effort-toggle">
        <button data-m="rir" class="${effMode==='rir'?'on':''}">RIR</button>
        <button data-m="rpe" class="${effMode==='rpe'?'on':''}">RPE</button>
      </div>`;
    wrap.appendChild(live);
    live.querySelectorAll('.effort-toggle button').forEach(b => b.onclick = () => {
      localStorage.setItem('kratos-effort', b.dataset.m); onChangeDay(day);
    });
    const t0 = Date.now();
    const tick = () => { const elp = document.getElementById('sess-timer'); if(!elp){ clearInterval(sessionTimer); return; }
      const s = Math.floor((Date.now()-t0)/1000); elp.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
    sessionTimer = setInterval(tick, 1000); tick();

    const head = el('div','card');
    head.innerHTML = `<div class="row between">
        <div><div class="section-title" style="margin:0">Sesión de hoy</div>
        <div style="font-size:1.3rem;font-weight:800">${Logic.todayISO()}</div></div>
        <div><select class="day-sel" id="day-sel">
          <option value="A" ${day==='A'?'selected':''}>Día A</option>
          <option value="B" ${day==='B'?'selected':''}>Día B</option>
        </select></div></div>`;
    wrap.appendChild(head);
    head.querySelector('#day-sel').onchange = e => onChangeDay(e.target.value);

    if (!dayEx.length) { wrap.appendChild(el('div','empty','No hay ejercicios en este día. Agrégalos en la pestaña Rutina.')); return wrap; }

    const effLbl = effMode === 'rpe' ? 'RPE' : 'RIR';
    const state = {}; // ejId -> [{reps,peso,effort,type}]
    dayEx.forEach(ex => {
      const rec = Logic.recommend(ex, sets);
      const last = Logic.lastSessionOf(sets, ex.nombre);
      const card = el('div','card ex-card');
      const unidadTxt = ex.unidad==='tiempo'?'seg':ex.unidad==='peso_corporal'?'reps':'kg';
      const repsLbl = ex.unidad==='tiempo'?'seg':'reps';
      const restS = Logic.restSuggestion(ex);
      const effDef = effMode==='rpe' ? (ex.rir_obj!=null?Logic.rpeFromRir(ex.rir_obj):'') : (ex.rir_obj ?? '');
      card.innerHTML = `
        <div class="ex-head">
          <div><div class="ex-name">${esc(ex.nombre)}</div>
          <div class="ex-meta">${ex.series_obj}×${ex.reps_min}-${ex.reps_max} · ${effLbl} ${ex.rir_obj ?? '—'}${effMode==='rpe'?' (RPE '+(ex.rir_obj!=null?10-ex.rir_obj:'—')+')':''} · ${esc(ex.grupo||'')}</div></div>
          <span class="pill ${day==='A'?'a':'b'}">${day}</span>
        </div>
        <div class="rec"><span class="${rec.clase}">${rec.accion.toUpperCase()}</span> · ${esc(rec.texto)}</div>
        ${last?`<div class="ex-meta">Última (${last.fecha}): ${last.sets.map(s=>`${s.reps}×${s.peso_kg}${unidadTxt}`).join(', ')}</div>`:''}
        <div class="mini-label"><span>#</span><span>${repsLbl}</span><span>${unidadTxt==='reps'?'—':unidadTxt}</span><span>${effLbl}</span><span>tipo</span><span></span></div>
        <div class="sets"></div>
        <button class="btn btn-ghost add-set">+ Serie</button>
        <button class="btn btn-ghost rest-btn">⏱️ Descanso ${restS}s</button>`;
      const setsBox = card.querySelector('.sets');
      state[ex.id] = [];
      const prefill = rec.peso!=null ? rec.peso : (last? Math.max(...last.sets.map(s=>s.peso_kg)) : '');
      const typeOpts = Logic.SET_TYPES.map(([v,l,a])=>`<option value="${v}" title="${l}">${a}</option>`).join('');
      const addRow = (reps='', peso=prefill, eff=effDef, type='normal') => {
        const i = state[ex.id].length;
        const row = el('div','set-row');
        const noWeight = ex.unidad==='peso_corporal' || ex.unidad==='tiempo';
        row.innerHTML = `<span class="sn">${i+1}</span>
          <input type="number" inputmode="numeric" class="i-reps" placeholder="${ex.reps_min}-${ex.reps_max}" value="${reps}">
          <input type="number" inputmode="decimal" class="i-peso" placeholder="${noWeight?'—':'kg'}" value="${noWeight?'':peso}" ${noWeight?'disabled':''}>
          <input type="number" inputmode="numeric" class="i-eff" placeholder="${effLbl}" value="${eff}">
          <select class="i-type">${typeOpts}</select>
          <button class="del" title="Quitar">✕</button>`;
        const obj = { reps:'', peso:noWeight?0:peso, effort:eff, type };
        state[ex.id].push(obj);
        row.querySelector('.i-type').value = type;
        row.querySelector('.i-reps').oninput = e => obj.reps = e.target.value;
        row.querySelector('.i-peso').oninput = e => obj.peso = e.target.value;
        row.querySelector('.i-eff').oninput  = e => obj.effort = e.target.value;
        row.querySelector('.i-type').onchange = e => obj.type = e.target.value;
        row.querySelector('.del').onclick = () => { const idx=state[ex.id].indexOf(obj); state[ex.id].splice(idx,1); row.remove(); [...setsBox.children].forEach((r,n)=>r.querySelector('.sn').textContent=n+1); };
        setsBox.appendChild(row);
      };
      for (let s=0; s<ex.series_obj; s++) addRow();
      card.querySelector('.add-set').onclick = () => addRow();
      card.querySelector('.rest-btn').onclick = () => startRest(restS);
      card._ex = ex; card._state = () => state[ex.id];
      wrap.appendChild(card);
    });

    const saveBtn = el('button','btn btn-primary','💾 Guardar sesión');
    saveBtn.style.cssText='width:100%;padding:16px;font-size:16px;margin-bottom:20px';
    saveBtn.onclick = () => {
      const rows = [];
      wrap.querySelectorAll('.ex-card').forEach(card => {
        const ex = card._ex;
        let n = 0;
        card._state().forEach(s => {
          if (s.reps === '' || s.reps == null) return;
          n++;
          let rir, rpe;
          if (effMode === 'rpe') { rpe = s.effort===''?null:Number(s.effort); rir = Logic.rirFromRpe(s.effort); }
          else { rir = s.effort===''?null:Number(s.effort); rpe = Logic.rpeFromRir(s.effort); }
          rows.push({ fecha:Logic.todayISO(), rutina:day, ejercicio:ex.nombre, exercise_id:ex.id,
            serie:n, reps:Number(s.reps), peso_kg:Number(s.peso)||0,
            rir, rpe, set_type:s.type||'normal', observaciones:null });
        });
      });
      if (!rows.length) return toast('Registra al menos una serie');
      clearInterval(sessionTimer);
      onSave(rows);
    };
    wrap.appendChild(saveBtn);
    return wrap;
  }

  // Cronómetro de descanso (overlay global con vibración/beep al terminar)
  let restInt;
  function startRest(seconds){
    clearInterval(restInt);
    document.querySelector('.rest-ov')?.remove();
    const total = seconds; let left = seconds;
    const ov = el('div','rest-ov');
    ov.innerHTML = `<span class="t">${left}s</span>
      <div class="bar2"><i style="width:100%"></i></div>
      <button class="r-add">+15s</button><button class="r-skip">Saltar</button>`;
    document.body.appendChild(ov);
    const tEl = ov.querySelector('.t'), bar = ov.querySelector('i');
    const upd = () => { tEl.textContent = left+'s'; bar.style.width = Math.max(0, left/total*100)+'%'; };
    const done = () => { clearInterval(restInt); ov.remove();
      if (navigator.vibrate) navigator.vibrate([200,80,200]);
      try { const a=new (window.AudioContext||window.webkitAudioContext)(); const o=a.createOscillator(); const g=a.createGain();
        o.connect(g); g.connect(a.destination); o.frequency.value=880; o.start(); g.gain.setValueAtTime(.2,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.5); o.stop(a.currentTime+.5); } catch{} };
    restInt = setInterval(() => { left--; if(left<=0){ done(); } else upd(); }, 1000);
    ov.querySelector('.r-skip').onclick = () => { clearInterval(restInt); ov.remove(); };
    ov.querySelector('.r-add').onclick = () => { left+=15; upd(); };
    upd();
  }

  function beep(freq=880){ try { const a=new (window.AudioContext||window.webkitAudioContext)(); const o=a.createOscillator(),g=a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value=freq; o.start(); g.gain.setValueAtTime(.2,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.4); o.stop(a.currentTime+.4); } catch {} }

  // Reproductor guiado de movilidad (overlay con auto-avance)
  let mobInt;
  function startMobility(routine){
    clearInterval(mobInt); document.querySelector('.rest-ov')?.remove();
    let idx=0, left=routine.items[0].s;
    const ov=el('div','rest-ov'); ov.style.flexWrap='wrap';
    ov.innerHTML=`<span class="t" id="mb-t"></span>
      <div class="bar2" style="flex:1"><i id="mb-bar"></i></div>
      <button id="mb-skip">⏭</button><button id="mb-x">✕</button>
      <div id="mb-name" style="flex-basis:100%;margin-top:6px;font-weight:700"></div>`;
    document.body.appendChild(ov);
    const tEl=ov.querySelector('#mb-t'), bar=ov.querySelector('#mb-bar'), name=ov.querySelector('#mb-name');
    const draw=()=>{ const it=routine.items[idx]; tEl.textContent=left+'s'; bar.style.width=Math.max(0,left/it.s*100)+'%'; name.textContent=`${idx+1}/${routine.items.length} · ${it.n}`; };
    const finish=()=>{ clearInterval(mobInt); ov.remove(); if(navigator.vibrate) navigator.vibrate([200,80,200]); toast('Movilidad completada 🧘'); };
    const next=()=>{ idx++; if(idx>=routine.items.length){ finish(); return; } left=routine.items[idx].s; beep(); draw(); };
    ov.querySelector('#mb-skip').onclick=next;
    ov.querySelector('#mb-x').onclick=()=>{ clearInterval(mobInt); ov.remove(); };
    mobInt=setInterval(()=>{ left--; if(left<=0) next(); else draw(); }, 1000);
    draw();
  }

  // Chat con el coach IA (overlay)
  function startCoachChat(askFn){
    const msgs = [];
    const ov = el('div','chat-ov');
    ov.innerHTML = `<div class="chat-hd"><span>🤖 Kratos · Coach IA</span><button class="icon-btn" id="ch-x">✕</button></div>
      <div class="chat-msgs" id="ch-msgs"></div>
      <div class="chat-in"><input id="ch-in" placeholder="Pregúntale a Kratos…" autocomplete="off"><button class="btn btn-primary" id="ch-send">➤</button></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('#ch-msgs'), input = ov.querySelector('#ch-in');
    const add = (role, content) => { const m=el('div','cmsg '+(role==='user'?'user':'bot')); m.textContent=content; box.appendChild(m); box.scrollTop=box.scrollHeight; return m; };
    add('bot', '¡Hola Diego! Soy Kratos. Pregúntame sobre tu entrenamiento, progreso o nutrición — tengo tus datos a la vista. 💪');
    const close = () => ov.remove();
    ov.querySelector('#ch-x').onclick = close;
    const send = async () => {
      const text = input.value.trim(); if(!text) return;
      input.value=''; add('user', text); msgs.push({ role:'user', content:text });
      const pending = add('bot', 'Pensando…');
      try { const reply = await askFn(msgs); pending.textContent = reply || '(sin respuesta)'; msgs.push({ role:'assistant', content:reply }); }
      catch(e){ pending.textContent = '⚠️ ' + (e.message || 'Error'); }
      box.scrollTop = box.scrollHeight;
    };
    ov.querySelector('#ch-send').onclick = send;
    input.addEventListener('keydown', e => { if(e.key==='Enter') send(); });
    setTimeout(()=>input.focus(), 50);
  }

  // Escáner de código de barras (BarcodeDetector; fallback a entrada manual)
  async function startScanner(onCode){
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia){
      const code = prompt('Tu dispositivo no soporta escaneo. Ingresa el código de barras manualmente:');
      if (code && code.trim()) onCode(code.trim());
      return;
    }
    let stream, raf, stopped = false;
    const ov = el('div','scan-ov');
    ov.innerHTML = `<div class="scan-hint">Apunta al código de barras</div>
      <video playsinline muted></video><div class="scan-frame"></div>
      <div class="scan-bar"><span class="muted">Buscando…</span><button class="btn btn-ghost" id="sc-x">Cancelar</button></div>`;
    document.body.appendChild(ov);
    const video = ov.querySelector('video');
    const cleanup = () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t=>t.stop()); ov.remove(); };
    ov.querySelector('#sc-x').onclick = cleanup;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream; await video.play();
      const det = new window.BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] });
      const scan = async () => {
        if (stopped) return;
        try { const codes = await det.detect(video); if (codes.length){ const c = codes[0].rawValue; cleanup(); onCode(c); return; } } catch {}
        raf = requestAnimationFrame(scan);
      };
      raf = requestAnimationFrame(scan);
    } catch (e) { cleanup(); toast('No se pudo abrir la cámara'); }
  }

  // ---------- DASHBOARD (Hoy) ----------
  function renderDashboard({ profile, exercises, sets, weights, measurements, foodLogs, lastWeight, day, sleep = [], wellness = [], injuries = [], onTrain, onGo, onCoach }) {
    const wrap = el('div');
    const today = Logic.todayISO();

    // --- Saludo ---
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const head = el('div');
    head.innerHTML = `<div class="section-title" style="margin:2px 2px 4px">${today}</div>
      <div style="font-size:1.5rem;font-weight:850;letter-spacing:-.03em;margin:0 2px 14px">${saludo} 💪</div>`;
    wrap.appendChild(head);

    // --- Avisos (motor de alertas) ---
    const alerts = Logic.buildAlerts({ sets, weights, foodLogs, profile, lastWeight, sleep, wellness, injuries });
    if (alerts.length) {
      const aCard = el('div','card');
      aCard.style.borderLeft = '3px solid var(--warn)';
      aCard.innerHTML = `<div class="section-title" style="margin-top:0">Avisos del coach</div>` +
        alerts.map(a => `<div class="rec" style="margin:6px 0;display:flex;gap:8px;align-items:flex-start">
          <span>${a.icon}</span><span class="${a.level==='good'?'tag-up':a.level==='warn'?'tag-keep':''}" style="font-weight:500">${esc(a.text)}</span></div>`).join('');
      wrap.appendChild(aCard);
    }

    // --- Entrenamiento de hoy ---
    const dayEx = exercises.filter(e => e.dia === day && e.activo !== false);
    const todaySets = sets.filter(s => s.fecha === today);
    const trained = todaySets.length > 0;
    const trCard = el('div','card');
    trCard.style.borderLeft = '3px solid var(--primary)';
    if (trained) {
      const exDone = new Set(todaySets.map(s => s.ejercicio)).size;
      const vol = Math.round(todaySets.reduce((a,s)=>a + (s.peso_kg*s.reps||0), 0));
      trCard.innerHTML = `<div class="row between"><h3 style="margin:0">✅ Entrenaste hoy</h3><span class="pill ${todaySets[0].rutina==='A'?'a':'b'}">Día ${todaySets[0].rutina||day}</span></div>
        <div class="ex-meta" style="margin-top:8px">${exDone} ejercicios · ${todaySets.length} series · ${vol} kg de volumen</div>`;
    } else {
      trCard.innerHTML = `<div class="row between"><h3 style="margin:0">Entrenamiento de hoy</h3><span class="pill ${day==='A'?'a':'b'}">Día ${day}</span></div>
        <div class="ex-meta" style="margin-top:8px">${dayEx.length} ejercicios sugeridos${dayEx.length?` · ${esc(dayEx.slice(0,3).map(e=>e.nombre).join(', '))}${dayEx.length>3?'…':''}`:''}</div>`;
    }
    const trBtn = el('button','btn btn-primary', trained ? '✏️ Ver / continuar sesión' : `🏋️ Entrenar día ${day}`);
    trBtn.style.cssText = 'width:100%;margin-top:12px;padding:14px';
    trBtn.onclick = onTrain;
    trCard.appendChild(trBtn);
    wrap.appendChild(trCard);

    // --- Coach IA ---
    if (onCoach){
      const coachBtn = el('button','btn btn-ghost','🤖 Pregúntale a Kratos (IA)');
      coachBtn.style.cssText = 'width:100%;margin-bottom:14px;padding:13px';
      coachBtn.onclick = onCoach;
      wrap.appendChild(coachBtn);
    }

    // --- Nutrición de hoy ---
    const t = Logic.effectiveTargets(profile, lastWeight);
    const sum = Logic.sumFoods(foodLogs.filter(l => l.fecha === today));
    const nCard = el('div','card');
    const kcalPct = t.kcal ? Math.min(100, Math.round(sum.kcal/t.kcal*100)) : 0;
    const rest = t.kcal ? Math.round(t.kcal - sum.kcal) : null;
    nCard.innerHTML = `<div class="row between"><h3 style="margin:0">🍽️ Nutrición</h3><span class="btn-link">Ver →</span></div>
      <div class="kcal-ring" style="padding:8px 0 2px"><div class="big">${Math.round(sum.kcal)}</div>
        <div class="label">${t.kcal?`de ${t.kcal} kcal · ${rest>=0?`quedan ${rest}`:`+${-rest} pasado`}`:'sin objetivo (configúralo en Ajustes)'}</div></div>
      <div class="bar ${t.kcal&&sum.kcal>t.kcal*1.05?'over':''}" style="margin:6px 0 12px"><i style="width:${kcalPct}%"></i></div>
      ${macroBar('Proteína', sum.prot, t.prot)}
      ${macroBar('Grasa', sum.grasa, t.grasa)}
      ${macroBar('Carbohidratos', sum.carbo, t.carbo)}`;
    nCard.onclick = () => onGo('nutricion');
    nCard.style.cursor = 'pointer';
    wrap.appendChild(nCard);

    // --- Cuerpo ---
    const avg = Logic.weeklyAvg(weights);
    const trend = Logic.weeklyTrend(weights);
    const last = weights.length ? weights[weights.length-1] : null;
    const bfRes = Logic.bestBodyFat(profile, last?.peso_kg, measurements || []);
    const bf = bfRes?.pct ?? null;
    const proj = Logic.projectWeight(weights, 4);
    const cCard = el('div','card');
    cCard.innerHTML = `<div class="row between"><h3 style="margin:0">⚖️ Cuerpo</h3><span class="btn-link">Ver →</span></div>
      <div class="grid3" style="margin-top:8px">
        <div class="stat"><div class="big" style="font-size:1.6rem">${last?last.peso_kg:'—'}</div><div class="label">Peso (kg)</div></div>
        <div class="stat"><div class="big" style="font-size:1.6rem">${trend!=null?(trend>0?'+':'')+trend:'—'}</div><div class="label">kg/sem</div></div>
        <div class="stat"><div class="big" style="font-size:1.6rem">${bf!=null?bf+'%':'—'}</div><div class="label">Grasa est.</div></div>
      </div>
      ${proj?`<div class="ex-meta" style="text-align:center;margin-top:10px">🔮 A este ritmo: ~<b>${proj.value} kg</b> en 4 semanas</div>`:''}`;
    cCard.onclick = () => onGo('peso');
    cCard.style.cursor = 'pointer';
    wrap.appendChild(cCard);

    // --- Resumen de entrenamiento ---
    if (sets.length) {
      const since = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
      const weekSessions = new Set(sets.filter(s=>s.fecha>=since).map(s=>s.fecha)).size;
      const totalSessions = new Set(sets.map(s=>s.fecha)).size;
      const prs = Logic.prsByExercise(sets);
      const sCard = el('div','card');
      const streak = Logic.loggingStreak(foodLogs || []);
      sCard.innerHTML = `<div class="row between"><h3 style="margin:0">📈 Progreso</h3><span class="btn-link">Ver →</span></div>
        <div class="grid3" style="margin-top:8px">
          <div class="stat"><div class="big" style="font-size:1.6rem">${weekSessions}</div><div class="label">Esta semana</div></div>
          <div class="stat"><div class="big" style="font-size:1.6rem">${totalSessions}</div><div class="label">Sesiones</div></div>
          <div class="stat"><div class="big" style="font-size:1.6rem">${Object.keys(prs).length}</div><div class="label">PRs</div></div>
        </div>
        ${streak>=2?`<div class="ex-meta" style="text-align:center;margin-top:10px">🔥 Racha de registro de nutrición: <b>${streak} días</b></div>`:''}`;
      sCard.onclick = () => onGo('avances');
      sCard.style.cursor = 'pointer';
      wrap.appendChild(sCard);
    }

    return wrap;
  }

  // ---------- RUTINA ----------
  function renderRutina({ exercises, mesocycles = [], onAdd, onEdit, onDelete, onAddFromLib, onAddMeso, onDeleteMeso }) {
    const wrap = el('div');

    // Periodización (mesociclo activo)
    const meso = mesocycles.find(m => m.activo);
    const mc = el('div','card');
    if (meso){
      const wk = Math.min(meso.semanas, Math.floor((Date.now() - new Date(meso.fecha_inicio)) / (7*86400000)) + 1);
      const guide = { acumulacion:'Volumen alto, RIR 2-3. Acumula trabajo.', intensificacion:'Sube intensidad, reduce algo de volumen.',
        realizacion:'Cargas altas, pocas series, técnica impecable.', deload:'Descarga: −40-50% de volumen, mantén intensidad.' }[meso.fase] || '';
      mc.innerHTML = `<div class="row between"><h3 style="margin:0">🗓️ ${esc(meso.nombre)}</h3><button class="icon-btn dl">🗑️</button></div>
        <div class="ex-meta">Semana ${wk}/${meso.semanas} · Fase: ${esc(meso.fase||'—')}</div>
        <div class="rec" style="margin-top:8px">${esc(guide)}</div>`;
      mc.querySelector('.dl').onclick = () => { if(confirm('¿Finalizar mesociclo?')) onDeleteMeso(meso.id); };
    } else {
      mc.innerHTML = `<h3>🗓️ Periodización</h3><p class="help">Crea un mesociclo para guiar la progresión por fases.</p>
        <input id="ms-n" placeholder="Nombre (ej: Hipertrofia bloque 1)">
        <div class="grid2" style="margin-top:8px">
          <div><label class="help">Fase</label><select id="ms-f" class="day-sel" style="width:100%">
            <option value="acumulacion">Acumulación</option><option value="intensificacion">Intensificación</option>
            <option value="realizacion">Realización</option><option value="deload">Deload</option></select></div>
          <div><label class="help">Semanas</label><input id="ms-w" type="number" value="4"></div></div>
        <button class="btn btn-primary" id="ms-add" style="width:100%;margin-top:10px">Iniciar mesociclo</button>`;
      mc.querySelector('#ms-add').onclick = () => { const n=mc.querySelector('#ms-n').value.trim(); if(!n) return toast('Pon un nombre');
        onAddMeso({ nombre:n, fase:mc.querySelector('#ms-f').value, semanas:Number(mc.querySelector('#ms-w').value)||4, fecha_inicio:Logic.todayISO(), activo:true }); };
    }
    wrap.appendChild(mc);

    wrap.appendChild(el('div','section-title','Rutina Full Body A/B · Recomposición'));
    ['A','B'].forEach(d => {
      const list = exercises.filter(e=>e.dia===d).sort((a,b)=>a.orden-b.orden);
      const card = el('div','card');
      card.innerHTML = `<div class="row between"><h3>Día ${d} <span class="pill ${d==='A'?'a':'b'}">${list.length} ejercicios</span></h3></div>`;
      list.forEach(ex => {
        const it = el('div','list-item');
        it.innerHTML = `<div><div style="font-weight:600">${esc(ex.nombre)}</div>
          <div class="ex-meta">${ex.series_obj}×${ex.reps_min}-${ex.reps_max} · RIR ${ex.rir_obj??'—'} · ${esc(ex.unidad)}</div></div>
          <div class="row"><button class="icon-btn alt" title="Alternativas">🔄</button><button class="icon-btn ed">✏️</button><button class="icon-btn dl">🗑️</button></div>`;
        it.querySelector('.ed').onclick = () => onEdit(ex);
        it.querySelector('.dl').onclick = () => { if(confirm(`¿Eliminar "${ex.nombre}"?`)) onDelete(ex.id); };
        const altBox = el('div'); altBox.style.cssText = 'display:none;padding:6px 0 2px';
        it.querySelector('.alt').onclick = () => {
          if (altBox.style.display === 'block'){ altBox.style.display = 'none'; return; }
          if (!altBox.childElementCount){
            const libEx = (window.EXERCISE_LIBRARY||[]).find(x => x.nombre === ex.nombre);
            const alts = window.libraryAlternatives ? libraryAlternatives(ex.nombre, libEx?.grupo || ex.grupo, libEx?.patron) : [];
            if (!alts.length) altBox.appendChild(el('div','help','Sin alternativas en la biblioteca.'));
            alts.forEach(a => {
              const r = el('div','food-res');
              r.innerHTML = `<div><div style="font-weight:600">${esc(a.nombre)}</div><div class="ex-meta">${esc(a.grupo)} · ${esc(a.unidad)}</div></div><span class="pill a">+</span>`;
              r.onclick = () => onAddFromLib(d, a);
              altBox.appendChild(r);
            });
          }
          altBox.style.display = 'block';
        };
        card.appendChild(it);
        card.appendChild(altBox);
      });
      const add = el('button','btn btn-ghost','+ Agregar ejercicio al Día '+d);
      add.style.cssText='width:100%;margin-top:8px';
      add.onclick = () => onAdd(d);
      card.appendChild(add);
      wrap.appendChild(card);
    });
    return wrap;
  }

  function exerciseForm(ex, day, onSubmit) {
    const isNew = !ex || !ex.id;
    ex = Object.assign({ dia:day, orden:99, series_obj:3, reps_min:8, reps_max:12, rir_obj:2, incremento_kg:2.5, unidad:'mancuerna', grupo:'' }, ex || {});
    const wrap = el('div','card');
    wrap.innerHTML = `<h3>${isNew?'Nuevo ejercicio':'Editar ejercicio'} · Día ${ex.dia}</h3>
      <label class="help">Nombre (escribe o elige de la biblioteca)</label>
      <input id="f-nombre" list="lib-names" value="${esc(ex.nombre||'')}" placeholder="Ej: Sentadilla">
      <datalist id="lib-names">${(window.EXERCISE_LIBRARY||[]).map(e=>`<option value="${esc(e.nombre)}">`).join('')}</datalist>
      <label class="help">Grupo muscular</label><input id="f-grupo" value="${esc(ex.grupo||'')}" placeholder="piernas, pecho...">
      <div class="grid3" style="margin-top:8px">
        <div><label class="help">Series</label><input id="f-series" type="number" value="${ex.series_obj}"></div>
        <div><label class="help">Reps min</label><input id="f-rmin" type="number" value="${ex.reps_min}"></div>
        <div><label class="help">Reps max</label><input id="f-rmax" type="number" value="${ex.reps_max}"></div>
      </div>
      <div class="grid3" style="margin-top:8px">
        <div><label class="help">RIR obj</label><input id="f-rir" type="number" step="0.5" value="${ex.rir_obj??''}"></div>
        <div><label class="help">+kg al subir</label><input id="f-inc" type="number" step="0.5" value="${ex.incremento_kg}"></div>
        <div><label class="help">Unidad</label><select id="f-unidad">
          ${['barra','mancuerna','peso_corporal','tiempo'].map(u=>`<option ${ex.unidad===u?'selected':''}>${u}</option>`).join('')}
        </select></div>
      </div>
      <div class="row" style="margin-top:14px;gap:8px">
        <button class="btn btn-primary" id="f-save" style="flex:1">Guardar</button>
        <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      </div>`;
    // Autocompletar grupo/unidad al elegir de la biblioteca
    wrap.querySelector('#f-nombre').oninput = e => {
      const lib = (window.EXERCISE_LIBRARY||[]).find(x => x.nombre === e.target.value);
      if (lib){ wrap.querySelector('#f-grupo').value = lib.grupo; wrap.querySelector('#f-unidad').value = lib.unidad; }
    };
    wrap.querySelector('#f-cancel').onclick = () => onSubmit(null);
    wrap.querySelector('#f-save').onclick = () => {
      const nombre = wrap.querySelector('#f-nombre').value.trim();
      if(!nombre) return toast('Pon un nombre');
      onSubmit({ id:ex.id, dia:ex.dia, orden:Number(ex.orden)||99,
        nombre, grupo:wrap.querySelector('#f-grupo').value.trim(),
        series_obj:Number(wrap.querySelector('#f-series').value),
        reps_min:Number(wrap.querySelector('#f-rmin').value),
        reps_max:Number(wrap.querySelector('#f-rmax').value),
        rir_obj: wrap.querySelector('#f-rir').value===''?null:Number(wrap.querySelector('#f-rir').value),
        incremento_kg:Number(wrap.querySelector('#f-inc').value),
        unidad:wrap.querySelector('#f-unidad').value, activo:true });
    };
    return wrap;
  }

  // ---------- AVANCES ----------
  function renderAvances({ sets, exercises, weights = [], foodLogs = [], cardio = [], habitLogs = [], profile, lastWeight }) {
    const wrap = el('div');
    if (!sets.length) { wrap.appendChild(el('div','empty','Aún no hay sesiones. Registra tu primera en "Hoy".')); return wrap; }

    // --- Informe semanal ---
    const r = Logic.weeklyReport({ sets, weights, foodLogs, exercises, profile, lastWeight });
    const rep = el('div','card');
    const muscles = Object.entries(r.perMuscle).sort((a,b)=>b[1]-a[1]);
    rep.innerHTML = `<div class="section-title" style="margin-top:0">Informe de los últimos 7 días</div>
      <div class="grid3">
        <div class="stat"><div class="big" style="font-size:1.5rem">${r.sessions}</div><div class="label">Sesiones</div></div>
        <div class="stat"><div class="big" style="font-size:1.5rem">${r.setsCount}</div><div class="label">Series</div></div>
        <div class="stat"><div class="big" style="font-size:1.5rem">${Math.round(r.volume/1000)}t</div><div class="label">Volumen</div></div>
      </div>
      ${muscles.length?`<p class="help" style="margin-top:10px">Series por grupo: ${muscles.map(([g,n])=>`${esc(g)} ${n}`).join(' · ')}</p>`:''}
      ${r.wDelta!=null?`<div class="ex-meta">⚖️ Peso: ${r.wDelta>0?'+':''}${r.wDelta} kg esta semana</div>`:''}
      ${r.avgKcal!=null?`<div class="ex-meta">🍽️ Nutrición: ${r.nDays} días · ~${r.avgKcal} kcal · ${r.avgProt} g proteína prom.</div>`:''}
      ${r.prs.length?`<div class="ex-meta tag-up">🏆 ${r.prs.length} PR esta semana: ${esc(r.prs.map(p=>p.ejercicio).join(', '))}</div>`:''}`;
    wrap.appendChild(rep);

    // --- Estancamiento / deload ---
    const dl = Logic.deloadAdvice(sets);
    const stalled = Logic.stalledExercises(sets);
    if (dl) {
      const dCard = el('div','card');
      dCard.innerHTML = `<div class="row between"><h3 style="margin:0">🔄 Progresión y fatiga</h3></div>
        <div class="rec" style="margin-top:8px"><span class="${dl.due?'tag-down':'tag-up'}">${dl.due?'DELOAD SUGERIDO':'EN PROGRESO'}</span> · ${dl.due?esc(dl.text):`${dl.tracked-dl.stalled} de ${dl.tracked} ejercicios progresando bien. Sigue así.`}</div>
        ${stalled.length?`<p class="help">Estancados: ${stalled.map(s=>esc(s.ejercicio)).join(', ')}. Prueba variar el ejercicio, sumar una serie o revisar técnica/descanso.</p>`:''}`;
      wrap.appendChild(dCard);
    }

    const totalSesiones = new Set(sets.map(s=>s.fecha)).size;
    const prs = Logic.prsByExercise(sets);
    const stats = el('div','card');
    stats.innerHTML = `<div class="section-title" style="margin-top:0">Totales (histórico)</div>
      <div class="grid3">
      <div class="stat"><div class="big">${totalSesiones}</div><div class="label">Sesiones</div></div>
      <div class="stat"><div class="big">${sets.length}</div><div class="label">Series totales</div></div>
      <div class="stat"><div class="big">${Object.keys(prs).length}</div><div class="label">PRs</div></div></div>`;
    wrap.appendChild(stats);

    // Volumen por sesión
    const volCard = el('div','card');
    volCard.innerHTML = '<h3>Volumen por sesión (kg)</h3><div class="chartbox"><canvas id="c-vol"></canvas></div>';
    wrap.appendChild(volCard);

    // Selector de ejercicio para progreso
    const exNames = [...new Set(sets.map(s=>s.ejercicio))];
    const progCard = el('div','card');
    progCard.innerHTML = `<div class="row between"><h3>Progreso por ejercicio</h3>
      <select id="ex-pick" class="day-sel">${exNames.map(n=>`<option>${esc(n)}</option>`).join('')}</select></div>
      <div class="chartbox"><canvas id="c-prog"></canvas></div><div id="prog-rec" class="rec"></div>`;
    wrap.appendChild(progCard);

    // PRs
    const prCard = el('div','card');
    prCard.innerHTML = '<h3>🏆 Récords personales</h3>';
    Object.entries(prs).sort((a,b)=>b[1].e1rm-a[1].e1rm).forEach(([ej,v])=>{
      const it = el('div','list-item');
      it.innerHTML = `<div style="font-weight:600">${esc(ej)}</div>
        <div class="ex-meta">${v.peso} kg × ${v.reps} · ${v.fecha} · e1RM ~${Math.round(v.e1rm)}kg</div>`;
      prCard.appendChild(it);
    });
    wrap.appendChild(prCard);

    // Logros
    const achs = Logic.buildAchievements({ sets, foodLogs, cardio, habitLogs });
    const unlocked = achs.filter(a=>a.unlocked).length;
    const aCard = el('div','card');
    aCard.innerHTML = `<div class="row between"><h3 style="margin:0">🏅 Logros</h3><span class="pill a">${unlocked}/${achs.length}</span></div>
      <div class="ach-grid" style="margin-top:10px">${achs.map(a=>`
        <div class="ach ${a.unlocked?'on':'off'}"><div class="a-ic">${a.icon}</div>
          <div class="a-tt">${esc(a.titulo)}</div><div class="a-ds">${esc(a.desc)}${a.unlocked?'':` · ${a.prog}`}</div></div>`).join('')}</div>`;
    wrap.appendChild(aCard);

    setTimeout(() => {
      drawVolume(sets);
      const pick = progCard.querySelector('#ex-pick');
      const draw = () => drawProgress(sets, exercises, pick.value, progCard.querySelector('#prog-rec'));
      pick.onchange = draw; draw();
    }, 30);
    return wrap;
  }

  let volChart, progChart;
  function chartColors(){ const s=getComputedStyle(document.body); return { line:s.getPropertyValue('--primary').trim(), text:s.getPropertyValue('--muted').trim(), grid:s.getPropertyValue('--line').trim(), accent:s.getPropertyValue('--accent').trim() }; }
  function drawVolume(sets){
    const data = Logic.volumeByDate(sets); const c=chartColors();
    if(volChart) volChart.destroy();
    volChart = new Chart(document.getElementById('c-vol'), { type:'bar',
      data:{ labels:data.map(d=>d.fecha.slice(5)), datasets:[{ data:data.map(d=>d.vol), backgroundColor:c.line, borderRadius:6 }] },
      options:baseOpts(c) });
  }
  function drawProgress(sets, exercises, ejercicio, recBox){
    const c=chartColors();
    const rows = sets.filter(s=>s.ejercicio===ejercicio && s.peso_kg>0);
    const byDate={}; rows.forEach(s=>{ byDate[s.fecha]=Math.max(byDate[s.fecha]||0, s.peso_kg); });
    const data=Object.entries(byDate).sort();
    if(progChart) progChart.destroy();
    progChart = new Chart(document.getElementById('c-prog'), { type:'line',
      data:{ labels:data.map(d=>d[0].slice(5)), datasets:[{ data:data.map(d=>d[1]), borderColor:c.accent, backgroundColor:'transparent', tension:.3, pointRadius:4, fill:false }] },
      options:baseOpts(c) });
    const ex = exercises.find(e=>e.nombre===ejercicio);
    if(ex && recBox){ const r=Logic.recommend(ex,sets); recBox.innerHTML=`<span class="${r.clase}">${r.accion.toUpperCase()}</span> · ${esc(r.texto)}`; }
  }
  function baseOpts(c){ return { responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false} },
    scales:{ x:{ ticks:{color:c.text}, grid:{color:c.grid} }, y:{ ticks:{color:c.text}, grid:{color:c.grid} } } }; }

  // ---------- CUERPO (peso + composición + medidas) ----------
  function renderPeso({ weights, profile, measurements = [], photos = [], onAdd, onDelete, onAddMeasure, onDeleteMeasure, onAddPhoto, onDeletePhoto }) {
    const wrap = el('div');
    const advice = Logic.bodyAdvice(profile, weights);
    const avg = Logic.weeklyAvg(weights);
    const trend = Logic.weeklyTrend(weights);
    const last = weights.length ? weights[weights.length-1] : null;

    const top = el('div','card');
    top.innerHTML = `<div class="grid3">
      <div class="stat"><div class="big">${last?last.peso_kg:'—'}</div><div class="label">Último (kg)</div></div>
      <div class="stat"><div class="big">${avg??'—'}</div><div class="label">Prom. 7d</div></div>
      <div class="stat"><div class="big">${trend!=null?(trend>0?'+':'')+trend:'—'}</div><div class="label">kg/sem</div></div>
    </div><div class="rec" style="margin-top:12px"><span class="${advice.clase}">PESO</span> · ${esc(advice.texto)}</div>`;
    wrap.appendChild(top);

    // --- Composición corporal (mejor método disponible) ---
    const bfRes = Logic.bestBodyFat(profile, last?.peso_kg, measurements);
    const bf = bfRes?.pct ?? null;
    const comp = Logic.composition(bf, last?.peso_kg);
    const compCard = el('div','card');
    if (bf != null) {
      compCard.innerHTML = `<div class="section-title" style="margin-top:0">Composición corporal (estimada)</div>
        <div class="grid3">
          <div class="stat"><div class="big">${bf}%</div><div class="label">Grasa corporal</div></div>
          <div class="stat"><div class="big">${comp?comp.magra:'—'}</div><div class="label">Masa magra (kg)</div></div>
          <div class="stat"><div class="big">${comp?comp.grasa:'—'}</div><div class="label">Masa grasa (kg)</div></div>
        </div>
        <p class="help">Método: ${esc(bfRes.metodo)}. Estimación orientativa, no sustituye DEXA/balanza.</p>`;
    } else {
      compCard.innerHTML = `<div class="section-title" style="margin-top:0">Composición corporal</div>
        <p class="help">Registra <b>cuello</b> y <b>cintura</b> (abajo) y completa tu estatura en Ajustes para estimar tu % de grasa corporal.</p>`;
    }
    wrap.appendChild(compCard);

    const form = el('div','card');
    form.innerHTML = `<h3>Registrar peso</h3>
      <div class="row" style="gap:8px">
        <input id="w-fecha" type="date" value="${Logic.todayISO()}">
        <input id="w-peso" type="number" inputmode="decimal" step="0.1" placeholder="kg">
        <button class="btn btn-primary" id="w-save">+</button>
      </div>
      <input id="w-obs" placeholder="Observación (opcional)" style="margin-top:8px">`;
    form.querySelector('#w-save').onclick = () => {
      const peso=Number(form.querySelector('#w-peso').value);
      if(!peso) return toast('Ingresa el peso');
      onAdd({ fecha:form.querySelector('#w-fecha').value, peso_kg:peso, observaciones:form.querySelector('#w-obs').value||null });
    };
    wrap.appendChild(form);

    if (weights.length) {
      const chart = el('div','card'); chart.innerHTML='<h3>Curva de peso</h3><div class="chartbox"><canvas id="c-w"></canvas></div>';
      wrap.appendChild(chart);
      const hist = el('div','card'); hist.innerHTML='<h3>Historial</h3>';
      [...weights].reverse().slice(0,30).forEach(w=>{
        const it=el('div','list-item');
        it.innerHTML=`<div><b>${w.peso_kg} kg</b> <span class="ex-meta">${w.fecha}</span><div class="ex-meta">${esc(w.observaciones||'')}</div></div><button class="icon-btn dl">🗑️</button>`;
        it.querySelector('.dl').onclick=()=>{ if(confirm('¿Eliminar registro?')) onDelete(w.id); };
        hist.appendChild(it);
      });
      wrap.appendChild(hist);
      setTimeout(()=>drawWeight(weights, profile),30);
    }

    // --- Medidas corporales ---
    const mForm = el('div','card');
    mForm.innerHTML = `<h3>Registrar medida (cm)</h3>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select id="m-tipo" class="day-sel">
          ${Logic.MEASURE_DEFS.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}
        </select>
        <input id="m-val" type="number" inputmode="decimal" step="0.1" placeholder="cm" style="flex:1;min-width:80px">
        <input id="m-fecha" type="date" value="${Logic.todayISO()}">
        <button class="btn btn-primary" id="m-save">+</button>
      </div>`;
    mForm.querySelector('#m-save').onclick = () => {
      const valor = Number(mForm.querySelector('#m-val').value);
      if (!valor) return toast('Ingresa el valor en cm');
      onAddMeasure({ medida: mForm.querySelector('#m-tipo').value,
        valor_cm: valor, fecha: mForm.querySelector('#m-fecha').value });
    };
    wrap.appendChild(mForm);

    const latest = Logic.latestMeasures(measurements);
    const measuredKeys = Object.keys(latest);
    if (measuredKeys.length) {
      // Últimas medidas (grid)
      const grid = el('div','card');
      grid.innerHTML = '<h3>Últimas medidas</h3><div class="grid3" id="m-grid"></div>';
      const gbox = grid.querySelector('#m-grid');
      Logic.MEASURE_DEFS.filter(([k])=>latest[k]).forEach(([k,l])=>{
        const s = el('div','stat');
        s.innerHTML = `<div class="big" style="font-size:1.5rem">${latest[k].valor_cm}</div><div class="label">${l}</div>`;
        gbox.appendChild(s);
      });
      wrap.appendChild(grid);

      // Gráfico por medida + historial
      const mChartCard = el('div','card');
      mChartCard.innerHTML = `<div class="row between"><h3>Evolución</h3>
        <select id="m-pick" class="day-sel">${Logic.MEASURE_DEFS.filter(([k])=>latest[k]).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="chartbox"><canvas id="c-m"></canvas></div><div id="m-hist"></div>`;
      wrap.appendChild(mChartCard);
      const pick = mChartCard.querySelector('#m-pick');
      const histBox = mChartCard.querySelector('#m-hist');
      const drawSel = () => {
        drawMeasure(measurements, pick.value);
        histBox.innerHTML = '';
        measurements.filter(m=>m.medida===pick.value).slice().reverse().slice(0,10).forEach(m=>{
          const it = el('div','list-item');
          it.innerHTML = `<div><b>${m.valor_cm} cm</b> <span class="ex-meta">${m.fecha}</span></div><button class="icon-btn dl">🗑️</button>`;
          it.querySelector('.dl').onclick = () => { if(confirm('¿Eliminar medida?')) onDeleteMeasure(m.id); };
          histBox.appendChild(it);
        });
      };
      pick.onchange = drawSel;
      setTimeout(drawSel, 40);
    }

    // --- Fotos de progreso ---
    const pCard = el('div','card');
    pCard.innerHTML = `<div class="row between"><h3>📸 Fotos de progreso</h3>
        <label class="btn btn-ghost" style="cursor:pointer">+ Foto<input type="file" id="ph-file" accept="image/*" capture="environment" hidden></label></div>
      <div class="row" style="gap:8px;margin-top:8px">
        <select id="ph-pose" class="day-sel"><option value="frente">Frente</option><option value="lado">Lado</option><option value="espalda">Espalda</option></select>
        <input id="ph-fecha" type="date" value="${Logic.todayISO()}">
      </div>
      <p class="help">Privadas: se guardan en tu almacenamiento personal con acceso restringido (solo tú).</p>
      <div class="photo-grid" id="ph-grid" style="margin-top:10px"></div>`;
    const pgrid = pCard.querySelector('#ph-grid');
    if(!photos.length) pgrid.innerHTML = '<div class="empty" style="grid-column:1/-1">Aún no hay fotos. Sube la primera para comparar tu progreso.</div>';
    photos.slice().reverse().forEach(ph=>{
      const cell = el('div','photo-cell');
      cell.innerHTML = `<img src="${ph.url||''}" alt="${esc(ph.pose||'')}" loading="lazy">
        <span class="pdate">${ph.fecha} · ${esc(ph.pose||'')}</span><button class="pdel">✕</button>`;
      cell.querySelector('.pdel').onclick = () => { if(confirm('¿Eliminar foto?')) onDeletePhoto(ph.id, ph.path); };
      pgrid.appendChild(cell);
    });
    pCard.querySelector('#ph-file').onchange = e => {
      const f = e.target.files[0];
      if(f) onAddPhoto(f, pCard.querySelector('#ph-pose').value, pCard.querySelector('#ph-fecha').value);
    };
    wrap.appendChild(pCard);

    return wrap;
  }
  let mChart;
  function drawMeasure(measurements, medida){
    const c=chartColors();
    const data = Logic.measureSeries(measurements, medida);
    if(mChart) mChart.destroy();
    mChart = new Chart(document.getElementById('c-m'), { type:'line',
      data:{ labels:data.map(d=>d[0].slice(5)), datasets:[{ data:data.map(d=>d[1]), borderColor:c.line, backgroundColor:'transparent', tension:.3, pointRadius:3, fill:false }] },
      options:baseOpts(c) });
  }
  let wChart;
  function drawWeight(weights, profile){
    const c=chartColors();
    const ds=[{ label:'Peso', data:weights.map(w=>Number(w.peso_kg)), borderColor:c.line, tension:.3, pointRadius:3, fill:false }];
    if(profile?.peso_objetivo_kg) ds.push({ label:'Meta', data:weights.map(()=>profile.peso_objetivo_kg), borderColor:c.accent, borderDash:[6,4], pointRadius:0, fill:false });
    if(wChart) wChart.destroy();
    wChart=new Chart(document.getElementById('c-w'),{ type:'line',
      data:{ labels:weights.map(w=>w.fecha.slice(5)), datasets:ds }, options:baseOpts(c) });
  }

  // ---------- NUTRICIÓN ----------
  function macroBar(label, val, target, unit='g'){
    const pct = target ? Math.min(100, Math.round(val/target*100)) : 0;
    const over = target && val > target*1.05;
    return `<div class="macro"><div class="row"><span>${label}</span><b>${Math.round(val)}${target?` / ${target}`:''} ${unit}</b></div>
      <div class="bar ${over?'over':''}"><i style="width:${pct}%"></i></div></div>`;
  }

  function renderNutricion({ logs, profile, lastWeight, weights = [], date, onChangeDate, onSearch, onLog, onDeleteLog, onScan,
                             recipes = [], supplements = [], supplementLogs = [],
                             onAddRecipe, onDeleteRecipe, onAddSupplement, onDeleteSupplement, onToggleSupplement }) {
    const wrap = el('div');
    const t = Logic.effectiveTargets(profile, lastWeight);
    const dayLogs = logs.filter(l => l.fecha === date);
    const sum = Logic.sumFoods(dayLogs);

    // --- Resumen del día ---
    const sumCard = el('div','card');
    const kcalPct = t.kcal ? Math.min(100, Math.round(sum.kcal/t.kcal*100)) : 0;
    const rest = t.kcal ? Math.round(t.kcal - sum.kcal) : null;
    sumCard.innerHTML = `<div class="row between">
        <div class="section-title" style="margin:0">Resumen nutricional</div>
        <input id="n-fecha" type="date" value="${date}" class="day-sel" style="padding:6px 8px">
      </div>
      <div class="kcal-ring"><div class="big">${Math.round(sum.kcal)}</div>
        <div class="label">${t.kcal?`de ${t.kcal} kcal · ${rest>=0?`quedan ${rest}`:`+${-rest} pasado`}`:'kcal (sin objetivo)'}</div></div>
      <div class="bar ${t.kcal&&sum.kcal>t.kcal*1.05?'over':''}" style="margin:6px 0 14px"><i style="width:${kcalPct}%"></i></div>
      ${macroBar('Proteína', sum.prot, t.prot)}
      ${macroBar('Grasa', sum.grasa, t.grasa)}
      ${macroBar('Carbohidratos', sum.carbo, t.carbo)}
      ${!t.kcal?'<p class="help">Completa edad, sexo y actividad en Ajustes para calcular tus objetivos.</p>':''}`;
    sumCard.querySelector('#n-fecha').onchange = e => onChangeDate(e.target.value);
    wrap.appendChild(sumCard);

    // --- Ajuste calórico adaptativo (TDEE real) ---
    const ad = Logic.adaptiveTDEE(weights, logs);
    const adAdvice = Logic.adaptiveAdvice(profile, ad);
    if (adAdvice) {
      const adCard = el('div','card');
      adCard.innerHTML = `<div class="section-title" style="margin-top:0">Ajuste adaptativo (estilo MacroFactor)</div>
        <div class="rec"><span class="${adAdvice.clase}">TDEE ~${ad.tdee} kcal</span> · ${esc(adAdvice.texto)}</div>
        <p class="help">Estimado de tu ingesta real (${ad.loggedDays} días registrados) y la tendencia de tu peso. Se afina semana a semana.</p>`;
      wrap.appendChild(adCard);
    }

    // --- Agregar alimento ---
    const addCard = el('div','card');
    addCard.innerHTML = `<h3>Agregar alimento</h3>
      <div class="row" style="gap:8px">
        <input id="n-q" placeholder="Buscar (ej: avena, pollo, yogur...)" style="flex:1">
        <button class="btn btn-primary" id="n-search">🔍</button>
        <button class="btn btn-ghost" id="n-scan" title="Escanear código">📷</button>
      </div>
      <div class="row" style="gap:8px;margin-top:8px">
        <button class="btn btn-ghost" id="n-manual" style="flex:1">✏️ Entrada manual</button>
      </div>
      <div id="n-results" style="margin-top:8px"></div>`;
    const resBox = addCard.querySelector('#n-results');
    const mealOptions = Logic.MEALS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');

    // Formulario de porción para un alimento elegido
    function portionForm(food){
      resBox.innerHTML = '';
      const def = food.porcion_g || 100;
      const card = el('div','card'); card.style.marginBottom='0';
      card.innerHTML = `<div class="ex-name">${esc(food.nombre)}</div>
        ${food.marca?`<div class="ex-meta">${esc(food.marca)}</div>`:''}
        <div class="ex-meta">por 100 g: ${food.kcal_100??'—'} kcal · P${food.prot_100??'—'} G${food.grasa_100??'—'} C${food.carbo_100??'—'}</div>
        <div class="row" style="gap:8px;margin-top:10px">
          <div style="flex:1"><label class="help">Gramos</label><input id="pf-g" type="number" inputmode="decimal" value="${def}"></div>
          <div style="flex:1"><label class="help">Comida</label><select id="pf-meal" class="day-sel" style="width:100%">${mealOptions}</select></div>
        </div>
        <div class="rec" id="pf-prev"></div>
        <div class="row" style="gap:8px;margin-top:6px">
          <button class="btn btn-primary" id="pf-add" style="flex:1">Agregar</button>
          <button class="btn btn-ghost" id="pf-back">← Volver</button>
        </div>`;
      const gIn = card.querySelector('#pf-g'), prev = card.querySelector('#pf-prev');
      const upd = () => { const m=Logic.macrosFor(food, Number(gIn.value)||0);
        prev.innerHTML = `<b>${m.kcal??'—'}</b> kcal · P ${m.prot??'—'} · G ${m.grasa??'—'} · C ${m.carbo??'—'}`; };
      gIn.oninput = upd; upd();
      card.querySelector('#pf-back').onclick = () => { resBox.innerHTML=''; };
      card.querySelector('#pf-add').onclick = () => {
        const g = Number(gIn.value)||0; if(!g) return toast('Ingresa los gramos');
        const m = Logic.macrosFor(food, g);
        onLog({ fecha:date, comida:card.querySelector('#pf-meal').value, nombre:food.nombre,
          gramos:g, kcal:m.kcal, prot:m.prot, grasa:m.grasa, carbo:m.carbo });
      };
      resBox.appendChild(card);
    }

    function showResults(list){
      resBox.innerHTML = '';
      if(!list.length){ resBox.appendChild(el('div','empty','Sin resultados. Prueba otro término o usa entrada manual.')); return; }
      list.forEach(f=>{
        const r = el('div','food-res');
        r.innerHTML = `<div><div style="font-weight:600">${esc(f.nombre)}</div>
          <div class="ex-meta">${esc(f.marca||'')}${f.marca?' · ':''}${f.kcal_100??'—'} kcal/100g</div></div>
          <span class="pill a">+</span>`;
        r.onclick = () => portionForm(f);
        resBox.appendChild(r);
      });
    }

    // Recientes (reconstruidos desde el historial)
    const recents = []; const seen = new Set();
    logs.forEach(l => { if(l.nombre && !seen.has(l.nombre) && l.gramos>0){ seen.add(l.nombre);
      const f=100/l.gramos;
      recents.push({ nombre:l.nombre, marca:'', kcal_100:l.kcal!=null?+(l.kcal*f).toFixed(1):null,
        prot_100:l.prot!=null?+(l.prot*f).toFixed(1):null, grasa_100:l.grasa!=null?+(l.grasa*f).toFixed(1):null,
        carbo_100:l.carbo!=null?+(l.carbo*f).toFixed(1):null, porcion_g:Number(l.gramos), fuente:'reciente' }); } });

    addCard.querySelector('#n-search').onclick = async () => {
      const q = addCard.querySelector('#n-q').value.trim();
      if(!q) return;
      resBox.innerHTML = '<div class="empty">Buscando...</div>';
      try { showResults(await onSearch(q)); }
      catch { resBox.innerHTML = '<div class="empty">Error de conexión. Intenta de nuevo o usa entrada manual.</div>'; }
    };
    addCard.querySelector('#n-q').addEventListener('keydown', e=>{ if(e.key==='Enter') addCard.querySelector('#n-search').click(); });
    addCard.querySelector('#n-scan').onclick = () => startScanner(async code => {
      resBox.innerHTML = '<div class="empty">Buscando producto…</div>';
      try { const f = await onScan(code); if (f) portionForm(f); else resBox.innerHTML = `<div class="empty">Código ${esc(code)} no encontrado. Usa entrada manual.</div>`; }
      catch { resBox.innerHTML = '<div class="empty">Error al buscar el producto.</div>'; }
    });
    addCard.querySelector('#n-manual').onclick = () => {
      resBox.innerHTML = '';
      const c = el('div','card'); c.style.marginBottom='0';
      c.innerHTML = `<label class="help">Nombre</label><input id="mn-nom" placeholder="Ej: Arroz cocido">
        <div class="grid2" style="margin-top:8px">
          <div><label class="help">Gramos</label><input id="mn-g" type="number" value="100"></div>
          <div><label class="help">Comida</label><select id="mn-meal" class="day-sel" style="width:100%">${mealOptions}</select></div>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div><label class="help">Kcal (en esa porción)</label><input id="mn-kcal" type="number"></div>
          <div><label class="help">Proteína (g)</label><input id="mn-p" type="number" step="0.1"></div>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div><label class="help">Grasa (g)</label><input id="mn-gr" type="number" step="0.1"></div>
          <div><label class="help">Carbos (g)</label><input id="mn-c" type="number" step="0.1"></div>
        </div>
        <button class="btn btn-primary" id="mn-add" style="width:100%;margin-top:12px">Agregar</button>`;
      c.querySelector('#mn-add').onclick = () => {
        const nombre=c.querySelector('#mn-nom').value.trim(); if(!nombre) return toast('Pon un nombre');
        onLog({ fecha:date, comida:c.querySelector('#mn-meal').value, nombre,
          gramos:Number(c.querySelector('#mn-g').value)||0,
          kcal:Number(c.querySelector('#mn-kcal').value)||0, prot:Number(c.querySelector('#mn-p').value)||0,
          grasa:Number(c.querySelector('#mn-gr').value)||0, carbo:Number(c.querySelector('#mn-c').value)||0 });
      };
      resBox.appendChild(c);
    };
    wrap.appendChild(addCard);

    if(recents.length){
      const recCard = el('div','card');
      recCard.innerHTML = '<h3>Recientes</h3>';
      recents.slice(0,8).forEach(f=>{
        const r=el('div','food-res');
        r.innerHTML=`<div><div style="font-weight:600">${esc(f.nombre)}</div><div class="ex-meta">${f.kcal_100??'—'} kcal/100g</div></div><span class="pill a">+</span>`;
        r.onclick=()=>{ resBox.scrollIntoView({behavior:'smooth'}); portionForm(f); };
        recCard.appendChild(r);
      });
      wrap.appendChild(recCard);
    }

    // --- Registro del día por comida ---
    const logCard = el('div','card');
    logCard.innerHTML = `<h3>Hoy comiste</h3>`;
    if(!dayLogs.length){ logCard.appendChild(el('div','empty','Aún no registras comidas este día.')); }
    else {
      Logic.MEALS.forEach(([mk,ml])=>{
        const items = dayLogs.filter(l=>l.comida===mk);
        if(!items.length) return;
        const g=el('div','meal-group'); g.innerHTML=`<h4>${ml}</h4>`;
        items.forEach(l=>{
          const it=el('div','list-item');
          it.innerHTML=`<div><div style="font-weight:600">${esc(l.nombre||'')}</div>
            <div class="ex-meta">${l.gramos} g · ${Math.round(l.kcal||0)} kcal · P${l.prot??'—'} G${l.grasa??'—'} C${l.carbo??'—'}</div></div>
            <button class="icon-btn dl">🗑️</button>`;
          it.querySelector('.dl').onclick=()=>{ if(confirm('¿Eliminar registro?')) onDeleteLog(l.id); };
          g.appendChild(it);
        });
        logCard.appendChild(g);
      });
    }
    wrap.appendChild(logCard);

    // --- Recetas ---
    const recCard = el('div','card');
    recCard.innerHTML = `<h3>🍴 Recetas</h3>`;
    if (!recipes.length) recCard.appendChild(el('div','empty','Crea recetas para loguear tus platos al toque.'));
    recipes.forEach(rc => {
      const it = el('div','list-item');
      it.innerHTML = `<div><div style="font-weight:600">${esc(rc.nombre)}</div>
        <div class="ex-meta">${Math.round(rc.kcal||0)} kcal · P${rc.prot??'—'} G${rc.grasa??'—'} C${rc.carbo??'—'} /porción</div></div>
        <div class="row" style="gap:4px"><button class="icon-btn lg" title="Loguear">➕</button><button class="icon-btn dl">🗑️</button></div>`;
      it.querySelector('.lg').onclick = () => {
        const por = Number(prompt('¿Cuántas porciones?', '1')) || 0; if (!por) return;
        onLog({ fecha:date, comida:'almuerzo', nombre:`${rc.nombre} (${por}p)`, gramos:por,
          kcal:Math.round((rc.kcal||0)*por), prot:+((rc.prot||0)*por).toFixed(1), grasa:+((rc.grasa||0)*por).toFixed(1), carbo:+((rc.carbo||0)*por).toFixed(1) });
      };
      it.querySelector('.dl').onclick = () => { if(confirm('¿Eliminar receta?')) onDeleteRecipe(rc.id); };
      recCard.appendChild(it);
    });
    const rf = el('div'); rf.style.marginTop='8px';
    rf.innerHTML = `<div class="divider"></div><label class="help">Nueva receta (macros por porción)</label>
      <input id="rc-n" placeholder="Nombre del plato">
      <div class="grid2" style="margin-top:8px"><div><label class="help">Kcal</label><input id="rc-k" type="number"></div><div><label class="help">Proteína</label><input id="rc-p" type="number"></div></div>
      <div class="grid2" style="margin-top:8px"><div><label class="help">Grasa</label><input id="rc-g" type="number"></div><div><label class="help">Carbos</label><input id="rc-c" type="number"></div></div>
      <button class="btn btn-primary" id="rc-add" style="width:100%;margin-top:10px">Guardar receta</button>`;
    rf.querySelector('#rc-add').onclick = () => { const n=rf.querySelector('#rc-n').value.trim(); if(!n) return toast('Pon un nombre');
      onAddRecipe({ nombre:n, porciones:1, kcal:Number(rf.querySelector('#rc-k').value)||null, prot:Number(rf.querySelector('#rc-p').value)||null,
        grasa:Number(rf.querySelector('#rc-g').value)||null, carbo:Number(rf.querySelector('#rc-c').value)||null }); };
    recCard.appendChild(rf);
    wrap.appendChild(recCard);

    // --- Suplementos ---
    const supDone = new Set(supplementLogs.filter(l=>l.fecha===date).map(l=>l.supplement_id));
    const spCard = el('div','card');
    spCard.innerHTML = `<h3>💊 Suplementos</h3>`;
    if (!supplements.length) spCard.appendChild(el('div','empty','Agrega tus suplementos (creatina, proteína...).'));
    supplements.forEach(s => {
      const done = supDone.has(s.id);
      const ev = s.evidencia ? `<span class="pill ${s.evidencia==='alta'?'b':'a'}">${esc(s.evidencia)}</span>` : '';
      const it = el('div','list-item');
      it.innerHTML = `<div class="row" style="gap:8px"><button class="icon-btn st" style="${done?'background:var(--grad);color:#04201d':''}">${done?'✓':'○'}</button>
        <div><div style="font-weight:600">${esc(s.nombre)} ${ev}</div><div class="ex-meta">${esc(s.dosis||'')}${s.horario?` · ${esc(s.horario)}`:''}</div></div></div>
        <button class="icon-btn dl">🗑️</button>`;
      it.querySelector('.st').onclick = () => onToggleSupplement(s.id, date, !done);
      it.querySelector('.dl').onclick = () => { if(confirm('¿Quitar suplemento?')) onDeleteSupplement(s.id); };
      spCard.appendChild(it);
    });
    const sf = el('div'); sf.style.marginTop='8px';
    sf.innerHTML = `<div class="divider"></div>
      <div class="row" style="gap:8px"><input id="sp-n" placeholder="Suplemento" style="flex:1"><input id="sp-d" placeholder="Dosis" style="width:90px"></div>
      <div class="row" style="gap:8px;margin-top:8px"><input id="sp-h" placeholder="Horario" style="flex:1">
        <select id="sp-e" class="day-sel"><option value="">Evidencia</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
        <button class="btn btn-primary" id="sp-add">+</button></div>`;
    sf.querySelector('#sp-add').onclick = () => { const n=sf.querySelector('#sp-n').value.trim(); if(!n) return toast('Pon un nombre');
      onAddSupplement({ nombre:n, dosis:sf.querySelector('#sp-d').value.trim()||null, horario:sf.querySelector('#sp-h').value.trim()||null, evidencia:sf.querySelector('#sp-e').value||null }); };
    spCard.appendChild(sf);
    wrap.appendChild(spCard);

    return wrap;
  }

  // ---------- SALUD (sueño, estado, hábitos, lesiones, objetivos) ----------
  function rating(id, val){ return `<select id="${id}" class="day-sel" style="width:100%">
    <option value="">—</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(val)===n?'selected':''}>${n}</option>`).join('')}</select>`; }

  function renderSalud(p){
    const { sleep, wellness, habits, habitLogs, injuries, goals, ctx, profile, cardio = [], rehab = [],
      onSleep, onWellness, onAddHabit, onDeleteHabit, onToggleHabit,
      onAddInjury, onUpdateInjury, onDeleteInjury, onAddGoal, onDeleteGoal,
      onCardio, onDeleteCardio, onRehab } = p;
    const wrap = el('div');
    const today = Logic.todayISO();
    const sToday = sleep.find(x=>x.fecha===today) || {};
    const wToday = wellness.find(x=>x.fecha===today) || {};

    // Readiness
    const rd = Logic.readiness(sToday, wToday);
    if (rd != null){
      const rc = el('div','card'); rc.style.borderLeft='3px solid var(--primary)';
      const lbl = rd>=75?'Listo para entrenar fuerte':rd>=50?'Estado moderado':'Prioriza recuperación';
      rc.innerHTML = `<div class="row between"><div><div class="section-title" style="margin:0">Readiness de hoy</div>
        <div class="ex-meta">${lbl}</div></div><div class="big">${rd}</div></div>`;
      wrap.appendChild(rc);
    }

    // --- Cardio ---
    const today2 = Logic.todayISO();
    const cCard = el('div','card');
    const mods = [['caminata','Caminata'],['trote','Trote'],['bici','Bici'],['hiit','HIIT'],['eliptica','Elíptica'],['remo','Remo'],['otro','Otro']];
    cCard.innerHTML = `<h3>🏃 Cardio</h3>
      <div class="row" style="gap:8px">
        <div style="flex:1"><label class="help">Modalidad</label><select id="c-mod" class="day-sel" style="width:100%">${mods.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
        <div style="width:90px"><label class="help">Min</label><input id="c-dur" type="number" inputmode="numeric"></div>
      </div>
      <div class="grid3" style="margin-top:8px">
        <div><label class="help">Km</label><input id="c-dist" type="number" step="0.1"></div>
        <div><label class="help">FC media</label><input id="c-fcm" type="number"></div>
        <div><label class="help">RPE</label><input id="c-rpe" type="number"></div>
      </div>
      <button class="btn btn-primary" id="c-save" style="width:100%;margin-top:10px">Registrar cardio</button>`;
    cCard.querySelector('#c-save').onclick = () => {
      const dur = Number(cCard.querySelector('#c-dur').value)||null;
      if (!dur) return toast('Indica los minutos');
      onCardio({ fecha:today2, modalidad:cCard.querySelector('#c-mod').value, duracion_min:dur,
        distancia_km:Number(cCard.querySelector('#c-dist').value)||null, fc_media:Number(cCard.querySelector('#c-fcm').value)||null,
        rpe:Number(cCard.querySelector('#c-rpe').value)||null });
    };
    if (cardio.length){
      cCard.appendChild(el('div','divider'));
      cardio.slice(0,8).forEach(c=>{
        const zona = Logic.zoneOf(c.fc_media, profile?.edad);
        const it = el('div','list-item');
        it.innerHTML = `<div><div style="font-weight:600">${esc(c.modalidad||'')} · ${c.duracion_min} min</div>
          <div class="ex-meta">${c.fecha}${c.distancia_km?` · ${c.distancia_km} km`:''}${c.fc_media?` · FC ${c.fc_media}${zona?` (${zona})`:''}`:''}${c.rpe?` · RPE ${c.rpe}`:''}</div></div>
          <button class="icon-btn dl">🗑️</button>`;
        it.querySelector('.dl').onclick = () => { if(confirm('¿Eliminar registro?')) onDeleteCardio(c.id); };
        cCard.appendChild(it);
      });
    }
    wrap.appendChild(cCard);

    // --- Movilidad guiada ---
    const mCard = el('div','card');
    mCard.innerHTML = `<h3>🧘 Movilidad guiada</h3><p class="help">Rutinas con temporizador automático.</p>`;
    (window.MOBILITY_ROUTINES||[]).forEach(r=>{
      const it = el('div','list-item');
      const total = Math.round(r.items.reduce((a,x)=>a+x.s,0)/60);
      it.innerHTML = `<div><div style="font-weight:600">${r.icono||''} ${esc(r.nombre)}</div>
        <div class="ex-meta">${r.items.length} ejercicios · ~${total} min</div></div><button class="icon-btn go">▶️</button>`;
      it.querySelector('.go').onclick = () => startMobility(r);
      mCard.appendChild(it);
    });
    wrap.appendChild(mCard);

    // --- Objetivos ---
    const gCard = el('div','card');
    gCard.innerHTML = `<div class="row between"><h3 style="margin:0">🎯 Objetivos</h3></div>`;
    const active = goals.filter(g=>g.estado==='activo');
    if (!active.length) gCard.appendChild(el('div','empty','Sin objetivos activos. Crea uno abajo.'));
    active.forEach(g=>{
      const cur = Logic.goalCurrentValue(g, ctx);
      const pct = Logic.goalProgress(g, cur);
      const dleft = g.fecha_objetivo ? Math.ceil((new Date(g.fecha_objetivo)-Date.now())/86400000) : null;
      const it = el('div'); it.style.margin='10px 0';
      it.innerHTML = `<div class="row between"><b>${esc(g.titulo)}</b>
        <button class="icon-btn dl" title="Eliminar">🗑️</button></div>
        <div class="ex-meta">${cur!=null?`Actual ${cur}${g.unidad||''} → `:''}meta ${g.valor_objetivo}${g.unidad||''}${dleft!=null?` · ${dleft>0?dleft+' días':'vencido'}`:''}</div>
        ${pct!=null?`<div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div>`:'<p class="help">Sin datos para calcular progreso aún.</p>'}`;
      it.querySelector('.dl').onclick = () => { if(confirm('¿Eliminar objetivo?')) onDeleteGoal(g.id); };
      gCard.appendChild(it);
    });
    // form
    const gf = el('div'); gf.style.marginTop='10px';
    gf.innerHTML = `<div class="divider"></div>
      <label class="help">Nuevo objetivo</label>
      <input id="g-tit" placeholder="Ej: Bajar a 64 kg / Press banca 70 kg">
      <div class="grid3" style="margin-top:8px">
        <div><label class="help">Tipo</label><select id="g-tipo" class="day-sel" style="width:100%">
          <option value="peso">Peso</option><option value="medida">Medida</option><option value="fuerza">Fuerza (e1RM)</option><option value="libre">Libre</option></select></div>
        <div><label class="help">Inicial</label><input id="g-ini" type="number" step="0.1"></div>
        <div><label class="help">Meta</label><input id="g-obj" type="number" step="0.1"></div>
      </div>
      <div class="grid3" style="margin-top:8px">
        <div><label class="help">Unidad</label><input id="g-uni" placeholder="kg / cm"></div>
        <div style="grid-column:span 2"><label class="help">Referencia (medida/ejercicio)</label><input id="g-ref" placeholder="cintura / Press banca con barra"></div>
      </div>
      <label class="help" style="margin-top:8px">Fecha objetivo</label><input id="g-fecha" type="date">
      <button class="btn btn-primary" id="g-add" style="width:100%;margin-top:10px">Crear objetivo</button>`;
    gf.querySelector('#g-add').onclick = () => {
      const titulo = gf.querySelector('#g-tit').value.trim(); if(!titulo) return toast('Pon un título');
      onAddGoal({ titulo, tipo:gf.querySelector('#g-tipo').value, referencia:gf.querySelector('#g-ref').value.trim()||null,
        valor_inicial:Number(gf.querySelector('#g-ini').value)||null, valor_objetivo:Number(gf.querySelector('#g-obj').value)||null,
        unidad:gf.querySelector('#g-uni').value.trim()||null, fecha_objetivo:gf.querySelector('#g-fecha').value||null, estado:'activo' });
    };
    gCard.appendChild(gf);
    wrap.appendChild(gCard);

    // --- Sueño ---
    const slCard = el('div','card');
    slCard.innerHTML = `<h3>😴 Sueño de hoy</h3>
      <div class="row" style="gap:8px">
        <div style="flex:1"><label class="help">Horas</label><input id="sl-h" type="number" step="0.5" value="${sToday.horas??''}"></div>
        <div style="flex:1"><label class="help">Calidad (1-5)</label>${rating('sl-q', sToday.calidad)}</div>
        <div style="align-self:flex-end"><button class="btn btn-primary" id="sl-save">Guardar</button></div>
      </div>`;
    slCard.querySelector('#sl-save').onclick = () => onSleep({ fecha:today,
      horas:Number(slCard.querySelector('#sl-h').value)||null, calidad:Number(slCard.querySelector('#sl-q').value)||null });
    wrap.appendChild(slCard);

    // --- Estado (ánimo/estrés/energía) ---
    const wlCard = el('div','card');
    wlCard.innerHTML = `<h3>🧠 Estado de hoy</h3>
      <div class="grid3">
        <div><label class="help">Ánimo</label>${rating('wl-a', wToday.animo)}</div>
        <div><label class="help">Estrés</label>${rating('wl-s', wToday.estres)}</div>
        <div><label class="help">Energía</label>${rating('wl-e', wToday.energia)}</div>
      </div>
      <button class="btn btn-primary" id="wl-save" style="width:100%;margin-top:10px">Guardar estado</button>`;
    wlCard.querySelector('#wl-save').onclick = () => onWellness({ fecha:today,
      animo:Number(wlCard.querySelector('#wl-a').value)||null, estres:Number(wlCard.querySelector('#wl-s').value)||null,
      energia:Number(wlCard.querySelector('#wl-e').value)||null });
    wrap.appendChild(wlCard);

    // --- Hábitos ---
    const hCard = el('div','card');
    hCard.innerHTML = `<h3>🔁 Hábitos</h3>`;
    if (!habits.length) hCard.appendChild(el('div','empty','Crea tus hábitos diarios (agua, proteína, pasos...).'));
    const doneToday = new Set(habitLogs.filter(l=>l.fecha===today).map(l=>l.habit_id));
    habits.forEach(hb=>{
      const done = doneToday.has(hb.id);
      const streak = Logic.habitStreak(habitLogs, hb.id);
      const it = el('div','list-item');
      it.innerHTML = `<div class="row" style="gap:8px"><button class="icon-btn ht" style="${done?'background:var(--grad);color:#04201d':''}">${done?'✓':'○'}</button>
        <div><div style="font-weight:600">${esc(hb.icono||'')} ${esc(hb.nombre)}</div>
        <div class="ex-meta">${streak>0?`🔥 ${streak} días`:'sin racha'}</div></div></div>
        <button class="icon-btn hd">🗑️</button>`;
      it.querySelector('.ht').onclick = () => onToggleHabit(hb.id, today, !done);
      it.querySelector('.hd').onclick = () => { if(confirm(`¿Eliminar hábito "${hb.nombre}"?`)) onDeleteHabit(hb.id); };
      hCard.appendChild(it);
    });
    const hf = el('div','row'); hf.style.cssText='gap:8px;margin-top:10px';
    hf.innerHTML = `<input id="h-ico" placeholder="💧" style="width:64px;text-align:center">
      <input id="h-nom" placeholder="Nuevo hábito" style="flex:1">
      <button class="btn btn-primary" id="h-add">+</button>`;
    hf.querySelector('#h-add').onclick = () => { const n=hf.querySelector('#h-nom').value.trim(); if(!n) return toast('Nombre del hábito');
      onAddHabit({ nombre:n, icono:hf.querySelector('#h-ico').value.trim()||'✅', orden:habits.length }); };
    hCard.appendChild(hf);
    wrap.appendChild(hCard);

    // --- Lesiones ---
    const iCard = el('div','card');
    iCard.innerHTML = `<h3>🩹 Lesiones</h3>`;
    if (!injuries.length) iCard.appendChild(el('div','empty','Sin lesiones registradas.'));
    injuries.forEach(inj=>{
      const it = el('div','list-item');
      it.innerHTML = `<div><div style="font-weight:600">${esc(inj.zona)} ${inj.severidad?`· sev ${inj.severidad}/5`:''} ${inj.estado==='recuperada'?'<span class="pill b">recuperada</span>':'<span class="pill a">activa</span>'}</div>
        <div class="ex-meta">${esc(inj.tipo||'')} ${inj.fecha_inicio?`· desde ${inj.fecha_inicio}`:''}${inj.notas?` · ${esc(inj.notas)}`:''}</div></div>
        <div class="row" style="gap:4px">${inj.estado==='activa'?'<button class="icon-btn ok" title="Marcar recuperada">✅</button>':''}<button class="icon-btn dl">🗑️</button></div>`;
      if(inj.estado==='activa') it.querySelector('.ok').onclick = () => onUpdateInjury(inj.id, { estado:'recuperada', fecha_fin:today });
      it.querySelector('.dl').onclick = () => { if(confirm('¿Eliminar lesión?')) onDeleteInjury(inj.id); };
      iCard.appendChild(it);

      // Rehab: registro de dolor + semáforo de carga segura (solo lesiones activas)
      if (inj.estado === 'activa'){
        const logs = rehab.filter(r => r.injury_id === inj.id).sort((a,b)=> a.fecha<b.fecha?-1:1);
        const lastPain = logs.length ? logs[logs.length-1].dolor : null;
        const sem = lastPain==null ? '' : lastPain<=3 ? 'g' : lastPain<=6 ? 'y' : 'r';
        const safe = lastPain==null ? 'Registra tu dolor para una guía de carga.'
          : lastPain<=3 ? 'Dolor bajo: puedes progresar carga con cuidado.'
          : lastPain<=6 ? 'Dolor moderado: mantén carga, sin forzar.'
          : 'Dolor alto: reduce carga o descansa. Si persiste, consulta.';
        const rb = el('div'); rb.style.cssText = 'padding:4px 0 10px 8px;border-left:2px solid var(--line);margin:0 0 8px 4px';
        rb.innerHTML = `<div class="ex-meta">${sem?`<span class="sem ${sem}"></span>`:''}${lastPain!=null?`Último dolor: ${lastPain}/10 · `:''}${safe}</div>
          <div class="row" style="gap:8px;margin-top:6px">
            <div style="width:90px"><label class="help">Dolor 0-10</label><input class="rh-d" type="number" min="0" max="10"></div>
            <div style="flex:1"><label class="help">Carga</label><select class="rh-c day-sel" style="width:100%">
              <option value="descanso">Descanso</option><option value="suave">Suave</option><option value="moderada">Moderada</option><option value="normal">Normal</option></select></div>
            <div style="align-self:flex-end"><button class="btn btn-ghost rh-save">Registrar</button></div>
          </div>`;
        rb.querySelector('.rh-save').onclick = () => {
          const d = rb.querySelector('.rh-d').value;
          if (d==='') return toast('Indica el dolor 0-10');
          onRehab({ injury_id:inj.id, fecha:today, dolor:Number(d), carga:rb.querySelector('.rh-c').value });
        };
        iCard.appendChild(rb);
      }
    });
    const inf = el('div'); inf.style.marginTop='10px';
    inf.innerHTML = `<div class="divider"></div>
      <div class="row" style="gap:8px"><input id="i-zona" placeholder="Zona (ej: pulgar derecho)" style="flex:1">
        <div style="width:120px"><label class="help">Gravedad 1-5</label>${rating('i-sev','')}</div></div>
      <input id="i-tipo" placeholder="Tipo (tendinopatía, contractura...)" style="margin-top:8px">
      <input id="i-notas" placeholder="Notas (opcional)" style="margin-top:8px">
      <button class="btn btn-primary" id="i-add" style="width:100%;margin-top:10px">Registrar lesión</button>`;
    inf.querySelector('#i-add').onclick = () => { const z=inf.querySelector('#i-zona').value.trim(); if(!z) return toast('Indica la zona');
      onAddInjury({ zona:z, tipo:inf.querySelector('#i-tipo').value.trim()||null, severidad:Number(inf.querySelector('#i-sev').value)||null,
        notas:inf.querySelector('#i-notas').value.trim()||null, estado:'activa', fecha_inicio:today }); };
    iCard.appendChild(inf);
    wrap.appendChild(iCard);

    return wrap;
  }

  // ---------- AJUSTES ----------
  function renderAjustes({ profile, email, lastWeight, onSaveProfile, onExport, onImport, onSignOut,
                           onPushEnable, onPushDisable, onPushTest, onSaveReminders }) {
    const wrap = el('div');
    const p = profile || {};
    const card = el('div','card');
    card.innerHTML = `<h3>Perfil</h3>
      <div class="grid3">
        <div><label class="help">Edad</label><input id="p-edad" type="number" value="${p.edad??''}"></div>
        <div><label class="help">Estatura (cm)</label><input id="p-est" type="number" value="${p.estatura_cm??''}"></div>
        <div><label class="help">Sexo</label><select id="p-sexo" class="day-sel" style="width:100%">
          <option value="h" ${(p.sexo||'h')==='h'?'selected':''}>Hombre</option>
          <option value="m" ${p.sexo==='m'?'selected':''}>Mujer</option></select></div>
      </div>
      <label class="help" style="margin-top:8px">Nivel de actividad</label>
      <select id="p-act" style="width:100%">${Logic.ACTIVITY.map(([v,l])=>`<option value="${v}" ${Number(p.actividad||1.45)===v?'selected':''}>${l}</option>`).join('')}</select>
      <label class="help" style="margin-top:8px">Objetivo</label>
      <select id="p-obj">${[['recomposicion','Recomposición'],['ganar','Ganar músculo'],['perder','Perder grasa'],['mantener','Mantener'],['fuerza','Fuerza']].map(([v,t])=>`<option value="${v}" ${p.objetivo===v?'selected':''}>${t}</option>`).join('')}</select>
      <div class="grid2" style="margin-top:8px">
        <div><label class="help">Meta peso (kg)</label><input id="p-meta" type="number" step="0.1" value="${p.peso_objetivo_kg??''}"></div>
        <div><label class="help">% graso conocido</label><input id="p-bf" type="number" step="0.1" value="${p.grasa_pct??''}"></div>
      </div>
      <div class="row between" style="margin-top:14px"><div class="section-title" style="margin:0">Objetivos nutricionales</div>
        <button class="btn-link" id="p-calc">⚡ Calcular auto</button></div>
      <div id="p-tdee" class="help"></div>
      <div class="grid2" style="margin-top:6px">
        <div><label class="help">Kcal objetivo</label><input id="p-kcal" type="number" value="${p.kcal_objetivo??''}"></div>
        <div><label class="help">Proteína (g)</label><input id="p-prot" type="number" value="${p.proteina_g??''}"></div>
      </div>
      <div class="grid2" style="margin-top:8px">
        <div><label class="help">Grasa (g)</label><input id="p-grasa" type="number" value="${p.grasa_g??''}"></div>
        <div><label class="help">Carbos (g)</label><input id="p-carbo" type="number" value="${p.carbo_g??''}"></div>
      </div>
      <button class="btn btn-primary" id="p-save" style="width:100%;margin-top:12px">Guardar perfil</button>`;

    const readProfile = () => ({
      edad:Number(card.querySelector('#p-edad').value)||null,
      estatura_cm:Number(card.querySelector('#p-est').value)||null,
      sexo:card.querySelector('#p-sexo').value,
      actividad:Number(card.querySelector('#p-act').value)||1.45,
      objetivo:card.querySelector('#p-obj').value,
      peso_objetivo_kg:Number(card.querySelector('#p-meta').value)||null,
      grasa_pct:Number(card.querySelector('#p-bf').value)||null,
    });
    card.querySelector('#p-calc').onclick = () => {
      const draft = { ...p, ...readProfile() };
      const tg = Logic.nutritionTargets(draft, lastWeight);
      if(!tg){ toast('Completa edad, estatura y peso'); return; }
      card.querySelector('#p-kcal').value = tg.kcal;
      card.querySelector('#p-prot').value = tg.prot;
      card.querySelector('#p-grasa').value = tg.grasa;
      card.querySelector('#p-carbo').value = tg.carbo;
      card.querySelector('#p-tdee').innerHTML = `BMR ~${tg.bmr} · mantenimiento ~${tg.maint} kcal → objetivo ${tg.kcal} kcal`;
    };
    card.querySelector('#p-save').onclick = () => onSaveProfile({
      ...readProfile(),
      kcal_objetivo:Number(card.querySelector('#p-kcal').value)||null,
      proteina_g:Number(card.querySelector('#p-prot').value)||null,
      grasa_g:Number(card.querySelector('#p-grasa').value)||null,
      carbo_g:Number(card.querySelector('#p-carbo').value)||null,
    });
    wrap.appendChild(card);

    const sync = el('div','card');
    sync.innerHTML = `<h3>Sincronizar con Kratos</h3>
      <p class="help">Exporta tus datos en el mismo formato CSV que usa Kratos para analizar tu progreso.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn btn-ghost" id="exp-ent">⬇️ entrenamientos.csv</button>
        <button class="btn btn-ghost" id="exp-peso">⬇️ peso_corporal.csv</button>
      </div>
      <div class="divider"></div>
      <p class="help">Importar entrenamientos.csv (esquema Kratos):</p>
      <input type="file" id="imp-file" accept=".csv">`;
    sync.querySelector('#exp-ent').onclick = () => onExport('entrenamientos');
    sync.querySelector('#exp-peso').onclick = () => onExport('peso');
    sync.querySelector('#imp-file').onchange = e => { if(e.target.files[0]) onImport(e.target.files[0]); };
    wrap.appendChild(sync);

    // --- Notificaciones ---
    const rem = (profile && profile.reminders) || {};
    const notif = el('div','card');
    notif.innerHTML = `<h3>🔔 Notificaciones</h3>
      <p class="help" id="nz-status">Comprobando…</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="nz-on">Activar</button>
        <button class="btn btn-ghost" id="nz-test">Probar</button>
        <button class="btn btn-ghost" id="nz-off">Desactivar</button>
      </div>
      <div class="divider"></div>
      <div class="section-title" style="margin-top:0">Recordatorios diarios</div>
      <div class="row between" style="margin:6px 0"><label><input type="checkbox" id="rm-ent" ${rem.entrenar?.on?'checked':''}> 🏋️ Entrenar</label>
        <input type="time" id="rm-ent-h" value="${rem.entrenar?.hora||'18:00'}" class="day-sel" style="padding:6px 8px"></div>
      <div class="row between" style="margin:6px 0"><label><input type="checkbox" id="rm-pes" ${rem.pesarse?.on?'checked':''}> ⚖️ Pesarse</label>
        <input type="time" id="rm-pes-h" value="${rem.pesarse?.hora||'08:00'}" class="day-sel" style="padding:6px 8px"></div>
      <div class="row between" style="margin:6px 0"><label><input type="checkbox" id="rm-agua" ${rem.agua?.on?'checked':''}> 💧 Hidratación (tarde)</label></div>
      <button class="btn btn-primary" id="nz-save" style="width:100%;margin-top:10px">Guardar recordatorios</button>
      <p class="help">Los recordatorios programados requieren que la app esté instalada y la Edge Function desplegada (ver db/push-setup.md).</p>`;
    const statusEl = notif.querySelector('#nz-status');
    if (!onPushEnable) statusEl.textContent = 'No disponible.';
    else (async () => {
      try {
        if (!window.Push || !Push.supported()) { statusEl.textContent = 'Tu dispositivo no soporta notificaciones push.'; return; }
        const sub = await Push.isSubscribed();
        statusEl.textContent = sub ? '✅ Activadas en este dispositivo.' : 'Permiso: ' + Push.permission() + '. Pulsa Activar.';
      } catch { statusEl.textContent = ''; }
    })();
    notif.querySelector('#nz-on').onclick = () => onPushEnable && onPushEnable();
    notif.querySelector('#nz-off').onclick = () => onPushDisable && onPushDisable();
    notif.querySelector('#nz-test').onclick = () => onPushTest && onPushTest();
    notif.querySelector('#nz-save').onclick = () => onSaveReminders && onSaveReminders({
      entrenar: { on: notif.querySelector('#rm-ent').checked, hora: notif.querySelector('#rm-ent-h').value },
      pesarse:  { on: notif.querySelector('#rm-pes').checked, hora: notif.querySelector('#rm-pes-h').value },
      agua:     { on: notif.querySelector('#rm-agua').checked },
    });
    wrap.appendChild(notif);

    const acc = el('div','card');
    acc.innerHTML = `<h3>Cuenta</h3><p class="muted">${esc(email||'')}</p>
      <button class="btn btn-ghost" id="logout" style="width:100%">Cerrar sesión</button>`;
    acc.querySelector('#logout').onclick = onSignOut;
    wrap.appendChild(acc);
    return wrap;
  }

  return { $, el, esc, toast, setMain, renderDashboard, renderHoy, renderRutina, exerciseForm,
           renderAvances, renderPeso, renderNutricion, renderSalud, renderAjustes, startCoachChat };
})();
