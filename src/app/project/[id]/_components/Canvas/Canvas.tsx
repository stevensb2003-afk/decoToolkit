'use client';

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import type {
  Surface, PlacedPiece, Obstacle, Project, Point, Brush, MeasureMode,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { GridOverlay } from './GridOverlay';
import { ObstaclesOverlay } from './ObstaclesOverlay';
import { PiecesOverlay } from './PiecesOverlay';
import { MeasurementsOverlay } from './MeasurementsOverlay';
import { useCanvasEvents } from '../../_hooks/useCanvasEvents';
import { UnifiedMeasurementPanel } from '@/components/unified-measurement-panel';

interface CanvasProps {
  surface: Surface;
  pieces: PlacedPiece[];
  obstacles: Obstacle[];
  project: Project;
  editorScale: number;
  activeBrush: Brush | null;
  brushAngle: number;
  onBrushAngleChange?: (angle: number) => void;
  pivotPoint: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  isFillMode: boolean;
  isObstacleSnapActive: boolean;
  isDragLockActive: boolean;
  isEraserMode: boolean;
  isMeasureMode: boolean;
  measureMode: MeasureMode;
  isHandMode: boolean;
  isRotating: boolean;
  transformContainerRef: React.RefObject<HTMLDivElement>;
  handlePanMove: (dx: number, dy: number) => void;
  handleZoomMove: (newZoom: number, mouseX?: number, mouseY?: number) => void;
  commitPanZoom: () => void;
  viewZoom: number;
  showGrid: boolean;
  gridSpacing: number;
  isGridSnapActive: boolean;
  isDrawingObstacle: boolean;
  editingObstacleId: string | null;
  currentObstaclePoints: Point[];
  onCurrentObstaclePointsChange: (pts: Point[]) => void;
  obstacleAnchorIndex: number;
  onObstacleAnchorIndexChange: (idx: number) => void;
  onFinishDrawingObstacle: () => void;
  onPlacePiece: (positions: Point[]) => void;
  onDeletePiece: (pieceId: string) => void;
  onBatchDeletePieces: (pieceIds: string[]) => void;
  onClientStateChange?: (updater: (cs: any) => any) => void;
  rotationAnchor: Point | null;
  onRotationAnchorChange: (p: Point | null) => void;
  onToolSelect: (tool: 'brush' | 'eraser' | 'measure' | 'hand', measureMode?: MeasureMode) => void;
  isPivotSelectorOpen: boolean;
  onPivotSelectorOpenChange: (open: boolean) => void;
  isMeasureToolOpen: boolean;
  onMeasureToolOpenChange: (open: boolean) => void;
  previewSegment: { length: number; angle: number } | null;
  onPreviewChange: (data: { length: number; angle: number } | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  viewportRef: React.RefObject<HTMLDivElement>;
}

const SNAP_THRESHOLD_PX = 10;

export function Canvas({
  surface, pieces, obstacles, project, editorScale,
  activeBrush, brushAngle, onBrushAngleChange, pivotPoint, isFillMode, isObstacleSnapActive,
  isDragLockActive, isEraserMode, isMeasureMode, measureMode, isHandMode, isRotating,
  transformContainerRef, handlePanMove, handleZoomMove, commitPanZoom, viewZoom,
  showGrid, gridSpacing, isGridSnapActive,
  isDrawingObstacle, editingObstacleId, currentObstaclePoints, onCurrentObstaclePointsChange,
  obstacleAnchorIndex, onObstacleAnchorIndexChange, onFinishDrawingObstacle,
  onPlacePiece, onDeletePiece, onBatchDeletePieces, onClientStateChange,
  rotationAnchor, onRotationAnchorChange, onToolSelect,
  previewSegment, onPreviewChange, onUndo, onRedo, viewportRef,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const currentZoomRef = useRef(viewZoom);

  // Keep zoom ref in sync
  useEffect(() => { currentZoomRef.current = viewZoom; }, [viewZoom]);

  // Scale: computed from surface dimensions + zoom
  const scale = useMemo(() => {
    const vp = viewportRef.current;
    if (!vp || surface.width <= 0 || surface.height <= 0) return editorScale;
    const safeW = vp.clientWidth - 80;
    const safeH = vp.clientHeight - 80;
    return Math.max(Math.min(safeW / surface.width, safeH / surface.height) * viewZoom, 0.1);
  }, [viewportRef, surface.width, surface.height, viewZoom, editorScale]);

  const events = useCanvasEvents({
    scale, isHandMode, isEraserMode, isMeasureMode, measureMode,
    isDrawingObstacle, editingObstacleId,
    activeBrush, brushAngle, pivotPoint, isObstacleSnapActive, isRotating,
    pieces, obstacles, surfaceWidth: surface.width, surfaceHeight: surface.height,
    currentObstaclePoints, isCloseSnap: false,
    canvasRef, handlePanMove, handleZoomMove, commitPanZoom,
    onPlacePiece, onBatchDeletePieces,
    onCurrentObstaclePointsChange, onObstacleAnchorIndexChange,
    onFinishObstacleDrawing: (closeLoop) => onFinishDrawingObstacle(),
    onRotationAnchorChange, onPreviewChange,
    viewportRef,
    previewSegment,
    obstacleAnchorIndex,
    onBrushAngleChange,
    isGridSnapActive,
    gridSpacing,
  });

  // Zoom via canvas:zoom custom event
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onZoom = (e: Event) => {
      const { dir, mouseX, mouseY } = (e as CustomEvent).detail;
      const cur = currentZoomRef.current;
      const next = Math.max(0.1, Math.min(5, parseFloat((cur + 0.1 * dir).toFixed(1))));
      handleZoomMove(next, mouseX, mouseY);
      commitPanZoom();
    };
    vp.addEventListener('canvas:zoom', onZoom);
    return () => vp.removeEventListener('canvas:zoom', onZoom);
  }, [viewportRef, handleZoomMove, commitPanZoom]);

  const getCursor = () => {
    if (isRotating) return 'crosshair';
    if (isDrawingObstacle) return 'crosshair';
    if (isMeasureMode) return 'crosshair';
    if (isEraserMode) return 'cell';
    if (isHandMode || events.isPanningRef.current) return events.isPanningRef.current ? 'grabbing' : 'grab';
    if (activeBrush) return 'crosshair';
    return 'default';
  };

  // Ghost piece path (rotated and translated perfectly in canvas coordinates)
  const GhostPiecePath = useMemo(() => {
    if (!events.ghostPiecePos || !activeBrush) return null;

    const angleRad = brushAngle * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const centerX = events.ghostPiecePos.x;
    const centerY = events.ghostPiecePos.y;

    const pivotLocalMap = {
      topLeft: { x: -activeBrush.width / 2, y: -activeBrush.height / 2 },
      topRight: { x: activeBrush.width / 2, y: -activeBrush.height / 2 },
      bottomLeft: { x: -activeBrush.width / 2, y: activeBrush.height / 2 },
      bottomRight: { x: activeBrush.width / 2, y: activeBrush.height / 2 },
    };
    const pv = pivotLocalMap[pivotPoint];
    const rpx = pv.x * cos - pv.y * sin;
    const rpy = pv.x * sin + pv.y * cos;

    // The active position of the piece center is directly centerX and centerY (which already includes the pivot snap offset)
    const finalCenterX = centerX;
    const finalCenterY = centerY;

    let paths: Point[][] = [];

    if (activeBrush.type === 'remnant') {
      const frags = activeBrush.fragments || [{ id: 'legacy', points: activeBrush.points || [] }];
      frags.forEach(f => {
        const path = f.points.map(p => {
          const tx = p.x - activeBrush.x;
          const ty = p.y - activeBrush.y;
          const rx = tx * cos - ty * sin;
          const ry = tx * sin + ty * cos;
          return {
            x: (finalCenterX + rx) * scale,
            y: (finalCenterY + ry) * scale,
          };
        });
        paths.push(path);
      });
    } else {
      const w = activeBrush.width;
      const h = activeBrush.height;
      const corners = [
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 },
      ];
      const path = corners.map(corner => {
        const rx = corner.x * cos - corner.y * sin;
        const ry = corner.x * sin + corner.y * cos;
        return {
          x: (finalCenterX + rx) * scale,
          y: (finalCenterY + ry) * scale,
        };
      });
      paths.push(path);
    }

    return paths.map(path =>
      path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    ).join(' ');
  }, [events.ghostPiecePos, activeBrush, scale, brushAngle, pivotPoint]);

  // Angle tooltip (HTML absolute overlay positioned at the cursor)
  const GhostPieceTooltip = useMemo(() => {
    if (!events.ghostPiecePos) return null;
    const cursorX = events.ghostPiecePos.x * scale;
    const cursorY = events.ghostPiecePos.y * scale;
    return (
      <div style={{
        position: 'absolute', left: cursorX + 15, top: cursorY + 15,
        backgroundColor: 'rgba(0,0,0,0.75)', color: 'white', padding: '3px 6px',
        borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
        pointerEvents: 'none', zIndex: 11,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        whiteSpace: 'nowrap'
      }}>
        {brushAngle}°
      </div>
    );
  }, [events.ghostPiecePos, scale, brushAngle]);

  // Series ghosts path (for drag-placement)
  const SeriesGhostsPath = useMemo(() => {
    if (!events.seriesGhostPieces.length || !activeBrush) return null;

    const angleRad = brushAngle * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const allPaths: string[] = [];

    events.seriesGhostPieces.forEach(pos => {
      const centerX = pos.x;
      const centerY = pos.y;
      let paths: Point[][] = [];

      if (activeBrush.type === 'remnant') {
        const frags = activeBrush.fragments || [{ id: 'legacy', points: activeBrush.points || [] }];
        frags.forEach(f => {
          const path = f.points.map(p => {
            const tx = p.x - activeBrush.x;
            const ty = p.y - activeBrush.y;
            const rx = tx * cos - ty * sin;
            const ry = tx * sin + ty * cos;
            return {
              x: (centerX + rx) * scale,
              y: (centerY + ry) * scale,
            };
          });
          paths.push(path);
        });
      } else {
        const w = activeBrush.width;
        const h = activeBrush.height;
        const corners = [
          { x: -w / 2, y: -h / 2 },
          { x: w / 2, y: -h / 2 },
          { x: w / 2, y: h / 2 },
          { x: -w / 2, y: h / 2 },
        ];
        const path = corners.map(corner => {
          const rx = corner.x * cos - corner.y * sin;
          const ry = corner.x * sin + corner.y * cos;
          return {
            x: (centerX + rx) * scale,
            y: (centerY + ry) * scale,
          };
        });
        paths.push(path);
      }

      const d = paths.map(path =>
        path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
      ).join(' ');
      allPaths.push(d);
    });

    return allPaths.join(' ');
  }, [events.seriesGhostPieces, activeBrush, scale, brushAngle]);

  const svgW = surface.width * scale;
  const svgH = surface.height * scale;

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      style={{ cursor: getCursor() }}
      onMouseMove={events.handleMouseMove}
      onMouseLeave={events.handleMouseLeave}
      onMouseDown={events.handleMouseDown}
    >
      {/* Measurement panel */}
      {(events.savedAreaMeasurements.length > 0 || events.vertexMeasurements.length > 0 || events.currentVertexPoints.length > 0 || events.savedVertexFigures.length > 0) && (
        <UnifiedMeasurementPanel
          areaMeasurements={events.savedAreaMeasurements}
          vertexMeasurements={events.vertexMeasurements}
          savedVertexFigures={events.savedVertexFigures}
          onClearArea={events.clearAreaMeasurements}
          onClearVertex={events.clearVertexMeasurements}
          onUndoVertex={() => {
            if (events.undoVertexMeasurement) {
                events.undoVertexMeasurement();
            }
          }}
          canUndoVertex={events.vertexMeasurements.length > 0 || events.currentVertexPoints.length > 0}
          showAreaMeasurements={events.showAreaMeasurements}
          showVertexMeasurements={events.showVertexMeasurements}
          onToggleAreaVisibility={events.toggleAreaMeasurements}
          onToggleVertexVisibility={events.toggleVertexMeasurements}
          hiddenAreaIds={events.hiddenAreaIds}
          hiddenVertexFigureIds={events.hiddenVertexFigureIds}
          onToggleAreaItemVisibility={events.toggleAreaVisibility}
          onToggleVertexFigureItemVisibility={events.toggleVertexFigureVisibility}
          onDeleteAreaItem={events.deleteAreaMeasurement}
          onDeleteVertexFigureItem={events.deleteVertexFigure}
        />
      )}

      {/* Cursor coords tooltip */}
      {events.cursorCoords && (
        <div
          className="fixed z-50 pointer-events-none rounded-md bg-gray-900/80 px-2 py-1 text-xs font-mono text-white shadow-lg -translate-x-full -translate-y-full"
          style={{ left: events.cursorCoords.pos.x - 10, top: events.cursorCoords.pos.y - 10 }}
        >
          X: {(events.cursorCoords.display.x / 100).toFixed(2)}m, Y: {(events.cursorCoords.display.y / 100).toFixed(2)}m
        </div>
      )}

      {/* Transform container — pan/zoom applied here via CSS */}
      <div
        ref={transformContainerRef}
        className="absolute"
        style={{ top: '50%', left: '50%', transformOrigin: '0 0' }}
      >
        {/* Surface */}
        <div
          ref={canvasRef}
          className="relative bg-muted shadow-inner border-2 border-dashed"
          style={{ width: svgW, height: svgH, transform: 'translate(-50%, -50%)' }}
        >
          {/* Ghost piece tooltip */}
          {activeBrush && GhostPieceTooltip}

          {/* Area measurement preview DOM element */}
          <div
            ref={events.previewAreaBoxRef}
            className="absolute border-2 border-dashed border-green-600 pointer-events-none z-10 hidden items-center justify-center bg-green-600/10"
          >
            <span ref={events.previewAreaTextRef} className="bg-white/80 px-1 py-0.5 rounded text-[10px] font-mono text-green-800 shadow-sm" />
          </div>

          {/* SVG layers */}
          <svg
            width={svgW}
            height={svgH}
            className="absolute top-0 left-0"
            style={{ overflow: 'visible' }}
          >
            {/* Pieces */}
            <PiecesOverlay
              pieces={pieces}
              materials={project.materials}
              editorScale={scale}
              isEraserMode={isEraserMode}
              onDeletePiece={onDeletePiece}
              erasedPieceIds={events.erasedPieceIds}
              hoveredPieceId={events.hoveredPieceId}
            />

            {/* Ghost Piece SVG Preview */}
            {activeBrush && GhostPiecePath && (
              <path
                d={GhostPiecePath}
                fill="rgba(0, 120, 255, 0.25)"
                stroke="rgba(0, 120, 255, 0.75)"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillRule="evenodd"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Series Ghosts SVG Preview */}
            {activeBrush && SeriesGhostsPath && (
              <path
                d={SeriesGhostsPath}
                fill="rgba(0, 120, 255, 0.12)"
                stroke="rgba(0, 120, 255, 0.45)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                fillRule="evenodd"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Grid */}
            {showGrid && (
              <g className="pointer-events-none">
                <GridOverlay surface={surface} spacing={gridSpacing} editorScale={scale} />
              </g>
            )}

            {/* Obstacles */}
            <ObstaclesOverlay
              obstacles={obstacles}
              editorScale={scale}
              isDrawingObstacle={isDrawingObstacle}
              currentObstaclePoints={currentObstaclePoints}
              obstacleAnchorIndex={obstacleAnchorIndex}
              onObstacleAnchorIndexChange={onObstacleAnchorIndexChange}
              surfaceWidth={surface.width}
              surfaceHeight={surface.height}
              previewObstaclePoint={events.previewObstaclePoint}
              previewSegment={previewSegment}
              editingObstacleId={editingObstacleId}
            />

            {/* Measurements */}
            <MeasurementsOverlay
              isMeasureMode={isMeasureMode}
              measureMode={measureMode}
              surface={surface}
              pieces={pieces}
              editorScale={scale}
              onPreviewChange={onPreviewChange}
              currentVertexMeasurePoints={events.currentVertexPoints}
              previewVertexMeasurePoint={events.previewVertexPoint}
              vertexMeasurements={events.showVertexMeasurements ? events.vertexMeasurements : []}
              savedVertexFigures={events.showVertexMeasurements ? events.savedVertexFigures.filter(f => !events.hiddenVertexFigureIds.includes(f.id)) : []}
              measurements={events.showAreaMeasurements ? events.savedAreaMeasurements.filter(m => !events.hiddenAreaIds.includes(m.id)) : []}
              isCloseSnap={events.isCloseSnap}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
