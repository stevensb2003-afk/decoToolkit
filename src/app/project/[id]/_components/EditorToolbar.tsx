'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FolderOpen, Undo2, Redo2, Trash2, Download, RotateCw,
  Scissors, Grid3X3, ChevronDown,
} from 'lucide-react';
import type { Project, Surface, PlacedPiece, Brush, Obstacle } from '@/lib/types';

// ---- Types ----
interface EditorToolbarProps {
  project: Project | null;
  surfaces: Surface[];
  activeSurface: Surface | null;
  activeSurfaceId: string | null;
  onSurfaceChange: (id: string) => void;
  activeSurfacePieces: PlacedPiece[];
  activeBrush: Brush | null;
  onSetActiveBrush: (brush: Brush) => void;
  onClearAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isUndoingOrRedoing: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRotateMaterial: () => void;
  onDownloadPDF: () => void;
  isFillMode: boolean;
  onFillModeChange: (v: boolean) => void;
  isObstacleSnapActive: boolean;
  onObstacleSnapChange: (v: boolean) => void;
  showGrid: boolean;
  gridSpacing: number;
  onGridChange: (showGrid: boolean, spacing: number) => void;
  isGridSnapActive: boolean;
  onGridSnapChange: (active: boolean) => void;
  onStartDrawingObstacle: () => void;
  onEditObstacle: (o: Obstacle) => void;
  obstacles: Obstacle[];
  isObstaclesSheetOpen: boolean;
  onObstaclesSheetOpenChange: (open: boolean) => void;
}

// ---- Sub-components ----
function GuideSettingsPopover({
  showGrid,
  gridSpacing,
  onGridChange,
  isGridSnapActive,
  onGridSnapChange,
}: {
  showGrid: boolean;
  gridSpacing: number;
  onGridChange: (show: boolean, spacing: number) => void;
  isGridSnapActive: boolean;
  onGridSnapChange: (active: boolean) => void;
}) {
  const predefinedSpacings = [
    { label: '10cm', value: 10 },
    { label: '25cm', value: 25 },
    { label: '50cm', value: 50 },
    { label: '1m', value: 100 },
    { label: '2m', value: 200 },
    { label: '5m', value: 500 },
  ];

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Configurar cuadrícula</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-4 rounded-xl shadow-lg border-muted" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Mostrar Guías</h4>
            <Switch
              checked={showGrid}
              onCheckedChange={v => onGridChange(v, gridSpacing)}
              className="scale-110"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alinear a Cuadrícula</Label>
            <Switch
              checked={isGridSnapActive}
              onCheckedChange={onGridSnapChange}
              disabled={!showGrid}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Espaciado</Label>
            <div className="grid grid-cols-2 gap-2">
              {predefinedSpacings.map(sp => (
                <Button
                  key={sp.value}
                  variant={gridSpacing === sp.value ? "default" : "secondary"}
                  className={`h-9 text-sm font-medium ${gridSpacing === sp.value ? "bg-[#38bdf8] hover:bg-[#0ea5e9] text-white" : "bg-muted/50 hover:bg-muted text-foreground"}`}
                  onClick={() => onGridChange(showGrid, sp.value)}
                >
                  {sp.label}
                </Button>
              ))}
            </div>
          </div>
          
          <p className="text-[11px] text-muted-foreground italic leading-tight mt-2">
            Las guías visuales ayudan a medir distancias y alinear elementos proporcionalmente.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---- Main Component ----
export function EditorToolbar({
  project,
  surfaces,
  activeSurface,
  activeSurfaceId,
  onSurfaceChange,
  activeBrush,
  onClearAll,
  canUndo,
  canRedo,
  isUndoingOrRedoing,
  onUndo,
  onRedo,
  onRotateMaterial,
  onDownloadPDF,
  isFillMode,
  onFillModeChange,
  isObstacleSnapActive,
  onObstacleSnapChange,
  showGrid,
  gridSpacing,
  onGridChange,
  isGridSnapActive,
  onGridSnapChange,
}: EditorToolbarProps) {
  const router = useRouter();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-16 flex items-center gap-2 px-3 border-b border-border bg-background flex-shrink-0 overflow-x-auto">

        {/* Navigation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"
              onClick={() => router.push('/projects')}>
              <FolderOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ir a Proyectos</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Surface Select */}
        <Select value={activeSurfaceId ?? ''} onValueChange={onSurfaceChange}>
          <SelectTrigger className="h-8 w-36 text-xs flex-shrink-0">
            <SelectValue placeholder="Superficie..." />
          </SelectTrigger>
          <SelectContent>
            {surfaces.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        {/* Undo / Redo */}
        <div className="flex gap-1 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={onUndo} disabled={!canUndo || isUndoingOrRedoing}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deshacer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={onRedo} disabled={!canRedo || isUndoingOrRedoing}>
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rehacer</TooltipContent>
          </Tooltip>
        </div>

        {/* Clear All */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Limpiar lienzo</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Limpiar el lienzo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán todas las piezas colocadas en esta superficie. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onClearAll} className="bg-destructive hover:bg-destructive/90">
                Limpiar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Separator orientation="vertical" className="h-6" />

        {/* Guide Settings */}
        <GuideSettingsPopover
          showGrid={showGrid}
          gridSpacing={gridSpacing}
          onGridChange={onGridChange}
          isGridSnapActive={isGridSnapActive}
          onGridSnapChange={onGridSnapChange}
        />

        <Separator orientation="vertical" className="h-6" />

        {/* Material Tools — visible only when a material brush is active */}
        {activeBrush?.type === 'material' && (
          <>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={onRotateMaterial}>
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotar material</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Scissors className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modo corte</TooltipContent>
              </Tooltip>
            </div>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}

        {/* Fill Mode */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            id="fill-mode"
            checked={isFillMode}
            onCheckedChange={onFillModeChange}
            className="scale-90"
          />
          <Label htmlFor="fill-mode" className="text-xs cursor-pointer whitespace-nowrap">
            Modo relleno
          </Label>
        </div>

        {/* Obstacle Snap */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            id="obstacle-snap"
            checked={isObstacleSnapActive}
            onCheckedChange={onObstacleSnapChange}
            className="scale-90"
          />
          <Label htmlFor="obstacle-snap" className="text-xs cursor-pointer whitespace-nowrap">
            Snap obstáculos
          </Label>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Download PDF */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0"
              onClick={onDownloadPDF}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Descargar PDF</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
