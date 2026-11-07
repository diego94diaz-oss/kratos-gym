# memory.md — Memoria operativa de Entrenamiento (Kratos Gym)

> Estado, decisiones y pendientes de esta app. Las reglas están en [CLAUDE.md](CLAUDE.md); lo que cruza proyectos, en `../memory.md`.
> ⚠️ **Repo público:** aquí no van secretos, datos de salud ni datos personales. Lo clínico vive en `../Salud/`.

**Última actualización:** 2026-10-31

---

## 📍 Estado actual

- **2026-10-31 — Renovación integral publicada** en `main` (GitHub Pages publica desde `main`, comprobado en los despliegues del repo). Probada con datos ficticios (21 pruebas de cálculo y recorrido en Chrome a 360 y 412 px) y con las consultas validadas contra Supabase; falta probarla con la cuenta real.
- Incluye: sesiones libres y de rutina con cambio de ejercicios en vivo, rutinas ilimitadas y plantillas, otras actividades, borrador que sobrevive al cierre, discos y calentamiento, edición de sesiones, diario por comida con base chilena offline, escáner, registro por texto con IA, calidad de dieta, indicadores con evidencia y conexión con Mi Salud.
- Causas de los avisos que no cambiaban: datos cargados una sola vez, reglas sobre registros viejos, peso actual solo en Mi Salud y fecha en UTC. Resuelto: se recarga al volver a la app y cada 5 minutos.

## 🏛️ Decisiones locales

- **2026-10-01 — Renombre solo visible:** se cambió lo que ve el usuario y se conservaron URL e identificadores internos para no romper instalaciones, datos ni sesiones.
- **Búsqueda de alimentos por Edge Function:** `search-foods` hace de proxy hacia Open Food Facts porque la llamada directa se bloqueaba en la red. Exige sesión válida.
- **Service worker network-first:** con `cache: 'no-store'`, para que las actualizaciones lleguen enseguida; la caché queda como respaldo sin conexión.
- **IA con Gemini en capa gratuita:** sin costo ni tarjeta.

## ⏳ Pendientes y dudas abiertas

- **Por revisar en uso real:** el perfil puede traer objetivos manuales antiguos; la app avisa si se alejan del cálculo.
- **Agente Kratos sin ubicar en este PC:** la documentación apunta a `C:\Users\diego\.openclaw\workspace\kratos\` y `gymdb.mjs`, y esa carpeta no existe aquí (comprobado 2026-10-31). Falta saber si sigue activo.
- **Comprobado 2026-10-31:** migración fase 4 aplicada (columnas y RLS verificadas), `search-foods` y `send-reminders` desplegadas, cron `kratos-reminders` activo cada 30 minutos y secrets VAPID presentes. Falta recibir un recordatorio real en el teléfono.
- **Ecosistema:** `docs/ROADMAP-PLATAFORMA-INTEGRAL.md` propone sueño, PA, medicación e hidratación, que se solapan con Mi Salud. Antes de ampliar esos módulos, definir la fuente de verdad (`../CLAUDE.md` §7).
- **Fotos de progreso comprimidas (2026-11-04):** las 36 fotos ocupaban 202 MB (4–8 MB c/u, resolución completa de cámara) de 1 GB de Storage gratis. Se respaldaron los originales en `C:\Users\PC\Pictures\Progreso Entrenamiento (originales)` y se reemplazaron en el bucket `progress-photos` (misma ruta) por versiones de máx. 1600 px, JPEG 82 y **sin EXIF/GPS** → 6,7 MB. `DB.uploadPhoto` ahora comprime en el dispositivo con `comprimirFoto()` (canvas, máx. 1600 px, calidad 0.82; si falla sube el original). SW `kratos-gym-fotos-20261104`.

- **2026-11-07 — `send-reminders` protegida:** solo responde al cron (encabezado `x-cron-secret`, secret compartido
  `ECOSISTEMA_CRON_SECRET`). Redesplegada y cron `kratos-reminders` reprogramado con la clave. Ver CLAUDE.md regla 7.
