import React from 'react';
import type { Surface } from '@/lib/types';

interface GridOverlayProps {
  surface: Surface;
  spacing: number;
  editorScale: number;
}

export function GridOverlay({ surface, spacing, editorScale }: GridOverlayProps) {
  const svgWidth = surface.width * editorScale;
  const svgHeight = surface.height * editorScale;
  const stepPx = spacing * editorScale;

  const verticalCount = Math.floor(surface.width / spacing) + 1;
  const horizontalCount = Math.floor(surface.height / spacing) + 1;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <g opacity={0.3}>
        {Array.from({ length: verticalCount }, (_, i) => {
          const x = i * stepPx;
          return (
            <line
              key={`v-${i}`}
              x1={x} y1={0}
              x2={x} y2={svgHeight}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          );
        })}
        {Array.from({ length: horizontalCount }, (_, i) => {
          const y = i * stepPx;
          return (
            <line
              key={`h-${i}`}
              x1={0} y1={y}
              x2={svgWidth} y2={y}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          );
        })}
      </g>
    </svg>
  );
}
