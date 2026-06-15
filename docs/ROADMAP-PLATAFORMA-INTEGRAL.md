# Kratos Gym → Plataforma Integral de Entrenamiento, Nutrición, Salud y Seguimiento

> Análisis exhaustivo y roadmap. Elaborado bajo los lentes de un **entrenador de fuerza**, **nutricionista deportivo**, **médico del deporte**, **fisioterapeuta**, **psicólogo deportivo**, **diseñador UX** y **arquitecto de software**.
> Para cada mejora: **Objetivo · Beneficio · Prioridad (Crítica/Alta/Media/Baja) · Complejidad · Diseño funcional**.

---

## 0. Auditoría del estado actual

**Stack:** PWA HTML/CSS/JS vanilla + Supabase (Postgres+Auth, RLS por `user_id`) + Chart.js. Hosting GitHub Pages. Datos compartidos con el agente Kratos vía `gymdb.mjs`.

**Modelo de datos actual:** `profile`, `exercises` (rutina A/B), `workout_sets` (fecha/rutina/ejercicio/serie/reps/peso/rir/obs), `body_weight`, `measurements`.

**Capacidades reales hoy:**
- Registro de series con reps/peso/RIR y rotación A/B automática.
- Doble progresión (subir/mantener/bajar) por ejercicio, con soporte de unidades barra/mancuerna/peso corporal/tiempo.
- PRs por e1RM (Epley), volumen total por sesión, gráficos de volumen y peso corporal.
- Peso corporal: media de 7 días + tendencia kg/sem por regresión lineal (21 días) + consejo calórico según objetivo.

**Limitaciones estructurales:**
1. `measurements` sin UI; sin fotos de progreso.
2. **Sin módulo de nutrición** (el núcleo que falta para "integral").
3. Sin cardio, resistencia, movilidad ni rehabilitación.
4. Sin salud/recuperación (sueño, HRV, FC, estrés, lesiones, medicación, hábitos).
5. Sin gestión de fatiga/periodización ni deload automático.
6. Sin integraciones con wearables.
7. IA solo por chat externo (Kratos); no embebida en la app.
8. Sin gamificación, sin informes automáticos, sin notificaciones.
9. UX de una sola plantilla A/B; falta biblioteca de ejercicios, plantillas y editor de rutinas potente.

---

# RONDA 1 — Cobertura de los dominios solicitados

## M1 · Gestión completa de rutinas de entrenamiento

### M1.1 Biblioteca de ejercicios con metadatos
- **Objetivo:** catálogo de ejercicios (propios + precargados) con grupo muscular primario/secundario, patrón de movimiento, equipo, unilateral/bilateral, tipo (compuesto/aislado), video/imagen técnica, tags de lesión/contraindicación.
- **Beneficio:** sustituciones inteligentes, cómputo correcto de volumen por músculo, técnica a mano.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** tabla `exercise_library` (global, read-only) + `exercises` referencia `library_id`. Campos: `musculo_primario`, `musculos_secundarios[]`, `patron` (empuje/tracción/sentadilla/bisagra/zancada/core/cardio), `equipo[]`, `mecanica`, `media_url`, `instrucciones`, `contraindicaciones[]`. Buscador con filtros por músculo/equipo. Seed inicial ~150 ejercicios.

### M1.2 Editor de rutinas multi-modal (no solo A/B)
- **Objetivo:** crear/editar splits arbitrarios: Full Body, Upper/Lower, PPL, Arnold, especialización, etc. Días nombrados, orden, supersets, dropsets, rest-pause, AMRAP.
- **Beneficio:** la app deja de estar atada al A/B; escala a cualquier nivel/objetivo.
- **Prioridad:** Alta · **Complejidad:** Media-Alta.
- **Diseño:** tabla `routines` (nombre, tipo, frecuencia, fase) y `routine_days`; `exercises` cuelga de `routine_day_id`. Tipos de set (`set_type`: normal/superset/dropset/restpause/amrap/warmup) en `workout_sets`. UI drag-and-drop para ordenar; agrupación visual de supersets.

### M1.3 Plantillas y mesociclos prediseñados
- **Objetivo:** plantillas basadas en evidencia (hipertrofia 10-20 series/músculo/sem, fuerza 5×5/531, principiante full-body) y mesociclos de 4-6 semanas con progresión integrada.
- **Beneficio:** onboarding instantáneo, estructura científica sin armar todo a mano.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** `routine_templates` JSON versionadas; "aplicar plantilla" clona a las tablas del usuario. Galería con filtro por objetivo/días/nivel/equipo.

### M1.4 Cardio y resistencia
- **Objetivo:** registrar cardio (LISS/HIIT/Zona 2): duración, distancia, FC media/máx, zonas, calorías, RPE; soporte de intervalos.
- **Beneficio:** entrenamiento de resistencia y salud cardiovascular dentro de la misma plataforma.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** tabla `cardio_sessions` (modalidad, duración_s, distancia_km, fc_media, fc_max, zonas_json, kcal, rpe, notas). Cálculo de zonas FC desde FC máx (Tanaka: 208−0.7·edad). Gráfico de minutos por zona/semana.

