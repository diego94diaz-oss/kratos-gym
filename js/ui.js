// ============================================================
//  UI — Render de vistas + utilidades de DOM
// ============================================================
const UI = (() => {
  const $ = (s, r=document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; };
  const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let toastT;
  function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.add('hidden'),2200); }

  function setMain(node){ const m=$('#main'); m.innerHTML=''; m.appendChild(node); m.scrollTop=0; }

  // ---------- HOY (registrar sesión) ----------
  function renderHoy({ day, exercises, sets, onSave, onChangeDay }) {
    const wrap = el('div');
    const dayEx = exercises.filter(e => e.dia === day && e.activo !== false)
                           .sort((a,b)=>a.orden-b.orden);
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

    const state = {}; // ejId -> [{reps,peso,rir}]
    dayEx.forEach(ex => {
      const rec = Logic.recommend(ex, sets);
      const last = Logic.lastSessionOf(sets, ex.nombre);
      const card = el('div','card ex-card');
      const unidadTxt = ex.unidad==='tiempo'?'seg':ex.unidad==='peso_corporal'?'reps':'kg';
      const repsLbl = ex.unidad==='tiempo'?'seg':'reps';
      card.innerHTML = `
        <div class="ex-head">
          <div><div class="ex-name">${esc(ex.nombre)}</div>
          <div class="ex-meta">${ex.series_obj}×${ex.reps_min}-${ex.reps_max} · RIR ${ex.rir_obj ?? '—'} · ${esc(ex.grupo||'')}</div></div>
          <span class="pill ${day==='A'?'a':'b'}">${day}</span>
        </div>
        <div class="rec"><span class="${rec.clase}">${rec.accion.toUpperCase()}</span> · ${esc(rec.texto)}</div>
        ${last?`<div class="ex-meta">Última (${last.fecha}): ${last.sets.map(s=>`${s.reps}×${s.peso_kg}${unidadTxt}`).join(', ')}</div>`:''}
        <div class="mini-label"><span>#</span><span>${repsLbl}</span><span>${unidadTxt==='reps'?'—':unidadTxt}</span><span>RIR</span><span></span></div>
        <div class="sets"></div>
        <button class="btn btn-ghost add-set">+ Serie</button>`;
      const setsBox = card.querySelector('.sets');
      state[ex.id] = [];
      const prefill = rec.peso!=null ? rec.peso : (last? Math.max(...last.sets.map(s=>s.peso_kg)) : '');
      const addRow = (reps='', peso=prefill, rir=ex.rir_obj ?? '') => {
        const i = state[ex.id].length;
        const row = el('div','set-row');
        const noWeight = ex.unidad==='peso_corporal' || ex.unidad==='tiempo';
        row.innerHTML = `<span class="sn">${i+1}</span>
          <input type="number" inputmode="numeric" class="i-reps" placeholder="${ex.reps_min}-${ex.reps_max}" value="${reps}">
          <input type="number" inputmode="decimal" class="i-peso" placeholder="${noWeight?'—':'kg'}" value="${noWeight?'':peso}" ${noWeight?'disabled':''}>
          <input type="number" inputmode="numeric" class="i-rir" placeholder="RIR" value="${rir}">
          <button class="del" title="Quitar">✕</button>`;
        const obj = { reps:'', peso:noWeight?0:peso, rir };
        state[ex.id].push(obj);
        row.querySelector('.i-reps').oninput = e => obj.reps = e.target.value;
        row.querySelector('.i-peso').oninput = e => obj.peso = e.target.value;
        row.querySelector('.i-rir').oninput  = e => obj.rir  = e.target.value;
        row.querySelector('.del').onclick = () => { const idx=state[ex.id].indexOf(obj); state[ex.id].splice(idx,1); row.remove(); [...setsBox.children].forEach((r,n)=>r.querySelector('.sn').textContent=n+1); };
        setsBox.appendChild(row);
      };
      for (let s=0; s<ex.series_obj; s++) addRow();
      card.querySelector('.add-set').onclick = () => addRow();
      card._ex = ex; card._state = () => state[ex.id];
      wrap.appendChild(card);
    });

    const saveBtn = el('button','btn btn-primary','💾 Guardar sesión');
    saveBtn.style.cssText='width:100%;padding:16px;font-size:16px;margin-bottom:20px';
    saveBtn.onclick = () => {
      const rows = [];
      wrap.querySelectorAll('.ex-card').forEach(card => {
        const ex = card._ex;
        card._state().forEach((s, idx) => {
          if (s.reps === '' || s.reps == null) return;
          rows.push({ fecha:Logic.todayISO(), rutina:day, ejercicio:ex.nombre, exercise_id:ex.id,
            serie:idx+1, reps:Number(s.reps), peso_kg:Number(s.peso)||0,
            rir:s.rir===''?null:Number(s.rir), observaciones:null });
        });
      });
      if (!rows.length) return toast('Registra al menos una serie');
      onSave(rows);
    };
    wrap.appendChild(saveBtn);
    return wrap;
  }

  // ---------- RUTINA ----------
  function renderRutina({ exercises, onAdd, onEdit, onDelete }) {
    const wrap = el('div');
    wrap.appendChild(el('div','section-title','Rutina Full Body A/B · Recomposición'));
    ['A','B'].forEach(d => {
      const list = exercises.filter(e=>e.dia===d).sort((a,b)=>a.orden-b.orden);
      const card = el('div','card');
      card.innerHTML = `<div class="row between"><h3>Día ${d} <span class="pill ${d==='A'?'a':'b'}">${list.length} ejercicios</span></h3></div>`;
      list.forEach(ex => {
        const it = el('div','list-item');
        it.innerHTML = `<div><div style="font-weight:600">${esc(ex.nombre)}</div>
          <div class="ex-meta">${ex.series_obj}×${ex.reps_min}-${ex.reps_max} · RIR ${ex.rir_obj??'—'} · ${esc(ex.unidad)}</div></div>
          <div class="row"><button class="icon-btn ed">✏️</button><button class="icon-btn dl">🗑️</button></div>`;
        it.querySelector('.ed').onclick = () => onEdit(ex);
        it.querySelector('.dl').onclick = () => { if(confirm(`¿Eliminar "${ex.nombre}"?`)) onDelete(ex.id); };
        card.appendChild(it);
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
    const isNew = !ex;
    ex = ex || { dia:day, orden:99, series_obj:3, reps_min:8, reps_max:12, rir_obj:2, incremento_kg:2.5, unidad:'mancuerna', grupo:'' };
    const wrap = el('div','card');
    wrap.innerHTML = `<h3>${isNew?'Nuevo ejercicio':'Editar ejercicio'} · Día ${ex.dia}</h3>
      <label class="help">Nombre</label><input id="f-nombre" value="${esc(ex.nombre||'')}" placeholder="Ej: Sentadilla">
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
  function renderAvances({ sets, exercises }) {
    const wrap = el('div');
    if (!sets.length) { wrap.appendChild(el('div','empty','Aún no hay sesiones. Registra tu primera en "Hoy".')); return wrap; }

    const totalSesiones = new Set(sets.map(s=>s.fecha)).size;
    const prs = Logic.prsByExercise(sets);
    const stats = el('div','card');
    stats.innerHTML = `<div class="grid3">
      <div class="stat"><div class="big">${totalSesiones}</div><div class="label">Sesiones</div></div>
      <div class="stat"><div class="big">${sets.length}</div><div class="label">Series</div></div>
      <div class="stat"><div class="big">${Object.keys(prs).length}</div><div class="label">PRs</div></div></div>`;
    wrap.appendChild(stats);

    // Volumen por sesión
    const volCard = el('div','card');
    volCard.innerHTML = '<h3>Volumen por sesión (kg)</h3><canvas id="c-vol" height="160"></canvas>';
    wrap.appendChild(volCard);

    // Selector de ejercicio para progreso
    const exNames = [...new Set(sets.map(s=>s.ejercicio))];
    const progCard = el('div','card');
    progCard.innerHTML = `<div class="row between"><h3>Progreso por ejercicio</h3>
      <select id="ex-pick" class="day-sel">${exNames.map(n=>`<option>${esc(n)}</option>`).join('')}</select></div>
      <canvas id="c-prog" height="180"></canvas><div id="prog-rec" class="rec"></div>`;
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
  function renderPeso({ weights, profile, measurements = [], onAdd, onDelete, onAddMeasure, onDeleteMeasure }) {
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

    // --- Composición corporal (estimación Navy) ---
    const latest = Logic.latestMeasures(measurements);
    const bf = Logic.bodyFatNavy({
      sexo: profile?.sexo || 'h',
      cuello: latest.cuello?.valor_cm, cintura: latest.cintura?.valor_cm,
      cadera: latest.cadera?.valor_cm, estatura_cm: profile?.estatura_cm,
    });
    const comp = Logic.composition(bf, last?.peso_kg);
    const compCard = el('div','card');
    if (bf != null) {
      compCard.innerHTML = `<div class="section-title" style="margin-top:0">Composición corporal (estimada)</div>
        <div class="grid3">
          <div class="stat"><div class="big">${bf}%</div><div class="label">Grasa corporal</div></div>
          <div class="stat"><div class="big">${comp?comp.magra:'—'}</div><div class="label">Masa magra (kg)</div></div>
          <div class="stat"><div class="big">${comp?comp.grasa:'—'}</div><div class="label">Masa grasa (kg)</div></div>
        </div>
        <p class="help">Método U.S. Navy (perímetros). Estimación orientativa, no sustituye DEXA/balanza.</p>`;
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
      const chart = el('div','card'); chart.innerHTML='<h3>Curva de peso</h3><canvas id="c-w" height="170"></canvas>';
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
        <canvas id="c-m" height="170"></canvas><div id="m-hist"></div>`;
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

  // ---------- AJUSTES ----------
  function renderAjustes({ profile, email, onSaveProfile, onExport, onImport, onSignOut }) {
    const wrap = el('div');
    const p = profile || {};
    const card = el('div','card');
    card.innerHTML = `<h3>Perfil</h3>
      <div class="grid2">
        <div><label class="help">Edad</label><input id="p-edad" type="number" value="${p.edad??''}"></div>
        <div><label class="help">Estatura (cm)</label><input id="p-est" type="number" value="${p.estatura_cm??''}"></div>
      </div>
      <label class="help">Objetivo</label>
      <select id="p-obj">${[['recomposicion','Recomposición'],['ganar','Ganar músculo'],['perder','Perder grasa'],['mantener','Mantener'],['fuerza','Fuerza']].map(([v,t])=>`<option value="${v}" ${p.objetivo===v?'selected':''}>${t}</option>`).join('')}</select>
      <div class="grid3" style="margin-top:8px">
        <div><label class="help">Meta peso (kg)</label><input id="p-meta" type="number" step="0.1" value="${p.peso_objetivo_kg??''}"></div>
        <div><label class="help">Kcal objetivo</label><input id="p-kcal" type="number" value="${p.kcal_objetivo??''}"></div>
        <div><label class="help">Proteína (g)</label><input id="p-prot" type="number" value="${p.proteina_g??''}"></div>
      </div>
      <button class="btn btn-primary" id="p-save" style="width:100%;margin-top:12px">Guardar perfil</button>`;
    card.querySelector('#p-save').onclick = () => onSaveProfile({
      edad:Number(card.querySelector('#p-edad').value)||null,
      estatura_cm:Number(card.querySelector('#p-est').value)||null,
      objetivo:card.querySelector('#p-obj').value,
      peso_objetivo_kg:Number(card.querySelector('#p-meta').value)||null,
      kcal_objetivo:Number(card.querySelector('#p-kcal').value)||null,
      proteina_g:Number(card.querySelector('#p-prot').value)||null,
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

    const acc = el('div','card');
    acc.innerHTML = `<h3>Cuenta</h3><p class="muted">${esc(email||'')}</p>
      <button class="btn btn-ghost" id="logout" style="width:100%">Cerrar sesión</button>`;
    acc.querySelector('#logout').onclick = onSignOut;
    wrap.appendChild(acc);
    return wrap;
  }

  return { $, el, esc, toast, setMain, renderHoy, renderRutina, exerciseForm,
           renderAvances, renderPeso, renderAjustes };
})();
