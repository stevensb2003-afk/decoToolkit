'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, ImageIcon, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadDefaultTextureAction, deleteDefaultTextureAction } from '@/lib/storage-actions';
import { useToast } from '@/hooks/use-toast';
import type { MaterialTexture } from '@/lib/types';
import { resizeForAI } from '@/lib/perspective-warp';
import type { Corners } from '@/lib/perspective-warp';
import { PerspectiveCropDialog } from '@/components/ui/PerspectiveCropDialog';

interface Props {
  materialId: string;
  currentTexture?: MaterialTexture;
  materialWidth: number;   // in cm
  materialHeight: number;  // in cm
  onTextureChange: (texture: MaterialTexture | null) => void;
}

type Phase = 'idle' | 'reviewing' | 'uploading' | 'done';

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

function extractFileName(storagePath: string): string {
  return storagePath.split('/').pop() ?? storagePath;
}

const DEFAULT_CORNERS: Corners = {
  topLeft: { x: 0.1, y: 0.1 },
  topRight: { x: 0.9, y: 0.1 },
  bottomRight: { x: 0.9, y: 0.9 },
  bottomLeft: { x: 0.1, y: 0.9 },
};

export function DefaultMaterialTextureUploader({
  materialId,
  currentTexture,
  materialWidth,
  materialHeight,
  onTextureChange,
}: Props) {
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  const [cropData, setCropData] = useState<{
    file: File;
    previewUrl: string;
    corners: Corners;
    metadata?: any;
  } | null>(null);

  const dimensionsOk = materialWidth > 0 && materialHeight > 0;

  const handleFileSelection = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Solo se aceptan imágenes.' });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast({ variant: 'destructive', title: 'Imagen muy grande', description: 'El tamaño máximo es 15 MB.' });
      return;
    }

    setCropData({
      file,
      previewUrl: URL.createObjectURL(file),
      corners: DEFAULT_CORNERS,
      metadata: undefined,
    });
    setPhase('reviewing');
  }, [toast]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const processAndUpload = async (fileToUpload: File, metadata?: any) => {
    setPhase('uploading');
    setProgress(70);
    const interval = setInterval(() => setProgress(p => (p < 92 ? p + 5 : p)), 400);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }
      const result = await uploadDefaultTextureAction(materialId, formData);

      if (!result.success) {
        toast({ variant: 'destructive', title: 'Error al subir', description: result.error });
        setPhase('idle');
        return;
      }
      setProgress(100);
      setPhase('done');
      onTextureChange(result.texture);
    } catch (err) {
      console.error('Upload error:', err);
      toast({ variant: 'destructive', title: 'Error al subir', description: 'No se pudo subir la textura.' });
      setPhase('idle');
    } finally {
      clearInterval(interval);
      setTimeout(() => { setPhase('idle'); setProgress(0); setCropData(null); }, 600);
    }
  };

  const handleDelete = async () => {
    if (!currentTexture) return;
    setDeleting(true);
    try {
      await deleteDefaultTextureAction(currentTexture.storagePath);
      onTextureChange(null);
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: 'No se pudo eliminar la textura.' });
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (phase !== 'idle' && phase !== 'done' && phase !== 'reviewing') {
    const labels: Record<string, string> = {
      uploading: '☁️ Subiendo textura...',
    };
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs font-medium text-primary">{labels[phase]}</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ── Texture preview ────────────────────────────────────────────────────────
  if (currentTexture) {
    return (
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-2.5 flex items-center gap-3">
        <div
          className="h-16 w-16 rounded-lg border border-zinc-700 bg-cover bg-center flex-shrink-0 shadow-inner"
          style={{ backgroundImage: `url(${currentTexture.url})` }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-zinc-200 truncate">
            {extractFileName(currentTexture.storagePath)}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {currentTexture.originalWidth > 0
              ? `${currentTexture.originalWidth}×${currentTexture.originalHeight}px`
              : 'Textura guardada'}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Sparkles className="h-2.5 w-2.5 text-primary/70" />
            <span className="text-[9px] text-primary/70 font-medium">Corrección de perspectiva</span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      </div>
    );
  }

  // ── Upload buttons ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {!dimensionsOk && (
        <div className="flex items-center gap-2 text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Define el ancho y alto del material para activar la cámara.
        </div>
      )}
      <div className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/30 p-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary/80" />
          <p className="text-[11px] font-medium text-zinc-400">Ajuste de perspectiva manual</p>
        </div>
        <p className="text-[10px] text-zinc-600 text-center max-w-[220px]">
          Toma una foto a la lámina real y ajusta los 4 puntos de las esquinas.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!dimensionsOk}
            className="h-8 text-xs gap-1.5 border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white disabled:opacity-40"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" /> Tomar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!dimensionsOk}
            className="h-8 text-xs gap-1.5 border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white disabled:opacity-40"
            onClick={() => galleryRef.current?.click()}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Subir imagen
          </Button>
        </div>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => handleFileSelection(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleFileSelection(e.target.files?.[0])} />

      {/* ── Dialog for Corner Review ────────────────────────────────────────── */}
      {cropData && phase === 'reviewing' && (
        <PerspectiveCropDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setPhase('idle');
              setCropData(null);
            }
          }}
          file={cropData.file}
          previewUrl={cropData.previewUrl}
          initialCorners={cropData.corners}
          materialWidth={materialWidth}
          materialHeight={materialHeight}
          metadata={cropData.metadata}
          onConfirm={(finalFile, physicalWidth, physicalHeight) => {
            const finalMetadata = {
              ...cropData.metadata,
              physicalWidth,
              physicalHeight
            };
            processAndUpload(finalFile, finalMetadata);
          }}
        />
      )}
    </div>
  );
}
