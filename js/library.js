// ============================================================
//  LIBRARY — Catálogo de ejercicios con metadatos
//  Usado para crear ejercicios rápido y sugerir sustituciones.
//  unidad: barra | mancuerna | peso_corporal | tiempo (compatible con la app)
// ============================================================
const EXERCISE_LIBRARY = [
  // Pecho
  { nombre:'Press banca con barra', grupo:'pecho', patron:'empuje_horizontal', unidad:'barra' },
  { nombre:'Press banca con mancuernas', grupo:'pecho', patron:'empuje_horizontal', unidad:'mancuerna' },
  { nombre:'Press inclinado con mancuernas', grupo:'pecho', patron:'empuje_horizontal', unidad:'mancuerna' },
  { nombre:'Press inclinado con barra', grupo:'pecho', patron:'empuje_horizontal', unidad:'barra' },
  { nombre:'Aperturas con mancuernas', grupo:'pecho', patron:'aislamiento', unidad:'mancuerna' },
  { nombre:'Fondos en paralelas', grupo:'pecho', patron:'empuje_horizontal', unidad:'peso_corporal' },
  { nombre:'Flexiones', grupo:'pecho', patron:'empuje_horizontal', unidad:'peso_corporal' },
  // Espalda
  { nombre:'Dominadas', grupo:'espalda', patron:'traccion_vertical', unidad:'peso_corporal' },
  { nombre:'Jalón al pecho', grupo:'espalda', patron:'traccion_vertical', unidad:'polea' },
  { nombre:'Remo con barra', grupo:'espalda', patron:'traccion_horizontal', unidad:'barra' },
  { nombre:'Remo con mancuerna', grupo:'espalda', patron:'traccion_horizontal', unidad:'mancuerna' },
  { nombre:'Remo Pendlay', grupo:'espalda', patron:'traccion_horizontal', unidad:'barra' },
  { nombre:'Peso muerto', grupo:'espalda', patron:'bisagra', unidad:'barra' },
  { nombre:'Face pull', grupo:'espalda', patron:'traccion_horizontal', unidad:'polea' },
  // Piernas
  { nombre:'Sentadilla con barra', grupo:'piernas', patron:'sentadilla', unidad:'barra' },
  { nombre:'Sentadilla frontal', grupo:'piernas', patron:'sentadilla', unidad:'barra' },
  { nombre:'Sentadilla goblet', grupo:'piernas', patron:'sentadilla', unidad:'mancuerna' },
  { nombre:'Peso muerto rumano', grupo:'piernas', patron:'bisagra', unidad:'barra' },
  { nombre:'Peso muerto rumano con mancuernas', grupo:'piernas', patron:'bisagra', unidad:'mancuerna' },
  { nombre:'Zancadas con mancuernas', grupo:'piernas', patron:'zancada', unidad:'mancuerna' },
  { nombre:'Sentadilla búlgara', grupo:'piernas', patron:'zancada', unidad:'mancuerna' },
  { nombre:'Hip thrust', grupo:'gluteo', patron:'bisagra', unidad:'barra' },
  { nombre:'Elevación de talones (gemelos)', grupo:'piernas', patron:'aislamiento', unidad:'mancuerna' },
  { nombre:'Curl femoral nórdico', grupo:'piernas', patron:'aislamiento', unidad:'peso_corporal' },
  // Hombro
  { nombre:'Press militar de pie', grupo:'hombro', patron:'empuje_vertical', unidad:'barra' },
  { nombre:'Press militar con mancuernas', grupo:'hombro', patron:'empuje_vertical', unidad:'mancuerna' },
  { nombre:'Elevaciones laterales', grupo:'hombro', patron:'aislamiento', unidad:'mancuerna' },
  { nombre:'Elevaciones frontales', grupo:'hombro', patron:'aislamiento', unidad:'mancuerna' },
  { nombre:'Pájaros (deltoide posterior)', grupo:'hombro', patron:'aislamiento', unidad:'mancuerna' },
  // Bíceps
  { nombre:'Curl con barra', grupo:'biceps', patron:'aislamiento', unidad:'barra' },
  { nombre:'Curl con mancuernas', grupo:'biceps', patron:'aislamiento', unidad:'mancuerna' },
  { nombre:'Curl martillo', grupo:'biceps', patron:'aislamiento', unidad:'mancuerna' },
  { nombre:'Curl inclinado', grupo:'biceps', patron:'aislamiento', unidad:'mancuerna' },
  // Tríceps
  { nombre:'Press francés', grupo:'triceps', patron:'aislamiento', unidad:'barra' },
  { nombre:'Extensión de tríceps con mancuerna', grupo:'triceps', patron:'aislamiento', unidad:'mancuerna' },
  { nombre:'Fondos en banco', grupo:'triceps', patron:'empuje_horizontal', unidad:'peso_corporal' },
  { nombre:'Patada de tríceps', grupo:'triceps', patron:'aislamiento', unidad:'mancuerna' },
  // Core
  { nombre:'Plancha', grupo:'core', patron:'core', unidad:'tiempo' },
  { nombre:'Plancha lateral', grupo:'core', patron:'core', unidad:'tiempo' },
  { nombre:'Elevación de piernas colgado', grupo:'core', patron:'core', unidad:'peso_corporal' },
  { nombre:'Crunch abdominal', grupo:'core', patron:'core', unidad:'peso_corporal' },
  { nombre:'Rueda abdominal', grupo:'core', patron:'core', unidad:'peso_corporal' },
  { nombre:'Pallof press', grupo:'core', patron:'core', unidad:'polea' },
  // Máquinas y poleas
  { nombre:'Press de pecho en máquina', grupo:'pecho', patron:'empuje_horizontal', unidad:'maquina' },
  { nombre:'Cruce de poleas', grupo:'pecho', patron:'aislamiento', unidad:'polea' },
  { nombre:'Pec deck', grupo:'pecho', patron:'aislamiento', unidad:'maquina' },
  { nombre:'Jalón en polea', grupo:'espalda', patron:'traccion_vertical', unidad:'polea' },
  { nombre:'Remo sentado en polea', grupo:'espalda', patron:'traccion_horizontal', unidad:'polea' },
  { nombre:'Remo en máquina', grupo:'espalda', patron:'traccion_horizontal', unidad:'maquina' },
  { nombre:'Prensa de piernas', grupo:'piernas', patron:'sentadilla', unidad:'maquina' },
  { nombre:'Sentadilla hack', grupo:'piernas', patron:'sentadilla', unidad:'maquina' },
  { nombre:'Extensión de cuádriceps', grupo:'piernas', patron:'aislamiento', unidad:'maquina' },
  { nombre:'Curl femoral en máquina', grupo:'piernas', patron:'aislamiento', unidad:'maquina' },
  { nombre:'Abductores en máquina', grupo:'gluteo', patron:'aislamiento', unidad:'maquina' },
  { nombre:'Press de hombro en máquina', grupo:'hombro', patron:'empuje_vertical', unidad:'maquina' },
  { nombre:'Elevaciones laterales en polea', grupo:'hombro', patron:'aislamiento', unidad:'polea' },
  { nombre:'Curl en polea', grupo:'biceps', patron:'aislamiento', unidad:'polea' },
  { nombre:'Extensión de tríceps en polea', grupo:'triceps', patron:'aislamiento', unidad:'polea' },
  { nombre:'Crunch en polea', grupo:'core', patron:'core', unidad:'polea' },
];

