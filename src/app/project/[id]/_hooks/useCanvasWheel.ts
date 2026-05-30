import { useEffect } from 'react';
import type { Brush } from '@/lib/types';

interface UseCanvasWheelProps {
  viewportRef: React.RefObject<HTMLDivElement>;
  activeBrush: Brush | null;
  isDrawingObstacle: boolean;
  previewSegment: { length: number; angle: number } | null;
  onPreviewChange: (data: { length: number; angle: number } | null) => void;
  brushAngle?: number;
  onBrushAngleChange?: (angle: number) => void;
}

export function useCanvasWheel({
  viewportRef,
  activeBrush,
  isDrawingObstacle,
  previewSegment,
  onPreviewChange,
  brushAngle = 0,
  onBrushAngleChange,
}: UseCanvasWheelProps) {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (activeBrush && !e.ctrlKey && !e.metaKey && onBrushAngleChange) {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        const step = e.altKey ? 15 : 1;
        let nextAngle = brushAngle + (step * dir);
        if (e.altKey && nextAngle % 15 !== 0) {
            nextAngle = dir > 0 ? Math.ceil(nextAngle / 15) * 15 : Math.floor(nextAngle / 15) * 15;
        }
        onBrushAngleChange((nextAngle + 360) % 360);
        return;
      }
      if (isDrawingObstacle && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const dir = e.deltaY > 0 ? -1 : 1;
        const step = e.altKey ? 15 : 5;
        const cur = previewSegment?.angle ?? 0;
        onPreviewChange({ length: previewSegment?.length ?? 50, angle: (cur + step * dir + 360) % 360 });
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const dir = e.deltaY > 0 ? -1 : 1;
        // We communicate intent via custom event handleZoomMove
        viewport.dispatchEvent(new CustomEvent('canvas:zoom', {
          detail: { dir, mouseX, mouseY },
          bubbles: false,
        }));
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [viewportRef, activeBrush, isDrawingObstacle, previewSegment, onPreviewChange, brushAngle, onBrushAngleChange]);
}
