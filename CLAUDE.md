# CLAUDE.md — Entrenamiento (Kratos Gym)

> **Idioma:** escribir siempre en español.
> **Al iniciar sesión, leer también [memory.md](memory.md)** (estado y pendientes de esta app).
> Reglas globales y mapa del ecosistema: `../CLAUDE.md` y `../memory.md`.

> ⚠️ **Este repo es público y GitHub Pages sirve sus archivos.** Lo que se escriba aquí, incluidos este archivo y `memory.md`, queda en internet si se sube. No registrar secretos, datos de salud ni datos personales.

## Qué es

PWA personal de entrenamiento, nutrición y recuperación, pensada para el celular. Sesiones de rutina o libres con cambio de ejercicios en vivo, actividades distintas a pesas, diario de comidas, indicadores corporales con evidencia y conexión con Mi Salud. Incluye un coach con IA.

**Nombres:** el usuario ve **Entrenamiento** desde 2026-10-01. Por dentro sigue siendo **Kratos / Kratos Gym** a propósito (repo, URL, `KRATOS_CONFIG`, claves de `localStorage`, función `kratos-ai`). No renombrar esos identificadores: se romperían instalaciones, sesiones y la cola offline.

- **Producción:** https://diego94diaz-oss.github.io/kratos-gym/
- **Repo:** `diego94diaz-oss/kratos-gym`

## Stack

- HTML, CSS y JS vanilla, **sin build ni tests**. No hay `package.json`.
- Supabase (auth, Postgres, Storage, Edge Functions): proyecto **compartido** con el resto del ecosistema.
- Chart.js y supabase-js desde CDN. Web Push con VAPID. Gemini (capa gratuita) para la IA.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Shell, 5 pestañas (Hoy, Entreno, Nutrición, Cuerpo, Salud) y orden de carga de scripts |
| `js/config.js` | URL de Supabase y claves **públicas** (publishable y VAPID pública) |
| `js/db.js` | Único acceso a datos (`DB`): auth, tablas, Storage y Mi Salud |
| `js/offline.js` | Caché, cola de escritura y borrador de la sesión en `localStorage` |
| `js/evidence.js` | Cálculos corporales y nutricionales con su fuente (`Evidence.SOURCES`) |
| `js/logic.js` | Cálculos puros (`Logic`): progresión, PRs, avisos, unión con datos de Salud |
| `js/app.js` | Orquestador (`App`): estado, carga, navegación y acciones que usan las vistas |
| `js/ui.js`, `js/views/*.js` | Componentes compartidos y una vista por pestaña (`Views`) |
| `js/library.js`, `js/foods.js`, `js/seed.js` | Ejercicios y plantillas, alimentos chilenos sin conexión, datos iniciales |
| `js/push.js` | Suscripción a Web Push |
| `tests/logic.test.mjs` | Pruebas de cálculos: `node --test tests/logic.test.mjs` |
| `sw.js` | Service worker |
| `schema.sql` | Esquema base (5 tablas) |
| `db/*.sql` | Migraciones por fase; se ejecutan a mano en el SQL Editor |
| `db/ai-setup.md`, `db/push-setup.md` | Despliegue de IA y notificaciones |
| `supabase/functions/` | `kratos-ai`, `search-foods`, `send-reminders` |
| `docs/ROADMAP-PLATAFORMA-INTEGRAL.md` | Roadmap por fases (documento de ideas, no refleja el estado real) |

## Convenciones

- Módulos globales con IIFE (`const DB = (() => { ... })()`), sin ES modules. Un script nuevo se agrega a `index.html` **y** a `ASSETS` en `sw.js`, respetando el orden.
- Toda lectura o escritura de datos pasa por `js/db.js`; los cálculos van en `js/logic.js`.
- Nombres de dominio en español (`fecha`, `peso_kg`, `ejercicio`), como en el esquema.
- Tablas nuevas: `user_id` con RLS `auth.uid() = user_id`, en una migración nueva e idempotente en `db/`.
- Tema cálido del ecosistema (beige, marfil, Newsreader + DM Sans) con el naranjo del logo; claro y oscuro. Pensado para pulgar: letra base 17 px, controles de 44 px o más y formularios en hojas inferiores (`UI.sheet`), sin `confirm`/`prompt`.
- Las vistas leen `App.cache`/`App.ctx()` y llaman acciones de `App`; no tocan `DB` para escribir, salvo búsquedas.
- Todo cálculo clínico o nutricional va en `js/evidence.js`, con su fuente en `SOURCES`, verificada antes de agregarla.

