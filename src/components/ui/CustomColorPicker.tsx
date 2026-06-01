'use client';

import { useState, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

// ---- HEX <-> HSL helpers ----
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))) * 255);
  };
  return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---- Presets ----
const PRESETS: { label: string; colors: { name: string; hex: string }[] }[] = [
  {
    label: 'Maderas',
    colors: [
      { name: 'Warm Oak', hex: '#C4956A' },
      { name: 'Walnut', hex: '#5C3D2E' },
      { name: 'Ash', hex: '#D4C5A9' },
      { name: 'Pine', hex: '#E8C99A' },
      { name: 'Mahogany', hex: '#7B3F2E' },
      { name: 'Cherry', hex: '#9B4523' },
    ],
  },
  {
    label: 'Piedras',
    colors: [
      { name: 'Calacatta', hex: '#F5F5F0' },
      { name: 'Slate', hex: '#708090' },
      { name: 'Granite Dark', hex: '#4A4A4A' },
      { name: 'Travertine', hex: '#D4C4A8' },
      { name: 'Marble Gray', hex: '#9E9E9E' },
      { name: 'Onyx', hex: '#1C1C1C' },
    ],
  },
  {
    label: 'Neutros',
    colors: [
      { name: 'Pure White', hex: '#FFFFFF' },
      { name: 'Off White', hex: '#F8F5EE' },
      { name: 'Cream', hex: '#FFFDD0' },
      { name: 'Light Gray', hex: '#D3D3D3' },
      { name: 'Charcoal', hex: '#36454F' },
      { name: 'Midnight', hex: '#191970' },
    ],
  },
];

// ---- Types ----
interface CustomColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

// ---- Component ----
export function CustomColorPicker({ value, onChange, className }: CustomColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const [hsl] = useState<[number, number, number]>(() => hexToHsl(value));

  const currentHsl = hexToHsl(value.startsWith('#') && value.length === 7 ? value : '#94a3b8');

  const handlePreset = useCallback((hex: string) => {
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleHexInput = useCallback((raw: string) => {
    setHexInput(raw);
    const full = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(full)) {
      onChange(full);
    }
  }, [onChange]);

  const handleHue = useCallback((hue: number) => {
    const [, s, l] = currentHsl;
    const newHex = hslToHex(hue, s || 50, l || 50);
    setHexInput(newHex);
    onChange(newHex);
  }, [currentHsl, onChange]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-8 w-10 rounded border border-zinc-600 cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${className ?? ''}`}
          style={{ background: value }}
          title="Seleccionar color"
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 bg-zinc-900/95 backdrop-blur border border-zinc-700 shadow-2xl"
        align="start"
        sideOffset={6}
      >
        {/* Preview */}
        <div
          className="w-full h-12 rounded-md mb-3 border border-zinc-700 transition-colors"
          style={{ background: value }}
        />

        {/* Presets */}
        {PRESETS.map(group => (
          <div key={group.label} className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
              {group.label}
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {group.colors.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => handlePreset(c.hex)}
                  className={`h-7 w-full rounded transition-all hover:scale-110 hover:shadow-md border-2 ${
                    value.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-white shadow-md scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Hue slider */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">Tono</p>
          <input
            type="range"
            min={0}
            max={360}
            value={currentHsl[0]}
            onChange={e => handleHue(Number(e.target.value))}
            className="w-full h-3 rounded-full cursor-pointer appearance-none"
            style={{
              background: 'linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)',
            }}
          />
        </div>

        {/* HEX input */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm font-mono">#</span>
          <Input
            value={hexInput.replace('#', '')}
            onChange={e => handleHexInput(`#${e.target.value}`)}
            maxLength={6}
            placeholder="RRGGBB"
            className="h-7 text-xs font-mono bg-zinc-800 border-zinc-700 text-zinc-100 flex-1"
          />
          <div
            className="h-7 w-7 rounded border border-zinc-700 flex-shrink-0"
            style={{ background: value }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
