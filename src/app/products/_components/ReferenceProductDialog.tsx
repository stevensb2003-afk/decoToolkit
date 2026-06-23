'use client';

import { useState, useMemo } from 'react';
import { Search, X, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CatalogProduct } from '@/lib/types';

interface ReferenceProductDialogProps {
  open: boolean;
  onClose: () => void;
  /** Todos los productos existentes del catálogo */
  allProducts: CatalogProduct[];
  /** Producto actualmente en edición (para excluirlo de duplicados) */
  currentSku?: string;
  onSelect: (product: CatalogProduct) => void;
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  'fe':      { label: 'INV',    color: 'bg-blue-100 text-blue-700' },
  'no-inv':  { label: 'NO-INV', color: 'bg-emerald-100 text-emerald-700' },
  'service': { label: 'SVC',    color: 'bg-orange-100 text-orange-700' },
};

export function ReferenceProductDialog({
  open, onClose, allProducts, currentSku, onSelect,
}: ReferenceProductDialogProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toUpperCase().trim();
    return allProducts
      .filter(p =>
        p.status !== 'archived' &&
        p.sku !== currentSku &&
        (!q || p.name.includes(q) || p.sku.includes(q) || p.category_name.toUpperCase().includes(q)),
      )
      .slice(0, 40);
  }, [allProducts, search, currentSku]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Usar Producto de Referencia</h3>
              <p className="text-xs text-muted-foreground">Selecciona un producto para copiar sus datos. El SKU y nombre serán únicos.</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar por nombre, SKU o categoría..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm text-muted-foreground">Sin resultados para &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              filtered.map(p => {
                const typeInfo = TYPE_LABEL[p.alegra_product_type] ?? { label: p.alegra_product_type, color: 'bg-muted text-muted-foreground' };
                return (
                  <button
                    key={p.sku}
                    onClick={() => { onSelect(p); onClose(); setSearch(''); }}
                    className="flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left hover:bg-muted/50 transition-colors last:border-b-0"
                  >
                    <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-mono">{p.sku}</span>
                        {' · '}{p.category_name}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ₡{p.price_total.toLocaleString('es-CR')}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-muted/30 px-4 py-2.5">
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} producto{filtered.length !== 1 ? 's' : ''} · El SKU se actualizará automáticamente al siguiente disponible.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
