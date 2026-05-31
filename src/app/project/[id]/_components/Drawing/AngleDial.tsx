import React, { useEffect, useRef, useState } from 'react';

export function AngleDial({ value, onChange }: { value: number; onChange: (angle: number) => void }) {
  const dialRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateAngle = (e: MouseEvent | React.MouseEvent) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    if (e.shiftKey) {
      angle = Math.round(angle / 15) * 15;
      if (angle === 360) angle = 0;
    } else {
      angle = Math.round(angle);
    }

    onChange(angle);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    calculateAngle(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        calculateAngle(e);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const angleRad = (value * Math.PI) / 180;
  const handleX = 50 + 35 * Math.cos(-angleRad);
  const handleY = 50 + 35 * Math.sin(-angleRad);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        ref={dialRef}
        width="80"
        height="80"
        viewBox="0 0 100 100"
        className="cursor-pointer select-none touch-none"
        onMouseDown={handleMouseDown}
      >
        <circle cx="50" cy="50" r="45" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="50" y1="10" x2="50" y2="15"
            transform={`rotate(${deg} 50 50)`}
            className="stroke-muted-foreground/40"
            strokeWidth="2"
          />
        ))}
        <line
          x1="50" y1="50"
          x2={handleX} y2={handleY}
          className="stroke-blue-600"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="4" className="fill-blue-600" />
        <circle cx={handleX} cy={handleY} r="6" className="fill-blue-600 stroke-white" strokeWidth="2" />
      </svg>
      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
        {value}°
      </span>
    </div>
  );
}
