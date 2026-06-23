'use client';

import { cn } from '@/lib/utils';
import type { AlegraProductType } from '@/lib/types';

// Step1Data now only holds the product type — category/origin moved to Step2
export interface Step1Data {
  alegra_product_type: AlegraProductType;
}

interface Step1Props {
  value: Step1Data;
  onChange: (data: Step1Data) => void;
}

const TYPES: { value: AlegraProductType; label: string; desc: string; icon: string }[] = [
  { value: 'fe',      label: 'Producto Inventariable',        desc: 'Importado de China',                             icon: '📦' },
  { value: 'no-inv',  label: 'Producto No-Inventariable',     desc: 'Proveedor local CR',                             icon: '🏷️' },
  { value: 'service', label: 'Servicio',                      desc: 'Instalación, corte, etc.',                       icon: '🔧' },
];

export function Step1TypeOrigin({ value, onChange }: Step1Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Selecciona el tipo de archivo Excel que se generará para esta sesión.<br />
        La categoría y el origen se definen individualmente en cada producto.
      </p>
      {TYPES.map(t => (
        <button
          key={t.value}
          onClick={() => onChange({ alegra_product_type: t.value })}
          className={cn(
            'flex items-start gap-4 rounded-xl border px-5 py-4 text-left transition-all',
            value.alegra_product_type === t.value
              ? 'border-emerald-400 bg-emerald-50 shadow-sm ring-1 ring-emerald-300'
              : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
          )}
        >
          <span className="text-2xl leading-none">{t.icon}</span>
          <div>
            <span className={cn('block text-sm font-semibold', value.alegra_product_type === t.value ? 'text-foreground' : '')}>
              {t.label}
            </span>
            <span className="block text-xs opacity-60 mt-0.5">{t.desc}</span>
          </div>
          {value.alegra_product_type === t.value && (
            <span className="ml-auto shrink-0 text-xs font-bold text-emerald-600">✓</span>
          )}
        </button>
      ))}
    </div>
  );
}
