// ============================================================
//  LOGIC — Progresión de carga, PRs, análisis de peso corporal
// ============================================================
const Logic = (() => {

  const todayISO = () => new Date().toISOString().slice(0, 10);

  // Día sugerido segun rotación A/B: cuenta sesiones previas y alterna
  function nextDay(allSets) {
    const fechas = [...new Set(allSets.map(s => s.fecha))].sort();
    if (!fechas.length) return 'A';
    const lastFecha = fechas[fechas.length - 1];
    const lastRutina = (allSets.find(s => s.fecha === lastFecha) || {}).rutina;
    return lastRutina === 'A' ? 'B' : 'A';
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
    const work = last.sets.filter(s => s.peso_kg > 0);
    const ref = work.length ? work : last.sets;
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
      if (s.peso_kg <= 0) return;
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
      if (r.peso_kg <= 0) return;
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
    sets.forEach(s => { map[s.fecha] = (map[s.fecha]||0) + s.peso_kg * s.reps; });
    return Object.entries(map).sort().map(([fecha, vol]) => ({ fecha, vol: Math.round(vol) }));
  }

  // ---- Peso corporal ----
  function weeklyAvg(weights) {
    if (!weights.length) return null;
    const last7 = weights.slice(-7);
    return +(last7.reduce((a,w)=>a+Number(w.peso_kg),0)/last7.length).toFixed(2);
  }
  // tendencia kg/semana (regresión simple sobre últimos 21 días)
  function weeklyTrend(weights) {
    const pts = weights.slice(-21).map(w => ({ t: new Date(w.fecha).getTime()/86400000, y: Number(w.peso_kg) }));
    if (pts.length < 4) return null;
    const n = pts.length, sx = pts.reduce((a,p)=>a+p.t,0), sy = pts.reduce((a,p)=>a+p.y,0);
    const sxx = pts.reduce((a,p)=>a+p.t*p.t,0), sxy = pts.reduce((a,p)=>a+p.t*p.y,0);
    const slope = (n*sxy - sx*sy) / (n*sxx - sx*sx);
    return +(slope*7).toFixed(2); // kg/semana
  }

  // Recomendación de peso corporal según objetivo y tendencia
  function bodyAdvice(profile, weights) {
    const avg = weeklyAvg(weights);
    const trend = weeklyTrend(weights);
    if (avg == null) return { clase:'tag-keep', texto:'Registra tu peso 3-4×/semana para empezar la curva.' };
    const obj = profile?.objetivo || 'recomposicion';
    const t = trend ?? 0;
    const fmt = (avg!=null?`Promedio ~${avg} kg.`:'') + (trend!=null?` Tendencia ${t>0?'+':''}${t} kg/sem.`:'');

    if (obj === 'recomposicion') {
      if (t > 0.3) return { clase:'tag-down', texto:`${fmt} Subes algo rápido para recomposición. Baja ~150-200 kcal.` };
      if (t < -0.3) return { clase:'tag-down', texto:`${fmt} Bajas rápido; podrías perder músculo. Sube ~150 kcal.` };
      return { clase:'tag-up', texto:`${fmt} 👌 Peso estable: ideal para recomposición. Mantén calorías y prioriza proteína.` };
    }
    if (obj === 'ganar') {
      if (t < 0.1) return { clase:'tag-keep', texto:`${fmt} Para ganar músculo sube ~200-300 kcal (meta +0.25-0.4 kg/sem).` };
      if (t > 0.5) return { clase:'tag-down', texto:`${fmt} Ganas muy rápido (más grasa). Reduce ~150 kcal.` };
      return { clase:'tag-up', texto:`${fmt} 👌 Ritmo de ganancia correcto. Mantén.` };
    }
    if (obj === 'perder') {
      if (t > -0.2) return { clase:'tag-keep', texto:`${fmt} Para perder grasa baja ~250-400 kcal (meta -0.3-0.6 kg/sem).` };
      if (t < -0.8) return { clase:'tag-down', texto:`${fmt} Bajas muy rápido; riesgo de perder músculo. Sube ~150 kcal.` };
      return { clase:'tag-up', texto:`${fmt} 👌 Buen ritmo de pérdida. Mantén proteína alta.` };
    }
    return { clase:'tag-keep', texto:`${fmt} Mantén tu peso estable.` };
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

  // % graso estimado — fórmula U.S. Navy (cm). sexo: 'h' (def) | 'm'
  // Requiere cuello + cintura + estatura (+ cadera si mujer).
  function bodyFatNavy({ sexo='h', cuello, cintura, cadera, estatura_cm }) {
    if (!estatura_cm || !cuello || !cintura) return null;
    const log10 = x => Math.log(x) / Math.LN10;
    let bf;
    if (sexo === 'm') {
      if (!cadera) return null;
      bf = 495 / (1.29579 - 0.35004*log10(cintura + cadera - cuello) + 0.22100*log10(estatura_cm)) - 450;
    } else {
      if (cintura - cuello <= 0) return null;
      bf = 495 / (1.0324 - 0.19077*log10(cintura - cuello) + 0.15456*log10(estatura_cm)) - 450;
    }
    if (!isFinite(bf) || bf <= 0 || bf > 70) return null;
    return +bf.toFixed(1);
  }
  // Masa grasa / magra a partir de %graso y peso
  function composition(bfPct, pesoKg) {
    if (bfPct == null || !pesoKg) return null;
    const grasa = +(pesoKg * bfPct/100).toFixed(1);
    return { grasa, magra: +(pesoKg - grasa).toFixed(1) };
  }

  // ---- Nutrición ----
  const MEALS = [['desayuno','Desayuno'],['almuerzo','Almuerzo'],['cena','Cena'],['snack','Snack']];
  const ACTIVITY = [
    [1.2,  'Sedentario (sin ejercicio)'],
    [1.375,'Ligero (1-3 días/sem)'],
    [1.45, 'Moderado-bajo (3 días/sem)'],
    [1.55, 'Moderado (3-5 días/sem)'],
    [1.725,'Alto (6-7 días/sem)'],
  ];

  // BMR — Mifflin-St Jeor
  function bmrMifflin({ sexo='h', peso, estatura_cm, edad }) {
    if (!peso || !estatura_cm || !edad) return null;
    const base = 10*peso + 6.25*estatura_cm - 5*edad;
    return Math.round(base + (sexo === 'm' ? -161 : 5));
  }

  // Objetivos calóricos y de macros calculados desde el perfil
  function nutritionTargets(profile, pesoActual) {
    const peso = pesoActual || profile?.peso_objetivo_kg;
    const bmr = bmrMifflin({ sexo: profile?.sexo || 'h', peso,
      estatura_cm: profile?.estatura_cm, edad: profile?.edad });
    if (!bmr || !peso) return null;
    const maint = Math.round(bmr * (profile?.actividad || 1.45));
    const obj = profile?.objetivo || 'recomposicion';
    const factor = { ganar:1.10, perder:0.80, recomposicion:1.02, fuerza:1.05, mantener:1.0 }[obj] ?? 1.0;
    const kcal = Math.round(maint * factor);
    const prot = Math.round(peso * 2.0);          // 2.0 g/kg
    const grasa = Math.round(peso * 0.9);         // 0.9 g/kg
    const carbo = Math.max(0, Math.round((kcal - prot*4 - grasa*9) / 4));
    return { kcal, prot, grasa, carbo, maint, bmr };
  }

  // Objetivos efectivos: manuales del perfil si existen, si no los calculados
  function effectiveTargets(profile, pesoActual) {
    const calc = nutritionTargets(profile, pesoActual);
    return {
      kcal:  profile?.kcal_objetivo || calc?.kcal || null,
      prot:  profile?.proteina_g    || calc?.prot || null,
      grasa: profile?.grasa_g       || calc?.grasa || null,
      carbo: profile?.carbo_g       || calc?.carbo || null,
      calc,
    };
  }

  // Macros de una porción a partir de valores por 100 g
  function macrosFor(food, gramos) {
    const f = gramos / 100;
    return {
      kcal:  food.kcal_100  != null ? +(food.kcal_100  * f).toFixed(0) : null,
      prot:  food.prot_100  != null ? +(food.prot_100  * f).toFixed(1) : null,
      grasa: food.grasa_100 != null ? +(food.grasa_100 * f).toFixed(1) : null,
      carbo: food.carbo_100 != null ? +(food.carbo_100 * f).toFixed(1) : null,
    };
  }

  // Suma de un conjunto de registros alimentarios
  function sumFoods(logs) {
    return logs.reduce((a,l)=>({
      kcal:  a.kcal  + (+l.kcal  || 0),
      prot:  a.prot  + (+l.prot  || 0),
      grasa: a.grasa + (+l.grasa || 0),
      carbo: a.carbo + (+l.carbo || 0),
    }), { kcal:0, prot:0, grasa:0, carbo:0 });
  }

  return { todayISO, nextDay, lastSessionOf, recommend, prsByExercise, newPRs,
           volumeByDate, weeklyAvg, weeklyTrend, bodyAdvice,
           MEASURE_DEFS, latestMeasures, measureSeries, bodyFatNavy, composition,
           MEALS, ACTIVITY, bmrMifflin, nutritionTargets, effectiveTargets, macrosFor, sumFoods };
})();
