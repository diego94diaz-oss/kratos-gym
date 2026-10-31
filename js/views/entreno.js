// ============================================================
//  VISTA Entreno — iniciar, sesión en vivo, rutinas, progreso e historial.
//  La sesión es un borrador editable: se puede cambiar, agregar o quitar
//  cualquier ejercicio, y se guarda en el teléfono en cada cambio.
// ============================================================
(() => {
  const { el, esc, num, fmtDate, sheet, field, toast, ask } = UI;
  const routineLabel = r => /^[A-Z]$/.test(r||'') ? `Rutina ${r}` : (r || 'Sesión');
  const unidadTxt = it => unitKind(it.unidad)==='tiempo' ? 'seg' : 'reps';

  // ---------- Borrador ----------
  const objOf = e => ({ series_obj:e.series_obj||3, reps_min:e.reps_min||8, reps_max:e.reps_max||12, rir_obj:e.rir_obj??2, incremento_kg:e.incremento_kg??2.5 });
  function itemFrom(e, sets){
    const it = { nombre:e.nombre, grupo:e.grupo||'', unidad:e.unidad||'mancuerna', exercise_id:e.id||null, obj:objOf(e.obj||e), nota:e.notas||'', sets:[] };
    fillSets(it, sets); return it;
  }
  // Prepara las series con la recomendación y lo hecho la última vez
  function fillSets(it, sets){
    const rec = Logic.recommend({ ...it.obj, nombre:it.nombre, unidad:it.unidad }, sets), last = Logic.lastSessionOf(sets, it.nombre);
    const work = last ? last.sets.filter(s=>s.set_type!=='calentamiento') : [];
    it.sets = Array.from({length:Math.max(it.obj.series_obj, 1)}, (_,i) => ({
      reps:'', peso:'', eff:'', type:'normal', done:false,
      hintP: rec.peso ?? work[i]?.peso_kg ?? work[0]?.peso_kg ?? '', hintR: work[i]?.reps ?? it.obj.reps_max }));
  }
  const newDraft = (nombre, rutina, items, extra = {}) => ({ nombre, rutina, fecha:Logic.todayISO(), startedAt:Date.now(), items, ...extra });
  const save = d => Offline.saveDraft(d);

  App.startRoutine = rutina => {
    const list = App.cache.exercises.filter(e=>e.dia===rutina && e.activo!==false).sort((a,b)=>a.orden-b.orden);
    App.beginDraft(newDraft(routineLabel(rutina), rutina, list.map(e=>itemFrom(e,App.cache.sets))));
  };
  App.startFree = () => App.beginDraft(newDraft('Entreno libre', Logic.FREE, []));
  App.repeatSession = ses => {
    const items = ses.ejercicios.map(n => { const e=App.cache.exercises.find(x=>x.nombre===n); const lib=EXERCISE_LIBRARY.find(x=>x.nombre===n);
      const it = itemFrom(e||{ nombre:n, grupo:lib?.grupo, unidad:lib?.unidad }, App.cache.sets);
      return it; });
    App.beginDraft(newDraft(ses.rutina===Logic.FREE?'Entreno libre':routineLabel(ses.rutina), ses.rutina||Logic.FREE, items));
  };
  // Editar una sesión ya guardada: las series viejas se reemplazan solo si las nuevas se guardan bien
  App.editSession = ses => {
    if (!navigator.onLine) return toast('📴 Para editar una sesión necesitas conexión');
    const items = ses.ejercicios.map(n => { const rows = ses.sets.filter(s=>s.ejercicio===n).sort((a,b)=>a.serie-b.serie);
      const e = App.cache.exercises.find(x=>x.nombre===n), lib = EXERCISE_LIBRARY.find(x=>x.nombre===n);
      return { nombre:n, grupo:e?.grupo||lib?.grupo||'', unidad:e?.unidad||lib?.unidad||'mancuerna', exercise_id:e?.id||null, obj:objOf(e||{}), nota:'',
        sets:rows.map(r=>({ reps:r.reps, peso:r.peso_kg||'', eff:r.rir??'', type:r.set_type||'normal', done:true, hintP:'', hintR:'' })) }; });
    App.beginDraft(newDraft(`Editar ${fmtDate(ses.fecha)}`, ses.rutina||Logic.FREE, items, { fecha:ses.fecha, replaceIds:ses.sets.map(s=>s.id).filter(Boolean) }));
  };

  // ---------- Selector de ejercicios ----------
  function pickExercise({ title, alternativesOf, onPick }){
    const c = App.cache, used = [...new Set(c.sets.map(s=>s.ejercicio))].reverse();
    const own = c.exercises.map(e=>({ nombre:e.nombre, grupo:e.grupo, unidad:e.unidad, id:e.id, obj:objOf(e) }));
    const seen = new Set(), all = [...own, ...used.map(n=>({ nombre:n, grupo:Logic.groupOf(n,c.exercises) })), ...EXERCISE_LIBRARY]
      .filter(e => !seen.has(e.nombre) && seen.add(e.nombre));
    const body = el('div');
    body.innerHTML = `<input id="ep-q" placeholder="Buscar o escribir uno nuevo" autocomplete="off">
      <div class="chips" id="ep-g"></div><div id="ep-l" class="pick-list"></div>`;
    const groups = ['todos','pecho','espalda','piernas','hombro','biceps','triceps','core'];
    let g = 'todos';
    const list = body.querySelector('#ep-l'), q = body.querySelector('#ep-q');
    const s = sheet(title, body);
    const draw = () => {
      const t = foodKey(q.value);
      let rows = all.filter(e => (g==='todos'|| (e.grupo||'')===g || Logic.groupOf(e.nombre,c.exercises)===g) && foodKey(e.nombre).includes(t));
      if (alternativesOf && !t && g==='todos') { const lib=EXERCISE_LIBRARY.find(x=>x.nombre===alternativesOf.nombre);
        const alts=libraryAlternatives(alternativesOf.nombre, lib?.grupo||alternativesOf.grupo, lib?.patron); rows=[...alts, ...rows.filter(r=>!alts.some(a=>a.nombre===r.nombre))]; }
      list.innerHTML = '';
      rows.slice(0,40).forEach(e => { const r=el('button','pick',`<b>${esc(e.nombre)}</b><small>${esc(e.grupo||'')}</small>`); r.onclick=()=>{ s.close(); onPick(e); }; list.appendChild(r); });
      if (t && !all.some(e=>foodKey(e.nombre)===t)) {
        const n=el('button','pick new',`<b>＋ Crear «${esc(q.value.trim())}»</b><small>ejercicio nuevo</small>`);
        n.onclick=()=>{ s.close(); customExercise(q.value.trim(), onPick); }; list.appendChild(n); }
    };
    const chips = body.querySelector('#ep-g');
    groups.forEach(x => { const b=el('button','chip'+(x===g?' on':''),x); b.onclick=()=>{ g=x; chips.querySelectorAll('.chip').forEach(y=>y.classList.toggle('on',y===b)); draw(); }; chips.appendChild(b); });
    q.oninput = draw; draw();
  }
  function customExercise(nombre, onPick){
    const n = el('div',null,`${field('Grupo muscular',`<select id="ce-g">${['pecho','espalda','piernas','gluteo','hombro','biceps','triceps','core','otro'].map(x=>`<option>${x}</option>`).join('')}</select>`)}
      ${field('Cómo se registra',`<select id="ce-u"><option value="mancuerna">Mancuerna</option><option value="barra">Barra</option><option value="maquina">Máquina</option><option value="polea">Polea</option><option value="peso_corporal">Peso corporal</option><option value="tiempo">Tiempo</option></select>`)}
      <button class="btn btn-primary wide">Agregar</button>`);
    const s = sheet(nombre, n);
    n.querySelector('button').onclick = () => { const e={ nombre, grupo:n.querySelector('#ce-g').value, unidad:n.querySelector('#ce-u').value }; s.close(); onPick(e); App.saveCustomExercise(e); };
  }

  // ---------- Sesión en vivo ----------
  function player(d){
    const wrap = el('div','player'), effMode = localStorage.getItem('kratos-effort') || 'rir', effLbl = effMode.toUpperCase();
    const hd = el('div','live-head',`<div class="lh-t"><input id="dn" value="${esc(d.nombre)}" aria-label="Nombre de la sesión"><span><b id="sess-timer">0:00</b> · <input type="date" id="dfe" value="${d.fecha}" aria-label="Fecha"></span></div><button class="btn btn-primary" id="d-fin">Terminar</button>`);
    wrap.appendChild(hd);
    hd.querySelector('#dn').oninput = e => { d.nombre = e.target.value; save(d); };
    hd.querySelector('#dfe').onchange = e => { d.fecha = e.target.value; save(d); };
    hd.querySelector('#d-fin').onclick = () => finish(d);
    const tick = () => { const t=document.getElementById('sess-timer'); if(!t) return clearInterval(App.sessionTimer); const s=Math.floor((Date.now()-d.startedAt)/1000), h=Math.floor(s/3600);
      t.textContent = (h?h+':':'')+`${String(Math.floor(s/60)%60).padStart(h?2:1,'0')}:${String(s%60).padStart(2,'0')}`; };
    clearInterval(App.sessionTimer); App.sessionTimer = setInterval(tick,1000); tick();

    if (!d.items.length) wrap.appendChild(el('div','empty','Agrega lo que vas a hacer hoy. Todo queda en tu historial.'));
    d.items.forEach((it, idx) => wrap.appendChild(itemCard(d, it, idx, effMode, effLbl)));

    const add = el('button','btn btn-ghost wide add-ex','＋ Agregar ejercicio');
    add.onclick = () => pickExercise({ title:'Agregar ejercicio', onPick:e => { d.items.push(itemFrom(e, App.cache.sets)); d.items[d.items.length-1].added=true; save(d); App.render(); } });
    wrap.appendChild(add);
    const cancel = el('button','btn-link danger','Descartar sesión');
    cancel.onclick = () => ask('¿Descartar la sesión?','Se pierde lo que anotaste en esta sesión.','Descartar',() => App.endDraft());
    wrap.appendChild(cancel);
    return wrap;
  }

  function itemCard(d, it, idx, effMode, effLbl){
    const kind = unitKind(it.unidad), rec = Logic.recommend({ ...it.obj, nombre:it.nombre, unidad:it.unidad }, App.cache.sets);
    const last = Logic.lastSessionOf(App.cache.sets, it.nombre);
    const card = el('section','card ex-card');
    card.innerHTML = `<div class="ex-head"><div><div class="ex-name">${esc(it.nombre)}</div>
        <div class="ex-meta">${it.obj.series_obj} × ${it.obj.reps_min}-${it.obj.reps_max} ${unidadTxt(it)}${it.swappedFrom?` · en vez de ${esc(it.swappedFrom)}`:''}</div></div>
        <button class="icon-btn more" aria-label="Opciones de ${esc(it.nombre)}">⋯</button></div>
      <div class="rec"><span class="${rec.clase}">${rec.accion.toUpperCase()}</span> ${esc(rec.texto)}</div>
      ${last?`<div class="ex-meta">Última vez, ${fmtDate(last.fecha)}: ${esc(last.sets.map(s=>kind==='kg'?`${s.peso_kg}×${s.reps}`:`${s.reps}`).join(' · '))}</div>`:''}
      ${it.nota?`<div class="ex-note">📝 ${esc(it.nota)}</div>`:''}
      <div class="set-hd ${kind}"><span>Serie</span>${kind==='kg'?'<span>kg</span>':''}<span>${kind==='tiempo'?'seg':'reps'}</span><span class="eff-t">${effLbl}</span><span>✓</span></div>
      <div class="sets"></div><button class="btn btn-ghost wide add-set">＋ Serie</button>`;
    const box = card.querySelector('.sets');
    const typeTag = t => ({ normal:'', calentamiento:'C', drop:'D', fallo:'F' }[t] || '');
    const drawSets = () => { box.innerHTML=''; let n=0;
      it.sets.forEach((s,i) => { if(s.type!=='calentamiento') n++;
        const row = el('div',`set-row ${kind} ${s.done?'done':''}`);
        row.innerHTML = `<button class="sn" aria-label="Tipo de serie">${typeTag(s.type)||n}</button>
          ${kind==='kg'?`<input class="i-peso" type="number" inputmode="decimal" step="0.5" placeholder="${s.hintP}" value="${s.peso}" aria-label="Kilos">`:''}
          <input class="i-reps" type="number" inputmode="numeric" placeholder="${s.hintR}" value="${s.reps}" aria-label="Repeticiones">
          <input class="i-eff" type="number" inputmode="decimal" step="0.5" value="${s.eff}" aria-label="${effLbl}">
          <button class="tick" aria-label="Serie hecha">✓</button>`;
        row.querySelector('.i-peso')?.addEventListener('input', e => { s.peso=e.target.value; save(d); });
        row.querySelector('.i-reps').oninput = e => { s.reps=e.target.value; save(d); };
        row.querySelector('.i-eff').oninput = e => { s.eff=e.target.value; save(d); };
        row.querySelector('.sn').onclick = () => setMenu(it,i,drawSets,d);
        row.querySelector('.tick').onclick = () => {
          if (s.reps==='') s.reps = s.hintR; if (s.peso==='' && kind==='kg') s.peso = s.hintP;
          if (s.reps==='' || s.reps==null) return toast('Anota las repeticiones');
          s.done = !s.done; save(d); drawSets();
          if (s.done) { const pr=Logic.newPRs(App.cache.sets,[{ ejercicio:it.nombre, peso_kg:Number(s.peso)||0, reps:Number(s.reps), set_type:s.type }]);
            if (pr.length && App.cache.sets.some(x=>x.ejercicio===it.nombre)) toast('🏆 ¡Nuevo récord!');
            UI.startRest(Logic.restSuggestion(it)); }
        };
        box.appendChild(row); });
    };
    drawSets();
    card.querySelector('.add-set').onclick = () => { const p=it.sets[it.sets.length-1]; it.sets.push({ reps:'', peso:'', eff:'', type:'normal', done:false, hintP:p?(p.peso||p.hintP):'', hintR:p?(p.reps||p.hintR):it.obj.reps_max }); save(d); drawSets(); };
    card.querySelector('.more').onclick = () => itemMenu(d, it, idx);
    return card;
  }
  function setMenu(it, i, redraw, d){
    const n = el('div','stack');
    Logic.SET_TYPES.forEach(([v,l]) => { const b=el('button','btn btn-ghost wide',l); b.onclick=()=>{ it.sets[i].type=v; save(d); s.close(); redraw(); }; n.appendChild(b); });
    const del = el('button','btn btn-danger wide','Quitar serie'); del.onclick=()=>{ it.sets.splice(i,1); save(d); s.close(); redraw(); }; n.appendChild(del);
    const s = sheet(`Serie ${i+1}`, n);
  }
  function itemMenu(d, it, idx){
    const n = el('div','stack'); const opt = (t,f,c='btn-ghost') => { const b=el('button',`btn ${c} wide`,t); b.onclick=()=>{ s.close(); f(); }; n.appendChild(b); };
    opt('🔄 Cambiar por otro ejercicio', () => pickExercise({ title:`En vez de ${it.nombre}`, alternativesOf:it, onPick:e => {
      const next = itemFrom({ ...e, ...(e.obj||it.obj), id:e.id }, App.cache.sets);
      next.swappedFrom = it.swappedFrom || it.nombre; next.replacesId = it.replacesId || it.exercise_id; next.added = it.added; d.items[idx] = next; save(d); App.render(); } }));
    if (unitKind(it.unidad)==='kg') {
      const peso = Number(it.sets.find(x=>x.peso||x.hintP)?.peso || it.sets[0]?.hintP) || 0;
      if (Logic.warmups(peso).length) opt('🔥 Agregar calentamiento', () => { it.sets.unshift(...Logic.warmups(peso).map(w=>({ reps:w.reps, peso:w.peso, eff:'', type:'calentamiento', done:false, hintP:w.peso, hintR:w.reps }))); save(d); App.render(); });
      opt('🏋️ Calcular discos', () => plateSheet(peso));
    }
    opt('📝 Nota', () => { const f=el('div',null,`<textarea id="nt" rows="3">${esc(it.nota)}</textarea><button class="btn btn-primary wide">Guardar</button>`); const ss=sheet('Nota del ejercicio',f); f.querySelector('button').onclick=()=>{ it.nota=f.querySelector('#nt').value; save(d); ss.close(); App.render(); }; });
    if (idx>0) opt('⬆️ Subir', () => { [d.items[idx-1],d.items[idx]]=[d.items[idx],d.items[idx-1]]; save(d); App.render(); });
    if (idx<d.items.length-1) opt('⬇️ Bajar', () => { [d.items[idx+1],d.items[idx]]=[d.items[idx],d.items[idx+1]]; save(d); App.render(); });
    opt('Quitar de esta sesión', () => { d.items.splice(idx,1); save(d); App.render(); }, 'btn-danger');
    const s = sheet(it.nombre, n);
  }
  function plateSheet(peso){
    const n = el('div',null,`<div class="grid2">${field('Peso total',`<input id="pl-t" type="number" inputmode="decimal" value="${peso||60}">`)}${field('Barra',`<input id="pl-b" type="number" inputmode="decimal" value="20">`)}</div><div id="pl-o" class="plates"></div>`);
    const draw = () => { const r = Logic.plates(+n.querySelector('#pl-t').value, +n.querySelector('#pl-b').value);
      n.querySelector('#pl-o').innerHTML = (r.out.length?`<p class="muted">Por lado:</p>${r.out.map(p=>`<span class="plate">${num(p,2)}</span>`).join('')}`:'<p class="muted">Solo la barra.</p>')+(r.resto?`<p class="muted">Faltan ${num(r.resto,2)} kg para el total exacto.</p>`:''); };
    n.querySelectorAll('input').forEach(i=>i.oninput=draw); draw(); sheet('Discos', n);
  }

  // ---------- Terminar ----------
  function finish(d){
    const effMode = localStorage.getItem('kratos-effort') || 'rir', rows = [];
    d.items.forEach(it => { let n=0; const kind=unitKind(it.unidad);
      it.sets.forEach(s => { if(!s.done && s.reps==='') return; n++;
        const e = s.eff===''?null:Number(s.eff);
        rows.push({ fecha:d.fecha, rutina:d.rutina, ejercicio:it.nombre, exercise_id:it.exercise_id||null, serie:n, reps:Number(s.reps||s.hintR)||0,
          peso_kg:kind==='kg'?Number(s.peso||s.hintP)||0:0, rir:effMode==='rpe'?Logic.rirFromRpe(e):e, rpe:effMode==='rpe'?e:Logic.rpeFromRir(e), set_type:s.type||'normal', observaciones:it.nota||null }); }); });
    if (!rows.length) return toast('Marca al menos una serie');
    const routineChanges = d.items.filter(it => d.rutina!==Logic.FREE && (it.swappedFrom || it.added));
    const mins = Math.round((Date.now()-d.startedAt)/60000), vol = rows.filter(r=>r.set_type!=='calentamiento').reduce((a,r)=>a+r.peso_kg*r.reps,0);
    const n = el('div',null,`<div class="tiles">${UI.tile(new Set(rows.map(r=>r.ejercicio)).size,'ejercicios')}${UI.tile(rows.length,'series')}${UI.tile(num(vol,0),'kg')}</div>
      ${!d.replaceIds?field('Esfuerzo de la sesión (1-10)',`<input id="f-rpe" type="number" inputmode="numeric" min="1" max="10">`)+field('Duración (min)',`<input id="f-min" type="number" inputmode="numeric" value="${mins}">`):''}
      ${field('Notas',`<textarea id="f-n" rows="2" placeholder="Cómo te sentiste, qué cambiaste…"></textarea>`)}
      ${routineChanges.length?`<label class="check"><input type="checkbox" id="f-r"> <span>Guardar en ${esc(routineLabel(d.rutina))} los cambios: ${esc(routineChanges.map(i=>i.nombre).join(', '))}</span></label>`:''}
      <button class="btn btn-primary wide" id="f-s">Guardar sesión</button>`);
    const s = sheet('Terminar sesión', n), btn = n.querySelector('#f-s');
    btn.onclick = async () => { btn.disabled=true; btn.textContent='Guardando…';
      try { await App.saveSession(d, rows, { rpe:Number(n.querySelector('#f-rpe')?.value)||null, duracion_min:Number(n.querySelector('#f-min')?.value)||null, notas:n.querySelector('#f-n').value.trim()||null,
          routineChanges:n.querySelector('#f-r')?.checked ? routineChanges : [] }); s.close(); }
      catch { btn.disabled=false; btn.textContent='Guardar sesión'; } };
  }
  App.sessionSummary = ({ rows, prs, mins }) => {
    const vol = rows.filter(r=>r.set_type!=='calentamiento').reduce((a,r)=>a+r.peso_kg*r.reps,0);
    sheet('¡Sesión guardada! 💪', `<div class="tiles">${UI.tile(rows.length,'series')}${UI.tile(num(vol,0),'kg')}${UI.tile(mins||'—','min')}</div>
      ${prs.length?`<div class="rec"><b>🏆 Récords nuevos</b><br>${prs.map(p=>`${esc(p.ejercicio)}: ${p.peso} kg × ${p.reps} (1RM ~${Math.round(p.e1rm)} kg)`).join('<br>')}</div>`:''}`);
  };

  // ---------- Actividades distintas a pesas ----------
  App.activitySheet = (fecha = Logic.todayISO()) => {
    let mod = 'caminata';
    const n = el('div',null,`<div class="act-grid">${ACTIVITIES.map(([v,i,l])=>`<button class="act ${v===mod?'on':''}" data-v="${v}"><i>${i}</i>${l}</button>`).join('')}</div>
      <div class="grid2">${field('Minutos',`<input id="a-m" type="number" inputmode="numeric">`)}${field('Km (opcional)',`<input id="a-k" type="number" inputmode="decimal" step="0.1">`)}</div>
      <div class="grid2">${field('FC media',`<input id="a-f" type="number" inputmode="numeric">`)}${field('Esfuerzo 1-10',`<input id="a-r" type="number" inputmode="numeric">`)}</div>
      ${field('Fecha',`<input id="a-d" type="date" value="${fecha}">`)}${field('Notas',`<input id="a-n">`)}
      <button class="btn btn-primary wide" id="a-s">Registrar</button>`);
    n.querySelectorAll('.act').forEach(b => b.onclick = () => { mod=b.dataset.v; n.querySelectorAll('.act').forEach(x=>x.classList.toggle('on',x===b)); });
    const s = sheet('Otra actividad', n), v = q => n.querySelector(q).value;
    n.querySelector('#a-s').onclick = () => { const dur=Number(v('#a-m')); if(!dur) return toast('Indica los minutos');
      s.close(); App.saveCardio({ fecha:v('#a-d'), modalidad:mod, duracion_min:dur, distancia_km:Number(v('#a-k'))||null, fc_media:Number(v('#a-f'))||null, rpe:Number(v('#a-r'))||null, notas:v('#a-n')||null }); };
  };

  // ---------- Pestaña Entrenar ----------
  function start(){
    const w = el('div'), c = App.ctx(), s = App.cache, rs = c.routines;
    const sec = el('section','card hero');
    const next = c.nextRoutine, list = s.exercises.filter(e=>e.dia===next&&e.activo!==false);
    sec.innerHTML = next ? `<small>Sugerida</small><h2>${esc(routineLabel(next))}</h2><p>${list.length} ejercicios</p><button class="btn btn-primary wide">Empezar</button>` : `<h2>Crea tu primera rutina</h2><p>O entrena libre.</p><button class="btn btn-primary wide">Entreno libre</button>`;
    sec.querySelector('button').onclick = () => next ? App.startRoutine(next) : App.startFree();
    w.appendChild(sec);
    const quick = el('section','quick');
    [['🆓','Entreno libre',App.startFree],['🏃','Otra actividad',()=>App.activitySheet()],
     ...(c.sessions[0]?[['🔁','Repetir la última',()=>App.repeatSession(c.sessions[0])]]:[])].forEach(([i,t,f]) => { const b=el('button','q-btn',`<i>${i}</i><span>${t}</span>`); b.onclick=f; quick.appendChild(b); });
    w.appendChild(quick);
    if (rs.length>1) { w.appendChild(el('h3','sub','Otras rutinas'));
      rs.filter(r=>r!==next).forEach(r => { const n=s.exercises.filter(e=>e.dia===r&&e.activo!==false).length;
        const b=el('button','card link slim',`<span>📋</span><div><b>${esc(routineLabel(r))}</b><small>${n} ejercicios</small></div>`); b.onclick=()=>App.startRoutine(r); w.appendChild(b); }); }
    return w;
  }

  // ---------- Pestaña Rutinas ----------
  function exerciseForm(ex, dia){
    ex = { dia, orden:99, series_obj:3, reps_min:8, reps_max:12, rir_obj:2, incremento_kg:2.5, unidad:'mancuerna', grupo:'', ...ex };
    const n = el('div',null,`${field('Nombre',`<input id="f-nombre" list="lib-names" value="${esc(ex.nombre||'')}"><datalist id="lib-names">${EXERCISE_LIBRARY.map(e=>`<option value="${esc(e.nombre)}">`).join('')}</datalist>`)}
      <div class="grid2">${field('Grupo',`<input id="f-grupo" value="${esc(ex.grupo||'')}">`)}${field('Tipo',`<select id="f-unidad">${[['barra','Barra'],['mancuerna','Mancuerna'],['maquina','Máquina'],['polea','Polea'],['peso_corporal','Peso corporal'],['tiempo','Tiempo']].map(([v,l])=>`<option value="${v}" ${ex.unidad===v?'selected':''}>${l}</option>`).join('')}</select>`)}</div>
      <div class="grid3">${field('Series',`<input id="f-series" type="number" inputmode="numeric" value="${ex.series_obj}">`)}${field('Reps mín',`<input id="f-rmin" type="number" inputmode="numeric" value="${ex.reps_min}">`)}${field('Reps máx',`<input id="f-rmax" type="number" inputmode="numeric" value="${ex.reps_max}">`)}</div>
      <div class="grid2">${field('RIR objetivo',`<input id="f-rir" type="number" inputmode="decimal" step="0.5" value="${ex.rir_obj??''}">`)}${field('Subir kg',`<input id="f-inc" type="number" inputmode="decimal" step="0.5" value="${ex.incremento_kg}">`)}</div>
      ${field('Notas',`<input id="f-notas" value="${esc(ex.notas||'')}">`)}<button class="btn btn-primary wide" id="f-save">Guardar</button>`);
    const q = s => n.querySelector(s);
    q('#f-nombre').oninput = e => { const l=EXERCISE_LIBRARY.find(x=>x.nombre===e.target.value); if(l){ q('#f-grupo').value=l.grupo; q('#f-unidad').value=l.unidad; } };
    const s = sheet(ex.id?'Editar ejercicio':'Nuevo ejercicio', n);
    q('#f-save').onclick = () => { const nombre=q('#f-nombre').value.trim(); if(!nombre) return toast('Pon un nombre'); s.close();
      App.saveExercise({ id:ex.id, dia:ex.dia, orden:Number(ex.orden)||99, nombre, grupo:q('#f-grupo').value.trim(), unidad:q('#f-unidad').value, series_obj:+q('#f-series').value||3, reps_min:+q('#f-rmin').value||8, reps_max:+q('#f-rmax').value||12,
        rir_obj:q('#f-rir').value===''?null:+q('#f-rir').value, incremento_kg:+q('#f-inc').value||0, notas:q('#f-notas').value.trim()||null, activo:true }); };
  }
  function nameSheet(title, value, onSave){
    const n=el('div',null,`${field('Nombre',`<input id="nm" value="${esc(value||'')}" placeholder="Ej: Torso, Pierna, Playa…">`)}<button class="btn btn-primary wide">Guardar</button>`);
    const s=sheet(title,n); n.querySelector('button').onclick=()=>{ const v=n.querySelector('#nm').value.trim(); if(!v) return toast('Pon un nombre'); s.close(); onSave(v); };
  }
  function routines(){
    const w = el('div'), c = App.cache, rs = App.ctx().routines;
    rs.forEach(r => { const list=c.exercises.filter(e=>e.dia===r).sort((a,b)=>a.orden-b.orden), card=el('section','card');
      card.innerHTML=`<div class="card-hd"><h3>${esc(routineLabel(r))}</h3><button class="icon-btn rn" aria-label="Renombrar">✏️</button><button class="icon-btn dl" aria-label="Eliminar rutina">🗑️</button></div>`;
      card.querySelector('.rn').onclick=()=>nameSheet('Renombrar rutina',r,v=>App.renameRoutine(r,v));
      card.querySelector('.dl').onclick=()=>ask('¿Eliminar rutina?','Tu historial de entrenamientos se conserva.','Eliminar',()=>App.deleteRoutine(r));
      list.forEach((ex,i)=>{ const it=el('div','list-item',`<button class="li-main"><b>${esc(ex.nombre)}</b><small>${ex.series_obj} × ${ex.reps_min}-${ex.reps_max}</small></button><button class="icon-btn up" aria-label="Subir" ${i?'':'disabled'}>↑</button><button class="icon-btn dl" aria-label="Eliminar">✕</button>`);
        it.querySelector('.li-main').onclick=()=>exerciseForm(ex,r);
        it.querySelector('.up').onclick=()=>App.moveExercise(list,i);
        it.querySelector('.dl').onclick=()=>ask(`¿Eliminar ${ex.nombre}?`,'Sale de la rutina; el historial se conserva.','Eliminar',()=>App.deleteExercise(ex.id));
        card.appendChild(it); });
      const add=el('button','btn btn-ghost wide','＋ Ejercicio'); add.onclick=()=>pickExercise({ title:`Agregar a ${routineLabel(r)}`, onPick:e=>exerciseForm({ nombre:e.nombre, grupo:e.grupo, unidad:e.unidad, ...(e.obj||{}), orden:list.length+1 }, r) });
      card.appendChild(add); w.appendChild(card); });
    const nw=el('button','btn btn-primary wide','＋ Nueva rutina'); nw.onclick=()=>nameSheet('Nueva rutina','',v=>pickExercise({ title:`Primer ejercicio de ${v}`, onPick:e=>exerciseForm({ nombre:e.nombre, grupo:e.grupo, unidad:e.unidad, ...(e.obj||{}), orden:1 }, v) })); w.appendChild(nw);
    w.appendChild(el('h3','sub','Plantillas'));
    ROUTINE_TEMPLATES.forEach(t=>{ const b=el('button','card link slim',`<span>✨</span><div><b>${esc(t.nombre)}</b><small>${esc(t.desc)}</small></div>`);
      b.onclick=()=>ask(t.nombre,`Agrega ${Object.keys(t.dias).length} rutinas nuevas. Las actuales no se borran.`,'Agregar',()=>App.applyTemplate(t),false); w.appendChild(b); });

    // Periodización
    const meso=c.mesocycles.find(m=>m.activo), mc=el('section','card');
    if(meso){ const wk=Math.min(meso.semanas,Math.floor(Logic.daysBetween(meso.fecha_inicio,Logic.todayISO())/7)+1);
      mc.innerHTML=`<div class="card-hd"><h3>🗓️ ${esc(meso.nombre)}</h3><button class="icon-btn dl" aria-label="Finalizar">✕</button></div><p class="muted">Semana ${wk} de ${meso.semanas} · ${esc(meso.fase||'')}</p>`;
      mc.querySelector('.dl').onclick=()=>App.deleteMeso(meso.id); }
    else { mc.innerHTML=`<h3>🗓️ Bloque de entrenamiento</h3>${field('Nombre',`<input id="ms-n" placeholder="Ej: Retomar la fuerza">`)}<div class="grid2">${field('Fase',`<select id="ms-f"><option value="acumulacion">Acumulación</option><option value="intensificacion">Intensificación</option><option value="realizacion">Realización</option><option value="deload">Descarga</option></select>`)}${field('Semanas',`<input id="ms-w" type="number" inputmode="numeric" value="4">`)}</div><button class="btn btn-ghost wide">Iniciar</button>`;
      mc.querySelector('button').onclick=()=>{ const n=mc.querySelector('#ms-n').value.trim(); if(!n) return toast('Pon un nombre'); App.addMeso({ nombre:n, fase:mc.querySelector('#ms-f').value, semanas:+mc.querySelector('#ms-w').value||4, fecha_inicio:Logic.todayISO(), activo:true }); }; }
    w.appendChild(mc);
    return w;
  }

  // ---------- Pestaña Progreso ----------
  function progress(){
    const w = el('div'), c = App.cache, x = App.ctx();
    if(!c.sets.length){ w.appendChild(el('div','empty','Registra tu primera sesión para ver tu progreso.')); return w; }
    const r = Logic.weeklyReport({ sets:c.sets, weights:c.weights, foodLogs:c.foodLogs, exercises:c.exercises, profile:x.profile, lastWeight:x.lastWeight });
    const min = c.cardio.filter(a=>a.fecha>=Logic.isoDaysAgo(6)).reduce((a,b)=>a+Number(b.duracion_min||0),0);
    const rep = el('section','card'); rep.innerHTML=`<h3>Últimos 7 días</h3><div class="tiles">${UI.tile(r.sessions,'sesiones')}${UI.tile(r.setsCount,'series')}${UI.tile(r.volume>=1000?num(r.volume/1000)+' t':num(r.volume,0)+' kg','volumen')}</div>
      <div class="macro" style="margin-top:12px">${UI.bar('Actividad aeróbica',min,150,'min')}</div>`; w.appendChild(rep);

    const mw = Logic.muscleWeek(c.sets,c.exercises), mc=el('section','card');
    mc.innerHTML=`<h3>Series por grupo</h3><p class="help">Meta orientativa: 10 series semanales y 2 días por grupo.</p>`+mw.map(m=>`<div class="macro"><div class="macro-hd"><span>${m.label}${m.reposo!=null?` <small>· hace ${m.reposo} d</small>`:''}</span><b>${m.series}/10 · ${m.dias}d</b></div><div class="bar ${m.series>=10&&m.dias>=2?'good':''}"><i style="width:${Math.min(100,m.series*10)}%"></i></div></div>`).join(''); w.appendChild(mc);

    const days=new Set([...c.sets.map(s=>s.fecha),...c.cardio.map(s=>s.fecha)]), hoy=Logic.todayISO(), offset=(new Date(hoy+'T12:00:00').getDay()+6)%7;
    const start=Logic.addDays(hoy,-77-offset), cells=Array.from({length:78+offset},(_,i)=>Logic.addDays(start,i));
    const cal=el('section','card'); cal.innerHTML=`<div class="card-hd"><h3>Constancia</h3><span class="muted">${[...days].filter(d=>d>=Logic.isoDaysAgo(83)).length} días en 12 semanas</span></div><div class="heat">${cells.map(d=>`<i class="${days.has(d)?'on':''}" title="${d}"></i>`).join('')}</div>`; w.appendChild(cal);

    const dl=Logic.deloadAdvice(c.sets), st=Logic.stalledExercises(c.sets);
    if(dl&&Logic.daysSinceTraining(c.sets)<14){ const d=el('section','card'); d.innerHTML=`<h3>Fatiga y progreso</h3><div class="rec"><span class="${dl.due?'tag-down':'tag-up'}">${dl.due?'DESCARGA':'EN PROGRESO'}</span> ${esc(dl.due?dl.text:`${dl.tracked-dl.stalled} de ${dl.tracked} ejercicios progresan.`)}</div>${st.length?`<p class="help">Estancados: ${esc(st.map(s=>s.ejercicio).join(', '))}.</p>`:''}`; w.appendChild(d); }

    const names=[...new Set(c.sets.filter(s=>s.peso_kg>0).map(s=>s.ejercicio))].sort();
    if(names.length){ const pc=el('section','card'); pc.innerHTML=`<h3>Fuerza estimada (1RM)</h3><select id="ex-pick">${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select><div class="chartbox"><canvas id="c-prog"></canvas></div>`; w.appendChild(pc);
      const draw=()=>{ const d=Logic.e1rmByDate(c.sets,pc.querySelector('#ex-pick').value), k=UI.chartColors();
        UI.chart(pc.querySelector('#c-prog'),{ type:'line', data:{ labels:d.map(x=>UI.shortDate(x[0])), datasets:[{ data:d.map(x=>x[1]), borderColor:k.line, tension:.3, pointRadius:3 }] }, options:UI.baseOpts(k) }); };
      pc.querySelector('#ex-pick').onchange=draw; setTimeout(draw,30); }

    const vd=Logic.volumeByDate(c.sets).slice(-16), vc=el('section','card'); vc.innerHTML=`<h3>Volumen por sesión</h3><div class="chartbox"><canvas id="c-vol"></canvas></div>`; w.appendChild(vc);
    setTimeout(()=>{ const k=UI.chartColors(); UI.chart(vc.querySelector('#c-vol'),{ type:'bar', data:{ labels:vd.map(d=>UI.shortDate(d.fecha)), datasets:[{ data:vd.map(d=>d.vol), backgroundColor:k.line, borderRadius:6 }] }, options:UI.baseOpts(k) }); },30);

    const prs=Object.entries(Logic.prsByExercise(c.sets)).sort((a,b)=>b[1].e1rm-a[1].e1rm), pr=el('section','card');
    pr.innerHTML=`<h3>🏆 Récords</h3>`+prs.slice(0,12).map(([e,v])=>`<div class="list-item"><div class="li-main"><b>${esc(e)}</b><small>${v.peso} kg × ${v.reps} · ${fmtDate(v.fecha)}</small></div><b>${Math.round(v.e1rm)}</b></div>`).join(''); w.appendChild(pr);

    const ach=Logic.buildAchievements({ sets:c.sets, foodLogs:c.foodLogs, cardio:c.cardio, habitLogs:c.habitLogs }), ac=el('section','card');
    ac.innerHTML=`<div class="card-hd"><h3>🏅 Logros</h3><span class="muted">${ach.filter(a=>a.unlocked).length}/${ach.length}</span></div><div class="ach-grid">${ach.map(a=>`<div class="ach ${a.unlocked?'on':'off'}"><i>${a.icon}</i><b>${esc(a.titulo)}</b><small>${esc(a.unlocked?a.desc:a.prog)}</small></div>`).join('')}</div>`; w.appendChild(ac);
    return w;
  }

  // ---------- Pestaña Historial ----------
  function sessionDetail(ses){
    const meta = App.cache.sessionsMeta.find(m=>m.fecha===ses.fecha&&m.rutina===ses.rutina);
    const n=el('div',null,`<p class="muted">${UI.longDate(ses.fecha)}${meta?.duracion_min?` · ${meta.duracion_min} min`:''}${meta?.rpe?` · esfuerzo ${meta.rpe}/10`:''}</p>${meta?.notas?`<div class="rec">${esc(meta.notas)}</div>`:''}
      ${ses.ejercicios.map(e=>`<div class="list-item"><div class="li-main"><b>${esc(e)}</b><small>${esc(ses.sets.filter(s=>s.ejercicio===e).sort((a,b)=>a.serie-b.serie).map(s=>s.peso_kg?`${s.peso_kg}×${s.reps}`:`${s.reps}`).join(' · '))}</small></div></div>`).join('')}
      <div class="stack"><button class="btn btn-ghost wide" data-a="r">🔁 Repetir hoy</button><button class="btn btn-ghost wide" data-a="e">✏️ Editar</button><button class="btn btn-danger wide" data-a="d">Eliminar</button></div>`);
    const s=sheet(ses.rutina===Logic.FREE?'Entreno libre':routineLabel(ses.rutina),n);
    n.querySelector('[data-a=r]').onclick=()=>{ s.close(); App.repeatSession(ses); };
    n.querySelector('[data-a=e]').onclick=()=>{ s.close(); App.editSession(ses); };
    n.querySelector('[data-a=d]').onclick=()=>{ s.close(); ask('¿Eliminar la sesión?','No se puede deshacer.','Eliminar',()=>App.deleteSession(ses)); };
  }
  function history(){
    const w=el('div'), x=App.ctx(), items=[...x.sessions.map(s=>({ fecha:s.fecha, s })),...App.cache.cardio.map(a=>({ fecha:a.fecha, a }))].sort((p,q)=>p.fecha<q.fecha?1:-1);
    const past=el('button','btn btn-ghost wide','＋ Registrar una sesión pasada');
    past.onclick=()=>{ App.startFree(); }; w.appendChild(past);
    if(!items.length) w.appendChild(el('div','empty','Aún no hay registros.'));
    items.slice(0,60).forEach(i=>{ if(i.s){ const b=el('button','card link slim',`<span>🏋️</span><div><b>${esc(i.s.rutina===Logic.FREE?'Entreno libre':routineLabel(i.s.rutina))}</b><small>${fmtDate(i.fecha)} · ${i.s.ejercicios.length} ejercicios · ${num(i.s.vol,0)} kg</small></div>`); b.onclick=()=>sessionDetail(i.s); w.appendChild(b); }
      else { const ac=ACTIVITIES.find(a=>a[0]===i.a.modalidad), z=Logic.zoneOf(i.a.fc_media,x.profile.edad,x.fcReposo);
        const b=el('button','card link slim',`<span>${ac?ac[1]:'🏃'}</span><div><b>${esc(ac?ac[2]:i.a.modalidad||'Actividad')}</b><small>${fmtDate(i.fecha)} · ${i.a.duracion_min} min${i.a.distancia_km?` · ${i.a.distancia_km} km`:''}${z?` · ${z}`:''}</small></div>`);
        b.onclick=()=>ask('¿Eliminar actividad?','No se puede deshacer.','Eliminar',()=>App.deleteCardio(i.a.id)); w.appendChild(b); } });
    return w;
  }

  let seg = 'entrenar';
  Views.entreno = () => {
    const d = App.draft();
    if (d) return player(d);
    const w = el('div');
    w.appendChild(el('header','page-hd','<h1>Entreno</h1>'));
    w.appendChild(UI.segmented([['entrenar','Entrenar'],['rutinas','Rutinas'],['progreso','Progreso'],['historial','Historial']], seg, v => { seg=v; App.render(); }));
    w.appendChild({ entrenar:start, rutinas:routines, progreso:progress, historial:history }[seg]());
    return w;
  };
})();
