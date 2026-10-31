// ============================================================
//  VISTA Nutrición — diario por comida, día a día.
//  Inspirada en lo mejor de MyFitnessPal, Cronometer y MacroFactor:
//  registro en pocos toques, calidad de la dieta y gasto adaptativo.
// ============================================================
(() => {
  const { el, esc, num, fmtDate, sheet, field, toast, ask, bar, ring } = UI;
  let date = null;
  const mealLabel = k => Logic.MEALS.find(m=>m[0]===k)?.[1] || 'Otros';
  // Comida más probable según la hora
  const mealNow = () => { const h=new Date().getHours(); return h<11?'desayuno':h<16?'almuerzo':h<19?'once':h<22?'cena':'snack'; };
  const logOf = (food, g, comida, fecha) => { const m=Logic.macrosFor(food,g); return { fecha, comida, nombre:food.nombre, gramos:g, ...m, nova:food.nova??null }; };

  // ---------- Cantidad ----------
  function portionSheet(food, comida, fecha, { edit } = {}){
    const n = el('div');
    const porciones = food.porciones || (food.porcion_g && food.porcion_g!==100 ? [['1 porción',food.porcion_g]] : []);
    n.innerHTML = `<p class="muted">${food.marca?esc(food.marca)+' · ':''}${num(food.kcal_100,0)} kcal por 100 g${food.nova===4?' · ultraprocesado':''}</p>
      <div class="chips">${porciones.map(([l,g])=>`<button class="chip" data-g="${g}">${esc(l)}</button>`).join('')}<button class="chip" data-g="100">100 g</button></div>
      <div class="grid2">${field('Gramos',`<input id="pf-g" type="number" inputmode="decimal" value="${edit?edit.gramos:(food.porcion_g||100)}">`)}${field('Comida',`<select id="pf-m">${Logic.MEALS.map(([v,l])=>`<option value="${v}" ${v===comida?'selected':''}>${l}</option>`).join('')}</select>`)}</div>
      <div class="rec" id="pf-p"></div><button class="btn btn-primary wide" id="pf-a">${edit?'Guardar':'Agregar'}</button>
      ${edit?'':'<button class="btn-link" id="pf-f">☆ Guardar como favorito</button>'}`;
    const g = n.querySelector('#pf-g'), prev = n.querySelector('#pf-p');
    const upd = () => { const m=Logic.macrosFor(food,+g.value||0); prev.innerHTML=`<b>${num(m.kcal,0)} kcal</b> · P ${num(m.prot)} · G ${num(m.grasa)} · C ${num(m.carbo)}${m.fibra?` · fibra ${num(m.fibra)}`:''}`; };
    g.oninput = upd; upd();
    n.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{ g.value=c.dataset.g; upd(); });
    const s = sheet(food.nombre, n);
    n.querySelector('#pf-a').onclick = () => { const q=+g.value; if(!q) return toast('Indica la cantidad'); s.close();
      const row = logOf(food,q,n.querySelector('#pf-m').value,fecha);
      edit ? App.updateFood(edit.id,row) : App.logFood(row); };
    n.querySelector('#pf-f')?.addEventListener('click', () => { s.close(); App.saveFavorite(food); });
  }

  // ---------- Agregar alimento ----------
  function addSheet(comida, fecha){
    const c = App.cache, n = el('div');
    n.innerHTML = `<div class="search-row"><input id="q" placeholder="Busca: pollo, marraqueta, yogur…" autocomplete="off"><button class="icon-btn" id="sc" aria-label="Escanear código">📷</button></div>
      <div class="chips"><button class="chip" id="ai">✨ Escribe lo que comiste</button><button class="chip" id="mn">✏️ Manual</button></div><div id="r" class="pick-list"></div>`;
    const s = sheet(`Agregar a ${mealLabel(comida)}`, n), r = n.querySelector('#r'), q = n.querySelector('#q');
    const row = (f, sub) => { const b=el('button','pick',`<b>${esc(f.nombre)}</b><small>${esc(sub ?? `${f.marca?f.marca+' · ':''}${num(f.kcal_100,0)} kcal/100 g`)}</small>`);
      b.onclick=()=>{ s.close(); portionSheet(f,comida,fecha); }; return b; };
    const head = t => r.appendChild(el('div','pick-hd',t));
    const home = () => { r.innerHTML='';
      const fav=c.foods; if(fav.length){ head('Favoritos'); fav.slice(0,8).forEach(f=>r.appendChild(row(f))); }
      const rc=c.recipes; if(rc.length){ head('Recetas'); rc.forEach(x=>{ const b=el('button','pick',`<b>${esc(x.nombre)}</b><small>${num(x.kcal,0)} kcal por porción</small>`); b.onclick=()=>{ s.close(); App.logFood({ fecha, comida, nombre:x.nombre, gramos:1, kcal:x.kcal, prot:x.prot, grasa:x.grasa, carbo:x.carbo }); }; r.appendChild(b); }); }
      const fq=Logic.frequentFoods(c.foodLogs); if(fq.length){ head('Los que más usas'); fq.forEach(f=>r.appendChild(row(f))); }
      if(!fav.length&&!fq.length&&!rc.length) r.appendChild(el('div','empty small','Escribe para buscar. Tienes alimentos chilenos disponibles aun sin conexión.')); };
    let timer;
    const search = () => { const t=q.value.trim(); clearTimeout(timer); if(!t) return home();
      r.innerHTML=''; const local=searchLocalFoods(t), mine=c.foods.filter(f=>foodKey(f.nombre).includes(foodKey(t)));
      [...mine,...local].forEach(f=>r.appendChild(row(f)));
      const extra=el('div'); r.appendChild(extra);
      timer=setTimeout(async()=>{ if(t.length<3||!navigator.onLine) return; extra.innerHTML='<div class="pick-hd">Buscando productos…</div>';
        try { const list=await DB.searchFoods(t); extra.innerHTML=''; if(list.length){ extra.appendChild(el('div','pick-hd','Productos envasados')); list.slice(0,15).forEach(f=>extra.appendChild(row(f))); } else extra.innerHTML=''; }
        catch { extra.innerHTML='<div class="pick-hd">Sin conexión con la base de productos.</div>'; } },500); };
    q.oninput = search; home();
    n.querySelector('#sc').onclick = () => { s.close(); UI.startScanner(async code => { toast('Buscando producto…');
      try { const f=await DB.searchFoodByBarcode(code); f?portionSheet(f,comida,fecha):toast(`Código ${code} no encontrado`); } catch { toast('No se pudo buscar el producto'); } }); };
    n.querySelector('#mn').onclick = () => { s.close(); manualSheet(comida,fecha); };
    n.querySelector('#ai').onclick = () => { s.close(); aiSheet(comida,fecha); };
  }
  function manualSheet(comida, fecha){
    const n=el('div',null,`${field('Nombre',`<input id="m-n">`)}<div class="grid2">${field('Gramos',`<input id="m-g" type="number" inputmode="decimal" value="100">`)}${field('Kcal',`<input id="m-k" type="number" inputmode="decimal">`)}</div>
      <div class="grid3">${field('Proteína',`<input id="m-p" type="number" inputmode="decimal">`)}${field('Grasa',`<input id="m-r" type="number" inputmode="decimal">`)}${field('Carbos',`<input id="m-c" type="number" inputmode="decimal">`)}</div>
      <button class="btn btn-primary wide">Agregar</button>`), v=q=>Number(n.querySelector(q).value)||0;
    const s=sheet('Entrada manual',n);
    n.querySelector('button').onclick=()=>{ const nombre=n.querySelector('#m-n').value.trim(); if(!nombre) return toast('Pon un nombre'); s.close();
      App.logFood({ fecha, comida, nombre, gramos:v('#m-g'), kcal:v('#m-k'), prot:v('#m-p'), grasa:v('#m-r'), carbo:v('#m-c') }); };
  }
  // Registro por lenguaje natural: solo se envía el texto de la comida, y siempre se confirma antes de guardar
  function aiSheet(comida, fecha){
    const n=el('div',null,`<p class="muted">Ej: «2 huevos revueltos, una marraqueta con palta y café con leche».</p><textarea id="t" rows="3"></textarea><button class="btn btn-primary wide">Calcular</button><div id="o"></div>`);
    sheet('Escribe lo que comiste',n);
    const btn=n.querySelector('button'), o=n.querySelector('#o');
    btn.onclick=async()=>{ const t=n.querySelector('#t').value.trim(); if(!t) return; btn.disabled=true; btn.textContent='Calculando…';
      try { const reply=await DB.askAI([{ role:'user', content:`Estima la nutrición de esta comida chilena. Responde SOLO un arreglo JSON, sin texto extra, con objetos {"nombre":string,"gramos":number,"kcal":number,"prot":number,"grasa":number,"carbo":number,"fibra":number}. Comida: ${t}` }],'');
        const items=JSON.parse(reply.slice(reply.indexOf('['),reply.lastIndexOf(']')+1));
        o.innerHTML=`<div class="pick-hd">Revisa antes de guardar (es una estimación)</div>`+items.map(i=>`<div class="list-item"><div class="li-main"><b>${esc(i.nombre)}</b><small>${num(i.gramos,0)} g · ${num(i.kcal,0)} kcal · P ${num(i.prot)}</small></div></div>`).join('');
        const ok=el('button','btn btn-primary wide',`Agregar ${items.length} alimentos`); ok.onclick=()=>{ n.closest('.sheet-ov').remove(); document.body.classList.remove('no-scroll'); App.logFoods(items.map(i=>({ fecha, comida, nombre:String(i.nombre), gramos:+i.gramos||0, kcal:+i.kcal||0, prot:+i.prot||0, grasa:+i.grasa||0, carbo:+i.carbo||0, fibra:+i.fibra||0 }))); }; o.appendChild(ok); }
      catch(e){ o.innerHTML=`<p class="muted">No se pudo calcular: ${esc(e.message||'')}. Usa la búsqueda.</p>`; }
      btn.disabled=false; btn.textContent='Calcular'; };
  }

  function mealCard(comida, logs, fecha){
    const items=logs.filter(l=>(Logic.MEALS.some(m=>m[0]===l.comida)?l.comida:'snack')===comida), sum=Logic.sumFoods(items), card=el('section','card meal');
    card.innerHTML=`<div class="card-hd"><h3>${mealLabel(comida)}</h3><span class="muted">${items.length?`${num(sum.kcal,0)} kcal · ${num(sum.prot,0)} g P`:''}</span><button class="icon-btn add" aria-label="Agregar a ${mealLabel(comida)}">＋</button></div>`;
    items.forEach(l=>{ const it=el('div','list-item',`<button class="li-main"><b>${esc(l.nombre||'')}</b><small>${num(l.gramos,0)} g · ${num(l.kcal,0)} kcal</small></button><button class="icon-btn dl" aria-label="Eliminar">✕</button>`);
      it.querySelector('.li-main').onclick=()=>portionSheet(Logic.foodFromLog(l),l.comida,fecha,{ edit:l });
      it.querySelector('.dl').onclick=()=>App.deleteFood(l.id); card.appendChild(it); });
    card.querySelector('.add').onclick=()=>addSheet(comida,fecha);
    const y=App.cache.foodLogs.filter(l=>l.fecha===Logic.addDays(fecha,-1)&&l.comida===comida);
    const f=el('div','meal-ft');
    if(!items.length&&y.length){ const b=el('button','btn-link',`Repetir lo de ayer (${y.length})`); b.onclick=()=>App.logFoods(y.map(({id,user_id,created_at,fecha:_,...r})=>({ ...r, fecha }))); f.appendChild(b); }
    if(items.length>1){ const b=el('button','btn-link','Guardar como receta'); b.onclick=()=>recipeFrom(items,sum,mealLabel(comida)); f.appendChild(b); }
    if(f.childElementCount) card.appendChild(f);
    return card;
  }
  function recipeFrom(items,sum,def){
    const n=el('div',null,`${field('Nombre',`<input id="n" value="${esc(def)}">`)}<button class="btn btn-primary wide">Guardar</button>`), s=sheet('Guardar receta',n);
    n.querySelector('button').onclick=()=>{ s.close(); App.addRecipe({ nombre:n.querySelector('#n').value.trim()||def, porciones:1, kcal:Math.round(sum.kcal), prot:+sum.prot.toFixed(1), grasa:+sum.grasa.toFixed(1), carbo:+sum.carbo.toFixed(1),
      ingredientes:items.map(({nombre,gramos,kcal,prot,grasa,carbo})=>({nombre,gramos,kcal,prot,grasa,carbo})) }); };
  }
  function targetsSheet(t){
    const c=App.ctx(), calc=t.calc, p=App.cache.profile||{};
    const n=el('div',null,`${calc?`<div class="rec">Cálculo para ti: basal ${num(calc.bmr,0)} · mantenimiento ~${num(calc.maint,0)} kcal · ritmo ${calc.kgSemana>0?'+':''}${num(calc.kgSemana,2)} kg/sem.</div>`:'<p class="muted">Completa tu perfil para calcular.</p>'}
      <div class="grid2">${field('Kcal',`<input id="k" type="number" inputmode="numeric" value="${p.kcal_objetivo??''}" placeholder="${calc?.kcal??''}">`)}${field('Proteína (g)',`<input id="p" type="number" inputmode="numeric" value="${p.proteina_g??''}" placeholder="${calc?.prot??''}">`)}</div>
      <div class="grid2">${field('Grasa (g)',`<input id="g" type="number" inputmode="numeric" value="${p.grasa_g??''}" placeholder="${calc?.grasa??''}">`)}${field('Carbos (g)',`<input id="c" type="number" inputmode="numeric" value="${p.carbo_g??''}" placeholder="${calc?.carbo??''}">`)}</div>
      <p class="help">Vacío = se recalcula solo con tu peso, cintura y objetivo.</p><div class="stack"><button class="btn btn-primary wide" id="sv">Guardar</button><button class="btn btn-ghost wide" id="au">Usar cálculo automático</button></div>`);
    const s=sheet('Objetivos diarios',n), v=q=>Number(n.querySelector(q).value)||null;
    n.querySelector('#sv').onclick=()=>{ s.close(); App.saveProfile({ kcal_objetivo:v('#k'), proteina_g:v('#p'), grasa_g:v('#g'), carbo_g:v('#c') }); };
    n.querySelector('#au').onclick=()=>{ s.close(); App.saveProfile({ kcal_objetivo:null, proteina_g:null, grasa_g:null, carbo_g:null }); };
  }

  Views.nutricion = () => {
    const c=App.cache, x=App.ctx(), today=Logic.todayISO(); date=date||today;
    const w=el('div'), logs=c.foodLogs.filter(l=>l.fecha===date), sum=Logic.sumFoods(logs), t=x.targets;
    const nav=el('header','date-nav',`<button class="icon-btn" aria-label="Día anterior">‹</button><div><h1>${fmtDate(date)}</h1><input type="date" value="${date}" aria-label="Elegir fecha"></div><button class="icon-btn" aria-label="Día siguiente" ${date>=today?'disabled':''}>›</button>`);
    const [p,n]=nav.querySelectorAll('button');
    p.onclick=()=>{ date=Logic.addDays(date,-1); App.render(); }; n.onclick=()=>{ date=Logic.addDays(date,1); App.render(); };
    nav.querySelector('input').onchange=e=>{ date=e.target.value||today; App.render(); };
    w.appendChild(nav);

    const rest=t.kcal?Math.round(t.kcal-sum.kcal):null, sm=el('section','card sum');
    sm.innerHTML=`<div class="sum-top">${ring(t.kcal?sum.kcal/t.kcal*100:0,num(sum.kcal,0),104)}<div><b class="big">${rest==null?'—':num(Math.abs(rest),0)}</b><span>${rest==null?'sin objetivo':rest>=0?'kcal disponibles':'kcal sobre el objetivo'}</span><button class="btn-link" id="tg">Objetivo ${t.kcal?num(t.kcal,0):'—'} ${t.manual?'(manual)':'(auto)'}</button></div></div>
      ${bar('Proteína',sum.prot,t.prot)}${bar('Carbohidratos',sum.carbo,t.carbo)}${bar('Grasa',sum.grasa,t.grasa)}
      <details><summary>Calidad de la dieta</summary>${bar('Fibra',sum.fibra,t.fibra)}${bar('Azúcares (límite)',sum.azucar,t.azucar,'g',{limit:true})}${bar('Grasa saturada (límite)',sum.sat,t.sat,'g',{limit:true})}${bar('Sodio (límite)',sum.sodio,2000,'mg',{limit:true})}
      <p class="help">Fibra y micronutrientes solo cuentan en alimentos que los traen; los productos pueden venir incompletos.</p></details>`;
    sm.querySelector('#tg').onclick=()=>targetsSheet(t); w.appendChild(sm);

    const agua=Logic.saludValue(c.salud,'agua',date)||0, meta=c.salud?.metas?.agua||2000, vaso=c.salud?.metas?.vaso||250, wc=el('section','card water');
    wc.innerHTML=`<div class="card-hd"><h3>💧 Agua</h3><span class="muted">${num(agua,0)} / ${num(meta,0)} ml</span></div><div class="bar blue"><i style="width:${Math.min(100,agua/meta*100)}%"></i></div>
      <div class="row-btns"><button class="btn btn-ghost" data-v="${vaso}">+ ${vaso} ml</button><button class="btn btn-ghost" data-v="500">+ 500 ml</button></div>`;
    wc.querySelectorAll('button').forEach(b=>b.onclick=()=>App.addWater(+b.dataset.v,date)); w.appendChild(wc);

    Logic.MEALS.forEach(([k])=>w.appendChild(mealCard(k,logs,date)));

    // Semana
    const wk=Logic.nutritionWeek(c.foodLogs,today), wkc=el('section','card');
    const up=Logic.upfShare(c.foodLogs.filter(l=>l.fecha>=Logic.isoDaysAgo(6)));
    wkc.innerHTML=`<h3>Tu semana</h3><div class="tiles">${UI.tile(wk.kcal?num(wk.kcal,0):'—','kcal/día')}${UI.tile(wk.prot?num(wk.prot,0)+' g':'—','proteína/día')}${UI.tile(wk.logged+'/7','días anotados')}</div>
      <div class="chartbox short"><canvas id="c-nw"></canvas></div>${up!=null?`<p class="help">🏭 ${up} % de tus calorías clasificadas fue ultraprocesado esta semana.</p>`:''}`;
    w.appendChild(wkc);
    setTimeout(()=>{ const k=UI.chartColors(); UI.chart(wkc.querySelector('#c-nw'),{ type:'bar', data:{ labels:wk.days.map(d=>new Date(d.fecha+'T12:00:00').toLocaleDateString('es-CL',{weekday:'narrow'})), datasets:[{ data:wk.days.map(d=>Math.round(d.kcal)), backgroundColor:k.line, borderRadius:6 }] }, options:UI.baseOpts(k) }); },30);

    const ad=Logic.adaptiveTDEE(c.weights,c.foodLogs), adv=Logic.adaptiveAdvice(x.profile,ad);
    if(adv){ w.appendChild(el('section','card',`<h3>Gasto real estimado</h3><div class="rec"><span class="${adv.clase}">~${num(ad.tdee,0)} kcal/día</span> ${esc(adv.texto)}</div><p class="help">Calculado con ${ad.loggedDays} días anotados y la tendencia de tu peso.</p>`)); }

    // Suplementos
    const done=new Set(c.supplementLogs.filter(l=>l.fecha===date).map(l=>l.supplement_id)), sp=el('section','card');
    sp.innerHTML=`<div class="card-hd"><h3>💊 Suplementos</h3><button class="icon-btn" id="sp-a" aria-label="Agregar suplemento">＋</button></div>`;
    if(!c.supplements.length) sp.appendChild(el('p','help','Solo los que quieras seguir aquí. Tus fármacos se registran en Mi Salud.'));
    c.supplements.forEach(s=>{ const on=done.has(s.id), it=el('div','list-item',`<button class="check-btn ${on?'on':''}" aria-label="Marcar">${on?'✓':''}</button><div class="li-main"><b>${esc(s.nombre)}</b><small>${esc([s.dosis,s.horario].filter(Boolean).join(' · '))}</small></div><button class="icon-btn dl" aria-label="Quitar">✕</button>`);
      it.querySelector('.check-btn').onclick=()=>App.toggleSupplement(s.id,date,!on); it.querySelector('.dl').onclick=()=>App.deleteSupplement(s.id); sp.appendChild(it); });
    sp.querySelector('#sp-a').onclick=()=>{ const f=el('div',null,`${field('Nombre',`<input id="n">`)}<div class="grid2">${field('Dosis',`<input id="d">`)}${field('Horario',`<input id="h">`)}</div><button class="btn btn-primary wide">Agregar</button>`), s=sheet('Suplemento',f);
      f.querySelector('button').onclick=()=>{ const v=f.querySelector('#n').value.trim(); if(!v) return toast('Pon un nombre'); s.close(); App.addSupplement({ nombre:v, dosis:f.querySelector('#d').value||null, horario:f.querySelector('#h').value||null }); }; };
    w.appendChild(sp);
    return w;
  };
  App.quickFood = () => { date=Logic.todayISO(); addSheet(mealNow(),date); };
})();
