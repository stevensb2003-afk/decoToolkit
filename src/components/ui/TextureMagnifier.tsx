'use client';

interface TextureMagnifierProps {
  previewUrl: string;
  magnifierPos: { x: number; y: number };
}

export function TextureMagnifier({ previewUrl, magnifierPos }: TextureMagnifierProps) {
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
          width: 96,
          height: 96,
          border: '2px solid var(--theme-primary, #10b981)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.8)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${previewUrl})`,
            backgroundSize: '300% 300%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${magnifierPos.x}% ${magnifierPos.y}%`,
          }}
        />
        {/* Crosshair */}
        <div className="absolute inset-0 pointer-events-none" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(16,185,129,0.8)', top: '50%' }} />
          <div style={{ position: 'absolute', height: '100%', width: 1, background: 'rgba(16,185,129,0.8)', left: '50%' }} />
          <div style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', background: '#10b981', top: 'calc(50% - 1.5px)', left: 'calc(50% - 1.5px)' }} />
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