// Unidad de cada ejercicio -> cómo se registra: 'kg' | 'reps' | 'tiempo'
const unitKind = u => u === 'tiempo' ? 'tiempo' : u === 'peso_corporal' ? 'reps' : 'kg';

// Plantillas basadas en ACSM 2026: cada grupo grande al menos 2×/semana.
const ROUTINE_TEMPLATES = [
  { nombre:'Full Body 3 días', desc:'Cada grupo 3×/semana. Ideal para retomar.', dias:{
    'Full A':['Sentadilla con barra','Press banca con barra','Remo con barra','Elevaciones laterales','Plancha'],
    'Full B':['Peso muerto rumano','Press militar con mancuernas','Jalón en polea','Sentadilla búlgara','Curl con mancuernas'],
    'Full C':['Prensa de piernas','Press inclinado con mancuernas','Remo sentado en polea','Extensión de tríceps en polea','Elevación de piernas colgado'] } },
  { nombre:'Torso / Pierna 4 días', desc:'Cada grupo 2×/semana con más volumen.', dias:{
    'Torso 1':['Press banca con barra','Remo con barra','Press militar con mancuernas','Jalón en polea','Curl con mancuernas'],
    'Pierna 1':['Sentadilla con barra','Peso muerto rumano','Extensión de cuádriceps','Elevación de talones (gemelos)','Plancha'],
    'Torso 2':['Press inclinado con mancuernas','Remo sentado en polea','Elevaciones laterales','Face pull','Extensión de tríceps en polea'],
    'Pierna 2':['Prensa de piernas','Hip thrust','Curl femoral en máquina','Elevación de talones (gemelos)','Crunch en polea'] } },
  { nombre:'Empuje / Tirón / Pierna', desc:'3 días, o 6 para repetir cada grupo 2×/semana.', dias:{
    'Empuje':['Press banca con barra','Press militar con mancuernas','Press inclinado con mancuernas','Elevaciones laterales','Extensión de tríceps en polea'],
    'Tirón':['Dominadas','Remo con barra','Jalón en polea','Face pull','Curl con mancuernas'],
    'Pierna':['Sentadilla con barra','Peso muerto rumano','Prensa de piernas','Curl femoral en máquina','Elevación de talones (gemelos)'] } },
];

