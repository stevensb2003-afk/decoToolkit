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
import * as ClipperLib from 'clipper-lib';

const SCALE_FACTOR = 1000;

function unionCells(
    cells: { xStart: number; xEnd: number; yStart: number; yEnd: number }[]
): Point[][] {
    if (cells.length === 0) return [];
    
    const clipper = new ClipperLib.Clipper();
    
    cells.forEach(cell => {
        const path = [
            { X: Math.round(cell.xStart * SCALE_FACTOR), Y: Math.round(cell.yStart * SCALE_FACTOR) },
            { X: Math.round(cell.xEnd * SCALE_FACTOR), Y: Math.round(cell.yStart * SCALE_FACTOR) },
            { X: Math.round(cell.xEnd * SCALE_FACTOR), Y: Math.round(cell.yEnd * SCALE_FACTOR) },
            { X: Math.round(cell.xStart * SCALE_FACTOR), Y: Math.round(cell.yEnd * SCALE_FACTOR) }
        ];
        clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true);
    });
    
    const solution = new ClipperLib.Paths();
    clipper.Execute(
        ClipperLib.ClipType.ctUnion,
        solution,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );
    
    return solution.map((path: ClipperLib.IntPoint[]) => 
        path.map(pt => ({ x: pt.X / SCALE_FACTOR, y: pt.Y / SCALE_FACTOR }))
    );
}

interface CutRequest {
    id: string;
    type: 'Vertical' | 'Horizontal';
    size: number; // in meters
}

interface SheetLayout {
    id: string;
    multiplier: number;
    cuts: CutRequest[];
    selectedCells: Set<string>;
    cellGroups: Record<string, Set<string>>;
    groupRoles: Record<string, 'useful' | 'remnant'>;
    originX: 'left' | 'right';
    originY: 'bottom' | 'top';
}

function createEmptyLayout(): SheetLayout {
    return {
        id: crypto.randomUUID(),
        multiplier: 1,
        cuts: [],
        selectedCells: new Set(),
        cellGroups: {},
        groupRoles: {},
        originX: 'left',
        originY: 'bottom'
    };
}

