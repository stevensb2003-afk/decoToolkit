import React, { useMemo } from 'react';
import type { Obstacle, Point } from '@/lib/types';

interface ObstaclesOverlayProps {
  obstacles: Obstacle[];
  editorScale: number;
  isDrawingObstacle: boolean;
  currentObstaclePoints: Point[];
  obstacleAnchorIndex: number;
  onObstacleAnchorIndexChange: (idx: number) => void;
  surfaceWidth: number;
  surfaceHeight: number;
  previewObstaclePoint?: Point | null;
  previewSegment?: { length: number; angle: number } | null;
  editingObstacleId?: string | null;
}

function ptsToStr(points: Point[], scale: number): string {
  return points.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
}

export function ObstaclesOverlay({
  obstacles,
  editorScale,
  isDrawingObstacle,
  currentObstaclePoints,
  obstacleAnchorIndex,
  onObstacleAnchorIndexChange,
  surfaceWidth,
  surfaceHeight,
  previewObstaclePoint,
  previewSegment,
  editingObstacleId,
}: ObstaclesOverlayProps) {
  const svgWidth = surfaceWidth * editorScale;
  const svgHeight = surfaceHeight * editorScale;

  const formPreviewSegment = useMemo(() => {
    if (!isDrawingObstacle || !previewSegment || currentObstaclePoints.length === 0 || editingObstacleId) return null;
    const lastPt = currentObstaclePoints[currentObstaclePoints.length - 1];
    const rad = previewSegment.angle * (Math.PI / 180);
    const endPt = {
      x: lastPt.x + previewSegment.length * Math.cos(rad),
      y: lastPt.y - previewSegment.length * Math.sin(rad),
    };
    return { lastPt, endPt };
  }, [isDrawingObstacle, previewSegment, currentObstaclePoints, editingObstacleId]);

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <pattern id="obstacleHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Existing obstacles */}
      {obstacles.map(obs => (
        <polygon
          key={obs.id}
          points={ptsToStr(obs.points, editorScale)}
          fill="url(#obstacleHatch)"
          stroke="rgba(100,0,0,0.8)"
          strokeWidth={1.5}
          fillOpacity={0.6}
        />
      ))}

      {/* Current drawing: fill preview polygon */}
      {currentObstaclePoints.length >= 3 && (
        <polygon
          points={ptsToStr(currentObstaclePoints, editorScale)}
          fill="rgba(37,99,235,0.1)"
          stroke="none"
        />
      )}

      {/* Current drawing: polyline of committed points */}
      {currentObstaclePoints.length > 0 && (
        <polyline
          points={ptsToStr(currentObstaclePoints, editorScale)}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
        />
      )}

      {/* Editing anchor circles */}
      {editingObstacleId && currentObstaclePoints.map((p, idx) => (
        <circle
          key={`anchor-${idx}`}
          cx={p.x * editorScale}
          cy={p.y * editorScale}
          r={idx === 0 ? 6 : 4}
          fill={idx === 0 ? '#2563eb' : 'white'}
          stroke={idx === 0 ? 'white' : '#2563eb'}
          strokeWidth={2}
        />
      ))}

      {/* Preview line to cursor */}
      {!editingObstacleId && isDrawingObstacle && previewObstaclePoint && !previewSegment && currentObstaclePoints.length > 0 && (
        <line
          x1={currentObstaclePoints[currentObstaclePoints.length - 1].x * editorScale}
          y1={currentObstaclePoints[currentObstaclePoints.length - 1].y * editorScale}
          x2={previewObstaclePoint.x * editorScale}
          y2={previewObstaclePoint.y * editorScale}
          stroke="rgba(59,130,246,0.8)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}

      {/* Preview cursor dot */}
      {isDrawingObstacle && previewObstaclePoint && (
        <circle
          cx={previewObstaclePoint.x * editorScale}
          cy={previewObstaclePoint.y * editorScale}
          r={4}
          fill="white"
          stroke="#2563eb"
          strokeWidth={2}
        />
      )}

      {/* Form preview segment */}
      {formPreviewSegment && (
        <line
          x1={formPreviewSegment.lastPt.x * editorScale}
          y1={formPreviewSegment.lastPt.y * editorScale}
          x2={formPreviewSegment.endPt.x * editorScale}
          y2={formPreviewSegment.endPt.y * editorScale}
          stroke="rgba(59,130,246,0.8)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}
