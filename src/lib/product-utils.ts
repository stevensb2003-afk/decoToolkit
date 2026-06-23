/**
 * product-utils.ts
 * Lógica pura: SKU, validación, precio. Sin dependencias de Firebase/React.
 */

import type { ProductOrigin, ProductCategory, CatalogProduct } from './types';

// ─── Constantes de Cuentas Contables ─────────────────────────────────────────
export const ACCOUNT_INCOME   = 'Ingreso por ventas de material';
export const ACCOUNT_INVENTORY = 'Inventario de mercaderia';
export const ACCOUNT_COST     = 'Costo de ventas de materiales';
export const TAX_NAME         = 'IVA';
export const TAX_PERCENTAGE   = 13;
export const UNIT_PRODUCT     = 'Unidad';
export const UNIT_SERVICE     = 'Servicios Profesionales';
export const REF_TYPE         = 'Código uso interno';

// ─── Origen → D1 digit ───────────────────────────────────────────────────────
const ORIGIN_DIGIT: Record<ProductOrigin, number> = {
  imported: 1,
  local:    2,
  beam:     5,
};

/**
 * Genera la clave del mapa sku_series dentro de productCategories.
 * Ej: imported + sub_series "200" → "imported_200"
 *     local + no sub_series      → "local_000"
 */
export function buildSkuSeriesKey(origin: ProductOrigin, subSeries?: string): string {
  const sub = subSeries || '000';
  return `${origin}_${sub}`;
}

/**
 * Genera el siguiente SKU esperado.
 * Ej: prefix="LPVC", origin="imported", subSeries="000", last=40 → "LPVC1041"
 */
export function generateNextSku(
  prefix: string,
  origin: ProductOrigin,
  subSeries: string | undefined,
  lastConsecutive: number,
): string {
  const d1   = ORIGIN_DIGIT[origin];
  const sub  = subSeries || '000';
  // D2 = segundo dígito del sub-series id (e.g. "200" → '2', "000" → '0')
  const d2   = sub === '000' ? '0' : sub[0];
  const next = String(lastConsecutive + 1).padStart(2, '0');
  return `${prefix}${d1}${d2}${next}`;
}

/** Validación rápida del formato de SKU ingresado manualmente. */
export function validateSkuFormat(
  sku: string,
  prefix: string,
  origin: ProductOrigin,
): { valid: boolean; warning?: string; error?: string } {
  if (!sku.startsWith(prefix)) {
    return { valid: false, error: `El SKU debe empezar con "${prefix}"` };
  }
  const rest = sku.slice(prefix.length);
  if (!/^\d{4}$/.test(rest)) {
    return { valid: false, error: 'El SKU debe tener exactamente 4 dígitos después del prefijo' };
  }
  const d1 = parseInt(rest[0]);
  if (d1 !== ORIGIN_DIGIT[origin]) {
    return {
      valid: true,
      warning: `El primer dígito "${d1}" no coincide con el origen seleccionado`,
    };
  }
  return { valid: true };
}

/** Detecta si el SKU propuesto tiene un hueco respecto al esperado. */
export function detectSkuGap(proposed: string, expected: string): boolean {
  return proposed !== expected;
}

/** Calcula el precio base desde el total con IVA. */
export function calcPriceBase(priceTotal: number, taxPct = TAX_PERCENTAGE): number {
  return Math.round((priceTotal / (1 + taxPct / 100)) * 100) / 100;
}

/**
 * Elimina keys con valor undefined del payload antes de escribir en Firestore.
 * Previene corrupción de documentos.
 */
export function cleanProductPayload<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Filtra y ordena productos existentes de la misma categoría
 * para mostrar como sugerencias de nomenclatura al usuario.
 */
export function getNameSuggestions(
  query: string,
  products: CatalogProduct[],
  limit = 5,
): CatalogProduct[] {
  if (!query || query.length < 3) return [];
  const q = query.toUpperCase();
  return products
    .filter(p => p.status !== 'archived' && p.name.includes(q))
    .slice(0, limit);
}

/** Verifica si un nombre ya existe en la colección local (case-insensitive trim). */
export function isNameDuplicate(name: string, products: CatalogProduct[]): boolean {
  const normalized = name.trim().toUpperCase();
  return products.some(p => p.name.trim().toUpperCase() === normalized);
}