function PreviewBoard({
    layout,
    isActive,
    onSelect,
    onUpdate,
    onRemove,
    matWidthCm,
    matHeightCm,
    matWidthM,
    matHeightM
}: {
    layout: SheetLayout;
    isActive: boolean;
    onSelect: () => void;
    onUpdate: (updater: (l: SheetLayout) => SheetLayout) => void;
    onRemove: () => void;
    matWidthCm: number;
    matHeightCm: number;
    matWidthM: number;
    matHeightM: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { width: contW, height: contH } = useElementSize(containerRef);
    
    // Use the absolute container's dimensions directly as available space
    const availW = Math.max(10, contW);
    const availH = Math.max(10, contH);

    const scaleX = availW / matWidthCm;
    const scaleY = availH / matHeightCm;
    const scale = Math.min(scaleX, scaleY) || 1;

    const displayW = matWidthCm * scale;
    const displayH = matHeightCm * scale;

    const vDistances = Array.from(new Set(layout.cuts.filter(c => c.type === 'Vertical').map(c => convertToCm(c.size, 'm')))).sort((a, b) => a - b);
    const hDistances = Array.from(new Set(layout.cuts.filter(c => c.type === 'Horizontal').map(c => convertToCm(c.size, 'm')))).sort((a, b) => a - b);

    const handleCellClick = (cellId: string) => {
        if (!isActive) return;
        onUpdate(l => {
            const newSel = new Set(l.selectedCells);
            if (newSel.has(cellId)) newSel.delete(cellId);
            else newSel.add(cellId);
            return { ...l, selectedCells: newSel };
        });
    };

    const handleMergeSelected = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (layout.selectedCells.size < 2) return;
        onUpdate(l => {
            const cellsArray = Array.from(l.selectedCells);
            let targetGroupId = crypto.randomUUID();
            const groupsToMerge: string[] = [];

            Object.entries(l.cellGroups).forEach(([gId, gCells]) => {
                for (const cell of cellsArray) {
                    if (gCells.has(cell)) {
                        groupsToMerge.push(gId);
                        break;
                    }
                }
            });

            const newGroupCells = new Set(l.selectedCells);
            groupsToMerge.forEach(gId => {
                l.cellGroups[gId].forEach(c => newGroupCells.add(c));
            });

            const newCellGroups = { ...l.cellGroups };
            const newGroupRoles = { ...l.groupRoles };

            groupsToMerge.forEach(gId => delete newCellGroups[gId]);
            
            if (groupsToMerge.length > 0) {
                 targetGroupId = groupsToMerge[0];
                 groupsToMerge.forEach(gId => {
                     if (gId !== targetGroupId) delete newGroupRoles[gId];
                 });
            }
            
            newCellGroups[targetGroupId] = newGroupCells;
            if (!newGroupRoles[targetGroupId]) {
                 newGroupRoles[targetGroupId] = 'useful';
            }
            
            return { ...l, cellGroups: newCellGroups, groupRoles: newGroupRoles, selectedCells: new Set() };
        });
    };

    const handleSplitSelected = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (layout.selectedCells.size === 0) return;
        onUpdate(l => {
            const newCellGroups = { ...l.cellGroups };
            const newGroupRoles = { ...l.groupRoles };
            let modified = false;

            Array.from(l.selectedCells).forEach(cellId => {
                Object.entries(newCellGroups).forEach(([gId, gCells]) => {
                    if (gCells.has(cellId)) {
                        gCells.delete(cellId);
                        modified = true;
                        if (gCells.size === 0) {
                            delete newCellGroups[gId];
                            delete newGroupRoles[gId];
                        }
                    }
                });
            });
            return modified ? { ...l, cellGroups: newCellGroups, groupRoles: newGroupRoles, selectedCells: new Set() } : l;
        });
    };

    const handleToggleRoleSelected = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (layout.selectedCells.size === 0) return;
        onUpdate(l => {
            const newGroupRoles = { ...l.groupRoles };
            let modified = false;
            Array.from(l.selectedCells).forEach(cellId => {
                Object.entries(l.cellGroups).forEach(([gId, gCells]) => {
                    if (gCells.has(cellId)) {
                        newGroupRoles[gId] = newGroupRoles[gId] === 'useful' ? 'remnant' : 'useful';
                        modified = true;
                    }
                });
            });
            return modified ? { ...l, groupRoles: newGroupRoles, selectedCells: new Set() } : l;
        });
    };

    const cutLines: React.ReactNode[] = [];
    vDistances.forEach((d, i) => {
        if (d <= 0 || d >= matWidthCm) return;
        cutLines.push(
            <div key={`v-${i}`} className="absolute top-0 bottom-0 border-l-2 border-red-500 border-dashed z-10 opacity-70 pointer-events-none"
                style={{ ...(layout.originX === 'left' ? { left: `${d * scale}px` } : { right: `${d * scale}px` }) }}
            />
        );
    });
    hDistances.forEach((d, i) => {
        if (d <= 0 || d >= matHeightCm) return;
        cutLines.push(
            <div key={`h-${i}`} className="absolute left-0 right-0 border-t-2 border-red-500 border-dashed z-10 opacity-70 pointer-events-none"
                style={{ ...(layout.originY === 'bottom' ? { bottom: `${d * scale}px` } : { top: `${d * scale}px` }) }}
            />
        );
    });

    const xPoints = [0, ...vDistances.filter(d => d > 0 && d < matWidthCm), matWidthCm];
    const yPoints = [0, ...hDistances.filter(d => d > 0 && d < matHeightCm), matHeightCm];
    const segments: React.ReactNode[] = [];

    for (let yi = 0; yi < yPoints.length - 1; yi++) {
        for (let xi = 0; xi < xPoints.length - 1; xi++) {
            const cellId = `seg-${xi}-${yi}`;
            const w = xPoints[xi + 1] - xPoints[xi];
            const h = yPoints[yi + 1] - yPoints[yi];
            const left = xPoints[xi];
            const bottom = yPoints[yi];

            const isSelected = layout.selectedCells.has(cellId);
            let groupId: string | null = null;
            Object.entries(layout.cellGroups).forEach(([gId, gCells]) => {
                if (gCells.has(cellId)) groupId = gId;
            });
            
            const isGrouped = !!groupId;
            const role = groupId ? layout.groupRoles[groupId] : null;
            
            let bgClass = 'bg-primary/5 text-primary/40';
            let borderClass = 'border border-black/5';

            if (isSelected) {
                bgClass = 'bg-blue-500/30 text-blue-900';
                borderClass = 'border-2 border-blue-600 z-20 shadow-[0_0_10px_rgba(37,99,235,0.5)]';
            } else if (isGrouped) {
                if (role === 'remnant') {
                     bgClass = 'bg-green-500/20 text-green-800';
                     borderClass = 'border border-green-500/50 border-dashed z-10';
                } else {
                     bgClass = 'bg-indigo-500/20 text-indigo-900';
                     borderClass = 'border border-indigo-500/50 border-dashed z-10';
                }
            } else {
                const isLast = (xi === xPoints.length - 2) && (yi === yPoints.length - 2);
                if (isLast) bgClass = 'bg-green-500/5 text-green-700/60';
            }

            segments.push(
                <div
                    key={cellId}
                    onClick={(e) => { e.stopPropagation(); handleCellClick(cellId); }}
                    className={`absolute flex flex-col items-center justify-center text-[10px] font-medium p-1 select-none cursor-pointer transition-all hover:brightness-95 ${bgClass} ${borderClass}`}
                    style={{
                        ...(layout.originX === 'left' ? { left: `${left * scale}px` } : { right: `${left * scale}px` }),
                        ...(layout.originY === 'bottom' ? { bottom: `${bottom * scale}px` } : { top: `${bottom * scale}px` }),
                        width: `${w * scale}px`,
                        height: `${h * scale}px`,
                    }}
                >
                    {(isGrouped || isSelected) && <span className="font-bold">{role === 'remnant' ? 'Sob.' : (isGrouped ? 'Útil' : '')}</span>}
                    {(!isGrouped || w * scale > 40) && <span>{`${convertFromCm(w, 'm').toFixed(2)}x${convertFromCm(h, 'm').toFixed(2)}`}</span>}
                </div>
            );
        }
    }

    return (
        <div 
           className={`flex-shrink-0 rounded-lg border flex flex-col overflow-hidden min-h-[300px] h-full w-full max-w-[400px] transition-all cursor-pointer ${isActive ? 'ring-2 ring-primary border-primary shadow-md bg-muted/10' : 'opacity-60 hover:opacity-100 bg-muted/30'}`}
           onClick={onSelect}
        >
            <div className="flex justify-between items-center z-[100] bg-white/80 border-b border-black/5 p-2 shrink-0" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-700 pl-1">Cant:</span>
                    <Input 
                        type="number" min={1} 
                        className="h-7 w-16 text-xs font-bold" 
                        value={layout.multiplier} 
                        onChange={(e) => onUpdate(l => ({ ...l, multiplier: parseInt(e.target.value) || 1 }))} 
                    />
                </div>
                {isActive && (
                    <div className="flex gap-1">
                         <Select value={layout.originX} onValueChange={(val: 'left' | 'right') => onUpdate(l => ({ ...l, originX: val }))}>
                              <SelectTrigger className="h-6 text-[10px] w-[70px] px-2">
                                   <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                   <SelectItem value="left" className="text-[10px]">X: Izq</SelectItem>
                                   <SelectItem value="right" className="text-[10px]">X: Der</SelectItem>
                              </SelectContent>
                         </Select>
                         <Select value={layout.originY} onValueChange={(val: 'bottom' | 'top') => onUpdate(l => ({ ...l, originY: val }))}>
                              <SelectTrigger className="h-6 text-[10px] w-[75px] px-2">
                                   <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                   <SelectItem value="bottom" className="text-[10px]">Y: Abajo</SelectItem>
                                   <SelectItem value="top" className="text-[10px]">Y: Arriba</SelectItem>
                              </SelectContent>
                         </Select>
                         <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 ml-1" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 className="h-3 w-3"/></Button>
                    </div>
                )}
            </div>
            
            <div className="flex-1 relative overflow-hidden min-h-0 bg-slate-100/50">
                {/* Measuring Container - Absolute to prevent circular flex dependency */}
                <div ref={containerRef} className="absolute inset-6 pointer-events-none" />

                {/* Action Bar */}
                {isActive && layout.selectedCells.size > 0 && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 bg-white p-1 rounded-full shadow-lg border border-primary/20 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold rounded-full text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 px-2" onClick={handleMergeSelected}>
                            Unir
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold rounded-full text-orange-700 hover:text-orange-800 hover:bg-orange-50 px-2" onClick={handleSplitSelected}>
                            Separar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold rounded-full text-green-700 hover:text-green-800 hover:bg-green-50 px-2" onClick={handleToggleRoleSelected}>
                            Útil/Sob.
                        </Button>
                    </div>
                )}

                {/* Content Container */}
                <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                    <div className="border-2 border-solid border-primary bg-white relative shadow-md transition-all pointer-events-auto" style={{ width: `${displayW}px`, height: `${displayH}px` }}>
                        {segments}
                        {cutLines}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface CuttingToolDialogProps {
    material: Material | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerateCuts: (newRemnants: Remnant[]) => void;
}

