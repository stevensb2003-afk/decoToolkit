'use client';

import { cn } from '@/lib/utils';
import type { ProductOrigin } from '@/lib/types';

interface SkuBadgeProps {
  sku: string;
  origin: ProductOrigin;
  className?: string;
}

const ORIGIN_STYLES: Record<ProductOrigin, string> = {
  imported: 'bg-blue-50 text-blue-700 border-blue-200',
  local:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  beam:     'bg-amber-50 text-amber-700 border-amber-200',
};

const ORIGIN_LABEL: Record<ProductOrigin, string> = {
  imported: 'Importado',
  local:    'Local CR',
  beam:     'Viga WPC',
};

export function SkuBadge({ sku, origin, className }: SkuBadgeProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-mono font-semibold',
        ORIGIN_STYLES[origin],
      )}>
        {sku}
      </span>
      <span className="text-[10px] text-muted-foreground">{ORIGIN_LABEL[origin]}</span>
    </div>
  );
}
