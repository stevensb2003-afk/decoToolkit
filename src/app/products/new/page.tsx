'use client';

/**
 * /products/new/page.tsx
 * Pantalla de creación continua de productos (split-screen).
 * Izquierda: formulario paso a paso con referencia.
 * Derecha: lista de productos creados en la sesión.
 *
 * Paso 1 → solo selecciona el tipo de producto (AlegraProductType).
 * Paso 2 → categoría, origen, sub-serie, nombre y SKU del producto.
 * Paso 3 → datos comerciales (CABYS, precio).
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, RefreshCw, Download,
  ShoppingCart, ChevronLeft, ChevronRight, BookCopy,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useFirestore, useUser } from '@/firebase';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { useProductCatalog } from '@/hooks/useProductCatalog';
import { saveProduct, checkSkuExists, getAllActiveProducts } from '@/lib/product-service';
import { calcPriceBase, isNameDuplicate } from '@/lib/product-utils';
import { Header } from '@/components/layout/header';
import { Step1TypeOrigin, type Step1Data } from '../_components/steps/Step1_TypeOrigin';
import { Step2Identity, type Step2Data } from '../_components/steps/Step2_Identity';
import { Step3Commercial, type Step3Data } from '../_components/steps/Step3_Commercial';
import { ReferenceProductDialog } from '../_components/ReferenceProductDialog';
import type { CatalogProduct, AlegraProductType } from '@/lib/types';
import { exportProductsToExcel } from '@/lib/product-excel';

// ── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_S1: Step1Data = { alegra_product_type: 'fe' };
const DEFAULT_S2: Step2Data = {
  name: '', sku: '', description: '',
  category_id: '', origin: 'imported', sub_series: undefined,
};
const DEFAULT_S3: Step3Data = { cabys: '', price_total: 0, price_cost: 0, tax_percentage: 13, tax_name: 'IVA', quantity: 0 };

const STEP_LABELS = ['Tipo de Producto', 'Datos del Producto'];

const TYPE_BADGE: Record<AlegraProductType, string> = {
  'fe':      'bg-blue-100 text-blue-700',
  'no-inv':  'bg-emerald-100 text-emerald-700',
  'service': 'bg-orange-100 text-orange-700',
};
const TYPE_LABEL: Record<AlegraProductType, string> = {
  'fe': 'INV', 'no-inv': 'NO-INV', 'service': 'SVC',
};
const SESSION_TYPE_LABEL: Record<AlegraProductType, string> = {
  'fe':      'Inventariables',
  'no-inv':  'No Inventariables',
  'service': 'Servicios',
};

export default function NewProductPage() {
  const router   = useRouter();
  const db       = useFirestore();
  const { user } = useUser();
  const catalog  = useProductCatalog();

  const [step, setStep] = useState(0);
  const [s1, setS1]     = useState<Step1Data>(DEFAULT_S1);
  const [s2, setS2]     = useState<Step2Data>(DEFAULT_S2);
  const [s3, setS3]     = useState<Step3Data>(DEFAULT_S3);

  const [skuExists, setSkuExists] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [refOpen, setRefOpen]     = useState(false);
  const [allProducts, setAllProducts]   = useState<CatalogProduct[]>([]);
  const [sessionItems, setSessionItems] = useState<CatalogProduct[]>([]);

  // Load all active products once for reference dialog + duplicate name check
  useEffect(() => {
    getAllActiveProducts(db).then(setAllProducts).catch(() => {});
  }, [db]);

  // Derived: category for current s2 selection
  const category     = useMemo(() => catalog.categories.find(c => c.id === s2.category_id), [catalog.categories, s2.category_id]);
  const categoryName = category?.name ?? '';

  // Products in same category for duplicate name detection
  const catProducts = useMemo(
    () => allProducts.filter(p => p.category_id === s2.category_id),
    [allProducts, s2.category_id],
  );

  // ── Validation ──────────────────────────────────────────────────────────
  const step1Valid = !!s1.alegra_product_type;
  const step2Valid =
    !!s2.category_id &&
    !!s2.origin &&
    !!s2.name.trim() &&
    !!s2.sku.trim() &&
    !skuExists &&
    !isNameDuplicate(s2.name, catProducts);
  const step3Valid  = !!s3.cabys && s3.price_total > 0;

  const formIsValid = useMemo(() => step2Valid && step3Valid, [step2Valid, step3Valid]);
  const canNext     = step === 0 ? step1Valid : formIsValid;

  async function handleSkuBlur() {
    if (s2.sku) setSkuExists(await checkSkuExists(db, s2.sku));
    else setSkuExists(false);
  }

  // ── Apply reference product ─────────────────────────────────────────────
  function applyReference(ref: CatalogProduct) {
    try {
      // Switch the session type to match the reference
      setS1({ alegra_product_type: ref.alegra_product_type });
      // Pre-fill category/origin/sub_series — SKU left empty so Step2 recalculates
      setS2({
        name: ref.name || '',  // Prefill the name so user can edit it
        sku: '',               // Step2 will auto-suggest next consecutive
        description: ref.description ?? '',
        category_id: ref.category_id,
        origin: ref.origin ?? 'local',
        sub_series: ref.sub_series,
      });
      setS3({
        cabys: ref.cabys || '',
        price_total: ref.price_total || 0,
        price_cost: ref.price_cost ?? 0,
        tax_percentage: ref.tax_percentage ?? 13,
        tax_name: ref.tax_name ?? 'IVA',
        quantity: 0,
      });
      setSkuExists(false);
      setStep(1); // Jump straight to identity step
    } catch (err) {
      console.error('Error applying reference product:', err);
      alert('Error al aplicar referencia: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async function saveAndContinue(downloadNow: boolean) {
    if (!user || !category) return;
    setIsSaving(true);
    try {
      const priceBase = calcPriceBase(s3.price_total, s3.tax_percentage ?? 13);
      const unit      = s1.alegra_product_type === 'service' ? 'Servicios Profesionales' : 'Unidad';
      const taxName   = s3.tax_name ?? 'IVA';
      const taxPct    = s3.tax_percentage ?? 13;

      await saveProduct(db, {
        sku: s2.sku, name: s2.name, description: s2.description || undefined,
        category_id: s2.category_id, category_name: categoryName,
        cabys: s3.cabys, origin: s2.origin, sub_series: s2.sub_series,
        price_total: s3.price_total, price_base: priceBase,
        price_cost: s3.price_cost || 0,
        unit, alegra_product_type: s1.alegra_product_type,
        tax_name: taxName, tax_percentage: taxPct,
      }, user.uid);

      const saved: CatalogProduct = {
        id: s2.sku, sku: s2.sku, name: s2.name,
        description: s2.description || undefined,
        category_id: s2.category_id, category_name: categoryName,
        cabys: s3.cabys, origin: s2.origin, sub_series: s2.sub_series,
        tax_name: taxName, tax_percentage: taxPct,
        price_total: s3.price_total, price_base: priceBase,
        price_cost: s3.price_cost || 0,
        quantity: s3.quantity ?? 0,
        is_exported: false,
        unit, alegra_product_type: s1.alegra_product_type,
        status: 'active', createdAt: new Date(), updatedAt: new Date(), createdBy: user.uid,
      };

      setSessionItems(prev => [...prev, saved]);
      catalog.addToQueue(saved);
      // Reload categories so SKU consecutive is refreshed for next product
      catalog.reloadCategories();
      setAllProducts(prev => [...prev, saved]);

      if (downloadNow) {
        const toExport = [...sessionItems, saved];
        const types: AlegraProductType[] = ['fe', 'no-inv', 'service'];
        types.forEach(t => {
          const filtered = toExport.filter(p => p.alegra_product_type === t).map(p => ({ product: p, quantity: p.quantity ?? 0 }));
          if (filtered.length) exportProductsToExcel(filtered, t);
        });

        try {
          const batch = writeBatch(db);
          toExport.forEach(p => {
            batch.update(doc(db, 'catalogProducts', p.sku), {
              is_exported: true,
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        } catch (err) {
          console.error('Error al marcar productos como exportados:', err);
        }

        toExport.forEach(p => {
          catalog.removeFromQueue(p.sku);
        });

        router.push('/products');
        return;
      }

      // Reset form completely
      setS2(DEFAULT_S2);
      setS3(DEFAULT_S3);
      setSkuExists(false);
      setStep(1);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />

      {/* Sub-header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-6 py-3 shadow-sm">
        <Link href="/products" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-sm font-bold text-foreground">Nuevo Producto</h1>
          <p className="text-[11px] text-muted-foreground">Paso {step + 1} de 2 — {STEP_LABELS[step]}</p>
        </div>
        <button
          onClick={() => setRefOpen(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <BookCopy className="h-3.5 w-3.5 text-primary" /> Usar Referencia
        </button>
      </div>

      {/* Split body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Form ── */}
        <div className="flex w-3/5 flex-col overflow-hidden border-r border-border">
          {/* Progress */}
          <div className="flex gap-1 px-6 pt-4 pb-2 shrink-0">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-muted'}`} />
            ))}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              {step === 0 && (
                <Step1TypeOrigin value={s1} onChange={v => { setS1(v); setS2(DEFAULT_S2); }} />
              )}
              {step === 1 && (
                <div className="flex flex-col gap-6">
                  <Step2Identity
                    value={s2}
                    onChange={v => { setS2(v); setSkuExists(false); }}
                    categories={catalog.categories}
                    alegraProductType={s1.alegra_product_type}
                    existingProducts={catProducts}
                    skuExists={skuExists}
                  />
                  <hr className="border-border/60 my-2" />
                  <Step3Commercial
                    value={s3}
                    onChange={setS3}
                    cabysOptions={catalog.cabysOptions}
                    alegraProductType={s1.alegra_product_type}
                  />
                </div>
              )}
            </motion.div>
          </div>

          {/* Footer nav */}
          <div className="shrink-0 border-t border-border bg-card px-6 py-4">
            {step === 0 ? (
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setStep(1)}
                  disabled={!canNext}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setStep(0)}
                  disabled={sessionItems.length > 0}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  ← Cambiar tipo
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      await handleSkuBlur();
                      saveAndContinue(true);
                    }}
                    disabled={!formIsValid || isSaving}
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 px-4 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Guardar y Descargar Excel
                  </button>
                  <button
                    onClick={async () => {
                      await handleSkuBlur();
                      saveAndContinue(false);
                    }}
                    disabled={!formIsValid || isSaving}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors shadow-sm"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                    Guardar y Crear Otro
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Session list ── */}
        <div className="flex w-2/5 flex-col overflow-hidden bg-muted/30">
          <div className="shrink-0 border-b border-border bg-card px-4 py-3">
            <p className="text-xs font-bold text-foreground">Productos de esta sesión</p>
            <p className="text-[10px] text-muted-foreground">
              {sessionItems.length} creado{sessionItems.length !== 1 ? 's' : ''} · Tipo: {SESSION_TYPE_LABEL[s1.alegra_product_type]}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {sessionItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center opacity-50">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Los productos guardados<br />aparecerán aquí</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...sessionItems].reverse().map((p, i) => (
                  <motion.div
                    key={p.sku}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-foreground">{p.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{p.sku} · {p.category_name}</p>
                        <p className="text-[10px] text-muted-foreground">₡{p.price_total.toLocaleString('es-CR')}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${TYPE_BADGE[p.alegra_product_type]}`}>
                        {TYPE_LABEL[p.alegra_product_type]}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {sessionItems.length > 0 && (
            <div className="shrink-0 border-t border-border bg-card p-3 flex flex-col gap-2">
              <button
                onClick={async () => {
                  const types: AlegraProductType[] = ['fe', 'no-inv', 'service'];
                  types.forEach(t => {
                    const f = sessionItems.filter(p => p.alegra_product_type === t).map(p => ({ product: p, quantity: p.quantity ?? 0 }));
                    if (f.length) exportProductsToExcel(f, t);
                  });

                  try {
                    const batch = writeBatch(db);
                    sessionItems.forEach(p => {
                      batch.update(doc(db, 'catalogProducts', p.sku), {
                        is_exported: true,
                        updatedAt: serverTimestamp(),
                      });
                    });
                    await batch.commit();
                  } catch (err) {
                    console.error('Error al marcar productos como exportados en sesión:', err);
                  }

                  sessionItems.forEach(p => {
                    catalog.removeFromQueue(p.sku);
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Descargar Sesión Actual
              </button>
              <Link
                href="/products"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Finalizar y Volver al Catálogo
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Reference dialog */}
      <ReferenceProductDialog
        open={refOpen}
        onClose={() => setRefOpen(false)}
        allProducts={allProducts}
        currentSku={s2.sku}
        onSelect={applyReference}
      />
    </div>
  );
}