### M1.5 Movilidad, flexibilidad y calentamiento
- **Objetivo:** rutinas de movilidad/estiramiento guiadas y calentamiento específico por sesión.
- **Beneficio:** reduce riesgo de lesión, mejora ROM, adherencia al warm-up.
- **Prioridad:** Media · **Complejidad:** Baja-Media.
- **Diseño:** `mobility_routines` con bloques temporizados; temporizador in-app con TTS opcional. Sugerencia de calentamiento según ejercicios del día.

### M1.6 Rehabilitación y trabajo correctivo
- **Objetivo:** protocolos de rehab (p. ej. tendinopatías — relevante por el pulgar de Diego), con seguimiento de dolor (escala 0-10) y progresión de carga controlada.
- **Beneficio:** continuidad ante lesiones; previene recaídas con criterio clínico.
- **Prioridad:** Alta (caso de Diego) · **Complejidad:** Media.
- **Diseño:** módulo `rehab_protocols` ligado a `injuries` (M7.7). Registro de dolor pre/post, semáforo de "carga segura" (dolor ≤3/10 permite progresar). Banderas rojas → recomendación de consulta médica.

---

## M2 · Seguimiento de ejercicios y métricas de rendimiento

### M2.1 Set logging enriquecido (RPE + RIR + tipo de set + tempo)
- **Objetivo:** registrar RPE (0-10) y RIR indistintamente, tempo (excéntrica/pausa/concéntrica), tipo de set y descanso entre series.
- **Beneficio:** autorregulación precisa y datos para el motor de progresión.
- **Prioridad:** Alta · **Complejidad:** Baja.
- **Diseño:** añadir a `workout_sets`: `rpe`, `tempo`, `set_type`, `rest_s`. Conversión RPE↔RIR (RIR ≈ 10−RPE). Cronómetro de descanso con notificación.

### M2.2 Volumen por grupo muscular y métricas avanzadas
- **Objetivo:** series duras/semana por músculo, tonelaje, densidad (kg/min), e1RM por ejercicio en el tiempo.
- **Beneficio:** controla el volumen dentro del rango óptimo (MEV–MAV–MRV) por músculo.
- **Prioridad:** Crítica · **Complejidad:** Media.
- **Diseño:** computar series efectivas asignando volumen a `musculo_primario` (1.0) y secundarios (0.5). Dashboard semanal de series/músculo con bandas MEV/MAV/MRV configurables. e1RM con fórmula seleccionable (Epley/Brzycki).

### M2.3 Récords personales multi-dimensión
- **Objetivo:** PRs por 1RM estimado, por rep-range (PR de 5RM, 8RM…), por volumen y por reps a un peso dado. Historial y celebración.
- **Beneficio:** motivación + visión real del progreso más allá del 1RM.
- **Prioridad:** Media · **Complejidad:** Baja-Media.
- **Diseño:** tabla `personal_records` materializada al guardar sesión; toast/confeti al romper PR (ya hay base con `newPRs`). Vista "PR Board".

### M2.4 Historial de sesión y notas contextuales
- **Objetivo:** ver sesión previa de cada ejercicio inline al entrenar, con notas (técnica, dolor, energía) y comparativa.
- **Beneficio:** "beat the logbook"; referencia inmediata para progresar.
- **Prioridad:** Alta · **Complejidad:** Baja.
- **Diseño:** ya existe `lastSessionOf`; mostrar última y mejor sesión bajo cada ejercicio + campo de nota por sesión.

---

## M3 · Motor inteligente de progresión y autorregulación

### M3.1 Autorregulación por RPE/RIR objetivo
- **Objetivo:** prescribir carga del día a partir de e1RM y RPE objetivo (p. ej. "3×8 @ RPE 8") y ajustar según el feedback real.
- **Beneficio:** carga adecuada cada día según estado, no fija.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** target_load = e1RM × %(RPE,reps) usando tabla RPE de Helms. Recalcula tras cada set (autoregulación intra-sesión).

### M3.2 Detección de estancamiento y deload automático
- **Objetivo:** detectar mesetas (sin progreso de e1RM/volumen en N semanas, o RPE subiendo a carga constante) y proponer deload (-40-50% volumen) o cambio de ejercicio.
- **Beneficio:** rompe estancamientos, previene sobreentrenamiento.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** job semanal: tendencia de e1RM por ejercicio + ratio fatiga. Si plateau ≥3 sem → sugerir deload/variación. Marca semana como "deload" en `routines`.

### M3.3 Gestión de fatiga y readiness (ACWR)
- **Objetivo:** ratio carga aguda:crónica (ACWR, ventana 7d:28d) y readiness diario (sueño+HRV+RPE) para modular el volumen.
- **Beneficio:** entrenar duro cuando se puede, recular cuando hay riesgo; menos lesiones.
- **Prioridad:** Media · **Complejidad:** Alta.
- **Diseño:** carga = volumen·RPE (sRPE). ACWR fuera de 0.8-1.3 → alerta. Score de readiness 0-100 combina sueño/HRV/ánimo/dolor → ajusta sugerencia del día (+/−10-20%).

