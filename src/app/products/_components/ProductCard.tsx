'use client';

import { motion } from 'framer-motion';
import { ShoppingCart, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkuBadge } from './SkuBadge';
import { CabysBadge } from './CabysBadge';
import type { CatalogProduct } from '@/lib/types';

interface ProductCardProps {
  product: CatalogProduct;
  cabysDescription?: string;
  onAddToQueue?: (product: CatalogProduct) => void;
  inQueue?: boolean;
  onClick?: () => void;
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

export function ProductCard({ product, cabysDescription, onAddToQueue, inQueue, onClick }: ProductCardProps) {
  const price = product.price_total.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
        onClick && "cursor-pointer"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-2">{product.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {product.is_exported !== false ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground border border-border">
              Exportado
            </span>
          ) : (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
              Pendiente
            </span>
          )}
          <span className={cn(
            'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
            TYPE_STYLE[product.alegra_product_type],
          )}>
            {TYPE_LABEL[product.alegra_product_type]}
          </span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-col gap-1.5">
        <SkuBadge sku={product.sku} origin={product.origin} />
        <CabysBadge code={product.cabys} description={product.category_name || 'Sin Categoría'} title={cabysDescription} className="cursor-help" />
      </div>

      {/* Description */}
      {product.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          {price}
        </div>
        {onAddToQueue && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToQueue(product);
            }}
            disabled={inQueue}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
              inQueue
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100',
            )}
          >
            <ShoppingCart className="h-3 w-3" />
            {inQueue ? 'En cola' : 'Exportar'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
