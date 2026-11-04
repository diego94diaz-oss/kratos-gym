// ============================================================
//  DB — Cliente Supabase + capa de acceso a datos
// ============================================================
const DB = (() => {
  let sb = null;
  let user = null;

  function configured() {
    const c = window.KRATOS_CONFIG || {};
    return c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
           !c.SUPABASE_URL.includes("TU_SUPABASE");
  }

  function init() {
    if (!configured()) return false;
    sb = window.supabase.createClient(
      window.KRATOS_CONFIG.SUPABASE_URL,
      window.KRATOS_CONFIG.SUPABASE_ANON_KEY
    );
    return true;
  }

  // Una consulta fallida lanza error: así un corte de red no se confunde con «sin datos»
  const rows = ({ data, error }) => { if (error) throw error; return data || []; };

  // ---- Auth ----
  async function currentUser() {
    const { data } = await sb.auth.getUser();
    user = data?.user || null;
    // Offline: getUser falla sin red; cae a la sesión local persistida.
    if (!user) { const s = await sb.auth.getSession(); user = s.data?.session?.user || null; }
    return user;
  }
  async function signIn(email, pass) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error; user = data.user; return user;
  }
  async function signUp(email, pass) {
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) throw error; user = data.user; return user;
  }
  async function signOut() { await sb.auth.signOut(); user = null; }
  function onAuth(cb) { sb.auth.onAuthStateChange((_e, s) => cb(s?.user || null)); }
  function uid() { return user?.id; }

  // ---- Profile ----
  async function getProfile() {
    const { data, error } = await sb.from('profile').select('*').eq('user_id', uid()).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function saveProfile(p) {
    p.user_id = uid(); p.updated_at = new Date().toISOString();
    const { error } = await sb.from('profile').upsert(p);
    if (error) throw error;
  }

  // ---- Exercises ----
  async function getExercises() {
    return rows(await sb.from('exercises').select('*')
      .eq('user_id', uid()).order('dia').order('orden'));
  }
  async function addExercise(e) {
    e.user_id = uid();
    const { data, error } = await sb.from('exercises').insert(e).select().single();
    if (error) throw error; return data;
  }
  async function updateExercise(id, patch) {
    const { error } = await sb.from('exercises').update(patch).eq('id', id).eq('user_id', uid());
    if (error) throw error;
  }
  async function deleteExercise(id) {
    await sb.from('exercises').delete().eq('id', id).eq('user_id', uid());
  }
  async function bulkInsertExercises(arr) {
    arr.forEach(e => e.user_id = uid());
    const { error } = await sb.from('exercises').insert(arr);
    if (error) throw error;
  }

  // ---- Workout sets ----
  async function addSets(arr) {
    arr.forEach(s => s.user_id = uid());
    let { error } = await sb.from('workout_sets').insert(arr);
    // Si la migración de entrenamiento aún no se corrió, reintenta sin los campos nuevos.
    if (error && /rpe|set_type|rest_s|tempo|column|schema cache/i.test(error.message || '')) {
      const clean = arr.map(({ rpe, set_type, rest_s, tempo, ...r }) => r);
      ({ error } = await sb.from('workout_sets').insert(clean));
    }
    if (error) throw error;
  }
  async function getSets({ from, ejercicio } = {}) {
    let q = sb.from('workout_sets').select('*').eq('user_id', uid());
    if (from) q = q.gte('fecha', from);
    if (ejercicio) q = q.eq('ejercicio', ejercicio);
    const { data } = await q.order('fecha', { ascending: false }).order('created_at');
    return data || [];
  }
  async function getAllSets() {
    return rows(await sb.from('workout_sets').select('*')
      .eq('user_id', uid()).order('fecha'));
  }
  async function deleteSetsByIds(ids) {
    if (!ids.length) return;
    const { error } = await sb.from('workout_sets').delete().eq('user_id', uid()).in('id', ids);
    if (error) throw error;
  }

  // ---- Sesiones (notas, duración, esfuerzo). Opcional: requiere db/fase4-renovacion.sql ----
  async function saveWorkoutSession(s) {
    s.user_id = uid();
    const { error } = await sb.from('workout_sessions').upsert(s, { onConflict:'user_id,fecha,rutina' });
    if (error && !isMissing(error)) throw error;
  }
  async function getWorkoutSessions() {
    const { data, error } = await sb.from('workout_sessions').select('*').eq('user_id', uid());
    return error ? [] : data || [];
  }

  // ---- Body weight ----
  async function addWeight(w) {
    w.user_id = uid();
    const { error } = await sb.from('body_weight').upsert(w, { onConflict: 'user_id,fecha' });
    if (error) throw error;
  }
  async function getWeights() {
    return rows(await sb.from('body_weight').select('*')
      .eq('user_id', uid()).order('fecha'));
  }
  async function deleteWeight(id) {
    await sb.from('body_weight').delete().eq('id', id).eq('user_id', uid());
  }

  // ---- Measurements (perímetros corporales) ----
  async function addMeasurement(m) {
    m.user_id = uid();
    const { error } = await sb.from('measurements').insert(m);
    if (error) throw error;
  }
  async function getMeasurements() {
    return rows(await sb.from('measurements').select('*')
      .eq('user_id', uid()).order('fecha'));
  }
  async function deleteMeasurement(id) {
    await sb.from('measurements').delete().eq('id', id).eq('user_id', uid());
  }

  // ---- Nutrición: búsqueda vía Edge Function (proxy a Open Food Facts) ----
  const SEARCH_FN = 'https://ivzzgeoeygggaoazcoeq.supabase.co/functions/v1/search-foods';
  async function authHeaders() {
    const { data } = await sb.auth.getSession();
    return { 'Authorization': `Bearer ${data?.session?.access_token || KRATOS_CONFIG.SUPABASE_ANON_KEY}`, 'apikey': KRATOS_CONFIG.SUPABASE_ANON_KEY };
  }
  async function searchFoods(term) {
    const r = await fetch(`${SEARCH_FN}?q=${encodeURIComponent(term)}`, { headers: await authHeaders() });
    if (!r.ok) throw new Error('search failed');
    return r.json();
  }
  async function searchFoodByBarcode(code) {
    const r = await fetch(`${SEARCH_FN}?barcode=${encodeURIComponent(code)}`, { headers: await authHeaders() });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr[0] || null;
  }

  // ---- Food logs ----
  // Columnas de la fase 4: sin esa migración se guardan solo los macros.
  const stripMicros = ({ fibra, azucar, sat, sodio, nova, ...r }) => r;
  const isMissing = e => /column|schema cache|does not exist|relation/i.test(e?.message || '');
  async function addFoodLog(l) {
    l.user_id = uid();
    let { error } = await sb.from('food_logs').insert(l);
    if (error && isMissing(error)) ({ error } = await sb.from('food_logs').insert(stripMicros(l)));
    if (error) throw error;
  }
  async function updateFoodLog(id, patch) {
    let { error } = await sb.from('food_logs').update(patch).eq('id', id).eq('user_id', uid());
    if (error && isMissing(error)) ({ error } = await sb.from('food_logs').update(stripMicros(patch)).eq('id', id).eq('user_id', uid()));
    if (error) throw error;
  }
  async function getFoodLogs() {
    return rows(await sb.from('food_logs').select('*')
      .eq('user_id', uid()).order('fecha', { ascending:false }).order('created_at'));
  }
  async function deleteFoodLog(id) {
    await sb.from('food_logs').delete().eq('id', id).eq('user_id', uid());
  }

  // ---- Alimentos guardados (favoritos y propios) ----
  async function getFoods() {
    return rows(await sb.from('foods').select('*').eq('user_id', uid()).order('created_at', { ascending:false }));
  }
  async function addFood(f) {
    const { user_id, nombre, marca, barcode, kcal_100, prot_100, grasa_100, carbo_100, fibra_100, porcion_g } = { ...f, user_id:uid() };
    const { error } = await sb.from('foods').insert({ user_id, nombre, marca, barcode, kcal_100, prot_100, grasa_100, carbo_100, fibra_100, porcion_g, fuente:f.fuente === 'off' ? 'off' : 'manual', favorito:true });
    if (error) throw error;
  }
  async function deleteFood(id) { await sb.from('foods').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Mi Salud: fuente de verdad de peso, cintura, sueño, agua y pasos ----
  // Solo se pide lo que sirve para entrenar: nunca diagnósticos, fármacos, exámenes ni escalas.
  const MED_TIPOS = ['peso','cintura','presion','sueno','pasos','agua','fc'];
  async function getSalud() {
    const [med, reg, citas] = await Promise.all([
      sb.from('salud_mediciones').select('id,fecha,tipo,valor,sistolica,diastolica,pulso,nota,condicion,origen,created_at')
        .eq('user_id', uid()).in('tipo', MED_TIPOS).order('fecha'),
      sb.from('salud_registro').select('estatura:data->paciente->estatura_cm,nacimiento:data->paciente->>nacimiento,sexo:data->paciente->>sexo,'
        + 'mPeso:data->mediciones->peso->meta->valor,mCintura:data->mediciones->cintura->meta->valor,mSueno:data->mediciones->sueno->meta->valor,'
        + 'mPasos:data->mediciones->pasos->meta->valor,mAgua:data->mediciones->agua->meta->valor,vaso:data->mediciones->agua->vaso_ml,controles:data->controles')
        .eq('user_id', uid()).maybeSingle(),
      sb.from('salud_citas').select('fecha,hora,titulo,control_id').eq('user_id', uid()),
    ]);
    if (med.error) throw med.error;
    const r = reg.data || {};
    return { ok:true, at:Date.now(), med:med.data || [], citas:citas.data || [], controles:r.controles || [],
      perfil:{ estatura_cm:r.estatura ?? null, nacimiento:r.nacimiento ?? null, sexo:/^f|^m[uj]/i.test(r.sexo||'') ? 'm' : r.sexo ? 'h' : null },
      metas:{ peso:r.mPeso ?? null, cintura:r.mCintura ?? null, sueno:r.mSueno ?? null, pasos:r.mPasos ?? null, agua:r.mAgua ?? null, vaso:r.vaso ?? 250 } };
  }
  async function addMedicion(m) {
    const { data, error } = await sb.from('salud_mediciones')
      .insert({ nota:null, condicion:null, ...m, user_id:uid(), origen:'manual' }).select('id').single();
    if (error) throw error; return data;
  }
  async function updateMedicion(id, patch) {
    const { error } = await sb.from('salud_mediciones').update(patch).eq('id', id).eq('user_id', uid()).eq('origen', 'manual');
    if (error) throw error;
  }
  async function deleteMedicion(id) {
    const { error } = await sb.from('salud_mediciones').delete().eq('id', id).eq('user_id', uid());
    if (error) throw error;
  }

  // ---- Fotos de progreso (Storage privado + metadatos) ----
  const BUCKET = 'progress-photos';
  // Reduce la foto en el propio dispositivo antes de subirla: máx. 1600 px por lado, JPEG 0.82.
  // Una foto de cámara pesa 4–8 MB; así queda en ~200 KB (el plan gratis de Supabase tiene 1 GB).
  // Al redibujar en un canvas se pierden los metadatos EXIF, incluida la ubicación GPS.
  // Si el navegador no puede decodificarla, se sube el archivo original.
  async function comprimirFoto(file, max = 1600, calidad = 0.82) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * k);
      canvas.height = Math.round(bmp.height * k);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close?.();
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', calidad));
      return blob && blob.size < file.size ? blob : file;
    } catch (e) {
      console.warn('No se pudo comprimir la foto; se sube el original.', e);
      return file;
    }
  }
  async function uploadPhoto(file, pose, fecha) {
    const foto = await comprimirFoto(file);
    const ext = foto === file
      ? ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg')
      : 'jpg';
    const path = `${uid()}/${fecha}_${pose}_${Date.now()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, foto, { upsert:false, contentType:foto.type || 'image/jpeg' });
    if (up.error) throw up.error;
    const { error } = await sb.from('progress_photos').insert({ user_id:uid(), fecha, pose, path });
    if (error) throw error;
  }
  async function getPhotos() {
    const { data } = await sb.from('progress_photos').select('*')
      .eq('user_id', uid()).order('fecha');
    const rows = data || [];
    await Promise.all(rows.map(async r => {
      const { data:s } = await sb.storage.from(BUCKET).createSignedUrl(r.path, 3600);
      r.url = s?.signedUrl || null;
    }));
    return rows;
  }
  async function deletePhoto(id, path) {
    await sb.storage.from(BUCKET).remove([path]);
    await sb.from('progress_photos').delete().eq('id', id).eq('user_id', uid());
  }

  // ---- Sueño ----
  async function addSleep(s){ s.user_id=uid(); const { error } = await sb.from('sleep_logs').upsert(s, { onConflict:'user_id,fecha' }); if(error) throw error; }
  async function getSleep(){ return rows(await sb.from('sleep_logs').select('*').eq('user_id', uid()).order('fecha')); }

  // ---- Bienestar (ánimo/estrés/energía) ----
  async function addWellness(w){ w.user_id=uid(); const { error } = await sb.from('wellness_logs').upsert(w, { onConflict:'user_id,fecha' }); if(error) throw error; }
  async function getWellness(){ return rows(await sb.from('wellness_logs').select('*').eq('user_id', uid()).order('fecha')); }

  // ---- Hábitos ----
  async function getHabits(){ return rows(await sb.from('habits').select('*').eq('user_id', uid()).eq('activo', true).order('orden')); }
  async function addHabit(h){ h.user_id=uid(); const { data, error } = await sb.from('habits').insert(h).select().single(); if(error) throw error; return data; }
  async function deleteHabit(id){ await sb.from('habits').update({ activo:false }).eq('id', id).eq('user_id', uid()); }
  async function getHabitLogs(){ return rows(await sb.from('habit_logs').select('*').eq('user_id', uid()).order('fecha')); }
  async function setHabitLog(habit_id, fecha, done){
    if (done){ const { error } = await sb.from('habit_logs').upsert({ user_id:uid(), habit_id, fecha }, { onConflict:'user_id,habit_id,fecha' }); if(error) throw error; }
    else { await sb.from('habit_logs').delete().eq('user_id', uid()).eq('habit_id', habit_id).eq('fecha', fecha); }
  }

  // ---- Lesiones ----
  async function getInjuries(){ return rows(await sb.from('injuries').select('*').eq('user_id', uid()).order('created_at', { ascending:false })); }
  async function addInjury(i){ i.user_id=uid(); const { error } = await sb.from('injuries').insert(i); if(error) throw error; }
  async function updateInjury(id, patch){ await sb.from('injuries').update(patch).eq('id', id).eq('user_id', uid()); }
  async function deleteInjury(id){ await sb.from('injuries').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Objetivos ----
  async function getGoals(){ return rows(await sb.from('goals').select('*').eq('user_id', uid()).order('created_at', { ascending:false })); }
  async function addGoal(g){ g.user_id=uid(); const { error } = await sb.from('goals').insert(g); if(error) throw error; }
  async function updateGoal(id, patch){ await sb.from('goals').update(patch).eq('id', id).eq('user_id', uid()); }
  async function deleteGoal(id){ await sb.from('goals').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Push ----
  async function savePushSub(sub){
    const k = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert(
      { user_id:uid(), endpoint:k.endpoint, p256dh:k.keys.p256dh, auth:k.keys.auth },
      { onConflict:'user_id,endpoint' });
    if (error) throw error;
  }
  async function deletePushSub(endpoint){ await sb.from('push_subscriptions').delete().eq('user_id', uid()).eq('endpoint', endpoint); }
  async function saveReminders(reminders){ const { error } = await sb.from('profile').update({ reminders }).eq('user_id', uid()); if(error) throw error; }

  // ---- Cardio ----
  async function addCardio(c){ c.user_id=uid(); const { error } = await sb.from('cardio_sessions').insert(c); if(error) throw error; }
  async function getCardio(){ return rows(await sb.from('cardio_sessions').select('*').eq('user_id', uid()).order('fecha', { ascending:false })); }
  async function deleteCardio(id){ await sb.from('cardio_sessions').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Rehab (dolor por lesión) ----
  async function addRehab(r){ r.user_id=uid(); const { error } = await sb.from('rehab_logs').insert(r); if(error) throw error; }
  async function getRehab(){ return rows(await sb.from('rehab_logs').select('*').eq('user_id', uid()).order('fecha')); }

  // ---- Recetas ----
  async function getRecipes(){ return rows(await sb.from('recipes').select('*').eq('user_id', uid()).order('created_at', { ascending:false })); }
  async function addRecipe(r){ r.user_id=uid(); const { error } = await sb.from('recipes').insert(r); if(error) throw error; }
  async function deleteRecipe(id){ await sb.from('recipes').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Suplementos ----
  async function getSupplements(){ return rows(await sb.from('supplements').select('*').eq('user_id', uid()).eq('activo', true).order('created_at')); }
  async function addSupplement(s){ s.user_id=uid(); const { error } = await sb.from('supplements').insert(s); if(error) throw error; }
  async function deleteSupplement(id){ await sb.from('supplements').update({ activo:false }).eq('id', id).eq('user_id', uid()); }
  async function getSupplementLogs(){ return rows(await sb.from('supplement_logs').select('*').eq('user_id', uid()).order('fecha')); }
  async function setSupplementLog(supplement_id, fecha, done){
    if (done){ const { error } = await sb.from('supplement_logs').upsert({ user_id:uid(), supplement_id, fecha }, { onConflict:'user_id,supplement_id,fecha' }); if(error) throw error; }
    else { await sb.from('supplement_logs').delete().eq('user_id', uid()).eq('supplement_id', supplement_id).eq('fecha', fecha); }
  }

  // ---- IA (Edge Function kratos-ai) ----
  async function askAI(messages, context){
    const { data, error } = await sb.functions.invoke('kratos-ai', { body: { messages, context } });
    if (error) throw new Error(error.message || 'No se pudo contactar al coach IA (¿función desplegada?)');
    if (data?.error) throw new Error(data.error);
    return data?.reply || '';
  }

  // ---- Mesociclos ----
  async function getMesocycles(){ return rows(await sb.from('mesocycles').select('*').eq('user_id', uid()).order('created_at', { ascending:false })); }
  async function addMesocycle(m){ m.user_id=uid(); const { error } = await sb.from('mesocycles').insert(m); if(error) throw error; }
  async function updateMesocycle(id, patch){ await sb.from('mesocycles').update(patch).eq('id', id).eq('user_id', uid()); }
  async function deleteMesocycle(id){ await sb.from('mesocycles').delete().eq('id', id).eq('user_id', uid()); }

  return {
    configured, init, currentUser, signIn, signUp, signOut, onAuth, uid,
    getProfile, saveProfile,
    getExercises, addExercise, updateExercise, deleteExercise, bulkInsertExercises,
    addSets, getSets, getAllSets, deleteSetsByIds, saveWorkoutSession, getWorkoutSessions,
    addWeight, getWeights, deleteWeight,
    addMeasurement, getMeasurements, deleteMeasurement,
    searchFoods, searchFoodByBarcode, addFoodLog, updateFoodLog, getFoodLogs, deleteFoodLog,
    getFoods, addFood, deleteFood, getSalud, addMedicion, updateMedicion, deleteMedicion,
    uploadPhoto, getPhotos, deletePhoto,
    addSleep, getSleep, addWellness, getWellness,
    getHabits, addHabit, deleteHabit, getHabitLogs, setHabitLog,
    getInjuries, addInjury, updateInjury, deleteInjury,
    getGoals, addGoal, updateGoal, deleteGoal,
    savePushSub, deletePushSub, saveReminders,
    addCardio, getCardio, deleteCardio,
    addRehab, getRehab,
    getRecipes, addRecipe, deleteRecipe,
    getSupplements, addSupplement, deleteSupplement, getSupplementLogs, setSupplementLog,
    getMesocycles, addMesocycle, updateMesocycle, deleteMesocycle,
    askAI,
  };
})();
