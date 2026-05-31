import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Scissors, Calculator } from "lucide-react";
import { Material, Remnant } from "@/lib/types";
import { convertFromCm } from "@/lib/utils";
import { PreviewBoard } from "./PreviewBoard";
import { useMultiSheet } from "./hooks/useMultiSheet";

interface CuttingToolDialogProps {
    material: Material | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerateCuts: (newRemnants: Remnant[]) => void;
}

// ---- Evaluador Matemático Seguro ----
const evaluateEquation = (eq: string): string => {
    const sanitized = eq.replace(/\s+/g, '');
    if (!sanitized) return '0';
    
    // Validar estrictamente caracteres matemáticos permitidos
    if (!/^[0-9.+\-*/()]+$/.test(sanitized)) {
        return 'Error';
    }
    
    try {
        // Evaluar de forma segura
        const result = Function(`"use strict"; return (${sanitized})`)();
        if (result === null || result === undefined || isNaN(result) || !isFinite(result)) {
            return 'Error';
        }
        // Redondear a máximo 4 decimales
        return parseFloat(result.toFixed(4)).toString();
    } catch (err) {
        return 'Error';
    }
};

// ---- Subcomponente Calculadora Rápida Estilo Smartphone ----
function QuickCalculator() {
    const [equation, setEquation] = useState('');
    const [result, setResult] = useState('');
    const [isSolved, setIsSolved] = useState(false);

    const handleKeyPress = (val: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (val === 'C') {
            setEquation('');
            setResult('');
            setIsSolved(false);
        } else if (val === '←') {
            if (isSolved) {
                setEquation('');
                setResult('');
                setIsSolved(false);
            } else {
                setEquation(prev => prev.slice(0, -1));
            }
        } else if (val === '=') {
            if (!equation) return;
            const res = evaluateEquation(equation);
            setResult(res);
            setIsSolved(true);
        } else {
            if (isSolved) {
                // Continuar operación con el resultado anterior si se ingresa un operador
                if (['+', '-', '*', '/'].includes(val)) {
                    setEquation(result + val);
                } else {
                    // Iniciar nueva operación limpia si se escribe un número
                    setEquation(val);
                }
                setResult('');
                setIsSolved(false);
            } else {
                setEquation(prev => prev + val);
            }
        }
    };

    const buttons = [
        ['C', '(', ')', '/'],
        ['7', '8', '9', '*'],
        ['4', '5', '6', '-'],
        ['1', '2', '3', '+'],
        ['0', '.', '←', '=']
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3 rounded-full flex items-center gap-1.5 border-blue-200/50 hover:bg-blue-50 hover:text-blue-600 transition-all pointer-events-auto shrink-0 shadow-sm"
                    onClick={e => e.stopPropagation()}
                >
                    <Calculator className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold">Calculadora</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="end"
                className="w-64 p-3 rounded-2xl bg-background/95 backdrop-blur-md shadow-2xl border border-muted/50 z-[200] pointer-events-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b pb-1.5">
                        <Calculator className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Calculadora Rápida</span>
                    </div>
                    
                    {/* Pantalla digital inteligente tipo smartphone */}
                    <div className="bg-slate-50/80 text-slate-800 p-2.5 rounded-xl text-right font-mono select-all border border-slate-200/60 shadow-inner flex flex-col justify-between min-h-[58px]">
                        <div className="text-[10px] text-slate-400 min-h-[14px] overflow-x-auto whitespace-nowrap scrollbar-none transition-all">
                            {isSolved ? equation : ''}
                        </div>
                        <div className={`text-xl font-bold truncate transition-all duration-150 ${isSolved ? 'text-blue-600' : 'text-slate-700'}`}>
                            {isSolved ? result : (equation || '0')}
                        </div>
                    </div>

                    {/* Grilla de botones */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {buttons.flat().map(btn => {
                            let bgClass = 'bg-muted/50 hover:bg-muted text-foreground';
                            if (btn === '=') {
                                bgClass = 'bg-blue-600 hover:bg-blue-700 text-white font-bold';
                            } else if (btn === 'C' || btn === '←') {
                                bgClass = 'bg-red-500/10 hover:bg-red-500/20 text-red-600 font-bold';
                            } else if (['+', '-', '*', '/'].includes(btn)) {
                                bgClass = 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 font-bold';
                            }
                            
                            return (
                                <button
                                    type="button"
                                    key={btn}
                                    onClick={e => handleKeyPress(btn, e)}
                                    className={`h-9 text-xs rounded-lg transition-all active:scale-95 flex items-center justify-center ${bgClass}`}
                                >
                                    {btn}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function CuttingToolDialog({ material, open, onOpenChange, onGenerateCuts }: CuttingToolDialogProps) {
    const {
        layouts,
        activeLayout,
        activeLayoutId,
        setActiveLayoutId,
        cutType,
        setCutType,
        cutSize,
        setCutSize,
        targetQty,
        setTargetQty,
        targetWidth,
        setTargetWidth,
        targetHeight,
        setTargetHeight,
        targetWidthUnit,
        setTargetWidthUnit,
        targetHeightUnit,
        setTargetHeightUnit,
        validationError,
        setValidationError,
        handleAddEmptyLayout,
        handleRemoveLayout,
        updateActiveLayout,
        handleAddCut,
        handleRemoveCut,
        handleClearCuts,
        handleApplyCalculator,
        handleConfirm
    } = useMultiSheet(material, open, onOpenChange, onGenerateCuts);

    if (!material) return null;

    const matWidthCm = material.width;
    const matHeightCm = material.height;
    const matWidthM = convertFromCm(matWidthCm, 'm');
    const matHeightM = convertFromCm(matHeightCm, 'm');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1200px] overflow-hidden w-[95vw] h-[90vh] flex flex-col">
                {validationError && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white text-[11px] font-bold py-2 px-6 rounded-full shadow-2xl border border-red-700/50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
                        <span className="animate-pulse">⚠</span> {validationError}
                    </div>
                )}
                <DialogHeader className="pb-2 pr-6">
                    <div className="flex items-center justify-between w-full">
                        <DialogTitle className="flex items-center gap-2">
                            <Scissors className="h-5 w-5" />
                            Gestor de Cortes (Producción en Lotes)
                        </DialogTitle>
                        <QuickCalculator />
                    </div>
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
                                    onUpdate={(updater) => updateActiveLayout(updater)}
                                    onRemove={() => handleRemoveLayout(layout.id)}
                                    matWidthCm={matWidthCm} matHeightCm={matHeightCm} matWidthM={matWidthM} matHeightM={matHeightM}
                                />
                            ))}
                            <button type="button" onClick={handleAddEmptyLayout} className="flex-shrink-0 h-[300px] w-[150px] border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-primary hover:border-primary hover:bg-primary/5 cursor-pointer transition-all">
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
                                                <button type="button" key={u} onClick={() => setTargetWidthUnit(u as any)} className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${targetWidthUnit === u ? 'bg-white shadow-sm text-blue-700' : 'text-blue-400 hover:text-blue-600'}`}>{u}</button>
                                            ))}
                                        </div>
                                    </Label>
                                    <Input type="text" inputMode="decimal" placeholder="0.00" className="h-7 text-xs px-2 font-mono" value={targetWidth} onInput={e => { const val = (e.target as HTMLInputElement).value; if (val === '' || /^\d*[.,]?\d*$/.test(val)) setTargetWidth(val); }} onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase text-muted-foreground font-bold flex items-center justify-between">
                                        <span>Alto</span>
                                        <div className="flex bg-blue-100/50 p-0.5 rounded-md border border-blue-200/50 scale-90 origin-right">
                                            {['m', 'cm'].map((u) => (
                                                <button type="button" key={u} onClick={() => setTargetHeightUnit(u as any)} className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${targetHeightUnit === u ? 'bg-white shadow-sm text-blue-700' : 'text-blue-400 hover:text-blue-600'}`}>{u}</button>
                                            ))}
                                        </div>
                                    </Label>
                                    <Input type="text" inputMode="decimal" placeholder="0.00" className="h-7 text-xs px-2 font-mono" value={targetHeight} onInput={e => { const val = (e.target as HTMLInputElement).value; if (val === '' || /^\d*[.,]?\d*$/.test(val)) setTargetHeight(val); }} onKeyDown={e => e.key === 'Enter' && handleApplyCalculator()} />
                                </div>
                            </div>
                            <div className="flex justify-center mt-2 group">
                                <Button type="button" size="sm" className="h-8 px-6 text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all rounded-full" onClick={handleApplyCalculator}>
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
                                        <Button type="button" onClick={handleAddCut} size="icon" className="absolute top-0 right-0 h-8 w-8 rounded-l-none bg-blue-600 hover:bg-blue-700" disabled={!cutSize || parseFloat(cutSize) <= 0}><Plus className="h-3.5 w-3.5" /></Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col min-h-[200px]">
                            <Label className="flex justify-between items-center">
                                <span>Lista de Cortes (Lámina Activa):</span>
                                <div className="flex items-center gap-2">
                                    {activeLayout?.cuts && activeLayout.cuts.length > 0 && (
                                        <Button type="button" variant="outline" size="sm" className="h-5 px-3 mb-1 text-[10px] text-red-600 border-red-200 hover:bg-red-50 font-bold" onClick={handleClearCuts}>
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
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveCut(cut.id)}>
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
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="button" onClick={handleConfirm} className="min-w-[250px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                        {layouts.some(l => l.cuts.length > 0) ? `Producir ${layouts.reduce((acc, l) => acc + l.multiplier, 0)} Láminas con Cortes` : "Mantener Lámina Completa"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
