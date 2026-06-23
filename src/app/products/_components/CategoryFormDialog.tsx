'use client';

import { useState, useMemo } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore, useUser } from '@/firebase';
import { checkSkuPrefixExists, saveProductCategory, type SaveCategoryInput } from '@/lib/product-service';
import { getCabysConfig } from '@/lib/product-service';
import type { CabysCode, AlegraProductType } from '@/lib/types';

interface CategoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  cabysOptions: CabysCode[];
  onCreated: (categoryId: string) => void;
}

const TYPES: { value: AlegraProductType; label: string }[] = [
  { value: 'fe',      label: 'Inventariable' },
  { value: 'no-inv',  label: 'No Inventariable' },
  { value: 'service', label: 'Servicio' },
];

export function CategoryFormDialog({ open, onClose, cabysOptions, onCreated }: CategoryFormDialogProps) {
  const db        = useFirestore();
  const { user }  = useUser();

  const [name, setName]         = useState('');
  const [prefix, setPrefix]     = useState('');
  const [type, setType]         = useState<AlegraProductType>('fe');
  const [cabys, setCabys]       = useState('');
  const [cabysQ, setCabysQ]     = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [prefixError, setPrefixError] = useState('');

  const filteredCabys = useMemo(() => {
    if (!cabysQ.trim()) return cabysOptions.slice(0, 20);
    const q = cabysQ.toLowerCase();
    return cabysOptions.filter(c => c.code.includes(q) || c.description.toLowerCase().includes(q)).slice(0, 20);
  }, [cabysOptions, cabysQ]);

  const selectedCabys = cabysOptions.find(c => c.code === cabys);
  const prefixClean   = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const isValid       = name.trim().length >= 2 && prefixClean.length >= 2 && !!cabys && !prefixError;

  async function validatePrefix() {
    if (!prefixClean) return;
    const exists = await checkSkuPrefixExists(db, prefixClean);
    setPrefixError(exists ? `El prefijo "${prefixClean}" ya está en uso.` : '');
  }

  async function handleSave() {
    if (!user || !isValid) return;
    setIsSaving(true);
    try {
      const input: SaveCategoryInput = {
        name: name.trim(),
        sku_prefix: prefixClean,
        alegra_product_type: type,
        default_cabys: cabys,
        default_unit: type === 'service' ? 'Servicios Profesionales' : 'Unidad',
      };
      const id = await saveProductCategory(db, input, user.uid);
      onCreated(id);
      handleClose();
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    setName(''); setPrefix(''); setType('fe'); setCabys(''); setCabysQ(''); setPrefixError('');
    onClose();
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
          className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold text-foreground">Nueva Categoría</h3>
            <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nombre de la Categoría *</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ej: Molduras SPC"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* Prefijo SKU */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prefijo SKU * (máx 6 letras)</label>
              <input
                type="text" value={prefix}
                onChange={e => { setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setPrefixError(''); }}
                onBlur={validatePrefix}
                placeholder="Ej: MSPC"
                className={`w-full rounded-lg border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary ${prefixError ? 'border-destructive' : 'border-input'}`}
              />
              {prefixError && (
                <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />{prefixError}</p>
              )}
              {!prefixError && prefixClean && (
                <p className="text-[10px] text-muted-foreground">Los SKU empezarán con <span className="font-mono font-bold">{prefixClean}1001</span>, <span className="font-mono">{prefixClean}2001</span>, etc.</p>
              )}
            </div>

            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tipo de Producto Alegra *</label>
              <div className="flex gap-2">
                {TYPES.map(t => (
                  <button key={t.value} onClick={() => setType(t.value)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${type === t.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/40'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CABYS */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CABYS por Defecto *</label>
              <input
                type="text" placeholder="Buscar CABYS..." value={cabysQ}
                onChange={e => setCabysQ(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-background">
                {filteredCabys.map(c => (
                  <button key={c.code} onClick={() => { setCabys(c.code); setCabysQ(''); }}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${cabys === c.code ? 'bg-primary/10' : ''}`}
                  >
                    <span className="shrink-0 font-mono text-primary">{c.code}</span>
                    <span className="text-muted-foreground">{c.description}</span>
                  </button>
                ))}
              </div>
              {selectedCabys && <p className="text-xs text-primary font-medium">✓ {selectedCabys.code} — {selectedCabys.description}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 border-t border-border px-5 py-4">
            <button onClick={handleClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!isValid || isSaving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear Categoría
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