---

## M4 · Planificación de objetivos y periodización

### M4.1 Objetivos SMART con seguimiento
- **Objetivo:** definir metas (ganar músculo, perder grasa, recomposición, fuerza, rendimiento) con valor objetivo + fecha + hitos.
- **Beneficio:** dirección clara, sensación de progreso medible.
- **Prioridad:** Alta · **Complejidad:** Baja-Media.
- **Diseño:** tabla `goals` (tipo, métrica, valor_inicial, valor_objetivo, fecha_obj, estado). Barra de progreso + proyección de fecha de logro según tendencia.

### M4.2 Periodización (bloques/ondas)
- **Objetivo:** planificar macro/meso/microciclos (acumulación→intensificación→realización→deload), lineal o ondulante.
- **Beneficio:** progreso a largo plazo estructurado, evita estancamiento.
- **Prioridad:** Media · **Complejidad:** Alta.
- **Diseño:** `mesocycles` con fases y semanas; auto-genera targets de volumen/intensidad por semana; vista calendario.

### M4.3 Calculadora de fase nutrición-entrenamiento
- **Objetivo:** alinear fase de entrenamiento con fase calórica (bulk/cut/maintenance/recomp) y estimar duración/resultados.
- **Beneficio:** decisiones coherentes entre comer y entrenar.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** según %graso estimado y objetivo, recomienda fase y ritmo (lean bulk +0.25-0.5%/sem; cut −0.5-1%/sem); proyección temporal.

---

## M5 · Nutrición integral

### M5.1 Cálculo de requerimientos (BMR/TDEE) y macros
- **Objetivo:** BMR (Mifflin-St Jeor / Katch-McArdle si hay %graso), TDEE por actividad, objetivo calórico y macros (proteína 1.6-2.2 g/kg, grasa 0.6-1 g/kg, resto carbos).
- **Beneficio:** base científica personalizada en vez de números fijos.
- **Prioridad:** Crítica · **Complejidad:** Baja.
- **Diseño:** extiende `profile` (actividad, %graso). `nutrition_targets` por fecha (kcal, prot, grasa, carbo, fibra). Recalcula al cambiar peso/fase.

### M5.2 Registro alimentario con base de datos de alimentos
- **Objetivo:** loguear comidas por porciones; base de alimentos (Open Food Facts / USDA), favoritos, comidas recientes, "copiar día".
- **Beneficio:** seguimiento calórico/macro real, el corazón de la nutrición.
- **Prioridad:** Crítica · **Complejidad:** Alta.
- **Diseño:** tablas `foods` (cache local + API Open Food Facts gratuita), `food_logs` (fecha, comida, food_id, gramos, kcal/macros calculados). Búsqueda con autocompletado; suma diaria vs objetivo (anillos).

### M5.3 Escáner de código de barras
- **Objetivo:** escanear productos con la cámara (PWA `BarcodeDetector`) → datos de Open Food Facts.
- **Beneficio:** registro en segundos, menos fricción = más adherencia.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** `BarcodeDetector` API (fallback ZXing). Lookup por EAN; si no existe, alta manual que enriquece el cache.

### M5.4 Micronutrientes e hidratación
- **Objetivo:** seguimiento de micros clave (hierro, calcio, vit D, omega-3, sodio, potasio, fibra) y agua diaria con meta (~35 ml/kg + extra por entrenamiento).
- **Beneficio:** salud real, no solo macros; detecta déficits.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** micros desde la base de alimentos; panel de "% IDR cubierta". `water_logs` con recordatorios y vasos rápidos.

### M5.5 Timing de nutrientes y planificación de comidas
- **Objetivo:** distribución de comidas (pre/intra/post), proteína por toma (0.4 g/kg × 4), planificador semanal y lista de compras.
- **Beneficio:** optimiza rendimiento/recuperación y organiza la semana.
- **Prioridad:** Media · **Complejidad:** Media-Alta.
- **Diseño:** `meal_plans` semanales; genera lista de compras agregando ingredientes; reparte macros por comida.

### M5.6 Recetas
- **Objetivo:** crear/guardar recetas con macros por porción; importar; convertir receta en entrada de registro.
- **Beneficio:** registro rápido de comidas habituales y control de macros caseros.
- **Prioridad:** Baja-Media · **Complejidad:** Media.
- **Diseño:** `recipes` + `recipe_items` (food_id, gramos); calcula macros/porción; un toque para loguear.

### M5.7 Suplementos
- **Objetivo:** registrar suplementación (creatina, proteína, cafeína, vit D, omega-3) con dosis, horario y recordatorios; notas de evidencia.
- **Beneficio:** adherencia y claridad sobre qué tiene respaldo científico.
- **Prioridad:** Baja · **Complejidad:** Baja.
- **Diseño:** `supplements` + `supplement_logs`; ficha con nivel de evidencia (alta: creatina/cafeína/proteína).

