// ============================================================
//  VISTA Salud — conectada a Mi Salud, sin duplicar su registro:
//  muestra lo útil para entrenar y escribe mediciones en su tabla.
//  Lo clínico (exámenes, diagnósticos, fármacos) se queda allá.
// ============================================================
(() => {
  const { el, esc, num, fmtDate, sheet, field, toast, ask } = UI;
  const SALUD_URL = 'https://mi-salud.diego94diaz.workers.dev/';
  const scale = (id, val) => `<div class="scale" data-id="${id}">${[1,2,3,4,5].map(n=>`<button type="button" class="${Number(val)===n?'on':''}" data-v="${n}">${n}</button>`).join('')}</div>`;
  const bindScale = (root, id, set) => { const b=root.querySelector(`.scale[data-id=${id}]`); b.querySelectorAll('button').forEach(x=>x.onclick=()=>{ b.querySelectorAll('button').forEach(y=>y.classList.toggle('on',y===x)); set(Number(x.dataset.v)); }); };

  function checkin(){
    const c=App.cache, t=Logic.todayISO(), sl=c.sleep.find(x=>x.fecha===t)||{}, we=c.wellness.find(x=>x.fecha===t)||{};
    const hs=Logic.saludValue(c.salud,'sueno',t)??sl.horas??'', st={ calidad:sl.calidad, animo:we.animo, estres:we.estres, energia:we.energia };
    const n=el('div',null,`${field('Horas de sueño',`<input id="h" type="number" inputmode="decimal" step="0.25" value="${hs}">`)}
      <div class="field"><span>Calidad del sueño</span>${scale('calidad',st.calidad)}</div><div class="field"><span>Energía</span>${scale('energia',st.energia)}</div>
      <div class="field"><span>Ánimo</span>${scale('animo',st.animo)}</div><div class="field"><span>Estrés (5 = mucho)</span>${scale('estres',st.estres)}</div><button class="btn btn-primary wide" id="sv">Guardar</button>`);
    ['calidad','energia','animo','estres'].forEach(k=>bindScale(n,k,v=>st[k]=v));
    const s=sheet('¿Cómo amaneciste?',n);
    n.querySelector('#sv').onclick=()=>{ s.close(); App.saveCheckin({ fecha:t, horas:Number(n.querySelector('#h').value)||null, ...st }); };
  }

  Views.salud = () => {
    const c=App.cache, x=App.ctx(), t=Logic.todayISO(), w=el('div'), sa=c.salud;
    w.appendChild(el('header','page-hd','<h1>Salud</h1>'));
    const conn=el('a','card link slim conn',`<span>${sa?.ok?'🟢':'⚪'}</span><div><b>${sa?.ok?'Conectado a Mi Salud':'Mi Salud sin conexión'}</b><small>${sa?.at?`Actualizado ${new Date(sa.at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})} · `:''}abrir la app</small></div>`);
    conn.href=SALUD_URL; conn.target='_blank'; conn.rel='noopener'; w.appendChild(conn);

    const sl=c.sleep.find(s=>s.fecha===t), hs=Logic.saludValue(sa,'sueno',t)??sl?.horas, rd=Logic.readiness({ horas:hs, calidad:sl?.calidad }, c.wellness.find(i=>i.fecha===t));
    const rc=el('section','card hero ready');
    rc.innerHTML=rd!=null?`<div class="ready-row">${UI.ring(rd,rd,84)}<div><small>Recuperación</small><h2>${rd>=75?'Buen día para entrenar fuerte':rd>=50?'Estado moderado':'Prioriza recuperar'}</h2></div></div><button class="btn btn-ghost wide">Actualizar</button>`
      :`<small>Check-in</small><h2>¿Cómo amaneciste?</h2><p>Con 20 segundos ajustamos el entrenamiento de hoy.</p><button class="btn btn-primary wide">Responder</button>`;
    rc.querySelector('button').onclick=checkin; w.appendChild(rc);

    // Mediciones de hoy
    const v=(tipo)=>Logic.saludValue(sa,tipo,t), m=sa?.metas||{}, pa=Logic.saludLatest(sa,'presion'), fc=Logic.saludLatest(sa,'fc');
    const tc=el('section','card'); tc.innerHTML=`<h3>Hoy</h3><div class="tiles wrap">
      ${UI.tile(v('pasos')!=null?num(v('pasos'),0):'—','pasos',m.pasos?`meta ${num(m.pasos,0)}`:'')}${UI.tile(hs!=null?num(hs):'—','horas de sueño',m.sueno?`meta ${num(m.sueno)}`:'')}
      ${UI.tile(num((v('agua')||0)/1000),'litros de agua',m.agua?`meta ${num(m.agua/1000)}`:'')}${UI.tile(fc?num(fc.valor,0):'—','FC en reposo',fc?fmtDate(fc.fecha):'')}
      ${UI.tile(pa?`${pa.sistolica}/${pa.diastolica}`:'—','presión',pa?fmtDate(pa.fecha):'')}</div>`; w.appendChild(tc);
    const prox=Logic.nextHealthEvent(sa);
    if(prox) w.appendChild(el('section','card slim',`<span>📅</span><div><b>${esc(prox.texto)}</b><small>${fmtDate(prox.fecha)}${prox.hora?` · ${prox.hora}`:''}${prox.sugerido?' · sugerido por tu plan':''}</small></div>`));

    // Tendencia de 14 días: entrenamiento frente a pasos y sueño
    const days=Array.from({length:14},(_,i)=>Logic.addDays(t,i-13));
    if(sa?.med?.some(r=>r.tipo==='pasos'||r.tipo==='sueno')){ const ch=el('section','card',`<h3>Pasos · últimos 14 días</h3><div class="chartbox short"><canvas id="c-p"></canvas></div>`); w.appendChild(ch);
      setTimeout(()=>{ const k=UI.chartColors(), tr=new Set([...c.sets.map(s=>s.fecha),...c.cardio.map(s=>s.fecha)]); UI.chart(ch.querySelector('#c-p'),{ type:'bar', data:{ labels:days.map(UI.shortDate), datasets:[{ data:days.map(d=>Logic.saludValue(sa,'pasos',d)||0), backgroundColor:days.map(d=>tr.has(d)?k.line:k.grid), borderRadius:5 }] }, options:UI.baseOpts(k) }); },30);
      ch.appendChild(el('p','help','En color, los días que entrenaste.')); }

    // Objetivos
    const g=el('section','card'), active=c.goals.filter(i=>i.estado==='activo');
    g.innerHTML=`<div class="card-hd"><h3>🎯 Objetivos</h3><button class="icon-btn add" aria-label="Agregar objetivo">＋</button></div>`;
    const auto=[]; if(m.peso) auto.push(['Peso',x.lastWeight,m.peso,'kg']); if(m.cintura) auto.push(['Cintura',x.medidas.cintura,m.cintura,'cm']);
    auto.forEach(([n,cur,meta,u])=>g.appendChild(el('div','goal',`<div class="macro-hd"><span>${n} <small>meta de Mi Salud</small></span><b>${cur!=null?num(cur)+' → ':''}${num(meta)} ${u}</b></div>`)));
    active.forEach(i=>{ const cur=Logic.goalCurrentValue(i,x.goalCtx), pct=Logic.goalProgress(i,cur), it=el('div','goal',`<div class="macro-hd"><span>${esc(i.titulo)}</span><button class="icon-btn" aria-label="Eliminar">✕</button></div><small>${cur!=null?`${num(cur)} → `:''}${i.valor_objetivo??''} ${esc(i.unidad||'')}${i.fecha_objetivo?` · ${fmtDate(i.fecha_objetivo)}`:''}</small>${pct!=null?`<div class="bar"><i style="width:${pct}%"></i></div>`:''}`);
      it.querySelector('button').onclick=()=>App.deleteGoal(i.id); g.appendChild(it); });
    g.querySelector('.add').onclick=()=>{ const n=el('div',null,`${field('Objetivo',`<input id="t" placeholder="Ej: Press banca 70 kg">`)}<div class="grid2">${field('Tipo',`<select id="k"><option value="fuerza">Fuerza (1RM)</option><option value="medida">Medida</option><option value="peso">Peso</option><option value="libre">Libre</option></select>`)}${field('Referencia',`<input id="r" placeholder="Ejercicio o medida">`)}</div><div class="grid3">${field('Inicio',`<input id="i" type="number" inputmode="decimal">`)}${field('Meta',`<input id="o" type="number" inputmode="decimal">`)}${field('Unidad',`<input id="u" value="kg">`)}</div>${field('Fecha',`<input id="f" type="date">`)}<button class="btn btn-primary wide">Crear</button>`), s=sheet('Nuevo objetivo',n), q=k=>n.querySelector(k).value;
      n.querySelector('button').onclick=()=>{ if(!q('#t').trim()) return toast('Pon un título'); s.close(); App.addGoal({ titulo:q('#t').trim(), tipo:q('#k'), referencia:q('#r')||null, valor_inicial:+q('#i')||null, valor_objetivo:+q('#o')||null, unidad:q('#u')||null, fecha_objetivo:q('#f')||null, estado:'activo' }); }; };
    w.appendChild(g);

    // Hábitos
    const hc=el('section','card'), doneT=new Set(c.habitLogs.filter(l=>l.fecha===t).map(l=>l.habit_id));
    hc.innerHTML=`<div class="card-hd"><h3>🔁 Hábitos</h3><button class="icon-btn add" aria-label="Agregar hábito">＋</button></div>`;
    c.habits.forEach(b=>{ const on=doneT.has(b.id), st=Logic.habitStreak(c.habitLogs,b.id), it=el('div','list-item',`<button class="check-btn ${on?'on':''}" aria-label="Marcar">${on?'✓':''}</button><div class="li-main"><b>${esc(b.icono||'')} ${esc(b.nombre)}</b><small>${st?`🔥 ${st} días`:'sin racha'}</small></div><button class="icon-btn" aria-label="Eliminar">✕</button>`);
      it.querySelector('.check-btn').onclick=()=>App.toggleHabit(b.id,t,!on); it.querySelector('.icon-btn').onclick=()=>ask(`¿Eliminar ${b.nombre}?`,'','Eliminar',()=>App.deleteHabit(b.id)); hc.appendChild(it); });
    hc.querySelector('.add').onclick=()=>{ const n=el('div',null,`<div class="grid-ico">${field('Ícono',`<input id="i" value="✅">`)}${field('Hábito',`<input id="n">`)}</div><button class="btn btn-primary wide">Crear</button>`), s=sheet('Nuevo hábito',n);
      n.querySelector('button').onclick=()=>{ const v=n.querySelector('#n').value.trim(); if(!v) return toast('Pon un nombre'); s.close(); App.addHabit({ nombre:v, icono:n.querySelector('#i').value||'✅', orden:c.habits.length }); }; };
    w.appendChild(hc);

    // Lesiones
    const ic=el('section','card'); ic.innerHTML=`<div class="card-hd"><h3>🩹 Lesiones y dolor</h3><button class="icon-btn add" aria-label="Agregar lesión">＋</button></div>`;
    if(!c.injuries.length) ic.appendChild(el('p','help','Sin lesiones registradas.'));
    c.injuries.filter(i=>i.estado==='activa').forEach(i=>{ const logs=c.rehab.filter(r=>r.injury_id===i.id).sort((a,b)=>a.fecha<b.fecha?-1:1), lp=logs.length?logs[logs.length-1].dolor:null;
      const guide=lp==null?'Registra el dolor para orientarte.':lp<=3?'Dolor bajo: puedes progresar con cuidado.':lp<=6?'Dolor moderado: mantén la carga.':'Dolor alto: reduce carga. Si persiste, consulta.';
      const it=el('div','inj',`<div class="macro-hd"><b>${esc(i.zona)}</b><button class="btn-link">Recuperada</button></div><small>${lp!=null?`Último dolor ${lp}/10 · `:''}${guide}</small><div class="pain">${[0,2,4,6,8,10].map(n=>`<button data-v="${n}">${n}</button>`).join('')}</div>`);
      it.querySelector('.btn-link').onclick=()=>App.updateInjury(i.id,{ estado:'recuperada', fecha_fin:t });
      it.querySelectorAll('.pain button').forEach(b=>b.onclick=()=>App.addRehab({ injury_id:i.id, fecha:t, dolor:+b.dataset.v, carga:'normal' })); ic.appendChild(it); });
    ic.querySelector('.add').onclick=()=>{ const n=el('div',null,`${field('Zona',`<input id="z">`)}${field('Tipo',`<input id="t">`)}${field('Notas',`<input id="n">`)}<button class="btn btn-primary wide">Registrar</button>`), s=sheet('Nueva lesión',n);
      n.querySelector('button').onclick=()=>{ const z=n.querySelector('#z').value.trim(); if(!z) return toast('Indica la zona'); s.close(); App.addInjury({ zona:z, tipo:n.querySelector('#t').value||null, notas:n.querySelector('#n').value||null, estado:'activa', fecha_inicio:t }); }; };
    w.appendChild(ic);

    // Movilidad
    const mb=el('section','card',`<h3>🧘 Movilidad guiada</h3>`);
    MOBILITY_ROUTINES.forEach(r=>{ const b=el('button','pick',`<b>${r.icono} ${esc(r.nombre)}</b><small>${r.items.length} ejercicios · ~${Math.round(r.items.reduce((a,i)=>a+i.s,0)/60)} min</small>`); b.onclick=()=>UI.startMobility(r); mb.appendChild(b); });
    w.appendChild(mb);
    return w;
  };
})();
