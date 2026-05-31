import React from 'react';
import { Folder, Trash2, Undo, Redo, Download, RotateCw, Scissors, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { EditProjectSheet } from './sheets/EditProjectSheet';
import { ObstaclesSheet, ObstacleIcon } from './sheets/ObstaclesSheet';
import { GuideSettingsPopover } from './ToolbarComponents';
import { convertFromCm } from '@/lib/utils';
import type { Material } from '@/lib/types';

export function EditorTopBar({
  router,
  project,
  surfaces,
  activeSurface,
  activeSurfacePieces,
  activeSurfaceObstacles,
  es,
  canUndo,
  canRedo,
  isUndoingOrRedoing,
  undo,
  redo,
  handleClearAll,
  handleStartDrawingObstacle,
  handleEditObstacle,
  handleDeleteObstacle,
  isObstaclesSheetOpen,
  setIsObstaclesSheetOpen,
  handleRotateMaterial,
  setCuttingMaterial,
  handleDownloadPDF
}: {
  router: any;
  project: any;
  surfaces: any[];
  activeSurface: any;
  activeSurfacePieces: any[];
  activeSurfaceObstacles: any[];
  es: any;
  canUndo: boolean;
  canRedo: boolean;
  isUndoingOrRedoing: boolean;
  undo: () => void;
  redo: () => void;
  handleClearAll: () => void;
  handleStartDrawingObstacle: () => void;
  handleEditObstacle: (o: any) => void;
  handleDeleteObstacle: (id: string) => void;
  isObstaclesSheetOpen: boolean;
  setIsObstaclesSheetOpen: (v: boolean) => void;
  handleRotateMaterial: () => void;
  setCuttingMaterial: (m: Material) => void;
  handleDownloadPDF: () => void;
}) {
  return (
    <div className="flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => router.push('/projects')}>
              <Folder className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Mis Proyectos</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <EditProjectSheet project={project} surfaces={surfaces} />
      <Separator orientation="vertical" className="h-8" />

      <div className="flex items-center gap-2">
        <TooltipProvider>
          {/* Surface selector */}
          {surfaces.length > 0 && (
            <Select value={es.activeSurfaceId ?? ''} onValueChange={es.setActiveSurfaceId}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Seleccionar Superficie" />
              </SelectTrigger>
              <SelectContent>
                {surfaces.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Clear canvas */}
          <AlertDialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="hover:text-red-600"
                      disabled={activeSurfacePieces.length === 0 && !(project.remnants?.length)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Limpiar Lienzo y Cortes</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán todas las piezas de «{activeSurface?.name}» y todos los cortes del proyecto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>Continuar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Separator orientation="vertical" className="h-6 mx-2" />

          {/* Undo / Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={undo} disabled={!canUndo || isUndoingOrRedoing}>
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Deshacer (Ctrl+Z)</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={redo} disabled={!canRedo || isUndoingOrRedoing}>
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Rehacer (Ctrl+Y)</p></TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-2" />

          {/* Obstacles Sheet */}
          <ObstaclesSheet
            project={project}
            obstacles={activeSurfaceObstacles}
            activeSurface={activeSurface}
            onStartDrawing={handleStartDrawingObstacle}
            onEditObstacle={handleEditObstacle}
            isOpen={isObstaclesSheetOpen}
            onOpenChange={setIsObstaclesSheetOpen}
            onDeleteObstacle={handleDeleteObstacle}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setIsObstaclesSheetOpen(true)} className="flex-shrink-0">
                <ObstacleIcon className="h-4 w-4 text-orange-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Gestor de Obstáculos</p></TooltipContent>
          </Tooltip>

          {/* Guide settings */}
          <GuideSettingsPopover
            showGrid={es.showGrid}
            gridSpacing={es.gridSpacing}
            onShowGridChange={es.setShowGrid}
            onGridSpacingChange={es.setGridSpacing}
            isGridSnapActive={es.isGridSnapActive}
            onGridSnapChange={es.setIsGridSnapActive}
          />

          <Separator orientation="vertical" className="h-6 mx-2" />

          {/* Material selector */}
          <div className="flex items-center gap-2">
            <Select
              value={es.activeBrush?.type === 'material' ? es.activeBrush.id : 'none'}
              onValueChange={value => {
                if (value === 'none') { es.setActiveBrush(null); return; }
                const mat = project.materials.find((m: any) => m.id === value);
                if (mat) es.handleSetActiveBrush({ ...mat, type: 'material' });
              }}
            >
              <SelectTrigger className="w-[220px] h-10 bg-muted/50 border-muted-foreground/20">
                <SelectValue placeholder="Material Activo">
                  {es.activeBrush?.type === 'material' ? (
                    <div className="flex items-center gap-2 text-left w-full overflow-hidden">
                      <span className="h-4 w-4 rounded-full shadow-sm shrink-0" style={{ backgroundColor: es.activeBrush.color }} />
                      <div className="flex flex-col min-w-0 leading-tight">
                        <span className="truncate font-medium text-xs">{es.activeBrush.name}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {convertFromCm(es.activeBrush.width, 'm').toFixed(2)}m x {convertFromCm(es.activeBrush.height, 'm').toFixed(2)}m
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Elegir Material</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-muted-foreground italic font-normal">
                  Ninguno (Deseleccionar)
                </SelectItem>
                <Separator className="my-1 ring-1 ring-muted" />
                {project.materials.map((mat: any) => (
                  <SelectItem key={mat.id} value={mat.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: mat.color }} />
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">{mat.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {convertFromCm(mat.width, 'm').toFixed(2)}m x {convertFromCm(mat.height, 'm').toFixed(2)}m
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {es.activeBrush?.type === 'material' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => es.setActiveBrush(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Deseleccionar Material</p></TooltipContent>
              </Tooltip>
            )}

            {es.activeBrush?.type === 'material' && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleRotateMaterial}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Rotar Veta</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9"
                      onClick={() => setCuttingMaterial(es.activeBrush as Material)}>
                      <Scissors className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Cortar Material</p></TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </TooltipProvider>
      </div>

      <div className="flex-grow" />

      {/* Mode toggles */}
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Switch id="fill-mode" checked={es.isFillMode} onCheckedChange={es.setIsFillMode} className="scale-90" />
          <Label htmlFor="fill-mode" className="text-[11px] leading-tight select-none cursor-pointer whitespace-normal max-w-[70px]">
            Modo<br />Relleno
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="snap-mode" checked={es.isObstacleSnapActive} onCheckedChange={es.setIsObstacleSnapActive} className="scale-90" />
          <Label htmlFor="snap-mode" className="text-[11px] leading-tight select-none cursor-pointer whitespace-normal max-w-[70px]">
            Alinear a<br />obstáculos
          </Label>
        </div>
      </div>

      {/* PDF Download */}
      <div className="ml-auto flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={handleDownloadPDF} title="Descargar Reporte PDF">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
