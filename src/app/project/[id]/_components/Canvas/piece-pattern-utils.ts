import type { PlacedPiece, Material } from '@/lib/types';

export interface PatternDef {
  patternId: string;
  pieceId: string;
  textureUrl: string;
  patternWidth: number;   // px — one tile width
  patternHeight: number;  // px — one tile height
  rotation: number;       // degrees — brush angle at placement time
  // Pattern origin in SVG px: center of the original (unclipped) sheet
  originX: number;
  originY: number;
}

/**
 * Builds one PatternDef per visible piece that has a textured material.
 *
 * The texture origin is anchored to the *center of the original full sheet* at
 * the moment it was placed (stored as originalX/Y on PlacedPiece).  This means:
 *   • Pieces placed at different positions get independent texture origins → textures
 *     are local to each piece, NOT a global canvas mask.
 *   • If a piece is clipped/cut, only the visible slice of the texture shows through.
 *   • Rotation follows the brush angle used at placement time (originalRotation).
 *   • Retrocompatible: pieces without originalX/Y fall back to bounding-box center.
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

    // Use the stored original sheet center when available (new pieces after fix).
    // Fall back to the bounding-box center of the fragment for legacy pieces.
    let originX: number;
    let originY: number;

    if (piece.originalX !== undefined && piece.originalY !== undefined) {
      originX = piece.originalX * editorScale;
      originY = piece.originalY * editorScale;
    } else {
      const allPoints = piece.fragments.flatMap(f => f.points);
      if (allPoints.length === 0) continue;
      const xs = allPoints.map(p => p.x * editorScale);
      const ys = allPoints.map(p => p.y * editorScale);
      originX = (Math.min(...xs) + Math.max(...xs)) / 2;
      originY = (Math.min(...ys) + Math.max(...ys)) / 2;
    }

    const rotation = piece.originalRotation ?? piece.rotation ?? 0;

    defs.push({
      patternId: `pattern-${piece.id}`,
      pieceId: piece.id,
      textureUrl: material.texture.url,
      patternWidth:  (material.texture.metadata?.physicalWidth  ?? material.width)  * editorScale,
      patternHeight: (material.texture.metadata?.physicalHeight ?? material.height) * editorScale,
      rotation,
      originX,
      originY,
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
