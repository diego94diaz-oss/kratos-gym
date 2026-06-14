// ============================================================
//  SEED — Rutina A/B Full Body inicial (definida por Kratos)
//  Se inserta la primera vez que entras (si no hay ejercicios).
// ============================================================
const SEED_EXERCISES = [
  // ---- Día A ----
  { dia:'A', orden:1, nombre:'Sentadilla con barra',          grupo:'piernas', series_obj:3, reps_min:6,  reps_max:8,  rir_obj:2.5, incremento_kg:2.5, unidad:'barra' },
  { dia:'A', orden:2, nombre:'Press banca con barra',         grupo:'pecho',   series_obj:3, reps_min:6,  reps_max:8,  rir_obj:2.5, incremento_kg:2.5, unidad:'barra' },
  { dia:'A', orden:3, nombre:'Remo con barra',                grupo:'espalda', series_obj:3, reps_min:8,  reps_max:10, rir_obj:2.5, incremento_kg:2.5, unidad:'barra', notas:'Agarre cómodo para el pulgar; usar straps si molesta.' },
  { dia:'A', orden:4, nombre:'Press militar de pie',          grupo:'hombro',  series_obj:3, reps_min:6,  reps_max:8,  rir_obj:2.5, incremento_kg:2.5, unidad:'barra' },
  { dia:'A', orden:5, nombre:'Curl bíceps (neutro/martillo)', grupo:'brazo',   series_obj:2, reps_min:10, reps_max:12, rir_obj:1.5, incremento_kg:1,   unidad:'mancuerna' },
  { dia:'A', orden:6, nombre:'Plancha abdominal',             grupo:'core',    series_obj:3, reps_min:30, reps_max:45, rir_obj:null, incremento_kg:0,  unidad:'tiempo' },
  // ---- Día B ----
  { dia:'B', orden:1, nombre:'Peso muerto rumano (RDL)',      grupo:'piernas', series_obj:3, reps_min:8,  reps_max:10, rir_obj:2.5, incremento_kg:5,   unidad:'barra', notas:'Espalda neutra; agarre que no fuerce el pulgar.' },
  { dia:'B', orden:2, nombre:'Dominadas (asistidas/negativas)',grupo:'espalda',series_obj:3, reps_min:6,  reps_max:10, rir_obj:2.5, incremento_kg:0,   unidad:'peso_corporal' },
  { dia:'B', orden:3, nombre:'Press inclinado mancuernas',    grupo:'pecho',   series_obj:3, reps_min:8,  reps_max:10, rir_obj:2.5, incremento_kg:1,   unidad:'mancuerna' },
  { dia:'B', orden:4, nombre:'Búlgaras / zancadas mancuernas',grupo:'piernas', series_obj:3, reps_min:10, reps_max:12, rir_obj:2.5, incremento_kg:1,   unidad:'mancuerna', notas:'Reps por pierna.' },
  { dia:'B', orden:5, nombre:'Elevaciones laterales',         grupo:'hombro',  series_obj:3, reps_min:12, reps_max:15, rir_obj:1.5, incremento_kg:1,   unidad:'mancuerna' },
  { dia:'B', orden:6, nombre:'Curl martillo + ext. tríceps',  grupo:'brazo',   series_obj:2, reps_min:10, reps_max:12, rir_obj:1.5, incremento_kg:1,   unidad:'mancuerna' },
];

const SEED_PROFILE = {
  nombre:'Diego', edad:31, estatura_cm:171, objetivo:'recomposicion',
  experiencia:'principiante', kcal_objetivo:2400, proteina_g:140,
  notas:'Recomposición de principiante. Lesión leve pulgar derecho: cuidar agarre en tirones.'
};
