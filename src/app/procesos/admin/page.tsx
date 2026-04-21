"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useCollection, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Edit, Trash2, Network, ArrowLeft, Eye, EyeOff, Search, Settings, Tag, ChevronDown, ChevronUp, MoreVertical, X } from "lucide-react";
import Link from "next/link";
import { ProcessMap, ProcessCategory, UserProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "@/components/procesos/category-manager";
import { ProcessCard } from "@/components/procesos/process-card";

export default function ProcesosAdminPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);

    const [newProcess, setNewProcess] = useState<{ title: string; description: string; isPublished: boolean; category: string; tags: string[] }>({ title: "", description: "", isPublished: false, category: "none", tags: [] });
    const [editProcess, setEditProcess] = useState<{ id: string, title: string, description: string, isPublished: boolean, category: string, tags: string[] } | null>(null);
    const [tagInput, setTagInput] = useState("");

    const profileRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);
    const isAdmin = profile?.isAdmin || false;

    const q = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, "processes"), orderBy("updatedAt", "desc"));
    }, [firestore, user]);
    const { data: processes, isLoading } = useCollection<ProcessMap>(q);

    const categoryQ = useMemoFirebase(
        () => query(collection(firestore, "processCategories"), orderBy("order", "asc")),
        [firestore]
    );
    const { data: categories } = useCollection<ProcessCategory>(categoryQ);

    const categoryMap = useMemo(() => {
        const map: Record<string, ProcessCategory> = {};
        categories?.forEach(c => { map[c.id] = c; });
        return map;
    }, [categories]);

    const processCategoryIds = useMemo(() => processes?.map(p => p.category ?? "") ?? [], [processes]);

    const filtered = useMemo(() => {
        let list = processes ?? [];
        if (activeTab === "published") list = list.filter(p => p.isPublished);
        if (activeTab === "drafts") list = list.filter(p => !p.isPublished);
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            list = list.filter(p => p.title.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
        }
        return list;
    }, [processes, activeTab, searchTerm]);

    if (isUserLoading || isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    // 🔒 Strict admin guard
    if (!user || !isAdmin) {
        router.push("/procesos");
        return null;
    }

    const handleCreateProcess = async () => {
        if (!newProcess.title.trim()) {
            toast({ title: "Error", description: "El título es obligatorio.", variant: "destructive" });
            return;
        }
        setIsCreating(true);
        try {
            const ref = await addDoc(collection(firestore, "processes"), {
                title: newProcess.title,
                description: newProcess.description,
                isPublished: newProcess.isPublished,
                category: newProcess.category === "none" ? null : newProcess.category,
                tags: newProcess.tags,
                nodes: [],
                edges: [],
                nodeCount: 0,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: user.uid,
            });
            toast({ title: "Proceso creado" });
            setIsCreateDialogOpen(false);
            setNewProcess({ title: "", description: "", isPublished: false, category: "none", tags: [] });
            setTagInput("");
            router.push(`/procesos/admin/${ref.id}`);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditProcess = async () => {
        if (!editProcess || !editProcess.title.trim()) {
            toast({ title: "Error", description: "El título es obligatorio.", variant: "destructive" });
            return;
        }
        setIsUpdating(true);
        try {
            await updateDoc(doc(firestore, "processes", editProcess.id), {
                title: editProcess.title,
                description: editProcess.description,
                isPublished: editProcess.isPublished,
                category: editProcess.category === "none" ? null : editProcess.category,
                tags: editProcess.tags,
                updatedAt: new Date(),
            });
            toast({ title: "Proceso actualizado" });
            setIsEditDialogOpen(false);
            setEditProcess(null);
            setTagInput("");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(firestore, "processes", deleteTarget));
            toast({ title: "Proceso eliminado" });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleTogglePublish = async (process: ProcessMap) => {
        try {
            await updateDoc(doc(firestore, "processes", process.id), { isPublished: !process.isPublished, updatedAt: new Date() });
            toast({ title: process.isPublished ? "Proceso ocultado" : "Proceso publicado" });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };

    const published = processes?.filter(p => p.isPublished).length ?? 0;
    const drafts = (processes?.length ?? 0) - published;

    return (
        <>
            <Header />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
                <div className="px-4 md:px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto space-y-6">

                    {/* Breadcrumb + header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-4">
                            <Button variant="outline" size="sm" asChild className="h-9 gap-2 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
                                <Link href="/procesos">
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-semibold">Volver a Biblioteca</span>
                                </Link>
                            </Button>

                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                    <Settings className="w-6 h-6 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Gestión de Procesos</h1>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Administra y organiza tus flujos de trabajo</p>
                                </div>
                            </div>
                        </div>
                        <Button 
                            onClick={() => setIsCreateDialogOpen(true)} 
                            className="gap-2 shrink-0 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-10 px-5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus className="w-5 h-5" /> 
                            <span className="font-bold">Nuevo Proceso</span>
                        </Button>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Total", value: processes?.length ?? 0, color: "text-slate-800" },
                            { label: "Publicados", value: published, color: "text-emerald-600" },
                            { label: "Borradores", value: drafts, color: "text-slate-500" },
                        ].map(s => (
                            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
                                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Category manager collapsible */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <button
                            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-primary" /> Gestionar Categorías
                            </div>
                            {isCategoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {isCategoryOpen && (
                            <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                                <CategoryManager processCategoryIds={processCategoryIds} />
                            </div>
                        )}
                    </div>

                    {/* Search + Tabs */}
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar procesos..."
                                className="pl-9 bg-white h-10 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList>
                                <TabsTrigger value="all">Todos ({processes?.length ?? 0})</TabsTrigger>
                                <TabsTrigger value="published">Publicados ({published})</TabsTrigger>
                                <TabsTrigger value="drafts">Borradores ({drafts})</TabsTrigger>
                            </TabsList>

                            <TabsContent value={activeTab} className="mt-4">
                                {filtered.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl bg-white/50">
                                        <Network className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p>Sin resultados. {activeTab === "all" ? "Crea el primer proceso." : "Cambia el filtro."}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {filtered.map((process, i) => (
                                            <ProcessCard
                                                key={process.id}
                                                process={process}
                                                category={process.category ? categoryMap[process.category] : undefined}
                                                animationDelay={i * 0.03}
                                                showViewButton={false}
                                                actions={
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => {
                                                                // Validar que la categoría exista en el mapa, si no, usar "none"
                                                                const categoryId = process.category && categoryMap[process.category] 
                                                                    ? process.category 
                                                                    : "none";
                                                                    
                                                                setEditProcess({
                                                                    id: process.id,
                                                                    title: process.title || "",
                                                                    description: process.description || "",
                                                                    isPublished: !!process.isPublished,
                                                                    category: categoryId,
                                                                    tags: process.tags || []
                                                                });
                                                                setTagInput("");
                                                                setIsEditDialogOpen(true);
                                                            }} className="gap-2">
                                                                <Edit className="w-3.5 h-3.5" /> Editar Detalles
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/procesos/admin/${process.id}`} className="flex items-center gap-2">
                                                                    <Network className="w-3.5 h-3.5" /> Editar Mapa
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/procesos/${process.id}`} target="_blank" className="flex items-center gap-2">
                                                                    <Eye className="w-3.5 h-3.5" /> Ver Público
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleTogglePublish(process)} className="gap-2">
                                                                {process.isPublished ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar</> : <><Eye className="w-3.5 h-3.5" /> Publicar</>}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => setDeleteTarget(process.id)} className="text-destructive gap-2">
                                                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Create Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Proceso</DialogTitle>
                        <DialogDescription>Define el título, descripción y categoría. Después podrás crear el mapa de pasos.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="title">Título</Label>
                            <Input id="title" value={newProcess.title} onChange={(e) => setNewProcess({ ...newProcess, title: e.target.value })} placeholder="Ej. Flujo de Ventas" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="description">Descripción (Opcional)</Label>
                            <Textarea id="description" value={newProcess.description} onChange={(e) => setNewProcess({ ...newProcess, description: e.target.value })} placeholder="Breve explicación del objetivo." rows={3} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Categoría (Opcional)</Label>
                            <Select value={newProcess.category} onValueChange={(v) => setNewProcess({ ...newProcess, category: v })}>
                                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin categoría</SelectItem>
                                    {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tags">Etiquetas</Label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {newProcess.tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                        #{tag}
                                        <button onClick={() => setNewProcess({ ...newProcess, tags: newProcess.tags.filter(t => t !== tag) })} className="hover:text-primary/70">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <Input 
                                id="tags" 
                                value={tagInput} 
                                onChange={(e) => setTagInput(e.target.value)} 
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        const t = tagInput.trim().replace(/^#+/, '');
                                        if (t && !newProcess.tags.includes(t)) {
                                            setNewProcess({ ...newProcess, tags: [...newProcess.tags, t] });
                                        }
                                        setTagInput("");
                                    }
                                }}
                                placeholder="Escribe y presiona Enter para agregar..." 
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="isPublished" checked={newProcess.isPublished} onCheckedChange={(c) => setNewProcess({ ...newProcess, isPublished: !!c })} />
                            <Label htmlFor="isPublished" className="text-sm cursor-pointer">Publicar inmediatamente</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>Cancelar</Button>
                        <Button onClick={handleCreateProcess} disabled={isCreating}>
                            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Crear y Editar Mapa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Detalles del Proceso</DialogTitle>
                        <DialogDescription>Modifica el título, descripción, categoría y etiquetas de este proceso.</DialogDescription>
                    </DialogHeader>
                    {editProcess && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-title">Título</Label>
                                <Input id="edit-title" value={editProcess.title} onChange={(e) => setEditProcess({ ...editProcess, title: e.target.value })} placeholder="Ej. Flujo de Ventas" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-description">Descripción (Opcional)</Label>
                                <Textarea id="edit-description" value={editProcess.description} onChange={(e) => setEditProcess({ ...editProcess, description: e.target.value })} placeholder="Breve explicación del objetivo." rows={3} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Categoría (Opcional)</Label>
                                <Select value={editProcess.category} onValueChange={(v) => setEditProcess({ ...editProcess, category: v })}>
                                    <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="none">Sin categoría</SelectItem>
                                    {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-tags">Etiquetas</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {editProcess.tags.map(tag => (
                                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                            #{tag}
                                            <button onClick={() => setEditProcess({ ...editProcess, tags: editProcess.tags.filter(t => t !== tag) })} className="hover:text-primary/70">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <Input 
                                    id="edit-tags" 
                                    value={tagInput} 
                                    onChange={(e) => setTagInput(e.target.value)} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            const t = tagInput.trim().replace(/^#+/, '');
                                            if (t && !editProcess.tags.includes(t)) {
                                                setEditProcess({ ...editProcess, tags: [...editProcess.tags, t] });
                                            }
                                            setTagInput("");
                                        }
                                    }}
                                    placeholder="Escribe y presiona Enter para agregar..." 
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox id="edit-isPublished" checked={editProcess.isPublished} onCheckedChange={(c) => setEditProcess({ ...editProcess, isPublished: !!c })} />
                                <Label htmlFor="edit-isPublished" className="text-sm cursor-pointer">Proceso publicado</Label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>Cancelar</Button>
                        <Button onClick={handleEditProcess} disabled={isUpdating}>
                            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este proceso?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer. El proceso y todos sus datos serán eliminados permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
