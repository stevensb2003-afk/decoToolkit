import { useCallback } from 'react';
import type { Point, PlacedPiece, Brush, Obstacle, VertexFigure, VertexMeasurement } from '@/lib/types';
import { snapToVertex, getPieceUnderCursor, computeGhostPos, calculateGhostSnap } from '../../_utils/canvas-helpers';
import { v4 as uuidv4 } from 'uuid';

const DRAG_THRESHOLD_PX = 8;
const EPSILON = 1e-9;

interface UseCanvasMouseEventsProps {
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
  isGridSnapActive: boolean;
  gridSpacing: number;
  canvasRef: React.RefObject<HTMLDivElement>;

  onCurrentObstaclePointsChange: (pts: Point[]) => void;
  onObstacleAnchorIndexChange: (idx: number) => void;

  isPanningRef: React.MutableRefObject<boolean>;
  lastPanPos: React.MutableRefObject<{ x: number; y: number } | null>;
  isMouseDownRef: React.MutableRefObject<boolean>;
  dragStartPos: React.MutableRefObject<Point | null>;
  isErasingRef: React.MutableRefObject<boolean>;
  pendingErasures: React.MutableRefObject<Set<string>>;
  isDrawingMeasureAreaRef: React.MutableRefObject<boolean>;
  measureStartRef: React.MutableRefObject<Point | null>;
  isSeriesPlacingRef: React.MutableRefObject<boolean>;
  seriesGhostPiecesRef: React.MutableRefObject<Point[]>;
  isClosedSnapRef: React.MutableRefObject<boolean>;

  setHoveredPieceId: (id: string | null) => void;
  setErasedPieceIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  erasedPieceIds: Set<string>;

  previewAreaBoxRef: React.RefObject<HTMLDivElement>;
  previewAreaTextRef: React.RefObject<HTMLSpanElement>;

  currentVertexPoints: Point[];
  setCurrentVertexPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  setSavedVertexFigures: React.Dispatch<React.SetStateAction<VertexFigure[]>>;
  setVertexMeasurements: React.Dispatch<React.SetStateAction<VertexMeasurement[]>>;
  setPreviewVertexPoint: (pt: Point | null) => void;

  setPreviewObstaclePoint: (pt: Point | null) => void;
  setCursorCoords: (coords: { pos: { x: number; y: number }; display: Point } | null) => void;

  orthogonalLock: 'up' | 'down' | 'left' | 'right' | null;

  setGhostPiecePos: (pt: Point | null) => void;
  setSeriesGhostPieces: (pts: Point[]) => void;
  ghostPiecePos: Point | null;

  handleCloseSnapChange: (isClose: boolean) => void;
  getMousePos: (e: MouseEvent | React.MouseEvent<HTMLDivElement>) => Point;
}

export function useCanvasMouseEvents(opts: UseCanvasMouseEventsProps) {
  const {
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
  } = opts;

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
      }
      return;
    }

    if (activeBrush && !isRotating) {
      if (isMouseDownRef.current) return;
      isMouseDownRef.current = true;
      let snapPos = { ...pos };
      if (isGridSnapActive && gridSpacing > 0) {
        snapPos.x = Math.round(snapPos.x / gridSpacing) * gridSpacing;
        // Medir snap vertical desde la base inferior
        const distFromBottom = surfaceHeight - snapPos.y;
        const snappedDist = Math.round(distFromBottom / gridSpacing) * gridSpacing;
        snapPos.y = surfaceHeight - snappedDist;
      }
      const center = computeGhostPos(snapPos, activeBrush, brushAngle, pivotPoint);
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
      const el = canvasRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / scale;
        const rawY = (e.clientY - rect.top) / scale;
        const marginCm = 10 / scale;
        if (rawX < -marginCm || rawX > surfaceWidth + marginCm || rawY < -marginCm || rawY > surfaceHeight + marginCm) {
          return;
        }
      }

      if (measureMode === 'area') {
        if (isDrawingMeasureAreaRef.current) return;
        isMouseDownRef.current = true;
        isDrawingMeasureAreaRef.current = true;
        
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
    activeBrush, isRotating, pivotPoint, brushAngle, isEraserMode,
    erasedPieceIds, isMeasureMode, measureMode, currentVertexPoints, isGridSnapActive, gridSpacing,
    canvasRef, isPanningRef, lastPanPos, isMouseDownRef, dragStartPos, isErasingRef, pendingErasures, setErasedPieceIds, isDrawingMeasureAreaRef, measureStartRef, previewAreaBoxRef, isClosedSnapRef, setSavedVertexFigures, setVertexMeasurements, setCurrentVertexPoints, setPreviewVertexPoint
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rawPos = getMousePos(e);

    const el = canvasRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / scale;
      const rawY = (e.clientY - rect.top) / scale;
      const marginCm = 10 / scale;
      if (rawX < -marginCm || rawX > surfaceWidth + marginCm || rawY < -marginCm || rawY > surfaceHeight + marginCm) {
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
          case 'up': finalPt = { x: lastPt.x, y: lastPt.y - dist }; break;
          case 'down': finalPt = { x: lastPt.x, y: lastPt.y + dist }; break;
          case 'left': finalPt = { x: lastPt.x - dist, y: lastPt.y }; break;
          case 'right': finalPt = { x: lastPt.x + dist, y: lastPt.y }; break;
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
        // Medir snap vertical desde la base inferior
        const distFromBottom = surfaceHeight - snapPos.y;
        const snappedDist = Math.round(distFromBottom / gridSpacing) * gridSpacing;
        snapPos.y = surfaceHeight - snappedDist;
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
    getMousePos, canvasRef, scale, surfaceWidth, surfaceHeight, isDrawingObstacle, setPreviewObstaclePoint, setPreviewVertexPoint, isDrawingMeasureAreaRef, measureStartRef, pieces, obstacles, isObstacleSnapActive, handleCloseSnapChange, previewAreaBoxRef, previewAreaTextRef, setCursorCoords, currentObstaclePoints, orthogonalLock, isMeasureMode, measureMode, currentVertexPoints, isEraserMode, erasedPieceIds, setHoveredPieceId, isErasingRef, pendingErasures, setErasedPieceIds, activeBrush, isRotating, isGridSnapActive, gridSpacing, brushAngle, pivotPoint, isMouseDownRef, dragStartPos, isSeriesPlacingRef, seriesGhostPiecesRef, setSeriesGhostPieces, setGhostPiecePos, ghostPiecePos
  ]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPieceId(null);
    setCursorCoords(null);
    if (!isDrawingObstacle) setPreviewObstaclePoint(null);
    if (!isDrawingMeasureAreaRef.current) setGhostPiecePos(null);
    if (currentVertexPoints.length === 0) setPreviewVertexPoint(null);
  }, [isDrawingObstacle, currentVertexPoints.length, setHoveredPieceId, setCursorCoords, setPreviewObstaclePoint, isDrawingMeasureAreaRef, setGhostPiecePos, setPreviewVertexPoint]);

  return { handleMouseDown, handleMouseMove, handleMouseLeave };
}
