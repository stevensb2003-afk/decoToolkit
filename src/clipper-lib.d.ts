// src/clipper-lib.d.ts

declare module 'clipper-lib' {
  // --- Basic Types ---
  export interface IntPoint {
    X: number;
    Y: number;
  }
  export type Path = IntPoint[];
  export class Paths extends Array<Path> {
    constructor();
  }

  export interface IntRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }

  // --- Enumerations ---
  export enum ClipType { ctIntersection, ctUnion, ctDifference, ctXor }
  export enum PolyType { ptSubject, ptClip }
  export enum PolyFillType { pftEvenOdd, pftNonZero, pftPositive, pftNegative }

  // --- Main Classes ---
  export class Clipper {
    constructor();
    StrictlySimple: boolean;
    AddPath(path: Path, polyType: PolyType, closed: boolean): boolean;
    AddPaths(paths: Paths, polyType: PolyType, closed: boolean): boolean;
    Execute(clipType: ClipType, solution: Paths, subjFillType?: PolyFillType, clipFillType?: PolyFillType): boolean;
    Clear(): void;
    static GetBounds(paths: Paths): IntRect;
    static Area(path: Path): number;
    static PointInPolygon(pt: IntPoint, path: Path): number;
  }

  // --- Helper Functions (JS) ---
  export namespace JS {
    export function ScaleUpPaths(paths: Paths, scale: number): void;
    export function ScaleDownPaths(paths: Paths, scale: number): void;
  }
}