import { useRef, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Point, PlacedPiece, Brush, Obstacle, VertexFigure, VertexMeasurement } from '@/lib/types';
import { snapToVertex, getPieceUnderCursor, computeGhostPos, calculateGhostSnap } from '../_utils/canvas-helpers';
import { useCanvasWheel } from './useCanvasWheel';
import { useCanvasShortcuts } from './Canvas/useCanvasShortcuts';
import { useMeasurementState } from './Canvas/useMeasurementState';
import { useCanvasMouseEvents } from './Canvas/useCanvasMouseEvents';

const DRAG_THRESHOLD_PX = 8;
const EPSILON = 1e-9;

interface UseCanvasEventsOptions {
  scale: number;
  isHandMode: boolean;
  isEraserMode: boolean;
  isMeasureMode: boolean;
  measureMode: string;
  isDrawingObstacle: boolean;
  editingObstacleId: string | null;
  activeBrush: Brush | null;
  brushAngle: number;
  pivotPoint: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  isObstacleSnapActive: boolean;
  isRotating: boolean;
  pieces: PlacedPiece[];
  obstacles: Obstacle[];
  surfaceWidth: number;
  surfaceHeight: number;
  currentObstaclePoints: Point[];
  isCloseSnap: boolean;
  canvasRef: React.RefObject<HTMLDivElement>;
  // Actions
  handlePanMove: (dx: number, dy: number) => void;
  handleZoomMove: (newZoom: number, mouseX?: number, mouseY?: number) => void;
  commitPanZoom: () => void;
  onPlacePiece: (positions: Point[]) => void;
  onBatchDeletePieces: (ids: string[]) => void;
  onCurrentObstaclePointsChange: (pts: Point[]) => void;
  onObstacleAnchorIndexChange: (idx: number) => void;
  onFinishObstacleDrawing: (closeLoop: boolean) => void;
  onRotationAnchorChange: (p: Point | null) => void;
  onPreviewChange: (data: { length: number; angle: number } | null) => void;
  viewportRef: React.RefObject<HTMLDivElement>;
  previewSegment: { length: number; angle: number } | null;
  obstacleAnchorIndex: number;
  onBrushAngleChange?: (angle: number) => void;
  isGridSnapActive: boolean;
  gridSpacing: number;
}

