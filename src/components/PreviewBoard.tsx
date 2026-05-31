import React, { useRef } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { convertFromCm, convertToCm } from "@/lib/utils";

export interface CutRequest {
    id: string;
    type: 'Vertical' | 'Horizontal';
    size: number; // in meters
}

export interface SheetLayout {
    id: string;
    multiplier: number;
    cuts: CutRequest[];
    selectedCells: Set<string>;
    cellGroups: Record<string, Set<string>>;
    groupRoles: Record<string, 'useful' | 'remnant'>;
    originX: 'left' | 'right';
    originY: 'bottom' | 'top';
}

export function createEmptyLayout(): SheetLayout {
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

export function PreviewBoard({
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
