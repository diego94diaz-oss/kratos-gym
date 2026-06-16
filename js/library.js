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
  { nombre:'Jalón al pecho', grupo:'espalda', patron:'traccion_vertical', unidad:'mancuerna' },
  { nombre:'Remo con barra', grupo:'espalda', patron:'traccion_horizontal', unidad:'barra' },
  { nombre:'Remo con mancuerna', grupo:'espalda', patron:'traccion_horizontal', unidad:'mancuerna' },
  { nombre:'Remo Pendlay', grupo:'espalda', patron:'traccion_horizontal', unidad:'barra' },
  { nombre:'Peso muerto', grupo:'espalda', patron:'bisagra', unidad:'barra' },
  { nombre:'Face pull', grupo:'espalda', patron:'traccion_horizontal', unidad:'mancuerna' },
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
  { nombre:'Pallof press', grupo:'core', patron:'core', unidad:'mancuerna' },
];

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