export function useCanvasEvents(opts: UseCanvasEventsOptions) {
  const {
    scale, isHandMode, isEraserMode, isMeasureMode, measureMode,
    isDrawingObstacle, editingObstacleId, activeBrush, brushAngle,
    pivotPoint, isObstacleSnapActive, isRotating,
    pieces, obstacles, surfaceWidth, surfaceHeight, currentObstaclePoints,
    canvasRef, handlePanMove, handleZoomMove, commitPanZoom,
    onPlacePiece, onBatchDeletePieces, onCurrentObstaclePointsChange,
    onObstacleAnchorIndexChange, onFinishObstacleDrawing,
    onRotationAnchorChange, onPreviewChange, viewportRef, previewSegment, obstacleAnchorIndex, onBrushAngleChange,
    isGridSnapActive, gridSpacing,
  } = opts;

  // --- Refs (no-render path) ---
  const isMouseDownRef = useRef(false);
  const isSeriesPlacingRef = useRef(false);
  const seriesGhostPiecesRef = useRef<Point[]>([]);
  const dragStartPos = useRef<Point | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const pendingErasures = useRef<Set<string>>(new Set());
  const isDrawingMeasureAreaRef = useRef(false);
  const measureStartRef = useRef<Point | null>(null);
  const previewAreaBoxRef = useRef<HTMLDivElement>(null);
  const previewAreaTextRef = useRef<HTMLSpanElement>(null);
  const isErasingRef = useRef(false);
  const isClosedSnapRef = useRef(false);

  // --- State ---
  const [ghostPiecePos, setGhostPiecePos] = useState<Point | null>(null);
  const [hoveredPieceId, setHoveredPieceId] = useState<string | null>(null);
  const [seriesGhostPieces, setSeriesGhostPieces] = useState<Point[]>([]);
  const [previewObstaclePoint, setPreviewObstaclePoint] = useState<Point | null>(null);
  const [erasedPieceIds, setErasedPieceIds] = useState<Set<string>>(new Set());
  const [isCloseSnapState, setIsCloseSnapState] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ pos: { x: number; y: number }; display: Point } | null>(null);
  const [orthogonalLock, setOrthogonalLock] = useState<'up' | 'down' | 'left' | 'right' | null>(null);

  const {
    currentVertexPoints, setCurrentVertexPoints,
    previewVertexPoint, setPreviewVertexPoint,
    vertexMeasurements, setVertexMeasurements,
    savedVertexFigures, setSavedVertexFigures,
    savedAreaMeasurements, setSavedAreaMeasurements,
    showAreaMeasurements, setShowAreaMeasurements,
    showVertexMeasurements, setShowVertexMeasurements,
    hiddenAreaIds, setHiddenAreaIds,
    hiddenVertexFigureIds, setHiddenVertexFigureIds,
    toggleAreaMeasurements, toggleVertexMeasurements,
    clearVertexMeasurements, undoVertexMeasurement, clearAreaMeasurements,
    toggleAreaVisibility, toggleVertexFigureVisibility, deleteAreaMeasurement, deleteVertexFigure
  } = useMeasurementState();

  // --- Helpers wrapper to set local closed snap state ---
  const handleCloseSnapChange = useCallback((isClose: boolean) => {
    isClosedSnapRef.current = isClose;
    setIsCloseSnapState(isClose);
  }, []);

  const getMousePos = useCallback((e: MouseEvent | React.MouseEvent<HTMLDivElement>): Point => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const py = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    return { x: px / scale, y: py / scale };
  }, [canvasRef, scale]);

  // --- Wheel Zoom/Rotate Event listener (delegated to custom hook) ---
  useCanvasWheel({
    viewportRef,
    activeBrush,
    brushAngle,
    onBrushAngleChange,
    isDrawingObstacle,
    previewSegment,
    onPreviewChange,
  });

  // --- Listen to external clear measurements event ---
  useEffect(() => {
    const handleClear = () => {
      setSavedAreaMeasurements([]);
      setSavedVertexFigures([]);
      setVertexMeasurements([]);
      setCurrentVertexPoints([]);
      setPreviewVertexPoint(null);
      setHiddenAreaIds([]);
      setHiddenVertexFigureIds([]);
    };
    window.addEventListener('deco-clear-measurements', handleClear);
    return () => window.removeEventListener('deco-clear-measurements', handleClear);
  }, []);

  // --- Pan via window (global mouseup / mousemove) ---
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current || !lastPanPos.current) return;
      handlePanMove(e.clientX - lastPanPos.current.x, e.clientY - lastPanPos.current.y);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      if (isPanningRef.current) {
        isPanningRef.current = false;
        lastPanPos.current = null;
        commitPanZoom();
      }
      if (!isMouseDownRef.current) return;
      isMouseDownRef.current = false;

      if (isSeriesPlacingRef.current) {
        const ghosts = seriesGhostPiecesRef.current;
        if (ghosts.length > 0) onPlacePiece(ghosts);
        seriesGhostPiecesRef.current = [];
        setSeriesGhostPieces([]);
        isSeriesPlacingRef.current = false;
        dragStartPos.current = null;
      } else if (dragStartPos.current) {
        onPlacePiece([dragStartPos.current]);
        dragStartPos.current = null;
      }

      if (isErasingRef.current) {
        isErasingRef.current = false;
        if (pendingErasures.current.size > 0) {
          onBatchDeletePieces(Array.from(pendingErasures.current));
          pendingErasures.current.clear();
        }
      }

      if (isDrawingMeasureAreaRef.current && measureStartRef.current) {
        const s = measureStartRef.current;
        const rawPos = getMousePos(e);
        // Snappe end coordinate of area measurement
        const snappedEnd = snapToVertex(rawPos, false, [], scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);
        const x = Math.min(snappedEnd.x, s.x), y = Math.min(snappedEnd.y, s.y);
        const w = Math.abs(snappedEnd.x - s.x), h = Math.abs(snappedEnd.y - s.y);
        if (w > 0 && h > 0) {
          setSavedAreaMeasurements(prev => [...prev, { id: uuidv4(), x, y, width: w, height: h }]);
        }
        isDrawingMeasureAreaRef.current = false;
        if (previewAreaBoxRef.current) previewAreaBoxRef.current.style.display = 'none';
        measureStartRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handlePanMove, commitPanZoom, onPlacePiece, onBatchDeletePieces]);

  useCanvasShortcuts({
    isDrawingObstacle,
    currentObstaclePoints,
    previewObstaclePoint,
    onCurrentObstaclePointsChange,
    onObstacleAnchorIndexChange,
    onFinishObstacleDrawing,
    isMeasureMode,
    measureMode,
    currentVertexPoints,
    setCurrentVertexPoints,
    setVertexMeasurements,
    setPreviewVertexPoint,
    isDrawingMeasureAreaRef,
    previewAreaBoxRef,
    setOrthogonalLock,
  });

  const { handleMouseDown, handleMouseMove, handleMouseLeave } = useCanvasMouseEvents({
    scale, isHandMode, isEraserMode, isMeasureMode, measureMode,
    isDrawingObstacle, editingObstacleId, activeBrush, brushAngle,
    pivotPoint, isObstacleSnapActive, isRotating, pieces, obstacles,
    surfaceWidth, surfaceHeight, currentObstaclePoints, isGridSnapActive,
    gridSpacing, canvasRef, onCurrentObstaclePointsChange, onObstacleAnchorIndexChange,
    isPanningRef, lastPanPos, isMouseDownRef, dragStartPos, isErasingRef,
    pendingErasures, isDrawingMeasureAreaRef, measureStartRef, isSeriesPlacingRef,
    seriesGhostPiecesRef, isClosedSnapRef, setHoveredPieceId, setErasedPieceIds,
    erasedPieceIds, previewAreaBoxRef, previewAreaTextRef, currentVertexPoints,
    setCurrentVertexPoints, setSavedVertexFigures, setVertexMeasurements,
    setPreviewVertexPoint, setPreviewObstaclePoint, setCursorCoords,
    orthogonalLock, setGhostPiecePos, setSeriesGhostPieces, ghostPiecePos,
    handleCloseSnapChange, getMousePos
  });

  return {
    ghostPiecePos,
    hoveredPieceId,
    seriesGhostPieces,
    previewObstaclePoint,
    currentVertexPoints,
    previewVertexPoint,
    vertexMeasurements,
    savedVertexFigures,
    savedAreaMeasurements,
    erasedPieceIds,
    isCloseSnap: isCloseSnapState,
    cursorCoords,
    previewAreaBoxRef,
    previewAreaTextRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseLeave,
    clearVertexMeasurements,
    undoVertexMeasurement,
    clearAreaMeasurements,
    isPanningRef,
    showAreaMeasurements,
    showVertexMeasurements,
    hiddenAreaIds,
    hiddenVertexFigureIds,
    toggleAreaMeasurements,
    toggleVertexMeasurements,
    toggleAreaVisibility,
    toggleVertexFigureVisibility,
    deleteAreaMeasurement,
    deleteVertexFigure,
  };
}
