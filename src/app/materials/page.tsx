"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import type { UserProfile, DefaultMaterial, MaterialCategory } from "@/lib/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, collection, query, orderBy, where } from "firebase/firestore";
import { Search, ArrowLeft, Layers, PackagePlus, FolderOpen, SearchX } from "lucide-react";
import { Header } from "@/components/layout/header";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { MaterialCard, itemVariants } from "./_components/MaterialCard";
import { CategorySidebar } from "./_components/CategorySidebar";
import { MaterialFormDialog } from "./_components/MaterialFormDialog";

// ── Framer variants ───────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-52 w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ── Empty States ──────────────────────────────────────────────────────────────

function EmptyCategories() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center text-center p-16 border-2 border-dashed border-primary/20 bg-primary/5 rounded-3xl min-h-[400px]">
      <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-5">
        <Layers className="h-10 w-10 text-primary opacity-60" />
      </div>
      <h3 className="text-xl font-bold">Tu catálogo está vacío</h3>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Comienza creando una categoría en el panel izquierdo y luego agrega materiales a ella.
      </p>
    </motion.div>
  );
}

function EmptyCategoryMaterials({ categoryName, onAdd }: { categoryName?: string; onAdd: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border/50 bg-background/50 rounded-3xl min-h-[300px]">
      <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold">
        {categoryName ? `"${categoryName}" está vacía` : "No hay materiales"}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">Agrega el primer material a esta categoría.</p>
      <Button onClick={onAdd} size="sm" className="mt-4 gap-2">
        <PackagePlus className="h-4 w-4" /> Nuevo Material
      </Button>
    </motion.div>
  );
}

function EmptySearch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border/50 rounded-3xl min-h-[280px]">
      <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold">Sin resultados</h3>
      <p className="text-muted-foreground mt-1 text-sm">No hay materiales que coincidan con &ldquo;{query}&rdquo;.</p>
      <Button variant="link" onClick={onClear} className="mt-2">Limpiar búsqueda</Button>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DefaultMaterialsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Auth guard
  const profileRef = useMemo(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  useEffect(() => { if (!isUserLoading && !user) router.push("/login"); }, [isUserLoading, user, router]);
  useEffect(() => {
    if (!isProfileLoading && profile && !isUserLoading && user) {
      const allowed = profile.permissions?.allowedModules || [];
      if (!profile.isAdmin && !allowed.includes("inventory")) router.push("/");
    }
  }, [isProfileLoading, profile, isUserLoading, user, router]);

  // Queries
  const categoriesQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, "materialCategories"), orderBy("order", "asc")) : null,
    [firestore]
  );
  const { data: categories, isLoading: catsLoading } = useCollection<MaterialCategory>(categoriesQuery);

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return selectedCategoryId
      ? query(collection(firestore, "defaultMaterials"), where("categoryId", "==", selectedCategoryId), orderBy("name", "asc"))
      : query(collection(firestore, "defaultMaterials"), orderBy("createdAt", "desc"));
  }, [firestore, selectedCategoryId]);

  const { data: materials, isLoading: matsLoading } = useCollection<DefaultMaterial>(materialsQuery);

  // Separate query for counts (always all materials, needed for sidebar badges)
  const allMaterialsQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, "defaultMaterials"), orderBy("createdAt", "desc")) : null,
    [firestore]
  );
  const { data: allMaterials } = useCollection<DefaultMaterial>(allMaterialsQuery);

  // Derived data
  const materialCountsByCategory = useMemo(() => {
    if (!allMaterials) return {} as Record<string, number>;
    return allMaterials.reduce((acc, m) => {
      if (m.categoryId) acc[m.categoryId] = (acc[m.categoryId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [allMaterials]);

  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    if (!searchQuery.trim()) return materials;
    return materials.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [materials, searchQuery]);

  const isLoading = catsLoading || matsLoading || isUserLoading;
  const selectedCategoryName = categories?.find(c => c.id === selectedCategoryId)?.name;
  const hasAnyMaterials = materials && materials.length > 0;

  // Mobile category pills
  const MobileCategoryPills = () => (
    <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {[{ id: null, name: 'Todas' }, ...(categories || []).sort((a,b) => a.order - b.order)].map(cat => (
        <button
          key={cat.id ?? 'all'}
          onClick={() => setSelectedCategoryId(cat.id)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            selectedCategoryId === cat.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/60 text-foreground/70 hover:bg-muted'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-zinc-950/50">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-7xl p-4 md:p-8">

          {/* Page Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 md:gap-4 mb-6">
            <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm shadow-sm">
              <Link href="/projects"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="p-3 bg-primary/10 rounded-xl hidden sm:flex">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Materiales Estándar</h1>
              <p className="text-muted-foreground mt-1 text-sm">Gestiona las plantillas base para tus cálculos de inventario.</p>
            </div>
          </motion.div>

          {/* Mobile pills */}
          {!isLoading && <MobileCategoryPills />}

          {/* Main layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-4">

            {/* ── Sidebar (desktop) ── */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="hidden lg:block lg:col-span-3 lg:sticky lg:top-8">
              <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-primary/5 overflow-hidden">
                {catsLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
                  </div>
                ) : (
                  <CategorySidebar
                    categories={categories || []}
                    selectedCategoryId={selectedCategoryId}
                    onSelectCategory={setSelectedCategoryId}
                    materialCountsByCategory={materialCountsByCategory}
                  />
                )}
              </div>
            </motion.div>

            {/* ── Right Panel ── */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="lg:col-span-9 flex flex-col gap-4">

              {/* Panel toolbar */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Buscar materiales..."
                    className="h-11 pl-11 bg-white/60 dark:bg-zinc-900/60 backdrop-blur border-border/50 shadow-sm focus-visible:ring-primary/50"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={() => setCreateDialogOpen(true)} className="h-11 gap-2 shrink-0">
                  <PackagePlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nuevo Material</span>
                </Button>
              </div>

              {/* Content */}
              {isLoading ? (
                <LoadingSkeleton />
              ) : !hasAnyMaterials && !searchQuery ? (
                <EmptyCategories />
              ) : filteredMaterials.length === 0 && searchQuery ? (
                <EmptySearch query={searchQuery} onClear={() => setSearchQuery("")} />
              ) : filteredMaterials.length === 0 ? (
                <EmptyCategoryMaterials
                  categoryName={selectedCategoryName}
                  onAdd={() => setCreateDialogOpen(true)}
                />
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  <AnimatePresence>
                    {filteredMaterials.map(m => (
                      <MaterialCard key={m.id} material={m} categories={categories || []} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      {/* Global create dialog */}
      <MaterialFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        categories={categories || []}
        defaultCategoryId={selectedCategoryId ?? undefined}
      />
    </div>
  );
}
