import type { Point, PlacedPiece, Brush, Obstacle } from '@/lib/types';

export const SNAP_THRESHOLD_PX = 10;

export function snapToVertex(
  pos: Point,
  checkClose: boolean,
  existing: Point[],
  scale: number,
  pieces: PlacedPiece[],
  obstacles: Obstacle[],
  surfaceWidth: number,
  surfaceHeight: number,
  isObstacleSnapActive: boolean,
  onCloseSnapChange: (isClose: boolean) => void
): Point {
  const thresh = SNAP_THRESHOLD_PX / scale;
  let best: Point | null = null;
  let minD = thresh;
  let isClose = false;

  if (checkClose && existing.length > 2) {
    const first = existing[0];
    const d = Math.hypot(pos.x - first.x, pos.y - first.y);
    if (d < thresh) {
      best = first;
      minD = d;
      isClose = true;
    }
  }

  if (!isClose) {
    const snapPoints: Point[] = [
      { x: 0, y: 0 },
      { x: surfaceWidth, y: 0 },
      { x: 0, y: surfaceHeight },
      { x: surfaceWidth, y: surfaceHeight },
    ];
    for (const pc of pieces) {
      for (const f of pc.fragments) {
        snapPoints.push(...f.points);
      }
    }
    if (isObstacleSnapActive) {
      for (const o of obstacles) {
        snapPoints.push(...o.points);
      }
    }

    for (const p of snapPoints) {
      const d = Math.hypot(pos.x - p.x, pos.y - p.y);
      if (d < minD) {
        minD = d;
        best = p;
      }
    }
  }

  // Segment / Edge Snap Check (Only if no vertex was within the threshold)
  if (!isClose && best === null) {
    const segments: Array<{ A: Point; B: Point }> = [
      // Surface boundaries
      { A: { x: 0, y: 0 }, B: { x: surfaceWidth, y: 0 } },
      { A: { x: surfaceWidth, y: 0 }, B: { x: surfaceWidth, y: surfaceHeight } },
      { A: { x: surfaceWidth, y: surfaceHeight }, B: { x: 0, y: surfaceHeight } },
      { A: { x: 0, y: surfaceHeight }, B: { x: 0, y: 0 } },
    ];

    // Placed pieces fragments segments
    for (const pc of pieces) {
      for (const f of pc.fragments) {
        const len = f.points.length;
        if (len >= 2) {
          for (let i = 0; i < len; i++) {
            segments.push({ A: f.points[i], B: f.points[(i + 1) % len] });
          }
        }
      }
    }

    // Obstacle segments
    if (isObstacleSnapActive) {
      for (const o of obstacles) {
        const len = o.points.length;
        if (len >= 2) {
          for (let i = 0; i < len; i++) {
            segments.push({ A: o.points[i], B: o.points[(i + 1) % len] });
          }
        }
      }
    }

    // Project pos onto each segment
    for (const seg of segments) {
      const abx = seg.B.x - seg.A.x;
      const aby = seg.B.y - seg.A.y;
      const apx = pos.x - seg.A.x;
      const apy = pos.y - seg.A.y;
      const ab2 = abx * abx + aby * aby;
      
      let t = 0;
      if (ab2 > 0) {
        t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
      }
      
      const cx = seg.A.x + t * abx;
      const cy = seg.A.y + t * aby;
      const d = Math.hypot(pos.x - cx, pos.y - cy);
      
      if (d < minD) {
        minD = d;
        best = { x: cx, y: cy };
      }
    }
  }

  onCloseSnapChange(isClose);
  return best ?? pos;
}

export function getPieceUnderCursor(
  pos: Point,
  pieces: PlacedPiece[],
  erasedPieceIds: Set<string>
): PlacedPiece | null {
  for (let i = pieces.length - 1; i >= 0; i--) {
    const piece = pieces[i];
    if (erasedPieceIds.has(piece.id)) continue;
    for (const frag of piece.fragments) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      frag.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
        return piece;
      }
    }
  }
  return null;
}

export function computeGhostPos(
  rawPos: Point,
  activeBrush: Brush | null,
  brushAngle: number,
  pivotPoint: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
): Point {
  if (!activeBrush) return rawPos;
  const w = activeBrush.width, h = activeBrush.height;
  const rad = brushAngle * (Math.PI / 180);
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const pivotLocalMap = {
    topLeft: { x: -w / 2, y: -h / 2 },
    topRight: { x: w / 2, y: -h / 2 },
    bottomLeft: { x: -w / 2, y: h / 2 },
    bottomRight: { x: w / 2, y: h / 2 },
  };
  let pv = pivotLocalMap[pivotPoint];

  // If remnant, grab the physical vertex closest to the selected pivot corner
  if (activeBrush.type === 'remnant') {
    const frags = activeBrush.fragments || [{ id: 'legacy', points: activeBrush.points || [] }];
    const pts = frags.flatMap(f => f.points);
    if (pts.length > 0) {
      const relPoints = pts.map(p => ({ x: p.x - activeBrush.x, y: p.y - activeBrush.y }));
      let closest = relPoints[0];
      let minDist = Infinity;
      for (const p of relPoints) {
        const dist = (p.x - pv.x) ** 2 + (p.y - pv.y) ** 2;
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      }
      pv = closest;
    }
  }

  const rpx = pv.x * cos - pv.y * sin;
  const rpy = pv.x * sin + pv.y * cos;
  return { x: rawPos.x - rpx, y: rawPos.y - rpy };
}

