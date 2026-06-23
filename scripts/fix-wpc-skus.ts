/**
 * fix-wpc-skus.ts
 * Migración ONE-TIME: corrige 7 productos con prefijo incorrecto PWPCEXT → PWPCE.
 * Ejecutar: npx ts-node --project tsconfig.json scripts/fix-wpc-skus.ts
 *
 * ADVERTENCIA: Ejecutar SOLO UNA VEZ en staging primero.
 */

import * as admin from 'firebase-admin';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

const WRONG_PREFIX = 'PWPCEXT';
const CORRECT_PREFIX = 'PWPCE';

// SKUs a migrar (identificados en el análisis del inventario real)
const SKUS_TO_FIX = [
  'PWPCEXT1001',
  'PWPCEXT1002',
  'PWPCEXT1003',
  'PWPCEXT1004',
  'PWPCEXT1005',
  'PWPCEXT1006',
  'PWPCEXT1007',
];

async function main() {
  // Inicialización con Application Default Credentials
  admin.initializeApp();
  const db = getFirestore();

  console.log(`🔍 Iniciando migración: ${WRONG_PREFIX} → ${CORRECT_PREFIX}`);
  console.log(`📦 SKUs a migrar: ${SKUS_TO_FIX.length}`);

  const batch: WriteBatch = db.batch();
  let migrated = 0;

  for (const wrongSku of SKUS_TO_FIX) {
    const wrongRef = db.collection('catalogProducts').doc(wrongSku);
    const snap     = await wrongRef.get();

    if (!snap.exists) {
      console.warn(`⚠️  ${wrongSku} no existe — omitiendo.`);
      continue;
    }

    const data          = snap.data()!;
    const correctSku    = wrongSku.replace(WRONG_PREFIX, CORRECT_PREFIX);
    const correctRef    = db.collection('catalogProducts').doc(correctSku);

    // Crear nuevo documento con SKU correcto
    batch.set(correctRef, {
      ...data,
      sku: correctSku,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Eliminar documento con SKU incorrecto
    batch.delete(wrongRef);
    migrated++;
    console.log(`  ✅ ${wrongSku} → ${correctSku}`);
  }

  if (migrated === 0) {
    console.log('✨ No hay documentos que migrar.');
    return;
  }

  await batch.commit();
  console.log(`\n🎉 Migración completada: ${migrated} SKUs actualizados atómicamente.`);
}

main().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
