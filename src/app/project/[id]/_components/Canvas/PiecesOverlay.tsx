import React, { useMemo } from 'react';
import type { PlacedPiece, Material } from '@/lib/types';
import { buildPatternDefs, getPieceFill } from './piece-pattern-utils';

interface PiecesOverlayProps {
  pieces: PlacedPiece[];
  materials: Material[];
  editorScale: number;
  isEraserMode: boolean;
  onDeletePiece: (id: string) => void;
  erasedPieceIds?: Set<string>;
  hoveredPieceId?: string | null;
}

function buildPath(piece: PlacedPiece, scale: number): string {
  return piece.fragments
    .map(frag =>
      frag.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`).join(' ') + ' Z'
    )
    .join(' ');
}

const ERASER_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\'%3E%3Crect x=\'3\' y=\'3\' width=\'18\' height=\'10\' rx=\'2\' fill=\'white\' stroke=\'black\' strokeWidth=\'1.5\'/%3E%3C/svg%3E") 8 20, crosshair';

export function PiecesOverlay({
  pieces,
  materials,
  editorScale,
  isEraserMode,
  onDeletePiece,
  erasedPieceIds = new Set(),
  hoveredPieceId,
}: PiecesOverlayProps) {
  const visiblePieces = useMemo(
    () => pieces.filter(p => !erasedPieceIds.has(p.id)),
    [pieces, erasedPieceIds]
  );

  const materialMap = useMemo(() => {
    const map = new Map<string, Material>();
    materials.forEach(m => map.set(m.id, m));
    return map;
  }, [materials]);

  const patternDefs = useMemo(
    () => buildPatternDefs(visiblePieces, materialMap, editorScale),
    [visiblePieces, materialMap, editorScale]
  );

  return (
    <g>
      {patternDefs.length > 0 && (
        <defs>
          {patternDefs.map(def => (
            <pattern
              key={def.patternId}
              id={def.patternId}
              patternUnits="userSpaceOnUse"
              width={def.patternWidth}
              height={def.patternHeight}
              patternTransform={
                def.rotation !== 0
                  ? `rotate(${def.rotation}, ${def.cx}, ${def.cy})`
                  : undefined
              }
            >
              <image
                href={def.textureUrl}
                x={0}
                y={0}
                width={def.patternWidth}
                height={def.patternHeight}
                preserveAspectRatio="none"
              />
            </pattern>
          ))}
        </defs>
      )}

      {visiblePieces.map(piece => {
        const isHovered = hoveredPieceId === piece.id;
        const isEraserHovered = isEraserMode && isHovered;
        const fill = getPieceFill(piece, materialMap, isEraserHovered);
        const pathData = buildPath(piece, editorScale);

        return (
          <path
            key={piece.id}
            data-piece-id={piece.id}
            d={pathData}
            fill={fill}
            fillRule="evenodd"
            fillOpacity={isHovered && !isEraserMode ? 0.95 : 0.85}
            stroke={isEraserHovered ? 'red' : 'rgba(255,255,255,0.4)'}
            strokeWidth={1}
            style={{
              cursor: isEraserMode ? ERASER_CURSOR : 'default',
              transition: 'fill-opacity 0.1s',
            }}
            onClick={isEraserMode ? () => onDeletePiece(piece.id) : undefined}
          />
        );
      })}
    </g>
  );
}