### M5.8 Recomendaciones nutricionales adaptativas (estilo MacroFactor)
- **Objetivo:** ajustar calorías según gasto real estimado de la tendencia de peso + ingesta (no fórmulas estáticas).
- **Beneficio:** el plan se autocorrige semanalmente; supera al conteo rígido.
- **Prioridad:** Alta · **Complejidad:** Alta.
- **Diseño:** TDEE adaptativo = balance energético inferido de Δpeso (7700 kcal/kg) + kcal registradas, media móvil ponderada. Ajuste semanal de objetivo para cumplir el ritmo meta.

---

## M6 · Antropometría y composición corporal

### M6.1 UI de medidas corporales
- **Objetivo:** registrar perímetros (cuello, hombros, pecho, cintura, cadera, brazo, muslo, pantorrilla) en el tiempo (la tabla `measurements` ya existe sin UI).
- **Beneficio:** progreso visible cuando el peso no se mueve (recomp).
- **Prioridad:** Alta · **Complejidad:** Baja.
- **Diseño:** UI sobre `measurements`; gráficos por medida; recordatorio quincenal.

### M6.2 Estimación de % graso
- **Objetivo:** estimar %graso por Navy (perímetros) y/o pliegues; tendencia y masa magra/grasa.
- **Beneficio:** mide composición, no solo peso.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** fórmula Navy desde cuello/cintura/cadera+altura; opción de ingresar %graso de balanza/DEXA. Deriva masa magra para Katch-McArdle (M5.1).

### M6.3 Fotos de progreso
- **Objetivo:** subir fotos (frente/lado/espalda) por fecha, comparador lado a lado/slider, privadas y cifradas.
- **Beneficio:** la evidencia visual más motivadora del progreso.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** Supabase Storage privado (RLS), `progress_photos` (fecha, pose, path). Comparador con slider; aviso de privacidad; opción de blur/local-only.

---

## M7 · Salud, recuperación y bienestar

### M7.1 Sueño
- **Objetivo:** horas y calidad de sueño (manual o desde wearable), consistencia de horario.
- **Beneficio:** principal palanca de recuperación y composición corporal.
- **Prioridad:** Alta · **Complejidad:** Baja-Media.
- **Diseño:** `sleep_logs` (inicio, fin, calidad 1-5, despertares); alimenta readiness (M3.3).

### M7.2 Recuperación y dolor muscular
- **Objetivo:** DOMS por grupo, sensación de recuperación, energía.
- **Beneficio:** modula volumen por músculo según recuperación real.
- **Prioridad:** Media · **Complejidad:** Baja.
- **Diseño:** check-in rápido (mapa corporal tappable 0-3); influye en sugerencias.

### M7.3 Estrés y estado de ánimo
- **Objetivo:** registro de estrés/ánimo/motivación (1-5) y journaling breve.
- **Beneficio:** el psicólogo deportivo: vincula bienestar con adherencia y rendimiento.
- **Prioridad:** Media · **Complejidad:** Baja.
- **Diseño:** `wellness_logs`; correlación ánimo↔rendimiento en dashboard.

### M7.4 Frecuencia cardíaca y HRV
- **Objetivo:** FC reposo y HRV (desde wearable o manual) como marcadores de recuperación.
- **Beneficio:** señal objetiva temprana de fatiga/enfermedad.
- **Prioridad:** Media · **Complejidad:** Media (depende de M9).
- **Diseño:** `health_metrics` (tipo, valor, fecha, fuente); baseline + desviación → alerta.

### M7.5 Presión arterial y biomarcadores
- **Objetivo:** registrar PA, glucosa, lípidos, analíticas; rangos de referencia y tendencias.
- **Beneficio:** el médico del deporte: salud cardiometabólica a largo plazo.
- **Prioridad:** Media · **Complejidad:** Baja-Media.
- **Diseño:** `biomarkers` (tipo, valor, unidad, fecha, rango_ref); alertas si fuera de rango.

### M7.6 Síntomas y medicación
- **Objetivo:** registrar síntomas, enfermedades, medicación/dosis con recordatorios.
- **Beneficio:** contexto para interpretar bajones de rendimiento; adherencia a tratamientos.
- **Prioridad:** Baja-Media · **Complejidad:** Baja.
- **Diseño:** `symptoms`, `medications`+`medication_logs`; "enfermo" pausa/atenúa recomendaciones.

### M7.7 Gestión de lesiones
- **Objetivo:** registrar lesiones (zona, tipo, severidad, fechas), ejercicios contraindicados y vincular a rehab (M1.6).
- **Beneficio:** entrenar alrededor de la lesión sin empeorarla.
- **Prioridad:** Alta (caso Diego) · **Complejidad:** Media.
- **Diseño:** `injuries`; filtra/sustituye ejercicios contraindicados automáticamente; seguimiento de dolor.

