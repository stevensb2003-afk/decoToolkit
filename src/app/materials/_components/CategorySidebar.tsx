'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, FolderOpen, ChevronRight, Layers } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { MaterialCategory } from '@/lib/types';
import {
  createMaterialCategory,
  updateMaterialCategory,
  deleteMaterialCategory,
} from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategorySidebarProps {
  categories: MaterialCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  materialCountsByCategory: Record<string, number>;
}

interface CategoryFormState {
  name: string;
  description: string;
  order: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  materialCountsByCategory,
}: CategorySidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CategoryFormState>({ name: '', description: '', order: 0 });

  const totalCount = Object.values(materialCountsByCategory).reduce((a, b) => a + b, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', order: categories.length });
    setDialogOpen(true);
  };

  const openEdit = (cat: MaterialCategory) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', order: cat.order });
    setDialogOpen(true);
  };

  const openDelete = (cat: MaterialCategory) => {
    setDeleteTarget(cat);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const result = editing
        ? await updateMaterialCategory(editing.id, form)
        : await createMaterialCategory(form);
      if (result?.success) {
        toast({ title: editing ? 'Categoría actualizada' : 'Categoría creada' });
        setDialogOpen(false);
      } else {
        toast({ title: 'Error', description: result?.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error inesperado', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await deleteMaterialCategory(deleteTarget.id);
      if (result?.success) {
        toast({ title: 'Categoría eliminada' });
        if (selectedCategoryId === deleteTarget.id) onSelectCategory(null);
      } else {
        toast({ title: 'Error', description: result?.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error inesperado', variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const deleteCount = deleteTarget ? (materialCountsByCategory[deleteTarget.id] ?? 0) : 0;

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2 mb-0.5">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Categorías</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{categories.length} categorías</p>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {/* "Todas" */}
          <motion.button
            onClick={() => onSelectCategory(null)}
            whileHover={{ x: 2 }}
            className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all group ${
              selectedCategoryId === null
                ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                : 'text-foreground/70 hover:bg-muted hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span>Todas</span>
            </div>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
              selectedCategoryId === null
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted-foreground/20 text-muted-foreground'
            }`}>
              {totalCount}
            </span>
          </motion.button>

          {/* Category list */}
          <AnimatePresence>
            {sorted.map((cat) => {
              const count = materialCountsByCategory[cat.id] ?? 0;
              const isActive = selectedCategoryId === cat.id;
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="group relative flex items-center rounded-lg transition-all"
                >
                  <button
                    onClick={() => onSelectCategory(cat.id)}
                    className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                      isActive
                        ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? 'rotate-90' : ''}`} />
                      <span className="truncate">{cat.name}</span>
                    </div>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  </button>
                  {/* Hover actions */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 transition-opacity gap-0.5 bg-background/95 backdrop-blur rounded-md border border-border/50 p-0.5 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); openEdit(cat); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDelete(cat); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/40">
          <Button onClick={openCreate} variant="outline" size="sm" className="w-full gap-2 h-9 text-xs font-medium border-dashed hover:border-primary/50 hover:text-primary hover:bg-primary/5">
            <Plus className="h-3.5 w-3.5" /> Nueva Categoría
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre *</label>
              <Input placeholder="ej. WPC 19mm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descripción</label>
              <Input placeholder="Descripción opcional" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Orden</label>
              <Input type="number" min={0} value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La categoría <strong className="text-foreground">{deleteTarget?.name}</strong> será eliminada.
              {deleteCount > 0 && (
                <span className="block mt-2 text-amber-500 font-medium">
                  ⚠️ Esta categoría tiene {deleteCount} material{deleteCount !== 1 ? 'es' : ''} asignado{deleteCount !== 1 ? 's' : ''}. Los materiales quedarán sin categoría.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
