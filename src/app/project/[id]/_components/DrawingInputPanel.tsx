'use client';

import { useEffect, useRef, useState } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ClipperLib from 'clipper-lib';
import { cn, convertFromCm } from '@/lib/utils';
import type { Point, Obstacle } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardFooter
} from '@/components/ui/card';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  ArrowUp, ArrowLeft, ArrowRight, ArrowDown, Undo, PlusCircle, X, Check, Save, Plus, Terminal
} from 'lucide-react';

type Unit = 'm' | 'cm';

const convertToCm = (val: number, unit: Unit): number => {
  return unit === 'm' ? val * 100 : val;
};

const DrawingInputSchema = z.object({
  initialX: z.string(),
  initialY: z.string(),
  length: z.string(),
  unit: z.enum(['m', 'cm']),
  angle: z.string(),
  name: z.string().optional(),
});

type DrawingInputFormValues = z.infer<typeof DrawingInputSchema>;

interface DrawingInputPanelProps {
  surfaceWidth: number;
  surfaceHeight: number;
  isEditing: boolean;
  onAddSegment: (newPoint: Point) => void;
  onUndoSegment: () => void;
  onUpdateStartPoint: (newPoint: Point) => void;
  onUpdateLastPoint: (newPoint: Point) => void;
  onFinish: (closeLoop: boolean, name?: string) => void;
  onCancel: () => void;
  onPreviewChange: (data: { length: number; angle: number } | null) => void;
  startPoint: Point | null;
  initialPoint: Point | null;
  anchorIndex?: number;
  obstacles?: Obstacle[];
  editingObstacleId?: string | null;
  editingObstacleName?: string;
  previewSegment: { length: number; angle: number } | null;
  currentPoints: Point[];
}

