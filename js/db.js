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
    const { data } = await sb.from('profile').select('*').eq('user_id', uid()).maybeSingle();
    return data;
  }
  async function saveProfile(p) {
    p.user_id = uid(); p.updated_at = new Date().toISOString();
    const { error } = await sb.from('profile').upsert(p);
    if (error) throw error;
  }

  // ---- Exercises ----
  async function getExercises() {
    const { data } = await sb.from('exercises').select('*')
      .eq('user_id', uid()).order('dia').order('orden');
    return data || [];
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
    const { data } = await sb.from('workout_sets').select('*')
      .eq('user_id', uid()).order('fecha');
    return data || [];
  }
  async function deleteSetsByDate(fecha) {
    await sb.from('workout_sets').delete().eq('user_id', uid()).eq('fecha', fecha);
  }

  // ---- Body weight ----
  async function addWeight(w) {
    w.user_id = uid();
    const { error } = await sb.from('body_weight').upsert(w, { onConflict: 'user_id,fecha' });
    if (error) throw error;
  }
  async function getWeights() {
    const { data } = await sb.from('body_weight').select('*')
      .eq('user_id', uid()).order('fecha');
    return data || [];
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
    const { data } = await sb.from('measurements').select('*')
      .eq('user_id', uid()).order('fecha');
    return data || [];
  }
  async function deleteMeasurement(id) {
    await sb.from('measurements').delete().eq('id', id).eq('user_id', uid());
  }

  // ---- Nutrición: búsqueda Open Food Facts (red, sin auth) ----
  async function searchFoods(term) {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}`
      + `&search_simple=1&action=process&json=1&page_size=24`
      + `&fields=product_name,brands,code,nutriments,serving_quantity`;
    const r = await fetch(url);
    const j = await r.json();
    return (j.products || []).map(p => ({
      nombre: (p.product_name || '').trim() || '(sin nombre)',
      marca: (p.brands || '').split(',')[0] || '',
      barcode: p.code || '',
      kcal_100: p.nutriments?.['energy-kcal_100g'] ?? null,
      prot_100: p.nutriments?.proteins_100g ?? null,
      grasa_100: p.nutriments?.fat_100g ?? null,
      carbo_100: p.nutriments?.carbohydrates_100g ?? null,
      fibra_100: p.nutriments?.fiber_100g ?? null,
      porcion_g: p.serving_quantity ? Number(p.serving_quantity) : null,
      fuente: 'off',
    })).filter(p => p.kcal_100 != null && p.nombre !== '(sin nombre)');
  }
  async function searchFoodByBarcode(code) {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,code,nutriments,serving_quantity`);
    const j = await r.json();
    if (j.status !== 1 || !j.product) return null;
    const p = j.product;
    return { nombre:(p.product_name||'').trim()||'(sin nombre)', marca:(p.brands||'').split(',')[0]||'',
      barcode:p.code||code, kcal_100:p.nutriments?.['energy-kcal_100g']??null,
      prot_100:p.nutriments?.proteins_100g??null, grasa_100:p.nutriments?.fat_100g??null,
      carbo_100:p.nutriments?.carbohydrates_100g??null, fibra_100:p.nutriments?.fiber_100g??null,
      porcion_g:p.serving_quantity?Number(p.serving_quantity):null, fuente:'off' };
  }

  // ---- Food logs ----
  async function addFoodLog(l) {
    l.user_id = uid();
    const { error } = await sb.from('food_logs').insert(l);
    if (error) throw error;
  }
  async function getFoodLogs() {
    const { data } = await sb.from('food_logs').select('*')
      .eq('user_id', uid()).order('fecha', { ascending:false }).order('created_at');
    return data || [];
  }
  async function deleteFoodLog(id) {
    await sb.from('food_logs').delete().eq('id', id).eq('user_id', uid());
  }

  // ---- Fotos de progreso (Storage privado + metadatos) ----
  const BUCKET = 'progress-photos';
  async function uploadPhoto(file, pose, fecha) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const path = `${uid()}/${fecha}_${pose}_${Date.now()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { upsert:false, contentType:file.type || 'image/jpeg' });
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
  async function getSleep(){ const { data } = await sb.from('sleep_logs').select('*').eq('user_id', uid()).order('fecha'); return data||[]; }

  // ---- Bienestar (ánimo/estrés/energía) ----
  async function addWellness(w){ w.user_id=uid(); const { error } = await sb.from('wellness_logs').upsert(w, { onConflict:'user_id,fecha' }); if(error) throw error; }
  async function getWellness(){ const { data } = await sb.from('wellness_logs').select('*').eq('user_id', uid()).order('fecha'); return data||[]; }

  // ---- Hábitos ----
  async function getHabits(){ const { data } = await sb.from('habits').select('*').eq('user_id', uid()).eq('activo', true).order('orden'); return data||[]; }
  async function addHabit(h){ h.user_id=uid(); const { data, error } = await sb.from('habits').insert(h).select().single(); if(error) throw error; return data; }
  async function deleteHabit(id){ await sb.from('habits').update({ activo:false }).eq('id', id).eq('user_id', uid()); }
  async function getHabitLogs(){ const { data } = await sb.from('habit_logs').select('*').eq('user_id', uid()).order('fecha'); return data||[]; }
  async function setHabitLog(habit_id, fecha, done){
    if (done){ const { error } = await sb.from('habit_logs').upsert({ user_id:uid(), habit_id, fecha }, { onConflict:'user_id,habit_id,fecha' }); if(error) throw error; }
    else { await sb.from('habit_logs').delete().eq('user_id', uid()).eq('habit_id', habit_id).eq('fecha', fecha); }
  }

  // ---- Lesiones ----
  async function getInjuries(){ const { data } = await sb.from('injuries').select('*').eq('user_id', uid()).order('created_at', { ascending:false }); return data||[]; }
  async function addInjury(i){ i.user_id=uid(); const { error } = await sb.from('injuries').insert(i); if(error) throw error; }
  async function updateInjury(id, patch){ await sb.from('injuries').update(patch).eq('id', id).eq('user_id', uid()); }
  async function deleteInjury(id){ await sb.from('injuries').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Objetivos ----
  async function getGoals(){ const { data } = await sb.from('goals').select('*').eq('user_id', uid()).order('created_at', { ascending:false }); return data||[]; }
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
  async function getCardio(){ const { data } = await sb.from('cardio_sessions').select('*').eq('user_id', uid()).order('fecha', { ascending:false }); return data||[]; }
  async function deleteCardio(id){ await sb.from('cardio_sessions').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Rehab (dolor por lesión) ----
  async function addRehab(r){ r.user_id=uid(); const { error } = await sb.from('rehab_logs').insert(r); if(error) throw error; }
  async function getRehab(){ const { data } = await sb.from('rehab_logs').select('*').eq('user_id', uid()).order('fecha'); return data||[]; }

  // ---- Recetas ----
  async function getRecipes(){ const { data } = await sb.from('recipes').select('*').eq('user_id', uid()).order('created_at', { ascending:false }); return data||[]; }
  async function addRecipe(r){ r.user_id=uid(); const { error } = await sb.from('recipes').insert(r); if(error) throw error; }
  async function deleteRecipe(id){ await sb.from('recipes').delete().eq('id', id).eq('user_id', uid()); }

  // ---- Suplementos ----
  async function getSupplements(){ const { data } = await sb.from('supplements').select('*').eq('user_id', uid()).eq('activo', true).order('created_at'); return data||[]; }
  async function addSupplement(s){ s.user_id=uid(); const { error } = await sb.from('supplements').insert(s); if(error) throw error; }
  async function deleteSupplement(id){ await sb.from('supplements').update({ activo:false }).eq('id', id).eq('user_id', uid()); }
  async function getSupplementLogs(){ const { data } = await sb.from('supplement_logs').select('*').eq('user_id', uid()).order('fecha'); return data||[]; }
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
  async function getMesocycles(){ const { data } = await sb.from('mesocycles').select('*').eq('user_id', uid()).order('created_at', { ascending:false }); return data||[]; }
  async function addMesocycle(m){ m.user_id=uid(); const { error } = await sb.from('mesocycles').insert(m); if(error) throw error; }
  async function updateMesocycle(id, patch){ await sb.from('mesocycles').update(patch).eq('id', id).eq('user_id', uid()); }
  async function deleteMesocycle(id){ await sb.from('mesocycles').delete().eq('id', id).eq('user_id', uid()); }

  return {
    configured, init, currentUser, signIn, signUp, signOut, onAuth, uid,
    getProfile, saveProfile,
    getExercises, addExercise, updateExercise, deleteExercise, bulkInsertExercises,
    addSets, getSets, getAllSets, deleteSetsByDate,
    addWeight, getWeights, deleteWeight,
    addMeasurement, getMeasurements, deleteMeasurement,
    searchFoods, searchFoodByBarcode, addFoodLog, getFoodLogs, deleteFoodLog,
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
