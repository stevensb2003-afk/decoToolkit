'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Unit } from '@/lib/types';
import { convertToCm } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface SurfaceFormValue {
  id: string;
  name: string;
  width: { value: number; unit: Unit };
  height: { value: number; unit: Unit };
}

interface NewSurfaceRowProps {
  surface: SurfaceFormValue;
  canDelete: boolean;
  onChange: (s: SurfaceFormValue) => void;
  onDelete: () => void;
}

export function NewSurfaceRow({ surface, canDelete, onChange, onDelete }: NewSurfaceRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 16, scale: 0.97 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 items-center p-3 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm hover:border-border/80 transition-all group"
    >
      <Input
        placeholder="Ej., Cocina - Muro Norte"
        value={surface.name}
        onChange={(e) => onChange({ ...surface, name: e.target.value })}
        className="h-8 text-sm bg-transparent border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
      />

      {/* Width */}
      <Input
        type="number"
        step="0.01"
        placeholder="0"
        value={surface.width.value || ''}
        onChange={(e) =>
          onChange({ ...surface, width: { ...surface.width, value: Number(e.target.value) } })
        }
        className="h-8 w-20 text-sm text-right"
      />
      <Select
        value={surface.width.unit}
        onValueChange={(u) =>
          onChange({ ...surface, width: { ...surface.width, unit: u as Unit } })
        }
      >
        <SelectTrigger className="h-8 w-16 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="m" className="text-xs">m</SelectItem>
          <SelectItem value="cm" className="text-xs">cm</SelectItem>
        </SelectContent>
      </Select>

      {/* Height */}
      <Input
        type="number"
        step="0.01"
        placeholder="0"
        value={surface.height.value || ''}
        onChange={(e) =>
          onChange({ ...surface, height: { ...surface.height, value: Number(e.target.value) } })
        }
        className="h-8 w-20 text-sm text-right"
      />
      <Select
        value={surface.height.unit}
        onValueChange={(u) =>
          onChange({ ...surface, height: { ...surface.height, unit: u as Unit } })
        }
      >
        <SelectTrigger className="h-8 w-16 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="m" className="text-xs">m</SelectItem>
          <SelectItem value="cm" className="text-xs">cm</SelectItem>
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={!canDelete}
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive hover:bg-destructive/10 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
