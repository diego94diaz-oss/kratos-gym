// ============================================================
//  VISTA Hoy — lo accionable del día, de un vistazo
// ============================================================
Views.hoy = () => {
  const { el, esc, num, fmtDate, ring } = UI;
  const c = App.ctx(), s = App.cache, today = Logic.todayISO(), wrap = el('div');
  const h = new Date().getHours();
  const hello = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  wrap.appendChild(el('header','page-hd',`<small>${UI.longDate(today)}</small><h1>${hello}${s.profile?.nombre?`, ${esc(s.profile.nombre)}`:''}</h1>`));

  if (App.canInstall()) {
    const ins = el('button','install-bar','<span>📲 Instala la app en tu celular</span><b>Instalar</b>');
    ins.onclick = App.install; wrap.appendChild(ins);
  }

  // --- Avisos ---
  const alerts = App.alerts();
  if (alerts.length) {
    const box = el('section','alerts');
    alerts.slice(0,4).forEach(a => {
      const it = el('div',`alert ${a.level}`,`<span class="a-ic">${a.icon}</span><span class="a-tx">${esc(a.text)}</span><button class="a-x" aria-label="Descartar">✕</button>`);
      it.querySelector('.a-tx').onclick = () => a.tab && App.go(a.tab);
      it.querySelector('.a-x').onclick = () => App.dismissAlert(a.id);
      box.appendChild(it);
    });
    if (alerts.length > 4) box.appendChild(el('div','more',`y ${alerts.length-4} más`));
    wrap.appendChild(box);
  }

  // --- Entrenamiento de hoy ---
  const draft = Offline.loadDraft();
  const todaySets = s.sets.filter(x => x.fecha === today), todayCardio = s.cardio.filter(x => x.fecha === today);
  const tr = el('section','card hero');
  if (draft) {
    tr.innerHTML = `<small>En curso</small><h2>${esc(draft.nombre)}</h2><p>${draft.items.length} ejercicios · sigue donde quedaste</p><button class="btn btn-primary wide">Volver a la sesión</button>`;
    tr.querySelector('button').onclick = () => App.go('entreno');
  } else if (todaySets.length || todayCardio.length) {
    const vol = Math.round(todaySets.filter(x=>x.set_type!=='calentamiento').reduce((a,x)=>a+x.peso_kg*x.reps,0));
    const bits = [];
    if (todaySets.length) bits.push(`${new Set(todaySets.map(x=>x.ejercicio)).size} ejercicios · ${todaySets.length} series · ${num(vol,0)} kg`);
    todayCardio.forEach(x => bits.push(`${ACTIVITIES.find(a=>a[0]===x.modalidad)?.[2]||x.modalidad} · ${x.duracion_min} min`));
    tr.innerHTML = `<small>Listo por hoy</small><h2>✅ Entrenaste</h2><p>${esc(bits.join(' + '))}</p><button class="btn btn-ghost wide">Registrar algo más</button>`;
    tr.querySelector('button').onclick = () => App.go('entreno');
  } else {
    const next = c.nextRoutine, list = s.exercises.filter(e => e.dia === next && e.activo !== false).sort((a,b)=>a.orden-b.orden);
    tr.innerHTML = `<small>Hoy te toca</small><h2>${next ? esc(/^[A-Z]$/.test(next)?`Rutina ${next}`:next) : 'Entreno libre'}</h2>
      <p>${list.length ? esc(list.slice(0,3).map(e=>e.nombre).join(' · '))+(list.length>3?` · +${list.length-3}`:'') : 'Registra lo que quieras hacer'}</p>
      <button class="btn btn-primary wide" id="go-tr">Empezar</button>
      <div class="row-btns"><button class="btn btn-ghost" id="go-free">Algo distinto</button><button class="btn btn-ghost" id="go-act">Otra actividad</button></div>`;
    tr.querySelector('#go-tr').onclick = () => next ? App.startRoutine(next) : App.startFree();
    tr.querySelector('#go-free').onclick = App.startFree;
    tr.querySelector('#go-act').onclick = () => App.activitySheet();
  }
  wrap.appendChild(tr);

  // --- Semana ---
  const days = Array.from({length:7},(_,i)=>Logic.addDays(today,i-6));
  const active = new Set([...s.sets.map(x=>x.fecha), ...s.cardio.map(x=>x.fecha)]);
  const week = el('section','card week');
  week.innerHTML = `<div class="dots">${days.map(d=>`<div class="dot ${active.has(d)?'on':''} ${d===today?'now':''}"><i>${active.has(d)?'✓':''}</i><span>${new Date(d+'T12:00:00').toLocaleDateString('es-CL',{weekday:'narrow'})}</span></div>`).join('')}</div>`;
  wrap.appendChild(week);

  // --- Anillos del día ---
  const sum = Logic.sumFoods(s.foodLogs.filter(l=>l.fecha===today)), t = c.targets;
  const agua = Logic.saludValue(s.salud,'agua',today) || 0, metaA = s.salud?.metas?.agua || 2000;
  const pasos = Logic.saludValue(s.salud,'pasos',today), metaP = s.salud?.metas?.pasos || 8000;
  const rc = el('section','card rings');
  rc.innerHTML = `
    <button data-go="nutricion">${ring(t.kcal?sum.kcal/t.kcal*100:0, num(sum.kcal,0))}<span>de ${t.kcal?num(t.kcal,0):'—'} kcal</span></button>
    <button data-go="nutricion">${ring(t.prot?sum.prot/t.prot*100:0, num(sum.prot,0)+'g',76,'alt')}<span>de ${t.prot||'—'} g prot.</span></button>
    <button id="r-agua">${ring(agua/metaA*100, num(agua/1000,1)+'L',76,'blue')}<span>+ vaso de agua</span></button>
    <button data-go="salud">${ring(pasos?pasos/metaP*100:0, pasos?num(pasos/1000,1)+'k':'—',76,'green')}<span>pasos</span></button>`;
  rc.querySelectorAll('[data-go]').forEach(b => b.onclick = () => App.go(b.dataset.go));
  rc.querySelector('#r-agua').onclick = () => App.addWater();
  wrap.appendChild(rc);

  // --- Cuerpo y salud ---
  const last = c.lastWeightRow, trend = Logic.weeklyTrend(s.weights), prox = Logic.nextHealthEvent(s.salud);
  const bc = el('section','card link');
  const imc = Evidence.bmi(c.lastWeight, c.profile.estatura_cm);
  bc.innerHTML = `<div class="tiles">
    ${UI.tile(last?num(last.peso_kg):'—','Peso',last?fmtDate(last.fecha):'sin registro')}
    ${UI.tile(trend!=null?(trend>0?'+':'')+num(trend,2):'—','kg/semana','tendencia')}
    ${UI.tile(num(imc),'IMC',Evidence.bmiClass(imc)?.label||'')}</div>`;
  bc.onclick = () => App.go('cuerpo');
  wrap.appendChild(bc);
  if (prox) { const pc = el('section','card link slim',`<span>📅</span><div><b>${esc(prox.texto)}</b><small>${fmtDate(prox.fecha)}${prox.hora?` · ${prox.hora}`:''}${prox.sugerido?' · sugerido':''}</small></div>`);
    pc.onclick = () => App.go('salud'); wrap.appendChild(pc); }

  const coach = el('button','btn btn-ghost wide','🤖 Preguntarle a Kratos');
  coach.onclick = App.openCoach; wrap.appendChild(coach);
  return wrap;
};
