import { useEffect } from 'react';
import type { Point } from '@/lib/types';

interface UseCanvasShortcutsProps {
  isDrawingObstacle: boolean;
  currentObstaclePoints: Point[];
  previewObstaclePoint: Point | null;
  onCurrentObstaclePointsChange: (pts: Point[]) => void;
  onObstacleAnchorIndexChange: (idx: number) => void;
  onFinishObstacleDrawing: (closeLoop: boolean) => void;
  isMeasureMode: boolean;
  measureMode: string;
  currentVertexPoints: Point[];
  setCurrentVertexPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  setVertexMeasurements: React.Dispatch<React.SetStateAction<any[]>>;
  setPreviewVertexPoint: React.Dispatch<React.SetStateAction<Point | null>>;
  isDrawingMeasureAreaRef: React.MutableRefObject<boolean>;
  previewAreaBoxRef: React.RefObject<HTMLDivElement>;
  setOrthogonalLock: React.Dispatch<React.SetStateAction<'up' | 'down' | 'left' | 'right' | null>>;
}

export function useCanvasShortcuts({
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
}: UseCanvasShortcutsProps) {
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
    setCurrentVertexPoints,
    setVertexMeasurements,
    setPreviewVertexPoint,
    isDrawingMeasureAreaRef,
    previewAreaBoxRef,
    setOrthogonalLock,
  ]);

  // Reset direction lock when drawing is finished or cleared entirely
  useEffect(() => {
    if (!isDrawingObstacle || currentObstaclePoints.length === 0) {
      setOrthogonalLock(null);
    }
  }, [isDrawingObstacle, currentObstaclePoints.length, setOrthogonalLock]);
}
