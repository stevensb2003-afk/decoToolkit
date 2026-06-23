/**
 * seed-inventory-products.js
 * Importa los 239 productos del inventario Excel a la colección catalogProducts.
 * Lee: moduloNuevosProductos/Alegra - Items - DecoInnova - Inventario 23-6-26.xlsx
 *
 * Ejecutar: node scripts/seed-inventory-products.js
 * Flags:
 *   --dry-run   Solo muestra qué va a importar, sin escribir en Firestore
 *   --force     Sobreescribe documentos existentes (default: omite SKUs ya existentes)
 *
 * ⚠️  Requiere firebase-admin autenticado (ADC o service account).
 */

const admin  = require('firebase-admin');
const xlsx   = require('xlsx');
const path   = require('path');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ── Args ─────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE   = process.argv.includes('--force');
const BATCH_SIZE = 400; // Firestore max = 500

// ── Inicializar Admin con SA del .env.local ───────────────────────────────────
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore();

// ── Category name → id mapping ───────────────────────────────────────────────
const CAT_ID_MAP = {
  'Adhesivos':            'adhesivos',
  'Accesorios Interior':  'accesorios_interior',
  'Accesorios Exterior':  'accesorios_exterior',
  'Eco-Fresh':            'eco_fresh',
  'Ferretería':           'ferreteria',
  'Herramientas':         'herramientas',
  'Iluminación Exterior': 'iluminacion_exterior',
  'Iluminación Interior': 'iluminacion_interior',
  'Instalaciones':        'instalaciones',
  'Láminas PVC':          'laminas_pvc',
  'Panel Piedra PU':      'panel_piedra_pu',
  'Pisos DECK':           'pisos_deck',
  'Pisos SPC':            'pisos_spc',
  'Paneles WPC':          'paneles_wpc',
  'Paneles WPC Exterior': 'paneles_wpc_exterior',
  'Servicios':            'servicios',
};

// ── Parse origin from SKU first digit ────────────────────────────────────────
function parseOrigin(sku) {
  if (!sku) return 'imported';
  const digits = sku.replace(/^[A-Z]+/, '');
  const d1 = digits[0];
  if (d1 === '2') return 'local';
  if (d1 === '5') return 'beam';
  return 'imported';
}

// ── Parse sub_series from SKU second digit (for categories that have it) ─────
function parseSubSeries(sku, catId) {
  const subserieCats = ['laminas_pvc', 'paneles_wpc', 'eco_fresh'];
  if (!subserieCats.includes(catId)) return undefined;
  if (!sku) return undefined;
  const digits = sku.replace(/^[A-Z]+/, '');
  const d2 = digits[1];
  if (!d2 || d2 === '0') return '000';
  return `${d2}00`;
}

// ── Parse alegra_product_type ─────────────────────────────────────────────────
function parseAlegraType(tipo, inventariable, catId) {
  if (tipo === 'Servicio' || catId === 'servicios' || catId === 'instalaciones') {
    return 'service';
  }
  if (inventariable === 'No') return 'no-inv';
  return 'fe';
}

