'use client';

import { useRef, useState } from 'react';
import { Camera, ImageIcon, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadDefaultTextureAction, deleteDefaultTextureAction } from '@/lib/storage-actions';
import { useToast } from '@/hooks/use-toast';
import type { MaterialTexture } from '@/lib/types';

interface Props {
  materialId: string;
  currentTexture?: MaterialTexture;
  materialWidth: number;
  materialHeight: number;
  onTextureChange: (texture: MaterialTexture | null) => void;
}

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

function extractFileName(storagePath: string): string {
  return storagePath.split('/').pop() ?? storagePath;
}

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
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  function validateDimensions(): boolean {
    if (materialWidth <= 0 || materialHeight <= 0) {
      toast({
        variant: 'destructive',
        title: 'Dimensiones requeridas',
        description: 'Define primero el ancho y alto del material.',
      });
      return false;
    }
    return true;
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Solo se aceptan imágenes.' });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast({ variant: 'destructive', title: 'Imagen muy grande', description: 'El tamaño máximo es 15 MB.' });
      return;
    }

    setUploading(true);
    setProgress(10);
    const interval = setInterval(() => setProgress(p => (p < 85 ? p + 10 : p)), 400);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadDefaultTextureAction(materialId, formData);

      if (!result.success) {
        toast({ variant: 'destructive', title: 'Error al subir', description: result.error });
        return;
      }
      setProgress(100);
      onTextureChange(result.texture);
    } catch (err) {
      console.error('Upload error:', err);
      toast({ variant: 'destructive', title: 'Error al subir', description: 'No se pudo subir la textura.' });
    } finally {
      clearInterval(interval);
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDelete() {
    if (!currentTexture) return;
    setDeleting(true);
    try {
      await deleteDefaultTextureAction(currentTexture.storagePath);
      onTextureChange(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast({ variant: 'destructive', title: 'Error al eliminar', description: 'No se pudo eliminar la textura.' });
    } finally {
      setDeleting(false);
    }
  }

  if (uploading) {
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-900/60 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-zinc-400">Subiendo textura...</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (currentTexture) {
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-900/60 p-2 flex items-center gap-3">
        <div
          className="h-14 w-14 rounded border border-zinc-700 bg-cover bg-center flex-shrink-0"
          style={{ backgroundImage: `url(${currentTexture.url})` }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-zinc-300 truncate">
            {extractFileName(currentTexture.storagePath)}
          </p>
          <p className="text-[10px] text-zinc-500">
            {currentTexture.originalWidth}×{currentTexture.originalHeight}px
          </p>
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

  return (
    <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 p-3 flex flex-col items-center gap-2">
      <ImageIcon className="h-6 w-6 text-zinc-600" />
      <p className="text-[10px] text-zinc-500">Añade una textura al material</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
          onClick={() => { if (!validateDimensions()) return; cameraRef.current?.click(); }}
        >
          <Camera className="h-3.5 w-3.5" /> Tomar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
          onClick={() => { if (!validateDimensions()) return; galleryRef.current?.click(); }}
        >
          <ImageIcon className="h-3.5 w-3.5" /> Subir imagen
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
