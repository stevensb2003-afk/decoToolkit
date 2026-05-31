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
import { EditorTopBar } from './_components/EditorTopBar';
import { EditorBottomBar } from './_components/EditorBottomBar';

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
          <EditorTopBar
            router={router}
            project={project}
            surfaces={surfaces}
            activeSurface={activeSurface}
            activeSurfacePieces={activeSurfacePieces}
            activeSurfaceObstacles={activeSurfaceObstacles}
            es={es}
            canUndo={canUndo}
            canRedo={canRedo}
            isUndoingOrRedoing={isUndoingOrRedoing}
            undo={undo}
            redo={redo}
            handleClearAll={handleClearAll}
            handleStartDrawingObstacle={handleStartDrawingObstacle}
            handleEditObstacle={handleEditObstacle}
            handleDeleteObstacle={handleDeleteObstacle}
            isObstaclesSheetOpen={isObstaclesSheetOpen}
            setIsObstaclesSheetOpen={setIsObstaclesSheetOpen}
            handleRotateMaterial={handleRotateMaterial}
            setCuttingMaterial={setCuttingMaterial}
            handleDownloadPDF={handleDownloadPDF}
          />

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
            <EditorBottomBar
              es={es}
              isDrawingObstacle={isDrawingObstacle}
              isMeasureToolOpen={isMeasureToolOpen}
              setIsMeasureToolOpen={setIsMeasureToolOpen}
              isPivotSelectorOpen={isPivotSelectorOpen}
              setIsPivotSelectorOpen={setIsPivotSelectorOpen}
            />
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
