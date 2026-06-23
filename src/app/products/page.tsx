'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase';
import { UserProfile } from '@/lib/types';
import { Header } from '@/components/layout/header';
import { useProductCatalog } from '@/hooks/useProductCatalog';
import { ProductCategorySidebar } from './_components/ProductCategorySidebar';
import { ProductCard } from './_components/ProductCard';
import { ProductListTable } from './_components/ProductListTable';
import { ProductDetailDialog } from './_components/ProductDetailDialog';
import { ExportPanel } from './_components/ExportPanel';
import { CategoryFormDialog } from './_components/CategoryFormDialog';
import { cn } from '@/lib/utils';
import type { CatalogProduct, AlegraProductType } from '@/lib/types';

export default function ProductsPage() {
  const { user, isUserLoading } = useUser();
  const firestore  = useFirestore();
  const router     = useRouter();
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'price_asc' | 'price_desc'>('name');
  const [filterType, setFilterType] = useState<AlegraProductType | 'all'>('all');
  const [filterExportStatus, setFilterExportStatus] = useState<'all' | 'exported' | 'pending'>('all');

  const [viewMode, setViewMode] = useState<'gallery' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('deco_products_view_mode') as 'gallery' | 'list') || 'gallery';
    }
    return 'gallery';
  });

  const handleSetViewMode = (mode: 'gallery' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('deco_products_view_mode', mode);
    }
  };

  const profileRef = useMemoFirebase(
    () => user ? doc(firestore, 'users', user.uid) : null,
    [user, firestore],
  );
  const { data: profile } = useDoc<UserProfile>(profileRef);
  const isAdmin   = profile?.isAdmin || user?.email === 'stevensb.2003@gmail.com';
  const canAccess = isAdmin || (profile?.permissions?.allowedModules ?? []).includes('inventory');

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
    if (!isUserLoading && user && profile && !canAccess) router.push('/');
  }, [isUserLoading, user, profile, canAccess, router]);

  const catalog = useProductCatalog();

  const cabysMap = useMemo(() => {
    const m: Record<string, string> = {};
    catalog.cabysOptions.forEach(c => { m[c.code] = c.description; });
    return m;
  }, [catalog.cabysOptions]);

  const filteredAndSortedProducts = useMemo(() => {
    const list = [...catalog.products];
    
    // Filtrar por tipo
    let filtered = list;
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.alegra_product_type === filterType);
    }

    // Filtrar por estatus de exportación
    if (filterExportStatus === 'exported') {
      filtered = filtered.filter(p => p.is_exported === true);
    } else if (filterExportStatus === 'pending') {
      filtered = filtered.filter(p => !p.is_exported);
    }

    if (sortBy === 'name') {
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'sku') {
      return filtered.sort((a, b) => a.sku.localeCompare(b.sku));
    }
    if (sortBy === 'price_asc') {
      return filtered.sort((a, b) => a.price_total - b.price_total);
    }
    if (sortBy === 'price_desc') {
      return filtered.sort((a, b) => b.price_total - a.price_total);
    }
    return filtered;
  }, [catalog.products, filterType, filterExportStatus, sortBy]);

  if (isUserLoading) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />

      {/* ── Top Bar del Módulo ── */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-bold text-foreground">Catálogo de Productos</h1>
            <p className="text-[11px] text-muted-foreground">
              {catalog.products.length} productos · {catalog.categories.length} categorías
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/products/new')}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Sidebar */}
        <div className="shrink-0 border-r border-border bg-card p-3">
          <ProductCategorySidebar
            categories={catalog.categories}
            selectedId={catalog.selectedCategoryId}
            onSelect={catalog.setSelectedCategoryId}
            productCounts={catalog.productCounts}
            onNewCategory={isAdmin ? () => setCatDialogOpen(true) : undefined}
          />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-background p-5 flex flex-col">
          {/* Barra de Controles (Búsqueda + Filtros + Vista Toggle) */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shrink-0">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o SKU..."
                  value={catalog.searchQuery}
                  onChange={e => catalog.setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground outline-none transition-colors focus:border-emerald-500 placeholder:text-muted-foreground/60 shadow-sm"
                />
              </div>

              {/* Selector de Tipo */}
              <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo:</span>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer pr-1"
                >
                  <option value="all">Todos</option>
                  <option value="fe">Inventariables</option>
                  <option value="no-inv">No Inventariables</option>
                  <option value="service">Servicios</option>
                </select>
              </div>

              {/* Selector de Exportación */}
              <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exportación:</span>
                <select
                  value={filterExportStatus}
                  onChange={e => setFilterExportStatus(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer pr-1"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="exported">Exportados</option>
                </select>
              </div>

              {/* Selector de Ordenamiento */}
              <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer pr-1"
                >
                  <option value="name">Nombre</option>
                  <option value="sku">SKU</option>
                  <option value="price_asc">Precio ↑</option>
                  <option value="price_desc">Precio ↓</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
              <button
                onClick={() => handleSetViewMode('gallery')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                  viewMode === 'gallery'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-100'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
                title="Vista de Mosaico / Galería"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Mosaico
              </button>
              <button
                onClick={() => handleSetViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                  viewMode === 'list'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-100'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
                title="Vista de Lista"
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
            </div>
          </div>

          <div className="flex-1">
            {catalog.productsLoading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-xl border border-border bg-muted/50" />
                ))}
              </div>
            ) : filteredAndSortedProducts.length === 0 ? (
              <EmptyState hasCat={!!catalog.selectedCategoryId} onNew={() => router.push('/products/new')} />
            ) : viewMode === 'list' ? (
              <ProductListTable
                products={filteredAndSortedProducts}
                cabysMap={cabysMap}
                onAddToQueue={catalog.addToQueue}
                exportQueue={catalog.exportQueue}
                onProductClick={setSelectedProduct}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {filteredAndSortedProducts.map(p => (
                  <ProductCard
                    key={p.sku}
                    product={p}
                    cabysDescription={cabysMap[p.cabys]}
                    onAddToQueue={catalog.addToQueue}
                    inQueue={catalog.exportQueue.some(q => q.product.sku === p.sku)}
                    onClick={() => setSelectedProduct(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialogs */}
      <ProductDetailDialog
        open={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        categories={catalog.categories}
        cabysOptions={catalog.cabysOptions}
        isAdmin={isAdmin}
      />

      <CategoryFormDialog
        open={catDialogOpen}
        onClose={() => setCatDialogOpen(false)}
        cabysOptions={catalog.cabysOptions}
        onCreated={(id) => { setCatDialogOpen(false); catalog.reloadCategories(); catalog.setSelectedCategoryId(id); }}
      />

      <ExportPanel
        queue={catalog.exportQueue}
        onRemove={catalog.removeFromQueue}
        onUpdateQuantity={catalog.updateQueueQuantity}
        onClear={catalog.clearQueue}
        onDownload={catalog.downloadQueue}
        onDownloadByType={catalog.downloadQueueByType}
      />
    </div>
  );
}

function EmptyState({ hasCat, onNew }: { hasCat: boolean; onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full border border-border bg-muted p-6">
        <Search className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {hasCat ? 'Sin productos en esta categoría' : 'Selecciona una categoría'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasCat ? 'Crea el primero haciendo clic en "Nuevo Producto".' : 'Elige una categoría del panel izquierdo para ver sus productos.'}
        </p>
      </div>
      {hasCat && (
        <button
          onClick={onNew}
          className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <Plus className="h-4 w-4" /> Nuevo Producto
        </button>
      )}
    </div>
  );
}
