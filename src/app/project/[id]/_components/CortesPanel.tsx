'use client';

import { useState, useMemo } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import { cn, convertFromCm, calculatePolygonArea } from '@/lib/utils';
import type { Material, GroupedRemnant, Brush } from '@/lib/types';

interface MaterialRemnantGroup {
  material: Material;
  remnants: GroupedRemnant[];
}

interface CortesPanelProps {
  groupedRemnantsByMaterial: Map<string, MaterialRemnantGroup>;
  activeBrush: Brush | null;
  onSelectRemnant: (remnant: GroupedRemnant) => void;
}

// ── RemnantBrush: texto compacto + hover Popover con SVG ─────────────────────
function RemnantBrush({
  remnant,
  materialColor,
  isActive,
  onSelect,
}: {
  remnant: GroupedRemnant;
  materialColor: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizedPoints = useMemo(() => {
    const frags = remnant.fragments ?? [{ id: 'legacy', points: remnant.points }];
    if (!frags.length) return { width: 0, height: 0, minX: 0, minY: 0 };
    const allPts = frags.flatMap(f => f.points);
    const xs = allPts.map(p => p.x);
    const ys = allPts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { width: maxX - minX, height: maxY - minY, minX, minY };
  }, [remnant.fragments, remnant.points]);

  const PREVIEW_SIZE = 100;
  const svgWidth = normalizedPoints.width >= normalizedPoints.height
    ? PREVIEW_SIZE
    : (normalizedPoints.width / normalizedPoints.height) * PREVIEW_SIZE;
  const svgHeight = normalizedPoints.height > normalizedPoints.width
    ? PREVIEW_SIZE
    : (normalizedPoints.height / normalizedPoints.width) * PREVIEW_SIZE;

  const netArea = Math.abs(
    (remnant.fragments ?? [{ id: 'legacy', points: remnant.points }])
      .reduce((sum, f) => sum + calculatePolygonArea(f.points), 0) / 10000
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          onClick={onSelect}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className={cn(
            'w-full p-2 rounded-md text-left transition-all cursor-pointer flex items-center justify-between',
            isActive ? 'bg-primary/20' : 'hover:bg-muted'
          )}
        >
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: materialColor }} />
            <div className="flex flex-col gap-0.5">
              <p className="font-mono text-sm font-bold leading-none">
                {convertFromCm(remnant.width, 'm').toFixed(2)}m × {convertFromCm(remnant.height, 'm').toFixed(2)}m
              </p>
              <p className="font-mono text-[10px] text-muted-foreground leading-none uppercase tracking-wider">
                Área: {netArea.toFixed(2)} m²
              </p>
            </div>
          </div>
          {remnant.count > 1 && (
            <Badge variant="secondary" className="font-semibold">{remnant.count}</Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-auto p-2">
        <div className="flex flex-col items-center gap-2">
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${normalizedPoints.width} ${normalizedPoints.height}`}
          >
            <path
              fill={materialColor}
              fillRule="evenodd"
              className="opacity-70"
              d={(remnant.fragments ?? [{ id: 'legacy', points: remnant.points }]).map(f =>
                'M ' + f.points.map(p => `${p.x - normalizedPoints.minX} ${p.y - normalizedPoints.minY}`).join(' L ') + ' Z'
              ).join(' ')}
            />
          </svg>
          <p className="text-xs font-mono">
            {convertFromCm(remnant.width, 'm').toFixed(2)}m × {convertFromCm(remnant.height, 'm').toFixed(2)}m
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CortesPanel({ groupedRemnantsByMaterial, activeBrush, onSelectRemnant }: CortesPanelProps) {
  const groups = Array.from(groupedRemnantsByMaterial.values());

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Cortes</h2>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">No hay cortes disponibles.</p>
      ) : (
        groups.map(({ material, remnants }) => (
          <Collapsible key={material.id} defaultOpen>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: material.color }} />
                  <span className="font-semibold text-sm">{material.name}</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-2 space-y-1">
                {remnants.map(remnant => (
                  <RemnantBrush
                    key={remnant.shapeId}
                    remnant={remnant}
                    materialColor={material.color}
                    isActive={activeBrush?.type === 'remnant' && activeBrush.shapeId === remnant.shapeId}
                    onSelect={() => onSelectRemnant(remnant)}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))
      )}
    </div>
  );
}
