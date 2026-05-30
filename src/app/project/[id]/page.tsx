'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  doc, collection, writeBatch, updateDoc, getDoc,
  arrayUnion, serverTimestamp, setDoc, deleteDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, convertFromCm, calculatePolygonArea } from '@/lib/utils';

// ── Hooks ──────────────────────────────────────────────────────────────────
import { useEditorData } from './_hooks/useEditorData';
import { useEditorState } from './_hooks/useEditorState';
import { useHistory } from './_hooks/useHistory';
import { useIsDesktop } from './_hooks/useIsDesktop';

// ── Utils ──────────────────────────────────────────────────────────────────
import { calculatePlacementFragments, calculateOffcuts } from './_utils/clipper-geometry';

// ── Components ─────────────────────────────────────────────────────────────
import { useProjectHydration } from './_hooks/useProjectHydration';
import { useProjectMutations } from './_hooks/useProjectMutations';
import { useKeyboardShortcuts } from './_hooks/useKeyboardShortcuts';
import { EditorSidebar } from './_components/EditorSidebar';

import { MobileProjectView } from './_components/MobileProjectView';
import { Canvas } from './_components/Canvas/Canvas';
import { CortesPanel } from './_components/CortesPanel';
import { CuttingToolDialog } from '@/components/cutting-tool-dialog';
import { Header } from '@/components/layout/header';

// ── Sheets (legacy, inline in page) ───────────────────────────────────────
import { EditProjectSheet } from './_components/sheets/EditProjectSheet';
import { ObstaclesSheet, ObstacleIcon } from './_components/sheets/ObstaclesSheet';
import { HelpDialog } from './_components/HelpDialog';
import { DrawingInputPanel } from './_components/DrawingInputPanel';


// ── UI ─────────────────────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Folder, Trash2, Undo, Redo, Download, RotateCw, Scissors, X,
  MousePointer, Eraser, Ruler, ChevronDown, ArrowUpLeft, ArrowUpRight,
  ArrowDownLeft, ArrowDownRight, Square, LineChart, Layers, Grid3X3,
  HelpCircle,
} from 'lucide-react';

