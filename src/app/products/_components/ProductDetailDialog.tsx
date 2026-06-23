'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, Save, RotateCcw } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { updateProduct } from '@/lib/product-service';
import { calcPriceBase } from '@/lib/product-utils';
import { cn } from '@/lib/utils';
import { SkuBadge } from './SkuBadge';
import { CabysBadge } from './CabysBadge';
import type { CatalogProduct, ProductCategory, CabysCode, AlegraProductType, ProductOrigin } from '@/lib/types';
import { COSTA_RICA_TAXES } from './steps/Step3_Commercial';

interface ProductDetailDialogProps {
  open: boolean;
  onClose: () => void;
  product: CatalogProduct | null;
  categories: ProductCategory[];
  cabysOptions: CabysCode[];
  isAdmin: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  'fe':      'INV',
  'no-inv':  'NO-INV',
  'service': 'SRV',
};

const TYPE_STYLE: Record<string, string> = {
  'fe':      'bg-blue-50 text-blue-700 border border-blue-200',
  'no-inv':  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'service': 'bg-orange-50 text-orange-700 border border-orange-200',
};

export function ProductDetailDialog({
  open,
  onClose,
  product,
  categories,
  cabysOptions,
  isAdmin,
}: ProductDetailDialogProps) {
  const db = useFirestore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [alegraProductType, setAlegraProductType] = useState<AlegraProductType>('fe');
  const [cabys, setCabys] = useState('');
  const [origin, setOrigin] = useState<ProductOrigin>('imported');
  const [subSeries, setSubSeries] = useState<string | undefined>(undefined);
  const [priceCost, setPriceCost] = useState(0);
  const [priceTotal, setPriceTotal] = useState(0);
  const [unit, setUnit] = useState('Unidad');
  const [taxPercentage, setTaxPercentage] = useState(13);
  const [taxName, setTaxName] = useState('IVA');

  // Load values when product changes
  useEffect(() => {
    if (product) {
      setDescription(product.description ?? '');
      setCategoryId(product.category_id);
      setAlegraProductType(product.alegra_product_type);
      setCabys(product.cabys);
      setOrigin(product.origin);
      setSubSeries(product.sub_series);
      setPriceCost(product.price_cost ?? 0);
      setPriceTotal(product.price_total);
      setUnit(product.unit);
      setTaxPercentage(product.tax_percentage ?? 13);
      setTaxName(product.tax_name ?? 'IVA');
      setIsEditing(false);
    }
  }, [product, open]);

  if (!product) return null;

  const activeCategory = categories.find(c => c.id === categoryId);

  // Handle product type change to set default unit
  const handleTypeChange = (type: AlegraProductType) => {
    setAlegraProductType(type);
    if (type === 'service') {
      setUnit('Servicios Profesionales');
    } else {
      setUnit('Unidad');
    }
  };

  const handleSave = async () => {
    if (priceTotal <= 0) {
      alert('El precio total debe ser mayor a 0');
      return;
    }
    if (!cabys) {
      alert('El código CABYS es requerido');
      return;
    }
    if (!categoryId) {
      alert('La categoría es requerida');
      return;
    }

    setIsSaving(true);
    try {
      const priceBase = calcPriceBase(priceTotal, taxPercentage);
      const categoryName = categories.find(c => c.id === categoryId)?.name || '';

      await updateProduct(db, product.sku, {
        description: description || undefined,
        category_id: categoryId,
        category_name: categoryName,
        alegra_product_type: alegraProductType,
        cabys,
        origin,
        sub_series: subSeries || undefined,
        price_cost: priceCost || 0,
        price_total: priceTotal,
        price_base: priceBase,
        unit,
        tax_name: taxName,
        tax_percentage: taxPercentage,
      });

      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error('Error al actualizar el producto:', error);
      alert('Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const priceFormatted = product.price_total.toLocaleString('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  });

  const costFormatted = (product.price_cost ?? 0).toLocaleString('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {isEditing ? 'Editar Producto' : 'Detalles del Producto'}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {product.sku}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[70vh] flex flex-col gap-4">
                {/* Nombre (Siempre Read-Only) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre</label>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground font-semibold">
                    {product.name}
                  </div>
                  <span className="text-[10px] text-muted-foreground/80 italic">El nombre no se puede editar</span>
                </div>

                {/* SKU (Siempre Read-Only) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">SKU</label>
                    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-mono text-foreground">
                      {product.sku}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 justify-end">
                    <span className="text-[10px] text-muted-foreground/80 italic mb-1.5">El SKU no se puede editar</span>
                  </div>
                </div>

                {isEditing ? (
                  /* ── EDIT MODE ── */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Categoría */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Categoría</label>
                        <select
                          value={categoryId}
                          onChange={e => setCategoryId(e.target.value)}
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value="">Seleccione...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Tipo de Producto */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Tipo</label>
                        <select
                          value={alegraProductType}
                          onChange={e => handleTypeChange(e.target.value as AlegraProductType)}
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value="fe">INV (Inventariable)</option>
                          <option value="no-inv">NO-INV</option>
                          <option value="service">SRV (Servicio)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Origen */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Origen</label>
                        <select
                          value={origin}
                          onChange={e => setOrigin(e.target.value as ProductOrigin)}
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value="imported">Importado China</option>
                          <option value="local">Proveedor Local CR</option>
                        </select>
                      </div>

                      {/* Sub-series */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Sub-serie</label>
                        <input
                          type="text"
                          value={subSeries ?? ''}
                          onChange={e => setSubSeries(e.target.value || undefined)}
                          placeholder="Ninguna"
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* CABYS */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Código CABYS</label>
                      <select
                        value={cabys}
                        onChange={e => setCabys(e.target.value)}
                        className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500 max-w-full"
                      >
                        <option value="">Seleccione...</option>
                        {cabysOptions.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={cn("grid gap-3", alegraProductType === 'service' ? "grid-cols-2" : "grid-cols-3")}>
                      {/* Precio Costo */}
                      {alegraProductType !== 'service' && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Costo (₡)</label>
                          <input
                            type="number"
                            value={priceCost}
                            onChange={e => setPriceCost(Math.max(0, Number(e.target.value)))}
                            className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}

                      {/* Precio Venta Total */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Venta (₡)</label>
                        <input
                          type="number"
                          value={priceTotal}
                          onChange={e => setPriceTotal(Math.max(0, Number(e.target.value)))}
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Tipo de IVA */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">IVA</label>
                        <select
                          value={`${taxName}:${taxPercentage}`}
                          onChange={e => {
                            const [name, pctStr] = e.target.value.split(':');
                            setTaxName(name);
                            setTaxPercentage(parseFloat(pctStr) || 0);
                          }}
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          {COSTA_RICA_TAXES.map((tax, i) => (
                            <option key={i} value={`${tax.name}:${tax.value}`}>
                              {tax.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Unidad */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Unidad</label>
                      <select
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      >
                        <option value="Unidad">Unidad</option>
                        <option value="Servicios Profesionales">Servicios Profesionales</option>
                        <option value="Metro">Metro</option>
                        <option value="Caja">Caja</option>
                      </select>
                    </div>

                    {/* Descripción */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Descripción</label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        placeholder="Descripción opcional..."
                        className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>
                  </>
                ) : (
                  /* ── VIEW MODE ── */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Categoría */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Categoría</span>
                        <span className="text-sm font-medium text-foreground">
                          {product.category_name || 'Sin Categoría'}
                        </span>
                      </div>

                      {/* Tipo */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Tipo</span>
                        <div className="flex">
                          <span className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
                            TYPE_STYLE[product.alegra_product_type],
                          )}>
                            {TYPE_LABEL[product.alegra_product_type]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Origen */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Origen</span>
                        <span className="text-sm text-foreground">
                          <SkuBadge sku={product.sku} origin={product.origin} className="border-none p-0 bg-transparent" />
                        </span>
                      </div>

                      {/* Sub-series */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Sub-serie</span>
                        <span className="text-sm text-foreground">
                          {product.sub_series !== undefined ? `Serie ${product.sub_series}` : 'Ninguna'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* CABYS */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Código CABYS</span>
                        <div>
                          <CabysBadge code={product.cabys} description={cabysOptions.find(o => o.code === product.cabys)?.description} />
                        </div>
                      </div>

                      {/* Unidad */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Unidad</span>
                        <span className="text-sm text-foreground">{product.unit || 'Unidad'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {/* Precio Costo */}
                      {product.alegra_product_type !== 'service' && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">Precio Costo</span>
                          <span className="text-sm font-semibold text-foreground">{costFormatted}</span>
                        </div>
                      )}

                      {/* Precio Venta Total */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Precio Venta</span>
                        <span className="text-sm font-bold text-emerald-600">{priceFormatted}</span>
                      </div>

                      {/* Tipo de IVA */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Tipo de IVA</span>
                        <span className="text-sm font-medium text-foreground">
                          {product.tax_percentage !== undefined ? `${product.tax_percentage}% (${product.tax_name})` : '13% (IVA)'}
                        </span>
                      </div>
                    </div>

                    {/* Descripción */}
                    {product.description && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Descripción</span>
                        <p className="text-sm text-muted-foreground bg-muted/20 rounded-xl p-3 border border-border">
                          {product.description}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/10 px-6 py-4">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={onClose}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      Cerrar
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