// Actividades distintas a pesas (se guardan en cardio_sessions)
const ACTIVITIES = [['caminata','🚶','Caminata'],['trote','🏃','Trote'],['bici','🚴','Bici'],['futbol','⚽','Fútbol'],
  ['natacion','🏊','Natación'],['hiit','🔥','HIIT'],['eliptica','🌀','Elíptica'],['remo','🚣','Remo'],
  ['yoga','🧘','Yoga'],['escalada','🧗','Escalada'],['senderismo','🥾','Senderismo'],['otro','✨','Otra']];

// Rutinas de movilidad / calentamiento guiado (segundos por ejercicio)
const MOBILITY_ROUTINES = [
  { nombre:'Calentamiento general', icono:'🔥', items:[
    { n:'Jumping jacks', s:40 }, { n:'Círculos de brazos', s:30 }, { n:'Rotación de cadera', s:30 },
    { n:'Sentadillas sin peso', s:40 }, { n:'Zancadas con torsión', s:40 }, { n:'Balanceo de piernas', s:30 } ] },
  { nombre:'Movilidad de hombros', icono:'💪', items:[
    { n:'Dislocaciones con banda/palo', s:40 }, { n:'Círculos de hombro', s:30 }, { n:'Estiramiento pectoral en pared', s:40 },
    { n:'Rotación externa con banda', s:40 }, { n:'Cat-camel', s:40 } ] },
  { nombre:'Movilidad de cadera', icono:'🦵', items:[
    { n:'90/90 cambios', s:50 }, { n:'Sentadilla profunda mantenida', s:40 }, { n:'Estiramiento de flexor (zancada)', s:40 },
    { n:'Puente de glúteo', s:40 }, { n:'Rotación de cadera en cuadrupedia', s:40 } ] },
  { nombre:'Columna y espalda', icono:'🧘', items:[
    { n:'Cat-camel', s:40 }, { n:'Rotación torácica', s:40 }, { n:'Perro-pájaro', s:40 },
    { n:'Estiramiento de gato', s:30 }, { n:'Plancha suave', s:30 } ] },
];

// Alternativas: mismo grupo (prioriza mismo patrón), excluye el actual.
function libraryAlternatives(nombre, grupo, patron){
  const base = EXERCISE_LIBRARY.filter(e => e.nombre !== nombre && (grupo ? e.grupo === grupo : true));
  const same = patron ? base.filter(e => e.patron === patron) : [];
  const rest = base.filter(e => !same.includes(e));
  return [...same, ...rest].slice(0, 8);
}
if (typeof module !== 'undefined') module.exports = { EXERCISE_LIBRARY, ROUTINE_TEMPLATES, ACTIVITIES, unitKind };