## Reglas críticas

1. **Service worker:** al cambiar el shell, cambiar `CACHE` en `sw.js`. Hoy es `kratos-gym-renovacion-20261031`. Todo archivo nuevo necesario sin conexión debe ir en `ASSETS`; las librerías de CDN van con versión fija en `index.html` y en `LIBS`.
2. **Offline:** registrar en el gimnasio sin señal es un caso de uso real. La cola cubre `sets`, `weight`, `measure`, `food`, `medicion` y `cardio`; un `kind` nuevo debe agregarse en `Offline.flush`. La sesión en curso vive en `kratos-draft` y se guarda en cada cambio. No cambiar el formato de las colas sin migrar lo pendiente en cada dispositivo.
3. **Supabase compartido:** un cambio de esquema, RLS o auth afecta a varias apps (`../CLAUDE.md` §12, §14 y §15). Nunca migraciones destructivas sin backup.
4. **Contrato con Mi Día:** lee `workout_sets` y `exercises` (`dia`, `activo`, `orden`) y porta `Logic.nextDay()` y el 1RM de Epley. `rutina` y `dia` son texto libre: cualquier nombre de rutina, y `Libre` para sesiones que no mueven la rotación. Antes de cambiar esas columnas o esa lógica, revisar `../Mi Día/DATA-SOURCES.md` (Fuente 3).
5. **Compatibilidad con el coach Kratos:** los CSV `entrenamientos.csv` y `peso_corporal.csv` y el modelo de `workout_sets` y `body_weight` son compartidos con el agente externo (`gymdb.mjs`, fuera de este repo).
6. **Secretos:** `GEMINI_API_KEY`, `SERVICE_ROLE_KEY` y `VAPID_PRIVATE` viven solo como secrets de Supabase. La clave `service_role` nunca va al cliente ni al repo.
7. **Edge Functions:** `kratos-ai` y `search-foods` validan la sesión. `send-reminders` se despliega con `--no-verify-jwt` para el cron de `pg_cron`.

8. **Mi Salud es la fuente de verdad** de peso, cintura, sueño, agua, pasos, FC y presión (`salud_mediciones`). Aquí se leen y se escriben con `origen = 'manual'`, sin tocar nunca las filas `wearable`. `body_weight` y la cintura de `measurements` son historial de solo lectura. Ver ADR-005 en `../memory.md`.
9. **Privacidad de salud:** de `salud_registro` solo se pide estatura, nacimiento, sexo, metas y controles. Nunca diagnósticos, fármacos, exámenes ni escalas. Nada clínico entra en `buildAIContext`, porque va a Gemini.
10. **Fechas:** siempre `Logic.todayISO()`/`dateISO()` (hora local). `toISOString()` adelanta el día desde las 20-21 h en Chile.
11. **Avisos:** salen de `Logic.buildAlerts`, con datos frescos e id que cambia con el estado. No agregar un aviso que dependa de datos sin ventana de tiempo.

## Despliegue y verificación

- **App:** GitHub Pages publica `main` al subirlo; no hay paso de build.
- **Edge Functions:** `npx --yes supabase@latest functions deploy <función> --project-ref ivzzgeoeygggaoazcoeq`.
- **SQL:** ejecutar la migración en el SQL Editor de Supabase. Comprobar RLS en cada tabla nueva.
- **Pruebas:** `node --test tests/logic.test.mjs`. Para la interfaz, probar a 360-412 px con un servidor estático (el SW no funciona con `file://`), revisar la consola y, si se tocó lo offline, registrar sin red y ver que se sincroniza.
