'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Download, Trash2, X, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import type { ExportQueueItem, AlegraProductType } from '@/lib/types';

interface ExportPanelProps {
  queue: ExportQueueItem[];
  onRemove: (sku: string) => void;
  onUpdateQuantity: (sku: string, qty: number) => void;
  onClear: () => void;
  onDownload: () => void;
  onDownloadByType: (type: AlegraProductType) => void;
}

const TYPE_META: Record<AlegraProductType, { label: string; color: string; badge: string }> = {
  'fe':      { label: 'INV – Inventariables',   color: 'bg-blue-50 border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  'no-inv':  { label: 'NO-INV – Local/Nacional', color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  'service': { label: 'Servicios',               color: 'bg-orange-50 border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
};

export function ExportPanel({ queue, onRemove, onUpdateQuantity, onClear, onDownload, onDownloadByType }: ExportPanelProps) {
  const [open, setOpen] = useState(false);

  if (!queue.length) return null;

  const grouped: Partial<Record<AlegraProductType, ExportQueueItem[]>> = {};
  queue.forEach(item => {
    const t = item.product.alegra_product_type;
    if (!grouped[t]) grouped[t] = [];
    grouped[t]!.push(item);
  });

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="w-[26rem] rounded-2xl border border-border bg-card p-4 shadow-xl"
          >
            {/* Header del panel */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Cola de Exportación</span>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Grupos por tipo */}
            <div className="mb-3 flex flex-col gap-3 max-h-80 overflow-y-auto pr-0.5">
              {(Object.entries(grouped) as [AlegraProductType, ExportQueueItem[]][]).map(([type, items]) => {
                const meta = TYPE_META[type];
                return (
                  <div key={type} className={`rounded-xl border p-3 ${meta.color}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-foreground">{meta.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>{items.length}</span>
                        <button
                          onClick={() => onDownloadByType(type)}
                          className="flex items-center gap-1 rounded-lg bg-white border border-border px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
                        >
                          <Download className="h-3 w-3" /> Excel
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {items.map(item => (
                        <div
                          key={item.product.sku}
                          className="flex items-center gap-2 rounded-lg border border-border/50 bg-white px-2.5 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-semibold text-foreground">{item.product.name}</p>
                            <p className="text-[9px] font-mono text-muted-foreground">{item.product.sku}</p>
                          </div>
                          {/* Input cantidad solo para FE */}
                          {type === 'fe' && (
                            <div className="flex shrink-0 flex-col items-center gap-0.5">
                              <span className="text-[9px] text-muted-foreground leading-none">Cant.</span>
                              <input
                                type="number" min={0} value={item.quantity}
                                onChange={e => onUpdateQuantity(item.product.sku, parseInt(e.target.value) || 0)}
                                className="w-14 rounded border border-input bg-background px-1.5 py-1 text-center text-[11px] font-semibold outline-none focus:border-primary"
                              />
                            </div>
                          )}
                          <button onClick={() => onRemove(item.product.sku)} className="shrink-0 rounded p-1 hover:bg-muted transition-colors">
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acciones globales */}
            <div className="flex gap-2">
              <button
                onClick={onDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> Descargar Todos (Separados)
              </button>
              <button
                onClick={onClear}
                className="flex items-center rounded-xl border border-border px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 transition-colors"
      >
        <FileSpreadsheet className="h-5 w-5" />
        Exportar
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-emerald-700 shadow">
          {queue.length}
        </span>
      </motion.button>
    </div>
  );
}
