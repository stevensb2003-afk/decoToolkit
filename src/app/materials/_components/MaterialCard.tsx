'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, Maximize, Ruler, ImageIcon, ImageOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { DefaultMaterial, MaterialCategory } from '@/lib/types';
import { convertFromCm } from '@/lib/utils';
import { deleteDefaultMaterial } from '@/lib/actions';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MaterialFormDialog } from './MaterialFormDialog';

// ── Animation ─────────────────────────────────────────────────────────────────

export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#1a1a1a' : '#ffffff';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MaterialCardProps {
  material: DefaultMaterial;
  categories: MaterialCategory[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaterialCard({ material, categories }: MaterialCardProps) {
  const [editOpen, setEditOpen] = useState(false);

  const hasTexture = Boolean(material.texture?.url);
  const hasColor = Boolean(material.color);
  const categoryName = categories.find(c => c.id === material.categoryId)?.name;

  const handleDelete = async () => {
    try {
      const result = await deleteDefaultMaterial(material.id);
      if (!result?.success) {
        toast({ title: 'Error', description: result?.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error inesperado', variant: 'destructive' });
    }
  };

  // ── Header background ─────────────────────────────────────────────────────

  const headerStyle = hasTexture
    ? { backgroundImage: `url(${material.texture!.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : hasColor
    ? { backgroundColor: material.color }
    : {};

  const headerClass = !hasTexture && !hasColor
    ? 'bg-gradient-to-br from-slate-600 to-slate-800 dark:from-zinc-700 dark:to-zinc-900'
    : '';

  const textColor = hasColor && !hasTexture ? getTextColor(material.color!) : '#ffffff';

  return (
    <>
      <motion.div variants={itemVariants} layoutId={`card-${material.id}`} className="h-full">
        <div className="group overflow-hidden border border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 flex flex-col rounded-2xl h-full">

          {/* ── Visual Header ──────────────────────────────────────────────── */}
          <div className={`relative h-[72px] overflow-hidden ${headerClass}`} style={headerStyle}>
            {/* Overlay */}
            {(hasTexture || !hasColor) && <div className="absolute inset-0 bg-black/40" />}
            {hasColor && !hasTexture && <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/15" />}

            {/* Name */}
            <div className="absolute inset-0 flex flex-col justify-center pl-4 pr-20 py-2.5">
              <p className="font-semibold text-sm leading-tight line-clamp-2 drop-shadow-sm" style={{ color: textColor }}>
                {material.name}
              </p>
              {categoryName && (
                <p className="text-[10px] opacity-75 mt-0.5 truncate" style={{ color: textColor }}>
                  {categoryName}
                </p>
              )}
            </div>

            {/* Hover actions */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 transition-all duration-200 gap-1 bg-background/95 backdrop-blur-md rounded-full p-1 border border-border/50 shadow-md">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary rounded-full hover:bg-primary/10 transition-colors" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-full hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar material?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. <strong className="text-foreground">{material.name}</strong> será eliminado permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      Sí, eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* ── Body ─────────────────────────────────────────────────────────── */}
          <div className="p-3 flex flex-col gap-2 flex-1">
            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col bg-muted/40 rounded-lg p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
                  <Maximize className="h-3 w-3 text-primary/60" /> Ancho
                </span>
                <span className="text-base font-semibold leading-tight">
                  {convertFromCm(material.width, 'm')}
                  <span className="text-xs text-muted-foreground font-normal ml-1">m</span>
                </span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">{material.width} cm</span>
              </div>
              <div className="flex flex-col bg-muted/40 rounded-lg p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
                  <Ruler className="h-3 w-3 text-primary/60" /> Alto
                </span>
                <span className="text-base font-semibold leading-tight">
                  {convertFromCm(material.height, 'm')}
                  <span className="text-xs text-muted-foreground font-normal ml-1">m</span>
                </span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">{material.height} cm</span>
              </div>
            </div>

            {/* Footer row — only the badge */}
            <div className="flex items-center mt-auto pt-1">
              {hasTexture ? (
                <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5">
                  <ImageIcon className="h-2.5 w-2.5" /> Con textura
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground bg-muted/30 px-1.5 py-0.5">
                  <ImageOff className="h-2.5 w-2.5" /> Sin textura
                </Badge>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <MaterialFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        categories={categories}
        material={material}
      />
    </>
  );
}
