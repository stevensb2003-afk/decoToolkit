
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useUser, useFirestore, useMemoFirebase, useDoc, useCollection } from "@/firebase";
import {
  doc,
  onSnapshot,
  collection,
  query,
  updateDoc,
  arrayUnion,
  addDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  orderBy,
  FieldValue,
  serverTimestamp,
  arrayRemove,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import type {
  Project,
  Surface,
  Obstacle,
  PlacedPiece,
  Material,
  ClientState,
  Brush,
  DefaultMaterial,
  Measurement,
  Remnant,
  Fragment,
  Point,
  VertexMeasurement,
  GroupedRemnant,
  MeasureMode,
  UserProfile,
} from "@/lib/types";
import { Header } from "@/components/layout/header";
import { generateProjectPDF } from "@/lib/pdf-report";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Terminal, Eraser, Ruler, MousePointer, Layers, Brush as BrushIcon, Settings, PlusCircle, Plus, Trash2, Pencil, Check, ArrowLeft, Undo, Redo, Download, Folder, Crop, Lock, Unlock, RotateCw, Scissors, X, Crosshair, ArrowUp, ArrowDown, ArrowRight, SquareDashedBottom, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ChevronDown, HelpCircle, Save, Loader, Square, LineChart, Grid3X3, Navigation, MousePointer2, Maximize, Gamepad2, Zap, Info, ChevronRight, Command } from "lucide-react";
import { useElementSize } from "@/hooks/use-element-size";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { cn, convertToCm, convertFromCm, subtract, EPSILON, calculatePolygonArea, simplifyPath } from "@/lib/utils";
import * as ClipperLib from 'clipper-lib';
import { simplifyPaths } from "@/lib/clipper-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { CuttingToolDialog } from "@/components/cutting-tool-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Unit } from "@/lib/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { UnifiedMeasurementPanel } from "@/components/unified-measurement-panel";

type PivotPoint = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';


type MaterialRemnantGroup = {
  material: Material;
  remnants: GroupedRemnant[];
};

// --- START: History Management Types ---
type HistoryAction =
  | { type: 'add-pieces'; payload: { pieces: PlacedPiece[]; oldRemnants: Remnant[] } }
  | { type: 'delete-pieces'; payload: { pieces: PlacedPiece[]; newRemnants: Remnant[] } }
  | { type: 'clear-all'; payload: { pieces: PlacedPiece[]; oldRemnants: Remnant[] } }
  | { type: 'generate-cuts'; payload: { newRemnants: Remnant[]; oldRemnants: Remnant[] } };
// --- END: History Management Types ---


const INITIAL_STATE: Omit<
  ClientState,
  "projectId" | "materials" | "remnants"
> = {
  surfaces: [],
  activeSurfaceId: null,
  editorScale: 100,
  activeBrush: null,
  pivotPoint: 'topLeft',
  isFillMode: false,
  isObstacleSnapActive: false,
  isDragLockActive: false,
  isEraserMode: false,
  isMeasureMode: false,
  measureMode: 'area',
  history: [],
  historyIndex: -1,
  isRotating: false,
  brushAngle: 0,
  isHandMode: false,
  viewZoom: 1,
  viewPan: { x: 0, y: 0 },
  isRepeating: false,
  summaryViewMode: 'surface',
  showGrid: false,
  gridSpacing: 10,
};

