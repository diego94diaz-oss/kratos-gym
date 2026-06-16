# IA embebida (Kratos en la app) — despliegue

El botón **"🤖 Pregúntale a Kratos"** del dashboard ya está en la app, pero necesita desplegar la Edge Function `kratos-ai` y una API key de Anthropic.

## 1. API key de Anthropic
Consíguela en https://console.anthropic.com → API Keys. (Tiene costo por uso; el chat usa pocos tokens por mensaje.)

## 2. Secrets de la función
```powershell
supabase secrets set ANTHROPIC_API_KEY=<tu_api_key>
# opcional: elegir modelo (por defecto claude-sonnet-4-6)
supabase secrets set CLAUDE_MODEL=claude-sonnet-4-6
```
(SUPABASE_URL y SUPABASE_ANON_KEY ya están disponibles automáticamente.)

## 3. Desplegar
```powershell
supabase functions deploy kratos-ai
```
(Con verificación de JWT por defecto: la app envía tu sesión, así solo tú puedes usarla.)

## 4. Probar
Abre la app → dashboard → **🤖 Pregúntale a Kratos** → escribe "¿cómo voy esta semana?".
La función recibe un resumen de tus datos (perfil, peso, sesiones, nutrición, objetivos, lesiones) y responde con contexto.

## Notas
- El contexto se arma en el cliente (`buildAIContext`) y se manda con cada mensaje; la función no accede a la BD.
- Si el modelo `claude-sonnet-4-6` no estuviera disponible en tu cuenta, cambia `CLAUDE_MODEL` por el id que tengas habilitado.
- Mientras no despliegues, el botón mostrará un aviso de error (no rompe la app).