import type {
  Material, PlacedPiece, Remnant, GroupedRemnant, Obstacle, Point, Brush,
  MeasureMode, PivotPoint,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
type MaterialRemnantGroup = { material: Material; remnants: GroupedRemnant[] };

// ── Sub-components (inlined, small) ──────────────────────────────────────────
function ToolButton({
  tooltip, Icon, isActive, onClick, children,
}: {
  tooltip: string;
  Icon?: React.ElementType;
  isActive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-full h-12 w-12',
              isActive && 'bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary'
            )}
            onClick={onClick}
          >
            {Icon && <Icon className="h-6 w-6" />}
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{tooltip}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const pivotIcons: Record<PivotPoint, React.ElementType> = {
  topLeft: ArrowUpLeft, topRight: ArrowUpRight,
  bottomLeft: ArrowDownLeft, bottomRight: ArrowDownRight,
};

function PivotSelector({ currentPivot, onPivotChange, isOpen, onOpenChange }: {
  currentPivot: PivotPoint;
  onPivotChange: (p: PivotPoint) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const CurrentIcon = pivotIcons[currentPivot];
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-12 w-12"
                onClick={() => onOpenChange(!isOpen)}>
                <CurrentIcon className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Punto de Pivote (Ctrl+A)</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-1">
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(pivotIcons) as PivotPoint[]).map(pivot => {
            const Icon = pivotIcons[pivot];
            return (
              <Button key={pivot} variant={currentPivot === pivot ? 'secondary' : 'ghost'}
                size="icon" className="h-10 w-10"
                onClick={() => { onPivotChange(pivot); onOpenChange(false); }}>
                <Icon className="h-5 w-5" />
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MeasureToolSelector({ isMeasureMode, measureMode, onToolSelect, isOpen, onOpenChange }: {
  isMeasureMode: boolean;
  measureMode: MeasureMode;
  onToolSelect: (tool: 'brush' | 'eraser' | 'measure' | 'hand', mode?: MeasureMode) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon"
                className={cn('rounded-full h-12 w-12', isMeasureMode && 'bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary')}
                onClick={() => {
                  if (!isMeasureMode) onToolSelect('measure');
                  onOpenChange(!isOpen);
                }}>
                <Ruler className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Medir (Ctrl+R)</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-1">
        <div className="grid grid-cols-1 gap-1">
          <Button variant={measureMode === 'area' ? 'secondary' : 'ghost'}
            className="justify-start" onClick={() => { onToolSelect('measure', 'area'); onOpenChange(false); }}>
            <Square className="mr-2 h-4 w-4" /> Medir Área
          </Button>
          <Button variant={measureMode === 'distance' ? 'secondary' : 'ghost'}
            className="justify-start" onClick={() => { onToolSelect('measure', 'distance'); onOpenChange(false); }}>
            <LineChart className="mr-2 h-4 w-4" /> Medir Distancia
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GuideSettingsPopover({
  showGrid, gridSpacing, onShowGridChange, onGridSpacingChange, isGridSnapActive, onGridSnapChange
}: {
  showGrid: boolean;
  gridSpacing: number;
  onShowGridChange: (v: boolean) => void;
  onGridSpacingChange: (v: number) => void;
  isGridSnapActive: boolean;
  onGridSnapChange: (v: boolean) => void;
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant={showGrid ? 'secondary' : 'outline'} size="icon" className="flex-shrink-0">
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Configurar cuadrícula</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-64 p-4 rounded-xl shadow-lg border-muted" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Mostrar Guías</h4>
            <Switch
              checked={showGrid}
              onCheckedChange={onShowGridChange}
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
                  onClick={() => onGridSpacingChange(sp.value)}
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

// ─────────────────────────────────────────────────────────────────────────────
export default function EditorPage() {
  const params    = useParams();
  const router    = useRouter();
  const firestore = useFirestore();
  const projectId = params.id as string;
  const isDesktop = useIsDesktop();
  const { toast } = useToast();

  // ── Data & Auth ─────────────────────────────────────────────────────────
  const {
    user, authLoading, checkingAuth, profile,
    project, surfaces, placedPieces, obstacles,
    isLoading, error,
  } = useEditorData(projectId);

  // ── Editor State ─────────────────────────────────────────────────────────
  const es = useEditorState();

  // ── History ──────────────────────────────────────────────────────────────
  const { isUndoingOrRedoing, addToHistory, undo, redo, historyIndex, history } = useHistory(
    firestore, project ?? null
  );

  // ── Local UI state ───────────────────────────────────────────────────────
  const [isDrawingObstacle, setIsDrawingObstacle]       = useState(false);
  const [editingObstacleId, setEditingObstacleId]       = useState<string | null>(null);
  const [currentObstaclePoints, setCurrentObstaclePoints] = useState<Point[]>([]);
  const [obstacleAnchorIndex, setObstacleAnchorIndex]   = useState(0);
  const [rotationAnchor, setRotationAnchor]             = useState<Point | null>(null);
  const [previewSegment, setPreviewSegment]             = useState<{ length: number; angle: number } | null>(null);
  const [isObstaclesSheetOpen, setIsObstaclesSheetOpen] = useState(false);
  const [cuttingMaterial, setCuttingMaterial]           = useState<Material | null>(null);
  const [isPivotSelectorOpen, setIsPivotSelectorOpen]   = useState(false);
  const [isMeasureToolOpen, setIsMeasureToolOpen]       = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);

  // ── Auth redirect ────────────────────────────────────────────────────────
  const {
    activeSurface, activeSurfacePieces, activeSurfaceObstacles,
    areaToCover, coveredArea, projectAreaToCover, projectCoveredArea,
    wasteArea, materialUsage, groupedRemnantsByMaterial
  } = useProjectHydration(project, surfaces, placedPieces, obstacles, es, authLoading, checkingAuth, user);

  const {
    handlePiecePlacement, handlePieceDelete, handleBatchDeletePieces,
    handleClearAll, handleRotateMaterial, handleFinishDrawingObstacle,
    handleDeleteObstacle, handleGenerateCuts
  } = useProjectMutations(
    firestore, project ?? null, activeSurface, activeSurfacePieces, activeSurfaceObstacles,
    placedPieces, obstacles, es, addToHistory, toast,
    currentObstaclePoints, editingObstacleId,
    setIsDrawingObstacle, setEditingObstacleId, setCurrentObstaclePoints, setIsObstaclesSheetOpen
  );

  useKeyboardShortcuts(historyIndex, history.length, isUndoingOrRedoing, undo, redo, es, setIsPivotSelectorOpen);

  const handleStartDrawingObstacle = useCallback(() => {
    setIsDrawingObstacle(true);
    setEditingObstacleId(null);
    setCurrentObstaclePoints([]);
  }, []);

  const handleEditObstacle = useCallback((o: Obstacle) => {
    setEditingObstacleId(o.id);
    setCurrentObstaclePoints([...o.points]);
    setObstacleAnchorIndex(0);
    setIsDrawingObstacle(true);
    setIsObstaclesSheetOpen(false);
  }, []);

  const handleAddObstacleSegment = useCallback((newPoint: Point) => {
    setCurrentObstaclePoints(prev => [...prev, newPoint]);
  }, []);

  const handleUndoObstacleSegment = useCallback(() => {
    setCurrentObstaclePoints(prev => prev.slice(0, -1));
  }, []);

  const handleUpdateObstacleStartPoint = useCallback((newPoint: Point) => {
    setCurrentObstaclePoints(prev => {
      if (prev.length === 0) return prev;
      const currentStart = prev[0];
      const dx = newPoint.x - currentStart.x;
      const dy = newPoint.y - currentStart.y;
      if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return prev;
      return prev.map(p => ({ x: p.x + dx, y: p.y + dy }));
    });
  }, []);

  const handleUpdateObstacleLastPoint = useCallback((newPoint: Point) => {
    setCurrentObstaclePoints(prev => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = newPoint;
      return copy;
    });
  }, []);

  const handleCancelObstacleDrawing = useCallback(() => {
    setIsDrawingObstacle(false);
    setEditingObstacleId(null);
    setCurrentObstaclePoints([]);
    setPreviewSegment(null);
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    if (!project || !surfaces || !placedPieces || !obstacles || !firestore) return;
    try {
      const [{ getDocs, collection: col }, { generateProjectPDF }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/pdf-report'),
      ]);
      const [surfSnap, piecesSnap, obsSnap, defMatSnap] = await Promise.all([
        getDocs(col(firestore, 'projects', project.id, 'surfaces')),
        getDocs(col(firestore, 'projects', project.id, 'placedPieces')),
        getDocs(col(firestore, 'projects', project.id, 'obstacles')),
        getDocs(col(firestore, 'defaultMaterials')),
      ]);
      await generateProjectPDF({
        project, remnants: project.remnants ?? [],
        surfaces: surfSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any),
        placedPieces: piecesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any)
          .sort((a: any, b: any) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
        obstacles: obsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any),
        defaultMaterials: defMatSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[],
        creatorName: profile?.displayName || user?.email || undefined,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error al generar PDF', variant: 'destructive' });
    }
  }, [project, surfaces, placedPieces, obstacles, firestore, profile, user, toast]);

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (isLoading || authLoading || checkingAuth) {
    return (
      <div className="flex flex-col h-screen bg-muted/40">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </main>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col h-screen bg-muted/40">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-destructive text-sm">{error.message}</p>
        </main>
      </div>
    );
  }
  if (!project || !surfaces || !placedPieces || !obstacles) return null;

  // ── Mobile guard ─────────────────────────────────────────────────────────
  if (!isDesktop) {
    return <MobileProjectView project={project} surfaces={surfaces} onDownloadPDF={handleDownloadPDF} />;
  }

  // ── Desktop layout ────────────────────────────────────────────────────────
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="flex flex-col h-screen bg-muted/40">
      <Header />
      <main className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: Resumen + Cortes ─────────────────────────────── */}
        <EditorSidebar
          es={es}
          project={project}
          areaToCover={areaToCover}
          projectAreaToCover={projectAreaToCover}
          coveredArea={coveredArea}
          projectCoveredArea={projectCoveredArea}
          wasteArea={wasteArea}
          materialUsage={materialUsage}
          groupedRemnantsByMaterial={groupedRemnantsByMaterial}
        />

        {/* ── Main area ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Top Toolbar */}
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
                      const mat = project.materials.find(m => m.id === value);
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
                      {project.materials.map(mat => (
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

          {/* Canvas area */}
          <div className="flex-1 bg-card p-2 relative overflow-hidden flex flex-col">
            <div
              ref={viewportRef}
              className={cn(
                'flex-1 relative border rounded-md overflow-hidden bg-muted/30 transition-shadow duration-200',
                es.activeBrush ? 'shadow-inner ring-1 ring-primary/20' : ''
              )}
            >
              {isDrawingObstacle && activeSurface && (
                <DrawingInputPanel
                  surfaceWidth={activeSurface.width}
                  surfaceHeight={activeSurface.height}
                  isEditing={!!editingObstacleId}
                  onAddSegment={handleAddObstacleSegment}
                  onUndoSegment={handleUndoObstacleSegment}
                  onUpdateStartPoint={handleUpdateObstacleStartPoint}
                  onUpdateLastPoint={handleUpdateObstacleLastPoint}
                  onFinish={handleFinishDrawingObstacle}
                  onCancel={handleCancelObstacleDrawing}
                  onPreviewChange={setPreviewSegment}
                  startPoint={currentObstaclePoints.length > 0 ? currentObstaclePoints[currentObstaclePoints.length - 1] : null}
                  initialPoint={currentObstaclePoints.length > 0 ? currentObstaclePoints[obstacleAnchorIndex] : null}
                  anchorIndex={obstacleAnchorIndex}
                  obstacles={activeSurfaceObstacles}
                  editingObstacleId={editingObstacleId}
                  editingObstacleName={activeSurfaceObstacles.find(o => o.id === editingObstacleId)?.name}
                  previewSegment={previewSegment}
                  currentPoints={currentObstaclePoints}
                />
              )}
              {activeSurface ? (
                <Canvas
                  surface={activeSurface}
                  pieces={activeSurfacePieces}
                  obstacles={activeSurfaceObstacles}
                  project={project}
                  editorScale={es.editorScale}
                  activeBrush={es.activeBrush}
                  brushAngle={es.brushAngle}
                  onBrushAngleChange={es.setBrushAngle}
                  pivotPoint={es.pivotPoint}
                  isFillMode={es.isFillMode}
                  isObstacleSnapActive={es.isObstacleSnapActive}
                  isDragLockActive={es.isDragLockActive}
                  isEraserMode={es.isEraserMode}
                  isMeasureMode={es.isMeasureMode}
                  measureMode={es.measureMode}
                  isHandMode={es.isHandMode}
                  isRotating={es.isRotating}
                  transformContainerRef={es.transformContainerRef}
                  handlePanMove={es.handlePanMove}
                  handleZoomMove={es.handleZoomMove}
                  commitPanZoom={es.commitPanZoom}
                  viewZoom={es.viewZoom}
                  showGrid={es.showGrid}
                  gridSpacing={es.gridSpacing}
                  isGridSnapActive={es.isGridSnapActive}
                  isDrawingObstacle={isDrawingObstacle}
                  editingObstacleId={editingObstacleId}
                  currentObstaclePoints={currentObstaclePoints}
                  onCurrentObstaclePointsChange={setCurrentObstaclePoints}
                  obstacleAnchorIndex={obstacleAnchorIndex}
                  onObstacleAnchorIndexChange={setObstacleAnchorIndex}
                  onFinishDrawingObstacle={handleFinishDrawingObstacle}
                  onPlacePiece={handlePiecePlacement}
                  onDeletePiece={handlePieceDelete}
                  onBatchDeletePieces={handleBatchDeletePieces}
                  rotationAnchor={rotationAnchor}
                  onRotationAnchorChange={setRotationAnchor}
                  onToolSelect={es.handleToolSelect}
                  isPivotSelectorOpen={isPivotSelectorOpen}
                  onPivotSelectorOpenChange={setIsPivotSelectorOpen}
                  isMeasureToolOpen={isMeasureToolOpen}
                  onMeasureToolOpenChange={setIsMeasureToolOpen}
                  previewSegment={previewSegment}
                  onPreviewChange={setPreviewSegment}
                  onUndo={undo}
                  onRedo={redo}
                  viewportRef={viewportRef}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground">
                    {surfaces.length > 0 ? 'Seleccione una superficie para comenzar' : 'Este proyecto no tiene superficies. Añada una en la configuración.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── Bottom floating toolbar ──────────────────────────────── */}
            <div className="h-20 flex items-center justify-center relative z-20 pointer-events-none bg-background/50 backdrop-blur-sm border-t">
              <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-full bg-background/95 shadow-lg border ring-1 ring-border/50 hover:scale-[1.01] transition-transform">

                {/* Seleccionar */}
                <ToolButton
                  tooltip="Seleccionar (Ctrl+V)"
                  Icon={MousePointer}
                  isActive={!es.isEraserMode && !es.isMeasureMode && !isDrawingObstacle && !es.isHandMode && !es.activeBrush}
                  onClick={() => es.handleToolSelect('brush')}
                />

                {/* Mover (Hand) */}
                <ToolButton
                  tooltip="Mover (Ctrl+H)"
                  isActive={es.isHandMode}
                  onClick={() => {
                    es.setIsHandMode(!es.isHandMode);
                    if (!es.isHandMode) { es.setIsEraserMode(false); es.setIsMeasureMode(false); es.setActiveBrush(null); }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="h-6 w-6">
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                  </svg>
                </ToolButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Borrador */}
                <ToolButton
                  tooltip="Borrador (Ctrl+E)"
                  Icon={Eraser}
                  isActive={es.isEraserMode}
                  onClick={() => es.handleToolSelect('eraser')}
                />

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Medidor */}
                <MeasureToolSelector
                  isMeasureMode={es.isMeasureMode}
                  measureMode={es.measureMode}
                  onToolSelect={es.handleToolSelect}
                  isOpen={isMeasureToolOpen}
                  onOpenChange={setIsMeasureToolOpen}
                />

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
                    onClick={() => es.setViewZoom(Math.max(0.1, es.viewZoom - 0.1))}>
                    <span className="text-lg font-bold">-</span>
                  </Button>
                  <span className="text-xs w-8 text-center">{Math.round(es.viewZoom * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
                    onClick={() => es.setViewZoom(Math.min(5, es.viewZoom + 0.1))}>
                    <span className="text-lg font-bold">+</span>
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Pivot selector */}
                <PivotSelector
                  currentPivot={es.pivotPoint}
                  onPivotChange={es.setPivotPoint}
                  isOpen={isPivotSelectorOpen}
                  onOpenChange={setIsPivotSelectorOpen}
                />
              </div>

              {/* Help button (absolute right) */}
              <div className="absolute right-4 pointer-events-auto">
                <HelpDialog />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Cutting Tool Dialog */}
      <CuttingToolDialog
        material={cuttingMaterial}
        open={!!cuttingMaterial}
        onOpenChange={open => !open && setCuttingMaterial(null)}
        onGenerateCuts={handleGenerateCuts}
      />
    </div>
  );
}
