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

  return { todayISO, nextDay, lastSessionOf, recommend, prsByExercise, newPRs,
           volumeByDate, weeklyAvg, weeklyTrend, bodyAdvice };
})();
