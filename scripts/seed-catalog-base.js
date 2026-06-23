/**
 * seed-catalog-base.js
 * Seed ONE-TIME: Crea las colecciones productCategories y cabysConfig en Firestore.
 * Ejecutar: node scripts/seed-catalog-base.js
 *
 * Prerequisito: tener GOOGLE_APPLICATION_CREDENTIALS configurado o
 * estar autenticado con `firebase login` y usar el ADC.
 *
 * ⚠️  Ejecutar SOLO UNA VEZ. Si ya existen los documentos, los sobreescribe.
 */

const admin  = require('firebase-admin');
const path   = require('path');
const dotenv = require('dotenv');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ── Inicializar Firebase Admin con SA del .env.local ──────────────────────
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore();

// ── CABYS Config (34 códigos reales del inventario) ────────────────────────
const CABYS_CODES = [
  { code: '3542001010000', description: 'Adhesivos / Pegamentos' },
  { code: '3479005030200', description: 'Espumas Poliuretano' },
  { code: '3632098019900', description: 'Angulares WPC / Accesorios Plásticos' },
  { code: '2791101990100', description: 'Cintas / Tiras Decorativas' },
  { code: '4294403010000', description: 'Clips de Fijación' },
  { code: '4153202019900', description: 'Cornisas y Perfiles PVC' },
  { code: '3160099990500', description: 'Paneles WPC / Revestimiento Madera' },
  { code: '4291401000000', description: 'Herramientas de Corte' },
  { code: '4292199991200', description: 'Herramientas de Instalación' },
  { code: '4715002000000', description: 'Tiras y Cintas LED' },
  { code: '4612199000100', description: 'Transformadores Eléctricos' },
  { code: '4621500000100', description: 'Conectores LED / Eléctricos' },
  { code: '4294201009900', description: 'Cables Eléctricos' },
  { code: '4153202010100', description: 'Rieles y Perfiles de Fijación' },
  { code: '4299203999900', description: 'Accesorios de Instalación Genéricos' },
  { code: '3633099999900', description: 'Láminas PVC Decorativas' },
  { code: '3639099030000', description: 'Paneles Bambú / Madera / 3D' },
  { code: '3511004000100', description: 'Selladores / Duretan / Silicón' },
  { code: '4299503990000', description: 'Clips WPC Genéricos' },
  { code: '4294401039900', description: 'Tornillos y Ferretería General' },
  { code: '4299902990700', description: 'Bases y Soportes' },
  { code: '4128400000200', description: 'Estructuras Metálicas' },
  { code: '3711601990100', description: 'Espejos con Iluminación' },
  { code: '3121900000000', description: 'Molduras / Cuartos Redondos' },
  { code: '4653101000200', description: 'Apagadores / Tomacorrientes' },
  { code: '4299201029900', description: 'Cerraduras / Llavines' },
  { code: '3757001020200', description: 'Láminas Fibrolit' },
  { code: '3753001000100', description: 'Láminas Gypsum' },
  { code: '3691000009900', description: 'Pisos DECK Madera/Composite' },
  { code: '2722099009900', description: 'Pisos SPC / Vinílico' },
  { code: '8853700000000', description: 'Servicio de Corte' },
  { code: '6511900009900', description: 'Servicio de Transporte' },
  { code: '5429000000000', description: 'Servicio de Instalación' },
  { code: '5469900000000', description: 'Servicios Técnicos Especializados' },
];