### M7.8 Hábitos diarios
- **Objetivo:** tracker de hábitos (agua, pasos, proteína, sueño, movilidad, no alcohol) con rachas.
- **Beneficio:** el coach de hábitos: construye consistencia, base de todo resultado.
- **Prioridad:** Alta · **Complejidad:** Baja-Media.
- **Diseño:** `habits`+`habit_logs`; check diario, rachas, recordatorios; alimenta gamificación (M11).

---

## M8 · Dashboard, tendencias, predicciones y alertas

### M8.1 Dashboard principal "Hoy"
- **Objetivo:** vista unificada: entrenamiento del día, anillos de nutrición, agua, sueño, readiness, peso, próximos recordatorios.
- **Beneficio:** todo lo accionable de un vistazo; menos navegación.
- **Prioridad:** Crítica · **Complejidad:** Media.
- **Diseño:** tarjetas modulares configurables; estado vacío con CTA. Reemplaza el "Hoy" actual.

### M8.2 Tendencias y correlaciones
- **Objetivo:** tendencias de fuerza/volumen/peso/sueño/calorías y correlaciones (p. ej. sueño↔rendimiento, calorías↔Δpeso).
- **Beneficio:** insights accionables que el usuario no ve solo.
- **Prioridad:** Media · **Complejidad:** Media-Alta.
- **Diseño:** capa de analítica que cruza módulos; tarjetas de insight generadas por reglas + IA (M10).

### M8.3 Predicciones
- **Objetivo:** proyectar peso/% graso/e1RM y fecha estimada de logro de metas.
- **Beneficio:** expectativas realistas y motivación.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** regresión (ya hay base en `weeklyTrend`) extendida a más series; bandas de confianza.

### M8.4 Sistema de alertas
- **Objetivo:** alertas proactivas: posible sobreentrenamiento, proteína baja sostenida, peso fuera de ritmo, PR, deload sugerido, hidratación.
- **Beneficio:** la app avisa antes de que el problema crezca.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** motor de reglas evaluado al sincronizar + push (M13.3); centro de notificaciones in-app.

---

## M9 · Integraciones con wearables y apps externas

### M9.1 Health Connect (Android) / Apple Health
- **Objetivo:** importar pasos, FC, sueño, HRV, peso, kcal activas; exportar entrenamientos.
- **Beneficio:** datos automáticos sin registro manual.
- **Prioridad:** Media · **Complejidad:** Alta (PWA tiene límites; requiere wrapper/Health Connect web o app nativa ligera).
- **Diseño:** capa `integrations` con `data_sources`; mapeo a `health_metrics`. En PWA: import por archivo/Google Fit API; valorar envoltorio Capacitor para acceso nativo.

### M9.2 Garmin / Polar / Strava / Fitbit
- **Objetivo:** sincronizar cardio/FC/sueño vía OAuth.
- **Beneficio:** ecosistema unificado para quien ya usa esos relojes.
- **Prioridad:** Baja-Media · **Complejidad:** Alta.
- **Diseño:** OAuth + webhooks en Edge Functions de Supabase; normalizar a tablas internas.

### M9.3 Importar/Exportar y portabilidad
- **Objetivo:** importar desde Hevy/Strong/CSV y exportar todo (CSV/JSON/PDF).
- **Beneficio:** sin lock-in; respaldo y migración; ya hay puente CSV con Kratos.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** import wizard con mapeo de columnas; export completo firmado. Mantener compatibilidad con `gymdb.mjs`.

---

## M10 · IA: entrenador + nutricionista + coach de hábitos

### M10.1 Coach IA embebido (Kratos in-app)
- **Objetivo:** chat de IA dentro de la app con contexto completo de los datos del usuario; explica recomendaciones y responde dudas.
- **Beneficio:** asesoría experta 24/7 unificada con Kratos (Telegram).
- **Prioridad:** Alta · **Complejidad:** Alta.
- **Diseño:** Edge Function que arma contexto (RAG sobre datos del usuario) → modelo (Claude). Comparte memoria/datos con el agente Kratos vía Supabase. Sugerencias proactivas (no solo reactivas).

### M10.2 Generación/ajuste automático de rutinas y dietas
- **Objetivo:** la IA genera rutina y plan nutricional según perfil/equipo/objetivo y los reajusta con los datos reales.
- **Beneficio:** personalización profunda sin trabajo manual.
- **Prioridad:** Media · **Complejidad:** Alta.
- **Diseño:** prompt estructurado + validación contra reglas (volumen MEV-MRV, macros por kg) antes de aplicar. Diff revisable por el usuario.

### M10.3 Registro por lenguaje natural y foto
- **Objetivo:** "hice 3×8 press banca 60 kg" o foto del plato → entradas estructuradas.
- **Beneficio:** fricción casi nula; la mayor barrera de adherencia.
- **Prioridad:** Media · **Complejidad:** Alta.
- **Diseño:** NLU → JSON de sets/foods; visión para estimar porciones (con confirmación). Reaprovecha el flujo de dictado a Kratos.

---

## M11 · Gamificación, adherencia y motivación

