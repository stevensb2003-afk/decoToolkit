import type { PlacedPiece, Material } from '@/lib/types';

export interface PatternDef {
  patternId: string;
  pieceId: string;
  textureUrl: string;
  patternWidth: number;   // px
  patternHeight: number;  // px
  rotation: number;       // degrees
  cx: number;             // rotation center x in px
  cy: number;             // rotation center y in px
}

/** Computes the bounding-box center of a piece in SVG px coordinates */
function pieceCenterPx(piece: PlacedPiece, scale: number): { cx: number; cy: number } {
  const allPoints = piece.fragments.flatMap(f => f.points);
  if (allPoints.length === 0) return { cx: 0, cy: 0 };
  const xs = allPoints.map(p => p.x * scale);
  const ys = allPoints.map(p => p.y * scale);
  return {
    cx: (Math.min(...xs) + Math.max(...xs)) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/**
 * Builds one PatternDef per visible piece that has a textured material.
 * Each piece gets its own pattern so rotation can differ between pieces of
 * the same material.
 */
export function buildPatternDefs(
  pieces: PlacedPiece[],
  materialMap: Map<string, Material>,
  editorScale: number,
): PatternDef[] {
  const defs: PatternDef[] = [];

  for (const piece of pieces) {
    const material = materialMap.get(piece.materialId);
    if (!material?.texture?.url) continue;

    const { cx, cy } = pieceCenterPx(piece, editorScale);

    defs.push({
      patternId: `pattern-${piece.id}`,
      pieceId: piece.id,
      textureUrl: material.texture.url,
      patternWidth: material.width * editorScale,
      patternHeight: material.height * editorScale,
      rotation: piece.rotation,
      cx,
      cy,
    });
  }

  return defs;
}

/** Returns the SVG fill value for a piece */
export function getPieceFill(
  piece: PlacedPiece,
  materialMap: Map<string, Material>,
  isEraserHovered: boolean,
): string {
  if (isEraserHovered) return 'rgba(255,0,0,0.5)';
  const material = materialMap.get(piece.materialId);
  if (material?.texture?.url) return `url(#pattern-${piece.id})`;
  return material?.color ?? '#ccc';
}
