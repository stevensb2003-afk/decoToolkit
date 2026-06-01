'use client';

const MAGNIFIER_SIZE = 96;
const ZOOM = 3;

interface TextureMagnifierProps {
  previewUrl: string;
  magnifierPos: { x: number; y: number };
}

export function TextureMagnifier({ previewUrl, magnifierPos }: TextureMagnifierProps) {
  // Pixel-precise calculation: centers crosshair exactly on the dragged corner
  const posX = MAGNIFIER_SIZE / 2 - (magnifierPos.x / 100) * MAGNIFIER_SIZE * ZOOM;
  const posY = MAGNIFIER_SIZE / 2 - (magnifierPos.y / 100) * MAGNIFIER_SIZE * ZOOM;

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: `${magnifierPos.x}%`,
        top: `${magnifierPos.y}%`,
        transform: 'translate(-50%, -130%)',
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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${previewUrl})`,
            backgroundSize: `${MAGNIFIER_SIZE * ZOOM}px ${MAGNIFIER_SIZE * ZOOM}px`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${posX}px ${posY}px`,
          }}
        />
        {/* Crosshair */}
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