// ── Categorías con SKU series calculadas del inventario real ───────────────
// sku_series format: { "[origin]_[subseries]": { last_consecutive: N } }
// origin: imported=1xxx, local=2xxx, beam=5xxx
// subseries: "000" = sin subserie; "100","200","300" = con subserie
const CATEGORIES = [
  {
    id: 'adhesivos',
    name: 'Adhesivos',
    sku_prefix: 'ADH',
    has_sub_series: false,
    alegra_product_type: 'fe',
    default_cabys: '3542001010000',
    default_unit: 'Unidad',
    order: 1,
    sku_series: {
      'imported_000': { last_consecutive: 3 },
      'local_000':    { last_consecutive: 2 },
    },
  },
  {
    id: 'accesorios_interior',
    name: 'Accesorios Interior',
    sku_prefix: 'AINT',
    has_sub_series: false,
    alegra_product_type: 'no-inv',
    default_cabys: '3632098019900',
    default_unit: 'Unidad',
    order: 2,
    sku_series: {
      'imported_000': { last_consecutive: 27 },
      'local_000':    { last_consecutive: 12 },
      'beam_000':     { last_consecutive: 1 },
    },
  },
  {
    id: 'accesorios_exterior',
    name: 'Accesorios Exterior',
    sku_prefix: 'AEXT',
    has_sub_series: false,
    alegra_product_type: 'no-inv',
    default_cabys: '4299503990000',
    default_unit: 'Unidad',
    order: 3,
    sku_series: {
      'imported_000': { last_consecutive: 2 },
      'local_000':    { last_consecutive: 1 },
      'imported_100': { last_consecutive: 1 },
    },
  },
  {
    id: 'eco_fresh',
    name: 'Eco-Fresh',
    sku_prefix: 'ECOF',
    has_sub_series: true,
    sub_series: [
      { id: '100', label: 'Eco-Fresh Tipo 1', digit: 1 },
      { id: '200', label: 'Eco-Fresh Tipo 2', digit: 2 },
      { id: '300', label: 'Eco-Fresh Tipo 3', digit: 3 },
    ],
    alegra_product_type: 'no-inv',
    default_cabys: '4299902990700',
    default_unit: 'Unidad',
    order: 4,
    sku_series: {
      'local_100': { last_consecutive: 2 },
      'local_200': { last_consecutive: 2 },
      'local_300': { last_consecutive: 5 },
    },
  },
  {
    id: 'ferreteria',
    name: 'Ferretería',
    sku_prefix: 'FER',
    has_sub_series: false,
    alegra_product_type: 'no-inv',
    default_cabys: '4294401039900',
    default_unit: 'Unidad',
    order: 5,
    sku_series: {
      'imported_000': { last_consecutive: 1 },
      'local_000':    { last_consecutive: 15 },
    },
  },
  {
    id: 'herramientas',
    name: 'Herramientas',
    sku_prefix: 'HER',
    has_sub_series: false,
    alegra_product_type: 'no-inv',
    default_cabys: '4291401000000',
    default_unit: 'Unidad',
    order: 6,
    sku_series: {
      'imported_000': { last_consecutive: 1 },
      'local_000':    { last_consecutive: 1 },
    },
  },
  {
    id: 'iluminacion_exterior',
    name: 'Iluminación Exterior',
    sku_prefix: 'ILEXT',
    has_sub_series: false,
    alegra_product_type: 'fe',
    default_cabys: '4715002000000',
    default_unit: 'Unidad',
    order: 7,
    sku_series: {
      'imported_000': { last_consecutive: 2 },
    },
  },
  {
    id: 'iluminacion_interior',
    name: 'Iluminación Interior',
    sku_prefix: 'ILINT',
    has_sub_series: false,
    alegra_product_type: 'fe',
    default_cabys: '4715002000000',
    default_unit: 'Unidad',
    order: 8,
    sku_series: {
      'imported_000': { last_consecutive: 13 },
    },
  },
  {
    id: 'instalaciones',
    name: 'Instalaciones',
    sku_prefix: 'INST',
    has_sub_series: false,
    alegra_product_type: 'service',
    default_cabys: '4299203999900',
    default_unit: 'Servicios Profesionales',
    order: 9,
    sku_series: {
      'imported_000': { last_consecutive: 1 },
    },
  },
  {
    id: 'laminas_pvc',
    name: 'Láminas PVC',
    sku_prefix: 'LPVC',
    has_sub_series: true,
    sub_series: [
      { id: '000', label: 'PVC 2.80m', digit: 0 },
      { id: '100', label: 'PVC 2.44m', digit: 1 },
      { id: '200', label: 'PVC 3.00m', digit: 2 },
    ],
    alegra_product_type: 'fe',
    default_cabys: '3633099999900',
    default_unit: 'Unidad',
    order: 10,
    sku_series: {
      'imported_000': { last_consecutive: 40 },
      'imported_100': { last_consecutive: 5 },
      'imported_200': { last_consecutive: 1 },
      'local_000':    { last_consecutive: 1 },
    },
  },
  {
    id: 'panel_piedra_pu',
    name: 'Panel Piedra PU',
    sku_prefix: 'PPU',
    has_sub_series: false,
    alegra_product_type: 'fe',
    default_cabys: '3639099030000',
    default_unit: 'Unidad',
    order: 11,
    sku_series: {
      'imported_000': { last_consecutive: 8 },
      'local_000':    { last_consecutive: 2 },
    },
  },
  {
    id: 'pisos_deck',
    name: 'Pisos DECK',
    sku_prefix: 'PDECK',
    has_sub_series: false,
    alegra_product_type: 'fe',
    default_cabys: '3691000009900',
    default_unit: 'Unidad',
    order: 12,
    sku_series: {
      'imported_000': { last_consecutive: 7 },
    },
  },
  {
    id: 'pisos_spc',
    name: 'Pisos SPC',
    sku_prefix: 'PSPC',
    has_sub_series: false,
    alegra_product_type: 'fe',
    default_cabys: '2722099009900',
    default_unit: 'Unidad',
    order: 13,
    sku_series: {
      'imported_000': { last_consecutive: 15 },
      'local_000':    { last_consecutive: 2 },
    },
  },
  {
    id: 'paneles_wpc',
    name: 'Paneles WPC',
    sku_prefix: 'PWPC',
    has_sub_series: true,
    sub_series: [
      { id: '100', label: 'WPC 15cm', digit: 1 },
      { id: '200', label: 'WPC 16cm', digit: 2 },
      { id: '300', label: 'WPC 19cm', digit: 3 },
      { id: '400', label: 'WPC Otro', digit: 4 },
    ],
    alegra_product_type: 'fe',
    default_cabys: '3160099990500',
    default_unit: 'Unidad',
    order: 14,
    sku_series: {
      'imported_100': { last_consecutive: 7 },
      'imported_200': { last_consecutive: 10 },
      'imported_300': { last_consecutive: 5 },
      'imported_400': { last_consecutive: 1 },
      'local_000':    { last_consecutive: 19 },
      'beam_000':     { last_consecutive: 5 },
    },
  },
  {
    id: 'paneles_wpc_exterior',
    name: 'Paneles WPC Exterior',
    sku_prefix: 'PWPCE',
    has_sub_series: false,
    alegra_product_type: 'fe',
    default_cabys: '3160099990500',
    default_unit: 'Unidad',
    order: 15,
    sku_series: {
      'imported_000': { last_consecutive: 10 },
      'local_000':    { last_consecutive: 4 },
      'beam_000':     { last_consecutive: 3 },
    },
  },
  {
    id: 'servicios',
    name: 'Servicios',
    sku_prefix: 'SRV',
    has_sub_series: false,
    alegra_product_type: 'service',
    default_cabys: '5429000000000',
    default_unit: 'Servicios Profesionales',
    order: 16,
    sku_series: {
      'local_000': { last_consecutive: 3 },
    },
  },
];

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Iniciando seed de catálogo base...\n');

  // 1. Seed productCategories
  console.log('📁 Creando productCategories...');
  let catBatch = db.batch();
  let catCount = 0;
  for (const cat of CATEGORIES) {
    const { id, ...data } = cat;
    const ref = db.collection('productCategories').doc(id);
    catBatch.set(ref, {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    catCount++;
    console.log(`  ✅ ${id} — ${data.name} (${data.sku_prefix})`);
  }
  await catBatch.commit();
  console.log(`\n✓ ${catCount} categorías creadas.\n`);

  // 2. Seed cabysConfig
  console.log('🔢 Creando cabysConfig/catalog...');
  await db.collection('cabysConfig').doc('catalog').set({
    codes: CABYS_CODES,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ ${CABYS_CODES.length} códigos CABYS guardados.\n`);

  console.log('🎉 Seed base completado exitosamente.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
