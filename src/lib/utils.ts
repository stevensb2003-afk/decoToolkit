import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Remnant, Point } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type Unit = "m" | "cm";

export function convertToCm(value: number, fromUnit: Unit): number {
  if (fromUnit === 'm') {
    return value * 100;
  }
  return value;
}

export function convertFromCm(value: number, toUnit: Unit): number {
  if (toUnit === 'm') {
    return value / 100;
  }
  return value;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}


// --- GEOMETRY ---
export const EPSILON = 1e-6; // Small tolerance for float comparisons

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the subtraction of one rectangle from another.
 * Returns an array of rectangles that represent the area of rectA that is not overlapping with rectB.
 * @param rectA The base rectangle.
 * @param rectB The rectangle to subtract from rectA.
 * @returns An array of up to 4 rectangles representing the remaining parts of rectA.
 */
export function subtract(rectA: Rect, rectB: Rect): Rect[] {
  const result: Rect[] = [];

  // Calculate intersection boundaries
  const ix1 = Math.max(rectA.x, rectB.x);
  const iy1 = Math.max(rectA.y, rectB.y);
  const ix2 = Math.min(rectA.x + rectA.width, rectB.x + rectB.width);
  const iy2 = Math.min(rectA.y + rectA.height, rectB.y + rectB.height);

  // No intersection
  if (ix1 >= ix2 || iy1 >= iy2) {
    return [rectA];
  }

  // Top part
  if (iy1 > rectA.y) {
    result.push({ x: rectA.x, y: rectA.y, width: rectA.width, height: iy1 - rectA.y });
  }

  // Bottom part
  if (iy2 < rectA.y + rectA.height) {
    result.push({ x: rectA.x, y: iy2, width: rectA.width, height: (rectA.y + rectA.height) - iy2 });
  }

  // Left part
  if (ix1 > rectA.x) {
    result.push({ x: rectA.x, y: iy1, width: ix1 - rectA.x, height: iy2 - iy1 });
  }

  // Right part
  if (ix2 < rectA.x + rectA.width) {
    result.push({ x: ix2, y: iy1, width: (rectA.x + rectA.width) - ix2, height: iy2 - iy1 });
  }

  return result.filter(rect => rect.width > 0 && rect.height > 0);
}


/**
 * Calculates the signed area of a polygon using the Shoelace formula.
 * CCW orientation usually produces positive area, CW produces negative.
 * This is useful for subtracting holes in complex polygons.
 * @param points An array of points representing the polygon's vertices in order.
 * @returns The signed area of the polygon.
 */
export function calculatePolygonArea(points: Point[]): number {
  const n = points.length;
  if (n < 3) {
    return 0; // Not a polygon
  }

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return area / 2;
}

/**
 * Simplifies a path by removing redundant intermediate points that are
 * either duplicates or collinear with their neighbors.
 * @param points Array of points to simplify.
 * @returns A new array of simplified points.
 */
export function simplifyPath(points: Point[]): Point[] {
  if (points.length < 2) return points;

  // 1. Deduplicate adjacent points
  let pts = points.filter((p, i) => {
    if (i === 0) return true;
    const prev = points[i - 1];
    return Math.abs(p.x - prev.x) > EPSILON || Math.abs(p.y - prev.y) > EPSILON;
  });

  if (pts.length < 2) return pts;

  // 2. Determine if it's a closed loop
  const isClosed = pts.length > 2 &&
    Math.abs(pts[0].x - pts[pts.length - 1].x) < EPSILON &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < EPSILON;

  // 3. Normalize: For closed loops, work with unique vertices only (remove duplicate tail)
  let workingPoints = isClosed ? pts.slice(0, -1) : [...pts];

  if (workingPoints.length < 2) return workingPoints;
  // A triangle (3 unique points) with a closing point is already minimal for a polygon
  if (isClosed && workingPoints.length <= 3) return pts;

  let result: Point[] = [];
  const n = workingPoints.length;

  for (let i = 0; i < n; i++) {
    // For non-closed paths, always keep the endpoints
    if (!isClosed && (i === 0 || i === n - 1)) {
      result.push(workingPoints[i]);
      continue;
    }

    const pPrev = workingPoints[(i - 1 + n) % n];
    const pCurr = workingPoints[i];
    const pNext = workingPoints[(i + 1) % n];

    const v1x = pCurr.x - pPrev.x;
    const v1y = pCurr.y - pPrev.y;
    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;

    const cp = v1x * v2y - v1y * v2x;
    const dp = v1x * v2x + v1y * v2y;
    const lenSq1 = v1x * v1x + v1y * v1y;
    const lenSq2 = v2x * v2x + v2y * v2y;

    // Tolerance for collinearity (cross product)
    const tolerance = 0.001 * Math.sqrt(lenSq1 * lenSq2);
    const isCollinear = Math.abs(cp) <= tolerance && dp > 0;

    if (!isCollinear) {
      result.push(pCurr);
    }
  }

  // 4. Re-close if necessary
  if (isClosed && result.length > 2) {
    result.push({ ...result[0] });
  }

  return result;
}
