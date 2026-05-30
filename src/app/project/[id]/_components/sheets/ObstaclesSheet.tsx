'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { PenLine, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Project, Surface, Obstacle } from '@/lib/types';

// ---- Types ----
interface ObstaclesSheetProps {
  project: Project;
  obstacles: Obstacle[];
  activeSurface: Surface | null;
  onStartDrawing: () => void;
  onEditObstacle: (o: Obstacle) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteObstacle?: (id: string) => void;
}

// ---- Sub-components ----
interface ObstacleIconProps {
  className?: string;
}

export function ObstacleIcon({ className }: ObstacleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        <pattern
          id="obstacle-diagonal-hatch"
          width="3"
          height="3"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="3"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3"
        ry="3"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="0.5"
        ry="0.5"
        fill="url(#obstacle-diagonal-hatch)"
      />
    </svg>
  );
}
function ObstacleItem({
  obstacle,
  projectId,
  onEdit,
  onDeleted,
}: {
  obstacle: Obstacle;
  projectId: string;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const handleDelete = () => {
    onDeleted();
  };

  const vertexCount = obstacle.points.length;

  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className="h-7 w-7 rounded-sm bg-orange-100 dark:bg-orange-950 flex items-center justify-center flex-shrink-0">
        <ObstacleIcon className="h-3.5 w-3.5 text-orange-500" />
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-xs font-medium truncate">
          {obstacle.name ?? 'Obstáculo sin nombre'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {vertexCount} vértices
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar obstáculo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará &quot;{obstacle.name ?? 'este obstáculo'}&quot; de la superficie. Esta acción es permanente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ---- Main Component ----
export function ObstaclesSheet({
  project,
  obstacles,
  activeSurface,
  onStartDrawing,
  onEditObstacle,
  isOpen,
  onOpenChange,
  onDeleteObstacle,
}: ObstaclesSheetProps) {
  const surfaceObstacles = obstacles.filter(o => o.surfaceId === activeSurface?.id);

  const handleStartDrawing = () => {
    onOpenChange(false);
    onStartDrawing();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:max-w-[360px] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base flex items-center gap-2">
            <ObstacleIcon className="h-4 w-4 text-orange-500" />
            Obstáculos
          </SheetTitle>
          {activeSurface && (
            <p className="text-xs text-muted-foreground">
              Superficie: <span className="font-medium text-foreground">{activeSurface.name}</span>
            </p>
          )}
        </SheetHeader>

        <Separator />

        {/* Draw button */}
        <div className="px-4 py-3">
          <Button
            className="w-full gap-2"
            onClick={handleStartDrawing}
            disabled={!activeSurface}
          >
            <PenLine className="h-4 w-4" />
            Dibujar obstáculo
          </Button>
          {!activeSurface && (
            <p className="text-xs text-muted-foreground text-center mt-1.5">
              Selecciona una superficie primero
            </p>
          )}
        </div>

        <Separator />

        {/* Obstacles List */}
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lista de obstáculos
          </span>
          <Badge variant="outline" className="text-[10px]">
            {surfaceObstacles.length}
          </Badge>
        </div>

        <ScrollArea className="flex-1 px-4 pb-4">
          {surfaceObstacles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <ObstacleIcon className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                {activeSurface
                  ? 'Sin obstáculos en esta superficie'
                  : 'Selecciona una superficie'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {surfaceObstacles.map(o => (
                <ObstacleItem
                  key={o.id}
                  obstacle={o}
                  projectId={project.id}
                  onEdit={() => onEditObstacle(o)}
                  onDeleted={() => onDeleteObstacle?.(o.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
