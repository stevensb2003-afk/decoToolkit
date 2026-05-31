import React, { useMemo } from 'react';
import ClipperLib from 'clipper-lib';
import { Point, Obstacle } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { PlusCircle, Terminal } from 'lucide-react';

interface ValidationResult {
  hasOverlap: boolean;
  isStartOut: boolean;
  isNextOut: boolean;
  warnings: React.ReactNode[];
}

export function useDrawingValidation(
  startPoint: Point | null,
  nextPoint: Point | null,
  surfaceWidth: number,
  surfaceHeight: number,
  initialX: number,
  initialY: number,
  isEditing: boolean,
  currentPoints: Point[],
  obstacles: Obstacle[],
  editingObstacleId?: string | null
): ValidationResult {
  return useMemo(() => {
    if (!startPoint || !nextPoint) {
      return { hasOverlap: false, isStartOut: false, isNextOut: false, warnings: [] };
    }

    const isStartOut = (initialX > surfaceWidth / 100 || initialX < 0 || initialY > surfaceHeight / 100 || initialY < 0);
    const isNextOut = (nextPoint.x > surfaceWidth + 0.01 || nextPoint.x < -0.01 || nextPoint.y > surfaceHeight + 0.01 || nextPoint.y < -0.01);

    let hasOverlap = false;
    try {
      const scaleFactor = 1000;

      if (isEditing) {
        if (currentPoints.length >= 2) {
          const path = currentPoints.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));
          const clipper = new ClipperLib.Clipper();
          clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true);

          for (const obs of obstacles) {
            if (obs.id === editingObstacleId) continue;
            const obsPath = obs.points.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));
            clipper.AddPath(obsPath, ClipperLib.PolyType.ptClip, true);
          }

          const solution = new ClipperLib.Paths();
          clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
          if (solution.length > 0) hasOverlap = true;
        }
      } else {
        const p1 = { X: Math.round(startPoint.x * scaleFactor), Y: Math.round(startPoint.y * scaleFactor) };
        const p2 = { X: Math.round(nextPoint.x * scaleFactor), Y: Math.round(nextPoint.y * scaleFactor) };

        const crossProduct = (a: { X: number; Y: number }, b: { X: number; Y: number }, c: { X: number; Y: number }) => (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);
        const onSegment = (p: { X: number; Y: number }, a: { X: number; Y: number }, b: { X: number; Y: number }) =>
          p.X >= Math.min(a.X, b.X) && p.X <= Math.max(a.X, b.X) &&
          p.Y >= Math.min(a.Y, b.Y) && p.Y <= Math.max(a.Y, b.Y);

        const segsIntersect = (a: { X: number; Y: number }, b: { X: number; Y: number }, c: { X: number; Y: number }, d: { X: number; Y: number }) => {
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

            if (ClipperLib.Clipper.PointInPolygon(p1, obsPath) !== 0 ||
              ClipperLib.Clipper.PointInPolygon(p2, obsPath) !== 0) {
              hasOverlap = true;
              break;
            }

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
      console.error('Overlap check error:', e);
    }

    const warnings: React.ReactNode[] = [];
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
                {isStartOut ? 'Punto inicial fuera.' : 'Punto final fuera.'}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      );
    }

    return { hasOverlap, isStartOut, isNextOut, warnings };
  }, [startPoint, nextPoint, surfaceWidth, surfaceHeight, initialX, initialY, isEditing, currentPoints, obstacles, editingObstacleId]);
}