// --- Main Editor Page ---
export default function EditorPage() {
  const { user, isUserLoading: authLoading } = useUser();
  const [isObstaclesSheetOpen, setIsObstaclesSheetOpen] = useState(false);
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  // --- Auth & Permissions State ---
  const [claims, setClaims] = useState<{ admin?: boolean }>({});
  const [checkingAuth, setCheckingAuth] = useState(true);

  // --- Data Fetching ---
  const profileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserProfile>(profileRef);

  const projectRef = useMemoFirebase(() => firestore && id ? doc(firestore, "projects", id) : null, [firestore, id]);
  const { data: project, isLoading: projectLoading, error: projectError } = useDoc<Project>(projectRef);

  const surfacesQuery = useMemoFirebase(() => firestore && id ? query(collection(firestore, "projects", id, "surfaces")) : null, [firestore, id]);
  const { data: surfaces, isLoading: surfacesLoading, error: surfacesError } = useCollection<Surface>(surfacesQuery);

  const piecesQuery = useMemoFirebase(() => firestore && id ? query(collection(firestore, "projects", id, "placedPieces"), orderBy('createdAt')) : null, [firestore, id]);
  const { data: placedPieces, isLoading: piecesLoading, error: piecesError } = useCollection<PlacedPiece>(piecesQuery);

  const obstaclesQuery = useMemoFirebase(() => firestore && id ? query(collection(firestore, "projects", id, "obstacles")) : null, [firestore, id]);
  const { data: obstacles, isLoading: obstaclesLoading, error: obstaclesError } = useCollection<Obstacle>(obstaclesQuery);

  // --- Local State ---
  const [clientState, setClientState] =
    useState<Omit<ClientState, "projectId" | "materials" | "remnants">>(INITIAL_STATE);

  const [rotationAnchor, setRotationAnchor] = useState<Point | null>(null);

  const [isDrawingObstacle, setIsDrawingObstacle] = useState(false);
  const [editingObstacleId, setEditingObstacleId] = useState<string | null>(null);
  const [isPivotSelectorOpen, setIsPivotSelectorOpen] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isMeasureToolOpen, setIsMeasureToolOpen] = useState(false);
  const [obstacleAnchorIndex, setObstacleAnchorIndex] = useState(0);
  const [currentObstaclePoints, setCurrentObstaclePoints] = useState<Point[]>([]);

  // --- START: History State ---
  const [isUndoingOrRedoing, setIsUndoingOrRedoing] = useState(false);
  // --- END: History State ---

  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const { width: viewportWidth, height: viewportHeight } = useElementSize(canvasViewportRef);

  const [previewSegment, setPreviewSegment] = useState<{ length: number; angle: number; } | null>(null);
  const [cuttingMaterial, setCuttingMaterial] = useState<Material | null>(null);

  // --- Derived State & Memos ---
  const isLoading = authLoading || projectLoading || surfacesLoading || piecesLoading || obstaclesLoading || checkingAuth;
  const dataError = projectError || surfacesError || piecesError || obstaclesError;

  const activeSurface = useMemo(() => {
    if (!clientState.activeSurfaceId || !surfaces) return null;
    return surfaces.find((s) => s.id === clientState.activeSurfaceId) ?? null;
  }, [surfaces, clientState.activeSurfaceId]);

  const activeSurfacePieces = useMemo(() => {
    if (!activeSurface || !placedPieces) return [];
    return placedPieces.filter(p => p.surfaceId === activeSurface.id);
  }, [placedPieces, activeSurface]);

  const activeSurfaceObstacles = useMemo(() => {
    if (!activeSurface || !obstacles) return [];
    return obstacles.filter(o => o.surfaceId === activeSurface.id);
  }, [obstacles, activeSurface]);

  const calculatePlacementFragments = useCallback((
    idealPiece: { x: number; y: number; width: number; height: number; rotation: number },
    activeBrush: Brush | null
  ): Fragment[][] => {
    if (!activeSurface || !activeBrush) return [];

    const scaleFactor = 1000;

    const angleRad = idealPiece.rotation * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    let subjectPaths: ClipperLib.Paths = [];
    if (activeBrush?.type === 'remnant') {
      const idealPieceCenterX = idealPiece.x;
      const idealPieceCenterY = idealPiece.y;

      const brushFragments = activeBrush.fragments || [{ id: 'legacy', points: activeBrush.points }];

      brushFragments.forEach(f => {
        const path = f.points.map(p => {
          const translatedX = p.x - activeBrush.x;
          const translatedY = p.y - activeBrush.y;
          const rotatedX = translatedX * cos - translatedY * sin;
          const rotatedY = translatedX * sin + translatedY * cos;
          return {
            X: idealPieceCenterX + rotatedX,
            Y: idealPieceCenterY + rotatedY,
          };
        });
        subjectPaths.push(path);
      });
    } else {
      const w = idealPiece.width;
      const h = idealPiece.height;
      const centerX = idealPiece.x;
      const centerY = idealPiece.y;

      const corners = [
        { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }
      ];
      subjectPaths = [corners.map(corner => ({
        X: centerX + (corner.x * cos - corner.y * sin),
        Y: centerY + (corner.x * sin + corner.y * cos),
      }))];
    }

    const existingFragmentsPaths = activeSurfacePieces.flatMap(p =>
      p.fragments.map(f => f.points.map((pt: Point) => ({ X: pt.x, Y: pt.y })))
    );

    if (activeSurfacePieces.length > 0 && !clientState.isFillMode) {
      const subjPathsForCheck = JSON.parse(JSON.stringify(subjectPaths));
      const clipPathsForCheck = JSON.parse(JSON.stringify(existingFragmentsPaths));
      ClipperLib.JS.ScaleUpPaths(subjPathsForCheck, scaleFactor);
      ClipperLib.JS.ScaleUpPaths(clipPathsForCheck, scaleFactor);

      const clipperCheck = new ClipperLib.Clipper();
      clipperCheck.AddPaths(subjPathsForCheck, ClipperLib.PolyType.ptSubject, true);
      clipperCheck.AddPaths(clipPathsForCheck, ClipperLib.PolyType.ptClip, true);
      const intersectionSolution: ClipperLib.Paths = [];
      clipperCheck.Execute(ClipperLib.ClipType.ctIntersection, intersectionSolution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

      if (intersectionSolution.length > 0) {
        return []; // Intersection detected, block placement
      }
    }


    ClipperLib.JS.ScaleUpPaths(subjectPaths, scaleFactor);

    let clipper = new ClipperLib.Clipper();

    if (activeSurfacePieces.length > 0 && clientState.isFillMode) {
      const scaledExistingFragments = JSON.parse(JSON.stringify(existingFragmentsPaths));
      ClipperLib.JS.ScaleUpPaths(scaledExistingFragments, scaleFactor);
      clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
      clipper.AddPaths(scaledExistingFragments, ClipperLib.PolyType.ptClip, true);
      const filledSolution: ClipperLib.Paths = [];
      clipper.Execute(ClipperLib.ClipType.ctDifference, filledSolution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
      subjectPaths = filledSolution;
      clipper.Clear();
    }

    if (activeSurfaceObstacles.length > 0) {
      const obstaclePaths = activeSurfaceObstacles.map(o => o.points.map((p: Point) => ({ X: p.x, Y: p.y })));
      if (obstaclePaths.some(p => p.length > 0)) {
        const scaledObstaclePaths = JSON.parse(JSON.stringify(obstaclePaths));
        ClipperLib.JS.ScaleUpPaths(scaledObstaclePaths, scaleFactor);
        clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
        clipper.AddPaths(scaledObstaclePaths, ClipperLib.PolyType.ptClip, true);
        const obstacleSolution: ClipperLib.Paths = [];
        clipper.Execute(ClipperLib.ClipType.ctDifference, obstacleSolution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero); // Use NonZero for difference to ensure holes are distinct
        subjectPaths = obstacleSolution;
        clipper.Clear();
      }
    }

    const surfaceClipPath = [
      [{ X: 0, Y: 0 }, { X: activeSurface.width, Y: 0 }, { X: activeSurface.width, Y: activeSurface.height }, { X: 0, Y: activeSurface.height }]
    ];
    ClipperLib.JS.ScaleUpPaths(surfaceClipPath, scaleFactor);
    clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(surfaceClipPath, ClipperLib.PolyType.ptClip, true);
    const polyTree = new (ClipperLib as any).PolyTree();
    clipper.Execute(ClipperLib.ClipType.ctIntersection, polyTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

    const groups: Fragment[][] = [];

    const traverse = (node: any) => {
      for (let i = 0; i < node.ChildCount(); i++) {
        const child = node.Childs()[i];
        if (!child.IsHole()) {
          // This is an outer contour, it starts a new piece group
          const currentGroup: Fragment[] = [];
          const outerPoints: Point[] = child.Contour().map((p: any) => ({ x: p.X / scaleFactor, y: p.Y / scaleFactor }));
          currentGroup.push({ id: crypto.randomUUID(), points: outerPoints });

          // Any Immediate Hole children belong to THIS piece
          for (let j = 0; j < child.ChildCount(); j++) {
            const hole = child.Childs()[j];
            if (hole.IsHole()) {
              const holePoints: Point[] = hole.Contour().map((p: any) => ({ x: p.X / scaleFactor, y: p.Y / scaleFactor }));
              currentGroup.push({ id: crypto.randomUUID(), points: holePoints });

              // Recurse into the hole to find any islands (which are new disconnected pieces)
              traverse(hole);
            }
          }
          groups.push(currentGroup);
        }
      }
    };

    traverse(polyTree);
    return groups;
  }, [activeSurface, activeSurfacePieces, activeSurfaceObstacles, clientState.isFillMode]);

  const calculateOffcuts = useCallback((
    idealPiece: { x: number; y: number; width: number; height: number; rotation: number },
    placedFragments: Fragment[],
    materialId: string,
    activeBrush: Brush | null,
    sourceSheetId?: string
  ): Remnant[] => {
    if (!activeBrush) return [];

    const scaleFactor = 1000;
    const clipper = new ClipperLib.Clipper();

    const angleRad = idealPiece.rotation * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    let subjectPaths: ClipperLib.Paths = [];

    if (activeBrush?.type === 'remnant') {
      const idealPieceCenterX = idealPiece.x;
      const idealPieceCenterY = idealPiece.y;

      const brushFragments = activeBrush.fragments || [{ id: 'legacy', points: activeBrush.points }];

      brushFragments.forEach(f => {
        const path = f.points.map(p => {
          const translatedX = p.x - activeBrush.x;
          const translatedY = p.y - activeBrush.y;
          const rotatedX = translatedX * cos - translatedY * sin;
          const rotatedY = translatedX * sin + translatedY * cos;
          return {
            X: idealPieceCenterX + rotatedX,
            Y: idealPieceCenterY + rotatedY,
          };
        });
        subjectPaths.push(path);
      });
    } else {
      const w = idealPiece.width;
      const h = idealPiece.height;
      const centerX = idealPiece.x;
      const centerY = idealPiece.y;

      const idealPolygon = [
        { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }
      ].map(corner => ({
        X: centerX + (corner.x * cos - corner.y * sin),
        Y: centerY + (corner.x * sin + corner.y * cos),
      }));
      subjectPaths = [idealPolygon];
    }

    const clipPaths = placedFragments.map(f => f.points.map(p => ({ X: p.x, Y: p.y })));

    ClipperLib.JS.ScaleUpPaths(subjectPaths, scaleFactor);
    ClipperLib.JS.ScaleUpPaths(clipPaths, scaleFactor);

    clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);

    const offcutSolution: ClipperLib.Paths = [];
    clipper.Execute(ClipperLib.ClipType.ctDifference, offcutSolution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

    const simplifiedOffcutSolution = simplifyPaths(offcutSolution);
    ClipperLib.JS.ScaleDownPaths(simplifiedOffcutSolution, scaleFactor);

    const remnants: Remnant[] = [];
    simplifiedOffcutSolution.forEach((path: ClipperLib.IntPoint[]) => {
      if (path.length < 3) return;
      const bounds = ClipperLib.Clipper.GetBounds([path]);
      if (bounds.right - bounds.left > EPSILON && bounds.bottom - bounds.top > EPSILON) {
        const points = path.map(p => ({ x: p.X, y: p.Y }));
        remnants.push({
          id: crypto.randomUUID(),
          materialId,
          points: points,
          x: (bounds.left + bounds.right) / 2, // Save the center of the new remnant
          y: (bounds.top + bounds.bottom) / 2,
          width: bounds.right - bounds.left,
          height: bounds.bottom - bounds.top,
          createdAt: new Date(),
          sourceSheetId,
        });
      }
    });

    return remnants;

  }, []);

  // --- START: History Management ---
  const addToHistory = useCallback((action: HistoryAction) => {
    setClientState(cs => {
      const newHistory = cs.history.slice(0, cs.historyIndex + 1);
      newHistory.push(action);
      return {
        ...cs,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  }, []);

  const handleUndo = useCallback(async () => {
    if (clientState.historyIndex < 0 || isUndoingOrRedoing || !firestore || !project) return;

    setIsUndoingOrRedoing(true);
    const actionToUndo = clientState.history[clientState.historyIndex];

    try {
      const batch = writeBatch(firestore);
      const projectDocRef = doc(firestore, "projects", project.id);

      switch (actionToUndo.type) {
        case 'add-pieces': {
          actionToUndo.payload.pieces.forEach(p => {
            const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
            batch.delete(pieceRef);
          });
          batch.update(projectDocRef, { remnants: actionToUndo.payload.oldRemnants });
          break;
        }
        case 'delete-pieces': {
          actionToUndo.payload.pieces.forEach(p => {
            const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
            const serverTimestampedPiece = { ...p, createdAt: serverTimestamp() };
            batch.set(pieceRef, serverTimestampedPiece);
          });
          batch.update(projectDocRef, { remnants: actionToUndo.payload.newRemnants });
          break;
        }
        case 'clear-all': {
          actionToUndo.payload.pieces.forEach(p => {
            const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
            batch.set(pieceRef, { ...p, createdAt: serverTimestamp() });
          });
          batch.update(projectDocRef, { remnants: actionToUndo.payload.oldRemnants });
          break;
        }
        case 'generate-cuts': {
          batch.update(projectDocRef, { remnants: actionToUndo.payload.oldRemnants });
          break;
        }
      }
      await batch.commit();
      setClientState(cs => ({ ...cs, historyIndex: cs.historyIndex - 1 }));
    } catch (e) {
      console.error("Error undoing action:", e);
      toast({ title: "Undo Failed", description: "Could not revert the last action.", variant: "destructive" });
    } finally {
      setIsUndoingOrRedoing(false);
    }
  }, [clientState.history, clientState.historyIndex, isUndoingOrRedoing, firestore, project, toast]);

  const handleRedo = useCallback(async () => {
    if (clientState.historyIndex >= clientState.history.length - 1 || isUndoingOrRedoing || !firestore || !project) return;

    setIsUndoingOrRedoing(true);
    const nextIndex = clientState.historyIndex + 1;
    const actionToRedo = clientState.history[nextIndex];

    try {
      const batch = writeBatch(firestore);
      const projectDocRef = doc(firestore, "projects", project.id);

      switch (actionToRedo.type) {
        case 'add-pieces': {
          actionToRedo.payload.pieces.forEach(p => {
            const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
            const serverTimestampedPiece = { ...p, createdAt: serverTimestamp() };
            batch.set(pieceRef, serverTimestampedPiece);
          });
          const remnantIds = actionToRedo.payload.oldRemnants.map(r => r.id);
          const newRemnants = (project.remnants || []).filter(r => !remnantIds.includes(r.id));
          batch.update(projectDocRef, { remnants: newRemnants });
          break;
        }
        case 'delete-pieces': {
          actionToRedo.payload.pieces.forEach(p => {
            const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
            batch.delete(pieceRef);
          });
          batch.update(projectDocRef, { remnants: actionToRedo.payload.newRemnants });
          break;
        }
        case 'clear-all': {
          actionToRedo.payload.pieces.forEach(p => {
            const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
            batch.delete(pieceRef);
          });
          batch.update(projectDocRef, { remnants: [] });
          break;
        }
        case 'generate-cuts': {
          const finalRemnants = [...actionToRedo.payload.oldRemnants, ...actionToRedo.payload.newRemnants];
          batch.update(projectDocRef, { remnants: finalRemnants });
          break;
        }
      }
      await batch.commit();
      setClientState(cs => ({ ...cs, historyIndex: nextIndex }));
    } catch (e) {
      console.error("Error redoing action:", e);
      toast({ title: "Redo Failed", description: "Could not re-apply the action.", variant: "destructive" });
    } finally {
      setIsUndoingOrRedoing(false);
    }
  }, [clientState.history, clientState.historyIndex, isUndoingOrRedoing, firestore, project, clientState.activeBrush, toast, calculateOffcuts]);
  // --- END: History Management ---

  const handleToolSelect = useCallback((tool: 'brush' | 'eraser' | 'measure', measureMode?: MeasureMode) => {
    setClientState(cs => ({
      ...cs,
      activeBrush: tool === 'brush' ? cs.activeBrush : null,
      isEraserMode: tool === 'eraser',
      isMeasureMode: tool === 'measure',
      measureMode: tool === 'measure' ? (measureMode || cs.measureMode) : cs.measureMode,
      isHandMode: false,
    }));
    if (tool === 'brush') {
      setIsDrawingObstacle(false);
      // Explicitly clear brush if 'brush' tool (pointer) is selected while already in brush mode
      // This allows the pointer tool button to act as a deselector
      setClientState(cs => ({ ...cs, activeBrush: null }));
    }
  }, []);


  // --- Effects ---

  // Set initial active surface
  useEffect(() => {
    if (!clientState.activeSurfaceId && surfaces && surfaces.length > 0) {
      setClientState(s => ({ ...s, activeSurfaceId: surfaces[0].id }));
    }
  }, [surfaces, clientState.activeSurfaceId]);

  // Get user claims for authorization
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCheckingAuth(false);
      return;
    }
    user.getIdTokenResult().then((idTokenResult) => {
      setClaims({ admin: !!idTokenResult.claims.admin });
      setCheckingAuth(false);
    }).catch(error => {
      console.error("Error getting user token:", error);
      setCheckingAuth(false);
    })
  }, [user, authLoading]);

  // Redirect if user does not have access
  useEffect(() => {
    if (checkingAuth || authLoading || projectLoading) {
      return; // Wait until all auth and project data is loaded
    }

    if (dataError) {
      return;
    }

    if (!user) { // If no user, redirect to login
      router.push('/login');
      return;
    }

    if (project) {
      const isOwner = project.userId === user.uid;
      const isAdmin = claims.admin === true || profile?.isAdmin === true;
      const isAppOwner = user.email === 'stevensb.2003@gmail.com';

      if (!isOwner && !isAdmin && !isAppOwner) {
        router.push('/');
      }
    }
  }, [user, authLoading, project, projectLoading, checkingAuth, claims, dataError, router, profile]);


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (e.key === 'Alt' && !clientState.isRotating && clientState.activeBrush) {
        e.preventDefault();
        setClientState(cs => ({ ...cs, isRotating: true }));
      }


      if (e.key === 'Escape') {
        if (isDrawingObstacle) {
          // Logic to cancel obstacle drawing is in Canvas
        }
        e.preventDefault();
      }

      if (isCtrlOrMeta) {
        const key = e.key.toLowerCase();
        let handled = false;
        switch (key) {
          case 'z':
            handleUndo();
            handled = true;
            break;
          case 'y':
          case e.shiftKey && 'z': // Handles Ctrl+Y and Ctrl+Shift+Z
            handleRedo();
            handled = true;
            break;
          case 'v':
            handleToolSelect('brush');
            handled = true;
            break;
          case 'e':
            handleToolSelect('eraser');
            handled = true;
            break;
          case 'r':
            setIsMeasureToolOpen(p => !p);
            handled = true;
            break;
          case 'a':
            setIsPivotSelectorOpen(p => !p);
            handled = true;
            break;
          case ' ': // Reset view with Ctrl + Space
            setClientState(prev => ({
              ...prev,
              viewZoom: 1.0,
              viewPan: { x: 0, y: 0 }
            }));
            toast({ title: "Vista restablecida", description: "Zoom al 100% y superficie centrada." });
            handled = true;
            break;
        }
        if (handled) {
          e.preventDefault();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && clientState.isRotating) {
        e.preventDefault();
        setClientState(cs => ({ ...cs, isRotating: false }));
        setRotationAnchor(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    }
  }, [handleUndo, handleRedo, handleToolSelect, isDrawingObstacle, clientState.isRotating, clientState.activeBrush]);

  const handleSetActiveBrush = useCallback((brush: Brush) => {
    setClientState(cs => {
      if (cs.activeBrush?.type === brush.type) {
        if (brush.type === 'material' && cs.activeBrush.id === brush.id) {
          return { ...cs, activeBrush: null, isEraserMode: false, isMeasureMode: false };
        }
        if (brush.type === 'remnant' && cs.activeBrush?.type === 'remnant' && cs.activeBrush.shapeId === brush.shapeId) {
          return { ...cs, activeBrush: null, isEraserMode: false, isMeasureMode: false };
        }
      }
      return { ...cs, activeBrush: brush, isEraserMode: false, isMeasureMode: false, brushAngle: 0 };
    });
  }, []);

  const handleStartDrawingObstacle = useCallback(() => {
    setEditingObstacleId(null);
    setIsDrawingObstacle(true);
  }, []);

  const handleEditObstacle = useCallback((obstacle: Obstacle) => {
    setEditingObstacleId(obstacle.id);
    setCurrentObstaclePoints(obstacle.points);
    setObstacleAnchorIndex(0);
    setIsDrawingObstacle(true);
  }, []);

  const handlePreviewChange = useCallback((data: { length: number; angle: number } | null) => {
    setPreviewSegment(data);
  }, []);

  const handleDownloadPDF = async () => {
    if (!project || !surfaces || !placedPieces || !obstacles) {
      toast({ title: "Error", description: "Datos insuficientes para generar el reporte.", variant: "destructive" });
      return;
    }

    try {
      // Fetch fresh data from Firestore to ensure consistency with the Projects List download
      const surfacesSnapshot = await getDocs(collection(firestore, "projects", project.id, "surfaces"));
      const piecesSnapshot = await getDocs(collection(firestore, "projects", project.id, "placedPieces"));
      const obstaclesSnapshot = await getDocs(collection(firestore, "projects", project.id, "obstacles"));

      const dbSurfaces = surfacesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const dbPlacedPieces = piecesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Sort pieces by createdAt to mimic Editor Z-Index (capas)
      dbPlacedPieces.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeA - timeB;
      });

      const dbObstacles = obstaclesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Fetch default materials to show type names in PDF
      const defaultMaterialsCol = collection(firestore, "defaultMaterials");
      const defaultMaterialsSnap = await getDocs(defaultMaterialsCol);
      const defaultMaterials = defaultMaterialsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DefaultMaterial[];

      await generateProjectPDF({
        project,
        surfaces: dbSurfaces,
        placedPieces: dbPlacedPieces,
        obstacles: dbObstacles,
        remnants: project.remnants || [],
        defaultMaterials,
        creatorName: profile?.displayName || user?.email || undefined
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "No se pudo generar el reporte PDF.", variant: "destructive" });
    }
  };

  const handlePiecePlacement = useCallback(async (positions: Point[]) => {
    if (!clientState.activeBrush || positions.length === 0 || !activeSurface || !project || !firestore || !placedPieces) return;

    const { activeBrush, brushAngle } = clientState;

    let materialId: string;
    let placementSourceType: 'material' | 'remnant';

    if (activeBrush.type === 'material') {
      materialId = activeBrush.id;
      placementSourceType = 'material';
    } else {
      materialId = activeBrush.materialId;
      placementSourceType = 'remnant';
    }
    if (!materialId) {
      console.error("CRITICAL: materialId is undefined in handlePiecePlacement.", activeBrush);
      toast({ title: "Error Crítico", description: "No se pudo determinar el ID del material. No se puede guardar la pieza.", variant: "destructive" });
      return;
    }

    const placements = positions.map((pos, index) => {
      const idealPiece = {
        x: pos.x,
        y: pos.y,
        width: activeBrush.width,
        height: activeBrush.height,
        rotation: brushAngle,
      };

      let currentSourceSheetId: string | undefined;
      if (activeBrush.type === 'material') {
        currentSourceSheetId = crypto.randomUUID();
      } else {
        const instanceId = activeBrush.instanceIds[index];
        const actualRemnant = project.remnants.find(r => r.id === instanceId);
        currentSourceSheetId = actualRemnant?.sourceSheetId;
      }

      const groupedFragments = calculatePlacementFragments(idealPiece, activeBrush);
      const allFragments = groupedFragments.flat();
      const offcuts = groupedFragments.length > 0 ? calculateOffcuts(idealPiece, allFragments, materialId, activeBrush, currentSourceSheetId) : [];
      return { idealPiece, groupedFragments, offcuts, currentSourceSheetId };
    });

    const validPlacements = placements.filter(p => p.groupedFragments.length > 0);

    if (validPlacements.length === 0) {
      toast({
        title: "Colocación inválida",
        description: "La pieza se superpone con otra existente o está fuera de los límites. Active el 'Modo Relleno' para recortar la pieza automáticamente.",
        variant: "destructive",
      });
      return;
    }

    const newPiecesData: Omit<PlacedPiece, 'id'>[] = [];
    const allOffcuts: Remnant[] = [];

    validPlacements.forEach(({ idealPiece, groupedFragments, offcuts, currentSourceSheetId }) => {
      const placementId = crypto.randomUUID();
      // Create a separate piece for each CONNECTED group of fragments
      groupedFragments.forEach(fragmentGroup => {
        const allPoints = fragmentGroup.flatMap(f => f.points);
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        newPiecesData.push({
          placementId: placementId,
          surfaceId: activeSurface.id,
          materialId: materialId,
          source: {
            type: activeBrush.type,
            id: activeBrush.type === 'remnant' ? activeBrush.shapeId : activeBrush.id,
          },
          x: centerX,
          y: centerY,
          width: width,
          height: height,
          rotation: 0,
          fragments: fragmentGroup,
          createdAt: serverTimestamp(),
          sourceSheetId: currentSourceSheetId,
        } as Omit<PlacedPiece, 'id'>);
      });

      allOffcuts.push(...offcuts);
    });

    let newRemnantsState = [...(project.remnants || [])];

    if (activeBrush.type === 'remnant') {
      const remnantToPlace = activeBrush;
      const numUsed = validPlacements.length;

      // Remove used instances from project remnants
      const usedInstanceIds = remnantToPlace.instanceIds.slice(0, numUsed);
      newRemnantsState = newRemnantsState.filter(r => !usedInstanceIds.includes(r.id));

      const newCount = remnantToPlace.count - numUsed;
      if (newCount > 0) {
        const newInstanceIds = remnantToPlace.instanceIds.slice(numUsed);
        setClientState(cs => ({ ...cs, activeBrush: { ...remnantToPlace, count: newCount, instanceIds: newInstanceIds } }));
      } else {
        setClientState(cs => ({ ...cs, activeBrush: null }));
      }
    }

    if (allOffcuts.length > 0) {
      newRemnantsState = [...newRemnantsState, ...allOffcuts];
    }

    try {
      const oldRemnants = project.remnants || []; // <-- CAPTURA EL ESTADO ANTERIOR
      const batch = writeBatch(firestore);
      const projectDocRef = doc(firestore, "projects", project.id);

      const addedPieces: PlacedPiece[] = [];
      for (const pieceData of newPiecesData) {
        const newPieceRef = doc(collection(firestore, "projects", project.id, "placedPieces"));
        batch.set(newPieceRef, pieceData);

        // For undo, we need the full piece object with its new ID.
        addedPieces.push({ ...pieceData, id: newPieceRef.id, createdAt: new Date() } as PlacedPiece);
      }
      addToHistory({ type: 'add-pieces', payload: { pieces: addedPieces, oldRemnants } });

      batch.update(projectDocRef, { remnants: newRemnantsState });

      await batch.commit();

    } catch (e) {
      console.error("Error placing piece(s):", e);
      toast({ title: "Error", description: "No se pudieron guardar las piezas.", variant: "destructive" });
    }
  }, [activeSurface, project, clientState, placedPieces, calculatePlacementFragments, calculateOffcuts, firestore, toast, addToHistory]);


  const handlePieceDelete = async (pieceId: string) => {
    if (!project || !firestore || !placedPieces) return;
    const pieceToDeleteRef = doc(firestore, "projects", project.id, "placedPieces", pieceId);

    try {
      const pieceDoc = await getDoc(pieceToDeleteRef);
      if (!pieceDoc.exists()) return;
      const pieceToDelete = { id: pieceDoc.id, ...pieceDoc.data() } as PlacedPiece;

      const allPoints = pieceToDelete.fragments.flatMap(f => f.points);
      const xs = allPoints.map(p => p.x);
      const ys = allPoints.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const newRemnant: Remnant = {
        id: crypto.randomUUID(),
        materialId: pieceToDelete.materialId,
        points: pieceToDelete.fragments[0]?.points || [], // Backward compatibility: use first fragment
        fragments: pieceToDelete.fragments,
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        width: maxX - minX,
        height: maxY - minY,
        createdAt: new Date(),
        sourceSheetId: pieceToDelete.sourceSheetId,
      };

      const batch = writeBatch(firestore);
      const projectRef = doc(firestore, "projects", project.id);

      let newRemnantsState = [...(project.remnants || [])];
      newRemnantsState.push(newRemnant);

      batch.delete(pieceToDeleteRef);
      batch.update(projectRef, { remnants: newRemnantsState });

      await batch.commit();

      addToHistory({ type: 'delete-pieces', payload: { pieces: [pieceToDelete], newRemnants: newRemnantsState } });

      toast({
        title: "Pieza movida a cortes",
        description: "La pieza ha sido enviada al panel de cortes para su reutilización."
      });

    } catch (error) {
      console.error("Error moving piece to remnants:", error);
      toast({ title: "Error", description: "No se pudo sincronizar el cambio con la base de datos.", variant: "destructive" });
    }
  }

  const handleBatchDeletePieces = async (pieceIds: string[]) => {
    if (!project || !firestore || !placedPieces || pieceIds.length === 0) return;

    try {
      const batch = writeBatch(firestore);
      const projectRef = doc(firestore, "projects", project.id);
      const newRemnantsState = [...(project.remnants || [])];
      const deletedPieces: PlacedPiece[] = [];

      for (const pieceId of pieceIds) {
        const pieceToDeleteRef = doc(firestore, "projects", project.id, "placedPieces", pieceId);
        const pieceDoc = await getDoc(pieceToDeleteRef);
        if (!pieceDoc.exists()) continue;

        const pieceToDelete = { id: pieceDoc.id, ...pieceDoc.data() } as PlacedPiece;
        deletedPieces.push(pieceToDelete);

        const allPoints = pieceToDelete.fragments.flatMap(f => f.points);
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const newRemnant: Remnant = {
          id: crypto.randomUUID(),
          materialId: pieceToDelete.materialId,
          points: pieceToDelete.fragments[0]?.points || [],
          fragments: pieceToDelete.fragments,
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: maxX - minX,
          height: maxY - minY,
          createdAt: new Date(),
          sourceSheetId: pieceToDelete.sourceSheetId,
        };

        newRemnantsState.push(newRemnant);
        batch.delete(pieceToDeleteRef);
      }

      batch.update(projectRef, { remnants: newRemnantsState });
      await batch.commit();

      addToHistory({ type: 'delete-pieces', payload: { pieces: deletedPieces, newRemnants: newRemnantsState } });

      toast({
        title: `${deletedPieces.length} piezas movidas a cortes`,
        description: "Las piezas han sido enviadas al panel de cortes para su reutilización."
      });
    } catch (error) {
      console.error("Error moving pieces to remnants:", error);
      toast({ title: "Error", description: "No se pudo sincronizar el cambio con la base de datos.", variant: "destructive" });
    }
  }

  const handleClearAll = useCallback(async () => {
    if (!activeSurface || !project || !firestore || !placedPieces) return;

    const piecesOnSurface = activeSurfacePieces;
    const oldRemnants = project.remnants || [];
    const projectHasRemnants = oldRemnants.length > 0;

    if (piecesOnSurface.length === 0 && !projectHasRemnants) return;

    try {
      const batch = writeBatch(firestore);

      piecesOnSurface.forEach(piece => {
        const pieceId = piece.id;
        if (pieceId && !pieceId.startsWith('temp-')) {
          const docRef = doc(firestore, "projects", id, "placedPieces", pieceId);
          batch.delete(docRef);
        }
      });

      if (projectHasRemnants) {
        const projectRef = doc(firestore, "projects", id);
        batch.update(projectRef, { remnants: [] });
      }

      await batch.commit();

      if (clientState.activeBrush?.type === 'remnant') {
        setClientState(cs => ({ ...cs, activeBrush: null }));
      }

      addToHistory({ type: 'clear-all', payload: { pieces: piecesOnSurface, oldRemnants } });

      toast({ title: "Lienzo y Cortes Limpios", description: "Todas las piezas y cortes han sido eliminados." });
    } catch (error) {
      console.error("Error clearing canvas and remnants: ", error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar las piezas y cortes. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  }, [activeSurface, project, firestore, placedPieces, activeSurfacePieces, clientState.activeBrush, id, toast, addToHistory]);


  const setPivotPoint = (pivot: PivotPoint) => {
    setClientState(cs => ({ ...cs, pivotPoint: pivot }));
  };

  const areaToCover = useMemo(() => {
    if (!activeSurface) return 0;
    const surfaceArea = activeSurface.width * activeSurface.height;
    const obstaclesArea = activeSurfaceObstacles.reduce((total, obs) => {
      // Sum the absolute signed area of each obstacle. 
      // If an obstacle itself had holes, calculatePolygonArea should correctly yield net area.
      return total + Math.abs(calculatePolygonArea(obs.points));
    }, 0);
    return surfaceArea - obstaclesArea;
  }, [activeSurface, activeSurfaceObstacles]);

  const coveredArea = useMemo(() => {
    if (!activeSurfacePieces) return 0;

    const totalAreaInCm2 = activeSurfacePieces.reduce((totalArea, piece) => {
      // For each piece, we sum the signed areas of all its fragments.
      // Fragments that are holes will have negative area and thus subtract from the total.
      const pieceNetArea = piece.fragments.reduce((sum, fragment) => {
        return sum + calculatePolygonArea(fragment.points);
      }, 0);
      // We take the absolute value of the net area of the piece fragments,
      // just in case the outer orientation was CW instead of CCW.
      return totalArea + Math.abs(pieceNetArea);
    }, 0);

    return totalAreaInCm2;
  }, [activeSurfacePieces]);

  const projectAreaToCover = useMemo(() => {
    if (!surfaces) return 0;
    const totalSurfaceArea = surfaces.reduce((total, s) => total + (s.width * s.height), 0);
    const totalObstaclesArea = (obstacles || []).reduce((total, obs) => {
      return total + Math.abs(calculatePolygonArea(obs.points));
    }, 0);
    return totalSurfaceArea - totalObstaclesArea;
  }, [surfaces, obstacles]);

  const projectCoveredArea = useMemo(() => {
    if (!placedPieces) return 0;
    return placedPieces.reduce((total, piece) => {
      const pieceNetArea = piece.fragments.reduce((sum, fragment) => {
        return sum + calculatePolygonArea(fragment.points);
      }, 0);
      return total + Math.abs(pieceNetArea);
    }, 0);
  }, [placedPieces]);

  const materialUsage = useMemo(() => {
    const usage = new Map<string, number>();
    if (!project?.materials) {
      return usage;
    }
    project.materials.forEach(mat => {
      usage.set(mat.id, 0);
    });

    // Track unique sourceSheetIds per material
    const uniqueSheets = new Map<string, Set<string>>();

    // 1. Count from placed pieces
    if (placedPieces) {
      placedPieces.forEach(piece => {
        const materialId = piece.materialId;
        // Use sourceSheetId, or fallback to older identifiers
        const sourceSheetId = piece.sourceSheetId || piece.placementId || piece.id;

        if (!uniqueSheets.has(materialId)) {
          uniqueSheets.set(materialId, new Set());
        }
        uniqueSheets.get(materialId)!.add(sourceSheetId);
      });
    }

    // 2. Count from remnants in the panel
    if (project.remnants) {
      project.remnants.forEach(remnant => {
        const materialId = remnant.materialId;
        const sourceSheetId = remnant.sourceSheetId || remnant.id;

        if (!uniqueSheets.has(materialId)) {
          uniqueSheets.set(materialId, new Set());
        }
        uniqueSheets.get(materialId)!.add(sourceSheetId);
      });
    }

    uniqueSheets.forEach((sheets, materialId) => {
      if (usage.has(materialId)) {
        usage.set(materialId, sheets.size);
      }
    });

    return usage;
  }, [placedPieces, project?.materials, project?.remnants]);


  const wasteArea = useMemo(() => {
    if (!project?.remnants) return 0;

    const totalAreaInCm2 = project.remnants.reduce((total, remnant) => {
      const frags = remnant.fragments || [{ id: 'legacy', points: remnant.points }];
      const remnantNetArea = frags.reduce((sum, f) => sum + calculatePolygonArea(f.points), 0);
      return total + Math.abs(remnantNetArea);
    }, 0);

    return totalAreaInCm2;
  }, [project?.remnants]);


  const handleRotateMaterial = (materialId: string) => {
    if (!project || !firestore) return;
    const projectRef = doc(firestore, "projects", project.id);
    const newMaterials = project.materials.map(mat => {
      if (mat.id === materialId) {
        return { ...mat, width: mat.height, height: mat.width };
      }
      return mat;
    });

    updateDoc(projectRef, { materials: newMaterials });

    setClientState(cs => {
      if (cs.activeBrush?.type === 'material' && cs.activeBrush.id === materialId) {
        const newBrush = { ...cs.activeBrush, width: cs.activeBrush.height, height: cs.activeBrush.width };
        return { ...cs, activeBrush: newBrush };
      }
      return cs;
    });
  };

  const handleUpdateObstacleStartPoint = useCallback((newPoint: Point) => {
  }, []);

  const groupedRemnantsByMaterial = useMemo((): Map<string, MaterialRemnantGroup> => {
    const materialGroups = new Map<string, MaterialRemnantGroup>();

    if (!project?.remnants || !project.materials) {
      return materialGroups;
    }

    const getShapeId = (remnant: Remnant): string => {
      const frags = remnant.fragments || [{ id: 'legacy', points: remnant.points }];
      if (frags.length === 0) return '';

      const allPoints = frags.flatMap(f => f.points);
      const xs = allPoints.map(p => p.x);
      const ys = allPoints.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);

      // Normalize all fragments relative to the bounding box top-left
      const normalizedFragments = frags.map(f => {
        const normalizedPoints = f.points.map(p => ({
          x: Math.round((p.x - minX) * 100) / 100,
          y: Math.round((p.y - minY) * 100) / 100,
        }));
        // Sort points within fragment to be order-independent
        normalizedPoints.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        return normalizedPoints.map(p => `${p.x},${p.y}`).join(';');
      });

      // Sort fragments to be order-independent
      normalizedFragments.sort();

      return normalizedFragments.join('|');
    };

    const shapeGroups: Map<string, GroupedRemnant> = new Map();

    for (const remnant of project.remnants) {
      if (!remnant.points || remnant.points.length === 0) continue;

      const shapeId = getShapeId(remnant);
      const key = `${remnant.materialId}_${shapeId}`;

      if (shapeGroups.has(key)) {
        const existingGroup = shapeGroups.get(key)!;
        existingGroup.count += 1;
        existingGroup.instanceIds.push(remnant.id);
      } else {
        shapeGroups.set(key, {
          ...remnant,
          count: 1,
          shapeId,
          instanceIds: [remnant.id],
        });
      }
    }

    const allGroupedRemnants = Array.from(shapeGroups.values());

    for (const groupedRemnant of allGroupedRemnants) {
      const materialId = groupedRemnant.materialId;
      if (!materialGroups.has(materialId)) {
        const material = project.materials.find(m => m.id === materialId);
        if (material) {
          materialGroups.set(materialId, { material, remnants: [] });
        }
      }

      const materialGroup = materialGroups.get(materialId);
      if (materialGroup) {
        materialGroup.remnants.push(groupedRemnant);
      }
    }

    return materialGroups;
  }, [project?.remnants, project?.materials]);


  if (isLoading) return <EditorSkeleton />;
  if (dataError) return <EditorError message={dataError.message} />;
  if (!project || !surfaces || !placedPieces || !obstacles) return (
    <div className="flex flex-col h-screen bg-muted/40">
      <Header />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project data could not be fully loaded. This is often due to a network issue or missing data.</p>
          <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go back to dashboard
          </Button>
        </div>
      </main>
    </div>
  );

  const canUndo = clientState.historyIndex >= 0;
  const canRedo = clientState.historyIndex < clientState.history.length - 1;

  const handleGenerateCuts = async (newRemnants: Remnant[]) => {
    if (!project || !firestore) return;

    try {
      const projectRef = doc(firestore, "projects", project.id);
      const oldRemnants = project.remnants || [];
      await updateDoc(projectRef, {
        remnants: arrayUnion(...newRemnants)
      });

      addToHistory({ type: 'generate-cuts', payload: { newRemnants, oldRemnants } });

      toast({
        title: "Cortes Generados",
        description: `Se han añadido ${newRemnants.length} nuevos cortes al proyecto.`,
      });
    } catch (error) {
      console.error("Error generating cuts:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cortes. Por favor intente de nuevo.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-muted/40">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <aside className="w-84 shrink-0 border-r bg-background p-4 h-full flex flex-col gap-6 overflow-y-auto scrollbar-discreet">

          <Collapsible defaultOpen className="border rounded-xl bg-card text-card-foreground shadow-sm">
            <CollapsibleTrigger className="w-full text-left">
              <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl group">
                <CardTitle>Resumen</CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-2">
                <div className="flex bg-muted rounded-full p-0.5 border border-border shadow-inner w-full max-w-[200px]">
                  <button
                    className={cn(
                      "flex-1 h-6 px-2 text-[10px] uppercase font-bold rounded-full transition-all duration-300 flex items-center justify-center outline-none",
                      clientState.summaryViewMode === 'surface'
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                        : "text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientState(cs => ({ ...cs, summaryViewMode: 'surface' }));
                    }}
                  >
                    <MousePointer className={cn("h-3 w-3 mr-1 transition-opacity", clientState.summaryViewMode === 'surface' ? "opacity-100" : "opacity-40")} />
                    Superficie
                  </button>
                  <button
                    className={cn(
                      "flex-1 h-6 px-2 text-[10px] uppercase font-bold rounded-full transition-all duration-300 flex items-center justify-center outline-none",
                      clientState.summaryViewMode === 'project'
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                        : "text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientState(cs => ({ ...cs, summaryViewMode: 'project' }));
                    }}
                  >
                    <Layers className={cn("h-3 w-3 mr-1 transition-opacity", clientState.summaryViewMode === 'project' ? "opacity-100" : "opacity-40")} />
                    Proyecto
                  </button>
                </div>
              </div>
              <CardContent className="text-sm space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{clientState.summaryViewMode === 'surface' ? 'Superficie:' : 'Proyecto Total:'}</span>
                    <span className="font-medium">
                      {((clientState.summaryViewMode === 'surface' ? areaToCover : projectAreaToCover) / 10000).toFixed(2)} m²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Área Cubierta:</span>
                    <span className="font-medium">
                      {((clientState.summaryViewMode === 'surface' ? coveredArea : projectCoveredArea) / 10000).toFixed(2)} m²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Área por cubrir:</span>
                    <span className="font-medium">
                      {Math.max(0, ((clientState.summaryViewMode === 'surface' ? areaToCover : projectAreaToCover) - (clientState.summaryViewMode === 'surface' ? coveredArea : projectCoveredArea)) / 10000).toFixed(2)} m²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Desperdicio:</span>
                    <span className="font-medium text-red-500">{(wasteArea / 10000).toFixed(2)} m²</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-medium">Materiales Usados</h3>
                  {project.materials.map((mat) => (
                    <div key={mat.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: mat.color }}></span>
                        <span className="font-semibold">{mat.name || `Material ${project.materials.findIndex(m => m.id === mat.id) + 1}`}</span>
                      </div>
                      <span className="font-medium">{materialUsage.get(mat.id) || 0}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
          <Separator />
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Cortes</h2>
            {Array.from(groupedRemnantsByMaterial.values()).map(({ material, remnants }) => (
              <Collapsible key={material.id} defaultOpen>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: material.color }} />
                      <span className="font-semibold text-sm">{material.name}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-2 space-y-1">
                    {remnants.map(remnant => (
                      <RemnantBrush
                        key={remnant.shapeId}
                        remnant={remnant}
                        materialColor={material.color}
                        isActive={clientState.activeBrush?.type === 'remnant' && clientState.activeBrush?.shapeId === remnant.shapeId}
                        onSelect={() => handleSetActiveBrush({ ...remnant, type: 'remnant' })}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
            {groupedRemnantsByMaterial.size === 0 && (
              <p className="text-sm text-muted-foreground px-2">No hay cortes disponibles.</p>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => router.push('/projects')}>
                    <Folder className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mis Proyectos</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <EditProjectSheet project={project} surfaces={surfaces} />
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2">
              <TooltipProvider>
                {/* Surface Selector moved here */}
                {surfaces.length > 0 && (
                  <Select
                    value={clientState.activeSurfaceId || ''}
                    onValueChange={(value) => setClientState(cs => ({ ...cs, activeSurfaceId: value }))}
                  >
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Seleccionar Superficie" />
                    </SelectTrigger>
                    <SelectContent>
                      {surfaces.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <AlertDialog>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:text-red-600" disabled={activeSurfacePieces.length === 0 && (!project.remnants || project.remnants.length === 0)}>
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
                        Esta acción no se puede deshacer. Se eliminarán permanentemente todas las piezas
                        de la superficie "{activeSurface?.name}" y todos los cortes guardados del proyecto.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAll}>Continuar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Separator orientation="vertical" className="h-6 mx-2" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleUndo} disabled={!canUndo || isUndoingOrRedoing}><Undo className="h-4 w-4" /></Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Deshacer (Ctrl+Z)</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleRedo} disabled={!canRedo || isUndoingOrRedoing}><Redo className="h-4 w-4" /></Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Rehacer (Ctrl+Y)</p></TooltipContent>
                </Tooltip>
                <Separator orientation="vertical" className="h-6 mx-2" />

                <ObstaclesSheet
                  project={project}
                  obstacles={activeSurfaceObstacles}
                  activeSurface={activeSurface}
                  onStartDrawing={handleStartDrawingObstacle}
                  onEditObstacle={handleEditObstacle}
                  isOpen={isObstaclesSheetOpen}
                  onOpenChange={setIsObstaclesSheetOpen}
                />

                <GuideSettingsPopover
                  showGrid={clientState.showGrid}
                  gridSpacing={clientState.gridSpacing}
                  onChange={setClientState}
                />

                <Separator orientation="vertical" className="h-6 mx-2" />

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={clientState.activeBrush?.type === 'material' ? clientState.activeBrush.id : 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setClientState(cs => ({ ...cs, activeBrush: null }));
                          return;
                        }
                        const mat = project.materials.find(m => m.id === value);
                        if (mat) handleSetActiveBrush({ ...mat, type: 'material' });
                      }}
                    >
                      <SelectTrigger className="w-[220px] h-10 bg-muted/50 border-muted-foreground/20">
                        <SelectValue placeholder="Material Activo">
                          {clientState.activeBrush?.type === 'material' ? (
                            <div className="flex items-center gap-2 text-left w-full overflow-hidden">
                              <span className="h-4 w-4 rounded-full shadow-sm shrink-0" style={{ backgroundColor: clientState.activeBrush.color }} />
                              <div className="flex flex-col min-w-0 leading-tight">
                                <span className="truncate font-medium text-xs">{clientState.activeBrush.name}</span>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {(clientState.activeBrush.width / 100).toFixed(2)}m x {(clientState.activeBrush.height / 100).toFixed(2)}m
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
                                  {(mat.width / 100).toFixed(2)}m x {(mat.height / 100).toFixed(2)}m
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {clientState.activeBrush?.type === 'material' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
                          onClick={() => setClientState(cs => ({ ...cs, activeBrush: null }))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Deseleccionar Material</p></TooltipContent>
                    </Tooltip>
                  )}

                  {clientState.activeBrush?.type === 'material' && (
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={() => handleRotateMaterial(clientState.activeBrush!.id)}>
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Rotar Veta</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={() => setCuttingMaterial(clientState.activeBrush as Material)}>
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

            <div className="flex-grow"></div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch id="fill-mode" checked={clientState.isFillMode} onCheckedChange={(checked) => setClientState(cs => ({ ...cs, isFillMode: checked }))} />
                <Label htmlFor="fill-mode">Modo Relleno</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="snap-mode" checked={clientState.isObstacleSnapActive} onCheckedChange={(checked) => setClientState(cs => ({ ...cs, isObstacleSnapActive: checked }))} />
                <Label htmlFor="snap-mode">Alinear a obstáculos</Label>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handleDownloadPDF}
                title="Descargar Reporte PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 bg-card p-2 relative overflow-hidden flex flex-col">
            <div ref={canvasViewportRef} className={cn(
              "flex-1 relative border rounded-md overflow-hidden bg-muted/30 transition-shadow duration-200",
              clientState.activeBrush ? "shadow-inner ring-1 ring-primary/20" : ""
            )}>
              {activeSurface ? (
                <Canvas
                  surface={activeSurface}
                  pieces={activeSurfacePieces}
                  obstacles={activeSurfaceObstacles}
                  project={project}
                  onPlacePiece={handlePiecePlacement}
                  onDeletePiece={handlePieceDelete}
                  onBatchDeletePieces={handleBatchDeletePieces}
                  clientState={clientState}
                  onClientStateChange={setClientState}
                  rotationAnchor={rotationAnchor}
                  onRotationAnchorChange={setRotationAnchor}
                  onToolSelect={handleToolSelect}
                  onPivotChange={setPivotPoint}
                  isDrawingObstacle={isDrawingObstacle}
                  editingObstacleId={editingObstacleId}
                  onFinishDrawingObstacle={() => {
                    setIsDrawingObstacle(false);
                    setEditingObstacleId(null);
                    setCurrentObstaclePoints([]);
                    setIsObstaclesSheetOpen(true);
                  }}
                  isPivotSelectorOpen={isPivotSelectorOpen}
                  onPivotSelectorOpenChange={setIsPivotSelectorOpen}
                  isMeasureToolOpen={isMeasureToolOpen}
                  onMeasureToolOpenChange={setIsMeasureToolOpen}
                  onUpdateStartPoint={handleUpdateObstacleStartPoint}
                  previewSegment={previewSegment}
                  onPreviewChange={handlePreviewChange}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  viewportRef={canvasViewportRef}
                  currentObstaclePoints={currentObstaclePoints}
                  onCurrentObstaclePointsChange={setCurrentObstaclePoints}
                  obstacleAnchorIndex={obstacleAnchorIndex}
                  onObstacleAnchorIndexChange={setObstacleAnchorIndex}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground">
                    {surfaces.length > 0 ? "Seleccione una superficie para comenzar" : "Este proyecto no tiene superficies. Añada una en la configuración."}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Toolbar - Dedicated Space */}
            {/* Bottom Toolbar - Dedicated Space with Floating Look */}
            {/* Using a relative container that takes up space but centers the 'floating' tool bar */}
            <div className="h-20 flex items-center justify-center relative z-20 pointer-events-none bg-background/50 backdrop-blur-sm border-t">
              <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-full bg-background/95 shadow-lg border ring-1 ring-border/50 hover:scale-[1.01] transition-transform">
                <ToolButton tooltip="Seleccionar (Ctrl+V)" Icon={MousePointer} isActive={!clientState.isEraserMode && !clientState.isMeasureMode && !isDrawingObstacle && !clientState.isHandMode && !clientState.activeBrush} onClick={() => handleToolSelect('brush')} />
                <ToolButton tooltip="Mover (Ctrl+H)" Icon={props => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></svg>} isActive={clientState.isHandMode} onClick={() => setClientState(prev => ({ ...prev, isHandMode: !prev.isHandMode, isEraserMode: false, isMeasureMode: false, activeBrush: null }))} />
                <Separator orientation="vertical" className="h-6 mx-1" />
                <ToolButton tooltip="Borrador (Ctrl+E)" Icon={Eraser} isActive={clientState.isEraserMode} onClick={() => handleToolSelect('eraser')} />
                <Separator orientation="vertical" className="h-6 mx-1" />
                <MeasureToolSelector
                  clientState={clientState}
                  onToolSelect={handleToolSelect}
                  isOpen={isMeasureToolOpen}
                  onOpenChange={setIsMeasureToolOpen}
                />
                <Separator orientation="vertical" className="h-6 mx-1" />
                {/* Zoom Controls */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setClientState(prev => ({ ...prev, viewZoom: Math.max(0.1, prev.viewZoom - 0.1) }))} title="Zoom Out (Ctrl -)">
                    <span className="text-lg font-bold">-</span>
                  </Button>
                  <span className="text-xs w-8 text-center">{Math.round(clientState.viewZoom * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setClientState(prev => ({ ...prev, viewZoom: Math.min(5, prev.viewZoom + 0.1) }))} title="Zoom In (Ctrl +)">
                    <span className="text-lg font-bold">+</span>
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6 mx-1" />
                <PivotSelector
                  currentPivot={clientState.pivotPoint}
                  onPivotChange={setPivotPoint}
                  isOpen={isPivotSelectorOpen}
                  onOpenChange={setIsPivotSelectorOpen}
                />
              </div>

              {/* Help Button - Absolute Right in the container */}
              <div className="absolute right-4 pointer-events-auto">
                <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-full h-10 w-10 shadow-sm border-2">
                            <HelpCircle className="h-5 w-5" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent><p>Ayuda y Atajos</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl border-none shadow-2xl top-10 translate-y-0">
                    <DialogHeader className="p-8 pb-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                        <HelpCircle className="h-24 w-24" />
                      </div>
                      <DialogTitle className="text-3xl font-bold flex items-center gap-3">
                        <Zap className="h-8 w-8 text-yellow-300 animate-pulse" />
                        Dominando DecoToolkit
                      </DialogTitle>
                      <DialogDescription className="text-blue-100 text-lg">
                        ¡Hola! Aquí tienes todo lo necesario para convertirte en un experto del diseño.
                      </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="nav" className="flex-1 flex flex-col overflow-hidden">
                      <div className="px-8 bg-muted/30 border-b">
                        <TabsList className="h-14 bg-transparent gap-6 p-0">
                          <TabsTrigger value="nav" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                            <Navigation className="h-4 w-4" /> Navegación
                          </TabsTrigger>
                          <TabsTrigger value="materials" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                            <BrushIcon className="h-4 w-4" /> Materiales
                          </TabsTrigger>
                          <TabsTrigger value="measure" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                            <Ruler className="h-4 w-4" /> Medición
                          </TabsTrigger>
                          <TabsTrigger value="obstacles" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                            <SquareDashedBottom className="h-4 w-4" /> Obstáculos
                          </TabsTrigger>
                          <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                            <Command className="h-4 w-4" /> Atajos
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <div className="flex-1 overflow-hidden relative">
                        <ScrollArea className="h-full px-8 py-6">
                          <TabsContent value="nav" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid gap-4">
                              <div className="flex gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100 shadow-sm transition-all hover:shadow-md">
                                <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                                  <Maximize className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-blue-900 text-lg">Control de Vista</h4>
                                  <p className="text-blue-800/70 mb-2">Usa <kbd className="bg-white px-2 py-0.5 rounded border shadow-sm text-black inline-flex items-center gap-1 font-mono">Ctrl + H</kbd> para activar la mano y arrastrar el lienzo con soltura.</p>
                                  <p className="text-blue-800/70">Usa <kbd className="bg-white px-2 py-0.5 rounded border shadow-sm text-black inline-flex items-center gap-1 font-mono">Alt + Rueda</kbd> para hacer zoom y ver cada detalle.</p>
                                </div>
                              </div>
                              <div className="flex gap-4 p-4 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                  <RotateCw className="h-6 w-6 text-slate-600" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900 text-lg">Pánico / Reseteo</h4>
                                  <p className="text-slate-600">Si te pierdes en el lienzo, pulsa <kbd className="bg-slate-50 px-2 py-0.5 rounded border text-slate-900 font-mono">Ctrl + Espacio</kbd> para volver al centro y al 100% de zoom instantáneamente.</p>
                                </div>
                              </div>
                            </div>
                            <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-100 flex items-start gap-3">
                              <Info className="h-5 w-5 text-indigo-600 mt-0.5" />
                              <p className="text-indigo-900 text-sm italic">
                                <b>Truco:</b> También puedes usar el botón central del ratón (la rueda) para panear sin cambiar de herramienta.
                              </p>
                            </div>
                          </TabsContent>

                          <TabsContent value="materials" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-4">
                              <div className="flex gap-4 items-start border-l-4 border-orange-400 pl-4 py-2">
                                <div className="p-2 rounded-lg bg-orange-50 shrink-0">✨</div>
                                <div>
                                  <h4 className="font-bold text-lg">Colocación en Serie</h4>
                                  <p className="text-muted-foreground italic mb-1">"¡La forma más rápida de llenar una superficie!"</p>
                                  <p className="text-muted-foreground">Haz clic y <b>arrastra</b> sobre el lienzo. El editor colocará automáticamente filas de piezas perfectamente alineadas.</p>
                                </div>
                              </div>
                              <div className="flex gap-4 items-start border-l-4 border-blue-400 pl-4 py-2">
                                <div className="p-2 rounded-lg bg-blue-50 shrink-0">🔄</div>
                                <div>
                                  <h4 className="font-bold text-lg">Gira antes de poner</h4>
                                  <p className="text-muted-foreground">Usa <kbd className="bg-muted px-2 py-0.5 rounded border font-mono">Alt + Rueda</kbd> para rotar la pieza que tienes en el cursor. Verás el ángulo en tiempo real.</p>
                                </div>
                              </div>
                              <div className="flex gap-4 items-start border-l-4 border-purple-400 pl-4 py-2">
                                <div className="p-2 rounded-lg bg-purple-50 shrink-0">📍</div>
                                <div>
                                  <h4 className="font-bold text-lg">Punto de Sujeción</h4>
                                  <p className="text-muted-foreground">Cambia desde qué esquina agarras la pieza con <kbd className="bg-muted px-2 py-0.5 rounded border font-mono">Ctrl + A</kbd>. Ideal para empezar con precisión desde bordes.</p>
                                </div>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="measure" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-5 rounded-2xl bg-green-50/50 border-2 border-green-100 relative overflow-hidden group hover:bg-green-50 transition-colors">
                                <div className="absolute top-2 right-2 h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Crop className="h-4 w-4 text-green-600" />
                                </div>
                                <h4 className="font-bold text-green-900 mb-1">Modo Área</h4>
                                <p className="text-green-800/70 text-sm">Dibuja rectángulos para medir superficies rápidas y obtener m² al instante.</p>
                              </div>
                              <div className="p-5 rounded-2xl bg-emerald-50/50 border-2 border-emerald-100 relative overflow-hidden group hover:bg-emerald-50 transition-colors">
                                <div className="absolute top-2 right-2 h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Scissors className="h-4 w-4 text-emerald-600" />
                                </div>
                                <h4 className="font-bold text-emerald-900 mb-1">Modo Vértice</h4>
                                <p className="text-emerald-800/70 text-sm">Une puntos libremente para perímetros complejos o distancias personalizadas.</p>
                              </div>
                            </div>
                            <div className="bg-muted/50 p-4 rounded-xl border space-y-2">
                              <div className="flex items-center gap-2"><div className="w-6 text-center font-bold bg-white rounded border text-xs py-0.5">⇧</div><p className="text-sm">Mantén <b>Shift</b> para forzar líneas rectas (horizontales o verticales).</p></div>
                              <div className="flex items-center gap-2"><div className="w-6 text-center font-bold bg-white rounded border text-xs py-0.5">Esc</div><p className="text-sm">Cancela el dibujo actual en cualquier momento.</p></div>
                              <div className="flex items-center gap-2"><div className="w-6 text-center font-bold bg-white rounded border text-xs py-0.5">⌫</div><p className="text-sm"><b>Retroceso:</b> Elimina el último vértice dibujado.</p></div>
                            </div>
                          </TabsContent>

                          <TabsContent value="obstacles" className="mt-0 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                              <p className="text-purple-900 font-bold flex items-center gap-2 mb-2">
                                <SquareDashedBottom className="h-4 w-4" /> Magia con Obstáculos
                              </p>
                              <p className="text-purple-800/80 text-sm leading-relaxed">
                                Define columnas, enchufes o ventanas. El material se cortará automáticamente para evitarlos. ¡No pierdas ni un centímetro!
                              </p>
                            </div>

                            <div className="space-y-3">
                              <h5 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Gamepad2 className="h-4 w-4" /> Atajos del modo Dibujo
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                                  <span className="text-xs font-semibold">Girar segmento</span>
                                  <div className="flex items-center gap-1 font-mono text-[10px]">
                                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">Alt + Rueda (15°)</kbd>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                                  <span className="text-xs font-semibold">Direcciones 90°</span>
                                  <div className="flex items-center gap-1 font-mono text-[10px]">
                                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">↑</kbd>
                                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">↓</kbd>
                                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">←</kbd>
                                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">→</kbd>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                                  <span className="text-xs font-semibold">Añadir segmento</span>
                                  <kbd className="bg-muted px-1.5 py-0.5 rounded border font-mono text-[10px]">Enter</kbd>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                                  <span className="text-xs font-semibold">Guardar Obstáculo</span>
                                  <kbd className="bg-muted px-1.5 py-0.5 rounded border font-mono text-[10px]">Ctrl + Enter</kbd>
                                </div>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="all" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="rounded-xl border shadow-sm divide-y overflow-hidden">
                              <div className="p-3 bg-muted/20 font-bold text-sm flex justify-between">
                                <span>Acción</span>
                                <span>Atajo</span>
                              </div>
                              {[
                                { a: "Herramienta Mano (Toggle)", k: "Ctrl + H" },
                                { a: "Pincel de Material", k: "Ctrl + V" },
                                { a: "Goma de Borrar", k: "Ctrl + E" },
                                { a: "Calculadora / Medición", k: "Ctrl + R" },
                                { a: "Cambiar Punto Anclaje", k: "Ctrl + A" },
                                { a: "Deshacer acción", k: "Ctrl + Z" },
                                { a: "Rehacer acción", k: "Ctrl + Y / Shift+Z" },
                                { a: "Reseteo de vista", k: "Ctrl + Space" },
                              ].map((row, i) => (
                                <div key={i} className="p-3 flex justify-between items-center text-sm hover:bg-slate-50 transition-colors">
                                  <span className="text-muted-foreground">{row.a}</span>
                                  <kbd className="bg-muted px-2 py-0.5 rounded border font-mono text-[10px]">{row.k}</kbd>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        </ScrollArea>
                      </div>
                    </Tabs>

                    <DialogFooter className="p-6 bg-slate-50 border-t flex-row sm:justify-between items-center">
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <Gamepad2 className="h-4 w-4" />
                        <span>Sugerencia: Prueba a mantener las teclas para combinaciones rápidas.</span>
                      </div>
                      <Button onClick={() => setIsHelpDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                        ¡Entendido!
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
      </main>
      <CuttingToolDialog
        material={cuttingMaterial}
        open={!!cuttingMaterial}
        onOpenChange={(open) => !open && setCuttingMaterial(null)}
        onGenerateCuts={handleGenerateCuts}
      />

    </div>
  );
}

// Removing Canvas Props that are no longer strictly needed but keeping interface for now to minimize breakage if I missed something,
// basically I moved the toolbar outside, so Canvas doesn't need to render it. But Canvas doesn't render it anyway, it just rendered children or overlay.
// Wait, I need to check `Canvas` component to remove the OLD toolbar code.


const defaultColors = [
  '#A67B5B', '#D2B48C', '#C0C0C0', '#808080', '#F5DEB3', '#36454F'
];

const DimensionInputSchema = z.object({
  value: z.coerce.number().positive("Value must be positive"),
  unit: z.enum(["m", "cm"]),
});

const MaterialFormSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  width: DimensionInputSchema,
  height: DimensionInputSchema,
  installationOrientation: z.enum(["Vertical", "Horizontal"]),
  color: z.string().min(1, "Color is required"),
  defaultMaterialId: z.string().optional(),
});

const SurfaceFormSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Surface name is required"),
  width: DimensionInputSchema,
  height: DimensionInputSchema,
});

const ObstacleFormSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
});

const ProjectEditSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  materials: z.array(MaterialFormSchema).min(1, "At least one material is required").max(3, "You can add up to 3 materials"),
  surfaces: z.array(SurfaceFormSchema).min(1, "At least one surface is required").max(6, "You can add up to 6 surfaces"),
});

type ProjectEditFormValues = z.infer<typeof ProjectEditSchema>;
type ObstacleFormValues = z.infer<typeof ObstacleFormSchema>;

const materialDefaultValues = {
  id: () => `mat-${crypto.randomUUID()}`,
  name: "",
  width: { value: 1.22, unit: "m" as Unit },
  height: { value: 2.80, unit: "m" as Unit },
  installationOrientation: "Vertical" as "Vertical" | "Horizontal",
  color: defaultColors[0],
  defaultMaterialId: "custom",
};

const surfaceDefaultValues = {
  id: () => `surf-${crypto.randomUUID()}`,
  name: "",
  width: { value: 3, unit: "m" as Unit },
  height: { value: 2.5, unit: "m" as Unit },
};

function EditProjectSheet({ project, surfaces: initialSurfaces }: { project: Project, surfaces: Surface[] }) {
  const [open, setOpen] = useState(false);
  const [defaultMaterials, setDefaultMaterials] = useState<DefaultMaterial[]>([]);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<ProjectEditFormValues>({
    resolver: zodResolver(ProjectEditSchema),
    defaultValues: {
      projectName: '',
      clientName: '',
      clientPhone: '',
      materials: [],
      surfaces: [],
    }
  });

  useEffect(() => {
    if (!firestore) return;
    const materialsCol = collection(firestore, "defaultMaterials");
    const q = query(materialsCol, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const materialsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DefaultMaterial[];
      setDefaultMaterials(materialsData);
    });
    return () => unsubscribe();
  }, [firestore]);

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({
    control: form.control, name: "materials",
  });

  const { fields: surfaceFields, append: appendSurface, remove: removeSurface } = useFieldArray({
    control: form.control, name: "surfaces",
  });

  useEffect(() => {
    if (project && initialSurfaces && open) {
      form.reset({
        projectName: project.projectName,
        clientName: project.clientName,
        clientPhone: project.clientPhone,
        materials: project.materials.map(m => ({
          ...m,
          width: { value: convertFromCm(m.width, 'm'), unit: 'm' },
          height: { value: convertFromCm(m.height, 'm'), unit: 'm' },
          defaultMaterialId: m.defaultMaterialId || 'custom',
        })),
        surfaces: initialSurfaces.map(s => ({
          ...s,
          width: { value: convertFromCm(s.width, 'm'), unit: 'm' },
          height: { value: convertFromCm(s.height, 'm'), unit: 'm' },
        })),
      });
    }
  }, [project, initialSurfaces, open, form]);

  const onSubmit = async (data: ProjectEditFormValues) => {
    if (!firestore) return;
    try {
      const batch = writeBatch(firestore);
      const projectRef = doc(firestore, "projects", project.id);

      const processedMaterials: Material[] = data.materials.map(m => ({
        id: m.id,
        name: m.name || '',
        width: convertToCm(m.width.value, m.width.unit),
        height: convertToCm(m.height.value, m.height.unit),
        installationOrientation: m.installationOrientation,
        color: m.color,
        defaultMaterialId: m.defaultMaterialId,
      }));

      // 1. Update main project document
      batch.update(projectRef, {
        projectName: data.projectName,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        materials: processedMaterials,
      });

      // 2. Sync Surfaces
      const originalSurfaceIds = new Set(initialSurfaces.map(s => s.id));
      const newSurfaceIds = new Set(data.surfaces.map(s => s.id));

      // 2a. Delete surfaces that are no longer in the form
      for (const originalSurf of initialSurfaces) {
        if (!newSurfaceIds.has(originalSurf.id)) {
          batch.delete(doc(firestore, "projects", project.id, "surfaces", originalSurf.id));
        }
      }

      // 2b. Create or Update surfaces
      for (const formSurface of data.surfaces) {
        const surfaceData = {
          name: formSurface.name,
          width: convertToCm(formSurface.width.value, formSurface.width.unit),
          height: convertToCm(formSurface.height.value, formSurface.height.unit),
        };
        const surfaceRef = doc(firestore, "projects", project.id, "surfaces", formSurface.id);

        if (originalSurfaceIds.has(formSurface.id)) {
          batch.update(surfaceRef, surfaceData);
        } else {
          batch.set(surfaceRef, surfaceData);
        }
      }

      await batch.commit();

      setOpen(false);

    } catch (error: any) {
      console.error("Error updating project:", error);
      toast({ title: "Error", description: "Could not save changes.", variant: "destructive" });
    }
  };

  const handleDefaultMaterialChange = (materialId: string, index: number) => {
    const selectedMaterial = defaultMaterials.find(m => m.id === materialId);

    form.setValue(`materials.${index}.defaultMaterialId`, materialId);

    if (selectedMaterial) {
      const currentWidthUnit = form.getValues(`materials.${index}.width.unit`);
      const currentHeightUnit = form.getValues(`materials.${index}.height.unit`);

      form.setValue(`materials.${index}.width.value`, convertFromCm(selectedMaterial.width, currentWidthUnit));
      form.setValue(`materials.${index}.height.value`, convertFromCm(selectedMaterial.height, currentHeightUnit));
    }
  }


  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Project: {form.getValues("projectName")}</SheetTitle>
          <SheetDescription>
            Add, remove, or edit materials and surfaces for this project.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-8">
            <Card>
              <CardHeader><CardTitle>Project and Client Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="projectName" render={({ field }) => (
                  <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="clientName" render={({ field }) => (
                    <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="clientPhone" render={({ field }) => (
                    <FormItem><FormLabel>Client Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Materials</CardTitle>
                <CardDescription>Define up to 3 types of materials you will be using.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {materialFields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-muted/50">
                    <div className="absolute top-2 right-2">
                      {materialFields.length > 1 && (
                        <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => removeMaterial(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`materials.${index}.defaultMaterialId`}
                        render={({ field: selectField }) => (
                          <FormItem>
                            <FormLabel>Tipo de Material</FormLabel>
                            <Select onValueChange={(value) => handleDefaultMaterialChange(value, index)} value={selectField.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a standard material" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="custom">Custom</SelectItem>
                                {defaultMaterials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField control={form.control} name={`materials.${index}.name`} render={({ field: f }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...f} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name={`materials.${index}.width`} render={({ field: f }) => (
                        <FormItem><FormLabel>Width</FormLabel><div className="flex gap-2"><FormControl><Input type="number" step="any" {...form.register(`materials.${index}.width.value`)} /></FormControl><Select onValueChange={(u) => form.setValue(`materials.${index}.width.unit`, u as Unit)} defaultValue={f.value.unit}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent></Select></div><FormMessage>{form.formState.errors.materials?.[index]?.width?.value?.message}</FormMessage></FormItem>
                      )} />
                      <FormField control={form.control} name={`materials.${index}.height`} render={({ field: f }) => (
                        <FormItem><FormLabel>Height</FormLabel><div className="flex gap-2"><FormControl><Input type="number" step="any" {...form.register(`materials.${index}.height.value`)} /></FormControl><Select onValueChange={(u) => form.setValue(`materials.${index}.height.unit`, u as Unit)} defaultValue={f.value.unit}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent></Select></div><FormMessage>{form.formState.errors.materials?.[index]?.height?.value?.message}</FormMessage></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name={`materials.${index}.installationOrientation`} render={({ field: f }) => (
                        <FormItem><FormLabel>Orientation</FormLabel><Select onValueChange={f.onChange} defaultValue={f.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Vertical">Vertical</SelectItem><SelectItem value="Horizontal">Horizontal</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name={`materials.${index}.color`} render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              {defaultColors.map(color => (
                                <button
                                  type="button"
                                  key={color}
                                  className={cn("h-8 w-8 rounded-md border-2", f.value === color ? 'border-primary' : 'border-transparent')}
                                  style={{ backgroundColor: color }}
                                  onClick={() => f.onChange(color)}
                                >
                                  {f.value === color && <Check className="h-5 w-5 text-white" />}
                                </button>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                ))}
                {materialFields.length < 3 && (
                  <Button type="button" variant="outline" onClick={() => appendMaterial({ ...materialDefaultValues, id: materialDefaultValues.id(), name: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Material
                  </Button>
                )}
                {form.formState.errors.materials && typeof form.formState.errors.materials === 'object' && 'message' in form.formState.errors.materials && <p className="text-sm font-medium text-destructive">{form.formState.errors.materials.message}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Surfaces</CardTitle>
                <CardDescription>Define the surfaces (e.g., walls) to be covered.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {surfaceFields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-muted/50">
                    <div className="absolute top-2 right-2">
                      {surfaceFields.length > 1 && (
                        <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => removeSurface(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormField control={form.control} name={`surfaces.${index}.name`} render={({ field }) => (
                      <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name={`surfaces.${index}.width`} render={({ field: f }) => (
                        <FormItem><FormLabel>Width</FormLabel><div className="flex gap-2"><FormControl><Input type="number" step="any" {...form.register(`surfaces.${index}.width.value`)} /></FormControl><Select onValueChange={(u) => form.setValue(`surfaces.${index}.width.unit`, u as Unit)} defaultValue={f.value.unit}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent></Select></div><FormMessage>{form.formState.errors.surfaces?.[index]?.width?.value?.message}</FormMessage></FormItem>
                      )} />
                      <FormField control={form.control} name={`surfaces.${index}.height`} render={({ field: f }) => (
                        <FormItem><FormLabel>Height</FormLabel><div className="flex gap-2"><FormControl><Input type="number" step="any" {...form.register(`surfaces.${index}.height.value`)} /></FormControl><Select onValueChange={(u) => form.setValue(`surfaces.${index}.height.unit`, u as Unit)} defaultValue={f.value.unit}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent></Select></div><FormMessage>{form.formState.errors.surfaces?.[index]?.height?.value?.message}</FormMessage></FormItem>
                      )} />
                    </div>
                  </div>
                ))}
                {surfaceFields.length < 6 && (
                  <Button type="button" variant="outline" onClick={() => appendSurface({ ...surfaceDefaultValues, id: surfaceDefaultValues.id() })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Surface
                  </Button>
                )}
                {form.formState.errors.surfaces && typeof form.formState.errors.surfaces === 'object' && 'message' in form.formState.errors.surfaces && <p className="text-sm font-medium text-destructive">{form.formState.errors.surfaces.message}</p>}
              </CardContent>
            </Card>

            <SheetFooter className="pt-8">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

function ObstaclesSheet({
  project,
  obstacles,
  activeSurface,
  onStartDrawing,
  onEditObstacle,
  isOpen,
  onOpenChange,
}: {
  project: Project,
  obstacles: Obstacle[],
  activeSurface: Surface | null,
  onStartDrawing: (obstacle?: Obstacle) => void,
  onEditObstacle: (obstacle: Obstacle) => void,
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const form = useForm<ObstacleFormValues>({
    resolver: zodResolver(ObstacleFormSchema),
    defaultValues: {
      id: '',
      name: '',
      points: [],
    }
  });

  const onDeleteObstacle = async (obstacleId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "projects", project.id, "obstacles", obstacleId));
      toast({ title: "Success", description: "Obstacle removed." });
    } catch (error) {
      console.error("Error deleting obstacle:", error);
      toast({ title: "Error", description: "Could not remove obstacle.", variant: "destructive" });
    }
  }

  const handleStartDrawingWithReset = () => {
    setPendingDeleteId(null);
    onStartDrawing();
    onOpenChange(false); // Close the sheet to allow canvas interaction
  }

  const handleEdit = (obstacle: Obstacle) => {
    setPendingDeleteId(null);
    onEditObstacle(obstacle);
    onOpenChange(false);
  }

  const handleClose = () => {
    setPendingDeleteId(null);
    onOpenChange(false);
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" disabled={!activeSurface}>
          <SquareDashedBottom className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Obstacles on "{activeSurface?.name}"</SheetTitle>
          <SheetDescription>
            Define areas where material cannot be placed.
          </SheetDescription>
        </SheetHeader>

        <div className="py-8 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Add New Obstacle</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartDrawingWithReset} className="w-full">
                <Pencil className="mr-2 h-4 w-4" />
                Dibujar Nuevo Obstáculo
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Esto activará el modo de dibujo en el lienzo.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Obstacles</CardTitle>
            </CardHeader>
            <CardContent>
              {obstacles.length > 0 ? (
                <div className="space-y-3">
                  {obstacles.map((obs, index) => {
                    // Simplify points for display to handle accidental collinear intermediate nodes
                    const simplifiedPoints = simplifyPath(obs.points);

                    // Determine if the simplified path is a closed loop
                    const isClosed = simplifiedPoints.length > 2 &&
                      Math.abs(simplifiedPoints[0].x - simplifiedPoints[simplifiedPoints.length - 1].x) < EPSILON &&
                      Math.abs(simplifiedPoints[0].y - simplifiedPoints[simplifiedPoints.length - 1].y) < EPSILON;

                    // Unique vertices: if closed, the last point is duplicate of first
                    const vertexCount = isClosed ? simplifiedPoints.length - 1 : simplifiedPoints.length;

                    const segments: number[] = [];
                    for (let i = 0; i < obs.points.length - 1; i++) {
                      const p1 = obs.points[i];
                      const p2 = obs.points[i + 1];
                      const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                      segments.push(length);
                    }

                    return (
                      <Collapsible key={obs.id} className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <CollapsibleTrigger className="flex flex-1 items-center justify-between text-sm font-medium">
                            <span>{obs.name || `Obstáculo ${index + 1}`} ({vertexCount} {vertexCount === 1 ? 'vértice' : 'vértices'})</span>
                            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                          {pendingDeleteId === obs.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700 ml-1"
                                onClick={() => {
                                  onDeleteObstacle(obs.id);
                                  setPendingDeleteId(null);
                                }}
                                title="Confirmar eliminar"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 ml-1"
                                onClick={() => setPendingDeleteId(null)}
                                title="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary ml-1" onClick={() => handleEdit(obs)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive ml-1"
                                onClick={() => setPendingDeleteId(obs.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                        <CollapsibleContent className="px-4 py-2 border-l-2 ml-2 space-y-1 text-xs">
                          {segments.map((length, index) => (
                            <div key={index} className="flex justify-between">
                              <span className="text-muted-foreground">Línea {index + 1}:</span>
                              <span className="font-mono">{convertFromCm(length, 'm').toFixed(2)} m</span>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No obstacles defined for this surface.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}



// --- UI Components ---
function MaterialBrush({
  material,
  isActive,
  onSelect,
  onRotate,
  onCut
}: {
  material: Material;
  isActive: boolean;
  onSelect: () => void;
  onRotate: () => void;
  onCut: () => void;
}) {
  const [defaultMaterialName, setDefaultMaterialName] = useState('');
  const firestore = useFirestore();

  useEffect(() => {
    if (firestore && material.defaultMaterialId && material.defaultMaterialId !== 'custom') {
      const unsub = onSnapshot(doc(firestore, "defaultMaterials", material.defaultMaterialId), (doc) => {
        if (doc.exists()) {
          setDefaultMaterialName(doc.data().name);
        }
      });
      return () => unsub();
    } else {
      setDefaultMaterialName('');
    }
  }, [firestore, material.defaultMaterialId]);

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  }

  const mainTitle = material.name || defaultMaterialName;
  const subTitle = material.name ? defaultMaterialName : '';

  return (
    <div
      onClick={onSelect}
      className={cn(
        "w-full p-3 rounded-lg border text-left transition-all cursor-pointer",
        isActive ? "ring-2 ring-primary ring-offset-2 bg-primary/10 border-primary/50" : "bg-card hover:bg-muted/50"
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: material.color }}></div>
          <div>
            <p className="font-semibold text-sm leading-tight">{mainTitle || `Material`}</p>
            {subTitle && (
              <p className="text-xs text-muted-foreground">{subTitle}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleActionClick(e, onCut)}>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 group" onClick={(e) => handleActionClick(e, onRotate)}>
            <RotateCw className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Dimensiones: {convertFromCm(material.height, "m").toFixed(2)}m x {convertFromCm(material.width, "m").toFixed(2)}m
      </p>
    </div>
  )
}

function RemnantBrush({
  remnant,
  materialColor,
  isActive,
  onSelect,
}: {
  remnant: GroupedRemnant;
  materialColor: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizedPoints = useMemo(() => {
    const frags = remnant.fragments || [{ id: 'legacy', points: remnant.points }];
    if (frags.length === 0) return { width: 0, height: 0, minX: 0, minY: 0 };

    const allPoints = frags.flatMap(f => f.points);
    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return { width: maxX - minX, height: maxY - minY, minX, minY };
  }, [remnant.fragments, remnant.points]);

  const PREVIEW_SIZE = 100; // max width/height for the preview svg
  const svgWidth = normalizedPoints.width >= normalizedPoints.height ? PREVIEW_SIZE : (normalizedPoints.width / normalizedPoints.height) * PREVIEW_SIZE;
  const svgHeight = normalizedPoints.height > normalizedPoints.width ? PREVIEW_SIZE : (normalizedPoints.height / normalizedPoints.width) * PREVIEW_SIZE;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          onClick={onSelect}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className={cn(
            "w-full p-2 rounded-md text-left transition-all cursor-pointer flex items-center justify-between",
            isActive ? "bg-primary/20" : "hover:bg-muted"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: materialColor }} />
            <div className="flex flex-col gap-1">
              <p className="font-mono text-sm font-bold leading-none">
                {convertFromCm(remnant.width, "m").toFixed(2)}m x {convertFromCm(remnant.height, "m").toFixed(2)}m
              </p>
              <p className="font-mono text-[10px] text-muted-foreground leading-none uppercase tracking-wider">
                Área: {Math.abs((remnant.fragments || [{ id: 'legacy', points: remnant.points }]).reduce((sum, f) => sum + calculatePolygonArea(f.points), 0) / 10000).toFixed(2)} m²
              </p>
            </div>
          </div>
          {remnant.count > 1 && (
            <Badge variant="secondary" className="font-semibold">{remnant.count}</Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-auto p-2">
        <div className="flex flex-col items-center">
          <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${normalizedPoints.width} ${normalizedPoints.height}`}>
            <path
              fill={materialColor}
              fillRule="evenodd"
              className="opacity-70"
              d={(remnant.fragments || [{ id: 'legacy', points: remnant.points }]).map(f =>
                "M " + f.points.map(p => `${(p.x - normalizedPoints.minX)} ${(p.y - normalizedPoints.minY)}`).join(' L ') + " Z"
              ).join(' ')}
            />
          </svg>
          <p className="text-xs font-mono mt-2">
            {convertFromCm(remnant.width, "m").toFixed(2)}m x {convertFromCm(remnant.height, "m").toFixed(2)}m
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ToolButton({ tooltip, Icon, isActive, onClick, children }: { tooltip: string, Icon?: React.ElementType, isActive?: boolean, onClick?: (e: React.MouseEvent) => void, children?: React.ReactNode }) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-12 w-12",
              isActive && "bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary"
            )}
            onClick={handleClick}
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
  topLeft: ArrowUpLeft,
  topRight: ArrowUpRight,
  bottomLeft: ArrowDownLeft,
  bottomRight: ArrowDownRight,
};

function PivotSelector({
  currentPivot,
  onPivotChange,
  isOpen,
  onOpenChange,
}: {
  currentPivot: PivotPoint;
  onPivotChange: (pivot: PivotPoint) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const CurrentIcon = pivotIcons[currentPivot];

  const handleSelect = (pivot: PivotPoint) => {
    onPivotChange(pivot);
    onOpenChange(false);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    onOpenChange(!isOpen);
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-12 w-12" onClick={handleTriggerClick}>
                <CurrentIcon className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Punto de Pivote (Ctrl+A)</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-1">
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(pivotIcons) as PivotPoint[]).map((pivot) => {
            const Icon = pivotIcons[pivot];
            return (
              <Button
                key={pivot}
                variant={currentPivot === pivot ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => handleSelect(pivot)}
                className="h-10 w-10"
              >
                <Icon className="h-5 w-5" />
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MeasureToolSelector({
  clientState,
  onToolSelect,
  isOpen,
  onOpenChange,
}: {
  clientState: Omit<ClientState, "projectId" | "materials" | "remnants" | "surfaces" | "history">;
  onToolSelect: (tool: 'brush' | 'eraser' | 'measure', measureMode?: MeasureMode) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { isMeasureMode, measureMode } = clientState;

  const handleSelect = (mode: MeasureMode) => {
    onToolSelect('measure', mode);
    onOpenChange(false);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (!isMeasureMode) {
      onToolSelect('measure');
    }
    onOpenChange(!isOpen);
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full h-12 w-12",
                  isMeasureMode && "bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary"
                )}
                onClick={handleTriggerClick}
              >
                <Ruler className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Medir (Ctrl+R)</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-1">
        <div className="grid grid-cols-1 gap-1">
          <Button
            variant={measureMode === 'area' ? 'secondary' : 'ghost'}
            onClick={() => handleSelect('area')}
            className="justify-start"
          >
            <Square className="mr-2 h-4 w-4" /> Medir Área
          </Button>
          <Button
            variant={measureMode === 'distance' ? 'secondary' : 'ghost'}
            onClick={() => handleSelect('distance')}
            className="justify-start"
          >
            <LineChart className="mr-2 h-4 w-4" /> Medir Distancia
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


// --- Canvas Component ---
type CanvasProps = {
  surface: Surface;
  pieces: PlacedPiece[];
  obstacles: Obstacle[];
  project: Project;
  onPlacePiece: (positions: Point[]) => void;
  onDeletePiece: (pieceId: string) => void;
  onBatchDeletePieces: (pieceIds: string[]) => void;
  onUpdateStartPoint: (newPoint: Point) => void;
  clientState: Omit<ClientState, "projectId" | "materials" | "remnants">;
  onClientStateChange: React.Dispatch<React.SetStateAction<Omit<ClientState, "projectId" | "materials" | "remnants">>>;
  rotationAnchor: Point | null;
  onRotationAnchorChange: React.Dispatch<React.SetStateAction<Point | null>>;
  onToolSelect: (tool: 'brush' | 'eraser' | 'measure', measureMode?: MeasureMode) => void;
  onPivotChange: (pivot: PivotPoint) => void;
  isDrawingObstacle: boolean;
  editingObstacleId?: string | null;
  onFinishDrawingObstacle: () => void;
  isPivotSelectorOpen: boolean;
  onPivotSelectorOpenChange: (isOpen: boolean) => void;
  isMeasureToolOpen: boolean;
  onMeasureToolOpenChange: (isOpen: boolean) => void;
  previewSegment: { length: number; angle: number; } | null;
  onPreviewChange: (data: { length: number; angle: number } | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  viewportRef: React.RefObject<HTMLDivElement>;
  currentObstaclePoints: Point[];
  onCurrentObstaclePointsChange: React.Dispatch<React.SetStateAction<Point[]>>;
  obstacleAnchorIndex?: number;
  onObstacleAnchorIndexChange?: (index: number) => void;
};

// We need a more specific type for the measurement being drawn
type DrawingMeasurement = Measurement;

const eraserCursorSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z'/><path d='M22 11.5 12.5 2'/><path d='m15 5 4 4'/></svg>`;
const crossCursorSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'><line x1='13' y1='3' x2='3' y2='13'/><line x1='3' y1='3' x2='13' y2='13'/></svg>`;
const SNAP_THRESHOLD_PX = 10;
const DRAG_THRESHOLD_PX = 10;

// NUEVO COMPONENTE REUTILIZABLE
function RemnantGhost({ remnant, scale, style }: { remnant: Brush, scale: number, style: React.CSSProperties }) {
  if (remnant.type !== 'remnant') return null;

  const fragments = remnant.fragments || [{ id: 'legacy', points: remnant.points }];
  const allPoints = fragments.flatMap(f => f.points);
  const xs = allPoints.map(p => p.x);
  const ys = allPoints.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const remnantWidthPx = (maxX - minX) * scale;
  const remnantHeightPx = (maxY - minY) * scale;

  return (
    <div style={{
      ...style,
      width: `${remnantWidthPx}px`,
      height: `${remnantHeightPx}px`,
    }}>
      <svg width={remnantWidthPx} height={remnantHeightPx} viewBox={`0 0 ${remnantWidthPx} ${remnantHeightPx}`} style={{ overflow: 'visible' }}>
        <path
          fill="rgba(0, 120, 255, 0.3)"
          stroke="rgba(0, 120, 255, 0.8)"
          strokeWidth="2"
          strokeDasharray="4 4"
          fillRule="evenodd"
          d={fragments.map(f =>
            "M " + f.points.map(p => `${(p.x - minX) * scale} ${(p.y - minY) * scale}`).join(' L ') + " Z"
          ).join(' ')}
        />
      </svg>
    </div>
  );
}

function Canvas({
  surface,
  pieces,
  obstacles,
  project,
  onPlacePiece,
  onDeletePiece,
  onBatchDeletePieces,
  clientState,
  onClientStateChange,
  rotationAnchor,
  onRotationAnchorChange,
  onToolSelect,
  onPivotChange,
  isDrawingObstacle,
  editingObstacleId,
  onFinishDrawingObstacle,
  isPivotSelectorOpen,
  onPivotSelectorOpenChange,
  isMeasureToolOpen,
  onMeasureToolOpenChange,
  onUpdateStartPoint,
  previewSegment,
  onPreviewChange,
  onUndo,
  onRedo,
  viewportRef,
  currentObstaclePoints,
  onCurrentObstaclePointsChange,
  obstacleAnchorIndex = 0,
  onObstacleAnchorIndexChange,
}: CanvasProps) {
  const { isEraserMode, isMeasureMode, measureMode, activeBrush, isObstacleSnapActive, pivotPoint, brushAngle, isRotating } = clientState;
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [ghostPiecePos, setGhostPiecePos] = useState<Point | null>(null);
  const [hoveredPiece, setHoveredPiece] = useState<PlacedPiece | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ pos: { x: number; y: number }; display: Point; } | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const lastDeletedPieceId = useRef<string | null>(null);

  const [cuttingMaterial, setCuttingMaterial] = useState<Material | null>(null);

  const handleGenerateCuts = useCallback(async (newRemnants: Remnant[]) => {
    if (!project || !firestore) return;
    try {
      const projectRef = doc(firestore, "projects", project.id);
      await updateDoc(projectRef, {
        remnants: arrayUnion(...newRemnants)
      });
      toast({ title: "Cortes generados", description: `${newRemnants.length} cortes añadidos correctamente.` });
      setCuttingMaterial(null);
    } catch (e) {
      console.error("Error generating cuts:", e);
      toast({ title: "Error", description: "No se pudieron generar los cortes.", variant: "destructive" });
    }
  }, [project, firestore, toast]);

  // Series Placement State
  const isMouseDownRef = useRef(false);
  const isSeriesPlacing = useRef(false);
  const dragStartPos = useRef<Point | null>(null);
  const [seriesGhostPieces, setSeriesGhostPieces] = useState<Point[]>([]);

  // Area Measurement State
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const measurementRef = useRef<DrawingMeasurement | null>(null);
  const previewAreaBoxRef = useRef<HTMLDivElement>(null);
  const previewAreaTextRef = useRef<HTMLSpanElement>(null);

  // Vertex Measurement State
  const [vertexMeasurements, setVertexMeasurements] = useState<VertexMeasurement[]>([]);
  const [currentVertexMeasurePoints, setCurrentVertexMeasurePoints] = useState<Point[]>([]);
  const [previewVertexMeasurePoint, setPreviewVertexMeasurePoint] = useState<Point | null>(null);

  // Obstacle Drawing State
  const [previewObstaclePoint, setPreviewObstaclePoint] = useState<Point | null>(null);

  const [isCloseSnap, setIsCloseSnap] = useState(false);

  const [isErasing, setIsErasing] = useState(false);
  const [erasedPieceIds, setErasedPieceIds] = useState<Set<string>>(new Set());
  const pendingErasures = useRef<Set<string>>(new Set());
  const isDrawingMeasureArea = useRef(false);
  const [isLastVertexMeasurementClosed, setIsLastVertexMeasurementClosed] = useState(false);

  // Sync local hide state with actual pieces from Firestore
  useEffect(() => {
    if (erasedPieceIds.size > 0) {
      const currentIds = new Set(pieces.map(p => p.id));
      const stillInList = new Set([...erasedPieceIds].filter(id => currentIds.has(id)));
      if (stillInList.size !== erasedPieceIds.size) {
        setErasedPieceIds(stillInList);
      }
    }
  }, [pieces, erasedPieceIds]);

  // Clean up when tool changes
  useEffect(() => {
    if (!isEraserMode) {
      setErasedPieceIds(new Set());
      pendingErasures.current.clear();
    }
  }, [isEraserMode]);



  const { width: containerWidth, height: containerHeight } =
    useElementSize(containerRef);

  const scale = useMemo(() => {
    if (
      containerWidth > 0 &&
      containerHeight > 0 &&
      surface.width > 0 &&
      surface.height > 0
    ) {
      // Add padding: 80px (40px per side) ensures ruler labels (outside) are visible
      const safeContainerWidth = containerWidth - 80;
      const safeContainerHeight = containerHeight - 80;

      const calculatedScale = Math.min(
        safeContainerWidth / surface.width,
        safeContainerHeight / surface.height
      );
      return Math.max(calculatedScale * clientState.viewZoom, 0.1); // Prevent scale from being 0
    }
    return 1; // Default scale
  }, [containerWidth, containerHeight, surface, clientState.viewZoom]);

  const allSnapPoints = useMemo(() => {
    const points: Point[] = [];
    // Surface corners
    points.push({ x: 0, y: 0 });
    points.push({ x: surface.width, y: 0 });
    points.push({ x: 0, y: surface.height });
    points.push({ x: surface.width, y: surface.height });

    // Placed pieces vertices
    pieces.forEach(p => {
      p.fragments.forEach(f => {
        points.push(...f.points);
      });
    });
    return points;
  }, [surface.width, surface.height, pieces]);

  const obstacleSnapPoints = useMemo(() => {
    const points: Point[] = [];
    obstacles.forEach(o => {
      points.push(...o.points);
    });
    return points;
  }, [obstacles]);

  const allStaticSnapPoints = useMemo(() => {
    return [...allSnapPoints, ...obstacleSnapPoints];
  }, [allSnapPoints, obstacleSnapPoints]);

  const getSnapPoints = useCallback(() => {
    return isObstacleSnapActive ? allStaticSnapPoints : allSnapPoints;
  }, [allSnapPoints, allStaticSnapPoints, isObstacleSnapActive]);

  const calculateSnapToVertex = useCallback((cursorPos: Point, isMeasuring: boolean, currentMeasurePoints: Point[]) => {
    const snapThreshold_cm = SNAP_THRESHOLD_PX / scale;
    let bestSnap: Point | null = null;
    let minDistance = snapThreshold_cm;
    let isSnappingToClose = false;

    // High priority snap to the first point of the current measurement
    if (isMeasuring && currentMeasurePoints.length > 2) {
      const firstPoint = currentMeasurePoints[0];
      const distance = Math.sqrt(Math.pow(cursorPos.x - firstPoint.x, 2) + Math.pow(cursorPos.y - firstPoint.y, 2));
      if (distance < minDistance) {
        minDistance = distance;
        bestSnap = firstPoint;
        isSnappingToClose = true;
      }
    }

    // If not snapping to close, check other points
    if (!isSnappingToClose) {
      const snapPoints = getSnapPoints();
      for (const point of snapPoints) {
        const distance = Math.sqrt(Math.pow(cursorPos.x - point.x, 2) + Math.pow(cursorPos.y - point.y, 2));
        if (distance < minDistance) {
          minDistance = distance;
          bestSnap = point;
        }
      }
    }

    setIsCloseSnap(isSnappingToClose);
    return bestSnap ?? cursorPos;
  }, [scale, getSnapPoints]);


  const calculateSnapPosition = useCallback((x_cm: number, y_cm: number, itemWidth_cm = 0, itemHeight_cm = 0) => {
    const snapThreshold_cm = SNAP_THRESHOLD_PX / scale;
    let bestSnap = { x: x_cm, y: y_cm, deltaX: snapThreshold_cm, deltaY: snapThreshold_cm };

    const snapPoints = isObstacleSnapActive ? allStaticSnapPoints : allSnapPoints;

    for (const point of snapPoints) {
      // Check X snap
      let dx1 = Math.abs(x_cm - point.x);
      if (dx1 < bestSnap.deltaX) {
        bestSnap.deltaX = dx1;
        bestSnap.x = point.x;
      }
      let dx2 = Math.abs((x_cm + itemWidth_cm) - point.x);
      if (dx2 < bestSnap.deltaX) {
        bestSnap.deltaX = dx2;
        bestSnap.x = point.x - itemWidth_cm;
      }

      // Check Y snap
      let dy1 = Math.abs(y_cm - point.y);
      if (dy1 < bestSnap.deltaY) {
        bestSnap.deltaY = dy1;
        bestSnap.y = point.y;
      }
      let dy2 = Math.abs((y_cm + itemHeight_cm) - point.y);
      if (dy2 < bestSnap.deltaY) {
        bestSnap.deltaY = dy2;
        bestSnap.y = point.y - itemHeight_cm;
      }
    }

    return { x: bestSnap.x, y: bestSnap.y };
  }, [scale, isObstacleSnapActive, allSnapPoints, allStaticSnapPoints]);

  const getCursor = () => {
    if (isRotating) return 'crosshair';
    if (isDrawingObstacle) return 'crosshair';
    if (isMeasureMode && measureMode === 'vertex') return 'crosshair';
    if (isMeasureMode) return 'crosshair';
    if (isEraserMode) return `url("${eraserCursorSvg}") 8 20, crosshair`;
    if (clientState.isHandMode || isPanningRef.current) return isPanningRef.current ? 'grabbing' : 'grab';
    if (activeBrush) return `url("${crossCursorSvg}") 8 8, crosshair`;
    return 'default';
  }

  const getMousePosWithExtendedBounds = (e: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const { clientX, clientY } = e;

    const { left, right, top, bottom } = rect;

    let mouseX_px = clientX - left;
    let mouseY_px = clientY - top;

    if (clientX < left) mouseX_px = 0;
    if (clientX > right) mouseX_px = rect.width;
    if (clientY < top) mouseY_px = 0;
    if (clientY > bottom) mouseY_px = rect.height;

    return { x: mouseX_px / scale, y: mouseY_px / scale };
  }

  const getMousePosClamped = (e: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const mouseX_px = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const mouseY_px = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    return { x: mouseX_px / scale, y: mouseY_px / scale };
  };


  const getPieceUnderCursor = (cursorPos: { x: number, y: number }): PlacedPiece | null => {
    // Check in reverse order so we get the top-most piece
    for (let i = pieces.length - 1; i >= 0; i--) {
      const piece = pieces[i];
      if (erasedPieceIds.has(piece.id)) continue; // Ignore pieces already locally erased
      for (const frag of piece.fragments) {
        const clipperPoints = frag.points.map(p => ({ X: p.x, Y: p.y }));
        const clipperCursorPos = { X: cursorPos.x, Y: cursorPos.y };
        if (ClipperLib.Clipper.PointInPolygon(clipperCursorPos, clipperPoints) !== 0) {
          return piece;
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only process left click release

      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;

        // --- Area Measurement Completion ---
        if (isDrawingMeasureArea.current) {
          isDrawingMeasureArea.current = false;
          const finalMeasurement = measurementRef.current;
          if (finalMeasurement && (finalMeasurement.width > 1 || finalMeasurement.height > 1)) {
            setMeasurements(currentM => [...currentM, { ...finalMeasurement, id: `measure-${crypto.randomUUID()}` }]);
          }
          measurementRef.current = null;
          if (previewAreaBoxRef.current) {
            previewAreaBoxRef.current.style.display = 'none';
          }
        }

        // Check isSeriesPlacing first
        if (isSeriesPlacing.current) {
          if (seriesGhostPieces.length > 0) {
            onPlacePiece(seriesGhostPieces);
          }
        } else {
          // Single placement
          if (dragStartPos.current) {
            const pos = dragStartPos.current;
            dragStartPos.current = null;
            console.log('Placing single piece at:', pos);
            onPlacePiece([pos]);
          }
        }

        isSeriesPlacing.current = false;
        setSeriesGhostPieces([]);
      }
      if (isErasing) {
        setIsErasing(false);
        if (pendingErasures.current.size > 0) {
          onBatchDeletePieces(Array.from(pendingErasures.current));
        }
        pendingErasures.current.clear();
        // We don't clear erasedPieceIds here to avoid flickering before Firestore sync.
        // It will be cleared when isEraserMode changes or next drag starts.
        lastDeletedPieceId.current = null;
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isErasing, seriesGhostPieces, onPlacePiece, onBatchDeletePieces, setMeasurements, onClientStateChange]);

  const handleAddObstacleSegment = useCallback((newPoint: Point) => {
    onCurrentObstaclePointsChange((prev: Point[]) => [...prev, newPoint]);
    if (onObstacleAnchorIndexChange) {
      onObstacleAnchorIndexChange(currentObstaclePoints.length);
    }
  }, [onCurrentObstaclePointsChange, onObstacleAnchorIndexChange, currentObstaclePoints.length]);

  const handleUndoObstacleSegment = useCallback(() => {
    onCurrentObstaclePointsChange((prev: Point[]) => prev.slice(0, -1));
    if (onObstacleAnchorIndexChange) {
      onObstacleAnchorIndexChange(Math.max(0, currentObstaclePoints.length - 2));
    }
  }, [onCurrentObstaclePointsChange, onObstacleAnchorIndexChange, currentObstaclePoints.length]);

  const handleUpdateObstacleStartPoint = useCallback((newPoint: Point) => {
    onCurrentObstaclePointsChange(prev => {
      if (prev.length === 0) {
        return [newPoint];
      }
      const deltaX = newPoint.x - prev[obstacleAnchorIndex].x;
      const deltaY = newPoint.y - prev[obstacleAnchorIndex].y;

      if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) return prev;

      return prev.map((p: Point) => ({
        x: p.x + deltaX,
        y: p.y + deltaY
      }));
    });
  }, [onCurrentObstaclePointsChange, obstacleAnchorIndex]);


  const handleUpdateObstacleLastPoint = useCallback((newPoint: Point) => {
    onCurrentObstaclePointsChange((prev: Point[]) => {
      if (prev.length === 0) return [newPoint];
      if (Math.abs(prev[obstacleAnchorIndex].x - newPoint.x) < 1e-6 && Math.abs(prev[obstacleAnchorIndex].y - newPoint.y) < 1e-6) return prev;
      const next = [...prev];
      next[obstacleAnchorIndex] = newPoint;
      return next;
    });
  }, [onCurrentObstaclePointsChange, obstacleAnchorIndex]);


  const handleFinishObstacleDrawing = useCallback(async (closeLoop: boolean, name?: string) => {
    if (!firestore) return;

    // Simplify path: filter out redundant (duplicate) and collinear points
    let finalPoints = simplifyPath(currentObstaclePoints);

    const pointCount = finalPoints.length;

    if (closeLoop && pointCount > 2) {
      const first = finalPoints[0];
      const last = finalPoints[pointCount - 1];
      // If the last point is already the same as the first, we don't need to add it again
      // Actually, for consistency and simplicity in calculations, we might want the closing point
      // but the user wants "accurate vertex count". 
      // If first == last, it's a closed polygon but with N+1 points.
      // We'll ensure it's closed if requested, but we'll count carefully later.
      if (Math.abs(first.x - last.x) > EPSILON || Math.abs(first.y - last.y) > EPSILON) {
        finalPoints.push(first);
      }
    }

    if (finalPoints.length < (closeLoop ? 3 : 2)) {
      toast({ title: "Obstáculo inválido", description: "Un obstáculo necesita al menos 2 puntos (para una línea) o 3 (para un polígono).", variant: "destructive" });
      return;
    }

    // 1. Thorough Boundary Check (cm)
    const margin = 0.01;
    const isOutOfBounds = finalPoints.some(p =>
      p.x < -margin || p.x > surface.width + margin ||
      p.y < -margin || p.y > surface.height + margin
    );

    if (isOutOfBounds) {
      toast({
        title: "Fuera de límites",
        description: "El obstáculo completo debe estar dentro de la superficie.",
        variant: "destructive"
      });
      return;
    }

    // 2. Overlap Detection with ClipperLib
    try {
      const scaleFactor = 1000;
      const newPath = finalPoints.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));

      const clipper = new ClipperLib.Clipper();
      clipper.AddPath(newPath, ClipperLib.PolyType.ptSubject, true);

      // Check against existing obstacles
      for (const obs of obstacles) {
        if (obs.id === editingObstacleId) continue; // Skip the one we are currently editing

        const existingPath = obs.points.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));
        clipper.AddPath(existingPath, ClipperLib.PolyType.ptClip, true);

        const solution = new ClipperLib.Paths();
        clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

        if (solution.length > 0) {
          toast({
            title: "Solapamiento detectado",
            description: "El obstáculo se solapa con otro existente.",
            variant: "destructive"
          });
          return;
        }
        // Reset clipper for next check if needed, though simplectIntersection with multiple clip paths also works
        // But for clarity/certainty we check individually or just add all clip paths once.
        // Actually Adding all clip paths once is better:
      }

      // Save or Update
      if (editingObstacleId) {
        await updateDoc(doc(firestore, "projects", project.id, "obstacles", editingObstacleId), {
          points: finalPoints,
          name: name || '',
        });
        toast({ title: "Éxito", description: "Obstáculo actualizado." });
      } else {
        const obstacleColRef = collection(firestore, "projects", project.id, "obstacles");
        await addDoc(obstacleColRef, {
          surfaceId: surface.id,
          points: finalPoints,
          name: name || '',
        });
        toast({ title: "Éxito", description: "Obstáculo guardado." });
      }
    } catch (error) {
      console.error("Error saving obstacle:", error);
      toast({ title: "Error", description: "No se pudo guardar el obstáculo.", variant: "destructive" });
    }

    onCurrentObstaclePointsChange([]);
    setPreviewObstaclePoint(null);
    onFinishDrawingObstacle();
    if (onObstacleAnchorIndexChange) {
      onObstacleAnchorIndexChange(0);
    }
  }, [currentObstaclePoints, onFinishDrawingObstacle, project.id, surface.id, firestore, toast, obstacles, editingObstacleId, onCurrentObstaclePointsChange, onObstacleAnchorIndexChange]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Hand tool toggle (Ctrl + H)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        onClientStateChange((prev) => ({
          ...prev,
          isHandMode: !prev.isHandMode,
          isEraserMode: false,
          isMeasureMode: false,
          activeBrush: null,
        }));
        toast({
          title: clientState.isHandMode ? "Herramienta de selección" : "Herramienta de mano",
          description: clientState.isHandMode ? "Modo de edición activado." : "Usa el ratón para moverte por la superficie.",
        });
      }
      if (event.key === 'Escape') {
        if (isDrawingObstacle) {
          handleFinishObstacleDrawing(false);
        } else if (isMeasureMode && (measureMode === 'vertex' || measureMode === 'distance')) {
          if (currentVertexMeasurePoints.length > 0) {
            // Cancel current vertex measurement
            setCurrentVertexMeasurePoints([]);
            setPreviewVertexMeasurePoint(null);
          } else {
            // If no points, release the tool
            onToolSelect('brush');
          }
        }
      }

    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawingObstacle, handleFinishObstacleDrawing, isMeasureMode, measureMode, clientState.history, clientState.historyIndex, onUndo, onRedo, onClientStateChange]);


  // --- Zoom and Pan Logic ---
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        const direction = delta > 0 ? -1 : 1;
        const step = 0.1;

        onClientStateChange(prev => {
          let newZoom = prev.viewZoom + (step * direction);
          newZoom = Math.max(0.1, Math.min(3.0, newZoom));
          newZoom = parseFloat(newZoom.toFixed(1));
          return { ...prev, viewZoom: newZoom };
        });
      } else if (e.altKey && activeBrush) {
        e.preventDefault();
        const delta = e.deltaY;
        const direction = delta > 0 ? 1 : -1;
        const rotationStep = 15;

        onClientStateChange(prev => ({
          ...prev,
          brushAngle: (prev.brushAngle + (rotationStep * direction) + 360) % 360
        }));
      } else if (isDrawingObstacle && !e.ctrlKey && !e.metaKey) {
        // Scroll to rotate current obstacle segment
        e.preventDefault();
        const delta = e.deltaY;
        const direction = delta > 0 ? -1 : 1;

        // Alt for 15 degrees, else small step (5)
        const rotationStep = e.altKey ? 15 : 5;

        const currentAngle = previewSegment?.angle ?? 0;
        const newAngle = (currentAngle + (rotationStep * direction) + 360) % 360;

        onPreviewChange({
          length: previewSegment?.length ?? 50, // Default to 50cm if not yet defined
          angle: newAngle
        });
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [onClientStateChange, viewportRef, activeBrush, isDrawingObstacle, previewSegment, onPreviewChange]);

  // Pan Handlers
  const isPanningRef = useRef(false);
  const lastPanPos = useRef<{ x: number, y: number } | null>(null);
  // Removed duplicate canvasViewportRef - it is defined at the top of the component




  const handlePanMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanningRef.current || !lastPanPos.current) return;

    const dx = e.clientX - lastPanPos.current.x;
    const dy = e.clientY - lastPanPos.current.y;

    onClientStateChange(prev => ({
      ...prev,
      viewPan: { x: prev.viewPan.x + dx, y: prev.viewPan.y + dy }
    }));

    lastPanPos.current = { x: e.clientX, y: e.clientY };
  }, [onClientStateChange, isPanningRef]);

  const handlePanMouseUp = useCallback(() => {
    isPanningRef.current = false;
    lastPanPos.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handlePanMouseMove);
    window.addEventListener('mouseup', handlePanMouseUp);
    return () => {
      window.removeEventListener('mousemove', handlePanMouseMove);
      window.removeEventListener('mouseup', handlePanMouseUp);
    };
  }, [handlePanMouseMove, handlePanMouseUp]);


  const clearMeasurements = () => {
    setMeasurements([]);
    measurementRef.current = null;
    if (previewAreaBoxRef.current) {
      previewAreaBoxRef.current.style.display = 'none';
    }
    setIsLastVertexMeasurementClosed(false);
  }

  const clearVertexMeasurements = () => {
    setVertexMeasurements([]);
    setCurrentVertexMeasurePoints([]);
    setPreviewVertexMeasurePoint(null);
    setIsLastVertexMeasurementClosed(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Panning logic (Hand tool, Middle click)
    if (clientState.isHandMode || e.button === 1) {
      isPanningRef.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      // If it's for panning, we don't process other tool clicks
      return;
    }

    if (e.button !== 0) return; // Only main click for other tools

    const clickPos = getMousePosClamped(e);

    // Check if we are already processing a click (simple debounce)
    if (isMouseDownRef.current) return;

    isMouseDownRef.current = true;

    if (isDrawingObstacle) {
      if (editingObstacleId) return; // Prevent adding points when editing

      // If we already have points, only allow closing the loop by clicking the start point.
      // Otherwise, ignore clicks (force user to use panel)
      const snappedPoint = calculateSnapToVertex(clickPos, true, currentObstaclePoints);

      if (currentObstaclePoints.length === 0) {
        onCurrentObstaclePointsChange((prev: Point[]) => [...prev, snappedPoint]);
        if (onObstacleAnchorIndexChange) {
          onObstacleAnchorIndexChange(0);
        }
      } else if (isCloseSnap) {
        // Allow closing the loop by clicking the start point
        handleFinishObstacleDrawing(true);
      }
      return;
    }

    if (activeBrush) {
      if (isRotating) {
        onRotationAnchorChange(null);
        onClientStateChange(cs => ({ ...cs, isRotating: false }));
        return;
      }

      dragStartPos.current = ghostPiecePos;
      return;
    }

    if (isEraserMode) {
      setIsErasing(true);
      pendingErasures.current.clear();
      setErasedPieceIds(new Set());
      const pieceToDelete = getPieceUnderCursor(clickPos);
      if (pieceToDelete) {
        pendingErasures.current.add(pieceToDelete.id);
        setErasedPieceIds(new Set([pieceToDelete.id]));
        lastDeletedPieceId.current = pieceToDelete.id;
      }
      return;
    }

    if (isMeasureMode) {
      if (measureMode === 'area') {
        if (isDrawingMeasureArea.current) return;

        isDrawingMeasureArea.current = true;
        setIsLastVertexMeasurementClosed(false); // Reset closed state

        const startPos = isObstacleSnapActive
          ? calculateSnapToVertex(clickPos, true, [])
          : calculateSnapPosition(clickPos.x, clickPos.y);

        const newMeasurement: DrawingMeasurement = {
          id: `measure-temp-${crypto.randomUUID()}`,
          startX: startPos.x,
          startY: startPos.y,
          x: startPos.x,
          y: startPos.y,
          width: 0,
          height: 0,
        };
        measurementRef.current = newMeasurement;

        if (previewAreaBoxRef.current && previewAreaTextRef.current) {
          previewAreaBoxRef.current.style.display = 'flex';
          previewAreaBoxRef.current.style.left = `${newMeasurement.x * scale}px`;
          previewAreaBoxRef.current.style.top = `${newMeasurement.y * scale}px`;
          previewAreaBoxRef.current.style.width = `0px`;
          previewAreaBoxRef.current.style.height = `0px`;
          previewAreaTextRef.current.textContent = `0.00m x 0.00m`;
        }

        // WE DO NOT attach global mousemove here anymore. 
        // Logic moved to handleMouseMoveOnCanvas for maximum performance and synchronization.
      } else if (measureMode === 'vertex' || measureMode === 'distance') {
        let snappedPoint = calculateSnapToVertex(clickPos, true, currentVertexMeasurePoints);
        const lastPoint = currentVertexMeasurePoints.length > 0 ? currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1] : null;

        if (e.shiftKey && lastPoint) {
          const deltaX = Math.abs(clickPos.x - lastPoint.x);
          const deltaY = Math.abs(clickPos.y - lastPoint.y);
          snappedPoint = deltaX > deltaY ? { x: clickPos.x, y: lastPoint.y } : { x: lastPoint.x, y: clickPos.y };
        }

        if (currentVertexMeasurePoints.length === 0) {
          setIsLastVertexMeasurementClosed(false);
        }

        if (isCloseSnap && currentVertexMeasurePoints.length > 2) {
          const newPoints = [...currentVertexMeasurePoints, snappedPoint];
          // Finish and save as vertex measurements
          const newSegments: VertexMeasurement[] = [];
          for (let i = 0; i < newPoints.length - 1; i++) {
            newSegments.push({
              p1: newPoints[i],
              p2: newPoints[i + 1],
              length: Math.sqrt(Math.pow(newPoints[i + 1].x - newPoints[i].x, 2) + Math.pow(newPoints[i + 1].y - newPoints[i].y, 2))
            });
          }
          setVertexMeasurements(newSegments);
          setIsLastVertexMeasurementClosed(true);

          setCurrentVertexMeasurePoints([]);
          setPreviewVertexMeasurePoint(null);
        } else {
          setCurrentVertexMeasurePoints(prev => [...prev, snappedPoint]);
        }

        // CRITICAL FIX: allow next click for vertex mode immediately
        isMouseDownRef.current = false;
      }
    }
  };

  const handleCancelObstacleDrawing = useCallback(() => {
    onCurrentObstaclePointsChange([]);
    setPreviewObstaclePoint(null);
    onFinishDrawingObstacle();
    if (onObstacleAnchorIndexChange) {
      onObstacleAnchorIndexChange(0);
    }
    toast({ title: "Cancelado", description: "Creación de obstáculo cancelada." });
  }, [toast, onFinishDrawingObstacle, onCurrentObstaclePointsChange, onObstacleAnchorIndexChange]);

  const handleMouseMoveOnCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    const rawCursorPos = getMousePosClamped(e);

    if (isDrawingMeasureArea.current && measurementRef.current) {
      const startX = measurementRef.current.startX ?? 0;
      const startY = measurementRef.current.startY ?? 0;

      const snappedEndPos = isObstacleSnapActive
        ? calculateSnapToVertex(rawCursorPos, true, [])
        : calculateSnapPosition(rawCursorPos.x, rawCursorPos.y);

      const newX = Math.min(snappedEndPos.x, startX);
      const newY = Math.min(snappedEndPos.y, startY);
      const newWidth = Math.abs(snappedEndPos.x - startX);
      const newHeight = Math.abs(snappedEndPos.y - startY);

      measurementRef.current = {
        ...measurementRef.current,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };

      if (previewAreaBoxRef.current && previewAreaTextRef.current) {
        previewAreaBoxRef.current.style.left = `${newX * scale}px`;
        previewAreaBoxRef.current.style.top = `${newY * scale}px`;
        previewAreaBoxRef.current.style.width = `${newWidth * scale}px`;
        previewAreaBoxRef.current.style.height = `${newHeight * scale}px`;

        const w_m = (newWidth / 100).toFixed(2);
        const h_m = (newHeight / 100).toFixed(2);
        previewAreaTextRef.current.textContent = `${w_m}m x ${h_m}m`;
      }

      // Bypass setCursorCoords to prevent React re-renders and lag
      return;
    }

    if (isDrawingObstacle) {
      const snappedPoint = calculateSnapToVertex(rawCursorPos, true, currentObstaclePoints);
      setPreviewObstaclePoint(snappedPoint);
      const displayPoint = { x: snappedPoint.x, y: surface.height - snappedPoint.y };

      if (previewSegment) {
        if (currentObstaclePoints.length === 0) {
          setCursorCoords((prev) => {
            if (prev?.pos.x === e.clientX && prev?.pos.y === e.clientY) return prev;
            return { pos: { x: e.clientX, y: e.clientY }, display: displayPoint };
          });
        } else {
          setCursorCoords(null);
        }
      } else {
        setCursorCoords((prev) => {
          if (prev?.pos.x === e.clientX && prev?.pos.y === e.clientY) return prev;
          return { pos: { x: e.clientX, y: e.clientY }, display: displayPoint };
        });
      }
      return;
    }

    if (isMeasureMode) {
      if (measureMode === 'vertex' || measureMode === 'distance') {
        let snappedPoint = calculateSnapToVertex(rawCursorPos, true, currentVertexMeasurePoints);
        const lastPoint = currentVertexMeasurePoints.length > 0 ? currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1] : null;

        if (e.shiftKey && lastPoint) {
          const deltaX = Math.abs(rawCursorPos.x - lastPoint.x);
          const deltaY = Math.abs(rawCursorPos.y - lastPoint.y);
          snappedPoint = deltaX > deltaY ? { x: rawCursorPos.x, y: lastPoint.y } : { x: lastPoint.x, y: rawCursorPos.y };
        }

        const displayPoint = { x: snappedPoint.x, y: surface.height - snappedPoint.y };
        setPreviewVertexMeasurePoint(snappedPoint);
        setCursorCoords((prev) => {
          if (prev?.pos.x === e.clientX && prev?.pos.y === e.clientY) return prev;
          return { pos: { x: e.clientX, y: e.clientY }, display: displayPoint };
        });
        return;
      } else if (measureMode === 'area') {
        let snappedPoint = rawCursorPos;
        if (isObstacleSnapActive) {
          snappedPoint = calculateSnapToVertex(rawCursorPos, true, []);
        } else {
          snappedPoint = calculateSnapPosition(rawCursorPos.x, rawCursorPos.y);
        }

        const displayPoint = { x: snappedPoint.x, y: surface.height - snappedPoint.y };
        setPreviewVertexMeasurePoint(snappedPoint);
        setCursorCoords((prev) => {
          if (prev?.pos.x === e.clientX && prev?.pos.y === e.clientY) return prev;
          return { pos: { x: e.clientX, y: e.clientY }, display: displayPoint };
        });
        return;
      }
    }

    if (isRotating) {
      if (rotationAnchor) {
        const dx = rawCursorPos.x - rotationAnchor.x;
        const dy = rawCursorPos.y - rotationAnchor.y;
        let rawAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        let finalAngle = rawAngle;
        for (let i = 0; i < 360; i += 45) {
          const diff = Math.abs(rawAngle - i);
          const wrappedDiff = Math.min(diff, Math.abs(rawAngle - (i + 360)), Math.abs(rawAngle - (i - 360)));
          if (wrappedDiff <= 6) {
            finalAngle = i;
            break;
          }
        }
        onClientStateChange(cs => ({ ...cs, brushAngle: finalAngle }));
        setCursorCoords((prev) => {
          if (prev?.pos.x === e.clientX && prev?.pos.y === e.clientY) return prev;
          return { pos: { x: e.clientX, y: e.clientY }, display: { x: finalAngle, y: 0 } };
        });
      }
      return;
    }

    if (isEraserMode) {
      const pieceUnderCursor = getPieceUnderCursor(rawCursorPos);
      setHoveredPiece(pieceUnderCursor);
      if (isErasing && pieceUnderCursor && !pendingErasures.current.has(pieceUnderCursor.id)) {
        pendingErasures.current.add(pieceUnderCursor.id);
        setErasedPieceIds(prev => new Set([...prev, pieceUnderCursor.id]));
        lastDeletedPieceId.current = pieceUnderCursor.id;
      }
    } else if (hoveredPiece) {
      setHoveredPiece(null);
    }

    if (activeBrush && !isRotating) {
      const w = activeBrush.width;
      const h = activeBrush.height;
      const angleRad = brushAngle * (Math.PI / 180);
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      let pivotLocal: Point = { x: 0, y: 0 };
      switch (pivotPoint) {
        case 'topLeft': pivotLocal = { x: -w / 2, y: -h / 2 }; break;
        case 'topRight': pivotLocal = { x: w / 2, y: -h / 2 }; break;
        case 'bottomLeft': pivotLocal = { x: -w / 2, y: h / 2 }; break;
        case 'bottomRight': pivotLocal = { x: w / 2, y: h / 2 }; break;
      }

      const rotatedPivotX = pivotLocal.x * cos - pivotLocal.y * sin;
      const rotatedPivotY = pivotLocal.x * sin + pivotLocal.y * cos;

      const currentCenterX = rawCursorPos.x - rotatedPivotX;
      const currentCenterY = rawCursorPos.y - rotatedPivotY;

      if (isMouseDownRef.current && dragStartPos.current) {
        const dx_cm = currentCenterX - dragStartPos.current.x;
        const dy_cm = currentCenterY - dragStartPos.current.y;
        const dist_px = Math.sqrt(dx_cm * dx_cm + dy_cm * dy_cm) * scale;

        if (!isSeriesPlacing.current && dist_px > DRAG_THRESHOLD_PX) {
          isSeriesPlacing.current = true;
        }

        if (isSeriesPlacing.current) {
          setGhostPiecePos(null);
          const dragVector = { x: dx_cm, y: dy_cm };
          const pieceAxisX = { x: cos, y: sin };
          const pieceAxisY = { x: -sin, y: cos };
          const projectionOnX = dragVector.x * pieceAxisX.x + dragVector.y * pieceAxisX.y;
          const projectionOnY = dragVector.x * pieceAxisY.x + dragVector.y * pieceAxisY.y;
          const isDragAlongPieceX = Math.abs(projectionOnX) > Math.abs(projectionOnY);

          let stepVector: Point, dragDist: number, direction: number;
          if (isDragAlongPieceX) {
            stepVector = { x: w * cos, y: w * sin };
            dragDist = Math.abs(projectionOnX);
            direction = Math.sign(projectionOnX);
          } else {
            stepVector = { x: h * -sin, y: h * cos };
            dragDist = Math.abs(projectionOnY);
            direction = Math.sign(projectionOnY);
          }

          const stepSize = Math.sqrt(stepVector.x ** 2 + stepVector.y ** 2);
          let numPieces = stepSize > EPSILON ? Math.floor(dragDist / stepSize) : 0;
          if (activeBrush.type === 'remnant') {
            numPieces = Math.min(numPieces, activeBrush.count - 1);
          }

          const newGhosts: Point[] = [dragStartPos.current];
          for (let i = 1; i <= numPieces; i++) {
            newGhosts.push({
              x: dragStartPos.current.x + i * stepVector.x * direction,
              y: dragStartPos.current.y + i * stepVector.y * direction,
            });
          }
          setSeriesGhostPieces(newGhosts);
        }
      } else {
        const snapThreshold_cm = SNAP_THRESHOLD_PX / scale;
        let finalCenterPos = { x: currentCenterX, y: currentCenterY };
        const isRectilinear = brushAngle % 90 === 0;

        if (isRectilinear) {
          const snapPoints = getSnapPoints();
          const snapXCoords = new Set(snapPoints.map(p => p.x));
          const snapYCoords = new Set(snapPoints.map(p => p.y));
          const effectiveWidth = (brushAngle / 90) % 2 === 0 ? w : h;
          const effectiveHeight = (brushAngle / 90) % 2 === 0 ? h : w;
          const ghostXEdges = [finalCenterPos.x - effectiveWidth / 2, finalCenterPos.x + effectiveWidth / 2];
          const ghostYEdges = [finalCenterPos.y - effectiveHeight / 2, finalCenterPos.y + effectiveHeight / 2];

          let bestDeltaX = 0, minXDist = snapThreshold_cm;
          for (const edgeX of ghostXEdges) {
            for (const snapX of snapXCoords) {
              const dist = Math.abs(edgeX - snapX);
              if (dist < minXDist) { minXDist = dist; bestDeltaX = snapX - edgeX; }
            }
          }
          let bestDeltaY = 0, minYDist = snapThreshold_cm;
          for (const edgeY of ghostYEdges) {
            for (const snapY of snapYCoords) {
              const dist = Math.abs(edgeY - snapY);
              if (dist < minYDist) { minYDist = dist; bestDeltaY = snapY - edgeY; }
            }
          }
          finalCenterPos.x += bestDeltaX;
          finalCenterPos.y += bestDeltaY;
        } else {
          const snapPoints = getSnapPoints();
          let bestSnap = { deltaX: 0, deltaY: 0, distance: snapThreshold_cm };
          const corners = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
          const rotatedCorners = corners.map(corner => ({
            x: finalCenterPos.x + (corner.x * cos - corner.y * sin),
            y: finalCenterPos.y + (corner.x * sin + corner.y * cos),
          }));
          for (const corner of rotatedCorners) {
            for (const snapPoint of snapPoints) {
              const deltaX = snapPoint.x - corner.x;
              const deltaY = snapPoint.y - corner.y;
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
              if (distance < bestSnap.distance) { bestSnap = { deltaX, deltaY, distance }; }
            }
          }
          finalCenterPos.x += bestSnap.deltaX;
          finalCenterPos.y += bestSnap.deltaY;
        }
        setGhostPiecePos(finalCenterPos);
      }
    } else {
      if (ghostPiecePos) setGhostPiecePos(null);
    }
  };

  const handleMouseLeaveCanvas = () => {
    const isDrawingSomething = isDrawingMeasureArea.current || (isDrawingObstacle && currentObstaclePoints.length > 0) || (isMeasureMode && ((measureMode === 'vertex' && currentVertexMeasurePoints.length > 0) || (measureMode === 'area' && measurementRef.current)));

    setHoveredPiece(null);
    setCursorCoords(null);

    if (!isDrawingSomething) {
      setGhostPiecePos(null);
      if (!isDrawingObstacle) {
        setPreviewObstaclePoint(null);
      }
      setPreviewVertexMeasurePoint(null);
    }
  }

  useEffect(() => {
    if (currentVertexMeasurePoints.length > 1) {
      const p1 = currentVertexMeasurePoints[currentVertexMeasurePoints.length - 2];
      const p2 = currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1];
      const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

      setVertexMeasurements(prev => [...prev, { p1, p2, length }]);
    }
  }, [currentVertexMeasurePoints]);

  useEffect(() => {
    if (isRotating && !rotationAnchor && ghostPiecePos && activeBrush) {
      onRotationAnchorChange({
        x: ghostPiecePos.x,
        y: ghostPiecePos.y,
      });
    }
  }, [isRotating, rotationAnchor, ghostPiecePos, activeBrush, onRotationAnchorChange]);


  const undoVertexMeasurement = () => {
    setVertexMeasurements(prev => prev.slice(0, -1));
    setCurrentVertexMeasurePoints(prev => prev.slice(0, -1));
  };

  const GhostPiece = useMemo(() => {
    if (!ghostPiecePos || !activeBrush) return null;

    const w_px = activeBrush.width * scale;
    const h_px = activeBrush.height * scale;
    // ghostPiecePos is currently the center of the piece in cm.
    // Calculate mouse position (pivot) back from center
    const angleRad = brushAngle * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    let pivotLocal: Point = { x: 0, y: 0 };
    switch (pivotPoint) {
      case 'topLeft': pivotLocal = { x: -activeBrush.width / 2, y: -activeBrush.height / 2 }; break;
      case 'topRight': pivotLocal = { x: activeBrush.width / 2, y: -activeBrush.height / 2 }; break;
      case 'bottomLeft': pivotLocal = { x: -activeBrush.width / 2, y: activeBrush.height / 2 }; break;
      case 'bottomRight': pivotLocal = { x: activeBrush.width / 2, y: activeBrush.height / 2 }; break;
    }

    const rotatedPivotX = pivotLocal.x * cos - pivotLocal.y * sin;
    const rotatedPivotY = pivotLocal.x * sin + pivotLocal.y * cos;

    // This is where the mouse (and cursor center) is
    const mouseX_px = (ghostPiecePos.x + rotatedPivotX) * scale;
    const mouseY_px = (ghostPiecePos.y + rotatedPivotY) * scale;

    const pivotTranslateMap = {
      topLeft: { x: 0, y: 0, origin: '0 0' },
      topRight: { x: -100, y: 0, origin: '100% 0' },
      bottomLeft: { x: 0, y: -100, origin: '0 100%' },
      bottomRight: { x: -100, y: -100, origin: '100% 100%' },
    };

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${mouseX_px}px`,
      top: `${mouseY_px}px`,
      transform: `translate(${pivotTranslateMap[pivotPoint].x}%, ${pivotTranslateMap[pivotPoint].y}%) rotate(${brushAngle}deg)`,
      transformOrigin: pivotTranslateMap[pivotPoint].origin,
      pointerEvents: 'none',
      zIndex: 10,
    };

    if (activeBrush.type === 'remnant') {
      return <RemnantGhost remnant={activeBrush} scale={scale} style={baseStyle} />;
    }

    return (
      <div style={{
        ...baseStyle,
        width: `${w_px}px`,
        height: `${h_px}px`,
        backgroundColor: 'rgba(0, 120, 255, 0.3)',
        border: '2px dotted rgba(0, 120, 255, 0.8)',
      }} />
    );
  }, [ghostPiecePos, activeBrush, scale, brushAngle, pivotPoint]);

  const SeriesGhostPieces = useMemo(() => {
    if (seriesGhostPieces.length === 0 || !activeBrush) return null;

    return seriesGhostPieces.map((pos, index) => {
      const x_px = pos.x * scale;
      const y_px = pos.y * scale;

      const style: React.CSSProperties = {
        position: 'absolute',
        left: `${x_px}px`,
        top: `${y_px}px`,
        transform: `translate(-50%, -50%) rotate(${brushAngle}deg)`,
        transformOrigin: 'center',
        pointerEvents: 'none',
        zIndex: 10,
      };

      if (activeBrush.type === 'remnant') {
        return <RemnantGhost key={index} remnant={activeBrush} scale={scale} style={style} />;
      } else {
        const w_px = activeBrush.width * scale;
        const h_px = activeBrush.height * scale;
        return <div key={index} style={{
          ...style,
          width: `${w_px}px`,
          height: `${h_px}px`,
          backgroundColor: 'rgba(0, 120, 255, 0.3)',
          border: '2px dotted rgba(0, 120, 255, 0.8)',
        }} />;
      }
    });
  }, [seriesGhostPieces, activeBrush, scale, brushAngle]);

  const pointsToString = (points: Point[]): string => {
    return points.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
  }

  const surfaceStyle = useMemo(() => {
    return {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      width: `${surface.width * scale}px`,
      height: `${surface.height * scale}px`,
      transform: `translate(calc(-50% + ${clientState.viewPan.x}px), calc(-50% + ${clientState.viewPan.y}px))`,
      transformOrigin: 'center',
    };
  }, [surface, scale, clientState.viewPan]);

  const FormPreviewSegment = useMemo(() => {
    if (!isDrawingObstacle || !previewSegment || currentObstaclePoints.length === 0 || editingObstacleId) {
      return null;
    }

    const lastPt = currentObstaclePoints[obstacleAnchorIndex];
    const angleRad = previewSegment.angle * (Math.PI / 180);
    const endPt = {
      x: lastPt.x + previewSegment.length * Math.cos(angleRad),
      y: lastPt.y - previewSegment.length * Math.sin(angleRad), // Y is inverted in canvas
    };

    return (
      <line
        x1={lastPt.x * scale}
        y1={lastPt.y * scale}
        x2={endPt.x * scale}
        y2={endPt.y * scale}
        className="stroke-blue-500/80 pointer-events-none"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
    );
  }, [isDrawingObstacle, previewSegment, currentObstaclePoints, scale, editingObstacleId, obstacleAnchorIndex]);


  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
      onMouseMove={handleMouseMoveOnCanvas}
      onMouseLeave={handleMouseLeaveCanvas}
      onMouseDown={handleMouseDown}
      style={{ cursor: getCursor() }}
    >
      {isMeasureMode && (measurements.length > 0 || vertexMeasurements.length > 0 || currentVertexMeasurePoints.length > 0) && (
        <UnifiedMeasurementPanel
          areaMeasurements={measurements}
          vertexMeasurements={vertexMeasurements}
          onClearArea={clearMeasurements}
          onClearVertex={clearVertexMeasurements}
          onUndoVertex={undoVertexMeasurement}
          canUndoVertex={vertexMeasurements.length > 0 || currentVertexMeasurePoints.length > 0}
        />
      )}
      {cursorCoords && (
        <div
          className="fixed z-50 -translate-x-full -translate-y-full pointer-events-none rounded-md bg-gray-900/80 px-2 py-1 text-xs font-mono text-white shadow-lg"
          style={{ left: cursorCoords.pos.x - 10, top: cursorCoords.pos.y - 10 }}
        >

          {isRotating ? (
            `${brushAngle.toFixed(1)}°`
          ) : (
            <>
              {isMeasureMode && (measureMode === 'vertex' || measureMode === 'distance') && currentVertexMeasurePoints.length > 0 && previewVertexMeasurePoint && (
                <div className="font-bold border-b border-gray-700 mb-1 pb-1">
                  Dist: {convertFromCm(Math.sqrt(Math.pow(previewVertexMeasurePoint.x - currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1].x, 2) + Math.pow(previewVertexMeasurePoint.y - currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1].y, 2)), 'm').toFixed(2)}m
                </div>
              )}
              X: {convertFromCm(cursorCoords.display.x, 'm').toFixed(2)}m, Y: {convertFromCm(cursorCoords.display.y, 'm').toFixed(2)}m
            </>
          )}

        </div>
      )}
      <div
        ref={canvasRef}
        className="bg-muted relative shadow-inner border-2 border-dashed"
        style={surfaceStyle}

      >
        {activeBrush && GhostPiece}
        {SeriesGhostPieces}

        {measurements.map(m => <MeasurementBox key={m.id} measurement={m} scale={scale} />)}

        <div
          ref={previewAreaBoxRef}
          className="absolute border-2 border-dashed border-green-600 pointer-events-none z-10 hidden items-center justify-center bg-green-600/10"
        >
          <span ref={previewAreaTextRef} className="bg-white/80 px-1 py-0.5 rounded text-[10px] font-mono text-green-800 shadow-sm whitespace-nowrap hidden sm:inline-block">
            0.00m x 0.00m
          </span>
        </div>


        <svg width="100%" height="100%" className="absolute top-0 left-0" style={{ overflow: 'visible' }}>
          <defs>
            <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
            </pattern>
          </defs>



          <g>
            {obstacles.map(obs => (
              <polygon
                key={obs.id}
                points={pointsToString(obs.points)}
                fill="url(#diagonalHatch)"
                className="stroke-gray-800/80 pointer-events-none"
                strokeWidth="1.5"
                fillOpacity="0.6"
              />
            ))}
            {currentObstaclePoints.length >= 3 && (
              <polygon
                points={pointsToString(currentObstaclePoints)}
                fill="rgb(37 99 235 / 0.1)"
                className="stroke-none pointer-events-none"
              />
            )}
            {currentObstaclePoints.length > 0 && (
              <polyline
                points={pointsToString(currentObstaclePoints)}
                className="fill-none stroke-blue-600 pointer-events-none"
                strokeWidth="2"
              />
            )}

            {editingObstacleId && currentObstaclePoints.map((p, idx) => (
              <circle
                key={`anchor-${idx}`}
                cx={p.x * scale}
                cy={p.y * scale}
                r={idx === obstacleAnchorIndex ? "6" : "4"}
                className={cn(
                  "cursor-pointer pointer-events-auto",
                  idx === obstacleAnchorIndex ? "fill-blue-600 stroke-white" : "fill-white stroke-blue-600 hover:fill-blue-100"
                )}
                strokeWidth="2"
                onClick={() => onObstacleAnchorIndexChange?.(idx)}
              />
            ))}

            {!editingObstacleId && isDrawingObstacle && previewObstaclePoint && !previewSegment && currentObstaclePoints.length > 0 && (
              <line
                x1={currentObstaclePoints[obstacleAnchorIndex].x * scale}
                y1={currentObstaclePoints[obstacleAnchorIndex].y * scale}
                x2={previewObstaclePoint.x * scale}
                y2={previewObstaclePoint.y * scale}
                className="stroke-blue-500/80 pointer-events-none"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            {isDrawingObstacle && previewObstaclePoint && (
              <circle
                cx={previewObstaclePoint.x * scale}
                cy={previewObstaclePoint.y * scale}
                r="4"
                className="fill-white stroke-blue-600 pointer-events-none"
                strokeWidth="2"
              />
            )}
            {FormPreviewSegment}

            <g className={cn("group/vertex", (vertexMeasurements.length > 0 || currentVertexMeasurePoints.length > 0) ? "pointer-events-auto" : "pointer-events-none")}>
              {vertexMeasurements.map((vm, i) => {
                const midX_px = ((vm.p1.x + vm.p2.x) / 2) * scale;
                const midY_px = ((vm.p1.y + vm.p2.y) / 2) * scale;

                let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                let dx = 0;
                let dy = -5;

                const padding = 30; // pixels

                if (midX_px < padding) {
                  textAnchor = 'start';
                  dx = 5;
                } else if (midX_px > (surface.width * scale) - padding) {
                  textAnchor = 'end';
                  dx = -5;
                }

                if (midY_px < 15) {
                  dy = 15;
                } else if (midY_px > (surface.width * scale) - 15) {
                  dy = -8;
                }

                return (
                  <g key={`vm-line-${i}`}>
                    {/* Hover Area */}
                    <line
                      x1={vm.p1.x * scale} y1={vm.p1.y * scale}
                      x2={vm.p2.x * scale} y2={vm.p2.y * scale}
                      stroke="transparent" strokeWidth="15"
                      className="cursor-pointer"
                    />
                    <line
                      x1={vm.p1.x * scale} y1={vm.p1.y * scale}
                      x2={vm.p2.x * scale} y2={vm.p2.y * scale}
                      className="stroke-green-600 transition-colors group-hover/vertex:stroke-green-500" strokeWidth="2" />
                    <text
                      x={midX_px}
                      y={midY_px}
                      dx={dx}
                      dy={dy}
                      className="fill-green-700 text-xs font-semibold select-none pointer-events-none"
                      style={{ textAnchor }}
                    >
                      {convertFromCm(vm.length, 'm').toFixed(2)}m
                    </text>
                  </g>
                )
              })}

            </g>

            {previewVertexMeasurePoint && currentVertexMeasurePoints.length > 0 && (
              <line
                x1={currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1].x * scale}
                y1={currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1].y * scale}
                x2={previewVertexMeasurePoint.x * scale}
                y2={previewVertexMeasurePoint.y * scale}
                className="stroke-green-500/80 pointer-events-none"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            {isMeasureMode && (measureMode === 'vertex' || measureMode === 'area' || measureMode === 'distance') && previewVertexMeasurePoint && (
              <circle
                cx={previewVertexMeasurePoint.x * scale}
                cy={previewVertexMeasurePoint.y * scale}
                r={isCloseSnap ? "6" : "5"}
                className={cn(
                  "pointer-events-none",
                  isCloseSnap ? "fill-orange-500/50 stroke-orange-600" : "fill-green-500/50 stroke-green-600"
                )}
                strokeWidth="1"
              />
            )}
          </g>

          <g>
            {pieces.filter(p => !erasedPieceIds.has(p.id)).map(piece => {
              const pathData = piece.fragments.map(frag => {
                return frag.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`).join(' ') + ' Z';
              }).join(' ');

              return (
                <path
                  key={piece.id}
                  data-piece-id={piece.id}
                  d={pathData}
                  fill={project.materials.find(m => m.id === piece.materialId)?.color || '#ccc'}
                  fillRule="evenodd"
                  className="opacity-85"
                  style={{
                    stroke: 'rgba(255,255,255,0.4)',
                    strokeWidth: 1.0,
                    cursor: isEraserMode ? 'inherit' : 'default',
                  }}
                />
              );
            })}
          </g>

          {clientState.showGrid && (
            <g className="grid-lines pointer-events-none">
              {/* Vertical Lines (Width) */}
              {Array.from({ length: Math.floor(surface.width / clientState.gridSpacing) + 1 }).map((_, i) => {
                const x = i * clientState.gridSpacing * scale;
                const dist_m = (i * clientState.gridSpacing / 100).toFixed(1);
                return (
                  <g key={`v-group-${i}`}>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={surface.height * scale}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-muted-foreground/40"
                    />
                    {/* Width labels at bottom and top (outside) */}
                    {i !== 0 && (
                      <>
                        <text x={x} y={surface.height * scale + 18} textAnchor="middle" className="fill-muted-foreground/80 text-[10px] font-bold select-none">
                          {dist_m}m
                        </text>
                        <text x={x} y={-8} textAnchor="middle" className="fill-muted-foreground/80 text-[10px] font-bold select-none">
                          {dist_m}m
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
              {/* Horizontal Lines (Height) */}
              {Array.from({ length: Math.floor(surface.height / clientState.gridSpacing) + 1 }).map((_, i) => {
                const y = (surface.height - i * clientState.gridSpacing) * scale;
                const dist_m = (i * clientState.gridSpacing / 100).toFixed(1);
                return (
                  <g key={`h-group-${i}`}>
                    <line
                      x1={0}
                      y1={y}
                      x2={surface.width * scale}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-muted-foreground/40"
                    />
                    {/* Height labels at left and right (outside) */}
                    {i !== 0 && (
                      <>
                        <text x={-8} y={y + 3} textAnchor="end" className="fill-muted-foreground/80 text-[10px] font-bold select-none">
                          {dist_m}m
                        </text>
                        <text x={surface.width * scale + 8} y={y + 3} textAnchor="start" className="fill-muted-foreground/80 text-[10px] font-bold select-none">
                          {dist_m}m
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          <g className="pointer-events-none">
            {isEraserMode && hoveredPiece && (
              <path
                key={`highlight-${hoveredPiece.id}`}
                d={hoveredPiece.fragments.map(frag => {
                  return frag.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`).join(' ') + ' Z';
                }).join(' ')}
                fill="rgba(255, 0, 0, 0.5)"
                fillRule="evenodd"
                stroke="red"
                strokeWidth="1"
              />
            )}
          </g>
        </svg>

      </div>

      {isDrawingObstacle && (
        <DrawingInputPanel
          surfaceHeight={surface.height}
          isEditing={!!editingObstacleId}
          onAddSegment={handleAddObstacleSegment}
          onUndoSegment={handleUndoObstacleSegment}
          onUpdateStartPoint={handleUpdateObstacleStartPoint}
          onUpdateLastPoint={handleUpdateObstacleLastPoint}
          onFinish={(closeLoop, name) => handleFinishObstacleDrawing(closeLoop, name)}
          onCancel={handleCancelObstacleDrawing}
          onPreviewChange={onPreviewChange}
          previewSegment={previewSegment}
          surfaceWidth={surface.width}
          anchorIndex={obstacleAnchorIndex}
          startPoint={currentObstaclePoints.length > 0 ? currentObstaclePoints[currentObstaclePoints.length - 1] : null}
          initialPoint={currentObstaclePoints.length > 0 ? currentObstaclePoints[obstacleAnchorIndex] : null}
          obstacles={obstacles}
          editingObstacleId={editingObstacleId}
          editingObstacleName={obstacles.find(o => o.id === editingObstacleId)?.name}
          currentPoints={currentObstaclePoints}
        />
      )}
    </div>
  );
}

const DrawingInputSchema = z.object({
  startX: z.string(),
  startY: z.string(),
  initialX: z.string(),
  initialY: z.string(),
  length: z.string(),
  unit: z.enum(["m", "cm"]),
  angle: z.string(),
  name: z.string().optional(),
});

type DrawingInputFormValues = z.infer<typeof DrawingInputSchema>;

function AngleDial({ value, onChange }: { value: number; onChange: (angle: number) => void }) {
  const dialRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateAngle = (e: MouseEvent | React.MouseEvent) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    if (e.shiftKey) {
      angle = Math.round(angle / 15) * 15;
      if (angle === 360) angle = 0;
    } else {
      angle = Math.round(angle);
    }

    onChange(angle);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    calculateAngle(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        calculateAngle(e);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const angleRad = (value * Math.PI) / 180;
  const handleX = 50 + 35 * Math.cos(-angleRad);
  const handleY = 50 + 35 * Math.sin(-angleRad);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        ref={dialRef}
        width="80"
        height="80"
        viewBox="0 0 100 100"
        className="cursor-pointer select-none touch-none"
        onMouseDown={handleMouseDown}
      >
        {/* Background Circle */}
        <circle cx="50" cy="50" r="45" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />

        {/* Degree notches */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="50" y1="10" x2="50" y2="15"
            transform={`rotate(${deg} 50 50)`}
            className="stroke-muted-foreground/40"
            strokeWidth="2"
          />
        ))}

        {/* Indicator Line */}
        <line
          x1="50" y1="50"
          x2={handleX} y2={handleY}
          className="stroke-blue-600"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Center Pivot */}
        <circle cx="50" cy="50" r="4" className="fill-blue-600" />

        {/* Handle cap */}
        <circle cx={handleX} cy={handleY} r="6" className="fill-blue-600 stroke-white" strokeWidth="2" />
      </svg>
      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
        {value}°
      </span>
    </div>
  );
}

function DrawingInputPanel({
  surfaceWidth,
  surfaceHeight,
  isEditing,
  onAddSegment,
  onUndoSegment,
  onUpdateStartPoint,
  onUpdateLastPoint,
  onFinish,
  onCancel,
  onPreviewChange,
  startPoint,
  initialPoint,
  anchorIndex,
  obstacles,
  editingObstacleId,
  editingObstacleName,
  previewSegment,
  currentPoints,
}: {
  surfaceWidth: number;
  surfaceHeight: number;
  isEditing: boolean;
  onAddSegment: (newPoint: Point) => void;
  onUndoSegment: () => void;
  onUpdateStartPoint: (newPoint: Point) => void;
  onUpdateLastPoint: (newPoint: Point) => void;
  onFinish: (closeLoop: boolean, name?: string) => void;
  onCancel: () => void;
  onPreviewChange: (data: { length: number; angle: number } | null) => void;
  startPoint: Point | null;
  initialPoint: Point | null;
  anchorIndex?: number;
  obstacles?: Obstacle[];
  editingObstacleId?: string | null;
  editingObstacleName?: string;
  previewSegment: { length: number; angle: number } | null;
  currentPoints: Point[];
}) {
  const form = useForm<DrawingInputFormValues>({
    resolver: zodResolver(DrawingInputSchema),
    defaultValues: {
      startX: startPoint ? (startPoint.x / 100).toFixed(4) : "0",
      startY: startPoint ? ((surfaceHeight - startPoint.y) / 100).toFixed(4) : "0",
      initialX: initialPoint ? (initialPoint.x / 100).toFixed(4) : "0",
      initialY: initialPoint ? ((surfaceHeight - initialPoint.y) / 100).toFixed(4) : "0",
      length: "1",
      unit: 'm',
      angle: "0",
      name: editingObstacleName || "",
    },
  });

  const { dirtyFields } = form.formState;

  const lastAnchorIndexRef = useRef(anchorIndex);

  // Update form values when startPoint prop changes (moving to next segment)
  useEffect(() => {
    if (startPoint) {
      const newX = (startPoint.x / 100).toFixed(4);
      const newY = ((surfaceHeight - startPoint.y) / 100).toFixed(4);

      // We use shouldDirty: false to ensure prop-driven sync doesn't trigger movement effects
      if (!dirtyFields.startX) {
        form.setValue('startX', newX, { shouldDirty: false });
      }
      if (!dirtyFields.startY) {
        form.setValue('startY', newY, { shouldDirty: false });
      }
    }
  }, [startPoint, form, surfaceHeight, dirtyFields.startX, dirtyFields.startY]);

  // Update form initial point (obstacle origin) when initialPoint prop changes
  useEffect(() => {
    if (initialPoint) {
      const newX = (initialPoint.x / 100).toFixed(4);
      const newY = ((surfaceHeight - initialPoint.y) / 100).toFixed(4);

      if (!dirtyFields.initialX) {
        form.setValue('initialX', newX, { shouldDirty: false });
      }
      if (!dirtyFields.initialY) {
        form.setValue('initialY', newY, { shouldDirty: false });
      }
    }
  }, [initialPoint, form, surfaceHeight, dirtyFields.initialX, dirtyFields.initialY]);

  const watchedValues = form.watch();
  const safeValues = {
    initialX: Number(watchedValues.initialX) || 0,
    initialY: Number(watchedValues.initialY) || 0,
    startX: Number(watchedValues.startX) || 0,
    startY: Number(watchedValues.startY) || 0,
    length: Number(watchedValues.length) || 0,
    angle: Number(watchedValues.angle) || 0,
  };

  // Effect to update start point (initial point of obstacle) when form values change
  useEffect(() => {
    if (initialPoint && (dirtyFields.initialX || dirtyFields.initialY)) {
      const formX = watchedValues.initialX;
      const formY = watchedValues.initialY;

      if (formX !== undefined && formY !== undefined) {
        const valX = safeValues.initialX;
        const valY = safeValues.initialY;

        if (!isNaN(valX) && !isNaN(valY)) {
          const targetX_cm = valX * 100;
          const targetY_cm = surfaceHeight - (valY * 100);
          if (Math.abs(targetX_cm - initialPoint.x) > 0.001 || Math.abs(targetY_cm - initialPoint.y) > 0.001) {
            onUpdateStartPoint({ x: targetX_cm, y: targetY_cm });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues.initialX, watchedValues.initialY, onUpdateStartPoint, surfaceHeight, anchorIndex, dirtyFields.initialX, dirtyFields.initialY]);

  // Effect to update anchor point (last point of obstacle) when form values change
  useEffect(() => {
    if (startPoint && (dirtyFields.startX || dirtyFields.startY)) {
      const formX = watchedValues.startX;
      const formY = watchedValues.startY;

      if (formX !== undefined && formY !== undefined) {
        const valX = safeValues.startX;
        const valY = safeValues.startY;

        if (!isNaN(valX) && !isNaN(valY)) {
          const targetX_cm = valX * 100;
          const targetY_cm = surfaceHeight - (valY * 100);
          if (Math.abs(targetX_cm - startPoint.x) > 0.001 || Math.abs(targetY_cm - startPoint.y) > 0.001) {
            onUpdateLastPoint({ x: targetX_cm, y: targetY_cm });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues.startX, watchedValues.startY, onUpdateLastPoint, surfaceHeight, dirtyFields.startX, dirtyFields.startY]);

  // Sync form when previewSegment changes from outside (e.g. Canvas scroll wheel)
  useEffect(() => {
    if (previewSegment) {
      const currentAngle = parseFloat(form.getValues('angle') || '0');
      if (Math.abs(currentAngle - previewSegment.angle) > 0.01) {
        form.setValue('angle', previewSegment.angle.toFixed(1));
      }

      const currentUnit = form.getValues('unit') as Unit;
      const currentLength = convertToCm(parseFloat(form.getValues('length') || '0'), currentUnit);
      if (Math.abs(currentLength - previewSegment.length) > 0.01) {
        form.setValue('length', convertFromCm(previewSegment.length, currentUnit).toFixed(2));
      }
    }
  }, [previewSegment, form]);

  useEffect(() => {
    onPreviewChange({
      length: convertToCm(safeValues.length, watchedValues.unit as Unit),
      angle: safeValues.angle,
    });
  }, [watchedValues.length, watchedValues.unit, watchedValues.angle, onPreviewChange, safeValues.length, safeValues.angle]);

  useEffect(() => {
    return () => {
      onPreviewChange(null);
    };
  }, [onPreviewChange]);

  const onSubmit = (data: DrawingInputFormValues) => {
    const rawSX = Number(data.startX) || 0;
    const rawSY = Number(data.startY) || 0;
    const rawAngle = Number(data.angle) || 0;
    const rawLength = Number(data.length) || 0.1;

    const sX = rawSX * 100;
    const sY = surfaceHeight - (rawSY * 100); // Invert back for internal storage/canvas
    const lengthCm = convertToCm(rawLength, data.unit as Unit);

    const angleRad = (rawAngle * Math.PI) / 180;
    const deltaX = lengthCm * Math.cos(angleRad);
    const deltaY = -1 * lengthCm * Math.sin(angleRad); // Inverted Y for canvas

    const newPoint = { x: sX + deltaX, y: sY + deltaY };

    // Boundary check in cm
    const margin = 0.01; // small margin for floats
    if (newPoint.x < -margin || newPoint.x > surfaceWidth + margin ||
      newPoint.y < -margin || newPoint.y > surfaceHeight + margin) {
      alert("Error: El punto final del segmento está fuera de la superficie.");
      return;
    }

    onAddSegment(newPoint);
  }

  const setAngle = (angle: number) => {
    form.setValue('angle', angle.toString());
    form.trigger('angle');
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input that isn't ours
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput && !e.currentTarget) return; // Basic check, but we can be more specific

      // Arrow keys for direction
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAngle(90);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAngle(270);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setAngle(180);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setAngle(0);
      }
      // Escape to cancel
      else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      // Submit segment on Enter
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey) {
          // Pass current name value when finishing with Ctrl+Enter
          const currentName = form.getValues('name');
          onFinish(true, currentName);
        } else {
          form.handleSubmit(onSubmit)();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCancel, onFinish, setAngle, onSubmit]);

  return (
    <div className="absolute z-30 top-4 right-4">
      <Card className="w-72 shadow-2xl border-muted-foreground/10 bg-background/95 backdrop-blur-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-muted/5">
              <CardTitle className="text-xs font-bold flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full shadow-sm", isEditing ? "bg-amber-500" : "bg-blue-600")} />
                {isEditing ? "Editar Obstáculo" : "Dibujar Obstáculo"}
              </CardTitle>
              {isEditing && <Badge variant="outline" className="text-[9px] uppercase tracking-wider h-4 px-1.5 border-amber-500/30 text-amber-600 bg-amber-50">En edición</Badge>}
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {/* Name Field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Columna, Puerta..."
                        {...field}
                        className="h-8 text-xs bg-muted/20 focus:bg-background transition-colors"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Decoupled Warnings Section (Left Overlay) */}
              <div className="absolute top-0 left-[-4px] -translate-x-full w-48 pointer-events-none space-y-2 pr-2">
                {(() => {
                  const sX = safeValues.startX * 100;
                  const sY = surfaceHeight - (safeValues.startY * 100);
                  const lengthCm = convertToCm(safeValues.length, watchedValues.unit as Unit);
                  const angleRad = (safeValues.angle * Math.PI) / 180;
                  const deltaX = lengthCm * Math.cos(angleRad);
                  const deltaY = -1 * lengthCm * Math.sin(angleRad);
                  const nextX = sX + deltaX;
                  const nextY = sY + deltaY;

                  const isStartOut = (safeValues.initialX > surfaceWidth / 100 || safeValues.initialX < 0 || safeValues.initialY > surfaceHeight / 100 || safeValues.initialY < 0);
                  const isNextOut = (nextX > surfaceWidth + 0.01 || nextX < -0.01 || nextY > surfaceHeight + 0.01 || nextY < -0.01);

                  // Real-time Overlap Check
                  let hasOverlap = false;
                  try {
                    const scaleFactor = 1000;

                    if (isEditing) {
                      // If editing, use Clipper as it's a closed polygon (robust for whole-figure movement)
                      if (currentPoints.length >= 2) {
                        const path = currentPoints.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));
                        const clipper = new ClipperLib.Clipper();
                        clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true);

                        for (const obs of (obstacles || [])) {
                          if (obs.id === editingObstacleId) continue;
                          const obsPath = obs.points.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));
                          clipper.AddPath(obsPath, ClipperLib.PolyType.ptClip, true);
                        }

                        const solution = new ClipperLib.Paths();
                        clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
                        if (solution.length > 0) hasOverlap = true;
                      }
                    } else {
                      // If drawing, use manual segment intersection to avoid PolyTree requirement and crash
                      // endpoints in scaled int units
                      const p1 = { X: Math.round(sX * scaleFactor), Y: Math.round(sY * scaleFactor) };
                      const p2 = { X: Math.round(nextX * scaleFactor), Y: Math.round(nextY * scaleFactor) };

                      const crossProduct = (a: any, b: any, c: any) => (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);
                      const onSegment = (p: any, a: any, b: any) =>
                        p.X >= Math.min(a.X, b.X) && p.X <= Math.max(a.X, b.X) &&
                        p.Y >= Math.min(a.Y, b.Y) && p.Y <= Math.max(a.Y, b.Y);

                      const segsIntersect = (a: any, b: any, c: any, d: any) => {
                        const d1 = crossProduct(c, d, a);
                        const d2 = crossProduct(c, d, b);
                        const d3 = crossProduct(a, b, c);
                        const d4 = crossProduct(a, b, d);
                        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
                        if (d1 === 0 && onSegment(a, c, d)) return true;
                        if (d2 === 0 && onSegment(b, c, d)) return true;
                        if (d3 === 0 && onSegment(c, a, b)) return true;
                        if (d4 === 0 && onSegment(d, a, b)) return true;
                        return false;
                      };

                      if (obstacles) {
                        for (const obs of obstacles) {
                          if (obs.id === editingObstacleId) continue;
                          const obsPath = obs.points.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));

                          // 1. Check if endpoints are inside
                          if (ClipperLib.Clipper.PointInPolygon(p1, obsPath) !== 0 ||
                            ClipperLib.Clipper.PointInPolygon(p2, obsPath) !== 0) {
                            hasOverlap = true;
                            break;
                          }

                          // 2. Check if segment intersects any obstacle edge
                          for (let i = 0; i < obsPath.length; i++) {
                            const e1 = obsPath[i];
                            const e2 = obsPath[(i + 1) % obsPath.length];
                            if (segsIntersect(p1, p2, e1, e2)) {
                              hasOverlap = true;
                              break;
                            }
                          }
                          if (hasOverlap) break;
                        }
                      }
                    }
                  } catch (e) {
                    console.error("Overlap check error:", e);
                  }

                  const warnings = [];
                  if (hasOverlap) {
                    warnings.push(
                      <Alert key="overlap" variant="destructive" className="py-2 px-3 shadow-xl border-2 border-red-500/50 bg-background/95 backdrop-blur-md pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="flex gap-2">
                          <PlusCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <AlertTitle className="text-[10px] font-bold uppercase tracking-tight text-red-600 leading-none">
                              Solapamiento
                            </AlertTitle>
                            <AlertDescription className="text-[9px] leading-tight text-muted-foreground">
                              Cruce de zona detectado.
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    );
                  }
                  if (isStartOut || isNextOut) {
                    warnings.push(
                      <Alert key="bounds" variant="destructive" className="py-2 px-3 shadow-xl border-2 border-destructive/50 bg-background/95 backdrop-blur-md pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="flex gap-2">
                          <Terminal className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <AlertTitle className="text-[10px] font-bold uppercase tracking-tight text-destructive leading-none">
                              Fuera de límites
                            </AlertTitle>
                            <AlertDescription className="text-[9px] leading-tight text-muted-foreground">
                              {isStartOut ? "Punto inicial fuera." : "Punto final fuera."}
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    );
                  }
                  return warnings;
                })()}
              </div>

              {/* Initial Point Coordinates */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Punto Inicial</p>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="initialX"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">X (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                                field.onChange(val);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="initialY"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Y (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                                field.onChange(val);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {!isEditing && startPoint && initialPoint && (Math.abs(startPoint.x - initialPoint.x) > 0.001 || Math.abs(startPoint.y - initialPoint.y) > 0.001) && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Punto de Anclaje</p>
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="startX"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">X (m)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                                  field.onChange(val);
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="startY"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Y (m)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                                  field.onChange(val);
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
              {!isEditing && (
                <>
                  <Separator />
                  <FormItem>
                    <FormLabel>Ángulo (°)</FormLabel>
                    <div className="flex items-center gap-4 pt-1">
                      {/* 3x3 Cross Direction Pad - Compact */}
                      <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-fit bg-muted/10 p-1.5 rounded-full border border-muted-foreground/5 shadow-inner">
                        <div />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(90)}
                          title="Arriba (90°)"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <div />

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(180)}
                          title="Izquierda (180°)"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="h-8 w-8 flex items-center justify-center opacity-30">
                          <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(0)}
                          title="Derecha (0°)"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>

                        <div />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(270)}
                          title="Abajo (270°)"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <div />
                      </div>

                      {/* Interactive Dial - Compact */}
                      <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 rounded-xl border-dashed border border-muted-foreground/10 p-1.5 min-h-[120px] shadow-inner">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1 shadow-sm px-2 py-0.5 bg-background/50 rounded-full border border-muted-foreground/5">Ángulo</p>
                        <AngleDial
                          value={safeValues.angle}
                          onChange={(newAngle) => setAngle(newAngle)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="angle"
                        render={({ field }) => (
                          <FormControl className="flex-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              {...field}
                              className="hidden" // We hide the raw input but keep it for form submission
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                                  field.onChange(val);
                                }
                              }}
                            />
                          </FormControl>
                        )}
                      />
                    </div>
                  </FormItem>

                  <div className="flex gap-2">
                    <FormField control={form.control} name="length" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Longitud</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                                field.onChange(val);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="unit" render={({ field }) => (
                      <FormItem><FormLabel>Unidad</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="p-3 pt-0 grid grid-cols-2 gap-2">
              {!isEditing ? (
                <>
                  <Button type="button" variant="secondary" className="w-full h-9 text-xs" onClick={onUndoSegment}>
                    <Undo className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    Deshacer
                  </Button>
                  <Button type="submit" className="w-full h-9 text-xs bg-blue-500 hover:bg-blue-600 shadow-sm border-b-2 border-blue-700">
                    <PlusCircle className="mr-2 h-3.5 w-3.5" />
                    Añadir
                  </Button>
                  <Button type="button" variant="destructive" className="w-full h-9 text-xs bg-red-600 hover:bg-red-700 shadow-sm border-b-2 border-red-800" onClick={onCancel}>
                    <X className="mr-2 h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                  <Button type="button" className="w-full h-9 text-xs bg-blue-600 hover:bg-blue-700 font-bold shadow-md border-b-2 border-blue-800" onClick={() => onFinish(false, form.getValues('name'))}>
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Terminar
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="destructive" className="w-full h-9 text-xs bg-red-600 hover:bg-red-700 shadow-sm border-b-2 border-red-800" onClick={onCancel}>
                    <X className="mr-2 h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                  <Button type="button" className="w-full h-9 text-xs bg-amber-600 hover:bg-amber-700 shadow-md border-b-2 border-amber-800 font-bold" onClick={() => onFinish(false, form.getValues('name'))}>
                    <Save className="mr-2 h-3.5 w-3.5" />
                    Actualizar
                  </Button>
                </>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}


function MeasurementBox({ measurement, scale, isTemporary = false, onConvert }: { measurement: Measurement, scale: number, isTemporary?: boolean, onConvert?: (points: Point[]) => void }) {
  const width_m = convertFromCm(measurement.width, 'm').toFixed(2);
  const height_m = convertFromCm(measurement.height, 'm').toFixed(2);

  const handleConvert = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConvert) {
      const points: Point[] = [
        { x: measurement.x, y: measurement.y },
        { x: measurement.x + measurement.width, y: measurement.y },
        { x: measurement.x + measurement.width, y: measurement.y + measurement.height },
        { x: measurement.x, y: measurement.y + measurement.height },
      ];
      onConvert(points);
    }
  };

  return (
    <div
      className={cn(
        "absolute border-2 transition-all group",
        isTemporary ? "border-dashed border-green-600 pointer-events-none" : "border-solid border-green-600 pointer-events-auto hover:bg-green-600/10 hover:border-green-500"
      )}
      style={{
        left: `${measurement.x * scale}px`,
        top: `${measurement.y * scale}px`,
        width: `${measurement.width * scale}px`,
        height: `${measurement.height * scale}px`,
        zIndex: isTemporary ? 1 : 40,
      }}
    >
      {!isTemporary && onConvert && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute -top-3 -right-3 h-6 w-6 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-blue-50 text-blue-600 border border-blue-100"
          onClick={handleConvert}
          title="Convertir a Obstáculo"
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
      <div className="absolute bottom-1 right-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-sm font-mono shadow-sm">
        {width_m}m x {height_m}m
      </div>
    </div>
  );
}





function GuideSettingsPopover({ showGrid, gridSpacing, onChange }: { showGrid: boolean, gridSpacing: number, onChange: (cs: any) => void }) {
  const options = [
    { label: '10cm', value: 10 },
    { label: '25cm', value: 25 },
    { label: '50cm', value: 50 },
    { label: '1m', value: 100 },
    { label: '2m', value: 200 },
    { label: '5m', value: 500 },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2 px-3 h-9", showGrid ? "bg-primary/10 border-primary text-primary" : "")}>
          <Grid3X3 className="h-4 w-4" />
          <span className="hidden sm:inline">Guías</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="grid-toggle" className="text-sm font-medium">Mostrar Guías</Label>
            <Switch
              id="grid-toggle"
              checked={showGrid}
              onCheckedChange={(checked) => onChange((cs: any) => ({ ...cs, showGrid: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Espaciado</Label>
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => (
                <Button
                  key={opt.value}
                  variant={gridSpacing === opt.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  disabled={!showGrid}
                  onClick={() => onChange((cs: any) => ({ ...cs, gridSpacing: opt.value }))}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground leading-tight italic">
              Las guías visuales ayudan a medir distancias y alinear elementos proporcionalmente.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


// --- Loading and Error States ---
function EditorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-muted/40">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando proyecto...</p>
        </div>
      </main>
    </div>
  );
}

function EditorError({ message }: { message: string }) {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Project</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </main>
    </>
  );
}