export function calculateGhostSnap(
  finalCenterPos: Point,
  activeBrush: Brush,
  brushAngle: number,
  scale: number,
  pieces: PlacedPiece[],
  obstacles: Obstacle[],
  surfaceWidth: number,
  surfaceHeight: number,
  isObstacleSnapActive: boolean
): Point {
  const snapThreshold_cm = SNAP_THRESHOLD_PX / scale;
  const isRectilinear = brushAngle % 90 === 0;

  const snapPoints: Point[] = [
    { x: 0, y: 0 },
    { x: surfaceWidth, y: 0 },
    { x: 0, y: surfaceHeight },
    { x: surfaceWidth, y: surfaceHeight },
  ];
  for (const pc of pieces) {
    for (const f of pc.fragments) {
      snapPoints.push(...f.points);
    }
  }
  if (isObstacleSnapActive) {
    for (const o of obstacles) {
      snapPoints.push(...o.points);
    }
  }

  const w = activeBrush.width;
  const h = activeBrush.height;
  const newCenter = { ...finalCenterPos };

  if (isRectilinear) {
    const effectiveWidth = (brushAngle / 90) % 2 === 0 ? w : h;
    const effectiveHeight = (brushAngle / 90) % 2 === 0 ? h : w;
    const ghostLeft = newCenter.x - effectiveWidth / 2;
    const ghostRight = newCenter.x + effectiveWidth / 2;
    const ghostTop = newCenter.y - effectiveHeight / 2;
    const ghostBottom = newCenter.y + effectiveHeight / 2;
    const ghostXEdges = [ghostLeft, ghostRight];
    const ghostYEdges = [ghostTop, ghostBottom];

    let bestDeltaX = 0, minXDist = snapThreshold_cm;
    let bestDeltaY = 0, minYDist = snapThreshold_cm;

    // 1. Siempre hacer snap a los bordes del lienzo (líneas infinitas)
    for (const edgeX of ghostXEdges) {
      if (Math.abs(edgeX - 0) < minXDist) { minXDist = Math.abs(edgeX - 0); bestDeltaX = 0 - edgeX; }
      if (Math.abs(edgeX - surfaceWidth) < minXDist) { minXDist = Math.abs(edgeX - surfaceWidth); bestDeltaX = surfaceWidth - edgeX; }
    }
    for (const edgeY of ghostYEdges) {
      if (Math.abs(edgeY - 0) < minYDist) { minYDist = Math.abs(edgeY - 0); bestDeltaY = 0 - edgeY; }
      if (Math.abs(edgeY - surfaceHeight) < minYDist) { minYDist = Math.abs(edgeY - surfaceHeight); bestDeltaY = surfaceHeight - edgeY; }
    }

    // 2. Hacer snap a los puntos de otras piezas solo si se superponen (proximidad ortogonal)
    for (const edgeX of ghostXEdges) {
      for (const p of snapPoints) {
        if (p.y >= ghostTop - snapThreshold_cm && p.y <= ghostBottom + snapThreshold_cm) {
          const dist = Math.abs(edgeX - p.x);
          if (dist < minXDist) { minXDist = dist; bestDeltaX = p.x - edgeX; }
        }
      }
    }
    for (const edgeY of ghostYEdges) {
      for (const p of snapPoints) {
        if (p.x >= ghostLeft - snapThreshold_cm && p.x <= ghostRight + snapThreshold_cm) {
          const dist = Math.abs(edgeY - p.y);
          if (dist < minYDist) { minYDist = dist; bestDeltaY = p.y - edgeY; }
        }
      }
    }

    newCenter.x += bestDeltaX;
    newCenter.y += bestDeltaY;
  } else {
    let bestSnap = { deltaX: 0, deltaY: 0, distance: snapThreshold_cm };
    const corners = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
    const rad = brushAngle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotatedCorners = corners.map(corner => ({
      x: newCenter.x + (corner.x * cos - corner.y * sin),
      y: newCenter.y + (corner.x * sin + corner.y * cos),
    }));
    for (const corner of rotatedCorners) {
      for (const snapPoint of snapPoints) {
        const deltaX = snapPoint.x - corner.x;
        const deltaY = snapPoint.y - corner.y;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < bestSnap.distance) { bestSnap = { deltaX, deltaY, distance }; }
      }
    }
    newCenter.x += bestSnap.deltaX;
    newCenter.y += bestSnap.deltaY;
  }
  return newCenter;
}
