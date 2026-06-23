/**
 * product-service.ts
 * CRUD Firestore para el catálogo de productos. Escrituras atómicas con writeBatch.
 */

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  increment,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import type {
  ProductCategory,
  CabysCode,
  CatalogProduct,
  ProductOrigin,
  ProductStatus,
  AlegraProductType,
} from './types';
import { buildSkuSeriesKey, cleanProductPayload } from './product-utils';

// ─── Getters ─────────────────────────────────────────────────────────────────

export async function getProductCategories(db: Firestore): Promise<ProductCategory[]> {
  try {
    const snap = await getDocs(query(collection(db, 'productCategories'), orderBy('order', 'asc')));
    return snap.docs.map(d => ({ ...(d.data() as ProductCategory), id: d.id }));
  } catch (err: any) {
    if (err?.code === 'failed-precondition') {
      const url = err?.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
      console.error('[ÍNDICE FALTANTE] productCategories:', url);
    }
    throw err;
  }
}

export async function getCabysConfig(db: Firestore): Promise<CabysCode[]> {
  const snap = await getDoc(doc(db, 'cabysConfig', 'catalog'));
  if (!snap.exists()) return [];
  return (snap.data()?.codes ?? []) as CabysCode[];
}

export async function getProductsByCategory(
  db: Firestore,
  categoryId: string,
): Promise<CatalogProduct[]> {
  try {
    const q = query(
      collection(db, 'catalogProducts'),
      where('category_id', '==', categoryId),
      where('status', '!=', 'archived'),
      orderBy('status'),
      orderBy('name', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as CatalogProduct), id: d.id }));
  } catch (err: any) {
    if (err?.code === 'failed-precondition') {
      const url = err?.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
      console.error('[ÍNDICE FALTANTE] catalogProducts por categoría:', url);
    }
    throw err;
  }
}

export async function getAllActiveProducts(db: Firestore): Promise<CatalogProduct[]> {
  try {
    const q = query(
      collection(db, 'catalogProducts'),
      where('status', '==', 'active'),
      orderBy('name', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as CatalogProduct), id: d.id }));
  } catch (err: any) {
    if (err?.code === 'failed-precondition') {
      const url = err?.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
      console.error('[ÍNDICE FALTANTE] getAllActiveProducts:', url);
    }
    throw err;
  }
}

export async function checkSkuExists(db: Firestore, sku: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'catalogProducts', sku));
  return snap.exists();
}

// ─── Escrituras ───────────────────────────────────────────────────────────────

export interface SaveProductInput {
  sku: string;
  name: string;
  description?: string;
  category_id: string;
  category_name: string;
  cabys: string;
  origin: ProductOrigin;
  sub_series?: string;
  price_total: number;
  price_base: number;
  price_cost?: number;
  unit: string;
  alegra_product_type: AlegraProductType;
  tax_name?: string;
  tax_percentage?: number;
}

/**
 * Guarda el producto y actualiza el consecutivo atómicamente (writeBatch).
 */
export async function saveProduct(
  db: Firestore,
  input: SaveProductInput,
  uid: string,
): Promise<void> {
  const now = serverTimestamp();
  const seriesKey = buildSkuSeriesKey(input.origin, input.sub_series);

  const productPayload = cleanProductPayload({
    ...input,
    tax_name: input.tax_name ?? 'IVA',
    tax_percentage: input.tax_percentage ?? 13,
    status: 'active' as ProductStatus,
    is_exported: false,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'catalogProducts', input.sku), productPayload);
  batch.update(doc(db, 'productCategories', input.category_id), {
    [`sku_series.${seriesKey}.last_consecutive`]: increment(1),
    updatedAt: now,
  });
  await batch.commit();
}

export async function updateProduct(
  db: Firestore,
  sku: string,
  data: Partial<SaveProductInput>,
): Promise<void> {
  const payload = cleanProductPayload({ ...data, updatedAt: serverTimestamp() });
  const batch = writeBatch(db);
  batch.update(doc(db, 'catalogProducts', sku), payload);
  await batch.commit();
}

export async function archiveProduct(db: Firestore, sku: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'catalogProducts', sku), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export interface SaveCategoryInput {
  name: string;
  sku_prefix: string;
  alegra_product_type: AlegraProductType;
  default_cabys: string;
  default_unit?: string;
  has_sub_series?: boolean;
}

/**
 * Verifica si ya existe una categoría con ese prefijo (case-insensitive).
 */
export async function checkSkuPrefixExists(db: Firestore, prefix: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'productCategories'), where('sku_prefix', '==', prefix.toUpperCase())));
  return !snap.empty;
}

/**
 * Crea una nueva categoría de producto en Firestore, inicializando sku_series para todos los orígenes.
 */
export async function saveProductCategory(
  db: Firestore,
  input: SaveCategoryInput,
  uid: string,
): Promise<string> {
  const now = serverTimestamp();

  // Obtener el máximo orden actual
  const allCatsSnap = await getDocs(query(collection(db, 'productCategories'), orderBy('order', 'asc')));
  const maxOrder = allCatsSnap.empty ? 0 : (allCatsSnap.docs[allCatsSnap.docs.length - 1].data().order ?? 0);

  // ID basado en el prefijo en minúsculas/underscore
  const id = input.sku_prefix.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const categoryPayload = {
    name: input.name,
    sku_prefix: input.sku_prefix.toUpperCase(),
    has_sub_series: input.has_sub_series ?? false,
    alegra_product_type: input.alegra_product_type,
    default_cabys: input.default_cabys,
    default_unit: input.default_unit ?? 'Unidad',
    order: maxOrder + 1,
    sku_series: {
      'imported_000': { last_consecutive: 0 },
      'local_000':    { last_consecutive: 0 },
      'beam_000':     { last_consecutive: 0 },
    },
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'productCategories', id), categoryPayload);
  await batch.commit();
  return id;
}
