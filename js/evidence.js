// ============================================================
//  EVIDENCE — Cálculos corporales y nutricionales con su fuente.
//  Funciones puras: sin DOM ni datos personales (repo público).
//  Revisado 2026-10-31. Al cambiar un corte, actualizar SOURCES.
// ============================================================
const Evidence = (() => {
  const round = (x, d = 1) => x == null || !isFinite(x) ? null : +x.toFixed(d);
  const ok = 'ok', warn = 'warn', bad = 'bad';

  const SOURCES = [
    ['IMC', 'Categorías OMS. Comisión Lancet Diabetes & Endocrinology 2025: el IMC solo no confirma exceso de grasa; exige al menos una segunda medida (cintura, cintura-cadera o cintura-estatura) o medición directa.'],
    ['Cintura/estatura', 'NICE NG246 (2025): 0,40–0,49 saludable, 0,50–0,59 aumentada, ≥0,60 alta. Aplica a IMC < 35, a ambos sexos y a personas con mucha masa muscular.'],
    ['Cintura', 'Corte IDF para Sudamérica: ≥ 90 cm hombres, ≥ 80 cm mujeres (el mismo que usa Mi Salud).'],
    ['Cintura/cadera', 'Comisión Lancet 2025: > 0,90 hombres, > 0,85 mujeres.'],
    ['% de grasa', 'RFM (Woolcott & Bergman, Sci Rep 2018): 64 − 20 × estatura/cintura + 12 si es mujer. Siguió mejor al DEXA que el IMC, y en Chile (2024) su discriminación fue similar a la del IMC. Navy (Hodgdon & Beckett) y Deurenberg se muestran solo para comparar. Todas son estimaciones, no DEXA.'],
    ['FFMI', 'Masa magra / estatura². Permite seguir el músculo; no hay un corte clínico único, por eso se usa como tendencia personal.'],
    ['Metabolismo basal', 'Mifflin-St Jeor: la fórmula más fiable en adultos con y sin obesidad (Frankenfield 2005), aunque el error individual puede pasar del 10 %. El TDEE adaptativo lo corrige con tus datos reales.'],
    ['Ritmo de cambio', 'Pérdida de ~0,7 % del peso por semana con fuerza conservó mejor la masa magra que ~1,4 % (Garthe 2011, en atletas; extrapolación razonable, no prueba directa en tu perfil).'],
    ['Proteína', '~1,6 g/kg maximiza la ganancia de masa magra con fuerza (Morton 2018). En déficit: hasta ~1,9 g/kg o 2,5 g/kg de masa magra se asocia a menor pérdida de masa magra (metarregresión, pocos estudios).'],
    ['Calidad de la dieta', 'OMS: fibra ≥ 25 g y ≥ 400 g de frutas y verduras (2023); grasa ≤ 30 % de la energía; saturada < 10 %; azúcares libres < 10 %; sodio < 2 g/día. Las etiquetas informan azúcares totales, así que aquí es una cota aproximada.'],
    ['Ultraprocesados', 'Umbrella review BMJ 2024: asociados a 32 desenlaces adversos. Es evidencia observacional y la clasificación NOVA tiene inconsistencias: úsalo como orientación.'],
    ['Fuerza', 'ACSM 2026 (137 revisiones): cada grupo grande al menos 2×/semana y ~10 series semanales para hipertrofia. La constancia pesa más que la complejidad del programa. Ir al fallo y la periodización compleja no cambian mucho el resultado en adultos sanos.'],
    ['Cardio', 'OMS 2020: 150–300 min semanales moderados o 75–150 vigorosos. FC máxima: Tanaka 2001 (208 − 0,7 × edad); con FC de reposo se usa Karvonen.'],
    ['Presión', 'Automedida domiciliaria: hipertensión desde 135/85 (ESH 2023), como en Mi Salud.'],
  ];

  const ageFrom = iso => {
    if (!iso) return null;
    const b = new Date(iso + 'T12:00:00'), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  };

  // ---- Antropometría ----
  const bmi = (peso, cm) => peso && cm ? round(peso / (cm / 100) ** 2) : null;
  function bmiClass(v) {
    if (v == null) return null;
    if (v < 18.5) return { label: 'Bajo peso', nivel: warn };
    if (v < 25) return { label: 'Normal', nivel: ok };
    if (v < 30) return { label: 'Sobrepeso', nivel: warn };
    if (v < 35) return { label: 'Obesidad I', nivel: bad };
    if (v < 40) return { label: 'Obesidad II', nivel: bad };
    return { label: 'Obesidad III', nivel: bad };
  }
  const whtr = (cintura, cm) => cintura && cm ? round(cintura / cm, 2) : null;
  function whtrClass(v) {
    if (v == null) return null;
    if (v < 0.4) return { label: 'Baja', nivel: warn };
    if (v < 0.5) return { label: 'Saludable', nivel: ok };
    if (v < 0.6) return { label: 'Aumentada', nivel: warn };
    return { label: 'Alta', nivel: bad };
  }
  function waistClass(cm, sexo = 'h') {
    if (!cm) return null;
    const corte = sexo === 'm' ? 80 : 90;
    return cm < corte ? { label: `Bajo ${corte} cm`, nivel: ok, corte } : { label: 'Obesidad abdominal', nivel: bad, corte };
  }
  const whr = (cintura, cadera) => cintura && cadera ? round(cintura / cadera, 2) : null;
  function whrClass(v, sexo = 'h') {
    if (v == null) return null;
    const corte = sexo === 'm' ? 0.85 : 0.9;
    return v > corte ? { label: 'Elevada', nivel: warn, corte } : { label: 'En rango', nivel: ok, corte };
  }

  // ---- % de grasa ----
  function rfm({ sexo = 'h', cintura, estatura_cm }) {
    if (!cintura || !estatura_cm) return null;
    const v = 64 - 20 * (estatura_cm / cintura) + (sexo === 'm' ? 12 : 0);
    return v > 2 && v < 70 ? round(v) : null;
  }
  function navy({ sexo = 'h', cuello, cintura, cadera, estatura_cm }) {
    if (!estatura_cm || !cuello || !cintura) return null;
    const lg = Math.log10;
    let v;
    if (sexo === 'm') {
      if (!cadera) return null;
      v = 495 / (1.29579 - 0.35004 * lg(cintura + cadera - cuello) + 0.221 * lg(estatura_cm)) - 450;
    } else {
      if (cintura - cuello <= 0) return null;
      v = 495 / (1.0324 - 0.19077 * lg(cintura - cuello) + 0.15456 * lg(estatura_cm)) - 450;
    }
    return v > 2 && v < 70 ? round(v) : null;
  }
  function deurenberg({ sexo = 'h', peso, estatura_cm, edad }) {
    const i = bmi(peso, estatura_cm);
    if (!i || !edad) return null;
    const v = 1.2 * i + 0.23 * edad - 10.8 * (sexo === 'm' ? 0 : 1) - 5.4;
    return v > 2 && v < 70 ? round(v) : null;
  }
  // Mejor estimación disponible + las demás para comparar
  function bodyFat({ sexo = 'h', peso, estatura_cm, edad, medidas = {}, manual }) {
    const c = { sexo, estatura_cm, cintura: medidas.cintura, cuello: medidas.cuello, cadera: medidas.cadera };
    const todas = [
      ['RFM (cintura y estatura)', rfm(c)],
      ['Medido por ti', manual ? +manual : null],
      ['Navy (perímetros)', navy(c)],
      ['Deurenberg (IMC y edad)', deurenberg({ sexo, peso, estatura_cm, edad })],
    ].filter(([, v]) => v != null).map(([metodo, pct]) => ({ metodo, pct }));
    if (!todas.length) return null;
    return { ...todas[0], alternativas: todas.slice(1) };
  }
  function composition(pct, peso, cm) {
    if (pct == null || !peso) return null;
    const grasa = round(peso * pct / 100), magra = round(peso - grasa);
    return { grasa, magra, ffmi: cm ? round(magra / (cm / 100) ** 2) : null };
  }

  // ---- Energía y objetivos ----
  function bmr({ sexo = 'h', peso, estatura_cm, edad }) {
    if (!peso || !estatura_cm || !edad) return null;
    return Math.round(10 * peso + 6.25 * estatura_cm - 5 * edad + (sexo === 'm' ? -161 : 5));
  }
  // Ritmo objetivo en % del peso por semana
  function weeklyRate({ objetivo, peso, estatura_cm, cintura }) {
    if (objetivo === 'perder') return -0.7;
    if (objetivo === 'ganar') return 0.25;
    if (objetivo === 'fuerza') return 0.1;
    if (objetivo === 'recomposicion') {
      const exceso = (bmi(peso, estatura_cm) || 0) >= 25 || (whtr(cintura, estatura_cm) || 0) >= 0.5;
      return exceso ? -0.35 : 0;
    }
    return 0;
  }
  function targets({ sexo = 'h', peso, estatura_cm, edad, actividad = 1.45, objetivo = 'recomposicion', magra, cintura }) {
    const b = bmr({ sexo, peso, estatura_cm, edad });
    if (!b) return null;
    const maint = Math.round(b * actividad);
    const rate = weeklyRate({ objetivo, peso, estatura_cm, cintura });
    const delta = peso * rate / 100 * 7700 / 7;
    const kcal = Math.round(Math.max(b, Math.max(maint * 0.75, maint + delta)));
    const deficit = kcal < maint;
    const prot = Math.round(deficit
      ? (magra ? Math.min(1.9 * peso, 2.5 * magra) : 1.8 * peso)
      : 1.6 * peso);
    const grasa = Math.round(Math.max(0.6 * peso, kcal * 0.27 / 9));
    const carbo = Math.max(0, Math.round((kcal - prot * 4 - grasa * 9) / 4));
    return { kcal, prot, grasa, carbo, maint, bmr: b, rate, kgSemana: round(peso * rate / 100, 2),
      fibra: Math.max(25, Math.round(kcal / 1000 * 14)), sat: Math.round(kcal * 0.1 / 9),
      azucar: Math.round(kcal * 0.1 / 4), sodio: 2000 };
  }

  // ---- Frecuencia cardíaca ----
  const maxHR = edad => edad ? Math.round(208 - 0.7 * edad) : null;
  function hrZones(edad, reposo) {
    const m = maxHR(edad);
    if (!m) return null;
    const at = p => Math.round(reposo ? reposo + (m - reposo) * p : m * p);
    return [[0.5, 0.6, 'Z1 Recuperación'], [0.6, 0.7, 'Z2 Aeróbico'], [0.7, 0.8, 'Z3 Tempo'], [0.8, 0.9, 'Z4 Umbral'], [0.9, 1, 'Z5 Máximo']]
      .map(([a, b, n]) => ({ n, lo: at(a), hi: at(b) }));
  }

  return { SOURCES, ageFrom, bmi, bmiClass, whtr, whtrClass, waistClass, whr, whrClass, rfm, navy, deurenberg,
           bodyFat, composition, bmr, weeklyRate, targets, maxHR, hrZones };
})();
if (typeof module !== 'undefined') module.exports = Evidence;
