'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PackagePlus, Pencil, Maximize, Ruler, ImageIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';
import type { DefaultMaterial, MaterialCategory, MaterialTexture, Unit } from '@/lib/types';
import { convertFromCm } from '@/lib/utils';
import { createDefaultMaterial, updateDefaultMaterial } from '@/lib/actions';
import { CustomColorPicker } from '@/components/ui/CustomColorPicker';
import { DefaultMaterialTextureUploader } from './DefaultMaterialTextureUploader';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Schema ────────────────────────────────────────────────────────────────────

const DimSchema = z.object({
  value: z.coerce.number({ invalid_type_error: 'Debe ser número' }).positive('Debe ser positivo'),
  unit: z.enum(['m', 'cm']),
});

const FormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  categoryId: z.string().optional(),
  width: DimSchema,
  height: DimSchema,
  color: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface MaterialFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: MaterialCategory[];
  defaultCategoryId?: string;
  material?: DefaultMaterial;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#1a1a1a' : '#ffffff';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaterialFormDialog({
  open,
  onOpenChange,
  categories,
  defaultCategoryId,
  material,
}: MaterialFormDialogProps) {
  const isEdit = Boolean(material);
  const [color, setColor] = useState<string>(material?.color || '#94a3b8');
  const [localTexture, setLocalTexture] = useState<MaterialTexture | undefined>(material?.texture);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: material?.name || '',
      categoryId: material?.categoryId || defaultCategoryId || '',
      width: { value: material ? convertFromCm(material.width, 'm') : 1.22, unit: 'm' },
      height: { value: material ? convertFromCm(material.height, 'm') : 2.44, unit: 'm' },
      color: material?.color || '#94a3b8',
    },
  });

  // Reset when dialog opens/closes or material changes
  useEffect(() => {
    if (open) {
      const c = material?.color || '#94a3b8';
      setColor(c);
      setLocalTexture(material?.texture);
      form.reset({
        name: material?.name || '',
        categoryId: material?.categoryId || defaultCategoryId || '',
        width: { value: material ? convertFromCm(material.width, 'm') : 1.22, unit: 'm' },
        height: { value: material ? convertFromCm(material.height, 'm') : 2.44, unit: 'm' },
        color: c,
      });
    }
  }, [open, material, defaultCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedName = form.watch('name');
  const watchedWidth = form.watch('width');
  const watchedHeight = form.watch('height');

  const onSubmit = async (data: FormValues) => {
    const categoryId = data.categoryId === '__none__' || !data.categoryId ? undefined : data.categoryId;
    
    // Sanitize texture for Server Action (convert Firebase Timestamp to pure JS Date)
    let safeTexture = localTexture ? { ...localTexture } : undefined;
    if (safeTexture?.uploadedAt) {
      if (typeof (safeTexture.uploadedAt as any).toDate === 'function') {
        safeTexture.uploadedAt = (safeTexture.uploadedAt as any).toDate();
      } else if ((safeTexture.uploadedAt as any).seconds !== undefined) {
        safeTexture.uploadedAt = new Date((safeTexture.uploadedAt as any).seconds * 1000) as any;
      }
    }

    const payload = { ...data, color, categoryId, texture: safeTexture };
    try {
      const result = isEdit && material
        ? await updateDefaultMaterial(material.id, payload)
        : await createDefaultMaterial(payload);
      if (result?.success) {
        toast({ title: isEdit ? 'Material actualizado' : 'Material creado' });
        onOpenChange(false);
      } else {
        toast({ title: 'Error', description: result?.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error inesperado', variant: 'destructive' });
    }
  };

  const widthCm = (() => {
    const w = form.watch('width');
    return w?.unit === 'm' ? (w.value || 0) * 100 : (w?.value || 0);
  })();
  const heightCm = (() => {
    const h = form.watch('height');
    return h?.unit === 'm' ? (h.value || 0) * 100 : (h?.value || 0);
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-5 w-5 text-primary" /> : <PackagePlus className="h-5 w-5 text-primary" />}
            {isEdit ? 'Editar Material' : 'Nuevo Material'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form id="material-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-1">
            {/* Preview */}
            <motion.div
              animate={{ backgroundColor: color }}
              transition={{ duration: 0.3 }}
              className="relative h-20 rounded-xl overflow-hidden border border-border/40 shadow-inner flex items-center justify-center"
              style={{ background: color }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/10" />
              <div className="relative text-center">
                <p className="font-semibold text-sm" style={{ color: getTextColor(color) }}>
                  {watchedName || 'Nombre del Material'}
                </p>
                {(watchedWidth?.value && watchedHeight?.value) && (
                  <p className="text-[11px] opacity-75 mt-0.5" style={{ color: getTextColor(color) }}>
                    {watchedWidth.value} {watchedWidth.unit} × {watchedHeight.value} {watchedHeight.unit}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre Comercial</FormLabel>
                <FormControl>
                  <Input placeholder="ej. Lámina PVC Blanca" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Category */}
            <FormField control={form.control} name="categoryId" render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || '__none__'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="width" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> Ancho</FormLabel>
                  <div className="flex gap-1.5">
                    <FormControl>
                      <Input type="number" step="any" {...form.register('width.value')} />
                    </FormControl>
                    <Select onValueChange={u => form.setValue('width.unit', u as Unit)} defaultValue={field.value.unit}>
                      <SelectTrigger className="w-[72px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="cm">cm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="height" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> Alto</FormLabel>
                  <div className="flex gap-1.5">
                    <FormControl>
                      <Input type="number" step="any" {...form.register('height.value')} />
                    </FormControl>
                    <Select onValueChange={u => form.setValue('height.unit', u as Unit)} defaultValue={field.value.unit}>
                      <SelectTrigger className="w-[72px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="cm">cm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Color</label>
              <div className="flex items-center gap-3">
                <CustomColorPicker value={color} onChange={c => { setColor(c); form.setValue('color', c); }} />
                <span className="text-xs font-mono text-muted-foreground">{color.toUpperCase()}</span>
              </div>
            </div>

            {/* Texture */}
            <div className="space-y-1.5 pt-1">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-primary/70" />
                Textura
              </label>
              <DefaultMaterialTextureUploader
                materialId={material?.id || 'new'}
                currentTexture={localTexture}
                materialWidth={widthCm}
                materialHeight={heightCm}
                onTextureChange={tex => setLocalTexture(tex ?? undefined)}
              />
            </div>
          </form>
        </Form>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button type="submit" form="material-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Material'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
