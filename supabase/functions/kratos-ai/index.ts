// ============================================================
//  Edge Function: kratos-ai
//  Chat con Gemini usando el contexto de datos del usuario.
//  Secrets: GEMINI_API_KEY (req), GEMINI_MODEL (opc), SUPABASE_URL/ANON (auto)
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
const KEY = Deno.env.get('GEMINI_API_KEY');

const SYSTEM = `Eres Kratos, coach personal de fuerza, hipertrofia y nutrición basada en evidencia de Diego.
Eres directo, motivador y cuantitativo. Respondes en español, conciso y accionable.
Usas el contexto de datos del usuario (entrenamiento, peso, nutrición, salud) para dar recomendaciones concretas.
No inventes datos que no estén en el contexto; si faltan, dilo y sugiere registrarlos.
No das diagnósticos médicos; ante señales de alarma, recomienda consultar a un profesional.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!KEY) return json({ error: 'Falta GEMINI_API_KEY' }, 500);

    // Verifica que sea un usuario autenticado de Supabase
    const auth = req.headers.get('Authorization') || '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: 'No autorizado' }, 401);

    const { messages = [], context = '' } = await req.json();
    const sys = SYSTEM + (context ? `\n\n## Contexto del usuario\n${context}` : '');

    const contents = messages.slice(-12).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || 'Error del modelo' }, 502);
    const reply = (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).filter(Boolean).join('\n').trim();
    return json({ reply: reply || '(sin respuesta)' });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}
