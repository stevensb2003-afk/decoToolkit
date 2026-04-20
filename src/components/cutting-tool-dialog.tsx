
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Scissors } from "lucide-react";
import { Material, Remnant, Point } from "@/lib/types";
import { convertFromCm, convertToCm } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';

interface CuttingToolDialogProps {
    material: Material | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerateCuts: (newRemnants: Remnant[]) => void;
}

interface CutRequest {
    id: string;
    type: 'Vertical' | 'Horizontal';
    size: number; // in meters
}

export function CuttingToolDialog({ material, open, onOpenChange, onGenerateCuts }: CuttingToolDialogProps) {
    const [quantity, setQuantity] = useState<number | string>(1);
    const [cuts, setCuts] = useState<CutRequest[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);
    const { width: contW, height: contH } = useElementSize(containerRef);

    const [cutType, setCutType] = useState<'Vertical' | 'Horizontal'>('Vertical');
    const [cutSize, setCutSize] = useState<string>('');

    // Calculator state
    const [targetQty, setTargetQty] = useState<number | string>('');
    const [targetWidth, setTargetWidth] = useState<string>('');
    const [targetHeight, setTargetHeight] = useState<string>('');
    const [targetWidthUnit, setTargetWidthUnit] = useState<'m' | 'cm'>('m');
    const [targetHeightUnit, setTargetHeightUnit] = useState<'m' | 'cm'>('m');
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setQuantity(1);
            setCuts([]);
            setCutSize('');
            setCutType('Vertical');
            setTargetQty('');
            setTargetWidth('');
            setTargetHeight('');
            setTargetWidthUnit('m');
            setTargetHeightUnit('m');
            setValidationError(null);
        }
    }, [open, material]);

    if (!material) return null;

    const matWidthCm = material.width;
    const matHeightCm = material.height;
    const matWidthM = convertFromCm(matWidthCm, 'm');
    const matHeightM = convertFromCm(matHeightCm, 'm');

    const handleAddCut = () => {
        const size = parseFloat(cutSize);
        if (isNaN(size) || size <= 0) return;

        const maxDim = cutType === 'Vertical' ? matWidthM : matHeightM;
        if (size >= maxDim) {
            setValidationError(`El corte de ${size}m excede el ${cutType === 'Vertical' ? 'ancho' : 'alto'} del material (${maxDim.toFixed(2)}m).`);
            return;
        }

        setValidationError(null);
        setCuts([...cuts, { id: crypto.randomUUID(), type: cutType, size }]);
        setCutSize('');
    };

    const handleRemoveCut = (id: string) => {
        setCuts(cuts.filter(c => c.id !== id));
    };

    const handleClearCuts = () => {
        setCuts([]);
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setQuantity('');
        } else {
            const num = parseInt(val);
            if (!isNaN(num) && num >= 1) {
                setQuantity(num);
            }
        }
    };

    const handleApplyCalculator = () => {
        const qty = parseInt(targetQty.toString());
        let w = parseFloat(targetWidth);
        let h = parseFloat(targetHeight);

        if (isNaN(qty) || isNaN(w) || isNaN(h) || qty <= 0 || w <= 0 || h <= 0) return;

        // Unit conversion
        if (targetWidthUnit === 'cm') {
            w = w / 100;
        }
        if (targetHeightUnit === 'cm') {
            h = h / 100;
        }

        if (w > matWidthM || h > matHeightM) {
            setValidationError(`Las piezas de ${w.toFixed(2)}x${h.toFixed(2)}m no caben en una lámina de ${matWidthM.toFixed(2)}x${matHeightM.toFixed(2)}m.`);
            return;
        }

        setValidationError(null);
        const cols = Math.floor(matWidthM / w);
        const rows = Math.floor(matHeightM / h);

        const totalAvailable = cols * rows;
        const actualPieces = Math.min(qty, totalAvailable);

        if (actualPieces === 0) return;

        const newCuts: CutRequest[] = [];
        const usedCols = Math.ceil(actualPieces / rows);
        const usedRows = Math.min(actualPieces, rows);

        // Vertical cuts at multiples of W
        for (let i = 1; i <= usedCols; i++) {
            const size = w * i;
            if (size < matWidthM) {
                newCuts.push({ id: crypto.randomUUID(), type: 'Vertical', size });
            }
        }

        // Horizontal cuts at multiples of H
        for (let i = 1; i <= usedRows; i++) {
            const size = h * i;
            if (size < matHeightM) {
                newCuts.push({ id: crypto.randomUUID(), type: 'Horizontal', size });
            }
        }

        // Merge with existing unique cuts
        setCuts(prev => {
            const existing = new Set(prev.map(c => `${c.type}-${c.size.toFixed(3)}`));
            const filtered = newCuts.filter(c => !existing.has(`${c.type}-${c.size.toFixed(3)}`));
            return [...prev, ...filtered];
        });
    };

    const handleConfirm = () => {
        const generatedRemnants: Remnant[] = [];
        const qty = typeof quantity === 'string' ? 1 : quantity;

        // Group and sort unique distances
        const verticalDistances = Array.from(new Set(
            cuts.filter(c => c.type === 'Vertical')
                .map(c => convertToCm(c.size, 'm'))
                .filter(d => d > 0 && d < matWidthCm)
        )).sort((a, b) => a - b);

        const horizontalDistances = Array.from(new Set(
            cuts.filter(c => c.type === 'Horizontal')
                .map(c => convertToCm(c.size, 'm'))
                .filter(d => d > 0 && d < matHeightCm)
        )).sort((a, b) => a - b);

        // Add edges to create segments
        const xPoints = [0, ...verticalDistances, matWidthCm];
        const yPoints = [0, ...horizontalDistances, matHeightCm];

        for (let i = 0; i < qty; i++) {
            const sourceSheetId = crypto.randomUUID();
            // Generate all resulting rectangles
            for (let yi = 0; yi < yPoints.length - 1; yi++) {
                for (let xi = 0; xi < xPoints.length - 1; xi++) {
                    const xStart = xPoints[xi];
                    const xEnd = xPoints[xi + 1];
                    const yStart = yPoints[yi];
                    const yEnd = yPoints[yi + 1];

                    const w = xEnd - xStart;
                    const h = yEnd - yStart;

                    if (w < 0.5 || h < 0.5) continue; // Skip slivers

                    generatedRemnants.push({
                        id: crypto.randomUUID(),
                        materialId: material.id,
                        points: [
                            { x: 0, y: 0 },
                            { x: w, y: 0 },
                            { x: w, y: h },
                            { x: 0, y: h }
                        ],
                        x: w / 2,
                        y: h / 2,
                        width: w,
                        height: h,
                        createdAt: new Date(),
                        sourceSheetId,
                    });
                }
            }
        }

        onGenerateCuts(generatedRemnants);
        onOpenChange(false);
    };

    // Preview Calculations
    const previewMaxW = contW || 400;
    const previewMaxH = contH || 350;
    const scaleX = previewMaxW / matWidthCm;
    const scaleY = previewMaxH / matHeightCm;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const displayW = matWidthCm * scale;
    const displayH = matHeightCm * scale;

    // Helper to get unique sorted distances for preview
    const vDistances = Array.from(new Set(cuts.filter(c => c.type === 'Vertical').map(c => convertToCm(c.size, 'm')))).sort((a, b) => a - b);
    const hDistances = Array.from(new Set(cuts.filter(c => c.type === 'Horizontal').map(c => convertToCm(c.size, 'm')))).sort((a, b) => a - b);

    // Render Cut Lines
    const cutLines = [
        ...vDistances.map((d, idx) => {
            const isError = d >= matWidthCm || d <= 0;
            return (
                <div
                    key={`v-${idx}`}
                    className="absolute border-l-2 border-dashed transition-colors"
                    style={{
                        left: `${d * scale}px`,
                        top: 0,
                        height: '100%',
                        borderColor: isError ? 'rgb(239, 68, 68)' : 'rgb(255, 0, 0)',
                        zIndex: 10
                    }}
                >
                    <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold ${isError ? 'text-red-600' : 'text-red-500'}`}>
                        {convertFromCm(d, 'm').toFixed(2)}m
                    </span>
                </div>
            );
        }),
        ...hDistances.map((d, idx) => {
            const isError = d >= matHeightCm || d <= 0;
            return (
                <div
                    key={`h-${idx}`}
                    className="absolute border-b-2 border-dashed transition-colors"
                    style={{
                        left: 0,
                        bottom: `${d * scale}px`, // From bottom
                        width: '100%',
                        borderColor: isError ? 'rgb(239, 68, 68)' : 'rgb(255, 0, 0)',
                        zIndex: 10
                    }}
                >
                    <span className={`absolute left-full ml-1 top-1/2 -translate-y-1/2 text-[9px] font-bold ${isError ? 'text-red-600' : 'text-red-500'} [writing-mode:vertical-lr]`}>
                        {convertFromCm(d, 'm').toFixed(2)}m
                    </span>
                </div>
            );
        })
    ];

    // Render Labels for resulting segments
    const xPoints = [0, ...vDistances.filter(d => d > 0 && d < matWidthCm), matWidthCm];
    const yPoints = [0, ...hDistances.filter(d => d > 0 && d < matHeightCm), matHeightCm];
    const segments: React.ReactNode[] = [];

    for (let yi = 0; yi < yPoints.length - 1; yi++) {
        for (let xi = 0; xi < xPoints.length - 1; xi++) {
            const w = xPoints[xi + 1] - xPoints[xi];
            const h = yPoints[yi + 1] - yPoints[yi];
            const left = xPoints[xi];
            const bottom = yPoints[yi];

            const isLast = (xi === xPoints.length - 2) && (yi === yPoints.length - 2);

            segments.push(
                <div
                    key={`seg-${xi}-${yi}`}
                    className={`absolute flex items-center justify-center text-[10px] font-medium p-1 select-none ${isLast ? 'bg-green-500/5 text-green-700/60' : 'bg-primary/5 text-primary/40'}`}
                    style={{
                        left: `${left * scale}px`,
                        bottom: `${bottom * scale}px`,
                        width: `${w * scale}px`,
                        height: `${h * scale}px`,
                        border: '1px solid rgba(0,0,0,0.05)'
                    }}
                >
                    {isLast ? 'Sobrante' : `${convertFromCm(w, 'm').toFixed(2)}x${convertFromCm(h, 'm').toFixed(2)}`}
                </div>
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[950px] overflow-hidden">
                {validationError && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white text-[11px] font-bold py-2 px-6 rounded-full shadow-2xl border border-red-700/50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
                        <span className="animate-pulse">⚠</span> {validationError}
                    </div>
                )}
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="h-5 w-5" />
                        Herramienta de Corte
                    </DialogTitle>
                    <DialogDescription>
                        Configura los cortes para: <span className="font-semibold text-primary">{material.name}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    {/* Left Column: Config */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="quantity">Cantidad de Láminas</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={handleQuantityChange}
                            />
                            <p className="text-xs text-muted-foreground">
                                Dimensiones originales: <span className="font-mono text-primary font-semibold">{matWidthM}m (Ancho) x {matHeightM}m (Alto)</span>
                            </p>
                        </div>

                        {/* Visual Preview */}
                        <div className="space-y-2 h-full flex flex-col">
                            <Label>Previsualización</Label>
                            <div
                                ref={containerRef}
                                className="rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden min-h-[400px] p-8"
                            >
                                <div
                                    className="border-2 border-solid border-primary bg-white relative shadow-sm transition-all"
                                    style={{
                                        width: `${displayW}px`,
                                        height: `${displayH}px`,
                                    }}
                                >
                                    {/* Axes Labels */}
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-blue-600 font-bold uppercase tracking-wider bg-background px-2 border border-blue-100 rounded">
                                        {matWidthM.toFixed(2)}m (Ancho)
                                    </div>
                                    <div className="absolute top-1/2 -left-8 -translate-y-1/2 text-[10px] text-orange-600 font-bold uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 bg-background py-2 border border-orange-100 rounded">
                                        {matHeightM.toFixed(2)}m (Alto)
                                    </div>

                                    {/* Segments & Remainder */}
                                    {segments}

                                    {/* Cut Overlay Lines */}
                                    {cutLines}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Add Cuts */}
                    <div className="space-y-4">

                        <div className="rounded-lg border p-3 space-y-3 bg-slate-50 dark:bg-slate-900/50 shadow-sm border-primary/20">
                            <h4 className="font-semibold text-xs flex items-center gap-2 text-primary uppercase tracking-tight">
                                <Scissors className="h-3.5 w-3.5" /> Añadir Punto de Corte
                            </h4>
                            <div className="flex gap-2 items-end">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold">Eje</Label>
                                    <Select value={cutType} onValueChange={(v: any) => setCutType(v)}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Vertical" className="text-xs">Vertical (Ancho)</SelectItem>
                                            <SelectItem value="Horizontal" className="text-xs">Horizontal (Alto)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1 flex-[1.5]">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold">Distancia (m)</Label>
                                    <div className="relative group">
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={cutSize}
                                            onInput={(e) => {
                                                const val = (e.target as HTMLInputElement).value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setCutSize(val);
                                                    if (validationError) setValidationError(null);
                                                }
                                            }}
                                            placeholder="0.00"
                                            className="h-8 text-xs pr-9 border-primary/20 focus-visible:ring-blue-500 font-mono"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddCut();
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={handleAddCut}
                                            size="icon"
                                            className="absolute top-0 right-0 h-8 w-8 rounded-l-none bg-blue-600 hover:bg-blue-700 shadow-sm"
                                            disabled={!cutSize || parseFloat(cutSize) <= 0}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Calculator Section */}
                        <div className="rounded-lg border p-3 space-y-3 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm border-blue-200/40">
                            <h4 className="font-semibold text-xs flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tight">
                                <Plus className="h-3.5 w-3.5" /> Calculadora de Piezas
                            </h4>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold">Cant.</Label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="N"
                                        className="h-7 text-xs px-2 font-mono h-[30px]"
                                        value={targetQty}
                                        onInput={e => {
                                            const val = (e.target as HTMLInputElement).value;
                                            if (val === '' || /^\d*$/.test(val)) setTargetQty(val);
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold flex items-center justify-between">
                                        <span>Ancho</span>
                                        <div className="flex bg-blue-100/50 dark:bg-blue-900/30 p-0.5 rounded-md border border-blue-200/50 scale-90 origin-right">
                                            {['m', 'cm'].map((u) => (
                                                <button
                                                    key={u}
                                                    onClick={() => setTargetWidthUnit(u as any)}
                                                    className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${targetWidthUnit === u ? 'bg-white dark:bg-blue-800 shadow-sm text-blue-700 dark:text-blue-100' : 'text-blue-400 hover:text-blue-600'}`}
                                                >
                                                    {u}
                                                </button>
                                            ))}
                                        </div>
                                    </Label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        className="h-7 text-xs px-2 px-2 font-mono h-[30px]"
                                        value={targetWidth}
                                        onInput={e => {
                                            const val = (e.target as HTMLInputElement).value;
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) setTargetWidth(val);
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold flex items-center justify-between">
                                        <span>Alto</span>
                                        <div className="flex bg-blue-100/50 dark:bg-blue-900/30 p-0.5 rounded-md border border-blue-200/50 scale-90 origin-right">
                                            {['m', 'cm'].map((u) => (
                                                <button
                                                    key={u}
                                                    onClick={() => setTargetHeightUnit(u as any)}
                                                    className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${targetHeightUnit === u ? 'bg-white dark:bg-blue-800 shadow-sm text-blue-700 dark:text-blue-100' : 'text-blue-400 hover:text-blue-600'}`}
                                                >
                                                    {u}
                                                </button>
                                            ))}
                                        </div>
                                    </Label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        className="h-7 text-xs px-2 font-mono h-[30px]"
                                        value={targetHeight}
                                        onInput={e => {
                                            const val = (e.target as HTMLInputElement).value;
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) setTargetHeight(val);
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-center mt-2 group">
                                <Button
                                    size="sm"
                                    className="h-8 px-6 text-[10px] font-bold bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 shadow-md hover:shadow-lg transition-all border border-blue-500/20 active:scale-95 mx-auto rounded-full w-auto"
                                    onClick={handleApplyCalculator}
                                >
                                    GENERAR GUÍA DE CORTES
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col">
                            <Label className="flex justify-between items-center">
                                <span>Lista de Cortes (Puntos Absolutos):</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground uppercase">Secuencial</span>
                                    {cuts.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-5 px-3 mb-1 text-[10px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-bold"
                                            onClick={handleClearCuts}
                                        >
                                            Borrar Todo
                                        </Button>
                                    )}
                                </div>
                            </Label>
                            <div className="border rounded-md h-[250px] overflow-hidden flex flex-col bg-background shadow-inner">
                                {cuts.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
                                        Define puntos de corte para dividir la lámina.
                                    </div>
                                ) : (
                                    <ScrollArea className="flex-1">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="py-2 h-8 w-[50px]">#</TableHead>
                                                    <TableHead className="py-2 h-8">Tipo</TableHead>
                                                    <TableHead className="py-2 h-8 text-right pr-4">Distancia</TableHead>
                                                    <TableHead className="py-2 h-8 w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {cuts.map((cut, idx) => (
                                                    <TableRow key={cut.id}>
                                                        <TableCell className="py-2 h-8 text-muted-foreground text-xs">{idx + 1}</TableCell>
                                                        <TableCell className="py-2 h-8">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${cut.type === 'Vertical' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {cut.type}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-2 h-8 text-right pr-4 font-mono font-bold text-sm">{cut.size}m</TableCell>
                                                        <TableCell className="py-2 h-8">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveCut(cut.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirm} className="min-w-[200px]">
                        {cuts.length === 0 ? "Mantener Original" : "Generar Piezas de Corte"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
