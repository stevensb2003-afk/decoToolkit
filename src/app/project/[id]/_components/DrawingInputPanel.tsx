'use client';

import { useEffect, useMemo } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  ArrowUp, ArrowLeft, ArrowRight, ArrowDown, Undo, PlusCircle, X, Check, Save
} from 'lucide-react';
import { AngleDial } from './Drawing/AngleDial';
import { useDrawingValidation } from '../_hooks/Drawing/useDrawingValidation';

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

  useEffect(() => {
    if (editingObstacleName) {
      form.setValue('name', editingObstacleName);
    }
  }, [editingObstacleName, form]);

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
  const safeValues = useMemo(() => ({
    initialX: Number(watchedValues.initialX) || 0,
    initialY: Number(watchedValues.initialY) || 0,
    length: Number(watchedValues.length) || 0,
    angle: Number(watchedValues.angle) || 0,
  }), [watchedValues.initialX, watchedValues.initialY, watchedValues.length, watchedValues.angle]);

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
  }, [safeValues.initialX, safeValues.initialY, onUpdateStartPoint, surfaceHeight, anchorIndex, dirtyFields.initialX, dirtyFields.initialY, initialPoint]);

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
  }, [safeValues.length, watchedValues.unit, safeValues.angle, onPreviewChange]);

  useEffect(() => {
    return () => {
      onPreviewChange(null);
    };
  }, [onPreviewChange]);

  const setAngle = (angle: number) => {
    form.setValue('angle', angle.toString());
    form.trigger('angle');
  };

  const nextPoint = useMemo(() => {
    if (!startPoint) return null;
    const lengthCm = convertToCm(safeValues.length, watchedValues.unit as Unit);
    const angleRad = (safeValues.angle * Math.PI) / 180;
    const deltaX = lengthCm * Math.cos(angleRad);
    const deltaY = -1 * lengthCm * Math.sin(angleRad);
    return { x: startPoint.x + deltaX, y: startPoint.y + deltaY };
  }, [startPoint, safeValues.length, watchedValues.unit, safeValues.angle]);

  const onSubmit = (data: DrawingInputFormValues) => {
    if (!nextPoint) return;
    const margin = 0.01;
    if (nextPoint.x < -margin || nextPoint.x > surfaceWidth + margin ||
      nextPoint.y < -margin || nextPoint.y > surfaceHeight + margin) {
      alert('Error: El punto final del segmento está fuera de la superficie.');
      return;
    }
    onAddSegment(nextPoint);
  };

  const { warnings } = useDrawingValidation(
    startPoint, nextPoint, surfaceWidth, surfaceHeight,
    safeValues.initialX, safeValues.initialY, isEditing,
    currentPoints, obstacles, editingObstacleId
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput && !e.currentTarget) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault(); setAngle(90);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); setAngle(270);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); setAngle(180);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); setAngle(0);
      } else if (e.key === 'Escape') {
        e.preventDefault(); onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey) onFinish(true, form.getValues('name'));
        else form.handleSubmit(onSubmit)();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onCancel, onFinish, setAngle, onSubmit, form]);

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
                      <Input placeholder="Ej. Columna, Puerta..." {...field} className="h-8 text-xs bg-muted/20 focus:bg-background transition-colors" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="absolute top-0 left-[-4px] -translate-x-full w-48 pointer-events-none space-y-2 pr-2">
                {warnings}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Punto Inicial</p>
                <div className="flex gap-2">
                  <FormField
                    control={form.control} name="initialX"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">X (m)</FormLabel>
                        <FormControl>
                          <Input type="text" inputMode="decimal" {...field} value={field.value ?? ''} onChange={(e) => { const val = e.target.value; if (val === '' || /^-?\d*\.?\d*$/.test(val)) field.onChange(val); }} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control} name="initialY"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Y (m)</FormLabel>
                        <FormControl>
                          <Input type="text" inputMode="decimal" {...field} value={field.value ?? ''} onChange={(e) => { const val = e.target.value; if (val === '' || /^-?\d*\.?\d*$/.test(val)) field.onChange(val); }} />
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
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90" onClick={() => setAngle(90)} title="Arriba (90°)">
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <div />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90" onClick={() => setAngle(180)} title="Izquierda (180°)">
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="h-8 w-8 flex items-center justify-center opacity-30">
                          <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                        </div>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90" onClick={() => setAngle(0)} title="Derecha (0°)">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <div />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-none shadow-sm transition-all active:scale-90" onClick={() => setAngle(270)} title="Abajo (270°)">
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <div />
                      </div>

                      <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 rounded-xl border-dashed border border-muted-foreground/10 p-1.5 min-h-[120px] shadow-inner">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1 shadow-sm px-2 py-0.5 bg-background/50 rounded-full border border-muted-foreground/5">Ángulo</p>
                        <AngleDial value={safeValues.angle} onChange={(newAngle) => setAngle(newAngle)} />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <FormField
                        control={form.control} name="angle"
                        render={({ field }) => (
                          <FormControl className="flex-1">
                            <Input type="text" inputMode="decimal" {...field} className="hidden" value={field.value ?? ''} onChange={(e) => { const val = e.target.value; if (val === '' || /^-?\d*\.?\d*$/.test(val)) field.onChange(val); }} />
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
                          <Input type="text" inputMode="decimal" {...field} value={field.value ?? ''} onChange={(e) => { const val = e.target.value; if (val === '' || /^-?\d*\.?\d*$/.test(val)) field.onChange(val); }} />
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
