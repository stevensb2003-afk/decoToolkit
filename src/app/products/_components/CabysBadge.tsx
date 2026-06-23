'use client';

import { cn } from '@/lib/utils';
import type { CabysCode } from '@/lib/types';

interface CabysBadgeProps {
  code: string;
  description?: string;
  className?: string;
  title?: string;
}

export function CabysBadge({ code, description, className, title }: CabysBadgeProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)} title={title}>
      <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-mono text-purple-700">
        {code}
      </span>
      {description && (
        <span className="truncate text-[10px] text-muted-foreground">{description}</span>
      )}
    </div>
  );
}

/** Construye un label compuesto para dropdowns de CABYS. */
export function cabysLabel(c: CabysCode): string {
  return `${c.code} — ${c.description}`;
}
