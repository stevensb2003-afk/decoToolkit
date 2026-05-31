import React from 'react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight,
  Ruler, Square, LineChart, Grid3X3,
} from 'lucide-react';
import type { PivotPoint, MeasureMode } from '@/lib/types';

export function ToolButton({
  tooltip, Icon, isActive, onClick, children,
}: {
  tooltip: string;
  Icon?: React.ElementType;
  isActive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-full h-12 w-12',
              isActive && 'bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary'
            )}
            onClick={onClick}
          >
            {Icon && <Icon className="h-6 w-6" />}
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{tooltip}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const pivotIcons: Record<PivotPoint, React.ElementType> = {
  topLeft: ArrowUpLeft, topRight: ArrowUpRight,
  bottomLeft: ArrowDownLeft, bottomRight: ArrowDownRight,
};

export function PivotSelector({ currentPivot, onPivotChange, isOpen, onOpenChange }: {
  currentPivot: PivotPoint;
  onPivotChange: (p: PivotPoint) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const CurrentIcon = pivotIcons[currentPivot];
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-12 w-12"
                onClick={() => onOpenChange(!isOpen)}>
                <CurrentIcon className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Punto de Pivote (Ctrl+A)</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-1">
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(pivotIcons) as PivotPoint[]).map(pivot => {
            const Icon = pivotIcons[pivot];
            return (
              <Button key={pivot} variant={currentPivot === pivot ? 'secondary' : 'ghost'}
                size="icon" className="h-10 w-10"
                onClick={() => { onPivotChange(pivot); onOpenChange(false); }}>
                <Icon className="h-5 w-5" />
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MeasureToolSelector({ isMeasureMode, measureMode, onToolSelect, isOpen, onOpenChange }: {
  isMeasureMode: boolean;
  measureMode: MeasureMode;
  onToolSelect: (tool: 'brush' | 'eraser' | 'measure' | 'hand', mode?: MeasureMode) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon"
                className={cn('rounded-full h-12 w-12', isMeasureMode && 'bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary')}
                onClick={() => {
                  if (!isMeasureMode) onToolSelect('measure');
                  onOpenChange(!isOpen);
                }}>
                <Ruler className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Medir (Ctrl+R)</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-auto p-1">
        <div className="grid grid-cols-1 gap-1">
          <Button variant={measureMode === 'area' ? 'secondary' : 'ghost'}
            className="justify-start" onClick={() => { onToolSelect('measure', 'area'); onOpenChange(false); }}>
            <Square className="mr-2 h-4 w-4" /> Medir Área
          </Button>
          <Button variant={measureMode === 'distance' ? 'secondary' : 'ghost'}
            className="justify-start" onClick={() => { onToolSelect('measure', 'distance'); onOpenChange(false); }}>
            <LineChart className="mr-2 h-4 w-4" /> Medir Distancia
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GuideSettingsPopover({
  showGrid, gridSpacing, onShowGridChange, onGridSpacingChange, isGridSnapActive, onGridSnapChange
}: {
  showGrid: boolean;
  gridSpacing: number;
  onShowGridChange: (v: boolean) => void;
  onGridSpacingChange: (v: number) => void;
  isGridSnapActive: boolean;
  onGridSnapChange: (v: boolean) => void;
}) {
  const predefinedSpacings = [
    { label: '10cm', value: 10 },
    { label: '25cm', value: 25 },
    { label: '50cm', value: 50 },
    { label: '1m', value: 100 },
    { label: '2m', value: 200 },
    { label: '5m', value: 500 },
  ];

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant={showGrid ? 'secondary' : 'outline'} size="icon" className="flex-shrink-0">
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Configurar cuadrícula</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-64 p-4 rounded-xl shadow-lg border-muted" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Mostrar Guías</h4>
            <Switch
              checked={showGrid}
              onCheckedChange={onShowGridChange}
              className="scale-110"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alinear a Cuadrícula</Label>
            <Switch
              checked={isGridSnapActive}
              onCheckedChange={onGridSnapChange}
              disabled={!showGrid}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Espaciado</Label>
            <div className="grid grid-cols-2 gap-2">
              {predefinedSpacings.map(sp => (
                <Button
                  key={sp.value}
                  variant={gridSpacing === sp.value ? "default" : "secondary"}
                  className={`h-9 text-sm font-medium ${gridSpacing === sp.value ? "bg-[#38bdf8] hover:bg-[#0ea5e9] text-white" : "bg-muted/50 hover:bg-muted text-foreground"}`}
                  onClick={() => onGridSpacingChange(sp.value)}
                >
                  {sp.label}
                </Button>
              ))}
            </div>
          </div>
          
          <p className="text-[11px] text-muted-foreground italic leading-tight mt-2">
            Las guías visuales ayudan a medir distancias y alinear elementos proporcionalmente.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
