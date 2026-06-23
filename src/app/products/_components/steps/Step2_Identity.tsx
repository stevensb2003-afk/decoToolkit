'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateNextSku,
  validateSkuFormat,
  detectSkuGap,
  getNameSuggestions,
  isNameDuplicate,
} from '@/lib/product-utils';
import type { ProductCategory, CatalogProduct, ProductOrigin, AlegraProductType, SubSeries } from '@/lib/types';

// Step2Data now includes category/origin/sub_series (moved from Step1)
export interface Step2Data {
  name: string;
  sku: string;
  description: string;
  category_id: string;
  origin: ProductOrigin;
  sub_series?: string;
}

interface Step2Props {
  value: Step2Data;
  onChange: (data: Step2Data) => void;
  categories: ProductCategory[];
  alegraProductType: AlegraProductType;
  existingProducts: CatalogProduct[];
  skuExists: boolean;
}

const ORIGINS: { value: ProductOrigin; label: string }[] = [
  { value: 'imported', label: 'Importado China' },
  { value: 'local',    label: 'Proveedor Local CR' },
];

export function Step2Identity({
  value, onChange, categories, alegraProductType, existingProducts, skuExists,
}: Step2Props) {
  function set(patch: Partial<Step2Data>) {
    onChange({ ...value, ...patch });
  }

  const getSuggestedSkuFor = (catId: string, origin: ProductOrigin, subSeries?: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return '';
    const seriesKey = `${origin}_${subSeries ?? '000'}`;
    const last = cat.sku_series[seriesKey]?.last_consecutive ?? 0;
    return generateNextSku(cat.sku_prefix, origin, subSeries, last);
  };

  // Filter categories: show only service categories for 'service' products, and all other categories for 'fe' or 'no-inv' products.
  const filteredCategories = useMemo(
    () => {
      if (alegraProductType === 'service') {
        return categories.filter(c => c.alegra_product_type === 'service');
      } else {
        return categories.filter(c => c.alegra_product_type !== 'service');
      }
    },
    [categories, alegraProductType],
  );

  const selectedCat = useMemo(
    () => filteredCategories.find(c => c.id === value.category_id),
    [filteredCategories, value.category_id],
  );

  const suggestedSku = useMemo(() => {
    if (!selectedCat) return '';
    const seriesKey = `${value.origin}_${value.sub_series ?? '000'}`;
    const last = selectedCat.sku_series[seriesKey]?.last_consecutive ?? 0;
    return generateNextSku(selectedCat.sku_prefix, value.origin, value.sub_series, last);
  }, [selectedCat, value.origin, value.sub_series]);

  // Auto-fill SKU when category/origin/sub_series changes and SKU is empty
  useEffect(() => {
    if (suggestedSku && !value.sku) set({ sku: suggestedSku });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedSku]);

  // Reset category when it doesn't match filtered list
  useEffect(() => {
    if (value.category_id && !filteredCategories.find(c => c.id === value.category_id)) {
      set({ category_id: '', sku: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alegraProductType]);

  const skuValidation  = selectedCat ? validateSkuFormat(value.sku, selectedCat.sku_prefix, value.origin) : null;
  const hasGap         = value.sku && suggestedSku ? detectSkuGap(value.sku, suggestedSku) : false;
  const nameDuplicate  = isNameDuplicate(value.name, existingProducts);
  const suggestions    = getNameSuggestions(value.name, existingProducts);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Categoría ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Categoría
        </label>
        <select
          value={value.category_id}
          onChange={e => {
            const catId = e.target.value;
            const nextSku = getSuggestedSkuFor(catId, value.origin, undefined);
            onChange({ ...value, category_id: catId, sub_series: undefined, sku: nextSku });
          }}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Selecciona una categoría</option>
          {filteredCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.sku_prefix})</option>
          ))}
        </select>
      </div>

      {/* ── Sub-serie (si aplica) ── */}
      {selectedCat?.has_sub_series && selectedCat.sub_series && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tipo / Tamaño
          </label>
          <select
            value={value.sub_series ?? ''}
            onChange={e => {
              const subSeries = e.target.value || undefined;
              const nextSku = getSuggestedSkuFor(value.category_id, value.origin, subSeries);
              onChange({ ...value, sub_series: subSeries, sku: nextSku });
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Sin sub-tipo</option>
            {selectedCat.sub_series.map((s: SubSeries) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Origen ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Origen del Producto
        </label>
        <select
          value={value.origin}
          onChange={e => {
            const nextOrigin = e.target.value as ProductOrigin;
            const nextSku = getSuggestedSkuFor(value.category_id, nextOrigin, value.sub_series);
            onChange({ ...value, origin: nextOrigin, sku: nextSku });
          }}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
        >
          {ORIGINS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Nombre ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Nombre del Producto
        </label>
        <input
          type="text"
          value={value.name}
          onChange={e => onChange({ ...value, name: e.target.value.toUpperCase() })}
          placeholder="LÁMINA PVC 3m - ..."
          className={cn(
            'w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-medium text-foreground uppercase outline-none transition-colors placeholder:text-muted-foreground/40 placeholder:normal-case',
            nameDuplicate
              ? 'border-destructive focus:border-destructive'
              : 'border-input focus:border-primary',
          )}
        />
        {nameDuplicate && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" />
            Este nombre ya está registrado en el catálogo.
          </p>
        )}
        {/* Sugerencias de nomenclatura */}
        {suggestions.length > 0 && !nameDuplicate && (
          <div className="rounded-lg border border-border bg-muted/50 p-2">
            <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Nombres similares (clic para copiar):
            </p>
            <div className="flex flex-col gap-1">
              {suggestions.map(p => (
                <button
                  key={p.sku}
                  onClick={() => set({ name: p.name })}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-background transition-colors border border-transparent hover:border-border"
                >
                  <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-muted-foreground mr-1">{p.sku}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SKU ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            SKU
          </label>
          {suggestedSku && (
            <button
              onClick={() => set({ sku: suggestedSku })}
              className="text-[10px] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Usar sugerido: {suggestedSku}
            </button>
          )}
        </div>
        <input
          type="text"
          value={value.sku}
          onChange={e => set({ sku: e.target.value.toUpperCase() })}
          className={cn(
            'w-full rounded-lg border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none transition-colors',
            skuExists || skuValidation?.error
              ? 'border-destructive focus:border-destructive'
              : skuValidation?.warning || hasGap
              ? 'border-amber-400 focus:border-amber-500'
              : value.sku
              ? 'border-emerald-400 focus:border-emerald-500'
              : 'border-input focus:border-primary',
          )}
        />
        {skuExists && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" /> SKU ya existe en el catálogo.
          </p>
        )}
        {!skuExists && skuValidation?.error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" /> {skuValidation.error}
          </p>
        )}
        {!skuExists && !skuValidation?.error && (skuValidation?.warning || hasGap) && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {skuValidation?.warning ?? `Hay un hueco: se esperaba ${suggestedSku}`}
          </p>
        )}
        {!skuExists && skuValidation?.valid && !skuValidation?.warning && !hasGap && value.sku && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> SKU válido y en secuencia.
          </p>
        )}
      </div>

      {/* ── Descripción ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Descripción (opcional)
        </label>
        <textarea
          value={value.description}
          onChange={e => set({ description: e.target.value })}
          rows={3}
          placeholder="Ej: Medidas: 3.00m x 1.22m x 2.8mm"
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground/40"
        />
      </div>
    </div>
  );
}
