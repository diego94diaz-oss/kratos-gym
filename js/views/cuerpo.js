// ============================================================
//  VISTA Cuerpo — peso, composición y medidas con su evidencia.
//  Peso y cintura se guardan en Mi Salud (fuente de verdad).
// ============================================================
(() => {
  const { el, esc, num, fmtDate, sheet, field, toast, ask } = UI;
  const metric = (titulo, valor, cls, detalle) => `<div class="metric ${cls?.nivel||''}"><span>${esc(titulo)}</span><b>${valor}</b><small>${esc(cls?.label||detalle||'')}</small></div>`;

  App.weightSheet = () => {
    const last=App.ctx().lastWeight;
    const n=el('div',null,`<div class="grid2">${field('Peso (kg)',`<input id="w" type="number" inputmode="decimal" step="0.1" placeholder="${last||''}">`)}${field('Fecha',`<input id="d" type="date" value="${Logic.todayISO()}">`)}</div>
      ${field('Toma',`<select id="c"><option value="ayunas">En ayunas</option><option value="otro">Después de comer</option></select>`)}
      <p class="help">Solo en ayunas la tendencia es comparable. Se guarda en Mi Salud.</p><button class="btn btn-primary wide">Guardar</button>`), s=sheet('Registrar peso',n);
    n.querySelector('button').onclick=()=>{ const v=+n.querySelector('#w').value; if(v<20||v>400) return toast('Revisa el peso'); s.close(); App.addWeight({ fecha:n.querySelector('#d').value, valor:v, condicion:n.querySelector('#c').value }); };
  };
  App.measureSheet = () => {
    const n=el('div',null,`<div class="grid2">${field('Medida',`<select id="t">${Logic.MEASURE_DEFS.map(([k,l])=>`<option value="${k}" ${k==='cintura'?'selected':''}>${l}</option>`).join('')}</select>`)}${field('Centímetros',`<input id="v" type="number" inputmode="decimal" step="0.1">`)}</div>
      ${field('Fecha',`<input id="d" type="date" value="${Logic.todayISO()}">`)}<p class="help">Cintura: a medio camino entre la última costilla y la cresta ilíaca, al final de una espiración.</p><button class="btn btn-primary wide">Guardar</button>`), s=sheet('Registrar medida',n);
    n.querySelector('button').onclick=()=>{ const v=+n.querySelector('#v').value; if(!v) return toast('Indica los centímetros'); s.close(); App.addMeasure({ medida:n.querySelector('#t').value, valor_cm:v, fecha:n.querySelector('#d').value }); };
  };
  function sourcesSheet(){ sheet('De dónde salen estos cálculos',`<dl class="sources">${Evidence.SOURCES.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl><p class="help">Son estimaciones para orientar tu progreso, no un diagnóstico.</p>`); }
  function compareSheet(a,b){
    const n=el('div',null,`<div class="cmp"><img src="${a.url}" alt=""><div class="cmp-b"><img src="${b.url}" alt=""></div></div><input type="range" min="0" max="100" value="50" aria-label="Comparar"><p class="help">${fmtDate(a.fecha)} → ${fmtDate(b.fecha)}</p>`);
    n.querySelector('input').oninput=e=>n.querySelector('.cmp-b').style.clipPath=`inset(0 0 0 ${e.target.value}%)`;
    n.querySelector('.cmp-b').style.clipPath='inset(0 0 0 50%)'; sheet('Comparar fotos',n);
  }

  Views.cuerpo = () => {
    const c=App.cache, x=App.ctx(), p=x.profile, w=el('div'), peso=x.lastWeight, cm=p.estatura_cm;
    w.appendChild(el('header','page-hd',`<h1>Cuerpo</h1><small>${p.edad?`${p.edad} años · `:''}${cm?`${num(cm)} cm`:'completa tu estatura en Ajustes'}${c.salud?.ok?' · conectado a Mi Salud':''}</small>`));
    const act=el('div','row-btns'); [['⚖️ Peso',App.weightSheet],['📏 Medida',App.measureSheet]].forEach(([t,f])=>{ const b=el('button','btn btn-primary',t); b.onclick=f; act.appendChild(b); }); w.appendChild(act);

    // Peso y tendencia
    const trend=Logic.weeklyTrend(c.weights), avg=Logic.weeklyAvg(Logic.recentWeights(c.weights,14)), meta=p.peso_objetivo_kg, adv=Logic.bodyAdvice(p,c.weights.length?Logic.recentWeights(c.weights,21):[],x.medidas);
    const pc=el('section','card'); pc.innerHTML=`<div class="tiles">${UI.tile(peso?num(peso):'—','kg',x.lastWeightRow?fmtDate(x.lastWeightRow.fecha):'')}${UI.tile(trend!=null?(trend>0?'+':'')+num(trend,2):'—','kg/semana')}${UI.tile(meta?num(Math.abs(peso-meta)):'—','kg a la meta',meta?`meta ${num(meta)}`:'')}</div>
      ${c.weights.length>1?'<div class="chartbox"><canvas id="c-w"></canvas></div>':''}${avg?`<div class="rec"><span class="${adv.clase}">TENDENCIA</span> ${esc(adv.texto)}</div>`:''}`;
    w.appendChild(pc);
    if(c.weights.length>1) setTimeout(()=>{ const k=UI.chartColors(), rows=c.weights.slice(-60), tr=Logic.weightTrendSeries(rows), map=new Map(tr.map(t=>[t.fecha,t.v]));
      const ds=[{ data:rows.map(r=>r.peso_kg), borderColor:'transparent', backgroundColor:k.text, pointRadius:2, showLine:false },{ data:rows.map(r=>map.get(r.fecha)??null), borderColor:k.line, pointRadius:0, tension:.35, borderWidth:3, spanGaps:true }];
      if(meta) ds.push({ data:rows.map(()=>meta), borderColor:k.accent, borderDash:[6,4], pointRadius:0, borderWidth:2 });
      UI.chart(pc.querySelector('#c-w'),{ type:'line', data:{ labels:rows.map(r=>UI.shortDate(r.fecha)), datasets:ds }, options:UI.baseOpts(k) }); },30);

    // Indicadores
    const m=x.medidas, imc=Evidence.bmi(peso,cm), ice=Evidence.whtr(m.cintura,cm), cc=Evidence.whr(m.cintura,m.cadera), fat=x.fat, comp=Evidence.composition(fat?.pct,peso,cm);
    const ic=el('section','card');
    ic.innerHTML=`<div class="card-hd"><h3>Tus indicadores</h3><button class="btn-link" id="src">Ver evidencia</button></div><div class="metrics">
      ${metric('IMC',num(imc),Evidence.bmiClass(imc),'falta peso')}${metric('Cintura / estatura',ice!=null?num(ice,2):'—',Evidence.whtrClass(ice),'falta cintura')}
      ${metric('Cintura',m.cintura?num(m.cintura)+' cm':'—',Evidence.waistClass(m.cintura,p.sexo),'sin registro')}${cc!=null?metric('Cintura / cadera',num(cc,2),Evidence.whrClass(cc,p.sexo)):''}</div>
      ${imc!=null&&!ice?'<p class="help">El IMC solo no basta: registra tu cintura para interpretarlo.</p>':''}
      ${ice!=null&&imc!=null?`<div class="rec">${esc(reading(imc,ice,p.sexo,m.cintura))}</div>`:''}`;
    ic.querySelector('#src').onclick=sourcesSheet; w.appendChild(ic);

    // Composición
    const cp=el('section','card');
    cp.innerHTML=fat?`<h3>Composición estimada</h3><div class="tiles">${UI.tile(num(fat.pct)+' %','grasa')}${UI.tile(comp?num(comp.magra):'—','kg magra')}${UI.tile(comp?.ffmi?num(comp.ffmi):'—','FFMI')}</div>
      <p class="help">Método: ${esc(fat.metodo)}. ${fat.alternativas.length?'Otros: '+esc(fat.alternativas.map(a=>`${a.metodo} ${num(a.pct)} %`).join(' · '))+'. ':''}Sigue la tendencia más que el número exacto.</p>`
      :`<h3>Composición</h3><p class="help">Registra tu cintura para estimar tu % de grasa.</p>`;
    w.appendChild(cp);

    // Medidas
    const latest=Logic.latestMeasures(c.measurements), keys=Logic.MEASURE_DEFS.filter(([k])=>latest[k]);
    if(keys.length){ const mc=el('section','card'); mc.innerHTML=`<h3>Medidas</h3><div class="tiles wrap">${keys.map(([k,l])=>UI.tile(num(latest[k].valor_cm),l)).join('')}</div>
      <select id="m-p" aria-label="Medida">${keys.map(([k,l])=>`<option value="${k}" ${k==='cintura'?'selected':''}>${l}</option>`).join('')}</select><div class="chartbox short"><canvas id="c-m"></canvas></div>`; w.appendChild(mc);
      const draw=()=>{ const d=Logic.measureSeries(c.measurements,mc.querySelector('#m-p').value), k=UI.chartColors(); UI.chart(mc.querySelector('#c-m'),{ type:'line', data:{ labels:d.map(i=>UI.shortDate(i[0])), datasets:[{ data:d.map(i=>i[1]), borderColor:k.line, tension:.3, pointRadius:3 }] }, options:UI.baseOpts(k) }); };
      mc.querySelector('#m-p').onchange=draw; setTimeout(draw,30); }

    // Fotos
    const ph=el('section','card'), photos=c.photos;
    ph.innerHTML=`<div class="card-hd"><h3>📸 Fotos</h3>${photos.length>1?'<button class="btn-link" id="cmp">Comparar</button>':''}</div>
      <div class="grid2"><select id="ph-p" aria-label="Pose"><option value="frente">Frente</option><option value="lado">Lado</option><option value="espalda">Espalda</option></select><input type="date" id="ph-d" value="${Logic.todayISO()}" aria-label="Fecha"></div>
      <div class="row-btns"><label class="btn btn-ghost">Galería<input type="file" id="ph-g" accept="image/*" hidden></label><label class="btn btn-ghost">Cámara<input type="file" id="ph-c" accept="image/*" capture="environment" hidden></label></div>
      <div class="photo-grid">${photos.length?'':'<p class="help">Privadas: solo tú puedes verlas.</p>'}</div>`;
    const grid=ph.querySelector('.photo-grid');
    photos.slice().reverse().slice(0,12).forEach(f=>{ const cell=el('div','photo-cell',`<img src="${f.url||''}" alt="" loading="lazy"><span>${fmtDate(f.fecha)}</span><button aria-label="Eliminar">✕</button>`);
      cell.querySelector('button').onclick=()=>ask('¿Eliminar foto?','No se puede deshacer.','Eliminar',()=>App.deletePhoto(f.id,f.path)); grid.appendChild(cell); });
    const pick=e=>{ const f=e.target.files[0]; if(f) App.addPhoto(f,ph.querySelector('#ph-p').value,ph.querySelector('#ph-d').value); e.target.value=''; };
    ph.querySelector('#ph-g').onchange=pick; ph.querySelector('#ph-c').onchange=pick;
    ph.querySelector('#cmp')?.addEventListener('click',()=>compareSheet(photos[0],photos[photos.length-1]));
    w.appendChild(ph);

    // Historial editable
    const hs=el('details','card hist',`<summary>Historial de peso</summary>`);
    [...c.weights].reverse().slice(0,30).forEach(r=>{ const it=el('div','list-item',`<div class="li-main"><b>${num(r.peso_kg)} kg</b><small>${fmtDate(r.fecha)}${r.condicion==='ayunas'?' · en ayunas':r.condicion==='otro'?' · post comida':''}${r.origen==='historial'?' · historial':''}</small></div><button class="icon-btn" aria-label="Eliminar">✕</button>`);
      it.querySelector('button').onclick=()=>ask('¿Eliminar registro?','También sale de Mi Salud si está guardado allá.','Eliminar',()=>App.deleteWeight(r)); hs.appendChild(it); });
    w.appendChild(hs);
    return w;
  };
  // Lectura conjunta: la Comisión Lancet 2025 pide IMC + una medida de grasa central
  function reading(imc, ice, sexo, cintura){
    const central = ice >= 0.5 || Evidence.waistClass(cintura,sexo)?.nivel==='bad';
    if (imc >= 40) return 'IMC ≥ 40: el exceso de grasa se asume sin otras medidas.';
    if (imc >= 25 && central) return 'El IMC y la cintura coinciden: hay exceso de grasa central. Bajar cintura es el objetivo con más impacto en tu salud.';
    if (imc >= 25) return 'IMC alto con cintura en rango: puede reflejar masa muscular más que grasa.';
    if (central) return 'IMC normal con cintura aumentada: el riesgo central no se ve en el IMC. Sigue la cintura.';
    return 'IMC y cintura en rango saludable.';
  }
})();
