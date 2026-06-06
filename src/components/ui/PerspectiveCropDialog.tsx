'use client';

import { useState, useRef, useEffect, PointerEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Corners } from '@/lib/perspective-warp';
import { Crop, RotateCw, Check, ArrowLeft, Loader2, ArrowLeftRight } from 'lucide-react';
import { TextureMagnifier } from './TextureMagnifier';
import { rotateBlob90, warpImage } from './PerspectiveCropDialog.utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File;
  previewUrl: string;
  initialCorners: Corners;
  materialWidth: number;
  materialHeight: number;
  metadata?: any;
  onConfirm: (finalFile: File, physicalWidth?: number, physicalHeight?: number) => void;
}

type CornerKey = keyof Corners;
type Step = 'crop' | 'preview';

export function PerspectiveCropDialog({ open, onOpenChange, file, previewUrl, initialCorners, materialWidth, materialHeight, metadata, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('crop');
  const [corners, setCorners] = useState<Corners>(initialCorners);
  const svgRef = useRef<SVGSVGElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [draggingKey, setDraggingKey] = useState<CornerKey | null>(null);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });

  const [warping, setWarping] = useState(false);
  const [warpedBlob, setWarpedBlob] = useState<Blob | null>(null);
  const [warpedUrl, setWarpedUrl] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  // Physical dimensions represented by the cropped texture (defaults to full panel size)
  const [physicalWidth, setPhysicalWidth] = useState<number>(materialWidth);
  const [physicalHeight, setPhysicalHeight] = useState<number>(materialHeight);

  const [localFile, setLocalFile] = useState<File>(file);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>(previewUrl);

  useEffect(() => {
    if (open) {
      setLocalFile(file);
      setLocalPreviewUrl(previewUrl);
      setCorners(initialCorners);
      setStep('crop');
      setWarpedBlob(null);
      if (warpedUrl) URL.revokeObjectURL(warpedUrl);
      setWarpedUrl(null);
      setMagnifierPos(null);
      setPhysicalWidth(materialWidth);
      setPhysicalHeight(materialHeight);
    }
  }, [open, initialCorners, materialWidth, materialHeight, file, previewUrl]);

  const handleRotateSource = async () => {
    setRotating(true);
    try {
      const rotatedBlob = await rotateBlob90(localFile);
      const newFile = new File([rotatedBlob], localFile.name, { type: rotatedBlob.type });
      setLocalFile(newFile);
      setLocalPreviewUrl(URL.createObjectURL(rotatedBlob));
      setCorners({
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.9, y: 0.1 },
        bottomRight: { x: 0.9, y: 0.9 },
        bottomLeft: { x: 0.1, y: 0.9 },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setRotating(false);
    }
  };

  const handleSwapDimensions = () => {
    setPhysicalWidth(physicalHeight);
    setPhysicalHeight(physicalWidth);
  };

  const handlePointerDown = (e: PointerEvent<SVGCircleElement>, key: CornerKey) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggingKey(key);
  };

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggingKey || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setCorners(prev => ({ ...prev, [draggingKey]: { x, y } }));
    if (imgContainerRef.current) {
      const cr = imgContainerRef.current.getBoundingClientRect();
      setContainerSize({ w: cr.width, h: cr.height });
      setMagnifierPos({
        x: Math.max(0, Math.min(100, ((e.clientX - cr.left) / cr.width) * 100)),
        y: Math.max(0, Math.min(100, ((e.clientY - cr.top) / cr.height) * 100)),
      });
    }
  };

  const handlePointerUp = (e: PointerEvent<SVGSVGElement | SVGCircleElement>) => {
    if (draggingKey && e.target instanceof Element && e.target.hasPointerCapture(e.pointerId))
      e.target.releasePointerCapture(e.pointerId);
    setDraggingKey(null);
    setMagnifierPos(null);
  };

  const handleWarp = async () => {
    setWarping(true);
    try {
      const blob = await warpImage(localFile, corners, physicalWidth, physicalHeight);
      setWarpedBlob(blob);
      setWarpedUrl(URL.createObjectURL(blob));
      setStep('preview');
    } catch (err) { console.error(err); }
    finally { setWarping(false); }
  };


  const handleConfirm = () => {
    if (warpedBlob) onConfirm(new File([warpedBlob], `texture_${Date.now()}.jpg`, { type: 'image/jpeg' }), physicalWidth, physicalHeight);
  };

  const tl = corners.topLeft; const tr = corners.topRight;
  const br = corners.bottomRight; const bl = corners.bottomLeft;
  const polygonPoints = `${tl.x*100},${tl.y*100} ${tr.x*100},${tr.y*100} ${br.x*100},${br.y*100} ${bl.x*100},${bl.y*100}`;

  // Single-sheet preview style (mosaico removed)
  const previewBgStyle = {
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'center',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col p-4 bg-zinc-950 border-zinc-800" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            {step === 'crop' ? <Crop className="h-5 w-5 text-primary" /> : <Check className="h-5 w-5 text-primary" />}
            {step === 'crop' ? 'Ajustar Recorte' : 'Previsualización del Material'}
          </DialogTitle>
          <p className="text-xs text-zinc-400">
            {step === 'crop' ? 'Arrastra los puntos a las esquinas exactas de la lámina.' : 'Así se verá tu textura en el lienzo.'}
          </p>
        </DialogHeader>

        {/* ── Crop ────────────────────────────────────────────────────────────── */}
        {step === 'crop' && (
          <div className="flex flex-col gap-4">
            <div ref={imgContainerRef} className="relative w-full aspect-[3/4] md:aspect-square bg-black rounded-lg overflow-hidden border border-zinc-800 select-none touch-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={localPreviewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              <svg ref={svgRef} className="absolute inset-0 w-full h-full z-10" viewBox="0 0 100 100" preserveAspectRatio="none"
                onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
                <mask id="crop-mask">
                  <rect width="100" height="100" fill="white" />
                  <polygon points={polygonPoints} fill="black" />
                </mask>
                <rect width="100" height="100" fill="rgba(0,0,0,0.6)" mask="url(#crop-mask)" className="pointer-events-none" />
                <polygon points={polygonPoints} fill="transparent" stroke="var(--theme-primary, #10b981)" strokeWidth="0.5" strokeDasharray="1, 1" className="pointer-events-none" />
                {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as CornerKey[]).map((key) => {
                  const pt = corners[key];
                  if (!pt || typeof pt.x !== 'number') return null;
                  return (
                    <g key={key}>
                      <circle cx={pt.x*100} cy={pt.y*100} r="2" fill="white" stroke="var(--theme-primary, #10b981)" strokeWidth="1.5" className="pointer-events-none" />
                      <circle cx={pt.x*100} cy={pt.y*100} r="6" fill="transparent" className="cursor-move touch-none" onPointerDown={(e) => handlePointerDown(e, key)} />
                    </g>
                  );
                })}
              </svg>
              {draggingKey !== null && magnifierPos !== null && (
                <TextureMagnifier
                  previewUrl={localPreviewUrl}
                  magnifierPos={magnifierPos}
                  containerWidth={containerSize.w}
                  containerHeight={containerSize.h}
                />
              )}
            </div>

            {/* Dimension Constraints at Crop Step */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 grid grid-cols-2 gap-3 items-end">
              <div className="col-span-2 flex justify-between items-start mb-1">
                <div className="text-xs text-zinc-400">
                  ¿Qué tamaño real representa este recorte? <br/>
                  <span className="text-[10px] text-zinc-500">Asegúrate de que la caja coincida con el tamaño físico.</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleRotateSource} disabled={rotating} className="h-7 text-xs px-2" title="Rotar foto original">
                  {rotating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCw className="h-3 w-3 mr-1" />} Rotar Foto
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-300 font-medium">Ancho Físico (cm)</label>
                <div className="relative">
                  <input type="number" min="1" step="0.1" value={physicalWidth} onChange={(e) => setPhysicalWidth(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-300 font-medium">Alto Físico (cm)</label>
                  <button onClick={handleSwapDimensions} className="text-zinc-500 hover:text-primary transition-colors" title="Intercambiar Ancho/Alto">
                    <ArrowLeftRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="relative">
                  <input type="number" min="1" step="0.1" value={physicalHeight} onChange={(e) => setPhysicalHeight(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Preview ──────────────────────────────────────────────────────────── */}
        {step === 'preview' && warpedUrl && (
          <div className="flex flex-col gap-4">
            <div className="w-full aspect-[3/4] md:aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700 relative">
              <div className="absolute inset-0 transition-all duration-300" style={{ backgroundImage: `url(${warpedUrl})`, ...previewBgStyle }} />
              <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] pointer-events-none" />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex flex-row items-center justify-between sm:justify-between w-full">
          {step === 'crop' ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleWarp} disabled={warping}>
                {warping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continuar
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setStep('crop')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleConfirm} disabled={rotating}>Aprobar y Subir</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