### M11.1 Logros y badges
- **Objetivo:** logros por hitos (primer PR, 10/50/100 sesiones, racha de proteína, 1000 kg movidos…).
- **Beneficio:** refuerzo positivo, dopamina por consistencia.
- **Prioridad:** Media · **Complejidad:** Baja-Media.
- **Diseño:** `achievements` con reglas; vitrina; notificación al desbloquear.

### M11.2 Rachas y adherencia
- **Objetivo:** rachas de entrenamiento/registro/hábitos y score de adherencia semanal (% sesiones y macros cumplidos).
- **Beneficio:** consistencia visible; el predictor #1 de resultados.
- **Prioridad:** Alta · **Complejidad:** Baja.
- **Diseño:** cómputo de rachas; anillo de adherencia semanal; "no rompas la racha".

### M11.3 Desafíos y metas sociales (opcional)
- **Objetivo:** retos personales o con amigos (volumen mensual, días de movilidad, pasos).
- **Beneficio:** motivación extra; opcional para no presionar.
- **Prioridad:** Baja · **Complejidad:** Media.
- **Diseño:** `challenges` propios; social diferido (tabla compartida opt-in) por privacidad.

---

## M12 · Informes automáticos

### M12.1 Resumen diario
- **Objetivo:** cierre del día: entrenamiento, nutrición vs objetivo, agua, sueño, hábitos, mensaje del coach.
- **Beneficio:** reflexión y ajuste rápido; engagement.
- **Prioridad:** Media · **Complejidad:** Baja-Media.
- **Diseño:** generado al final del día; push + tarjeta. Reutiliza el motor de alertas.

### M12.2 Informe semanal
- **Objetivo:** series/músculo, progresión, Δpeso vs meta, adherencia, mejores series, sueño medio, recomendaciones de la próxima semana.
- **Beneficio:** la "reunión con tu coach" semanal automatizada.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** Edge Function semanal → reporte + narrativa IA (M10). Exportable a PDF; entregable también por Kratos en Telegram.

### M12.3 Informe mensual / revisión de fase
- **Objetivo:** balance del mesociclo, composición corporal, fotos comparadas, decisión de fase siguiente.
- **Beneficio:** visión estratégica de largo plazo.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** agrega semanales; comparador de fotos; recomendación de continuar/cambiar fase.

---

## M13 · Plataforma transversal (arquitectura, UX, seguridad)

### M13.1 Offline-first y sincronización
- **Objetivo:** registrar sin conexión (gimnasios con mala señal) y sincronizar al volver.
- **Beneficio:** fiabilidad en el uso real.
- **Prioridad:** Crítica · **Complejidad:** Alta.
- **Diseño:** IndexedDB como cola local + reconciliación con Supabase; resolución de conflictos last-write-wins por registro. Evolución del SW actual.

### M13.2 Arquitectura de código escalable
- **Objetivo:** modularizar (hoy JS global en `window`); preparar para crecer sin romper.
- **Beneficio:** mantenibilidad ante la explosión de módulos.
- **Prioridad:** Alta · **Complejidad:** Media-Alta.
- **Diseño:** migración gradual a ES modules; opción de framework ligero (Preact/Lit) o seguir vanilla con router por hash y store central. Mantener PWA sin build pesado.

### M13.3 Notificaciones push y recordatorios
- **Objetivo:** recordatorios (entrenar, agua, comidas, suplementos, pesarse) y alertas (M8.4).
- **Beneficio:** adherencia; reengagement.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** Web Push (VAPID) + Supabase Edge Functions/cron; preferencias por tipo y horario; respeta ventana de silencio.

### M13.4 Seguridad y privacidad de datos de salud
- **Objetivo:** datos sensibles (salud, fotos, biomarcadores) protegidos: RLS estricta, Storage privado, cifrado, control de retención y borrado.
- **Beneficio:** confianza; los datos de salud son categoría especial.
- **Prioridad:** Crítica · **Complejidad:** Media.
- **Diseño:** auditar RLS de cada tabla nueva; Storage privado por usuario; export/borrado total (derecho al olvido); aviso de privacidad. Nunca exponer secret keys en el repo.

### M13.5 Accesibilidad, i18n y UX
- **Objetivo:** accesible (contraste AA, focus, lectores de pantalla, áreas táctiles ≥44px), responsive tablet/desktop, microinteracciones.
- **Beneficio:** usable para todos y en cualquier pantalla.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** auditoría a11y; layout adaptable (hoy max 760px); mantener tema claro/oscuro teal ya aplicado.

### M13.6 Onboarding guiado
- **Objetivo:** wizard inicial (perfil → objetivo → equipo → rutina → nutrición) con valores calculados.
- **Beneficio:** time-to-value bajo; usuario configurado en minutos.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** flujo multipaso que rellena perfil/targets/rutina; reusa cálculos M5.1.

---

# RONDA 2 — Revisión: vacíos detectados tras la Ronda 1

> El equipo revisa lo anterior y detecta dominios y casos no cubiertos.

