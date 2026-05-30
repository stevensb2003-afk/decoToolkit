import * as ClipperLib from 'clipper-lib';
import type { Point, Fragment, Brush, PlacedPiece, Obstacle, Surface, Remnant } from "@/lib/types";
import { createRemnantFromPath } from './remnant-helpers';
import { simplifyPaths } from "@/lib/clipper-utils";

/**
 * Optimized path scaling using an O(N) array mapping loop.
 * This completely avoids the heavy and slow JSON.parse(JSON.stringify) call.
 */
function scaleUpPaths(paths: {X: number; Y: number}[][], scale: number): ClipperLib.Paths {
  return paths.map(path => path.map(pt => ({ X: Math.round(pt.X * scale), Y: Math.round(pt.Y * scale) })));
}

export function calculatePlacementFragments(
  idealPiece: { x: number; y: number; width: number; height: number; rotation: number },
  activeBrush: Brush | null,
  activeSurface: Surface | null,
  activeSurfacePieces: PlacedPiece[],
  activeSurfaceObstacles: Obstacle[],
  isFillMode: boolean
): Fragment[][] {
  if (!activeSurface || !activeBrush) return [];

  const scaleFactor = 1000;
  const angleRad = idealPiece.rotation * (Math.PI / 180);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  let subjectPaths: {X: number, Y: number}[][] = [];
  
  if (activeBrush?.type === 'remnant') {
    const idealPieceCenterX = idealPiece.x;
    const idealPieceCenterY = idealPiece.y;
    const brushFragments = activeBrush.fragments || [{ id: 'legacy', points: activeBrush.points }];

    brushFragments.forEach(f => {
      const path = f.points.map(p => {
        const translatedX = p.x - activeBrush.x;
        const translatedY = p.y - activeBrush.y;
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;
        return {
          X: idealPieceCenterX + rotatedX,
          Y: idealPieceCenterY + rotatedY,
        };
      });
      subjectPaths.push(path);
    });
  } else {
    const w = idealPiece.width;
    const h = idealPiece.height;
    const centerX = idealPiece.x;
    const centerY = idealPiece.y;

    const corners = [
      { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }
    ];
    subjectPaths = [corners.map(corner => ({
      X: centerX + (corner.x * cos - corner.y * sin),
      Y: centerY + (corner.x * sin + corner.y * cos),
    }))];
  }

  const existingFragmentsPaths = activeSurfacePieces.flatMap(p =>
    p.fragments.map(f => f.points.map(pt => ({ X: pt.x, Y: pt.y })))
  );

  if (activeSurfacePieces.length > 0 && !isFillMode) {
    const subjPathsForCheck = scaleUpPaths(subjectPaths, scaleFactor);
    const clipPathsForCheck = scaleUpPaths(existingFragmentsPaths, scaleFactor);

    const clipperCheck = new ClipperLib.Clipper();
    clipperCheck.AddPaths(subjPathsForCheck, ClipperLib.PolyType.ptSubject, true);
    clipperCheck.AddPaths(clipPathsForCheck, ClipperLib.PolyType.ptClip, true);
    
    const intersectionSolution: ClipperLib.Paths = [];
    clipperCheck.Execute(ClipperLib.ClipType.ctIntersection, intersectionSolution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

    if (intersectionSolution.length > 0) {
      return []; // Intersection detected, block placement
    }
  }

  let clipperSubjectPaths = scaleUpPaths(subjectPaths, scaleFactor);
  let clipper = new ClipperLib.Clipper();

  if (activeSurfacePieces.length > 0 && isFillMode) {
    const scaledExistingFragments = scaleUpPaths(existingFragmentsPaths, scaleFactor);
    clipper.AddPaths(clipperSubjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(scaledExistingFragments, ClipperLib.PolyType.ptClip, true);
    
    const filledSolution: ClipperLib.Paths = [];
    clipper.Execute(ClipperLib.ClipType.ctDifference, filledSolution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    clipperSubjectPaths = filledSolution;
    clipper.Clear();
  }

  if (activeSurfaceObstacles.length > 0) {
    const obstaclePaths = activeSurfaceObstacles.map(o => o.points.map((p: Point) => ({ X: p.x, Y: p.y })));
    if (obstaclePaths.some(p => p.length > 0)) {
      const scaledObstaclePaths = scaleUpPaths(obstaclePaths, scaleFactor);
      clipper.AddPaths(clipperSubjectPaths, ClipperLib.PolyType.ptSubject, true);
      clipper.AddPaths(scaledObstaclePaths, ClipperLib.PolyType.ptClip, true);
      
      const obstacleSolution: ClipperLib.Paths = [];
      clipper.Execute(ClipperLib.ClipType.ctDifference, obstacleSolution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
      clipperSubjectPaths = obstacleSolution;
      clipper.Clear();
    }
  }

  const surfaceClipPath = [
    [{ X: 0, Y: 0 }, { X: activeSurface.width, Y: 0 }, { X: activeSurface.width, Y: activeSurface.height }, { X: 0, Y: activeSurface.height }]
  ];
  const scaledSurfaceClipPath = scaleUpPaths(surfaceClipPath, scaleFactor);
  
  clipper.AddPaths(clipperSubjectPaths, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPaths(scaledSurfaceClipPath, ClipperLib.PolyType.ptClip, true);
  
  const polyTree = new (ClipperLib as any).PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctIntersection, polyTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

  const groups: Fragment[][] = [];

  const traverse = (node: any) => {
    for (let i = 0; i < node.ChildCount(); i++) {
      const child = node.Childs()[i];
      if (!child.IsHole()) {
        const currentGroup: Fragment[] = [];
        const outerPoints: Point[] = child.Contour().map((p: any) => ({ x: p.X / scaleFactor, y: p.Y / scaleFactor }));
        currentGroup.push({ id: crypto.randomUUID(), points: outerPoints });

        for (let j = 0; j < child.ChildCount(); j++) {
          const hole = child.Childs()[j];
          if (hole.IsHole()) {
            const holePoints: Point[] = hole.Contour().map((p: any) => ({ x: p.X / scaleFactor, y: p.Y / scaleFactor }));
            currentGroup.push({ id: crypto.randomUUID(), points: holePoints });
            traverse(hole);
          }
        }
        groups.push(currentGroup);
      }
    }
  };

  traverse(polyTree);
  return groups;
}

export function calculateOffcuts(
  idealPiece: { x: number; y: number; width: number; height: number; rotation: number },
  placedFragments: Fragment[],
  materialId: string,
  activeBrush: Brush | null,
  sourceSheetId?: string
): Remnant[] {
  if (!activeBrush) return [];

  const scaleFactor = 1000;
  const clipper = new ClipperLib.Clipper();
  const angleRad = idealPiece.rotation * (Math.PI / 180);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  let subjectPaths: {X: number, Y: number}[][] = [];

  if (activeBrush?.type === 'remnant') {
    const idealPieceCenterX = idealPiece.x;
    const idealPieceCenterY = idealPiece.y;
    const brushFragments = activeBrush.fragments || [{ id: 'legacy', points: activeBrush.points }];

    brushFragments.forEach(f => {
      const path = f.points.map(p => {
        const translatedX = p.x - activeBrush.x;
        const translatedY = p.y - activeBrush.y;
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;
        return {
          X: idealPieceCenterX + rotatedX,
          Y: idealPieceCenterY + rotatedY,
        };
      });
      subjectPaths.push(path);
    });
  } else {
    const w = idealPiece.width;
    const h = idealPiece.height;
    const centerX = idealPiece.x;
    const centerY = idealPiece.y;

    const idealPolygon = [
      { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }
    ].map(corner => ({
      X: centerX + (corner.x * cos - corner.y * sin),
      Y: centerY + (corner.x * sin + corner.y * cos),
    }));
    subjectPaths = [idealPolygon];
  }

  const clipPaths = placedFragments.map(f => f.points.map(p => ({ X: p.x, Y: p.y })));

  const clipperSubjectPaths = scaleUpPaths(subjectPaths, scaleFactor);
  const clipperClipPaths = scaleUpPaths(clipPaths, scaleFactor);

  clipper.AddPaths(clipperSubjectPaths, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPaths(clipperClipPaths, ClipperLib.PolyType.ptClip, true);

  const offcutSolution: ClipperLib.Paths = [];
  clipper.Execute(ClipperLib.ClipType.ctDifference, offcutSolution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

  const simplifiedOffcutSolution = simplifyPaths(offcutSolution);
  ClipperLib.JS.ScaleDownPaths(simplifiedOffcutSolution, scaleFactor);

  const remnants: Remnant[] = [];
  simplifiedOffcutSolution.forEach((path: ClipperLib.IntPoint[]) => {
    const remnant = createRemnantFromPath(path, materialId, sourceSheetId);
    if (remnant) {
      remnants.push(remnant);
    }
  });

  return remnants;
}
