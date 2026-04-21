"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useCollection, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, where, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Network, Settings, X, Tag } from "lucide-react";
import Link from "next/link";
import { ProcessMap, ProcessCategory, UserProfile } from "@/lib/types";
import { ProcessCard } from "@/components/procesos/process-card";
import { motion, AnimatePresence } from "framer-motion";

export default function ProcesosDirectoryPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [activeTag, setActiveTag] = useState<string | null>(null);

    const profileRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);
    const isAdmin = profile?.isAdmin || false;

    const processQ = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, "processes"), where("isPublished", "==", true));
    }, [firestore, user]);
    const { data: processes, isLoading: processesLoading } = useCollection<ProcessMap>(processQ);

    const categoryQ = useMemoFirebase(
        () => query(collection(firestore, "processCategories"), orderBy("order", "asc")),
        [firestore]
    );
    const { data: categories } = useCollection<ProcessCategory>(categoryQ);

    const categoryMap = useMemo(() => {
        const map: Record<string, ProcessCategory> = {};
        categories?.forEach((c) => { map[c.id] = c; });
        return map;
    }, [categories]);

    const sorted = useMemo(() => {
        if (!processes) return [];
        return [...processes].sort((a, b) => {
            const da = a.updatedAt instanceof Date ? a.updatedAt : (a.updatedAt as any)?.toDate?.() || new Date(0);
            const db = b.updatedAt instanceof Date ? b.updatedAt : (b.updatedAt as any)?.toDate?.() || new Date(0);
            return db.getTime() - da.getTime();
        });
    }, [processes]);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        processes?.forEach(p => {
            if (p.tags) p.tags.forEach(t => tags.add(t));
        });
        return Array.from(tags).sort();
    }, [processes]);

    const filtered = useMemo(() => {
        return sorted.filter((p) => {
            const matchesSearch =
                p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.description.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory ? p.category === activeCategory : true;
            const matchesTag = activeTag ? (p.tags && p.tags.includes(activeTag)) : true;
            return matchesSearch && matchesCategory && matchesTag;
        });
    }, [sorted, searchTerm, activeCategory, activeTag]);

    if (isUserLoading || processesLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        router.push("/login");
        return null;
    }

    return (
        <>
            <Header />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
                <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-screen-2xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Network className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                    Directorio de Procesos
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {sorted.length} {sorted.length === 1 ? "proceso disponible" : "procesos disponibles"}
                                </p>
                            </div>
                        </div>
                        {isAdmin && (
                            <Button asChild variant="outline" className="gap-2 shrink-0">
                                <Link href="/procesos/admin">
                                    <Settings className="w-4 h-4" />
                                    Panel Admin
                                </Link>
                            </Button>
                        )}
                    </div>

                    {/* Search + Category chips */}
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search-processes"
                                placeholder="Buscar proceso por nombre o descripción…"
                                className="pl-9 bg-white h-11 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Category filter chips */}
                        {(categories?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setActiveCategory(null)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                                        !activeCategory
                                            ? "bg-primary text-white border-primary"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
                                    }`}
                                >
                                    Todos
                                </button>
                                {categories?.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
                                        style={{
                                            backgroundColor: activeCategory === cat.id ? cat.color : "white",
                                            color: activeCategory === cat.id ? "white" : cat.color,
                                            borderColor: cat.color,
                                        }}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Tags filter chips */}
                        <div className="flex flex-wrap gap-2 pt-1 items-center min-h-[32px]">
                            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" /> Etiquetas:
                            </span>
                            {allTags.length > 0 ? (
                                allTags.map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                                            activeTag === tag
                                                ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                        }`}
                                    >
                                        #{tag}
                                    </button>
                                ))
                            ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                    {isAdmin ? "No hay etiquetas asignadas. Pulsa en Panel Admin para agregarlas." : "No hay etiquetas disponibles."}
                                </span>
                            )}
                            {activeTag && (
                                <button 
                                    onClick={() => setActiveTag(null)}
                                    className="text-[10px] text-primary hover:underline font-medium ml-2"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Grid */}
                    <AnimatePresence mode="wait">
                        {filtered.length === 0 ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="col-span-full flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-4 border border-dashed rounded-xl bg-white/50"
                            >
                                <Network className="w-12 h-12 opacity-20" />
                                <div>
                                    <p className="font-semibold text-slate-700">Sin resultados</p>
                                    <p className="text-sm mt-1">No se encontraron procesos con los filtros actuales.</p>
                                </div>
                                {(searchTerm || activeCategory || activeTag) && (
                                    <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setActiveCategory(null); setActiveTag(null); }}>
                                        Limpiar filtros
                                    </Button>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="grid"
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                            >
                                {filtered.map((process, i) => (
                                    <ProcessCard
                                        key={process.id}
                                        process={process}
                                        category={process.category ? categoryMap[process.category] : undefined}
                                        animationDelay={i * 0.04}
                                        showViewButton={true}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </>
    );
}
