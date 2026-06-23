'use client';

import { CheckCircle2, Loader2, ShoppingCart, Save } from 'lucide-react';
import { SkuBadge } from '../SkuBadge';
import { CabysBadge } from '../CabysBadge';
import type { Step1Data } from './Step1_TypeOrigin';
import type { Step2Data } from './Step2_Identity';
import type { Step3Data } from './Step3_Commercial';
import type { CabysCode } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  'fe':      'Producto Inventariable',
  'no-inv':  'Producto No-Inventariable (local)',
  'service': 'Servicio',
};

interface Step4Props {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  cabysOptions: CabysCode[];
  categoryName: string;
  isSaving: boolean;
  onSave: () => void;
  onSaveAndExport: () => void;
}

export function Step4Review({
  step1, step2, step3, cabysOptions, categoryName, isSaving, onSave, onSaveAndExport,
}: Step4Props) {
  const cabys     = cabysOptions.find(c => c.code === step3.cabys);
  const priceBase = step3.price_total > 0
    ? (step3.price_total / (1 + (step3.tax_percentage ?? 13) / 100)).toFixed(2)
    : '0.00';
  const priceFmt = (n: number) => n.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-bold text-foreground">Resumen del Producto</span>
      </div>

      <div className="rounded-xl border border-border bg-background p-4 space-y-3 shadow-sm">
        <Row label="Nombre" value={step2.name} />
        <Row label="Categoría" value={categoryName} />
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">SKU</p>
          <SkuBadge sku={step2.sku} origin={step2.origin} />
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">CABYS</p>
          <CabysBadge code={step3.cabys} description={cabys?.description} />
        </div>
        {step1.alegra_product_type !== 'service' && (
          <Row label="Costo por Unidad" value={priceFmt(step3.price_cost ?? 0)} />
        )}
        <Row label="Precio Total" value={priceFmt(step3.price_total)} />
        <Row label="Precio Base (sin IVA)" value={`₡${Number(priceBase).toLocaleString('es-CR')}`} />
        <Row label="Impuesto" value={step3.tax_percentage === 0 ? 'Exento (0%)' : `IVA ${step3.tax_percentage ?? 13}%`} />
        <Row label="Plantilla Alegra" value={TYPE_LABEL[step1.alegra_product_type]} />
        {step2.description && <Row label="Descripción" value={step2.description} />}
      </div>

      {step1.alegra_product_type === 'fe' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          💡 Al agregar a la cola de exportación, podrás indicar la <strong>Cantidad Inicial en Bodega</strong> directamente en el panel de exportación antes de descargar el Excel.
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onSaveAndExport}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
          Guardar + Añadir a Cola de Exportación
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          Solo Guardar en Catálogo
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}
