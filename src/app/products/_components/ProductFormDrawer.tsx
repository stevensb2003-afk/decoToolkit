'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Loader2, ShoppingCart } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase';
import { saveProduct, checkSkuExists } from '@/lib/product-service';
import { calcPriceBase, isNameDuplicate } from '@/lib/product-utils';
import { Step1TypeOrigin, type Step1Data } from './steps/Step1_TypeOrigin';
import { Step2Identity, type Step2Data } from './steps/Step2_Identity';
import { Step3Commercial, type Step3Data } from './steps/Step3_Commercial';
import { Step4Review } from './steps/Step4_Review';
import type { ProductCategory, CabysCode, CatalogProduct } from '@/lib/types';

interface ProductFormDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  cabysOptions: CabysCode[];
  existingProducts: CatalogProduct[];
  onSaved: (product: CatalogProduct, addToQueue: boolean) => void;
}

const STEP_LABELS = ['Tipo de Producto', 'Datos del Producto'];

const DEFAULT_STEP1: Step1Data = { alegra_product_type: 'fe' };
const DEFAULT_STEP2: Step2Data = { name: '', sku: '', description: '', category_id: '', origin: 'imported', sub_series: undefined };
const DEFAULT_STEP3: Step3Data = { cabys: '', price_total: 0, price_cost: 0, tax_percentage: 13, tax_name: 'IVA', quantity: 0 };

export function ProductFormDrawer({
  open, onClose, categories, cabysOptions, existingProducts, onSaved,
}: ProductFormDrawerProps) {
  const db       = useFirestore();
  const { user } = useUser();
  const [step, setStep]     = useState(0);
  const [step1, setStep1]   = useState<Step1Data>(DEFAULT_STEP1);
  const [step2, setStep2]   = useState<Step2Data>(DEFAULT_STEP2);
  const [step3, setStep3]   = useState<Step3Data>(DEFAULT_STEP3);
  const [skuExists, setSkuExists] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);

  const category     = categories.find(c => c.id === step2.category_id);
  const categoryName = category?.name ?? '';

  const step1Valid = !!step1.alegra_product_type;
  const step2Valid = !!step2.category_id && !!step2.origin && !!step2.name.trim() && !!step2.sku.trim()
    && !skuExists && !isNameDuplicate(step2.name, existingProducts);
  const step3Valid = !!step3.cabys && step3.price_total > 0;

  const formIsValid = step2Valid && step3Valid;
  const canNext = step === 0 ? step1Valid : formIsValid;

  async function handleSkuBlur() {
    if (step2.sku) setSkuExists(await checkSkuExists(db, step2.sku));
  }

  async function handleSave(addToQueue: boolean) {
    if (!user || !category) return;
    setIsSaving(true);
    try {
      const priceBase = calcPriceBase(step3.price_total, step3.tax_percentage ?? 13);
      const unit = step1.alegra_product_type === 'service' ? 'Servicios Profesionales' : 'Unidad';
      const taxName = step3.tax_name ?? 'IVA';
      const taxPct = step3.tax_percentage ?? 13;

      await saveProduct(db, {
        sku: step2.sku, name: step2.name, description: step2.description || undefined,
        category_id: step2.category_id, category_name: categoryName,
        cabys: step3.cabys, origin: step2.origin, sub_series: step2.sub_series,
        price_total: step3.price_total, price_base: priceBase,
        price_cost: step3.price_cost || 0,
        unit, alegra_product_type: step1.alegra_product_type,
        tax_name: taxName, tax_percentage: taxPct,
      }, user.uid);
      const savedProduct: CatalogProduct = {
        id: step2.sku, sku: step2.sku, name: step2.name,
        description: step2.description || undefined,
        category_id: step2.category_id, category_name: categoryName,
        cabys: step3.cabys, origin: step2.origin, sub_series: step2.sub_series,
        tax_name: taxName, tax_percentage: taxPct,
        price_total: step3.price_total, price_base: priceBase,
        price_cost: step3.price_cost || 0,
        unit, alegra_product_type: step1.alegra_product_type,
        status: 'active', createdAt: new Date(), updatedAt: new Date(), createdBy: user.uid,
      };
      onSaved(savedProduct, addToQueue);
      resetForm();
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setStep(0); setStep1(DEFAULT_STEP1); setStep2(DEFAULT_STEP2);
    setStep3(DEFAULT_STEP3); setSkuExists(false); onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Nuevo Producto</h2>
                <p className="text-xs text-muted-foreground">Paso {step + 1} de 2 — {STEP_LABELS[step]}</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex gap-1 px-6 pt-4">
              {STEP_LABELS.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-muted'}`} />
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === 0 && <Step1TypeOrigin value={step1} onChange={setStep1} />}
              {step === 1 && (
                <div className="flex flex-col gap-6">
                  <Step2Identity
                    value={step2} onChange={setStep2}
                    categories={categories}
                    alegraProductType={step1.alegra_product_type}
                    existingProducts={existingProducts.filter(p => p.category_id === step2.category_id)}
                    skuExists={skuExists}
                  />
                  <hr className="border-border/60 my-2" />
                  <Step3Commercial
                    value={step3}
                    onChange={setStep3}
                    cabysOptions={cabysOptions}
                    alegraProductType={step1.alegra_product_type}
                  />
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div className="shrink-0 border-t border-border bg-card px-6 py-4">
              {step === 0 ? (
                <div className="flex items-center justify-end w-full">
                  <button
                    onClick={() => setStep(1)}
                    disabled={!canNext}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => setStep(0)}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors border border-transparent hover:border-border animate-none"
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </button>
                    <button
                      onClick={async () => {
                        await handleSkuBlur();
                        handleSave(false);
                      }}
                      disabled={!formIsValid || isSaving}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      Solo Guardar en Catálogo
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      await handleSkuBlur();
                      handleSave(true);
                    }}
                    disabled={!formIsValid || isSaving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                    Guardar + Añadir a Cola
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
