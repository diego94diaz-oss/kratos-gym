// ============================================================
//  CONFIG — Credenciales de Supabase
//  Supabase > Project Settings > API
//  (La publishable/anon key es pública por diseño; tus datos
//   están protegidos por Row Level Security, ver schema.sql)
// ============================================================
window.KRATOS_CONFIG = {
  SUPABASE_URL: "https://ivzzgeoeygggaoazcoeq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_G2liTTYj_Ik4LCmh0b2rNw_mPukyFlD",
  // Clave pública VAPID para Web Push (la privada vive como secret de la Edge Function).
  VAPID_PUBLIC: "BCouYv9fXSw2XuZBW3SVPDNDm-uJ6axrzPO-ddtY6kK_6y81vz-KIz2c37afyc11GFPohSaTA00l4T7Yk8O5neI"
};
