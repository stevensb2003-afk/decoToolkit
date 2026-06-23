'use client';

/**
 * useProductCatalog.ts
 * Hook centralizado: queries Firestore, estado de filtros y cola de exportación.
 * La cola persiste en localStorage bajo 'deco_export_queue'.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, query, where, orderBy, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase';
import { useMemoFirebase } from '@/firebase';
import { getProductCategories, getCabysConfig } from '@/lib/product-service';
import { exportProductsToExcel } from '@/lib/product-excel';
import type {
  CatalogProduct,
  ProductCategory,
  CabysCode,
  AlegraProductType,
  ExportQueueItem,
} from '@/lib/types';

const QUEUE_KEY = 'deco_export_queue';

function loadQueue(): ExportQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as ExportQueueItem[]) : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: ExportQueueItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export interface UseProductCatalogReturn {
  categories: ProductCategory[];
  categoriesLoading: boolean;
  products: CatalogProduct[];
  productsLoading: boolean;
  cabysOptions: CabysCode[];
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  exportQueue: ExportQueueItem[];
  addToQueue: (product: CatalogProduct) => void;
  removeFromQueue: (sku: string) => void;
  updateQueueQuantity: (sku: string, qty: number) => void;
  clearQueue: () => void;
  /** Descarga todos los tipos presentes en la cola en archivos Excel separados */
  downloadQueue: () => void;
  /** Descarga solo el tipo especificado */
  downloadQueueByType: (type: AlegraProductType) => void;
  reloadCategories: () => void;
  productCounts: Record<string, number>;
}

export function useProductCatalog(): UseProductCatalogReturn {
  const db = useFirestore();

  // ── Categorías (one-time fetch, reloadable) ──────────────────────────────
  const [categories, setCategories]         = useState<ProductCategory[]>([]);
  const [categoriesLoading, setCatLoading]  = useState(true);
  const [cabysOptions, setCabys]            = useState<CabysCode[]>([]);
  const [reloadTick, setReloadTick]         = useState(0);

  useEffect(() => {
    let alive = true;
    setCatLoading(true);
    Promise.all([getProductCategories(db), getCabysConfig(db)]).then(([cats, cabys]) => {
      if (!alive) return;
      setCategories(cats);
      setCabys(cabys);
      setCatLoading(false);
    }).catch(() => { if (alive) setCatLoading(false); });
    return () => { alive = false; };
  }, [db, reloadTick]);

  const reloadCategories = useCallback(() => setReloadTick(t => t + 1), []);

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]               = useState('');

  // ── Productos en tiempo real ─────────────────────────────────────────────
  const productsQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'catalogProducts'),
      where('status', '!=', 'archived'),
      orderBy('status'),
      orderBy('name', 'asc'),
    );
  }, [db]);

  const { data: rawProducts, isLoading: productsLoading } =
    useCollection<CatalogProduct>(productsQuery);

  const products = useMemo(() => {
    let list = rawProducts ?? [];
    if (selectedCategoryId) {
      list = list.filter(p => p.category_id === selectedCategoryId);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toUpperCase();
    return list.filter(p => p.name.toUpperCase().includes(q) || p.sku.toUpperCase().includes(q));
  }, [rawProducts, selectedCategoryId, searchQuery]);

  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!rawProducts) return counts;
    rawProducts.forEach(p => {
      counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
    });
    return counts;
  }, [rawProducts]);

  // ── Cola de exportación (persistente en localStorage) ────────────────────
  const [exportQueue, setExportQueueRaw] = useState<ExportQueueItem[]>(() => loadQueue());

  const setExportQueue = useCallback((updater: (prev: ExportQueueItem[]) => ExportQueueItem[]) => {
    setExportQueueRaw(prev => {
      const next = updater(prev);
      persistQueue(next);
      return next;
    });
  }, []);

  const addToQueue = useCallback((product: CatalogProduct) => {
    setExportQueue(q =>
      q.some(item => item.product.sku === product.sku)
        ? q
        : [...q, { product, quantity: product.quantity ?? 0 }],
    );
  }, [setExportQueue]);

  const removeFromQueue = useCallback((sku: string) => {
    setExportQueue(q => q.filter(item => item.product.sku !== sku));
  }, [setExportQueue]);

  const updateQueueQuantity = useCallback((sku: string, qty: number) => {
    setExportQueue(q =>
      q.map(item =>
        item.product.sku === sku ? { ...item, quantity: Math.max(0, qty) } : item,
      ),
    );
  }, [setExportQueue]);

  const clearQueue = useCallback(() => {
    setExportQueue(() => []);
  }, [setExportQueue]);

  /** Genera archivos Excel separados por cada tipo presente en la cola */
  const downloadQueue = useCallback(async () => {
    if (!exportQueue.length) return;
    const types: AlegraProductType[] = ['fe', 'no-inv', 'service'];
    types.forEach(type => {
      const filtered = exportQueue.filter(item => item.product.alegra_product_type === type);
      if (filtered.length > 0) exportProductsToExcel(filtered, type);
    });

    try {
      const batch = writeBatch(db);
      exportQueue.forEach(item => {
        batch.update(doc(db, 'catalogProducts', item.product.sku), {
          is_exported: true,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error al actualizar estado de exportación:', err);
    }

    clearQueue();
  }, [exportQueue, clearQueue, db]);

  const downloadQueueByType = useCallback(async (type: AlegraProductType) => {
    const filtered = exportQueue.filter(item => item.product.alegra_product_type === type);
    if (filtered.length > 0) {
      exportProductsToExcel(filtered, type);

      try {
        const batch = writeBatch(db);
        filtered.forEach(item => {
          batch.update(doc(db, 'catalogProducts', item.product.sku), {
            is_exported: true,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      } catch (err) {
        console.error('Error al actualizar estado de exportación por tipo:', err);
      }

      setExportQueue(q => q.filter(item => item.product.alegra_product_type !== type));
    }
  }, [exportQueue, setExportQueue, db]);

  return {
    categories,
    categoriesLoading,
    products,
    productsLoading,
    cabysOptions,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    exportQueue,
    addToQueue,
    removeFromQueue,
    updateQueueQuantity,
    clearQueue,
    downloadQueue,
    downloadQueueByType,
    reloadCategories,
    productCounts,
  };
}