### R2.1 Salud femenina / ciclo menstrual *(arquitecto del modelo: no asumir un solo perfil)*
- **Objetivo:** seguimiento de ciclo y adaptación de entrenamiento/nutrición por fase.
- **Beneficio:** hace la plataforma válida para usuarias; evidencia creciente de periodización por fase.
- **Prioridad:** Media (Baja para Diego, Alta para producto) · **Complejidad:** Media.
- **Diseño:** `menstrual_cycle` (fechas, síntomas); ajustes opcionales de carga; antojos/energía en nutrición.

### R2.2 Pasos y NEAT
- **Objetivo:** pasos diarios y actividad no-ejercicio como componente del gasto.
- **Beneficio:** el NEAT explica gran parte del TDEE; clave en cortes.
- **Prioridad:** Media · **Complejidad:** Baja (manual) / Media (wearable).
- **Diseño:** `daily_activity` (pasos, kcal activas); entra al TDEE adaptativo (M5.8).

### R2.3 Deportes específicos / rendimiento atlético
- **Objetivo:** métricas de rendimiento (velocidad, potencia, salto, sprints, tests de campo) y planificación para deportistas.
- **Beneficio:** amplía de "gym" a rendimiento deportivo (lo pide el enunciado).
- **Prioridad:** Baja-Media · **Complejidad:** Media.
- **Diseño:** `performance_tests` (tipo, valor, fecha); plantillas de pliometría/velocidad; integración con cardio por zonas.

### R2.4 Calculadoras y herramientas
- **Objetivo:** set de calculadoras (1RM, discos a cargar/"plate calculator", macros, %graso, ritmo de carrera, conversión RPE).
- **Beneficio:** utilidad inmediata; muy usadas en apps líderes.
- **Prioridad:** Media · **Complejidad:** Baja.
- **Diseño:** sección "Herramientas" con calculadoras puras (sin datos), enlazadas desde el logging.

### R2.5 Descanso inteligente y temporizadores
- **Objetivo:** cronómetro de descanso por ejercicio con sugerencia (compuestos 2-3 min, aislados 60-90 s) y autoinicio al guardar set.
- **Beneficio:** descansos adecuados → mejor rendimiento/hipertrofia.
- **Prioridad:** Media · **Complejidad:** Baja.
- **Diseño:** timer con notificación/vibración; valor por defecto según tipo de ejercicio.

### R2.6 Modo "entrenamiento en vivo"
- **Objetivo:** UI dedicada durante la sesión (pantalla activa, set actual grande, swipe entre ejercicios, descanso integrado, resumen al terminar).
- **Beneficio:** UX óptima en el momento de mayor uso; menos toques.
- **Prioridad:** Alta · **Complejidad:** Media.
- **Diseño:** vista full-screen "workout player"; wake-lock; cierre con resumen + PRs + sensación de sesión.

### R2.7 Multi-perfil / modo coach-cliente
- **Objetivo:** soporte para que un coach gestione varios clientes (o varios perfiles).
- **Beneficio:** abre uso profesional; encaja con Kratos como "coach".
- **Prioridad:** Baja · **Complejidad:** Alta.
- **Diseño:** `coach_clients` con permisos; vistas de coach (lista, asignar rutinas, ver adherencia).

### R2.8 Energía/recuperación: integración real readiness↔plan
- **Objetivo:** cerrar el lazo: readiness (M3.3) modifica de verdad la sesión sugerida y el objetivo calórico del día.
- **Beneficio:** la plataforma "reacciona" al usuario; diferencia clave vs apps estáticas.
- **Prioridad:** Media · **Complejidad:** Alta.
- **Diseño:** orquestador que, al abrir "Hoy", combina readiness + fase + fatiga → ajuste concreto y explicado.

---

# RONDA 3 — Revisión final: refinamiento y robustez

> Última pasada buscando huecos finos de UX, datos, clínicos y de plataforma.

### R3.1 Banderas rojas clínicas *(médico del deporte)*
- **Objetivo:** detectar señales que requieren derivación médica (dolor torácico, PA muy alta, pérdida de peso involuntaria severa, dolor lesivo creciente).
- **Beneficio:** seguridad del usuario; responsabilidad clínica.
- **Prioridad:** Alta · **Complejidad:** Baja-Media.
- **Diseño:** reglas sobre biomarcadores/síntomas → mensaje claro "consulta a un profesional"; disclaimer de que la app no sustituye atención médica.

### R3.2 Calidad y deduplicación de datos
- **Objetivo:** validación de entradas (rangos plausibles), detección de outliers (peso/medidas), edición/borrado con historial.
- **Beneficio:** datos confiables → recomendaciones confiables.
- **Prioridad:** Media · **Complejidad:** Baja-Media.
- **Diseño:** validadores por campo; confirmación ante valores extremos; soft-delete con `deleted_at`.

### R3.3 Versionado de objetivos nutricionales y de rutina
- **Objetivo:** guardar histórico de objetivos (kcal/macros) y de rutinas para analizar qué funcionó.
- **Beneficio:** aprendizaje longitudinal; el motor adaptativo necesita historia.
- **Prioridad:** Media · **Complejidad:** Baja.
- **Diseño:** tablas con `valid_from/valid_to`; nunca sobrescribir, versionar.

