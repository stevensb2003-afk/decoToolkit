import React, { useMemo } from 'react';
import type { PlacedPiece, Material } from '@/lib/types';

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

  const materialColorMap = useMemo(() => {
    const map = new Map<string, string>();
    materials.forEach(m => map.set(m.id, m.color));
    return map;
  }, [materials]);

  return (
    <g>
      {visiblePieces.map(piece => {
        const color = materialColorMap.get(piece.materialId) || '#ccc';
        const pathData = buildPath(piece, editorScale);
        const isHovered = hoveredPieceId === piece.id;
        const isEraserHovered = isEraserMode && isHovered;

        return (
          <path
            key={piece.id}
            data-piece-id={piece.id}
            d={pathData}
            fill={isEraserHovered ? 'rgba(255,0,0,0.5)' : color}
            fillRule="evenodd"
            fillOpacity={isHovered && !isEraserMode ? 0.95 : 0.85}
            stroke={isEraserHovered ? 'red' : 'rgba(255,255,255,0.4)'}
            strokeWidth={isEraserHovered ? 1 : 1}
            style={{
              cursor: isEraserMode ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\'%3E%3Crect x=\'3\' y=\'3\' width=\'18\' height=\'10\' rx=\'2\' fill=\'white\' stroke=\'black\' strokeWidth=\'1.5\'/%3E%3C/svg%3E") 8 20, crosshair' : 'default',
              transition: 'fill-opacity 0.1s',
            }}
            onClick={isEraserMode ? () => onDeletePiece(piece.id) : undefined}
          />
        );
      })}
    </g>
  );
}
