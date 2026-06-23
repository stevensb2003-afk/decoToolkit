'use client';

import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkuBadge } from './SkuBadge';
import { CabysBadge } from './CabysBadge';
import type { CatalogProduct, ExportQueueItem } from '@/lib/types';

interface ProductListTableProps {
  products: CatalogProduct[];
  cabysMap: Record<string, string>;
  onAddToQueue?: (product: CatalogProduct) => void;
  exportQueue: ExportQueueItem[];
  onProductClick?: (product: CatalogProduct) => void;
}

export function ProductListTable({
  products,
  cabysMap,
  onAddToQueue,
  exportQueue,
  onProductClick,
}: ProductListTableProps) {
  const showAction = typeof onAddToQueue === 'function';

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
            <th className="p-4 font-semibold">Producto</th>
            <th className="p-4 font-semibold">Categoría</th>
            <th className="p-4 font-semibold">SKU</th>
            <th className="p-4 font-semibold">Tipo</th>
            <th className="p-4 font-semibold">Código CABYS</th>
            <th className="p-4 text-right font-semibold">Precio</th>
            {showAction && <th className="p-4 font-semibold text-center">Acción</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((product) => {
            if (!product.sku) return null;
            const isInQueue = exportQueue.some((item) => item.product.sku === product.sku);

            return (
              <tr
                key={product.sku}
                onClick={() => onProductClick?.(product)}
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  onProductClick && "cursor-pointer"
                )}
              >
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{product.name}</span>
                    {product.description && (
                      <span className="line-clamp-1 text-xs text-muted-foreground mt-0.5" title={product.description}>
                        {product.description}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase bg-muted/40 px-2 py-1 rounded-md border border-border">
                    {product.category_name || 'Sin Categoría'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1 items-start">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-mono font-semibold shrink-0',
                      product.origin === 'imported' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      product.origin === 'local' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    )}>
                      {product.sku}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {product.origin === 'imported' ? 'Importado' : product.origin === 'local' ? 'Local CR' : 'Viga WPC'}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  {product.alegra_product_type === 'fe' && (
                    <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      INV
                    </span>
                  )}
                  {product.alegra_product_type === 'no-inv' && (
                    <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      NO-INV
                    </span>
                  )}
                  {product.alegra_product_type === 'service' && (
                    <span className="inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                      SRV
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <CabysBadge code={product.cabys} description={cabysMap[product.cabys]} />
                </td>
                <td className="p-4 text-right font-bold text-foreground">
                  {product.price_total.toLocaleString('es-CR', {
                    style: 'currency',
                    currency: 'CRC',
                    maximumFractionDigits: 0,
                  })}
                </td>
                {showAction && (
                  <td className="p-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToQueue(product);
                      }}
                      disabled={isInQueue}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isInQueue
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95"
                      )}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {isInQueue ? 'En cola' : 'Exportar'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr>
              <td colSpan={showAction ? 7 : 6} className="p-8 text-center text-muted-foreground">
                No hay productos disponibles.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
