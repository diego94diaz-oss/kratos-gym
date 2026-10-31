// ============================================================
//  LOGIC — Progresión de carga, PRs, análisis de peso corporal
// ============================================================
const Logic = (() => {

  // Fechas siempre en hora local: toISOString() es UTC y en Chile adelantaba el día desde las 20-21 h.
  const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayISO = () => dateISO(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dateISO(d); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

  const FREE = 'Libre';
  // Rutinas = valores de exercises.dia, con cualquier nombre
  function routinesOf(exercises) {
    return [...new Set(exercises.filter(e => e.dia && e.activo !== false).map(e => e.dia))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  }
  // Siguiente rutina de la rotación. Las sesiones libres no la mueven.
  function nextDay(allSets, routines = ['A','B']) {
    if (!routines.length) return null;
    const last = allSets.filter(s => routines.includes(s.rutina)).reduce((a,s) => !a || s.fecha >= a.fecha ? s : a, null);
    if (!last) return routines[0];
    return routines[(routines.indexOf(last.rutina) + 1) % routines.length];
  }

  // Última sesión registrada de un ejercicio -> [{serie,reps,peso,rir}]
  function lastSessionOf(sets, ejercicio) {
    const rows = sets.filter(s => s.ejercicio === ejercicio);
    if (!rows.length) return null;
    const fecha = rows.map(r => r.fecha).sort().pop();
    return { fecha, sets: rows.filter(r => r.fecha === fecha).sort((a,b)=>a.serie-b.serie) };
  }

  // RECOMENDACIÓN de carga (doble progresión)
  // Devuelve { accion:'subir'|'mantener'|'bajar'|'inicio', peso, texto, clase }
  function recommend(ex, sets) {
    const last = lastSessionOf(sets, ex.nombre);
    if (!last) {
      return { accion:'inicio', peso:null, clase:'tag-keep',
        texto:`Primera vez. Calibra con RIR ${ex.rir_obj ?? 2}-3 en ${ex.reps_min}-${ex.reps_max} reps.` };
    }
    const eff = last.sets.filter(s => s.set_type !== 'calentamiento');
    const base = eff.length ? eff : last.sets;
    const work = base.filter(s => s.peso_kg > 0);
    const ref = work.length ? work : base;
    const maxPeso = Math.max(...ref.map(s => s.peso_kg));
    const topSets = ref.filter(s => s.peso_kg === maxPeso);
    const allHitTop = topSets.every(s => s.reps >= ex.reps_max);
    const someBelowMin = ref.some(s => s.reps < ex.reps_min);
    const avgRir = ref.filter(s=>s.rir!=null).reduce((a,s,_,arr)=> a + s.rir/arr.length, 0);

    if (ex.unidad === 'tiempo') {
      const top = Math.max(...ref.map(s=>s.reps));
      if (top >= ex.reps_max) return { accion:'subir', peso:null, clase:'tag-up',
        texto:`Subió de ${top}s. Apunta a más tiempo (${ex.reps_max}s+) o variante más difícil.` };
      return { accion:'mantener', peso:null, clase:'tag-keep', texto:`Mantén y suma segundos hacia ${ex.reps_max}s.` };
    }
    if (ex.unidad === 'peso_corporal') {
      const topReps = Math.max(...ref.map(s=>s.reps));
      if (topReps >= ex.reps_max) return { accion:'subir', peso:null, clase:'tag-up',
        texto:`Llegaste a ${topReps} reps. Añade dificultad (menos asistencia / lastre).` };
      return { accion:'mantener', peso:null, clase:'tag-keep', texto:`Suma reps hacia ${ex.reps_max} antes de añadir dificultad.` };
    }

    if (allHitTop && (isNaN(avgRir) || avgRir >= 0.5)) {
      const nuevo = +(maxPeso + ex.incremento_kg).toFixed(1);
      return { accion:'subir', peso:nuevo, clase:'tag-up',
        texto:`✅ Completaste ${ex.reps_max} reps en todas. Sube a ${nuevo} kg (+${ex.incremento_kg}).` };
    }
    if (someBelowMin) {
      return { accion:'bajar', peso:maxPeso, clase:'tag-down',
        texto:`No llegaste al mínimo (${ex.reps_min}). Mantén ${maxPeso} kg o baja un poco y prioriza técnica.` };
    }
    return { accion:'mantener', peso:maxPeso, clase:'tag-keep',
      texto:`Mantén ${maxPeso} kg y busca llegar a ${ex.reps_max} reps en todas las series.` };
  }

  // PR por ejercicio = mayor peso; desempate por reps. (estimado 1RM Epley)
  function prsByExercise(sets) {
    const map = {};
    sets.forEach(s => {
      if (s.peso_kg <= 0 || s.set_type === 'calentamiento') return;
      const e1rm = s.peso_kg * (1 + s.reps / 30);
      const cur = map[s.ejercicio];
      if (!cur || e1rm > cur.e1rm) map[s.ejercicio] = { peso:s.peso_kg, reps:s.reps, fecha:s.fecha, e1rm };
    });
    return map;
  }

  // Detecta si los sets nuevos rompen PR previo
  function newPRs(prevSets, newRows) {
    const prev = prsByExercise(prevSets);
    const out = [];
    const byEx = {};
    newRows.forEach(r => {
      if (r.peso_kg <= 0 || r.set_type === 'calentamiento') return;
      const e1rm = r.peso_kg * (1 + r.reps / 30);
      if (!byEx[r.ejercicio] || e1rm > byEx[r.ejercicio].e1rm)
        byEx[r.ejercicio] = { peso:r.peso_kg, reps:r.reps, e1rm };
    });
    Object.entries(byEx).forEach(([ej, v]) => {
      if (!prev[ej] || v.e1rm > prev[ej].e1rm + 0.01) out.push({ ejercicio:ej, ...v });
    });
    return out;
  }

  // Volumen total (kg) por sesión/fecha
  function volumeByDate(sets) {
    const map = {};
    sets.forEach(s => { if (s.set_type === 'calentamiento') return; map[s.fecha] = (map[s.fecha]||0) + s.peso_kg * s.reps; });
    return Object.entries(map).sort().map(([fecha, vol]) => ({ fecha, vol: Math.round(vol) }));
  }

  // ---- Peso corporal ----
  // Solo registros de la ventana real de días. Con tomas en ayunas suficientes, descarta las
  // post-comida (leen 0,6-1,2 kg más y ensucian la tendencia).
  function recentWeights(weights, days) {
    const win = weights.filter(w => w.fecha >= isoDaysAgo(days));
    const fasted = win.filter(w => w.condicion !== 'otro');
    return fasted.length >= 4 ? fasted : win;
  }
  function weeklyAvg(weights) {
    if (!weights.length) return null;
    const last7 = weights.slice(-7);
    return +(last7.reduce((a,w)=>a+Number(w.peso_kg),0)/last7.length).toFixed(2);
  }
  // tendencia kg/semana (regresión simple sobre últimos 21 días)
  function weeklyTrend(weights) {
    const pts = recentWeights(weights, 21).map(w => ({ t: new Date(w.fecha).getTime()/86400000, y: Number(w.peso_kg) }));
    if (pts.length < 4) return null;
    const n = pts.length, sx = pts.reduce((a,p)=>a+p.t,0), sy = pts.reduce((a,p)=>a+p.y,0);
    const sxx = pts.reduce((a,p)=>a+p.t*p.t,0), sxy = pts.reduce((a,p)=>a+p.t*p.y,0);
    const slope = (n*sxy - sx*sy) / (n*sxx - sx*sx);
    return +(slope*7).toFixed(2); // kg/semana
  }

  // Compara la tendencia con el ritmo que corresponde a tu objetivo y composición (js/evidence.js)
  function bodyAdvice(profile, weights, medidas = {}) {
    const avg = weeklyAvg(weights), trend = weeklyTrend(weights);
    if (avg == null) return { clase:'tag-keep', texto:'Registra tu peso 3-4×/semana para empezar la curva.' };
    const dec = (v, d) => v.toFixed(d).replace('.', ',');
    const fmt = `Promedio ~${dec(avg,1)} kg.` + (trend!=null ? ` Tendencia ${trend>0?'+':''}${dec(trend,2)} kg/sem.` : '');
    if (trend == null) return { clase:'tag-keep', texto:`${fmt} Con 4 pesos en 3 semanas se calcula tu ritmo.` };
    const meta = avg * Evidence.weeklyRate({ objetivo:profile?.objetivo||'recomposicion', peso:avg, estatura_cm:profile?.estatura_cm, cintura:medidas.cintura }) / 100;
    const tol = Math.max(0.2, Math.abs(meta)*0.6), metaTxt = `${meta>0?'+':''}${dec(meta,2)} kg/sem`;
    if (trend < meta-tol) return { clase:'tag-down', texto:`${fmt} Vas por debajo de tu ritmo (${metaTxt}): podrías perder músculo. Sube ~150 kcal.` };
    if (trend > meta+tol) return { clase:'tag-down', texto:`${fmt} Vas sobre tu ritmo (${metaTxt}). Baja ~150 kcal.` };
    return { clase:'tag-up', texto:`${fmt} 👌 En ritmo (${metaTxt}). Mantén y prioriza proteína.` };
  }

  // ---- Medidas corporales / composición ----
  // Catálogo de perímetros estándar (clave -> etiqueta)
  const MEASURE_DEFS = [
    ['cuello','Cuello'], ['hombros','Hombros'], ['pecho','Pecho'],
    ['cintura','Cintura'], ['cadera','Cadera'], ['biceps','Bíceps'],
    ['antebrazo','Antebrazo'], ['muslo','Muslo'], ['pantorrilla','Pantorrilla'],
  ];

  // Último valor registrado de cada medida -> { medida: {valor_cm, fecha} }
  function latestMeasures(rows) {
    const map = {};
    rows.forEach(m => {
      const cur = map[m.medida];
      if (!cur || m.fecha >= cur.fecha) map[m.medida] = { valor_cm: Number(m.valor_cm), fecha: m.fecha };
    });
    return map;
  }
  // Serie temporal de una medida -> [[fecha, valor], ...] ordenada
  function measureSeries(rows, medida) {
    return rows.filter(m => m.medida === medida)
      .map(m => [m.fecha, Number(m.valor_cm)])
      .sort((a,b)=> a[0]<b[0]?-1:1);
  }

  // Mejor estimación disponible -> { pct, metodo, alternativas }
  function bestBodyFat(profile, peso, measurements) {
    const latest = latestMeasures(measurements || []);
    const medidas = {}; Object.keys(latest).forEach(k => medidas[k] = latest[k].valor_cm);
    return Evidence.bodyFat({ sexo:profile?.sexo||'h', peso, estatura_cm:profile?.estatura_cm, edad:profile?.edad, medidas, manual:profile?.grasa_pct });
  }
  // Proyección de peso a N semanas según tendencia
  function projectWeight(weights, weeks=4) {
    const avg = weeklyAvg(weights), trend = weeklyTrend(weights);
    if (avg == null || trend == null) return null;
    return { value:+(avg + trend*weeks).toFixed(1), weeks, trend };
  }
  const composition = (bfPct, pesoKg, cm) => Evidence.composition(bfPct, pesoKg, cm);

  // ---- Nutrición ----
  const MEALS = [['desayuno','Desayuno'],['almuerzo','Almuerzo'],['once','Once'],['cena','Cena'],['snack','Colación']];
  const ACTIVITY = [
    [1.2,  'Sedentario (sin ejercicio)'],
    [1.375,'Ligero (1-3 días/sem)'],
    [1.45, 'Moderado-bajo (3 días/sem)'],
    [1.55, 'Moderado (3-5 días/sem)'],
    [1.725,'Alto (6-7 días/sem)'],
  ];

  // Objetivos calculados con evidencia (ver js/evidence.js)
  function nutritionTargets(profile, pesoActual, medidas = {}) {
    const peso = pesoActual || profile?.peso_objetivo_kg;
    if (!peso) return null;
    const fat = Evidence.bodyFat({ sexo:profile?.sexo||'h', peso, estatura_cm:profile?.estatura_cm, edad:profile?.edad, medidas, manual:profile?.grasa_pct });
    return Evidence.targets({ sexo:profile?.sexo||'h', peso, estatura_cm:profile?.estatura_cm, edad:profile?.edad,
      actividad:Number(profile?.actividad)||1.45, objetivo:profile?.objetivo||'recomposicion',
      magra:Evidence.composition(fat?.pct, peso)?.magra, cintura:medidas.cintura });
  }

  // Objetivos efectivos: manuales del perfil si existen, si no los calculados
  function effectiveTargets(profile, pesoActual, medidas) {
    const calc = nutritionTargets(profile, pesoActual, medidas);
    return {
      kcal:  profile?.kcal_objetivo || calc?.kcal || null,
      prot:  profile?.proteina_g    || calc?.prot || null,
      grasa: profile?.grasa_g       || calc?.grasa || null,
      carbo: profile?.carbo_g       || calc?.carbo || null,
      fibra: calc?.fibra ?? 25, sat: calc?.sat ?? null, azucar: calc?.azucar ?? null, sodio: 2000,
      manual: !!profile?.kcal_objetivo, calc,
    };
  }

  // Macros de una porción a partir de valores por 100 g
  const MACROS = [['kcal',0],['prot',1],['grasa',1],['carbo',1],['fibra',1],['azucar',1],['sat',1],['sodio',0]];
  function macrosFor(food, gramos) {
    const f = gramos / 100, out = {};
    MACROS.forEach(([k,d]) => { const v = food[k+'_100']; out[k] = v != null ? +(v*f).toFixed(d) : null; });
    return out;
  }

  // Suma de un conjunto de registros alimentarios
  function sumFoods(logs) {
    const out = {}; MACROS.forEach(([k]) => out[k] = 0);
    logs.forEach(l => MACROS.forEach(([k]) => out[k] += +l[k] || 0));
    return out;
  }

  // Valores por 100 g reconstruidos desde un registro (para repetirlo o cambiar la cantidad)
  function foodFromLog(l) {
    const f = l.gramos > 0 ? 100/l.gramos : 1, food = { nombre:l.nombre, porcion_g:+l.gramos||100, nova:l.nova??null, fuente:'reciente' };
    MACROS.forEach(([k]) => food[k+'_100'] = l[k]!=null ? +(l[k]*f).toFixed(2) : null);
    return food;
  }
  // Alimentos más usados, sin repetir
  function frequentFoods(logs, n = 12) {
    const map = new Map();
    logs.forEach(l => { if(!l.nombre || !(l.gramos>0)) return; const c = map.get(l.nombre); if(c) c.n++; else map.set(l.nombre, { n:1, l }); });
    return [...map.values()].sort((a,b)=>b.n-a.n).slice(0,n).map(x=>foodFromLog(x.l));
  }
  // Resumen semanal: promedios sobre días con registro
  function nutritionWeek(logs, end = todayISO()) {
    const days = Array.from({length:7}, (_,i) => addDays(end, i-6)).map(fecha => {
      const items = logs.filter(l => l.fecha === fecha);
      return { fecha, n:items.length, ...sumFoods(items) };
    });
    const dd = days.filter(d => d.n);
    const avg = k => dd.length ? Math.round(dd.reduce((a,d)=>a+d[k],0)/dd.length) : null;
    return { days, logged:dd.length, kcal:avg('kcal'), prot:avg('prot'), fibra:avg('fibra') };
  }
  // % de kcal con clasificación NOVA conocida que viene de ultraprocesados
  function upfShare(logs) {
    const known = logs.filter(l => l.nova != null);
    const total = known.reduce((a,l)=>a+(+l.kcal||0),0);
    if (known.length < 3 || !total) return null;
    return Math.round(known.filter(l=>l.nova===4).reduce((a,l)=>a+(+l.kcal||0),0)/total*100);
  }

  // ---- Tipos de serie / esfuerzo / descanso ----
  // [valor, etiqueta, abreviatura]
  const SET_TYPES = [['normal','Normal','N'],['calentamiento','Calentamiento','C'],['drop','Drop set','D'],['fallo','Al fallo','F']];
  function rirFromRpe(rpe){ return (rpe==null||rpe==='') ? null : +(10 - Number(rpe)).toFixed(1); }
  function rpeFromRir(rir){ return (rir==null||rir==='') ? null : +(10 - Number(rir)).toFixed(1); }
  // Descanso sugerido (s): compuestos ~150, aislados ~90
  function restSuggestion(ex){
    if(!ex) return 90;
    const txt = ((ex.grupo||'') + ' ' + (ex.nombre||'')).toLowerCase();
    const compound = ex.unidad==='barra' || /pierna|espalda|pecho|sentadilla|peso muerto|dominad|press|remo|hip thrust/.test(txt);
    return compound ? 150 : 90;
  }

  // ============================================================
  //  INTELIGENCIA (Fase 2): estancamiento, deload, TDEE adaptativo,
  //  adherencia, alertas e informe semanal.
  // ============================================================
  const isoDaysAgo = d => addDays(todayISO(), -d);
  const effSets = sets => sets.filter(s => s.peso_kg > 0 && s.set_type !== 'calentamiento');

  // Mejor e1RM por fecha de un ejercicio -> [[fecha, e1rm], ...]
  function e1rmByDate(sets, ejercicio){
    const by = {};
    effSets(sets).filter(s => s.ejercicio === ejercicio).forEach(s => {
      const e = s.peso_kg * (1 + s.reps/30);
      by[s.fecha] = Math.max(by[s.fecha] || 0, e);
    });
    return Object.entries(by).sort().map(([f,e]) => [f, +e.toFixed(1)]);
  }

  // Ejercicios estancados (sin mejora de e1RM en las últimas ~3 sesiones)
  function stalledExercises(sets, minSessions = 3){
    const names = [...new Set(effSets(sets).map(s => s.ejercicio))];
    const out = [];
    names.forEach(n => {
      const ser = e1rmByDate(sets, n);
      if (ser.length < minSessions) return;
      const recent = ser.slice(-3);
      const change = (recent[recent.length-1][1] - recent[0][1]) / recent[0][1];
      if (change <= 0.005) out.push({ ejercicio:n, changePct:+(change*100).toFixed(1), sessions:ser.length });
    });
    return out;
  }

  // ¿Toca deload? (heurística: ≥50% de ejercicios con historial, estancados)
  function deloadAdvice(sets){
    const tracked = [...new Set(effSets(sets).map(s => s.ejercicio))]
      .map(n => e1rmByDate(sets, n)).filter(s => s.length >= 3).length;
    if (tracked < 2) return null;
    const stalled = stalledExercises(sets);
    const ratio = stalled.length / tracked;
    if (ratio >= 0.5) return { due:true, stalled:stalled.length, tracked,
      text:`${stalled.length} de ${tracked} ejercicios estancados. Considera una semana de descarga: −40-50% de volumen manteniendo la intensidad, luego retoma.` };
    return { due:false, stalled:stalled.length, tracked };
  }

  // TDEE adaptativo: gasto real inferido de la ingesta y el cambio de peso
  function adaptiveTDEE(weights, foodLogs, days = 14){
    const since = isoDaysAgo(days);
    const byDate = {};
    foodLogs.filter(l => l.fecha >= since).forEach(l => { byDate[l.fecha] = (byDate[l.fecha]||0) + (+l.kcal||0); });
    const loggedDays = Object.keys(byDate);
    if (loggedDays.length < 7) return null;
    const avgIntake = Math.round(Object.values(byDate).reduce((a,b)=>a+b,0) / loggedDays.length);
    const w = weights.filter(x => x.fecha >= since).map(x => ({ t:new Date(x.fecha).getTime()/86400000, y:+x.peso_kg }));
    if (w.length < 4) return null;
    const n=w.length, sx=w.reduce((a,p)=>a+p.t,0), sy=w.reduce((a,p)=>a+p.y,0),
          sxx=w.reduce((a,p)=>a+p.t*p.t,0), sxy=w.reduce((a,p)=>a+p.t*p.y,0);
    const slope = (n*sxy - sx*sy) / (n*sxx - sx*sx); // kg/día
    if (!isFinite(slope)) return null;
    const tdee = Math.round(avgIntake - slope*7700);
    return { tdee, avgIntake, slopeWeek:+(slope*7).toFixed(2), loggedDays:loggedDays.length };
  }

  // Recomendación calórica adaptativa según objetivo
  function adaptiveAdvice(profile, ad){
    if (!ad) return null;
    const obj = profile?.objetivo || 'recomposicion';
    const wanted = { ganar:0.3, perder:-0.5, recomposicion:0.0, fuerza:0.1, mantener:0.0 }[obj] ?? 0;
    const diff = ad.slopeWeek - wanted; // + = subiendo más de lo deseado
    const kcalAdj = Math.round((-diff * 7700/7) / 10) * 10;
    let clase='tag-up', texto;
    if (Math.abs(diff) < 0.12) texto = `Tu ritmo (${ad.slopeWeek>0?'+':''}${ad.slopeWeek} kg/sem) coincide con tu objetivo. Mantén ~${ad.tdee} kcal.`;
    else { clase = 'tag-keep';
      texto = `Gasto real estimado ~${ad.tdee} kcal/día. Para tu objetivo, ${kcalAdj>0?'sube':'baja'} ~${Math.abs(kcalAdj)} kcal/día (de ${ad.avgIntake} a ~${ad.avgIntake+kcalAdj}).`; }
    return { clase, texto, kcalSugerido: ad.avgIntake + kcalAdj };
  }

  // Adherencia y rachas. Hoy puede faltar todavía sin romper la racha.
  function streakOf(set){
    let d = todayISO(), n = 0;
    if (!set.has(d)) d = addDays(d, -1);
    while (set.has(d)){ n++; d = addDays(d, -1); }
    return n;
  }
  function daysSinceTraining(sets){
    if (!sets.length) return null;
    return daysBetween([...new Set(sets.map(s=>s.fecha))].sort().pop(), todayISO());
  }
  function sessionsInLast(sets, days){
    const since = isoDaysAgo(days);
    return new Set(sets.filter(s => s.fecha >= since).map(s => s.fecha)).size;
  }
  function loggingStreak(foodLogs){
    return streakOf(new Set(foodLogs.map(l => l.fecha)));
  }

  // Motor de avisos. Se recalcula en cada render y al volver a la app.
  // Cada aviso solo mira datos frescos, y su id cambia con el estado: lo descartado
  // reaparece únicamente si la situación cambia. `tab` lleva a donde se resuelve.
  function buildAlerts({ sets, weights, foodLogs, cardio = [], profile, lastWeight, medidas, sleep = [], wellness = [], injuries = [], salud = null, now = new Date() }){
    const out = [];
    const add = (id, level, icon, text, tab) => out.push({ id, level, icon, text, tab });
    const today = todayISO(), hora = now.getHours();
    const trainedToday = sets.some(s=>s.fecha===today) || cardio.some(c=>c.fecha===today);

    const sueno = saludValue(salud, 'sueno', today) ?? sleep.find(s=>s.fecha===today)?.horas;
    const rd = readiness({ horas:sueno, calidad:sleep.find(s=>s.fecha===today)?.calidad }, wellness.find(w=>w.fecha===today));
    if (rd != null && rd < 50 && !trainedToday) add(`rd-${today}`,'warn','🔋',`Recuperación baja (${rd}/100). Hoy conviene bajar volumen o hacer movilidad.`,'salud');

    // Mediciones de Mi Salud
    const pa = saludLatest(salud, 'presion');
    if (pa && pa.fecha >= isoDaysAgo(14) && (pa.sistolica>=135 || pa.diastolica>=85))
      add(`pa-${pa.fecha}`,'warn','🩺',`Última presión ${pa.sistolica}/${pa.diastolica}: sobre el corte domiciliario 135/85. Repítela en reposo y revísala en Mi Salud.`,'salud');
    const prox = nextHealthEvent(salud);
    if (prox && daysBetween(today, prox.fecha) <= 7) add(`ctl-${prox.fecha}`,'info','📅',`${prox.texto}: ${prox.fecha===today?'hoy':`en ${daysBetween(today,prox.fecha)} días`}${prox.sugerido?' (sugerido, sin agendar)':''}.`,'salud');

    const act = injuries.filter(i=>i.estado==='activa');
    if (act.length) add(`inj-${act.map(i=>i.id).join()}`,'info','🩹',`Lesión activa: ${act.map(i=>i.zona).join(', ')}. Registra el dolor y evita lo que moleste.`,'salud');

    // Entrenamiento
    const all = [...sets.map(s=>s.fecha), ...cardio.map(c=>c.fecha)].sort();
    const since = all.length ? daysBetween(all[all.length-1], today) : null;
    if (since != null && since >= 4) add(`idle-${all[all.length-1]}-${Math.floor(since/7)}`,'warn','⏰',`Llevas ${since} días sin entrenar. Una sesión corta ya cuenta.`,'entreno');
    if (since != null && since < 14){
      const dl = deloadAdvice(sets);
      if (dl?.due) add(`dl-${dl.stalled}-${dl.tracked}`,'warn','🔄',dl.text,'entreno');
    }
    const recent = isoDaysAgo(7), prs = newPRs(sets.filter(s=>s.fecha<recent), sets.filter(s=>s.fecha>=recent));
    if (prs.length) add(`pr-${prs.map(p=>p.ejercicio+p.e1rm).join()}`,'good','🏆',`¡${prs.length} récord${prs.length>1?'s':''} esta semana! Último: ${prs[prs.length-1].ejercicio}.`,'entreno');

    // Nutrición: promedio de 7 días y lo que falta hoy
    const t = effectiveTargets(profile, lastWeight, medidas);
    if (t.prot){
      const byDate = {};
      foodLogs.filter(l=>l.fecha>=recent && l.fecha<today).forEach(l=>{ byDate[l.fecha]=(byDate[l.fecha]||0)+(+l.prot||0); });
      const ds = Object.values(byDate);
      if (ds.length >= 3){
        const avg = Math.round(ds.reduce((a,b)=>a+b,0)/ds.length);
        if (avg < t.prot*0.8) add(`prot-${today}`,'warn','🥩',`Proteína baja: promedias ${avg} g/día de ${t.prot} g.`,'nutricion');
      }
      const hoy = sumFoods(foodLogs.filter(l=>l.fecha===today));
      if (hora >= 18 && hoy.kcal > 0 && hoy.prot < t.prot*0.7) add(`protday-${today}`,'info','🍗',`Te faltan ${Math.round(t.prot-hoy.prot)} g de proteína para hoy.`,'nutricion');
      if (hora >= 14 && !foodLogs.some(l=>l.fecha===today)) add(`nofood-${today}`,'info','🍽️','Hoy aún no registras comidas. ¿Agregas lo que llevas?','nutricion');
    }
    if (salud?.ok && hora >= 17){
      const meta = salud.metas?.agua || 2000, agua = saludValue(salud,'agua',today) || 0;
      if (agua < meta*0.6) add(`agua-${today}`,'info','💧',`Llevas ${agua} ml de agua de ${meta} ml.`,'nutricion');
    }

    // Peso: solo si hay datos recientes; si no, pide medir en vez de repetir un consejo viejo
    const lastW = weights[weights.length-1];
    if (lastW){
      const age = daysBetween(lastW.fecha, today);
      if (age >= 7) add(`w-old-${lastW.fecha}`,'info','⚖️',`Tu último peso es de hace ${age} días. Pésate en ayunas para actualizar la tendencia.`,'cuerpo');
      else { const adv = bodyAdvice(profile, weights, medidas); if (adv?.clase === 'tag-down') add(`w-${lastW.fecha}`,'warn','⚖️',adv.texto,'cuerpo'); }
    }
    if (t.manual && t.calc && Math.abs(profile.kcal_objetivo - t.calc.kcal) > t.calc.kcal*0.12)
      add(`kcal-${profile.kcal_objetivo}-${t.calc.kcal}`,'info','🎯',`Tu objetivo manual (${profile.kcal_objetivo} kcal) se aleja del calculado para tu peso actual (${t.calc.kcal}). Revísalo en Nutrición.`,'nutricion');
    return out;
  }

  // ---- Datos de Mi Salud ----
  // Valor del día: agua suma los vasos; el resto usa el último registro, con el manual sobre el del smartband.
  function saludValue(salud, tipo, fecha){
    const rows = (salud?.med||[]).filter(m=>m.tipo===tipo && m.fecha===fecha);
    if (!rows.length) return null;
    if (tipo==='agua') return rows.reduce((a,r)=>a+Number(r.valor||0),0);
    const m = rows.filter(r=>r.origen!=='wearable');
    return Number((m.length?m:rows).slice(-1)[0].valor);
  }
  function saludLatest(salud, tipo){
    return (salud?.med||[]).filter(m=>m.tipo===tipo).sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0).pop() || null;
  }
  // Próxima cita real o control sugerido sin agendar
  function nextHealthEvent(salud){
    const hoy = todayISO(), citas = salud?.citas||[], tomados = new Set(citas.map(c=>c.control_id).filter(Boolean));
    const a = citas.filter(c=>c.fecha>=hoy).map(c=>({ fecha:c.fecha, texto:c.titulo, hora:c.hora?String(c.hora).slice(0,5):'' }));
    const b = (salud?.controles||[]).filter(c=>c.fecha && c.fecha.length===10 && c.fecha>=hoy && !tomados.has(c.id))
      .map(c=>({ fecha:c.fecha, texto:c.texto, hora:'', sugerido:true }));
    return [...a,...b].sort((x,y)=>x.fecha<y.fecha?-1:1)[0] || null;
  }
  // Peso: Mi Salud es la fuente; body_weight queda como historial anterior.
  function mergeWeights(legacy, med){
    const map = new Map();
    legacy.forEach(w => map.set(w.fecha, { ...w, origen:'historial' }));
    const rows = med.filter(m=>m.tipo==='peso').sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
    rows.forEach(m => {
      const cur = map.get(m.fecha);
      if (cur?.origen==='salud' && cur.condicion==='ayunas' && m.condicion!=='ayunas') return;
      map.set(m.fecha, { id:m.id, fecha:m.fecha, peso_kg:Number(m.valor), observaciones:m.nota, condicion:m.condicion, origen:'salud' });
    });
    return [...map.values()].sort((a,b)=>a.fecha<b.fecha?-1:1);
  }
  function mergeMeasures(legacy, med){
    return [...legacy.filter(m=>m.medida!=='cintura' || !med.some(x=>x.tipo==='cintura'&&x.fecha===m.fecha)),
      ...med.filter(m=>m.tipo==='cintura').map(m=>({ id:m.id, fecha:m.fecha, medida:'cintura', valor_cm:Number(m.valor), origen:'salud' }))]
      .sort((a,b)=>a.fecha<b.fecha?-1:1);
  }

  // ---- Sesiones y volumen ----
  // Sesiones agrupadas por fecha+rutina, de la más nueva a la más vieja
  function sessionsList(sets){
    const map = new Map();
    sets.forEach(s => { const k = s.fecha+'|'+(s.rutina||''); if(!map.has(k)) map.set(k,{ key:k, fecha:s.fecha, rutina:s.rutina, sets:[] }); map.get(k).sets.push(s); });
    return [...map.values()].map(x => ({ ...x, ejercicios:[...new Set(x.sets.map(s=>s.ejercicio))],
      vol:Math.round(x.sets.filter(s=>s.set_type!=='calentamiento').reduce((a,s)=>a+(s.peso_kg||0)*s.reps,0)) }))
      .sort((a,b)=>a.fecha<b.fecha?1:-1);
  }
  const GROUP_ALIAS = { gluteo:'piernas', brazo:'brazos', biceps:'brazos', triceps:'brazos' };
  const MUSCLES = [['pecho','Pecho'],['espalda','Espalda'],['piernas','Piernas'],['hombro','Hombros'],['brazos','Brazos'],['core','Core']];
  function groupOf(nombre, exercises = []){
    const e = exercises.find(x=>x.nombre===nombre)?.grupo
      || (typeof EXERCISE_LIBRARY!=='undefined' ? EXERCISE_LIBRARY.find(x=>x.nombre===nombre)?.grupo : null);
    const g = (e||'otro').toLowerCase();
    return GROUP_ALIAS[g] || g;
  }
  // Series efectivas, días y último entrenamiento por grupo (ACSM 2026: ≥10 series y ≥2 días/sem)
  function muscleWeek(sets, exercises){
    const since = isoDaysAgo(6), hoy = todayISO();
    return MUSCLES.map(([k,label]) => {
      const rows = sets.filter(s=>s.set_type!=='calentamiento' && groupOf(s.ejercicio,exercises)===k);
      const week = rows.filter(s=>s.fecha>=since);
      const last = rows.map(s=>s.fecha).sort().pop() || null;
      return { key:k, label, series:week.length, dias:new Set(week.map(s=>s.fecha)).size, reposo:last?daysBetween(last,hoy):null };
    });
  }
  // Discos por lado para llegar a un peso de barra
  function plates(total, barra = 20, disponibles = [25,20,15,10,5,2.5,1.25]){
    let lado = (total-barra)/2; const out = [];
    if (lado < 0) return { out, resto:0 };
    disponibles.forEach(p => { while (lado >= p-1e-9){ out.push(p); lado -= p; } });
    return { out, resto:+(lado*2).toFixed(2) };
  }
  // Series de aproximación antes de la carga de trabajo
  function warmups(peso, redondeo = 2.5){
    if (!(peso > 20)) return [];
    return [[.4,8],[.6,5],[.8,3]].map(([f,reps]) => ({ peso:Math.max(20, Math.round(peso*f/redondeo)*redondeo), reps }));
  }
  // Tendencia suavizada (promedio móvil exponencial)
  function weightTrendSeries(weights, alpha = 0.25){
    let v = null, prev = null;
    return weights.filter(w=>w.condicion!=='otro').map(w => {
      // Tras una pausa larga la tendencia parte de nuevo: un peso antiguo no debe arrastrarla
      v = v==null || daysBetween(prev, w.fecha) > 21 ? +w.peso_kg : v + alpha*(+w.peso_kg-v);
      prev = w.fecha;
      return { fecha:w.fecha, v:+v.toFixed(2) };
    });
  }

  // Informe semanal
  function weeklyReport({ sets, weights, foodLogs, exercises, profile, lastWeight }){
    const since = isoDaysAgo(7);
    // Series efectivas = todas menos calentamiento (incluye peso corporal/tiempo).
    const week = sets.filter(s => s.fecha >= since && s.set_type !== 'calentamiento');
    const sessions = new Set(week.map(s=>s.fecha)).size;
    const volume = Math.round(week.reduce((a,s)=>a + (s.peso_kg||0)*s.reps, 0));
    const setsCount = week.length;
    const perMuscle = {};
    week.forEach(s => { const g = groupOf(s.ejercicio, exercises); perMuscle[g] = (perMuscle[g]||0) + 1; });
    const prs = newPRs(sets.filter(s=>s.fecha<since), week);
    // peso
    const wWeek = weights.filter(x => x.fecha >= since);
    const wDelta = wWeek.length >= 2 ? +(Number(wWeek[wWeek.length-1].peso_kg) - Number(wWeek[0].peso_kg)).toFixed(1) : null;
    // nutrición
    const fByDate = {}; const pByDate = {};
    foodLogs.filter(l=>l.fecha>=since).forEach(l=>{ fByDate[l.fecha]=(fByDate[l.fecha]||0)+(+l.kcal||0); pByDate[l.fecha]=(pByDate[l.fecha]||0)+(+l.prot||0); });
    const nDays = Object.keys(fByDate).length;
    const avgKcal = nDays ? Math.round(Object.values(fByDate).reduce((a,b)=>a+b,0)/nDays) : null;
    const avgProt = nDays ? Math.round(Object.values(pByDate).reduce((a,b)=>a+b,0)/nDays) : null;
    return { sessions, volume, setsCount, perMuscle, prs, wDelta, nDays, avgKcal, avgProt };
  }

  // ---- Salud / hábitos / objetivos (Fase 2 batch B) ----
  function habitStreak(habitLogs, habitId){
    return streakOf(new Set(habitLogs.filter(l => l.habit_id === habitId).map(l => l.fecha)));
  }
  // Readiness 0-100 (sueño + ánimo + energía + estrés invertido)
  function readiness(sleepToday, wellnessToday){
    const parts = [];
    if (sleepToday){ if (sleepToday.horas != null) parts.push(Math.min(1, sleepToday.horas/7.5)); if (sleepToday.calidad != null) parts.push(sleepToday.calidad/5); }
    if (wellnessToday){ if (wellnessToday.energia != null) parts.push(wellnessToday.energia/5); if (wellnessToday.animo != null) parts.push(wellnessToday.animo/5); if (wellnessToday.estres != null) parts.push((6 - wellnessToday.estres)/5); }
    if (!parts.length) return null;
    return Math.round(parts.reduce((a,b)=>a+b,0)/parts.length*100);
  }
  function goalCurrentValue(goal, ctx){
    if (goal.tipo === 'peso') return ctx.lastWeight ?? null;
    if (goal.tipo === 'medida'){ const m = latestMeasures(ctx.measurements||[])[goal.referencia]; return m ? m.valor_cm : null; }
    if (goal.tipo === 'fuerza'){ const ser = e1rmByDate(ctx.sets||[], goal.referencia); return ser.length ? ser[ser.length-1][1] : null; }
    return null;
  }
  function goalProgress(goal, current){
    const ini = Number(goal.valor_inicial), obj = Number(goal.valor_objetivo);
    if (current == null || !isFinite(ini) || !isFinite(obj) || ini === obj) return null;
    let pct = (current - ini) / (obj - ini);
    return Math.round(Math.max(0, Math.min(1, pct)) * 100);
  }

  // ---- Cardio / zonas de FC ----
  const maxHR = edad => Evidence.maxHR(edad);
  const hrZones = (edad, reposo) => Evidence.hrZones(edad, reposo);
  function zoneOf(fc, edad, reposo){
    const zs = hrZones(edad, reposo); if (!zs || !fc) return null;
    return (zs.find(z => fc <= z.hi) || zs[zs.length-1]).n;
  }

  // ---- Logros (gamificación, calculados de los datos) ----
  function buildAchievements({ sets = [], foodLogs = [], cardio = [], habitLogs = [] }){
    const sessions = new Set(effSets(sets).map(s => s.fecha)).size;
    const prs = Object.keys(prsByExercise(sets)).length;
    const totalVol = Math.round(effSets(sets).reduce((a,s)=>a + s.peso_kg*s.reps, 0));
    const maxDayVol = Math.max(0, ...Object.values((() => { const m={}; effSets(sets).forEach(s=>{ m[s.fecha]=(m[s.fecha]||0)+s.peso_kg*s.reps; }); return m; })()));
    const nutDays = new Set(foodLogs.map(l=>l.fecha)).size;
    const cardios = cardio.length;
    const def = (icon, titulo, desc, unlocked, prog) => ({ icon, titulo, desc, unlocked, prog });
    return [
      def('🎯','Primer paso','Registra tu primera sesión', sessions>=1, `${Math.min(sessions,1)}/1`),
      def('🔟','Constante','10 sesiones de entrenamiento', sessions>=10, `${Math.min(sessions,10)}/10`),
      def('💯','Centurión','100 sesiones', sessions>=100, `${Math.min(sessions,100)}/100`),
      def('🏆','Rompe récords','Logra tu primer PR', prs>=1, `${Math.min(prs,1)}/1`),
      def('🦾','Máquina de PRs','10 récords personales', prs>=10, `${Math.min(prs,10)}/10`),
      def('🏋️','Una tonelada','1.000 kg de volumen en una sesión', maxDayVol>=1000, `${Math.round(Math.min(maxDayVol,1000))}/1000 kg`),
      def('🗿','Titán','50.000 kg de volumen total', totalVol>=50000, `${Math.round(totalVol/1000)}/50 t`),
      def('🥗','Nutrido','Registra nutrición 7 días', nutDays>=7, `${Math.min(nutDays,7)}/7`),
      def('🏃','Cardio iniciado','Primera sesión de cardio', cardios>=1, `${Math.min(cardios,1)}/1`),
      def('🔥','Maratonista','10 sesiones de cardio', cardios>=10, `${Math.min(cardios,10)}/10`),
    ];
  }

  return { dateISO, todayISO, addDays, daysBetween, isoDaysAgo, FREE, routinesOf, nextDay, lastSessionOf, recommend, prsByExercise, newPRs,
           volumeByDate, weeklyAvg, weeklyTrend, bodyAdvice, recentWeights,
           MEASURE_DEFS, latestMeasures, measureSeries, composition, bestBodyFat, projectWeight,
           MEALS, ACTIVITY, nutritionTargets, effectiveTargets, macrosFor, sumFoods, foodFromLog, frequentFoods, nutritionWeek, upfShare,
           SET_TYPES, rirFromRpe, rpeFromRir, restSuggestion,
           e1rmByDate, stalledExercises, deloadAdvice, adaptiveTDEE, adaptiveAdvice,
           daysSinceTraining, sessionsInLast, loggingStreak, buildAlerts, weeklyReport,
           saludValue, saludLatest, nextHealthEvent, mergeWeights, mergeMeasures,
           sessionsList, MUSCLES, groupOf, muscleWeek, plates, warmups, weightTrendSeries,
           habitStreak, readiness, goalCurrentValue, goalProgress,
           maxHR, hrZones, zoneOf, buildAchievements };
})();
if (typeof module !== 'undefined') module.exports = Logic;
