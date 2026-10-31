// ============================================================
//  OFFLINE — Caché de lectura + cola de escritura (sync al reconectar)
//  Permite registrar en el gimnasio sin señal: las escrituras se
//  encolan y se reenvían cuando vuelve la conexión.
// ============================================================
const Offline = (() => {
  const CK = 'kratos-cache', QK = 'kratos-queue';
  const DK = 'kratos-draft';
  const FIELDS = ['exercises','sets','legacyWeights','legacyMeasures','foodLogs','profile','sleep','wellness','habits','habitLogs',
                  'injuries','goals','cardio','rehab','recipes','supplements','supplementLogs','mesocycles','foods','salud'];

  function saveCache(cache){
    try { const o={}; FIELDS.forEach(f=>o[f]=cache[f]); o._ts=Date.now(); localStorage.setItem(CK, JSON.stringify(o)); } catch {}
  }
  function loadCache(){ try { const r=localStorage.getItem(CK); return r?JSON.parse(r):null; } catch { return null; } }

  function getQueue(){ try { return JSON.parse(localStorage.getItem(QK)||'[]'); } catch { return []; } }
  function setQueue(q){ try { localStorage.setItem(QK, JSON.stringify(q)); } catch {} }
  function enqueue(op){ const q=getQueue(); q.push(op); setQueue(q); }
  function pending(){ return getQueue().length; }

  // Reenvía la cola en orden. Se detiene al primer fallo (sigue offline).
  async function flush(DB){
    const q = getQueue(); let done = 0;
    while (q.length){
      const op = q[0];
      try {
        if      (op.kind==='sets')    await DB.addSets(op.payload);
        else if (op.kind==='weight')  await DB.addWeight(op.payload);
        else if (op.kind==='measure') await DB.addMeasurement(op.payload);
        else if (op.kind==='food')    await DB.addFoodLog(op.payload);
        else if (op.kind==='medicion') await DB.addMedicion(op.payload);
        else if (op.kind==='cardio')  await DB.addCardio(op.payload);
        q.shift(); setQueue(q); done++;
      } catch { break; }
    }
    return done;
  }

  // Sesión en curso: sobrevive a cerrar la app o a que el teléfono la saque de memoria
  function saveDraft(d){ try { localStorage.setItem(DK, JSON.stringify(d)); } catch {} }
  function loadDraft(){ try { return JSON.parse(localStorage.getItem(DK)||'null'); } catch { return null; } }
  function clearDraft(){ try { localStorage.removeItem(DK); } catch {} }
  // Al cerrar sesión no deben quedar datos de salud en el dispositivo
  function clearCache(){ try { localStorage.removeItem(CK); } catch {} }

  // ¿El error parece falta de conexión?
  function isOfflineError(e){
    return !navigator.onLine || /fetch|network|failed to fetch|load failed|networkerror/i.test(e?.message || '');
  }

  return { saveCache, loadCache, clearCache, enqueue, pending, flush, getQueue, isOfflineError, saveDraft, loadDraft, clearDraft };
})();
