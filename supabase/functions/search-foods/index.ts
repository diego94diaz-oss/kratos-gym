import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { searchParams } = new URL(req.url);
  const term = searchParams.get('q')?.trim();
  const barcode = searchParams.get('barcode')?.trim();

  if (!term && !barcode) {
    return new Response(JSON.stringify({ error: 'Falta q o barcode' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  try {
    let result;
    if (barcode) {
      const r = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,code,nutriments,serving_quantity`,
        { headers: { 'User-Agent': 'KratosGym/1.0' } }
      );
      const j = await r.json();
      result = j.status === 1 && j.product ? [mapProduct(j.product, barcode)] : [];
    } else {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term!)}`
        + `&search_simple=1&action=process&json=1&page_size=24`
        + `&fields=product_name,brands,code,nutriments,serving_quantity`;
      const r = await fetch(url, { headers: { 'User-Agent': 'KratosGym/1.0' } });
      const j = await r.json();
      result = (j.products || []).map((p: any) => mapProduct(p)).filter((p: any) => p.kcal_100 != null && p.nombre !== '(sin nombre)');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});

function mapProduct(p: any, fallbackCode?: string) {
  return {
    nombre: (p.product_name || '').trim() || '(sin nombre)',
    marca: (p.brands || '').split(',')[0] || '',
    barcode: p.code || fallbackCode || '',
    kcal_100: p.nutriments?.['energy-kcal_100g'] ?? null,
    prot_100: p.nutriments?.proteins_100g ?? null,
    grasa_100: p.nutriments?.fat_100g ?? null,
    carbo_100: p.nutriments?.carbohydrates_100g ?? null,
    fibra_100: p.nutriments?.fiber_100g ?? null,
    porcion_g: p.serving_quantity ? Number(p.serving_quantity) : null,
    fuente: 'off',
  };
}
