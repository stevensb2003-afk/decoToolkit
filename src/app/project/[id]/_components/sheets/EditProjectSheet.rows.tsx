'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { CustomColorPicker } from '@/components/ui/CustomColorPicker';
import { TextureUploader } from '@/components/ui/TextureUploader';
import type { Surface, Material } from '@/lib/types';

// ---- SurfaceRow ----
export function SurfaceRow({
  surface,
  onChange,
  onDelete,
}: {
  surface: Surface;
  onChange: (s: Surface) => void;
  onDelete: () => void;
}) {
  const [wStr, setWStr] = useState((surface.width / 100).toString());
  const [hStr, setHStr] = useState((surface.height / 100).toString());

  useEffect(() => { setWStr((surface.width / 100).toString()); }, [surface.width]);
  useEffect(() => { setHStr((surface.height / 100).toString()); }, [surface.height]);

  return (
    <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
      <Input
        placeholder="Nombre"
        value={surface.name}
        onChange={e => onChange({ ...surface, name: e.target.value })}
        className="h-8 text-xs"
      />
      <Input
        type="number" step="0.01" placeholder="Ancho (m)"
        value={wStr}
        onChange={e => setWStr(e.target.value)}
        onBlur={e => {
          const num = Number(e.target.value);
          if (!isNaN(num)) onChange({ ...surface, width: Math.round(num * 100) });
          else setWStr((surface.width / 100).toString());
        }}
        className="h-8 text-xs"
      />
      <Input
        type="number" step="0.01" placeholder="Alto (m)"
        value={hStr}
        onChange={e => setHStr(e.target.value)}
        onBlur={e => {
          const num = Number(e.target.value);
          if (!isNaN(num)) onChange({ ...surface, height: Math.round(num * 100) });
          else setHStr((surface.height / 100).toString());
        }}
        className="h-8 text-xs"
      />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

// ---- MaterialRow ----
export function MaterialRow({
  material,
  projectId,
  onChange,
  onDelete,
}: {
  material: Material;
  projectId: string;
  onChange: (m: Material) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isFromCatalog = !!material.defaultMaterialId && material.defaultMaterialId !== 'custom';

  // ── CATALOG: read-only, only orientation editable ─────────────────────────
  if (isFromCatalog) {
    return (
      <div className="flex items-start gap-2.5 p-2.5 rounded-md border border-border bg-muted/30">
        {/* Color/Texture preview */}
        <div
          className="w-12 h-12 rounded-lg overflow-hidden shrink-0"
          style={{ background: material.color }}
        >
          {material.texture?.url && (
            <img src={material.texture.url} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{material.name}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0">Del catálogo</Badge>
          </div>
          <span className="text-xs text-muted-foreground block">
            {material.width} × {material.height} cm
          </span>
          <Select
            value={material.installationOrientation}
            onValueChange={v => onChange({ ...material, installationOrientation: v as Material['installationOrientation'] })}
          >
            <SelectTrigger className="h-7 w-36 text-xs">
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
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── CUSTOM: fully editable ────────────────────────────────────────────────
  return (
    <div className="space-y-1.5 p-2 rounded-md border border-border bg-muted/30">
      {/* Basic row */}
      <div className="flex gap-2">
        <Input
          placeholder="Nombre del material"
          value={material.name}
          onChange={e => onChange({ ...material, name: e.target.value })}
          className="h-8 text-xs flex-1"
        />
        <CustomColorPicker
          value={material.color}
          onChange={color => onChange({ ...material, color })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setExpanded(p => !p)}
          title={expanded ? 'Ocultar textura' : 'Añadir textura'}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {/* Dimensions + orientation */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Ancho (cm)</Label>
          <Input type="number" value={material.width}
            onChange={e => onChange({ ...material, width: Number(e.target.value) })}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Alto (cm)</Label>
          <Input type="number" value={material.height}
            onChange={e => onChange({ ...material, height: Number(e.target.value) })}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Orientación</Label>
          <Select value={material.installationOrientation}
            onValueChange={v => onChange({ ...material, installationOrientation: v as Material['installationOrientation'] })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Vertical" className="text-xs">Vertical</SelectItem>
              <SelectItem value="Horizontal" className="text-xs">Horizontal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expandable texture section */}
      {expanded && (
        <TextureUploader
          materialId={material.id}
          projectId={projectId}
          currentTexture={material.texture}
          materialWidth={material.width}
          materialHeight={material.height}
          onTextureChange={texture =>
            onChange({ ...material, texture: texture ?? undefined })
          }
        />
      )}
    </div>
  );
}
