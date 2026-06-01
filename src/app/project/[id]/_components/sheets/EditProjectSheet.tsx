'use client';

import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Plus, Layers } from 'lucide-react';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { initializeFirebaseClient } from '@/firebase';
import { cleanPayload } from '../../_utils/clean-payload';
import type { Project, Surface, Material } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { SurfaceRow, MaterialRow } from './EditProjectSheet.rows';
import { CatalogMaterialPicker, defaultMaterialToProjectMaterial } from './CatalogMaterialPicker';

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
    height: 244,
    color: '#94a3b8',
    installationOrientation: 'Vertical',
    defaultMaterialId: 'custom',
  };
}

function emptySurface(): Surface {
  return { id: uuidv4(), name: '', width: 100, height: 100 };
}



// ---- Main Component ----
export function EditProjectSheet({ project, surfaces: initialSurfaces }: EditProjectSheetProps) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-border/60 hover:!bg-primary/10 hover:!text-primary hover:!border-primary/40"
                    onClick={() => setPickerOpen(true)}>
                    <Layers className="h-3 w-3" /> Del catálogo
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:!bg-muted/40 hover:!text-foreground"
                    title="Material personalizado"
                    onClick={() => setMaterials(p => [...p, emptyMaterial()])}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {materials.map(m => (
                  <MaterialRow key={m.id} material={m} projectId={project.id}
                    onChange={updated => setMaterials(p => p.map(x => x.id === updated.id ? updated : x))}
                    onDelete={() => setMaterials(p => p.filter(x => x.id !== m.id))}
                  />
                ))}
              </div>
            </section>

            <CatalogMaterialPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              existingMaterialDefaultIds={materials
                .map(m => m.defaultMaterialId)
                .filter((id): id is string => !!id && id !== 'custom')}
              onConfirm={(selectedDefaults) => {
                const newMaterials = selectedDefaults.map(defaultMaterialToProjectMaterial);
                setMaterials(prev => [...prev, ...newMaterials]);
                setPickerOpen(false);
              }}
            />
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
