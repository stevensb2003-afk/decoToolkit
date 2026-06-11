import { useEffect, useRef } from 'react';
import type { Brush } from '@/lib/types';

// How long (ms) to suppress non-Alt wheel events after an Alt-rotation gesture.
// Covers trackpad momentum/inertia events that fire after the user releases Alt.
const ALT_ROTATION_COOLDOWN_MS = 300;

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
  // Timestamp of the last Alt+wheel rotation event.
  // Non-Alt events arriving within ALT_ROTATION_COOLDOWN_MS are ignored
  // to prevent trackpad momentum from drifting the angle after releasing Alt.
  const lastAltWheelTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const resetTimeoutRef = useRef<number | null>(null);
  const lastAltStateRef = useRef<boolean>(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (activeBrush && !e.ctrlKey && !e.metaKey && onBrushAngleChange) {
        e.preventDefault();

        // Normalize deltaY depending on deltaMode (lines, pages, or pixels)
        let dy = e.deltaY;
        if (e.deltaMode === 1) {
          dy *= 40; // DOM_DELTA_LINE
        } else if (e.deltaMode === 2) {
          dy *= 800; // DOM_DELTA_PAGE
        }

        // Debounce to reset accumulator after 150ms of inactivity
        if (resetTimeoutRef.current) {
          window.clearTimeout(resetTimeoutRef.current);
        }
        resetTimeoutRef.current = window.setTimeout(() => {
          accumulatorRef.current = 0;
        }, 150) as unknown as number;

        // Reset accumulator if Alt state toggles to avoid carrying over deltas
        const isAlt = e.altKey;
        if (isAlt !== lastAltStateRef.current) {
          accumulatorRef.current = 0;
          lastAltStateRef.current = isAlt;
        }

        accumulatorRef.current += dy;

        if (isAlt) {
          lastAltWheelTimeRef.current = Date.now();
          const threshold = 80; // Threshold pixels for 15-degree step

          if (Math.abs(accumulatorRef.current) >= threshold) {
            const steps = Math.floor(Math.abs(accumulatorRef.current) / threshold);
            const dir = accumulatorRef.current > 0 ? 1 : -1;
            accumulatorRef.current = accumulatorRef.current % threshold;

            const snappedCurrent = Math.round(brushAngle / 15) * 15;
            const nextAngle = snappedCurrent + steps * 15 * dir;
            onBrushAngleChange(((nextAngle % 360) + 360) % 360);
          }
        } else {
          // Plain scroll (no Alt): block momentum events that trail an Alt gesture.
          const msSinceAlt = Date.now() - lastAltWheelTimeRef.current;
          if (msSinceAlt < ALT_ROTATION_COOLDOWN_MS) return;

          const threshold = 15; // Threshold pixels for 1-degree step
          if (Math.abs(accumulatorRef.current) >= threshold) {
            const steps = Math.floor(Math.abs(accumulatorRef.current) / threshold);
            const dir = accumulatorRef.current > 0 ? 1 : -1;
            accumulatorRef.current = accumulatorRef.current % threshold;

            const nextAngle = brushAngle + steps * dir;
            onBrushAngleChange(((nextAngle % 360) + 360) % 360);
          }
        }
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
        viewport.dispatchEvent(new CustomEvent('canvas:zoom', {
          detail: { dir, mouseX, mouseY },
          bubbles: false,
        }));
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', onWheel);
      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, [viewportRef, activeBrush, isDrawingObstacle, previewSegment, onPreviewChange, brushAngle, onBrushAngleChange]);
}
