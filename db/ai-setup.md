# IA embebida (Kratos en la app) — despliegue con Gemini (gratis)

El botón **"🤖 Pregúntale a Kratos"** del dashboard usa la Edge Function `kratos-ai`, que llama a **Google Gemini** (capa gratuita, sin costo).

## 1. API key de Gemini
En **https://aistudio.google.com/apikey** → "Create API key". Las nuevas keys empiezan con `AQ.` (formato nuevo de Google; antes eran `AIza…`).

## 2. Secret de la función
```powershell
$env:SUPABASE_ACCESS_TOKEN = "<tu Personal Access Token de Supabase>"
npx --yes supabase@latest secrets set GEMINI_API_KEY=<tu_key_AQ...> --project-ref ivzzgeoeygggaoazcoeq
# opcional: modelo (por defecto gemini-2.5-flash). gemini-flash-latest también sirve.
npx --yes supabase@latest secrets set GEMINI_MODEL=gemini-2.5-flash --project-ref ivzzgeoeygggaoazcoeq
```

## 3. Desplegar
```powershell
npx --yes supabase@latest functions deploy kratos-ai --project-ref ivzzgeoeygggaoazcoeq
```

## 4. Probar
App → dashboard → **🤖 Pregúntale a Kratos** → "¿cómo voy esta semana?". La función arma un resumen de tus datos (perfil, peso, sesiones, nutrición, objetivos, lesiones) y responde con contexto.

## Notas
- Solo tú puedes usarla: la función valida tu sesión de Supabase (`--verify-jwt`, por defecto).
- Si `gemini-2.5-flash` diera rate limit (429), cambia `GEMINI_MODEL` a `gemini-flash-latest`.
- Costo: capa gratuita de Gemini (límites diarios generosos). Sin tarjeta.
