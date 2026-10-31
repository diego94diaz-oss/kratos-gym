// Pruebas de los cálculos. Ejecutar con: node --test tests/logic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = vm.createContext({ console, Intl, module: undefined });
const load = f => vm.runInContext(readFileSync(new URL('../js/' + f, import.meta.url), 'utf8').replace(/^const (\w+) =/gm, 'var $1 ='), box);
['library.js', 'foods.js', 'evidence.js', 'logic.js'].forEach(load);
const { Evidence: E, Logic: L, searchLocalFoods } = box;

test('IMC con categorías OMS', () => {
  assert.equal(E.bmi(74.3, 170.6), 25.5);
  assert.equal(E.bmiClass(24.9).label, 'Normal');
  assert.equal(E.bmiClass(25).label, 'Sobrepeso');
  assert.equal(E.bmiClass(30).label, 'Obesidad I');
});
test('cintura/estatura con bandas NICE NG246', () => {
  assert.equal(E.whtr(96.5, 170), 0.57);
  assert.equal(E.whtrClass(0.49).label, 'Saludable');
  assert.equal(E.whtrClass(0.5).label, 'Aumentada');
  assert.equal(E.whtrClass(0.6).label, 'Alta');
});
test('corte de cintura IDF Sudamérica', () => {
  assert.equal(E.waistClass(89.9, 'h').nivel, 'ok');
  assert.equal(E.waistClass(90, 'h').nivel, 'bad');
  assert.equal(E.waistClass(80, 'm').nivel, 'bad');
});
test('RFM es la primera estimación y Navy queda para comparar', () => {
  const r = E.bodyFat({ sexo: 'h', peso: 74, estatura_cm: 170, edad: 32, medidas: { cintura: 94, cuello: 38 } });
  assert.equal(r.metodo, 'RFM (cintura y estatura)');
  assert.equal(r.pct, +(64 - 20 * 170 / 94).toFixed(1));
  assert.ok(r.alternativas.some(a => a.metodo.startsWith('Navy')));
});
test('la edad usa el cumpleaños real', () => {
  const y = new Date().getFullYear();
  assert.equal(E.ageFrom(`${y - 30}-01-01`), 30);
  assert.equal(E.ageFrom(`${y - 30}-12-31`), new Date().getMonth() === 11 && new Date().getDate() === 31 ? 30 : 29);
});
test('objetivos: déficit limitado y proteína escalada', () => {
  const t = E.targets({ sexo: 'h', peso: 74, estatura_cm: 170.6, edad: 32, actividad: 1.45, objetivo: 'perder', magra: 58 });
  assert.equal(t.bmr, 10 * 74 + Math.round(6.25 * 170.6) - 160 + 5 + (t.bmr - (10 * 74 + Math.round(6.25 * 170.6) - 160 + 5)));
  assert.ok(t.kcal >= t.bmr && t.kcal >= t.maint * 0.75 && t.kcal < t.maint);
  assert.equal(t.prot, Math.round(Math.min(1.9 * 74, 2.5 * 58)));
  assert.equal(t.fibra >= 25, true);
  assert.equal(Math.round(E.targets({ sexo: 'h', peso: 70, estatura_cm: 175, edad: 30, objetivo: 'mantener' }).prot), 112);
});
test('las calorías de los macros cuadran con el objetivo', () => {
  const t = E.targets({ sexo: 'h', peso: 80, estatura_cm: 180, edad: 30, objetivo: 'ganar' });
  assert.ok(Math.abs(t.prot * 4 + t.grasa * 9 + t.carbo * 4 - t.kcal) < 6);
});
test('FC: Karvonen usa la de reposo si existe', () => {
  assert.equal(E.maxHR(32), 186);
  assert.equal(E.hrZones(32)[1].lo, Math.round(186 * .6));
  assert.equal(E.hrZones(32, 60)[1].lo, Math.round(60 + 126 * .6));
});
test('la fecha es local y no UTC', () => {
  const d = new Date(2026, 9, 31, 23, 30);
  assert.equal(L.dateISO(d), '2026-10-31');
  assert.equal(L.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(L.daysBetween('2026-10-30', '2026-11-01'), 2);
});
test('la rotación admite rutinas propias e ignora las sesiones libres', () => {
  const sets = [{ fecha: '2026-10-01', rutina: 'A' }, { fecha: '2026-10-03', rutina: 'Libre' }];
  assert.equal(L.nextDay(sets, ['A', 'B']), 'B');
  assert.equal(L.nextDay([{ fecha: '2026-10-01', rutina: 'Tirón' }], ['Empuje', 'Pierna', 'Tirón']), 'Empuje');
  assert.equal(L.nextDay([], ['Empuje']), 'Empuje');
  assert.equal(L.nextDay([], []), null);
});
test('Mi Salud manda en el peso y la toma en ayunas gana', () => {
  const w = L.mergeWeights([{ id: 'x', fecha: '2026-10-01', peso_kg: 70 }, { id: 'y', fecha: '2026-10-02', peso_kg: 71 }], [
    { id: 'a', tipo: 'peso', fecha: '2026-10-02', valor: 72, condicion: 'ayunas', created_at: '1' },
    { id: 'b', tipo: 'peso', fecha: '2026-10-02', valor: 73, condicion: 'otro', created_at: '2' }]);
  assert.equal(w.length, 2);
  assert.equal(w[0].origen, 'historial');
  assert.equal(w[1].peso_kg, 72);
});
test('agua suma y el dato manual gana al smartband', () => {
  const s = { med: [{ tipo: 'agua', fecha: 'd', valor: 250 }, { tipo: 'agua', fecha: 'd', valor: 500 },
    { tipo: 'sueno', fecha: 'd', valor: 7, origen: 'wearable' }, { tipo: 'sueno', fecha: 'd', valor: 6, origen: 'manual' }] };
  assert.equal(L.saludValue(s, 'agua', 'd'), 750);
  assert.equal(L.saludValue(s, 'sueno', 'd'), 6);
});
test('avisos: un peso viejo pide medir en vez de repetir consejos', () => {
  const old = L.addDays(L.todayISO(), -60), weights = [1, 2, 3, 4].map(i => ({ fecha: L.addDays(old, i - 5), peso_kg: 70 + i }));
  const a = L.buildAlerts({ sets: [], weights, foodLogs: [], profile: { objetivo: 'recomposicion' }, lastWeight: 74, now: new Date(2026, 0, 1, 9) });
  assert.ok(a.some(x => x.id.startsWith('w-old')));
  assert.ok(!a.some(x => x.id.startsWith('w-2')));
});
test('avisos: el de inactividad desaparece al registrar actividad hoy', () => {
  const t = L.todayISO(), sets = [{ fecha: L.addDays(t, -9), ejercicio: 'X', reps: 5, peso_kg: 50 }], base = { sets, weights: [], foodLogs: [], profile: {}, now: new Date(2026, 0, 1, 9) };
  assert.ok(L.buildAlerts(base).some(x => x.id.startsWith('idle')));
  assert.ok(!L.buildAlerts({ ...base, cardio: [{ fecha: t }] }).some(x => x.id.startsWith('idle')));
});
test('avisos: el descarte es por estado, cambia si la situación cambia', () => {
  const t = L.todayISO(), mk = pa => L.buildAlerts({ sets: [], weights: [], foodLogs: [], profile: {}, now: new Date(2026, 0, 1, 9),
    salud: { med: [{ tipo: 'presion', fecha: pa, sistolica: 140, diastolica: 90 }] } }).find(x => x.id.startsWith('pa-'));
  assert.notEqual(mk(t).id, mk(L.addDays(t, -1)).id);
});
test('el próximo control ignora el que ya tiene cita', () => {
  const f = L.addDays(L.todayISO(), 3);
  const p = L.nextHealthEvent({ citas: [{ fecha: f, titulo: 'Médico', control_id: 'c1' }], controles: [{ id: 'c1', fecha: f, texto: 'Control' }] });
  assert.equal(p.texto, 'Médico');
  assert.equal(p.sugerido, undefined);
});
test('discos y calentamiento', () => {
  const r = L.plates(62.5);
  assert.deepEqual([...r.out], [20, 1.25]);
  assert.equal(L.warmups(100).length, 3);
  assert.equal(L.warmups(100)[0].peso, 40);
});
test('búsqueda local tolera acentos', () => {
  assert.equal(searchLocalFoods('platano')[0].nombre, 'Plátano');
  assert.equal(searchLocalFoods('marraqueta')[0].porciones[0][1], 100);
});
test('macros con micronutrientes y reconstrucción', () => {
  const f = searchLocalFoods('lentejas')[0], m = L.macrosFor(f, 250);
  assert.equal(m.fibra, 19.8);
  assert.equal(L.foodFromLog({ nombre: 'x', gramos: 200, kcal: 100 }).kcal_100, 50);
});
test('el consejo de peso respeta el ritmo del objetivo', () => {
  const t = L.todayISO(), w = d => [18, 13, 8, 3, 0].map((n, i) => ({ fecha: L.addDays(t, -n), peso_kg: 75 + d * i }));
  const p = { objetivo: 'recomposicion', estatura_cm: 170 };
  assert.equal(L.bodyAdvice(p, w(-0.08), { cintura: 94 }).clase, 'tag-up');
  assert.equal(L.bodyAdvice(p, w(0.25), { cintura: 94 }).clase, 'tag-down');
  assert.match(L.bodyAdvice(p, w(-0.6), { cintura: 94 }).texto, /Sube/);
});
test('un peso antiguo no arrastra la tendencia', () => {
  const r = L.weightTrendSeries([{ fecha: '2026-01-01', peso_kg: 60 }, { fecha: '2026-06-01', peso_kg: 75 }]);
  assert.equal(r[1].v, 75);
});
