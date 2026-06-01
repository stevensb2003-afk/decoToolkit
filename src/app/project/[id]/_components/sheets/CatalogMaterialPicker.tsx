'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Search, Layers } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { DefaultMaterial, MaterialCategory, Material } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

// ── Snapshot converter ──────────────────────────────────────────────────────
export function defaultMaterialToProjectMaterial(dm: DefaultMaterial): Material {
  return {
    id: uuidv4(),
    name: dm.name,
    width: dm.width,
    height: dm.height,
    color: dm.color ?? '#94a3b8',
    installationOrientation: 'Vertical',
    defaultMaterialId: dm.id,
    texture: dm.texture,
  };
}

// ── Props ───────────────────────────────────────────────────────────────────
interface CatalogMaterialPickerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (materials: DefaultMaterial[]) => void;
  existingMaterialDefaultIds?: string[];
}

// ── Material Card ───────────────────────────────────────────────────────────
function MaterialCard({
  material,
  selected,
  alreadyAdded,
  onToggle,
}: {
  material: DefaultMaterial;
  selected: boolean;
  alreadyAdded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={alreadyAdded}
      className={cn(
        'relative flex flex-col gap-2 p-2.5 rounded-lg border text-left transition-all',
        'hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary',
        !selected && !alreadyAdded && 'border-border bg-muted/20',
        alreadyAdded && 'opacity-50 cursor-not-allowed border-border',
      )}
    >
      {/* Color/Texture Preview */}
      <div
        className="w-full h-10 rounded-md overflow-hidden shrink-0"
        style={{ background: material.color ?? '#94a3b8' }}
      >
        {material.texture?.url && (
          <img
            src={material.texture.url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className="text-xs font-medium truncate leading-tight">{material.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {material.width} × {material.height} cm
        </p>
        {alreadyAdded && (
          <Badge variant="secondary" className="text-[9px] mt-1 px-1 py-0">Ya agregado</Badge>
        )}
      </div>

      {/* Checkmark */}
      {selected && (
        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function CatalogMaterialPicker({
  open,
  onOpenChange,
  onConfirm,
  existingMaterialDefaultIds = [],
}: CatalogMaterialPickerProps) {
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Queries
  const materialsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'defaultMaterials')) : null),
    [firestore],
  );
  const categoriesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'materialCategories'), orderBy('order')) : null),
    [firestore],
  );

  const { data: materials } = useCollection<DefaultMaterial>(materialsQuery);
  const { data: categories } = useCollection<MaterialCategory>(categoriesQuery);

  // Filtered materials
  const filtered = useMemo(() => {
    if (!materials) return [];
    return materials.filter(m => {
      const matchesSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !activeCategoryId || m.categoryId === activeCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [materials, search, activeCategoryId]);

  const toggleMaterial = (id: string) => {
    if (existingMaterialDefaultIds.includes(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedMaterials = (materials ?? []).filter(m => selected.has(m.id));
    onConfirm(selectedMaterials);
    setSelected(new Set());
    setSearch('');
    setActiveCategoryId(null);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelected(new Set());
    setSearch('');
    setActiveCategoryId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] flex flex-col p-0 gap-0 max-h-[90vh]">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Agregar materiales del catálogo
          </DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar: Categories */}
          <div className="w-40 shrink-0 border-r">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-0.5">
                <button
                  type="button"
                  onClick={() => setActiveCategoryId(null)}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors',
                    !activeCategoryId
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted text-foreground',
                  )}
                >
                  Todas
                </button>
                {(categories ?? []).map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors',
                      activeCategoryId === cat.id
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Grid: Materials */}
          <ScrollArea className="flex-1">
            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.length === 0 && (
                <p className="col-span-4 text-xs text-muted-foreground text-center py-8">
                  No se encontraron materiales.
                </p>
              )}
              {filtered.map(m => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  selected={selected.has(m.id)}
                  alreadyAdded={existingMaterialDefaultIds.includes(m.id)}
                  onToggle={() => toggleMaterial(m.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-4 py-3 border-t flex items-center justify-between gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} seleccionado${selected.size > 1 ? 's' : ''}` : 'Ninguno seleccionado'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>Cancelar</Button>
            <Button size="sm" onClick={handleConfirm} disabled={selected.size === 0}>
              Agregar {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
