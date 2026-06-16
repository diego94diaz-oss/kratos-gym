// ============================================================
//  Edge Function: kratos-ai
//  Chat con Claude usando el contexto de datos del usuario.
//  Secrets: ANTHROPIC_API_KEY (req), CLAUDE_MODEL (opc), SUPABASE_URL/ANON (auto)
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MODEL = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-4-6';
const KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SYSTEM = `Eres Kratos, coach personal de fuerza, hipertrofia y nutrición basada en evidencia de Diego.
Eres directo, motivador y cuantitativo. Respondes en español, conciso y accionable.
Usas el contexto de datos del usuario (entrenamiento, peso, nutrición, salud) para dar recomendaciones concretas.
No inventes datos que no estén en el contexto; si faltan, dilo y sugiere registrarlos.
No das diagnósticos médicos; ante señales de alarma, recomienda consultar a un profesional.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!KEY) return json({ error: 'Falta ANTHROPIC_API_KEY' }, 500);

    // Verifica que sea un usuario autenticado de Supabase
    const auth = req.headers.get('Authorization') || '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: 'No autorizado' }, 401);

    const { messages = [], context = '' } = await req.json();
    const sys = SYSTEM + (context ? `\n\n## Contexto del usuario\n${context}` : '');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1024, system: sys,
        messages: messages.slice(-12).map((m: any) => ({ role: m.role, content: String(m.content || '') })),
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || 'Error del modelo' }, 502);
    const reply = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
    return json({ reply });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}
