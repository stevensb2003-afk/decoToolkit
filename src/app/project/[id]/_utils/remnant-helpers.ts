import * as ClipperLib from 'clipper-lib';
import { EPSILON, calculatePolygonArea } from "@/lib/utils";
import type { Remnant } from "@/lib/types";

/**
 * Validates and constructs a Remnant from an offcut path.
 * Filters out slivers using bounding box and an actual polygon area threshold.
 */
export function createRemnantFromPath(
  path: ClipperLib.IntPoint[],
  materialId: string,
  sourceSheetId?: string,
  areaThreshold: number = 25 // Default to 25 square units (cm^2)
): Remnant | null {
  if (path.length < 3) return null;

  const bounds = ClipperLib.Clipper.GetBounds([path]);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;

  if (width <= EPSILON || height <= EPSILON) {
    return null;
  }

  const points = path.map(p => ({ x: p.X, y: p.Y }));
  const area = Math.abs(calculatePolygonArea(points));

  if (area < areaThreshold) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    materialId,
    points,
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    width,
    height,
    createdAt: new Date(),
    sourceSheetId,
  };
}
