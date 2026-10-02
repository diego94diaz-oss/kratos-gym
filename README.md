# ⚔️ Kratos Gym

App personal de entrenamiento de Diego. Registra rutinas, series, reps, peso y RIR; calcula **progresión de carga** (cuándo subir/mantener/bajar), detecta **PRs**, grafica avances y monitorea el **peso corporal** según tu objetivo (recomposición). Compatible con el modelo de datos del coach **Kratos**.

- 📱 PWA instalable · 🌙☀️ modo claro/oscuro · ☁️ datos en la nube (acceso desde cualquier dispositivo)
- 🔒 Cada usuario ve solo sus datos (Row Level Security en Supabase)
- 🔁 Export/Import CSV en el esquema exacto de Kratos (`entrenamientos.csv`, `peso_corporal.csv`)

## Stack
HTML/CSS/JS vanilla (sin build) · Chart.js · Supabase (auth + Postgres) · GitHub Pages.

## Puesta en marcha

### 1. Crear proyecto Supabase (gratis)
1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. En **SQL Editor → New query**, pega y ejecuta todo `schema.sql`.
3. En **Project Settings → API**, copia **Project URL** y **anon public key**.

### 2. Configurar la app
Edita `js/config.js`:
```js
window.KRATOS_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGci..."
};
```

### 3. Desplegar
GitHub Pages: **Settings → Pages → Branch: `main` / root**. La app queda en `https://<usuario>.github.io/kratos-gym/`.

### 4. Primer uso
Abre la URL → **Crear cuenta** (tu email) → la app precarga tu rutina A/B y perfil. ¡A entrenar!

## Estructura de datos (= Kratos)
- `workout_sets` → `fecha,rutina,ejercicio,serie,reps,peso_kg,rir,observaciones`
- `body_weight` → `fecha,peso_kg,observaciones`
- `measurements` → `fecha,medida,valor_cm`

## Progresión (doble progresión)
Si completas **todas** las series en el tope del rango de reps con RIR adecuado → sube carga (+incremento del ejercicio). Si no llegas al mínimo → mantén/baja. PRs por 1RM estimado (Epley).


### 2026-10-01 — Nombres y logos del ecosistema
Identidad actual: Mis Apps, Finanzas, Inversiones, Entrenamiento y Salud. Se integraron los PNG proporcionados por el usuario en encabezados/login, favicons, iconos PWA y accesos de Windows. Original conservado como `brand-source.png` junto a los iconos. Se conservan URLs e identificadores internos para mantener instalaciones, datos y sesiones. Caché del shell renovada.
