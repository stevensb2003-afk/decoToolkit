'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Layers, Plus } from 'lucide-react';
import type { ProductCategory } from '@/lib/types';

interface ProductCategorySidebarProps {
  categories: ProductCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  productCounts?: Record<string, number>;
  onNewCategory?: () => void;
}

export function ProductCategorySidebar({
  categories,
  selectedId,
  onSelect,
  productCounts = {},
  onNewCategory,
}: ProductCategorySidebarProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card p-3">
      <p className="mb-1 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Layers className="h-3.5 w-3.5" /> Categorías
      </p>

      {/* Todos */}
      <SidebarItem
        label="Todos los productos"
        count={Object.values(productCounts).reduce((a, b) => a + b, 0)}
        selected={selectedId === null}
        onClick={() => onSelect(null)}
      />

      {/* Categorías */}
      {categories.map((cat, i) => (
        <motion.div
          key={cat.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.025 }}
        >
          <SidebarItem
            label={cat.name}
            count={productCounts[cat.id] ?? 0}
            selected={selectedId === cat.id}
            onClick={() => onSelect(cat.id)}
            prefix={cat.sku_prefix}
          />
        </motion.div>
      ))}

      {/* Nueva Categoría */}
      {onNewCategory && (
        <button
          onClick={onNewCategory}
          className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva Categoría
        </button>
      )}
    </aside>
  );
}

interface SidebarItemProps {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  prefix?: string;
}

function SidebarItem({ label, count, selected, onClick, prefix }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
        selected
          ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-2 truncate">
        {prefix && (
          <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-mono font-bold bg-muted text-muted-foreground border border-border">
            {prefix}
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
      {count >= 0 && (
        <span className={cn(
          'ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
          selected ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
