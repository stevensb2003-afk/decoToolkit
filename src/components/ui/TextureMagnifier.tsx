'use client';

const MAGNIFIER_SIZE = 96;
const ZOOM = 3;

interface TextureMagnifierProps {
  previewUrl: string;
  magnifierPos: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
}

/**
 * Pixel-perfect magnifier.
 * Uses the REAL container pixel dimensions so the crosshair maps to the exact
 * cursor position, regardless of the image aspect ratio or object-contain letterboxing.
 */
export function TextureMagnifier({ previewUrl, magnifierPos, containerWidth, containerHeight }: TextureMagnifierProps) {
  const zoomedW = containerWidth * ZOOM;
  const zoomedH = containerHeight * ZOOM;

  // Center of the magnifier circle = cursor position inside the zoomed virtual canvas
  const bgLeft = MAGNIFIER_SIZE / 2 - (magnifierPos.x / 100) * zoomedW;
  const bgTop  = MAGNIFIER_SIZE / 2 - (magnifierPos.y / 100) * zoomedH;

  // Magnifier is statically positioned in the absolute center of the image container
  const magLeft = containerWidth / 2 - MAGNIFIER_SIZE / 2;
  const magTop = containerHeight / 2 - MAGNIFIER_SIZE / 2;

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: `${magLeft}px`,
        top: `${magTop}px`,
      }}
    >
      <div
        className="relative rounded-full overflow-hidden shadow-2xl"
        style={{
          width: MAGNIFIER_SIZE,
          height: MAGNIFIER_SIZE,
          border: '2px solid var(--theme-primary, #10b981)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.8)',
        }}
      >
        {/* Zoomed image — uses real container size × ZOOM to preserve object-contain letterboxing */}
        <div
          style={{
            position: 'absolute',
            left: bgLeft,
            top: bgTop,
            width: zoomedW,
            height: zoomedH,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="w-full h-full object-contain"
            style={{ pointerEvents: 'none' }}
          />
        </div>

        {/* Crosshair — always centered in the circle = exact cursor pixel */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(16,185,129,0.8)', top: '50%' }} />
          <div style={{ position: 'absolute', height: '100%', width: 1, background: 'rgba(16,185,129,0.8)', left: '50%' }} />
          <div style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', background: '#10b981', top: 'calc(50% - 2px)', left: 'calc(50% - 2px)' }} />
        </div>
      </div>
      <div className="mt-1 text-center">
        <span className="text-[9px] font-mono text-emerald-400 bg-black/70 rounded px-1.5 py-0.5">
          {Math.round(magnifierPos.x)}%, {Math.round(magnifierPos.y)}%
        </span>
      </div>
    </div>
  );
}
