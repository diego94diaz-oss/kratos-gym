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
    const { error } = await sb.from('workout_sets').insert(arr);
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

  return {
    configured, init, currentUser, signIn, signUp, signOut, onAuth, uid,
    getProfile, saveProfile,
    getExercises, addExercise, updateExercise, deleteExercise, bulkInsertExercises,
    addSets, getSets, getAllSets, deleteSetsByDate,
    addWeight, getWeights, deleteWeight,
    addMeasurement, getMeasurements, deleteMeasurement,
    searchFoods, searchFoodByBarcode, addFoodLog, getFoodLogs, deleteFoodLog,
    uploadPhoto, getPhotos, deletePhoto,
  };
})();
