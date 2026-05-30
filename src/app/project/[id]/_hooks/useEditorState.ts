import { useState, useCallback, useRef, useEffect } from 'react';
import type { Brush, MeasureMode, Point } from '@/lib/types';

export type PivotPoint = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export function useEditorState() {
  const [activeSurfaceId, setActiveSurfaceId] = useState<string | null>(null);
  const [editorScale, setEditorScale] = useState(100);
  const [activeBrush, setActiveBrush] = useState<Brush | null>(null);
  const [pivotPoint, setPivotPoint] = useState<PivotPoint>('topLeft');
  
  const [isFillMode, setIsFillMode] = useState(false);
  const [isObstacleSnapActive, setIsObstacleSnapActive] = useState(false);
  const [isDragLockActive, setIsDragLockActive] = useState(false);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measureMode, setMeasureMode] = useState<MeasureMode>('area');
  
  const [isRotating, setIsRotating] = useState(false);
  const [brushAngle, setBrushAngle] = useState(0);
  const [isHandMode, setIsHandMode] = useState(false);
  
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [isRepeating, setIsRepeating] = useState(false);
  const [summaryViewMode, setSummaryViewMode] = useState<'surface' | 'project'>('surface');
  
  const [showGrid, setShowGrid] = useState(false);
  const [gridSpacing, setGridSpacing] = useState(10);
  const [isGridSnapActive, setIsGridSnapActive] = useState(false);

  // Decoupled pan/zoom state for instant DOM updates without triggering React renders on every frame
  const panZoomRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const transformContainerRef = useRef<HTMLDivElement>(null);

  // Sync ref with React state if state is changed externally (e.g. keyboard shortcut or reset button)
  useEffect(() => {
    panZoomRef.current = { zoom: viewZoom, pan: viewPan };
    applyTransform();
  }, [viewZoom, viewPan]);

  const applyTransform = useCallback(() => {
    if (transformContainerRef.current) {
      const { zoom, pan } = panZoomRef.current;
      transformContainerRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    }
  }, []);

  const handlePanMove = useCallback((dx: number, dy: number) => {
    panZoomRef.current.pan.x += dx;
    panZoomRef.current.pan.y += dy;
    applyTransform();
  }, [applyTransform]);

  const handleZoomMove = useCallback((newZoom: number, mouseX?: number, mouseY?: number) => {
    if (mouseX !== undefined && mouseY !== undefined) {
      const { zoom: oldZoom, pan } = panZoomRef.current;
      const zoomFactor = newZoom / oldZoom;
      panZoomRef.current.pan = {
        x: mouseX - (mouseX - pan.x) * zoomFactor,
        y: mouseY - (mouseY - pan.y) * zoomFactor,
      };
    }
    panZoomRef.current.zoom = newZoom;
    applyTransform();
  }, [applyTransform]);

  const commitPanZoom = useCallback(() => {
    setViewZoom(panZoomRef.current.zoom);
    setViewPan({ ...panZoomRef.current.pan });
  }, []);

  const handleToolSelect = useCallback((tool: 'brush' | 'eraser' | 'measure' | 'hand', selectedMeasureMode?: MeasureMode) => {
    setActiveBrush(tool === 'brush' ? activeBrush : null);
    setIsEraserMode(tool === 'eraser');
    setIsMeasureMode(tool === 'measure');
    if (selectedMeasureMode) setMeasureMode(selectedMeasureMode);
    setIsHandMode(tool === 'hand');
  }, [activeBrush]);

  const handleSetActiveBrush = useCallback((brush: Brush) => {
    if (activeBrush?.type === brush.type) {
      if (brush.type === 'material' && activeBrush.id === brush.id) {
         setActiveBrush(null);
         setIsEraserMode(false);
         setIsMeasureMode(false);
         return;
      }
      if (brush.type === 'remnant' && activeBrush.type === 'remnant' && activeBrush.shapeId === brush.shapeId) {
         setActiveBrush(null);
         setIsEraserMode(false);
         setIsMeasureMode(false);
         return;
      }
    }
    setActiveBrush(brush);
    setIsEraserMode(false);
    setIsMeasureMode(false);
    setBrushAngle(0);
  }, [activeBrush]);

  return {
    activeSurfaceId, setActiveSurfaceId,
    editorScale, setEditorScale,
    activeBrush, setActiveBrush, handleSetActiveBrush,
    pivotPoint, setPivotPoint,
    isGridSnapActive, setIsGridSnapActive,
    isFillMode, setIsFillMode,
    isObstacleSnapActive, setIsObstacleSnapActive,
    isDragLockActive, setIsDragLockActive,
    isEraserMode, setIsEraserMode,
    isMeasureMode, setIsMeasureMode,
    measureMode, setMeasureMode,
    isRotating, setIsRotating,
    brushAngle, setBrushAngle,
    isHandMode, setIsHandMode,
    viewZoom, setViewZoom,
    viewPan, setViewPan,
    isRepeating, setIsRepeating,
    summaryViewMode, setSummaryViewMode,
    showGrid, setShowGrid,
    gridSpacing, setGridSpacing,
    
    // Action Handlers
    handleToolSelect,
    
    // Decoupled Transform Handlers
    transformContainerRef,
    handlePanMove,
    handleZoomMove,
    commitPanZoom,
  };
}
