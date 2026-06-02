'use client';

import { useState, useRef, useEffect, PointerEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Corners } from '@/lib/perspective-warp';
import { Crop, RotateCw, Check, ArrowLeft, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { TextureMagnifier } from './TextureMagnifier';
import { rotateBlob90, warpImage, fetchAiTexture } from './PerspectiveCropDialog.utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File;
  previewUrl: string;
  initialCorners: Corners;
  materialWidth: number;
  materialHeight: number;
  metadata?: any;
  onConfirm: (finalFile: File) => void;
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

  const [warping, setWarping] = useState(false);
  const [warpedBlob, setWarpedBlob] = useState<Blob | null>(null);
  const [warpedUrl, setWarpedUrl] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiBlob, setAiBlob] = useState<Blob | null>(null);
  const [aiUrl, setAiUrl] = useState<string | null>(null);
  const [showingAi, setShowingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCorners(initialCorners);
      setStep('crop');
      setWarpedBlob(null);
      if (warpedUrl) URL.revokeObjectURL(warpedUrl);
      setWarpedUrl(null);
      setAiBlob(null);
      if (aiUrl) URL.revokeObjectURL(aiUrl);
      setAiUrl(null);
      setShowingAi(false);
      setMagnifierPos(null);
      setAiError(null);
    }
  }, [open, initialCorners]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const blob = await warpImage(file, corners, materialWidth, materialHeight);
      setWarpedBlob(blob);
      setWarpedUrl(URL.createObjectURL(blob));
      setStep('preview');
    } catch (err) { console.error(err); }
    finally { setWarping(false); }
  };

  const handleRotate = async () => {
    if (!warpedBlob) return;
    setRotating(true);
    try {
      const rotated = await rotateBlob90(warpedBlob);
      if (warpedUrl) URL.revokeObjectURL(warpedUrl);
      setWarpedBlob(rotated);
      setWarpedUrl(URL.createObjectURL(rotated));
    } catch (err) { console.error(err); }
    finally { setRotating(false); }
  };

  const handleGenerateAI = async () => {
    if (!metadata?.seamlessPrompt || !warpedBlob) return;
    setGenerating(true);
    setAiError(null);
    try {
      const blobToBase64 = (b: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
      };

      const b64 = await blobToBase64(warpedBlob);
      const blob = await fetchAiTexture(metadata.seamlessPrompt, materialWidth, materialHeight, b64);
      setAiBlob(blob);
      setAiUrl(URL.createObjectURL(blob));
      setShowingAi(true);
    } catch (err: any) {
      setAiError(err?.message || 'Error al generar con IA');
    }
    finally { setGenerating(false); }
  };

  const handleConfirm = () => {
    const blob = showingAi && aiBlob ? aiBlob : warpedBlob;
    if (blob) onConfirm(new File([blob], `texture_${Date.now()}.jpg`, { type: 'image/jpeg' }));
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
          <div ref={imgContainerRef} className="relative w-full aspect-[3/4] md:aspect-square bg-black rounded-lg overflow-hidden border border-zinc-800 select-none touch-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
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
              <TextureMagnifier previewUrl={previewUrl} magnifierPos={magnifierPos} />
            )}
          </div>
        )}

        {/* ── Preview ──────────────────────────────────────────────────────────── */}
        {step === 'preview' && warpedUrl && (
          <div className="w-full aspect-[3/4] md:aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700 relative">
            <div className="absolute inset-0 transition-all duration-300" style={{ backgroundImage: `url(${showingAi && aiUrl ? aiUrl : warpedUrl})`, ...previewBgStyle }} />
            <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] pointer-events-none" />
            {showingAi && (
              <div className="absolute top-2 right-2 bg-indigo-500 text-white text-xs px-2 py-1 rounded-md shadow flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" /> IA Seamless
              </div>
            )}
            {aiError && (
              <div className="absolute bottom-2 left-2 right-2 bg-red-900/80 text-red-200 text-xs px-3 py-2 rounded-md backdrop-blur-sm">
                ⚠️ {aiError}
              </div>
            )}
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
                <Button variant="outline" size="icon" onClick={() => setStep('crop')} disabled={rotating || generating}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" onClick={handleRotate} disabled={rotating || generating || showingAi} title="Rotar 90°">
                  {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                </Button>
                {metadata?.seamlessPrompt && !aiUrl && (
                  <Button variant="default" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleGenerateAI} disabled={generating}>
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Mejorar con IA
                  </Button>
                )}
                {aiUrl && (
                  <Button variant="outline" className="gap-2" onClick={() => setShowingAi(!showingAi)}>
                    {showingAi ? <ImageIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-indigo-400" />}
                    {showingAi ? 'Ver Original' : 'Ver IA'}
                  </Button>
                )}
              </div>
              <Button onClick={handleConfirm} disabled={rotating || generating}>Aprobar y Subir</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