// ── Parse price (comma decimal separator in some cells) ──────────────────────
function parsePrice(raw) {
  if (!raw) return 0;
  const s = raw.toString().replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

function calcPriceBase(total) {
  return Math.round((total / 1.13) * 100) / 100;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📦 Seed Inventario de Productos`);
  console.log(`   Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo lectura)' : FORCE ? '⚡ FORCE (sobreescribe)' : '✏️  Normal (omite existentes)'}\n`);

  // 1. Leer Excel
  const xlsxPath = path.join(__dirname, '../moduloNuevosProductos/Alegra - Items - DecoInnova - Inventario 23-6-26.xlsx');
  const wb   = xlsx.readFile(xlsxPath);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  console.log(`📄 Excel leído: ${rows.length - 1} filas encontradas.\n`);

  // 2. Parsear productos
  const products = [];
  const errors   = [];

  for (let i = 1; i < rows.length; i++) {
    const r   = rows[i];
    const sku  = (r[8]  || '').toString().trim();
    const name = (r[4]  || '').toString().trim().toUpperCase();
    const cabys= (r[5]  || '').toString().trim();
    const catName = (r[10] || '').toString().trim();
    const desc = (r[11] || '').toString().trim();
    const tipo = (r[0]  || '').toString().trim();
    const unit = (r[9]  || 'Unidad').toString().trim();
    const inventariable = (r[1] || '').toString().trim();
    const priceTotalRaw = r[17];
    const priceTotal    = parsePrice(priceTotalRaw);

    // Fixes: corregir prefijo PWPCEXT → PWPCE
    const correctedSku = sku.startsWith('PWPCEXT') ? sku.replace('PWPCEXT', 'PWPCE') : sku;

    // Resolve category
    let catId   = CAT_ID_MAP[catName];
    let resolvedCatName = catName;

    // Fix orphaned rows: ILINT1012 has no category in Excel → assign Iluminacion Interior
    if (!catId && correctedSku.startsWith('ILINT')) {
      catId = 'iluminacion_interior';
      resolvedCatName = 'Iluminación Interior';
    }
    // Fix: "Servicios Técnicos Especializados" with no category
    if (!catId && name.toLowerCase().includes('servicio')) {
      catId = 'servicios';
      resolvedCatName = 'Servicios';
    }

    if (!correctedSku || !name) {
      errors.push({ row: i + 1, issue: 'SKU o nombre vacío', raw: r[4] });
      continue;
    }

    if (!catId) {
      errors.push({ row: i + 1, sku: correctedSku, name, issue: `Categoría desconocida: "${catName}"` });
      // Still include product with best guess
      catId = 'adhesivos';
      resolvedCatName = catName || 'Sin categoría';
    }

    const origin     = parseOrigin(correctedSku);
    const subSeries  = parseSubSeries(correctedSku, catId);
    const alegraType = parseAlegraType(tipo, inventariable, catId);
    const priceBase  = calcPriceBase(priceTotal);

    const resolvedUnit = alegraType === 'service' ? 'Servicios Profesionales' : unit;

    products.push({
      id: correctedSku,
      sku: correctedSku,
      name,
      description: desc || undefined,
      category_id: catId,
      category_name: resolvedCatName,
      cabys,
      origin,
      sub_series: subSeries,
      tax_name: 'IVA',
      tax_percentage: 13,
      price_total: priceTotal,
      price_base: priceBase,
      unit: resolvedUnit,
      alegra_product_type: alegraType,
      status: 'active',
      createdBy: 'seed-script',
    });
  }

  console.log(`✅ Parseados: ${products.length} productos`);
  if (errors.length) {
    console.log(`⚠️  Advertencias (${errors.length}):`);
    errors.forEach(e => console.log(`   Row ${e.row}: ${e.issue}`));
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY-RUN: productos que se importarían:');
    const byType = { fe: 0, 'no-inv': 0, service: 0 };
    products.forEach(p => { byType[p.alegra_product_type]++; });
    console.log(`   FE: ${byType.fe} | NO-INV: ${byType['no-inv']} | SERVICIOS: ${byType.service}`);
    console.log('\nMuestra (primeros 5):');
    products.slice(0, 5).forEach(p =>
      console.log(`  [${p.sku}] ${p.name} | ${p.category_name} | ₡${p.price_total}`)
    );
    console.log('\n✅ DRY-RUN completado. Ejecuta sin --dry-run para importar.');
    process.exit(0);
  }

  // 3. Verificar existentes (si no es --force)
  let skipped = 0;
  let toWrite = products;

  if (!FORCE) {
    console.log('\n🔍 Verificando SKUs existentes...');
    const existingSkus = new Set();
    // Check in batches of 30 (Firestore 'in' limit)
    for (let i = 0; i < products.length; i += 30) {
      const chunk   = products.slice(i, i + 30);
      const docRefs = chunk.map(p => db.collection('catalogProducts').doc(p.id));
      const snaps   = await db.getAll(...docRefs);
      snaps.forEach(s => { if (s.exists) existingSkus.add(s.id); });
    }
    skipped = existingSkus.size;
    toWrite = products.filter(p => !existingSkus.has(p.id));
    console.log(`   Existentes (omitidos): ${skipped}`);
    console.log(`   Nuevos a importar: ${toWrite.length}\n`);
  }

  if (toWrite.length === 0) {
    console.log('✨ Nada que importar — todos los productos ya existen.');
    process.exit(0);
  }

  // 4. Escribir en Firestore con writeBatch
  console.log(`📤 Escribiendo ${toWrite.length} productos en Firestore...`);
  const now = FieldValue.serverTimestamp();
  let written = 0;

  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const chunk = toWrite.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const p of chunk) {
      const { id, ...data } = p;
      // Clean undefined values
      const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );
      batch.set(db.collection('catalogProducts').doc(id), {
        ...clean,
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  ✅ Lote ${Math.ceil((i + 1) / BATCH_SIZE)}: ${written}/${toWrite.length} productos escritos`);
  }

  console.log(`\n🎉 ¡Importación completada!`);
  console.log(`   Total importados: ${written}`);
  console.log(`   Omitidos (ya existían): ${skipped}`);
  console.log(`   Advertencias: ${errors.length}`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error en importación:', err.message || err);
  process.exit(1);
});
