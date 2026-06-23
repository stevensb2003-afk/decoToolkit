'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calcPriceBase } from '@/lib/product-utils';
import { ACCOUNT_INCOME, ACCOUNT_INVENTORY, ACCOUNT_COST } from '@/lib/product-utils';
import { cabysLabel } from '../CabysBadge';
import type { CabysCode, AlegraProductType } from '@/lib/types';

export interface TaxOption {
  value: number;
  name: string;
  label: string;
}

export const COSTA_RICA_TAXES: TaxOption[] = [
  { value: 13, name: 'IVA', label: '13.00% (IVA)' },
  { value: 8, name: 'IVA transitorio', label: '8.00% (Transitorio)' },
  { value: 4, name: 'IVA reducido', label: '4.00% (Reducido)' },
  { value: 2, name: 'IVA reducido', label: '2.00% (Reducido)' },
  { value: 1, name: 'IVA reducido', label: '1.00% (Reducido)' },
  { value: 0.5, name: 'IVA reducido', label: '0.50% (Reducido)' },
  { value: 0, name: 'IVA exento', label: '0.00% (Exento)' },
  { value: 0, name: 'Tarifa 0% (Artículo 32, num 1, RLIVA)', label: '0.00% (Art. 32 RLIVA)' },
  { value: 0, name: 'Tarifa 0% sin derecho a crédito', label: '0.00% (Sin crédito)' },
];

export interface Step3Data {
  cabys: string;
  price_total: number;
  price_cost: number;
  tax_percentage: number;
  tax_name: string;
  quantity: number;
}

interface Step3Props {
  value: Step3Data;
  onChange: (data: Step3Data) => void;
  cabysOptions: CabysCode[];
  alegraProductType: AlegraProductType;
}

export function Step3Commercial({ value, onChange, cabysOptions, alegraProductType }: Step3Props) {
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [cabysSearch, setCabysSearch]   = useState('');
  const [showCabysList, setShowCabysList] = useState(false);

  function set(patch: Partial<Step3Data>) { onChange({ ...value, ...patch }); }

  const priceBase = useMemo(
    () => value.price_total > 0 ? calcPriceBase(value.price_total, value.tax_percentage ?? 13) : 0,
    [value.price_total, value.tax_percentage],
  );

  const filteredCabys = useMemo(() => {
    if (!cabysSearch.trim()) return cabysOptions;
    const q = cabysSearch.toLowerCase();
    return cabysOptions.filter(c =>
      c.code.includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [cabysOptions, cabysSearch]);

  const selectedCabys = cabysOptions.find(c => c.code === value.cabys);

  return (
    <div className="flex flex-col gap-5">
      {/* CABYS */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Código CABYS
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por código o descripción..."
            value={cabysSearch}
            onChange={e => setCabysSearch(e.target.value)}
            onFocus={() => setShowCabysList(true)}
            onBlur={() => setTimeout(() => setShowCabysList(false), 200)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/40"
          />
          {showCabysList && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {filteredCabys.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">Sin resultados</p>
              ) : filteredCabys.map(c => (
                <button
                  key={c.code}
                  onClick={() => { set({ cabys: c.code }); setCabysSearch(''); }}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted',
                    value.cabys === c.code && 'bg-primary/10',
                  )}
                >
                  <span className="shrink-0 font-mono text-primary">{c.code}</span>
                  <span className="text-muted-foreground">{c.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedCabys && (
          <p className="text-xs text-primary font-medium">✓ {cabysLabel(selectedCabys)}</p>
        )}
      </div>

      {/* Precio */}
      <div className="grid grid-cols-2 gap-3">
        {alegraProductType !== 'service' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Costo por Unidad
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
              <input
                type="number"
                min={0}
                value={value.price_cost || ''}
                onChange={e => set({ price_cost: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/40"
                placeholder="0"
              />
            </div>
          </div>
        )}

        {alegraProductType === 'fe' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Cantidad Inicial en Bodega
            </label>
            <input
              type="number"
              min={0}
              value={value.quantity || ''}
              onChange={e => set({ quantity: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-input bg-background py-2.5 px-3 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/40"
              placeholder="0"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tipo de IVA
          </label>
          <select
            value={`${value.tax_name ?? 'IVA'}:${value.tax_percentage ?? 13}`}
            onChange={e => {
              const [name, pctStr] = e.target.value.split(':');
              set({ tax_name: name, tax_percentage: parseFloat(pctStr) || 0 });
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          >
            {COSTA_RICA_TAXES.map((tax, i) => (
              <option key={i} value={`${tax.name}:${tax.value}`}>
                {tax.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Precio Total (con IVA)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
            <input
              type="number"
              min={0}
              value={value.price_total || ''}
              onChange={e => set({ price_total: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
              placeholder="0"
            />
          </div>
        </div>

        <div className={cn("flex flex-col gap-1.5", (alegraProductType === 'service' || alegraProductType === 'fe') && "col-span-2")}>
          <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Precio Base <Lock className="h-3 w-3" />
          </label>
          <div className="flex items-center rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            ₡{priceBase.toLocaleString('es-CR', { maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {value.tax_percentage === 0
              ? `= Total (${value.tax_name ?? 'Exento'})`
              : `= Total ÷ ${(1 + (value.tax_percentage ?? 13) / 100).toFixed(2)} · ${(value.tax_name ?? 'IVA')} ${value.tax_percentage ?? 13}%`}
          </p>
        </div>
      </div>

      {/* Cuentas contables (colapsado) */}
      <div className="rounded-lg border border-border bg-muted/30">
        <button
          onClick={() => setAccountsOpen(v => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver cuentas contables (siempre iguales)
          <ChevronDown className={cn('h-4 w-4 transition-transform', accountsOpen && 'rotate-180')} />
        </button>
        {accountsOpen && (
          <div className="flex flex-col gap-1 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground/70">Ingresos:</span> {ACCOUNT_INCOME}</p>
            <p><span className="font-medium text-foreground/70">Inventario:</span> {ACCOUNT_INVENTORY}</p>
            <p><span className="font-medium text-foreground/70">Costo venta:</span> {ACCOUNT_COST}</p>
          </div>
        )}
      </div>
    </div>
  );
}