### R3.4 Estados vacíos, ayuda contextual y educación
- **Objetivo:** cada módulo con estado vacío útil, tooltips y microcontenido educativo (qué es RIR, MEV, Zona 2…).
- **Beneficio:** el usuario aprende mientras usa; reduce abandono.
- **Prioridad:** Media · **Complejidad:** Baja.
- **Diseño:** componente de "explicador" reutilizable; glosario.

### R3.5 Rendimiento y costes
- **Objetivo:** paginar históricos largos, lazy-load de gráficos/fotos, cache, minimizar llamadas a IA.
- **Beneficio:** app fluida y barata a escala de años de datos.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** queries con rango/paginación; materializar agregados (vistas/`reports`); presupuesto de tokens IA.

### R3.6 Respaldo, exportación médica y cumplimiento
- **Objetivo:** export PDF para médico/coach, respaldo programado, política de datos (estilo GDPR).
- **Beneficio:** confianza y utilidad clínica real.
- **Prioridad:** Media · **Complejidad:** Media.
- **Diseño:** informe clínico PDF (biomarcadores+tendencias); export total JSON; borrado de cuenta.

### R3.7 Widgets y accesos rápidos
- **Objetivo:** atajos para acciones frecuentes (loguear agua, peso, iniciar entreno) desde home screen / quick actions.
- **Beneficio:** fricción mínima en lo diario.
- **Prioridad:** Baja-Media · **Complejidad:** Media.
- **Diseño:** PWA shortcuts en manifest; FAB contextual; (widgets nativos requieren wrapper).

**Conclusión de la Ronda 3:** tras tres pasadas, las nuevas incorporaciones son refinamientos (calidad de datos, seguridad clínica, rendimiento, educación) y no nuevos dominios. Los dominios de entrenamiento, nutrición, salud, recuperación, bienestar, rendimiento y seguimiento quedan cubiertos. **Se considera el análisis convergido.**

---

# Síntesis: roadmap por fases

**Fase 1 — Fundaciones (Crítica/Alta).** M2.1, M2.2, M2.4, M6.1 (medidas), M5.1+M5.2 (nutrición base + registro), M8.1 (dashboard Hoy), M13.1 (offline), M13.4 (seguridad), M13.6 (onboarding), R2.6 (workout player). → Convierte la app en un tracker entreno+nutrición serio.

**Fase 2 — Inteligencia (Alta/Media).** M3.1-M3.2 (autorregulación + deload), M5.8 (nutrición adaptativa), M4.1 (objetivos), M6.3 (fotos), M7.1/M7.7/M7.8 (sueño/lesiones/hábitos), M8.4 (alertas), M11.2 (adherencia), M12.2 (informe semanal), M13.3 (push). → La app empieza a "coachear".

**Fase 3 — Plataforma integral (Media).** M1.1-M1.6 completo (biblioteca, cardio, movilidad, rehab), M5.3-M5.7 (escáner, micros, planificación, recetas, suplementos), M6.2 (%graso), M7.2-M7.6 (recuperación/salud), M3.3 (fatiga/readiness), M4.2 (periodización), M8.2-M8.3 (correlaciones/predicciones), M10.1-M10.2 (IA embebida), M11.1 (logros), M12.1/M12.3 (informes).

**Fase 4 — Ecosistema (Media/Baja).** M9 (wearables/integraciones), M10.3 (registro NLU/foto), M11.3 (social), R2.1/R2.3/R2.7 (ciclo, deportes, coach-cliente), R3.6/R3.7 (export clínico, widgets).

## Nuevas tablas propuestas (Supabase)
`exercise_library`, `routines`, `routine_days`, `cardio_sessions`, `mobility_routines`, `rehab_protocols`, `personal_records`, `mesocycles`, `goals`, `nutrition_targets`, `foods`, `food_logs`, `recipes`, `recipe_items`, `water_logs`, `meal_plans`, `supplements`, `supplement_logs`, `progress_photos` (+Storage), `sleep_logs`, `wellness_logs`, `health_metrics`, `biomarkers`, `symptoms`, `medications`, `medication_logs`, `injuries`, `habits`, `habit_logs`, `achievements`, `challenges`, `daily_activity`, `performance_tests`, `menstrual_cycle`, `integrations`, `reports`. Todas con RLS por `user_id` y, donde aplique, versionado (`valid_from/valid_to`) y `deleted_at`.

## Principios de diseño transversales
1. **Fricción mínima** en el registro (el predictor real de adherencia).
2. **Basado en evidencia** y transparente (explicar el porqué de cada recomendación).
3. **Privacidad primero** en datos de salud.
4. **Cierre del lazo**: medir → analizar → recomendar → ajustar.
5. **Coherente con Kratos**: la app y el agente comparten datos y "hablan" el mismo modelo.

---
_Documento vivo. Última revisión: 2026-06-15._
