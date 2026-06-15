// ============================================================
//  OFFLINE — Caché de lectura + cola de escritura (sync al reconectar)
//  Permite registrar en el gimnasio sin señal: las escrituras se
//  encolan y se reenvían cuando vuelve la conexión.
// ============================================================
const Offline = (() => {
  const CK = 'kratos-cache', QK = 'kratos-queue';
  const FIELDS = ['exercises','sets','weights','measurements','foodLogs','profile'];

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
        q.shift(); setQueue(q); done++;
      } catch { break; }
    }
    return done;
  }

  // ¿El error parece falta de conexión?
  function isOfflineError(e){
    return !navigator.onLine || /fetch|network|failed to fetch|load failed|networkerror/i.test(e?.message || '');
  }

  return { saveCache, loadCache, enqueue, pending, flush, getQueue, isOfflineError };
})();