export function CuttingToolDialog({ material, open, onOpenChange, onGenerateCuts }: CuttingToolDialogProps) {
    const [layouts, setLayouts] = useState<SheetLayout[]>([]);
    const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);

    const [cutType, setCutType] = useState<'Vertical' | 'Horizontal'>('Vertical');
    const [cutSize, setCutSize] = useState<string>('');

    const [targetQty, setTargetQty] = useState<number | string>('');
    const [targetWidth, setTargetWidth] = useState<string>('');
    const [targetHeight, setTargetHeight] = useState<string>('');
    const [targetWidthUnit, setTargetWidthUnit] = useState<'m' | 'cm'>('m');
    const [targetHeightUnit, setTargetHeightUnit] = useState<'m' | 'cm'>('m');
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            const initial = createEmptyLayout();
            setLayouts([initial]);
            setActiveLayoutId(initial.id);
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

    const activeLayout = useMemo(() => layouts.find(l => l.id === activeLayoutId) || null, [layouts, activeLayoutId]);

    if (!material) return null;

    const matWidthCm = material.width;
    const matHeightCm = material.height;
    const matWidthM = convertFromCm(matWidthCm, 'm');
    const matHeightM = convertFromCm(matHeightCm, 'm');

    const handleAddEmptyLayout = () => {
        const nw = createEmptyLayout();
        setLayouts(prev => [...prev, nw]);
        setActiveLayoutId(nw.id);
    };

    const handleRemoveLayout = (id: string) => {
        setLayouts(prev => {
            const nw = prev.filter(l => l.id !== id);
            if (nw.length === 0) {
                 const fresh = createEmptyLayout();
                 setActiveLayoutId(fresh.id);
                 return [fresh];
            }
            if (activeLayoutId === id) {
                 setActiveLayoutId(nw[nw.length - 1].id);
            }
            return nw;
        });
    };

    const updateActiveLayout = (updater: (l: SheetLayout) => SheetLayout) => {
        if (!activeLayoutId) return;
        setLayouts(prev => prev.map(l => l.id === activeLayoutId ? updater(l) : l));
    };

    const handleAddCut = () => {
        const size = parseFloat(cutSize);
        if (isNaN(size) || size <= 0) return;

        const maxDim = cutType === 'Vertical' ? matWidthM : matHeightM;
        if (size >= maxDim) {
            setValidationError(`El corte de ${size}m excede el ${cutType === 'Vertical' ? 'ancho' : 'alto'} del material (${maxDim.toFixed(2)}m).`);
            return;
        }

        setValidationError(null);
        updateActiveLayout(l => ({
            ...l,
            cuts: [...l.cuts, { id: crypto.randomUUID(), type: cutType, size }]
        }));
        setCutSize('');
    };

    const handleRemoveCut = (id: string) => {
        updateActiveLayout(l => ({ ...l, cuts: l.cuts.filter(c => c.id !== id) }));
    };

    const handleClearCuts = () => {
        updateActiveLayout(l => ({ ...l, cuts: [], cellGroups: {}, groupRoles: {}, selectedCells: new Set() }));
    };

    const handleApplyCalculator = () => {
        const qty = parseInt(targetQty.toString());
        let w = parseFloat(targetWidth);
        let h = parseFloat(targetHeight);

        if (isNaN(qty) || isNaN(w) || isNaN(h) || qty <= 0 || w <= 0 || h <= 0) return;

        if (targetWidthUnit === 'cm') w = w / 100;
        if (targetHeightUnit === 'cm') h = h / 100;

        if (w > matWidthM || h > matHeightM) {
            setValidationError(`Las piezas de ${w.toFixed(2)}x${h.toFixed(2)}m no caben en una lámina de ${matWidthM.toFixed(2)}x${matHeightM.toFixed(2)}m.`);
            return;
        }

        setValidationError(null);
        const cols = Math.floor(matWidthM / w);
        const rows = Math.floor(matHeightM / h);

        const piecesPerSheet = cols * rows;
        if (piecesPerSheet === 0) return;

        const fullSheets = Math.floor(qty / piecesPerSheet);
        const remainder = qty % piecesPerSheet;

        const newLayouts: SheetLayout[] = [];

        if (fullSheets > 0) {
            const cuts: CutRequest[] = [];
            for (let i = 1; i <= cols; i++) {
                if (i * w < matWidthM) cuts.push({ id: crypto.randomUUID(), type: 'Vertical', size: i * w });
            }
            for (let i = 1; i <= rows; i++) {
                if (i * h < matHeightM) cuts.push({ id: crypto.randomUUID(), type: 'Horizontal', size: i * h });
            }
            newLayouts.push({
                id: crypto.randomUUID(),
                multiplier: fullSheets,
                cuts,
                selectedCells: new Set(),
                cellGroups: {},
                groupRoles: {},
                originX: 'left',
                originY: 'bottom'
            });
        }

        if (remainder > 0) {
            const cuts: CutRequest[] = [];
            const rCols = Math.ceil(remainder / rows);
            const rRows = remainder < rows ? remainder : rows;

            for (let i = 1; i <= rCols; i++) {
                if (i * w < matWidthM) cuts.push({ id: crypto.randomUUID(), type: 'Vertical', size: i * w });
            }
            for (let i = 1; i <= rRows; i++) {
                if (i * h < matHeightM) cuts.push({ id: crypto.randomUUID(), type: 'Horizontal', size: i * h });
            }

            newLayouts.push({
                id: crypto.randomUUID(),
                multiplier: 1,
                cuts,
                selectedCells: new Set(),
                cellGroups: {},
                groupRoles: {},
                originX: 'left',
                originY: 'bottom'
            });
        }

        if (newLayouts.length > 0) {
             setLayouts(newLayouts);
             setActiveLayoutId(newLayouts[0].id);
        }
    };

    const handleConfirm = () => {
        const allGeneratedRemnants: Remnant[] = [];

        layouts.forEach(layout => {
            if (layout.cuts.length === 0) {
                // If no cuts, the entire sheet is a single piece
                for (let i = 0; i < layout.multiplier; i++) {
                    const rectPoints = [
                        { x: 0, y: 0 },
                        { x: matWidthCm, y: 0 },
                        { x: matWidthCm, y: matHeightCm },
                        { x: 0, y: matHeightCm }
                    ];
                    allGeneratedRemnants.push({
                        id: crypto.randomUUID(),
                        materialId: material.id,
                        points: rectPoints,
                        fragments: [{ id: crypto.randomUUID(), points: rectPoints }],
                        x: matWidthCm / 2,
                        y: matHeightCm / 2,
                        width: matWidthCm,
                        height: matHeightCm,
                        createdAt: new Date(),
                        sourceSheetId: crypto.randomUUID(),
                    });
                }
                return;
            }

            const verticalDistances = Array.from(new Set(
                layout.cuts.filter(c => c.type === 'Vertical').map(c => convertToCm(c.size, 'm')).filter(d => d > 0 && d < matWidthCm)
            )).sort((a, b) => a - b);
            const horizontalDistances = Array.from(new Set(
                layout.cuts.filter(c => c.type === 'Horizontal').map(c => convertToCm(c.size, 'm')).filter(d => d > 0 && d < matHeightCm)
            )).sort((a, b) => a - b);

            const xPoints = [0, ...verticalDistances, matWidthCm];
            const yPoints = [0, ...horizontalDistances, matHeightCm];

            for (let i = 0; i < layout.multiplier; i++) {
                const sourceSheetId = crypto.randomUUID();
                const processedCells = new Set<string>();

                Object.entries(layout.cellGroups).forEach(([gId, gCells]) => {
                    const cellsInGroup: { xStart: number; xEnd: number; yStart: number; yEnd: number }[] = [];
                    gCells.forEach(cellId => {
                        const [, xiStr, yiStr] = cellId.split('-');
                        const xi = parseInt(xiStr);
                        const yi = parseInt(yiStr);
                        processedCells.add(cellId);
                        
                        const trueXStart = layout.originX === 'left' ? xPoints[xi] : matWidthCm - xPoints[xi + 1];
                        const trueXEnd   = layout.originX === 'left' ? xPoints[xi + 1] : matWidthCm - xPoints[xi];

                        const trueYStart = layout.originY === 'top' ? yPoints[yi] : matHeightCm - yPoints[yi + 1];
                        const trueYEnd   = layout.originY === 'top' ? yPoints[yi + 1] : matHeightCm - yPoints[yi];

                        cellsInGroup.push({
                            xStart: trueXStart,
                            xEnd: trueXEnd,
                            yStart: trueYStart,
                            yEnd: trueYEnd
                        });
                    });
                    
                    const unionedPaths = unionCells(cellsInGroup);
                    unionedPaths.forEach(path => {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        path.forEach(pt => {
                            minX = Math.min(minX, pt.x);
                            minY = Math.min(minY, pt.y);
                            maxX = Math.max(maxX, pt.x);
                            maxY = Math.max(maxY, pt.y);
                        });
                        
                        const w = maxX - minX;
                        const h = maxY - minY;
                        if (w < 0.5 || h < 0.5) return;
                        
                        const relativePoints = path.map(pt => ({
                            x: pt.x - minX,
                            y: pt.y - minY
                        }));
                        
                        allGeneratedRemnants.push({
                            id: crypto.randomUUID(),
                            materialId: material.id,
                            points: relativePoints,
                            fragments: [{ id: crypto.randomUUID(), points: relativePoints }],
                            x: w / 2,
                            y: h / 2,
                            width: w,
                            height: h,
                            createdAt: new Date(),
                            sourceSheetId,
                        });
                    });
                });

                for (let yi = 0; yi < yPoints.length - 1; yi++) {
                    for (let xi = 0; xi < xPoints.length - 1; xi++) {
                        const cellId = `seg-${xi}-${yi}`;
                        if (processedCells.has(cellId)) continue; 

                        const trueXStart = layout.originX === 'left' ? xPoints[xi] : matWidthCm - xPoints[xi + 1];
                        const trueXEnd   = layout.originX === 'left' ? xPoints[xi + 1] : matWidthCm - xPoints[xi];

                        const trueYStart = layout.originY === 'top' ? yPoints[yi] : matHeightCm - yPoints[yi + 1];
                        const trueYEnd   = layout.originY === 'top' ? yPoints[yi + 1] : matHeightCm - yPoints[yi];

                        const w = trueXEnd - trueXStart;
                        const h = trueYEnd - trueYStart;

                        if (w < 0.5 || h < 0.5) continue; 

                        const rectPoints = [
                            { x: 0, y: 0 },
                            { x: w, y: 0 },
                            { x: w, y: h },
                            { x: 0, y: h }
                        ];

                        allGeneratedRemnants.push({
                            id: crypto.randomUUID(),
                            materialId: material.id,
                            points: rectPoints,
                            fragments: [{ id: crypto.randomUUID(), points: rectPoints }],
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
        });

        onGenerateCuts(allGeneratedRemnants);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1200px] overflow-hidden w-[95vw] h-[90vh] flex flex-col">
                {validationError && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white text-[11px] font-bold py-2 px-6 rounded-full shadow-2xl border border-red-700/50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
                        <span className="animate-pulse">⚠</span> {validationError}
                    </div>
                )}
                <DialogHeader className="pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="h-5 w-5" />
                        Gestor de Cortes (Producción en Lotes)
                    </DialogTitle>
                    <DialogDescription>
                        Configura patrones de corte para múltiples láminas de <span className="font-semibold text-primary">{material.name}</span> ({matWidthM}m x {matHeightM}m)
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                    <div className="flex-[2] flex flex-col overflow-hidden border rounded-xl bg-slate-50/50 p-4">
                        <h4 className="font-semibold text-sm mb-4 text-slate-700">Patrones de Láminas (Multi-Lámina)</h4>
                        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-stretch px-2 min-h-0">
                            {layouts.map(layout => (
                                <PreviewBoard 
                                    key={layout.id} 
                                    layout={layout}
                                    isActive={layout.id === activeLayoutId}
                                    onSelect={() => setActiveLayoutId(layout.id)}
                                    onUpdate={(updater) => setLayouts(prev => prev.map(l => l.id === layout.id ? updater(l) : l))}
                                    onRemove={() => handleRemoveLayout(layout.id)}
                                    matWidthCm={matWidthCm} matHeightCm={matHeightCm} matWidthM={matWidthM} matHeightM={matHeightM}
                                />
                            ))}
                            <button onClick={handleAddEmptyLayout} className="flex-shrink-0 h-[300px] w-[150px] border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-primary hover:border-primary hover:bg-primary/5 cursor-pointer transition-all">
                                <Plus className="h-8 w-8 mb-2" />
                                <span className="text-xs font-semibold">Añadir Lámina Diferente</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-[1] flex flex-col gap-4 overflow-y-auto pr-2">
                        <div className="rounded-lg border p-3 space-y-3 bg-blue-50/20 shadow-sm border-blue-200/40">
                            <h4 className="font-semibold text-xs flex items-center gap-2 text-blue-700 uppercase tracking-tight">
                                <Plus className="h-3.5 w-3.5" /> Generador Inteligente (Auto-Nesting)
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold">Cant.</Label>
                                    <Input type="text" inputMode="numeric" placeholder="Total" className="h-7 text-xs px-2 font-mono" value={targetQty} onInput={e => { const val = (e.target as HTMLInputElement).value; if (val === '' || /^\d*$/.test(val)) setTargetQty(val); }} onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold flex items-center justify-between">
                                        <span>Ancho</span>
                                        <div className="flex bg-blue-100/50 p-0.5 rounded-md border border-blue-200/50 scale-90 origin-right">
                                            {['m', 'cm'].map((u) => (
                                                <button key={u} onClick={() => setTargetWidthUnit(u as any)} className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${targetWidthUnit === u ? 'bg-white shadow-sm text-blue-700' : 'text-blue-400 hover:text-blue-600'}`}>{u}</button>
                                            ))}
                                        </div>
                                    </Label>
                                    <Input type="text" inputMode="decimal" placeholder="0.00" className="h-7 text-xs px-2 font-mono" value={targetWidth} onInput={e => { const val = (e.target as HTMLInputElement).value; if (val === '' || /^\d*\.?\d*$/.test(val)) setTargetWidth(val); }} onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold flex items-center justify-between">
                                        <span>Alto</span>
                                        <div className="flex bg-blue-100/50 p-0.5 rounded-md border border-blue-200/50 scale-90 origin-right">
                                            {['m', 'cm'].map((u) => (
                                                <button key={u} onClick={() => setTargetHeightUnit(u as any)} className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${targetHeightUnit === u ? 'bg-white shadow-sm text-blue-700' : 'text-blue-400 hover:text-blue-600'}`}>{u}</button>
                                            ))}
                                        </div>
                                    </Label>
                                    <Input type="text" inputMode="decimal" placeholder="0.00" className="h-7 text-xs px-2 font-mono" value={targetHeight} onInput={e => { const val = (e.target as HTMLInputElement).value; if (val === '' || /^\d*\.?\d*$/.test(val)) setTargetHeight(val); }} onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()} />
                                </div>
                            </div>
                            <div className="flex justify-center mt-2 group">
                                <Button size="sm" className="h-8 px-6 text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all rounded-full" onClick={handleApplyCalculator}>
                                    DEDUCIR LÁMINAS
                                </Button>
                            </div>
                        </div>

                        <div className={`rounded-lg border p-3 space-y-3 bg-slate-50 shadow-sm transition-opacity ${!activeLayout ? 'opacity-50 pointer-events-none' : ''}`}>
                            <h4 className="font-semibold text-xs flex items-center gap-2 text-primary uppercase tracking-tight">
                                <Scissors className="h-3.5 w-3.5" /> Añadir Punto de Corte Manual
                            </h4>
                            <div className="flex gap-2 items-end">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold">Eje</Label>
                                    <Select value={cutType} onValueChange={(v: any) => setCutType(v)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Vertical" className="text-xs">Vertical (Ancho)</SelectItem>
                                            <SelectItem value="Horizontal" className="text-xs">Horizontal (Alto)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1 flex-[1.5]">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold">Distancia (m)</Label>
                                    <div className="relative group">
                                        <Input type="text" inputMode="decimal" value={cutSize} onInput={(e) => { const val = (e.target as HTMLInputElement).value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setCutSize(val); if (validationError) setValidationError(null); } }} placeholder="0.00" className="h-8 text-xs pr-9 font-mono" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCut(); } }} />
                                        <Button onClick={handleAddCut} size="icon" className="absolute top-0 right-0 h-8 w-8 rounded-l-none bg-blue-600 hover:bg-blue-700" disabled={!cutSize || parseFloat(cutSize) <= 0}><Plus className="h-3.5 w-3.5" /></Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col min-h-[200px]">
                            <Label className="flex justify-between items-center">
                                <span>Lista de Cortes (Lámina Activa):</span>
                                <div className="flex items-center gap-2">
                                    {activeLayout?.cuts && activeLayout.cuts.length > 0 && (
                                        <Button variant="outline" size="sm" className="h-5 px-3 mb-1 text-[10px] text-red-600 border-red-200 hover:bg-red-50 font-bold" onClick={handleClearCuts}>
                                            Borrar Todo
                                        </Button>
                                    )}
                                </div>
                            </Label>
                            <div className="border rounded-md flex-1 overflow-hidden flex flex-col bg-background shadow-inner">
                                {!activeLayout || activeLayout.cuts.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
                                        La lámina seleccionada no tiene cortes.
                                    </div>
                                ) : (
                                    <ScrollArea className="flex-1">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="py-2 h-8 w-[40px]">#</TableHead>
                                                    <TableHead className="py-2 h-8">Tipo</TableHead>
                                                    <TableHead className="py-2 h-8 text-right pr-4">Dist.</TableHead>
                                                    <TableHead className="py-2 h-8 w-[40px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activeLayout.cuts.map((cut, idx) => (
                                                    <TableRow key={cut.id}>
                                                        <TableCell className="py-2 h-8 text-muted-foreground text-xs">{idx + 1}</TableCell>
                                                        <TableCell className="py-2 h-8">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${cut.type === 'Vertical' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {cut.type === 'Vertical' ? 'Vert.' : 'Horiz.'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-2 h-8 text-right pr-4 font-mono font-bold text-sm">{cut.size}m</TableCell>
                                                        <TableCell className="py-2 h-8">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveCut(cut.id)}>
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

                <DialogFooter className="border-t pt-4 shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirm} className="min-w-[250px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                        {layouts.some(l => l.cuts.length > 0) ? `Producir ${layouts.reduce((acc, l) => acc + l.multiplier, 0)} Láminas con Cortes` : "Mantener Lámina Completa"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
