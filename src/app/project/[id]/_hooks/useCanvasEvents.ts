import { useRef, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Point, PlacedPiece, Brush, Obstacle, VertexFigure, VertexMeasurement } from '@/lib/types';
import { snapToVertex, getPieceUnderCursor, computeGhostPos, calculateGhostSnap } from '../_utils/canvas-helpers';
import { useCanvasWheel } from './useCanvasWheel';

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
  const [currentVertexPoints, setCurrentVertexPoints] = useState<Point[]>([]);
  const [previewVertexPoint, setPreviewVertexPoint] = useState<Point | null>(null);
  const [vertexMeasurements, setVertexMeasurements] = useState<VertexMeasurement[]>([]);
  const [savedVertexFigures, setSavedVertexFigures] = useState<VertexFigure[]>([]);
  const [savedAreaMeasurements, setSavedAreaMeasurements] = useState<Array<{ id: string; x: number; y: number; width: number; height: number }>>([]);
  const [erasedPieceIds, setErasedPieceIds] = useState<Set<string>>(new Set());
  const [isCloseSnapState, setIsCloseSnapState] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ pos: { x: number; y: number }; display: Point } | null>(null);
  const [orthogonalLock, setOrthogonalLock] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  const [showAreaMeasurements, setShowAreaMeasurements] = useState(true);
  const [showVertexMeasurements, setShowVertexMeasurements] = useState(true);
  const [hiddenAreaIds, setHiddenAreaIds] = useState<string[]>([]);
  const [hiddenVertexFigureIds, setHiddenVertexFigureIds] = useState<string[]>([]);

  // --- Helpers wrapper to set local closed snap state ---
  const handleCloseSnapChange = useCallback((isClose: boolean) => {
    isClosedSnapRef.current = isClose;
    setIsCloseSnapState(isClose);
  }, []);

  const toggleAreaMeasurements = useCallback(() => setShowAreaMeasurements(prev => !prev), []);
  const toggleVertexMeasurements = useCallback(() => setShowVertexMeasurements(prev => !prev), []);

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

  // --- Keyboard Event listener (Esc, Backspace, Enter, Ctrl+Enter, Arrow Keys) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      // 1. Esc: Clear drawing states
      if (e.key === 'Escape') {
        setCurrentVertexPoints([]);
        setVertexMeasurements([]);
        setPreviewVertexPoint(null);
        onCurrentObstaclePointsChange([]);
        isDrawingMeasureAreaRef.current = false;
        if (previewAreaBoxRef.current) {
          previewAreaBoxRef.current.style.display = 'none';
        }
        setOrthogonalLock(null);
      }

      // 2. Backspace: Remove last vertex/point
      else if (e.key === 'Backspace') {
        if (isDrawingObstacle && currentObstaclePoints.length > 0) {
          onCurrentObstaclePointsChange(currentObstaclePoints.slice(0, -1));
          setOrthogonalLock(null);
        } else if (isMeasureMode && measureMode === 'vertex' && currentVertexPoints.length > 0) {
          setCurrentVertexPoints(prev => prev.slice(0, -1));
          setVertexMeasurements(prev => prev.slice(0, -1));
        }
      }

      // 3. Obstacle Drawing Shortcuts
      else if (isDrawingObstacle) {
        if (e.key === 'Enter') {
          if (e.ctrlKey) {
            e.preventDefault();
            // Ctrl + Enter: Close and save obstacle
            onFinishObstacleDrawing(true);
            setOrthogonalLock(null);
          } else if (previewObstaclePoint && currentObstaclePoints.length === 0) {
            e.preventDefault();
            // Enter: Append first point to list
            onCurrentObstaclePointsChange([previewObstaclePoint]);
            onObstacleAnchorIndexChange(0);
            setOrthogonalLock(null);
          }
        } else if (currentObstaclePoints.length > 0) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOrthogonalLock('up');
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOrthogonalLock('down');
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setOrthogonalLock('left');
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setOrthogonalLock('right');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDrawingObstacle,
    previewObstaclePoint,
    currentObstaclePoints,
    onCurrentObstaclePointsChange,
    onObstacleAnchorIndexChange,
    onFinishObstacleDrawing,
    isMeasureMode,
    measureMode,
    currentVertexPoints,
  ]);

  // Reset direction lock when drawing is finished or cleared entirely
  useEffect(() => {
    if (!isDrawingObstacle || currentObstaclePoints.length === 0) {
      setOrthogonalLock(null);
    }
  }, [isDrawingObstacle, currentObstaclePoints.length]);

  // --- Main mouse handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isHandMode || e.button === 1) {
      isPanningRef.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    const pos = getMousePos(e);

    if (isDrawingObstacle) {
      if (editingObstacleId) return;
      if (currentObstaclePoints.length === 0) {
        const snapped = snapToVertex(pos, true, currentObstaclePoints, scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);
        onCurrentObstaclePointsChange([snapped]);
        onObstacleAnchorIndexChange(0);
        setOrthogonalLock(null);
      }
      return;
    }

    if (activeBrush && !isRotating) {
      if (isMouseDownRef.current) return;
      isMouseDownRef.current = true;
      let snapPos = { ...pos };
      if (isGridSnapActive && gridSpacing > 0) {
        snapPos.x = Math.round(snapPos.x / gridSpacing) * gridSpacing;
        snapPos.y = Math.round(snapPos.y / gridSpacing) * gridSpacing;
      }
      const center = computeGhostPos(snapPos, activeBrush, brushAngle, pivotPoint);
      // Disable obstacle snap if grid snap is active so they don't fight
      let snappedCenter = calculateGhostSnap(center, activeBrush, brushAngle, scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive && !isGridSnapActive);
      
      dragStartPos.current = snappedCenter;
      return;
    }

    if (isEraserMode) {
      isMouseDownRef.current = true;
      isErasingRef.current = true;
      pendingErasures.current.clear();
      setErasedPieceIds(new Set());
      const hit = getPieceUnderCursor(pos, pieces, erasedPieceIds);
      if (hit) {
        pendingErasures.current.add(hit.id);
        setErasedPieceIds(new Set([hit.id]));
      }
      return;
    }

    if (isMeasureMode) {
      // Ignore clicks outside the canvas using raw unclamped coordinates (plus a 10px tolerance margin)
      const el = canvasRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / scale;
        const rawY = (e.clientY - rect.top) / scale;
        const marginCm = 10 / scale;
        if (
          rawX < -marginCm ||
          rawX > surfaceWidth + marginCm ||
          rawY < -marginCm ||
          rawY > surfaceHeight + marginCm
        ) {
          return;
        }
      }

      if (measureMode === 'area') {
        if (isDrawingMeasureAreaRef.current) return;
        isMouseDownRef.current = true;
        isDrawingMeasureAreaRef.current = true;
        
        // Snappe starting point for area measurement
        const snappedStart = snapToVertex(pos, false, [], scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);
        measureStartRef.current = snappedStart;
        
        if (previewAreaBoxRef.current) {
          previewAreaBoxRef.current.style.display = 'flex';
          previewAreaBoxRef.current.style.left = `${snappedStart.x * scale}px`;
          previewAreaBoxRef.current.style.top = `${snappedStart.y * scale}px`;
          previewAreaBoxRef.current.style.width = '0px';
          previewAreaBoxRef.current.style.height = '0px';
        }
      } else {
        let snapped = snapToVertex(pos, true, currentVertexPoints, scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);
        if (currentVertexPoints.length > 0 && e.shiftKey) {
          const lastPt = currentVertexPoints[currentVertexPoints.length - 1];
          const dx = snapped.x - lastPt.x;
          const dy = snapped.y - lastPt.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            snapped = { x: snapped.x, y: lastPt.y };
          } else {
            snapped = { x: lastPt.x, y: snapped.y };
          }
        }

        if (isClosedSnapRef.current && currentVertexPoints.length > 2) {
          const newPts = [...currentVertexPoints, snapped];
          const segs = newPts.slice(0, -1).map((p1, i) => ({
            p1, p2: newPts[i + 1],
            length: Math.hypot(newPts[i + 1].x - p1.x, newPts[i + 1].y - p1.y),
          }));
          setSavedVertexFigures(prev => [...prev, { id: uuidv4(), segments: segs }]);
          setVertexMeasurements([]);
          setCurrentVertexPoints([]);
          setPreviewVertexPoint(null);
        } else {
          setCurrentVertexPoints(prev => {
            const next = [...prev, snapped];
            if (next.length > 1) {
              const p1 = next[next.length - 2], p2 = next[next.length - 1];
              setVertexMeasurements(vm => [...vm, { p1, p2, length: Math.hypot(p2.x - p1.x, p2.y - p1.y) }]);
            }
            return next;
          });
        }
      }
    }
  }, [
    isHandMode, getMousePos, isDrawingObstacle, editingObstacleId, currentObstaclePoints,
    scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange, onCurrentObstaclePointsChange, onObstacleAnchorIndexChange,
    onFinishObstacleDrawing, activeBrush, isRotating, pivotPoint, brushAngle, isEraserMode,
    erasedPieceIds, isMeasureMode, measureMode, currentVertexPoints, previewObstaclePoint,
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rawPos = getMousePos(e);

    // Bounds check: Hide tooltips and previews when mouse is outside canvas (plus 10px margin allowance)
    const el = canvasRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / scale;
      const rawY = (e.clientY - rect.top) / scale;
      const marginCm = 10 / scale;
      if (
        rawX < -marginCm ||
        rawX > surfaceWidth + marginCm ||
        rawY < -marginCm ||
        rawY > surfaceHeight + marginCm
      ) {
        setCursorCoords(null);
        if (!isDrawingObstacle) setPreviewObstaclePoint(null);
        setPreviewVertexPoint(null);
        return;
      }
    }

    if (isDrawingMeasureAreaRef.current && measureStartRef.current) {
      const s = measureStartRef.current;
      const snappedEnd = snapToVertex(rawPos, false, [], scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);
      const x = Math.min(snappedEnd.x, s.x), y = Math.min(snappedEnd.y, s.y);
      const w = Math.abs(snappedEnd.x - s.x), h = Math.abs(snappedEnd.y - s.y);
      if (previewAreaBoxRef.current) {
        previewAreaBoxRef.current.style.left = `${x * scale}px`;
        previewAreaBoxRef.current.style.top = `${y * scale}px`;
        previewAreaBoxRef.current.style.width = `${w * scale}px`;
        previewAreaBoxRef.current.style.height = `${h * scale}px`;
      }
      if (previewAreaTextRef.current) {
        previewAreaTextRef.current.textContent = `${(w / 100).toFixed(2)}m × ${(h / 100).toFixed(2)}m`;
      }
      setCursorCoords({ pos: { x: e.clientX, y: e.clientY }, display: { x: snappedEnd.x, y: surfaceHeight - snappedEnd.y } });
      return;
    }

    if (isDrawingObstacle) {
      let finalPt = snapToVertex(rawPos, true, currentObstaclePoints, scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);

      if (orthogonalLock && currentObstaclePoints.length > 0) {
        const lastPt = currentObstaclePoints[currentObstaclePoints.length - 1];
        const dist = Math.hypot(rawPos.x - lastPt.x, rawPos.y - lastPt.y);
        switch (orthogonalLock) {
          case 'up':
            finalPt = { x: lastPt.x, y: lastPt.y - dist };
            break;
          case 'down':
            finalPt = { x: lastPt.x, y: lastPt.y + dist };
            break;
          case 'left':
            finalPt = { x: lastPt.x - dist, y: lastPt.y };
            break;
          case 'right':
            finalPt = { x: lastPt.x + dist, y: lastPt.y };
            break;
        }
      } else if (currentObstaclePoints.length > 0 && e.shiftKey) {
        const lastPt = currentObstaclePoints[currentObstaclePoints.length - 1];
        const dx = finalPt.x - lastPt.x;
        const dy = finalPt.y - lastPt.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          finalPt = { x: finalPt.x, y: lastPt.y };
        } else {
          finalPt = { x: lastPt.x, y: finalPt.y };
        }
      }

      setPreviewObstaclePoint(finalPt);
      setCursorCoords({ pos: { x: e.clientX, y: e.clientY }, display: { x: finalPt.x, y: surfaceHeight - finalPt.y } });
      return;
    }

    if (isMeasureMode && (measureMode === 'vertex' || measureMode === 'distance')) {
      let snapped = snapToVertex(rawPos, true, currentVertexPoints, scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);
      if (currentVertexPoints.length > 0 && e.shiftKey) {
        const lastPt = currentVertexPoints[currentVertexPoints.length - 1];
        const dx = snapped.x - lastPt.x;
        const dy = snapped.y - lastPt.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          snapped = { x: snapped.x, y: lastPt.y };
        } else {
          snapped = { x: lastPt.x, y: snapped.y };
        }
      }
      setPreviewVertexPoint(snapped);
      setCursorCoords({ pos: { x: e.clientX, y: e.clientY }, display: { x: snapped.x, y: surfaceHeight - snapped.y } });
      return;
    }

    if (isMeasureMode && measureMode === 'area') {
      const snapped = snapToVertex(rawPos, false, [], scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive, handleCloseSnapChange);
      setCursorCoords({ pos: { x: e.clientX, y: e.clientY }, display: { x: snapped.x, y: surfaceHeight - snapped.y } });
      return;
    }

    if (isEraserMode) {
      const hit = getPieceUnderCursor(rawPos, pieces, erasedPieceIds);
      setHoveredPieceId(hit?.id ?? null);
      if (isErasingRef.current && hit && !pendingErasures.current.has(hit.id)) {
        pendingErasures.current.add(hit.id);
        setErasedPieceIds(prev => new Set([...prev, hit.id]));
      }
      return;
    }

    if (activeBrush && !isRotating) {
      let snapPos = { ...rawPos };
      if (isGridSnapActive && gridSpacing > 0) {
        snapPos.x = Math.round(snapPos.x / gridSpacing) * gridSpacing;
        snapPos.y = Math.round(snapPos.y / gridSpacing) * gridSpacing;
      }
      const rawCenter = computeGhostPos(snapPos, activeBrush, brushAngle, pivotPoint);

      if (isMouseDownRef.current && dragStartPos.current) {
        const dx = rawCenter.x - dragStartPos.current.x;
        const dy = rawCenter.y - dragStartPos.current.y;
        const dist = Math.hypot(dx, dy) * scale;
        if (!isSeriesPlacingRef.current && dist > DRAG_THRESHOLD_PX) isSeriesPlacingRef.current = true;

        if (isSeriesPlacingRef.current) {
          const rad = brushAngle * (Math.PI / 180);
          const cos = Math.cos(rad), sin = Math.sin(rad);
          const w = activeBrush.width, h = activeBrush.height;
          const axX = { x: cos, y: sin }, axY = { x: -sin, y: cos };
          const projX = dx * axX.x + dy * axX.y;
          const projY = dx * axY.x + dy * axY.y;
          const alongX = Math.abs(projX) > Math.abs(projY);
          const sv = alongX ? { x: w * cos, y: w * sin } : { x: h * -sin, y: h * cos };
          const dragD = Math.abs(alongX ? projX : projY);
          const dir = Math.sign(alongX ? projX : projY);
          const stepSz = Math.hypot(sv.x, sv.y);
          let n = stepSz > EPSILON ? Math.floor(dragD / stepSz) : 0;
          if (activeBrush.type === 'remnant') {
            n = Math.min(n, Math.max(0, activeBrush.count - 1));
          }
          const ghosts: Point[] = [dragStartPos.current];
          for (let i = 1; i <= n; i++) {
            ghosts.push({ x: dragStartPos.current.x + i * sv.x * dir, y: dragStartPos.current.y + i * sv.y * dir });
          }
          seriesGhostPiecesRef.current = ghosts;
          setSeriesGhostPieces(ghosts);
          setGhostPiecePos(null);
        }
      } else {
        let snappedCenter = calculateGhostSnap(rawCenter, activeBrush, brushAngle, scale, pieces, obstacles, surfaceWidth, surfaceHeight, isObstacleSnapActive && !isGridSnapActive);
        setGhostPiecePos(snappedCenter);
      }
    } else {
      if (ghostPiecePos) setGhostPiecePos(null);
    }
  }, [
    getMousePos, isDrawingObstacle, currentObstaclePoints, scale, pieces, obstacles, surfaceWidth, isObstacleSnapActive, handleCloseSnapChange,
    surfaceHeight, orthogonalLock, isMeasureMode, measureMode, currentVertexPoints, isEraserMode,
    erasedPieceIds, activeBrush, isRotating, pivotPoint, brushAngle, ghostPiecePos,
  ]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPieceId(null);
    setCursorCoords(null);
    if (!isDrawingObstacle) setPreviewObstaclePoint(null);
    if (!isDrawingMeasureAreaRef.current) setGhostPiecePos(null);
    if (currentVertexPoints.length === 0) setPreviewVertexPoint(null);
  }, [isDrawingObstacle, currentVertexPoints.length]);

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
    clearVertexMeasurements: () => { 
      setSavedVertexFigures([]);
      setVertexMeasurements([]); 
      setCurrentVertexPoints([]); 
      setPreviewVertexPoint(null); 
      setHiddenVertexFigureIds([]);
    },
    undoVertexMeasurement: () => {
      if (currentVertexPoints.length > 0) {
        setCurrentVertexPoints(prev => prev.slice(0, -1));
        setVertexMeasurements(prev => prev.slice(0, -1));
      }
    },
    clearAreaMeasurements: () => {
      setSavedAreaMeasurements([]);
      setHiddenAreaIds([]);
    },
    isPanningRef,
    showAreaMeasurements,
    showVertexMeasurements,
    hiddenAreaIds,
    hiddenVertexFigureIds,
    toggleAreaMeasurements: () => setShowAreaMeasurements(prev => !prev),
    toggleVertexMeasurements: () => setShowVertexMeasurements(prev => !prev),
    toggleAreaVisibility: (id: string) => setHiddenAreaIds(prev => prev.includes(id) ? prev.filter(hid => hid !== id) : [...prev, id]),
    toggleVertexFigureVisibility: (id: string) => setHiddenVertexFigureIds(prev => prev.includes(id) ? prev.filter(hid => hid !== id) : [...prev, id]),
    deleteAreaMeasurement: (id: string) => setSavedAreaMeasurements(prev => prev.filter(m => m.id !== id)),
    deleteVertexFigure: (id: string) => setSavedVertexFigures(prev => prev.filter(f => f.id !== id)),
  };
}
