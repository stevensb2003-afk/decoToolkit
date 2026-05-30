'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Material } from '@/lib/types';

// ---- Types ----
interface SummaryPanelProps {
  summaryViewMode: 'surface' | 'material';
  setSummaryViewMode: (mode: 'surface' | 'material') => void;
  areaToCover: number;
  coveredArea: number;
  projectAreaToCover: number;
  projectCoveredArea: number;
  wasteArea: number;
  materials: Material[];
  materialUsage: Map<string, number>;
}

// ---- Sub-components ----
function MetricRow({ label, value, unit = 'm²', highlight = false }: {
  label: string;
  value: number;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-destructive' : 'text-foreground'}`}>
        {value.toFixed(2)} {unit}
      </span>
    </div>
  );
}

function MaterialUsageItem({ material, sheets }: { material: Material; sheets: number }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className="h-3 w-3 rounded-sm flex-shrink-0 border border-border"
        style={{ backgroundColor: material.color }}
      />
      <span className="text-xs flex-1 truncate text-foreground">{material.name}</span>
      <Badge variant="secondary" className="text-xs px-1.5 py-0">
        {sheets} {sheets === 1 ? 'hoja' : 'hojas'}
      </Badge>
    </div>
  );
}

// ---- Main Component ----
export function SummaryPanel({
  summaryViewMode,
  setSummaryViewMode,
  areaToCover,
  coveredArea,
  projectAreaToCover,
  projectCoveredArea,
  wasteArea,
  materials,
  materialUsage,
}: SummaryPanelProps) {
  const isSurface = summaryViewMode === 'surface';
  const totalArea = isSurface ? areaToCover : projectAreaToCover;
  const covered = isSurface ? coveredArea : projectCoveredArea;
  const remaining = Math.max(0, totalArea - covered);
  const coveragePercent = totalArea > 0 ? Math.min(100, (covered / totalArea) * 100) : 0;

  const materialsWithUsage = materials.filter(m => (materialUsage.get(m.id) ?? 0) > 0);

  return (
    <div className="flex flex-col h-full bg-background border-r border-border w-64 flex-shrink-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Resumen
        </h2>
        <div className="flex rounded-md overflow-hidden border border-border text-xs">
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 h-7 rounded-none text-xs ${isSurface ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            onClick={() => setSummaryViewMode('surface')}
          >
            Superficie
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 h-7 rounded-none text-xs ${!isSurface ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            onClick={() => setSummaryViewMode('material')}
          >
            Proyecto
          </Button>
        </div>
      </div>

      <Separator />

      {/* Metrics */}
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Métricas</p>
        <MetricRow label="Área total" value={totalArea / 10000} />
        <MetricRow label="Área cubierta" value={covered / 10000} />
        <MetricRow label="Por cubrir" value={remaining / 10000} highlight={remaining > 0} />
        <MetricRow label="Desperdicio" value={wasteArea / 10000} highlight={wasteArea > 0} />

        {/* Coverage bar */}
        <div className="mt-2 mb-1">
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
            <span>Cobertura</span>
            <span>{coveragePercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Material Usage */}
      <div className="px-3 py-2 flex-1 overflow-y-auto">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Materiales usados
        </p>
        {materialsWithUsage.length === 0 ? (
          <p className="text-xs text-muted-foreground italic mt-2">Sin materiales colocados</p>
        ) : (
          materialsWithUsage.map(m => (
            <MaterialUsageItem
              key={m.id}
              material={m}
              sheets={materialUsage.get(m.id) ?? 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