function AngleDial({ value, onChange }: { value: number; onChange: (angle: number) => void }) {
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

export function DrawingInputPanel({
  surfaceWidth,
  surfaceHeight,
  isEditing,
  onAddSegment,
  onUndoSegment,
  onUpdateStartPoint,
  onUpdateLastPoint,
  onFinish,
  onCancel,
  onPreviewChange,
  startPoint,
  initialPoint,
  anchorIndex = 0,
  obstacles = [],
  editingObstacleId,
  editingObstacleName,
  previewSegment,
  currentPoints,
}: DrawingInputPanelProps) {
  const form = useForm<DrawingInputFormValues>({
    resolver: zodResolver(DrawingInputSchema),
    defaultValues: {
      initialX: '0',
      initialY: '0',
      length: '1.00',
      unit: 'm',
      angle: '0',
      name: editingObstacleName || '',
    },
  });

  const { dirtyFields } = form.formState;

  // Sync form name with prop
  useEffect(() => {
    if (editingObstacleName) {
      form.setValue('name', editingObstacleName);
    }
  }, [editingObstacleName, form]);

  // Update form initial point (obstacle origin) when initialPoint prop changes
  useEffect(() => {
    if (initialPoint) {
      const newX = (initialPoint.x / 100).toFixed(4);
      const newY = ((surfaceHeight - initialPoint.y) / 100).toFixed(4);

      if (!dirtyFields.initialX) {
        form.setValue('initialX', newX, { shouldDirty: false });
      }
      if (!dirtyFields.initialY) {
        form.setValue('initialY', newY, { shouldDirty: false });
      }
    }
  }, [initialPoint, form, surfaceHeight, dirtyFields.initialX, dirtyFields.initialY]);

  const watchedValues = form.watch();
  const safeValues = {
    initialX: Number(watchedValues.initialX) || 0,
    initialY: Number(watchedValues.initialY) || 0,
    length: Number(watchedValues.length) || 0,
    angle: Number(watchedValues.angle) || 0,
  };

  // Effect to update start point (initial point of obstacle) when form values change
  useEffect(() => {
    if (initialPoint && (dirtyFields.initialX || dirtyFields.initialY)) {
      const valX = safeValues.initialX;
      const valY = safeValues.initialY;

      if (!isNaN(valX) && !isNaN(valY)) {
        const targetX_cm = valX * 100;
        const targetY_cm = surfaceHeight - (valY * 100);
        if (Math.abs(targetX_cm - initialPoint.x) > 0.001 || Math.abs(targetY_cm - initialPoint.y) > 0.001) {
          onUpdateStartPoint({ x: targetX_cm, y: targetY_cm });
        }
      }
    }
  }, [watchedValues.initialX, watchedValues.initialY, onUpdateStartPoint, surfaceHeight, anchorIndex, dirtyFields.initialX, dirtyFields.initialY]);

  // Sync form when previewSegment changes from outside (e.g. Canvas scroll wheel)
  useEffect(() => {
    if (previewSegment) {
      const currentAngle = parseFloat(form.getValues('angle') || '0');
      if (Math.abs(currentAngle - previewSegment.angle) > 0.01) {
        form.setValue('angle', previewSegment.angle.toFixed(1));
      }

      const currentUnit = form.getValues('unit') as Unit;
      const currentLength = convertToCm(parseFloat(form.getValues('length') || '0'), currentUnit);
      if (Math.abs(currentLength - previewSegment.length) > 0.01) {
        form.setValue('length', convertFromCm(previewSegment.length, currentUnit).toFixed(2));
      }
    }
  }, [previewSegment, form]);

  useEffect(() => {
    onPreviewChange({
      length: convertToCm(safeValues.length, watchedValues.unit as Unit),
      angle: safeValues.angle,
    });
  }, [watchedValues.length, watchedValues.unit, watchedValues.angle, onPreviewChange, safeValues.length, safeValues.angle]);

  useEffect(() => {
    return () => {
      onPreviewChange(null);
    };
  }, [onPreviewChange]);

  const onSubmit = (data: DrawingInputFormValues) => {
    if (!startPoint) return;
    const rawAngle = Number(data.angle) || 0;
    const rawLength = Number(data.length) || 0.1;
    const lengthCm = convertToCm(rawLength, data.unit as Unit);

    const angleRad = (rawAngle * Math.PI) / 180;
    const deltaX = lengthCm * Math.cos(angleRad);
    const deltaY = -1 * lengthCm * Math.sin(angleRad);

    const newPoint = { x: startPoint.x + deltaX, y: startPoint.y + deltaY };

    const margin = 0.01;
    if (newPoint.x < -margin || newPoint.x > surfaceWidth + margin ||
      newPoint.y < -margin || newPoint.y > surfaceHeight + margin) {
      alert('Error: El punto final del segmento está fuera de la superficie.');
      return;
    }

    onAddSegment(newPoint);
  };

  const setAngle = (angle: number) => {
    form.setValue('angle', angle.toString());
    form.trigger('angle');
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput && !e.currentTarget) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAngle(90);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAngle(270);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setAngle(180);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setAngle(0);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey) {
          const currentName = form.getValues('name');
          onFinish(true, currentName);
        } else {
          form.handleSubmit(onSubmit)();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onCancel, onFinish, setAngle, onSubmit]);

  return (
    <div className="absolute z-30 top-4 right-4">
      <Card className="w-72 shadow-2xl border-muted-foreground/10 bg-background/95 backdrop-blur-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-muted/5">
              <CardTitle className="text-xs font-bold flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full shadow-sm', isEditing ? 'bg-amber-500' : 'bg-blue-600')} />
                {isEditing ? 'Editar Obstáculo' : 'Dibujar Obstáculo'}
              </CardTitle>
              {isEditing && (
                <Badge variant="outline" className="text-[9px] uppercase tracking-wider h-4 px-1.5 border-amber-500/30 text-amber-600 bg-amber-50">
                  En edición
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Columna, Puerta..."
                        {...field}
                        className="h-8 text-xs bg-muted/20 focus:bg-background transition-colors"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="absolute top-0 left-[-4px] -translate-x-full w-48 pointer-events-none space-y-2 pr-2">
                {(() => {
                  if (!startPoint) return null;
                  const lengthCm = convertToCm(Number(watchedValues.length) || 0, watchedValues.unit as Unit);
                  const angleRad = ((Number(watchedValues.angle) || 0) * Math.PI) / 180;
                  const deltaX = lengthCm * Math.cos(angleRad);
                  const deltaY = -1 * lengthCm * Math.sin(angleRad);
                  const nextX = startPoint.x + deltaX;
                  const nextY = startPoint.y + deltaY;

                  const isStartOut = (safeValues.initialX > surfaceWidth / 100 || safeValues.initialX < 0 || safeValues.initialY > surfaceHeight / 100 || safeValues.initialY < 0);
                  const isNextOut = (nextX > surfaceWidth + 0.01 || nextX < -0.01 || nextY > surfaceHeight + 0.01 || nextY < -0.01);

                  let hasOverlap = false;
                  try {
                    const scaleFactor = 1000;

                    if (isEditing) {
                      if (currentPoints.length >= 2) {
                        const path = currentPoints.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));
                        const clipper = new ClipperLib.Clipper();
                        clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true);

                        for (const obs of obstacles) {
                          if (obs.id === editingObstacleId) continue;
                          const obsPath = obs.points.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));
                          clipper.AddPath(obsPath, ClipperLib.PolyType.ptClip, true);
                        }

                        const solution = new ClipperLib.Paths();
                        clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
                        if (solution.length > 0) hasOverlap = true;
                      }
                    } else {
                      const p1 = { X: Math.round(startPoint.x * scaleFactor), Y: Math.round(startPoint.y * scaleFactor) };
                      const p2 = { X: Math.round(nextX * scaleFactor), Y: Math.round(nextY * scaleFactor) };

                      const crossProduct = (a: any, b: any, c: any) => (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);
                      const onSegment = (p: any, a: any, b: any) =>
                        p.X >= Math.min(a.X, b.X) && p.X <= Math.max(a.X, b.X) &&
                        p.Y >= Math.min(a.Y, b.Y) && p.Y <= Math.max(a.Y, b.Y);

                      const segsIntersect = (a: any, b: any, c: any, d: any) => {
                        const d1 = crossProduct(c, d, a);
                        const d2 = crossProduct(c, d, b);
                        const d3 = crossProduct(a, b, c);
                        const d4 = crossProduct(a, b, d);
                        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
                        if (d1 === 0 && onSegment(a, c, d)) return true;
                        if (d2 === 0 && onSegment(b, c, d)) return true;
                        if (d3 === 0 && onSegment(c, a, b)) return true;
                        if (d4 === 0 && onSegment(d, a, b)) return true;
                        return false;
                      };

                      if (obstacles) {
                        for (const obs of obstacles) {
                          if (obs.id === editingObstacleId) continue;
                          const obsPath = obs.points.map(p => ({ X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor) }));

                          if (ClipperLib.Clipper.PointInPolygon(p1, obsPath) !== 0 ||
                            ClipperLib.Clipper.PointInPolygon(p2, obsPath) !== 0) {
                            hasOverlap = true;
                            break;
                          }

                          for (let i = 0; i < obsPath.length; i++) {
                            const e1 = obsPath[i];
                            const e2 = obsPath[(i + 1) % obsPath.length];
                            if (segsIntersect(p1, p2, e1, e2)) {
                              hasOverlap = true;
                              break;
                            }
                          }
                          if (hasOverlap) break;
                        }
                      }
                    }
                  } catch (e) {
                    console.error('Overlap check error:', e);
                  }

                  const warnings = [];
                  if (hasOverlap) {
                    warnings.push(
                      <Alert key="overlap" variant="destructive" className="py-2 px-3 shadow-xl border-2 border-red-500/50 bg-background/95 backdrop-blur-md pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="flex gap-2">
                          <PlusCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <AlertTitle className="text-[10px] font-bold uppercase tracking-tight text-red-600 leading-none">
                              Solapamiento
                            </AlertTitle>
                            <AlertDescription className="text-[9px] leading-tight text-muted-foreground">
                              Cruce de zona detectado.
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    );
                  }
                  if (isStartOut || isNextOut) {
                    warnings.push(
                      <Alert key="bounds" variant="destructive" className="py-2 px-3 shadow-xl border-2 border-destructive/50 bg-background/95 backdrop-blur-md pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="flex gap-2">
                          <Terminal className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <AlertTitle className="text-[10px] font-bold uppercase tracking-tight text-destructive leading-none">
                              Fuera de límites
                            </AlertTitle>
                            <AlertDescription className="text-[9px] leading-tight text-muted-foreground">
                              {isStartOut ? 'Punto inicial fuera.' : 'Punto final fuera.'}
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    );
                  }
                  return warnings;
                })()}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Punto Inicial</p>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="initialX"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">X (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                field.onChange(val);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="initialY"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Y (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                field.onChange(val);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {!isEditing && (
                <>
                  <Separator />
                  <FormItem>
                    <FormLabel>Ángulo (°)</FormLabel>
                    <div className="flex items-center gap-4 pt-1">
                      <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-fit bg-muted/10 p-1.5 rounded-full border border-muted-foreground/5 shadow-inner">
                        <div />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(90)}
                          title="Arriba (90°)"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <div />

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(180)}
                          title="Izquierda (180°)"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="h-8 w-8 flex items-center justify-center opacity-30">
                          <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(0)}
                          title="Derecha (0°)"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>

                        <div />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90"
                          onClick={() => setAngle(270)}
                          title="Abajo (270°)"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <div />
                      </div>

                      <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 rounded-xl border-dashed border border-muted-foreground/10 p-1.5 min-h-[120px] shadow-inner">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1 shadow-sm px-2 py-0.5 bg-background/50 rounded-full border border-muted-foreground/5">Ángulo</p>
                        <AngleDial
                          value={safeValues.angle}
                          onChange={(newAngle) => setAngle(newAngle)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="angle"
                        render={({ field }) => (
                          <FormControl className="flex-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              {...field}
                              className="hidden"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                  field.onChange(val);
                                }
                              }}
                            />
                          </FormControl>
                        )}
                      />
                    </div>
                  </FormItem>

                  <div className="flex gap-2">
                    <FormField control={form.control} name="length" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Longitud</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                field.onChange(val);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="unit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="m">m</SelectItem>
                            <SelectItem value="cm">cm</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="p-3 pt-0 grid grid-cols-2 gap-2">
              {!isEditing ? (
                <>
                  <Button type="button" variant="secondary" className="w-full h-9 text-xs" onClick={onUndoSegment}>
                    <Undo className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    Deshacer
                  </Button>
                  <Button type="submit" className="w-full h-9 text-xs bg-blue-500 hover:bg-blue-600 shadow-sm border-b-2 border-blue-700">
                    <PlusCircle className="mr-2 h-3.5 w-3.5" />
                    Añadir
                  </Button>
                  <Button type="button" variant="destructive" className="w-full h-9 text-xs bg-red-600 hover:bg-red-700 shadow-sm border-b-2 border-red-800" onClick={onCancel}>
                    <X className="mr-2 h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                  <Button type="button" className="w-full h-9 text-xs bg-blue-600 hover:bg-blue-700 font-bold shadow-md border-b-2 border-blue-800" onClick={() => onFinish(false, form.getValues('name'))}>
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Terminar
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="destructive" className="w-full h-9 text-xs bg-red-600 hover:bg-red-700 shadow-sm border-b-2 border-red-800" onClick={onCancel}>
                    <X className="mr-2 h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                  <Button type="button" className="w-full h-9 text-xs bg-amber-600 hover:bg-amber-700 shadow-md border-b-2 border-amber-800 font-bold" onClick={() => onFinish(false, form.getValues('name'))}>
                    <Save className="mr-2 h-3.5 w-3.5" />
                    Actualizar
                  </Button>
                </>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
