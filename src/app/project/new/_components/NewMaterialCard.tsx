'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomColorPicker } from '@/components/ui/CustomColorPicker';
import type { Material } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NewMaterialCardProps {
  material: Material;
  index: number;
  onChange: (m: Material) => void;
  onDelete: () => void;
}

// ── Catalog card (read-only except orientation) ─────────────────────────────
function CatalogMaterialCard({
  material,
  onChange,
  onDelete,
}: Omit<NewMaterialCardProps, 'index'>) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm hover:border-border transition-all group">
      {/* Texture/Color Preview */}
      <div
        className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-border/40 shadow-sm"
        style={{ background: material.color }}
      >
        {material.texture?.url && (
          <img
            src={material.texture.url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{material.name}</span>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 flex items-center gap-1 shrink-0"
          >
            <Lock className="h-2.5 w-2.5" />
            Catálogo
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {material.width} × {material.height} cm
        </p>
        <Select
          value={material.installationOrientation}
          onValueChange={(v) =>
            onChange({ ...material, installationOrientation: v as Material['installationOrientation'] })
          }
        >
          <SelectTrigger className="h-6 w-32 text-xs border-border/50 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Vertical" className="text-xs">Vertical</SelectItem>
            <SelectItem value="Horizontal" className="text-xs">Horizontal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Delete */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Custom (editable) card ───────────────────────────────────────────────────
function CustomMaterialCard({
  material,
  onChange,
  onDelete,
}: Omit<NewMaterialCardProps, 'index'>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/20 backdrop-blur-sm p-3 space-y-3 hover:border-border/80 transition-all">
      {/* Top row */}
      <div className="flex items-center gap-2">
        {/* Color preview/picker */}
        <CustomColorPicker
          value={material.color}
          onChange={(color) => onChange({ ...material, color })}
        />
        <Input
          placeholder="Nombre del material…"
          value={material.name}
          onChange={(e) => onChange({ ...material, name: e.target.value })}
          className="flex-1 h-8 text-sm bg-transparent"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((p) => !p)}
          title="Dimensiones y orientación"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded: dimensions + orientation */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-3 gap-2 pt-1"
        >
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Ancho (cm)
            </Label>
            <Input
              type="number"
              value={material.width}
              onChange={(e) => onChange({ ...material, width: Number(e.target.value) })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Alto (cm)
            </Label>
            <Input
              type="number"
              value={material.height}
              onChange={(e) => onChange({ ...material, height: Number(e.target.value) })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Orientación
            </Label>
            <Select
              value={material.installationOrientation}
              onValueChange={(v) =>
                onChange({ ...material, installationOrientation: v as Material['installationOrientation'] })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vertical" className="text-xs">Vertical</SelectItem>
                <SelectItem value="Horizontal" className="text-xs">Horizontal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Exported wrapper ─────────────────────────────────────────────────────────
export function NewMaterialCard({ material, index, onChange, onDelete }: NewMaterialCardProps) {
  const isFromCatalog =
    !!material.defaultMaterialId && material.defaultMaterialId !== 'custom';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {isFromCatalog ? (
        <CatalogMaterialCard material={material} onChange={onChange} onDelete={onDelete} />
      ) : (
        <CustomMaterialCard material={material} onChange={onChange} onDelete={onDelete} />
      )}
    </motion.div>
  );
}
