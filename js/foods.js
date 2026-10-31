// ============================================================
//  FOODS — Alimentos comunes en Chile, disponibles sin conexión.
//  Valores aproximados por 100 g (tablas tipo USDA y etiquetas);
//  para un producto envasado, mejor escanear su código.
//  Columnas: nombre, kcal, prot, grasa, carbo, fibra, azúcar, sat, sodio mg, NOVA, porciones
// ============================================================
const FOODS_CL = [
  // Panes y cereales
  ['Marraqueta', 267, 8.6, 1.2, 55, 2.7, 2.5, 0.3, 500, 3, [['1 unidad', 100], ['1/2 unidad', 50]]],
  ['Hallulla', 300, 8.5, 6, 53, 2.5, 3, 2, 520, 3, [['1 unidad', 90]]],
  ['Pan de molde blanco', 266, 8.9, 3.3, 49, 2.7, 5, 0.7, 490, 4, [['1 rebanada', 28], ['2 rebanadas', 56]]],
  ['Pan integral', 252, 12.5, 3.5, 43, 6, 4.4, 0.7, 450, 4, [['1 rebanada', 30], ['2 rebanadas', 60]]],
  ['Pan pita / tortilla de trigo', 275, 9, 1.2, 56, 2.2, 1.3, 0.2, 530, 3, [['1 unidad', 60]]],
  ['Avena en hojuelas', 379, 13, 6.5, 68, 10, 1, 1.2, 6, 1, [['3 cucharadas', 30], ['1/2 taza', 40]]],
  ['Arroz blanco cocido', 130, 2.7, 0.3, 28, 0.4, 0, 0.1, 1, 1, [['1 taza', 160], ['1/2 taza', 80]]],
  ['Arroz integral cocido', 123, 2.7, 1, 26, 1.6, 0.4, 0.2, 4, 1, [['1 taza', 160]]],
  ['Fideos cocidos', 158, 5.8, 0.9, 31, 1.8, 0.6, 0.2, 1, 1, [['1 taza', 140], ['1 plato', 220]]],
  ['Quínoa cocida', 120, 4.4, 1.9, 21, 2.8, 0.9, 0.2, 7, 1, [['1 taza', 185]]],
  ['Papa cocida', 87, 1.9, 0.1, 20, 1.8, 0.9, 0, 4, 1, [['1 unidad mediana', 150]]],
  ['Puré de papas', 113, 2, 4.2, 17, 1.5, 1.2, 2.4, 330, 3, [['1 taza', 210]]],
  ['Camote cocido', 90, 2, 0.1, 21, 3.3, 6.5, 0, 36, 1, [['1 unidad', 130]]],
  ['Choclo cocido', 96, 3.4, 1.5, 21, 2.4, 4.5, 0.2, 1, 1, [['1 taza', 150]]],
  ['Sopaipilla', 340, 5, 16, 44, 2, 1, 3, 400, 3, [['1 unidad', 50]]],
  // Legumbres
  ['Lentejas cocidas', 116, 9, 0.4, 20, 7.9, 1.8, 0.1, 2, 1, [['1 plato', 250], ['1 taza', 200]]],
  ['Porotos cocidos', 127, 8.7, 0.5, 23, 6.4, 0.3, 0.1, 2, 1, [['1 plato', 250], ['1 taza', 180]]],
  ['Garbanzos cocidos', 164, 8.9, 2.6, 27, 7.6, 4.8, 0.3, 7, 1, [['1 plato', 250], ['1 taza', 165]]],
  // Proteínas
  ['Pechuga de pollo cocida', 165, 31, 3.6, 0, 0, 0, 1, 74, 1, [['1 presa', 150], ['1 palma', 100]]],
  ['Trutro de pollo cocido', 209, 26, 11, 0, 0, 0, 3, 90, 1, [['1 unidad', 120]]],
  ['Pavo pechuga cocida', 157, 29, 3.5, 0, 0, 0, 1, 60, 1, [['1 porción', 120]]],
  ['Carne de vacuno magra', 176, 26, 8, 0, 0, 0, 3, 60, 1, [['1 bistec', 130]]],
  ['Carne molida 10 % grasa', 217, 26, 12, 0, 0, 0, 4.7, 72, 1, [['1 porción', 120]]],
  ['Cerdo lomo cocido', 201, 28, 9, 0, 0, 0, 3.2, 60, 1, [['1 chuleta', 120]]],
  ['Salmón cocido', 206, 22, 12, 0, 0, 0, 2.5, 61, 1, [['1 filete', 150]]],
  ['Merluza cocida', 90, 18, 1.3, 0, 0, 0, 0.3, 90, 1, [['1 filete', 150]]],
  ['Reineta cocida', 110, 21, 2.5, 0, 0, 0, 0.6, 80, 1, [['1 filete', 150]]],
  ['Atún en agua (lata)', 116, 26, 1, 0, 0, 0, 0.3, 340, 3, [['1 lata escurrida', 120]]],
  ['Jurel en lata', 150, 21, 7, 0, 0, 0, 2, 380, 3, [['1/2 lata', 120]]],
  ['Huevo', 143, 12.6, 9.5, 0.7, 0, 0.4, 3.1, 142, 1, [['1 unidad', 55], ['2 unidades', 110]]],
  ['Clara de huevo', 52, 11, 0.2, 0.7, 0, 0.7, 0, 166, 1, [['1 clara', 33]]],
  ['Jamón de pavo', 110, 18, 3, 2, 0, 1, 1, 1000, 4, [['1 lámina', 20], ['2 láminas', 40]]],
  ['Vienesa', 280, 11, 25, 3, 0, 1, 9, 900, 4, [['1 unidad', 45]]],
  ['Tofu', 76, 8, 4.8, 1.9, 0.3, 0.6, 0.7, 7, 3, [['1 porción', 100]]],
  // Lácteos
  ['Leche descremada', 34, 3.4, 0.1, 5, 0, 5, 0.1, 44, 1, [['1 vaso', 200]]],
  ['Leche entera', 61, 3.2, 3.3, 4.8, 0, 5, 1.9, 43, 1, [['1 vaso', 200]]],
  ['Leche sin lactosa semidescremada', 46, 3.3, 1.5, 4.8, 0, 4.8, 1, 44, 2, [['1 vaso', 200]]],
  ['Yogur natural sin azúcar', 61, 3.5, 3.3, 4.7, 0, 4.7, 2.1, 46, 1, [['1 unidad', 125]]],
  ['Yogur griego natural', 97, 9, 5, 3.9, 0, 3.6, 3.2, 35, 1, [['1 pote', 150]]],
  ['Yogur proteico', 75, 10, 0.5, 7, 0, 4, 0.3, 50, 4, [['1 pote', 155]]],
  ['Yogur saborizado', 90, 3, 1.5, 16, 0, 14, 1, 50, 4, [['1 unidad', 125]]],
  ['Quesillo', 98, 11, 4.3, 3.4, 0, 2.7, 2.7, 330, 1, [['1 lámina', 30], ['1/2 unidad', 90]]],
  ['Queso gauda', 356, 25, 27, 2.2, 0, 2.2, 18, 820, 3, [['1 lámina', 20]]],
  ['Mantequilla', 717, 0.9, 81, 0.1, 0, 0.1, 51, 640, 2, [['1 cucharadita', 5]]],
  // Frutas
  ['Plátano', 89, 1.1, 0.3, 23, 2.6, 12, 0.1, 1, 1, [['1 unidad', 120]]],
  ['Manzana', 52, 0.3, 0.2, 14, 2.4, 10, 0, 1, 1, [['1 unidad', 180]]],
  ['Naranja', 47, 0.9, 0.1, 12, 2.4, 9, 0, 0, 1, [['1 unidad', 150]]],
  ['Mandarina', 53, 0.8, 0.3, 13, 1.8, 11, 0, 2, 1, [['1 unidad', 90]]],
  ['Pera', 57, 0.4, 0.1, 15, 3.1, 10, 0, 1, 1, [['1 unidad', 170]]],
  ['Uvas', 69, 0.7, 0.2, 18, 0.9, 16, 0.1, 2, 1, [['1 taza', 150]]],
  ['Frutillas', 32, 0.7, 0.3, 7.7, 2, 4.9, 0, 1, 1, [['1 taza', 150]]],
  ['Arándanos', 57, 0.7, 0.3, 14, 2.4, 10, 0, 1, 1, [['1/2 taza', 75]]],
  ['Kiwi', 61, 1.1, 0.5, 15, 3, 9, 0, 3, 1, [['1 unidad', 75]]],
  ['Palta', 160, 2, 15, 8.5, 6.7, 0.7, 2.1, 7, 1, [['1 cucharada', 20], ['1/2 unidad', 80]]],
  // Verduras
  ['Ensalada de lechuga', 15, 1.4, 0.2, 2.9, 1.3, 0.8, 0, 28, 1, [['1 plato', 80]]],
  ['Tomate', 18, 0.9, 0.2, 3.9, 1.2, 2.6, 0, 5, 1, [['1 unidad', 120]]],
  ['Zanahoria', 41, 0.9, 0.2, 9.6, 2.8, 4.7, 0, 69, 1, [['1 unidad', 70]]],
  ['Brócoli cocido', 35, 2.4, 0.4, 7.2, 3.3, 1.4, 0.1, 41, 1, [['1 taza', 155]]],
  ['Zapallo italiano', 17, 1.2, 0.3, 3.1, 1, 2.5, 0.1, 8, 1, [['1 unidad', 200]]],
  ['Cebolla', 40, 1.1, 0.1, 9.3, 1.7, 4.2, 0, 4, 1, [['1/2 unidad', 60]]],
  ['Pimentón', 31, 1, 0.3, 6, 2.1, 4.2, 0.1, 4, 1, [['1 unidad', 150]]],
  ['Espinaca cocida', 23, 3, 0.3, 3.8, 2.4, 0.4, 0.1, 70, 1, [['1 taza', 180]]],
  // Grasas y frutos secos
  ['Aceite de oliva', 884, 0, 100, 0, 0, 0, 14, 2, 2, [['1 cucharadita', 5], ['1 cucharada', 14]]],
  ['Almendras', 579, 21, 50, 22, 12.5, 4.4, 3.8, 1, 1, [['1 puñado', 28]]],
  ['Nueces', 654, 15, 65, 14, 6.7, 2.6, 6.1, 2, 1, [['1 puñado', 28]]],
  ['Maní sin sal', 567, 26, 49, 16, 8.5, 4, 6.8, 18, 1, [['1 puñado', 28]]],
  ['Mantequilla de maní', 588, 25, 50, 20, 6, 9, 10, 360, 3, [['1 cucharada', 16]]],
  // Platos caseros (estimación por porción típica)
  ['Cazuela de vacuno', 75, 6, 2.5, 7, 1, 1, 0.9, 200, 3, [['1 plato', 450]]],
  ['Pastel de choclo', 150, 8, 7, 14, 1.5, 4, 2.5, 260, 3, [['1 porción', 400]]],
  ['Charquicán', 95, 6, 3, 11, 2, 2, 1, 220, 3, [['1 plato', 350]]],
  ['Empanada de pino', 280, 11, 14, 27, 1.5, 2, 5, 420, 3, [['1 unidad', 220]]],
  ['Completo italiano', 250, 7.5, 15, 22, 2, 3, 4, 560, 4, [['1 unidad', 230]]],
  ['Pizza (porción)', 266, 11, 10, 33, 2.3, 3.6, 4.5, 600, 4, [['1 trozo', 110]]],
  ['Hamburguesa con pan', 254, 13, 12, 24, 1.5, 4, 4.5, 450, 4, [['1 unidad', 220]]],
  ['Papas fritas', 312, 3.4, 15, 41, 3.8, 0.3, 2.3, 210, 3, [['1 porción', 150]]],
  // Colaciones y dulces
  ['Galletas dulces', 480, 6, 20, 70, 2, 30, 8, 350, 4, [['3 unidades', 30]]],
  ['Queque', 390, 5, 18, 53, 1, 33, 5, 330, 4, [['1 trozo', 70]]],
  ['Chocolate de leche', 535, 7.6, 30, 59, 3.4, 52, 18, 79, 4, [['2 cuadros', 20]]],
  ['Chocolate 70 %', 598, 7.8, 43, 46, 11, 24, 24, 20, 3, [['2 cuadros', 20]]],
  ['Barra de cereal', 400, 6, 10, 72, 4, 28, 3, 200, 4, [['1 unidad', 25]]],
  ['Barra de proteína', 400, 30, 13, 40, 8, 5, 6, 300, 4, [['1 unidad', 50]]],
  ['Proteína en polvo (whey)', 400, 80, 7, 8, 0, 4, 3, 300, 4, [['1 scoop', 30]]],
  // Bebidas
  ['Café con leche', 24, 1.3, 1.3, 1.9, 0, 1.9, 0.8, 18, 1, [['1 taza', 200]]],
  ['Bebida azucarada', 42, 0, 0, 10.6, 0, 10.6, 0, 4, 4, [['1 vaso', 250], ['1 lata', 350]]],
  ['Bebida energética', 45, 0, 0, 11, 0, 11, 0, 40, 4, [['1 lata', 250]]],
  ['Jugo de naranja natural', 45, 0.7, 0.2, 10, 0.2, 8.4, 0, 1, 1, [['1 vaso', 200]]],
  ['Cerveza', 43, 0.5, 0, 3.6, 0, 0, 0, 4, 3, [['1 lata', 350]]],
  ['Vino', 83, 0.1, 0, 2.7, 0, 0.8, 0, 5, 3, [['1 copa', 150]]],
].map(([nombre, kcal_100, prot_100, grasa_100, carbo_100, fibra_100, azucar_100, sat_100, sodio_100, nova, porciones]) =>
  ({ nombre, kcal_100, prot_100, grasa_100, carbo_100, fibra_100, azucar_100, sat_100, sodio_100, nova, porciones,
     porcion_g: porciones[0][1], fuente: 'local' }));

// Sin acentos ni mayúsculas, para buscar "platano" o "PLÁTANO"
const foodKey = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function searchLocalFoods(term) {
  const q = foodKey(term).trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  return FOODS_CL.filter(f => { const n = foodKey(f.nombre); return words.every(w => n.includes(w)); })
    .sort((a, b) => foodKey(a.nombre).indexOf(q) - foodKey(b.nombre).indexOf(q)).slice(0, 12);
}
if (typeof module !== 'undefined') module.exports = { FOODS_CL, searchLocalFoods };
