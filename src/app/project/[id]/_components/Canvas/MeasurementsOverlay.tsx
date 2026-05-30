import React, { useMemo, useState, useCallback } from 'react';
import type { Surface, PlacedPiece, MeasureMode, Point, VertexMeasurement } from '@/lib/types';
import { calculatePolygonArea } from '@/lib/utils';

interface MeasurementsOverlayProps {
  isMeasureMode: boolean;
  measureMode: MeasureMode;
  surface: Surface;
  pieces: PlacedPiece[];
  editorScale: number;
  onPreviewChange: (data: { length: number; angle: number } | null) => void;
  currentVertexMeasurePoints?: Point[];
  previewVertexMeasurePoint?: Point | null;
  vertexMeasurements?: VertexMeasurement[];
  savedVertexFigures?: import('@/lib/types').VertexFigure[];
  isCloseSnap?: boolean;
  measurements?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
}

function buildBBox(piece: PlacedPiece) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  piece.fragments.forEach(frag => {
    frag.points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
  });
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function MeasurementsOverlay({
  isMeasureMode,
  measureMode,
  surface,
  pieces,
  editorScale,
  currentVertexMeasurePoints = [],
  previewVertexMeasurePoint,
  vertexMeasurements = [],
  savedVertexFigures = [],
  isCloseSnap = false,
  measurements = [],
}: MeasurementsOverlayProps) {
  const svgWidth = surface.width * editorScale;
  const svgHeight = surface.height * editorScale;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      {/* Area mode: bbox per piece */}
      {isMeasureMode && measureMode === 'area' && (
        <g>
          {pieces.map(piece => {
            const bb = buildBBox(piece);
            if (bb.w <= 0 || bb.h <= 0) return null;
            const allPts = piece.fragments.flatMap(f => f.points);
            const areaCm2 = calculatePolygonArea(allPts);
            const areaM2 = (areaCm2 / 10000).toFixed(3);

            return (
              <g key={piece.id}>
                <rect
                  x={bb.x * editorScale}
                  y={bb.y * editorScale}
                  width={bb.w * editorScale}
                  height={bb.h * editorScale}
                  fill="rgba(34,197,94,0.05)"
                  stroke="rgba(34,197,94,0.5)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <text
                  x={(bb.x + bb.w / 2) * editorScale}
                  y={(bb.y + bb.h / 2) * editorScale}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(10, editorScale * 0.8)}
                  fill="rgba(21,128,61,0.9)"
                  fontFamily="monospace"
                  fontWeight="bold"
                  stroke="white"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke fill"
                >
                  {areaM2}m²
                </text>
              </g>
            );
          })}
        </g>
      )}
      
      {/* Saved area measurements (ALWAYS VISIBLE) */}
      <g>
          {measurements.map(m => (
            <g key={m.id}>
              <rect
                x={m.x * editorScale}
                y={m.y * editorScale}
                width={m.width * editorScale}
                height={m.height * editorScale}
                fill="rgba(34,197,94,0.08)"
                stroke="#16a34a"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text
                x={(m.x + m.width / 2) * editorScale}
                y={(m.y + m.height / 2) * editorScale}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill="#15803d"
                fontFamily="monospace"
                fontWeight="bold"
                stroke="white"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke fill"
              >
                <tspan x={(m.x + m.width / 2) * editorScale} dy="-0.4em">{(m.width / 100).toFixed(2)}m</tspan>
                <tspan x={(m.x + m.width / 2) * editorScale} dy="1.2em">× {(m.height / 100).toFixed(2)}m</tspan>
              </text>
            </g>
          ))}
      </g>

      {/* Saved Vertex Figures (ALWAYS VISIBLE) */}
      <g>
        {savedVertexFigures.flatMap((fig) => fig.segments).map((vm, i) => {
          const midX = ((vm.p1.x + vm.p2.x) / 2) * editorScale;
          const midY = ((vm.p1.y + vm.p2.y) / 2) * editorScale;
          return (
            <g key={`saved-vm-${i}`}>
              <line
                x1={vm.p1.x * editorScale} y1={vm.p1.y * editorScale}
                x2={vm.p2.x * editorScale} y2={vm.p2.y * editorScale}
                stroke="#16a34a" strokeWidth={2}
              />
              <text
                x={midX} y={midY - 6}
                textAnchor="middle"
                fontSize={11}
                fill="#15803d"
                fontFamily="monospace"
                fontWeight="bold"
                stroke="white"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke fill"
              >
                {(vm.length / 100).toFixed(2)}m
              </text>
            </g>
          );
        })}
      </g>

      {/* Active Vertex / distance mode (ONLY WHEN MEASURE TOOL ACTIVE) */}
      {isMeasureMode && (measureMode === 'vertex' || measureMode === 'distance') && (
        <g>
          {vertexMeasurements.map((vm, i) => {
            const midX = ((vm.p1.x + vm.p2.x) / 2) * editorScale;
            const midY = ((vm.p1.y + vm.p2.y) / 2) * editorScale;
            return (
              <g key={`vm-${i}`}>
                <line
                  x1={vm.p1.x * editorScale} y1={vm.p1.y * editorScale}
                  x2={vm.p2.x * editorScale} y2={vm.p2.y * editorScale}
                  stroke="#16a34a" strokeWidth={2}
                />
                <text
                  x={midX} y={midY - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#15803d"
                  fontFamily="monospace"
                  fontWeight="bold"
                  stroke="white"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke fill"
                >
                  {(vm.length / 100).toFixed(2)}m
                </text>
              </g>
            );
          })}
          {/* Preview line to cursor */}
          {previewVertexMeasurePoint && currentVertexMeasurePoints.length > 0 && (
            <line
              x1={currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1].x * editorScale}
              y1={currentVertexMeasurePoints[currentVertexMeasurePoints.length - 1].y * editorScale}
              x2={previewVertexMeasurePoint.x * editorScale}
              y2={previewVertexMeasurePoint.y * editorScale}
              stroke="rgba(34,197,94,0.7)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
          {/* Preview cursor dot */}
          {previewVertexMeasurePoint && (
            <circle
              cx={previewVertexMeasurePoint.x * editorScale}
              cy={previewVertexMeasurePoint.y * editorScale}
              r={isCloseSnap ? 6 : 5}
              fill={isCloseSnap ? 'rgba(249,115,22,0.5)' : 'rgba(34,197,94,0.5)'}
              stroke={isCloseSnap ? '#ea580c' : '#16a34a'}
              strokeWidth={1}
            />
          )}
        </g>
      )}

      {/* Vertex mode: show vertex circles on pieces */}
      {isMeasureMode && measureMode === 'vertex' && (
        <g>
          {pieces.flatMap(piece =>
            piece.fragments.flatMap((frag, fi) =>
              frag.points.map((p, pi) => (
                <circle
                  key={`${piece.id}-${fi}-${pi}`}
                  cx={p.x * editorScale}
                  cy={p.y * editorScale}
                  r={3}
                  fill="white"
                  stroke="#16a34a"
                  strokeWidth={1.5}
                />
              ))
            )
          )}
        </g>
      )}
    </svg>
  );
}
