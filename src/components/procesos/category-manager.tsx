"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { ProcessCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Loader2 } from "lucide-react";

const PRESET_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
    "#64748b", "#ef4444",
];

interface CategoryManagerProps {
    /** Total process counts per category to show usage warnings */
    processCategoryIds?: string[];
}

export function CategoryManager({ processCategoryIds = [] }: CategoryManagerProps) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const q = useMemoFirebase(
        () => query(collection(firestore, "processCategories"), orderBy("order", "asc")),
        [firestore]
    );
    const { data: categories, isLoading } = useCollection<ProcessCategory>(q);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ProcessCategory | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProcessCategory | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [form, setForm] = useState({ name: "", color: PRESET_COLORS[0] });

    const openCreate = () => {
        setEditingCategory(null);
        setForm({ name: "", color: PRESET_COLORS[0] });
        setDialogOpen(true);
    };

    const openEdit = (cat: ProcessCategory) => {
        setEditingCategory(cat);
        setForm({ name: cat.name, color: cat.color });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast({ title: "Error", description: "El nombre es obligatorio.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            if (editingCategory) {
                await updateDoc(doc(firestore, "processCategories", editingCategory.id), {
                    name: form.name.trim(),
                    color: form.color,
                    updatedAt: new Date(),
                });
                toast({ title: "Categoría actualizada" });
            } else {
                const order = (categories?.length ?? 0) + 1;
                await addDoc(collection(firestore, "processCategories"), {
                    name: form.name.trim(),
                    color: form.color,
                    order,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                toast({ title: "Categoría creada" });
            }
            setDialogOpen(false);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(firestore, "processCategories", deleteTarget.id));
            toast({ title: "Categoría eliminada" });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setDeleteTarget(null);
        }
    };

    const usageCount = (catId: string) =>
        processCategoryIds.filter((id) => id === catId).length;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Tag className="w-4 h-4 text-primary" />
                    Categorías ({categories?.length ?? 0})
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openCreate}>
                    <Plus className="w-3 h-3" /> Nueva
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            ) : categories?.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                    No hay categorías. Crea la primera.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {categories?.map((cat) => {
                        const count = usageCount(cat.id);
                        return (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: cat.color }}
                                    />
                                    <span className="text-sm font-medium text-slate-700 truncate">
                                        {cat.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {count} proceso{count !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => openEdit(cat)}
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteTarget(cat)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? "Editar categoría" : "Nueva categoría"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="cat-name">Nombre</Label>
                            <Input
                                id="cat-name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ej. Ventas, Producción…"
                                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setForm({ ...form, color: c })}
                                        className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                                        style={{
                                            backgroundColor: c,
                                            borderColor: form.color === c ? "#1e293b" : "transparent",
                                        }}
                                        title={c}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                            {editingCategory ? "Guardar cambios" : "Crear categoría"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {usageCount(deleteTarget?.id ?? "") > 0 ? (
                                <>
                                    <strong>Advertencia:</strong> Esta categoría está asignada a{" "}
                                    <strong>{usageCount(deleteTarget?.id ?? "")} proceso(s)</strong>.
                                    Los procesos no serán eliminados, pero quedarán sin categoría.
                                </>
                            ) : (
                                <>La categoría <strong>{deleteTarget?.name}</strong> será eliminada permanentemente.</>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
