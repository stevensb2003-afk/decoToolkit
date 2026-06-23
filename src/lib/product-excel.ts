/**
 * product-excel.ts
 * Genera archivos Excel compatibles con las 3 plantillas de Alegra.
 * Usa SheetJS (xlsx). Sin dependencias de React.
 */

import * as XLSX from 'xlsx';
import type { CatalogProduct, AlegraProductType, ExportQueueItem } from './types';
import {
  ACCOUNT_INCOME,
  ACCOUNT_INVENTORY,
  ACCOUNT_COST,
  TAX_NAME,
  TAX_PERCENTAGE,
  UNIT_SERVICE,
  REF_TYPE,
} from './product-utils';

// ─── Headers exactos por plantilla ───────────────────────────────────────────

const HEADERS_FE = [
  'Nombre\n(Requerido)',
  'Categoría\n(Opcional)',
  'Unidad de medida\n(Requerido)',
  'Referencia\n(Opcional)',
  'Tipo de Referencia\n(Condicional)',
  'Código CABYS\n(Requerido)',
  'Cantidad Inicial en Bodega Principal\n(Requerido)',
  'Costo por Unidad\n(Requerido)',
  'Precio Total\n(Requerido)',
  'Nombre del Impuesto\n(Requerido)',
  'Porcentaje del Impuesto\n(Requerido)',
  'Precio Base\n(Automatico)',
  '¿Permitir Venta en negativo?\n(Opcional)',
  'Descripcion\n(Opcional)',
  'Cuenta de ingresos\n(Opcional)',
  'Cuenta de inventario\n(Opcional)',
  'Cuenta de costo de venta\n(Opcional)',
  'Forma Farmacéutica\n(Condicional)',
  'Registro Sanitario\n(Condicional)'
];

const HEADERS_NO_INV = [
  'Nombre\r\n(Requerido)',
  'Categoría\r\n(Opcional)',
  'Unidad de medida\r\n(Requerido)',
  'Referencia\r\n(Opcional)',
  'Tipo de Referencia\r\n(Condicional)',
  'Código CABYS\r\n(Requerido)',
  'Precio Total\r\n(Requerido)',
  'Nombre del Impuesto\r\n(Requerido)',
  'Porcentaje del Impuesto\r\n(Requerido)',
  'Precio Base\r\n(Automatico)',
  'Descripcion\r\n(Opcional)',
  'Cuenta de ingresos\r\n(Opcional)',
  'Forma Farmacéutica\r\n(Condicional)',
  'Registro Sanitario\r\n(Condicional)'
];

// ─── Builders de fila ─────────────────────────────────────────────────────────

export function buildFeRow(p: CatalogProduct, qty = 0): unknown[] {
  return [
    p.name,
    p.category_name,
    p.unit,
    p.sku,
    REF_TYPE,
    p.cabys,
    qty,               // Cantidad Inicial en Bodega Principal
    p.price_cost ?? 0, // Costo por Unidad
    p.price_total,
    p.tax_name ?? TAX_NAME,
    p.tax_percentage ?? TAX_PERCENTAGE,
    p.price_base,
    'No',
    p.description ?? '',
    ACCOUNT_INCOME,
    ACCOUNT_INVENTORY,
    ACCOUNT_COST,
    '',                // Forma Farmacéutica
    '',                // Registro Sanitario
  ];
}

export function buildNoInvRow(p: CatalogProduct): unknown[] {
  return [
    p.name,
    p.category_name,
    p.unit,
    p.sku,
    REF_TYPE,
    p.cabys,
    p.price_total,
    p.tax_name ?? TAX_NAME,
    p.tax_percentage ?? TAX_PERCENTAGE,
    p.price_base,
    p.description ?? '',
    ACCOUNT_INCOME,
    '',                // Forma Farmacéutica
    '',                // Registro Sanitario
  ];
}

export function buildServiceRow(p: CatalogProduct): unknown[] {
  return buildNoInvRow({ ...p, unit: UNIT_SERVICE });
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Genera el archivo Excel para los ítems en la cola, filtrando por tipo de plantilla.
 * La cantidad de inventario (qty) se toma del campo `quantity` de cada ExportQueueItem —
 * solo aplica para FE. Nunca se persiste en Firestore.
 */
export function exportProductsToExcel(
  queue: ExportQueueItem[],
  type: AlegraProductType,
  filename?: string,
): void {
  let headers: string[];
  let rowBuilder: (item: ExportQueueItem) => unknown[];

  if (type === 'fe') {
    headers    = HEADERS_FE;
    rowBuilder = ({ product, quantity }) => buildFeRow(product, quantity);
  } else if (type === 'service') {
    headers    = HEADERS_NO_INV;
    rowBuilder = ({ product }) => buildServiceRow(product);
  } else {
    headers    = HEADERS_NO_INV;
    rowBuilder = ({ product }) => buildNoInvRow(product);
  }

  const data = [headers, ...queue.map(rowBuilder)];
  const ws   = XLSX.utils.aoa_to_sheet(data);

  // Anchos de columna estimados
  ws['!cols'] = headers.map(() => ({ wch: 30 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');

  const typeLabel = type === 'fe' ? 'inventariable' : type === 'service' ? 'servicios' : 'no-inv';
  const name      = filename ?? `alegra-importar-${typeLabel}-${Date.now()}.xlsx`;
  XLSX.writeFile(wb, name);
}
