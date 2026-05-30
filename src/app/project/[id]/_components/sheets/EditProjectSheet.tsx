'use client';

import { useState, useCallback, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { initializeFirebaseClient } from '@/firebase';
import { cleanPayload } from '../../_utils/clean-payload';
import type { Project, Surface, Material } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { serverTimestamp } from 'firebase/firestore';

// ---- Types ----
interface EditProjectSheetProps {
  project: Project;
  surfaces: Surface[];
}

// ---- Helpers ----
function emptyMaterial(): Material {
  return {
    id: uuidv4(),
    name: '',
    width: 120,
    height: 240,
    color: '#94a3b8',
    installationOrientation: 'Vertical',
  };
}

function emptySurface(): Surface {
  return { id: uuidv4(), name: '', width: 100, height: 100 };
}

// ---- Sub-components ----
function SurfaceRow({
  surface,
  onChange,
  onDelete,
}: {
  surface: Surface;
  onChange: (s: Surface) => void;
  onDelete: () => void;
}) {
  const [wStr, setWStr] = useState((surface.width / 100).toString());
  const [hStr, setHStr] = useState((surface.height / 100).toString());

  useEffect(() => { setWStr((surface.width / 100).toString()); }, [surface.width]);
  useEffect(() => { setHStr((surface.height / 100).toString()); }, [surface.height]);

  return (
    <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
      <Input
        placeholder="Nombre"
        value={surface.name}
        onChange={e => onChange({ ...surface, name: e.target.value })}
        className="h-8 text-xs"
      />
      <Input
        type="number" step="0.01" placeholder="Ancho (m)"
        value={wStr}
        onChange={e => setWStr(e.target.value)}
        onBlur={e => {
           const num = Number(e.target.value);
           if (!isNaN(num)) onChange({ ...surface, width: Math.round(num * 100) });
           else setWStr((surface.width / 100).toString());
        }}
        className="h-8 text-xs"
      />
      <Input
        type="number" step="0.01" placeholder="Alto (m)"
        value={hStr}
        onChange={e => setHStr(e.target.value)}
        onBlur={e => {
           const num = Number(e.target.value);
           if (!isNaN(num)) onChange({ ...surface, height: Math.round(num * 100) });
           else setHStr((surface.height / 100).toString());
        }}
        className="h-8 text-xs"
      />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

function MaterialRow({
  material,
  onChange,
  onDelete,
}: {
  material: Material;
  onChange: (m: Material) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-1.5 p-2 rounded-md border border-border bg-muted/30">
      <div className="flex gap-2">
        <Input
          placeholder="Nombre del material"
          value={material.name}
          onChange={e => onChange({ ...material, name: e.target.value })}
          className="h-8 text-xs flex-1"
        />
        <input
          type="color"
          value={material.color}
          onChange={e => onChange({ ...material, color: e.target.value })}
          className="h-8 w-10 rounded border border-border cursor-pointer bg-transparent"
          title="Color"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Ancho (cm)</Label>
          <Input type="number" value={material.width}
            onChange={e => onChange({ ...material, width: Number(e.target.value) })}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Alto (cm)</Label>
          <Input type="number" value={material.height}
            onChange={e => onChange({ ...material, height: Number(e.target.value) })}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Orientación</Label>
          <Select value={material.installationOrientation}
            onValueChange={v => onChange({ ...material, installationOrientation: v as Material['installationOrientation'] })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Vertical" className="text-xs">Vertical</SelectItem>
              <SelectItem value="Horizontal" className="text-xs">Horizontal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
export function EditProjectSheet({ project, surfaces: initialSurfaces }: EditProjectSheetProps) {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState(project.projectName);
  const [clientName, setClientName] = useState(project.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(project.clientPhone ?? '');
  const [surfaces, setSurfaces] = useState<Surface[]>(initialSurfaces);
  const [materials, setMaterials] = useState<Material[]>(project.materials);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { firestore } = initializeFirebaseClient();
      const batch = writeBatch(firestore);
      const projectRef = doc(firestore, 'projects', project.id);

      // Update project doc
      batch.update(projectRef, cleanPayload({
        projectName,
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        materials,
        updatedAt: serverTimestamp(),
      }));

      // Overwrite surfaces sub-collection by updating project-level surfaces array
      // (Surfaces stored as sub-collection — write each)
      for (const surface of surfaces) {
        const sRef = doc(firestore, 'projects', project.id, 'surfaces', surface.id);
        batch.set(sRef, cleanPayload(surface), { merge: true });
      }

      await batch.commit();
      setOpen(false);
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setSaving(false);
    }
  }, [project.id, projectName, clientName, clientPhone, materials, surfaces]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Editar proyecto</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base">Editar proyecto</SheetTitle>
        </SheetHeader>
        <Separator />

        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-5">
            {/* Project Info */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Información</p>
              <div className="space-y-2">
                <Label className="text-xs">Nombre del proyecto</Label>
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Cliente</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} className="h-8 text-sm" placeholder="Nombre" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Teléfono</Label>
                  <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="h-8 text-sm" placeholder="+506 0000-0000" />
                </div>
              </div>
            </section>

            <Separator />

            {/* Surfaces */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Superficies</p>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => setSurfaces(p => [...p, emptySurface()])}>
                  <Plus className="h-3 w-3" /> Agregar
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 px-1">
                <span className="text-[10px] text-muted-foreground">Nombre</span>
                <span className="text-[10px] text-muted-foreground">Ancho (m)</span>
                <span className="text-[10px] text-muted-foreground">Alto (m)</span>
                <span />
              </div>
              <div className="space-y-1.5">
                {surfaces.map(s => (
                  <SurfaceRow key={s.id} surface={s}
                    onChange={updated => setSurfaces(p => p.map(x => x.id === updated.id ? updated : x))}
                    onDelete={() => setSurfaces(p => p.filter(x => x.id !== s.id))}
                  />
                ))}
              </div>
            </section>

            <Separator />

            {/* Materials */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materiales</p>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => setMaterials(p => [...p, emptyMaterial()])}>
                  <Plus className="h-3 w-3" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {materials.map(m => (
                  <MaterialRow key={m.id} material={m}
                    onChange={updated => setMaterials(p => p.map(x => x.id === updated.id ? updated : x))}
                    onDelete={() => setMaterials(p => p.filter(x => x.id !== m.id))}
                  />
                ))}
              </div>
            </section>
            <div className="h-4" />
          </div>
        </ScrollArea>

        <Separator />
        <div className="px-4 py-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
