import React from 'react';
import { MousePointer, Eraser } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ToolButton, PivotSelector, MeasureToolSelector } from './ToolbarComponents';
import { HelpDialog } from './HelpDialog';

export function EditorBottomBar({
  es,
  isDrawingObstacle,
  isMeasureToolOpen,
  setIsMeasureToolOpen,
  isPivotSelectorOpen,
  setIsPivotSelectorOpen
}: {
  es: any;
  isDrawingObstacle: boolean;
  isMeasureToolOpen: boolean;
  setIsMeasureToolOpen: (v: boolean) => void;
  isPivotSelectorOpen: boolean;
  setIsPivotSelectorOpen: (v: boolean) => void;
}) {
  return (
    <div className="h-20 flex items-center justify-center relative z-20 pointer-events-none bg-background/50 backdrop-blur-sm border-t">
      <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-full bg-background/95 shadow-lg border ring-1 ring-border/50 hover:scale-[1.01] transition-transform">

        {/* Seleccionar */}
        <ToolButton
          tooltip="Seleccionar (Ctrl+V)"
          Icon={MousePointer}
          isActive={!es.isEraserMode && !es.isMeasureMode && !isDrawingObstacle && !es.isHandMode && !es.activeBrush}
          onClick={() => es.handleToolSelect('brush')}
        />

        {/* Mover (Hand) */}
        <ToolButton
          tooltip="Mover (Ctrl+H)"
          isActive={es.isHandMode}
          onClick={() => {
            es.setIsHandMode(!es.isHandMode);
            if (!es.isHandMode) { es.setIsEraserMode(false); es.setIsMeasureMode(false); es.setActiveBrush(null); }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="h-6 w-6">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        </ToolButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Borrador */}
        <ToolButton
          tooltip="Borrador (Ctrl+E)"
          Icon={Eraser}
          isActive={es.isEraserMode}
          onClick={() => es.handleToolSelect('eraser')}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Medidor */}
        <MeasureToolSelector
          isMeasureMode={es.isMeasureMode}
          measureMode={es.measureMode}
          onToolSelect={es.handleToolSelect}
          isOpen={isMeasureToolOpen}
          onOpenChange={setIsMeasureToolOpen}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
            onClick={() => es.setViewZoom(Math.max(0.1, es.viewZoom - 0.1))}>
            <span className="text-lg font-bold">-</span>
          </Button>
          <span className="text-xs w-8 text-center">{Math.round(es.viewZoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
            onClick={() => es.setViewZoom(Math.min(5, es.viewZoom + 0.1))}>
            <span className="text-lg font-bold">+</span>
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Pivot selector */}
        <PivotSelector
          currentPivot={es.pivotPoint}
          onPivotChange={es.setPivotPoint}
          isOpen={isPivotSelectorOpen}
          onOpenChange={setIsPivotSelectorOpen}
        />
      </div>

      {/* Help button (absolute right) */}
      <div className="absolute right-4 pointer-events-auto">
        <HelpDialog />
      </div>
    </div>
  );
}
