import { useState, useEffect, useMemo } from 'react';
import * as ClipperLib from 'clipper-lib';
import { Material, Remnant, Point } from "@/lib/types";
import { convertFromCm, convertToCm } from "@/lib/utils";
import { SheetLayout, CutRequest, createEmptyLayout } from '../PreviewBoard';

const SCALE_FACTOR = 1000;

// Generador local de identificadores únicos (UUID fallback) inmune a restricciones de seguridad del navegador
const generateUUID = () => {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export function unionCells(
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

export function useMultiSheet(
    material: Material | null,
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onGenerateCuts: (newRemnants: Remnant[]) => void
) {
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
        if (!material) return;
        const size = parseFloat(cutSize.replace(',', '.'));
        if (isNaN(size) || size <= 0) {
            setValidationError("Ingrese una distancia numérica válida mayor a cero.");
            return;
        }

        const matWidthM = convertFromCm(material.width, 'm');
        const matHeightM = convertFromCm(material.height, 'm');
        const maxDim = cutType === 'Vertical' ? matWidthM : matHeightM;
        if (size >= maxDim) {
            setValidationError(`El corte de ${size}m excede el ${cutType === 'Vertical' ? 'ancho' : 'alto'} del material (${maxDim.toFixed(2)}m).`);
            return;
        }

        setValidationError(null);
        updateActiveLayout(l => ({
            ...l,
            cuts: [...l.cuts, { id: generateUUID(), type: cutType, size }]
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
        if (!material) return;

        // Limpiar errores previos
        setValidationError(null);

        // Validación inicial de campos vacíos
        if (!targetQty || !targetWidth || !targetHeight) {
            setValidationError("Por favor, complete todos los campos de cantidad, ancho y alto.");
            return;
        }

        const qty = parseInt(targetQty.toString());
        
        // Reemplazar coma por punto para tolerar formatos numéricos en español
        let w = parseFloat(targetWidth.toString().replace(',', '.'));
        let h = parseFloat(targetHeight.toString().replace(',', '.'));

        if (isNaN(qty) || isNaN(w) || isNaN(h) || qty <= 0 || w <= 0 || h <= 0) {
            setValidationError("Por favor, ingrese valores numéricos válidos mayores a cero.");
            return;
        }

        // Conversión opcional de centímetros a metros
        if (targetWidthUnit === 'cm') w = w / 100;
        if (targetHeightUnit === 'cm') h = h / 100;

        const matWidthM = convertFromCm(material.width, 'm');
        const matHeightM = convertFromCm(material.height, 'm');

        // Validar si la pieza física cabe en el material
        if (w > matWidthM || h > matHeightM) {
            setValidationError(`Las piezas de ${w.toFixed(2)}x${h.toFixed(2)}m no caben en una lámina de ${matWidthM.toFixed(2)}x${matHeightM.toFixed(2)}m.`);
            return;
        }

        const cols = Math.floor(matWidthM / w);
        const rows = Math.floor(matHeightM / h);

        const piecesPerSheet = cols * rows;
        if (piecesPerSheet === 0) {
            setValidationError("Las dimensiones ingresadas impiden colocar piezas en la lámina.");
            return;
        }

        const fullSheets = Math.floor(qty / piecesPerSheet);
        const remainder = qty % piecesPerSheet;

        const newLayouts: SheetLayout[] = [];

        if (fullSheets > 0) {
            const cuts: CutRequest[] = [];
            for (let i = 1; i <= cols; i++) {
                if (i * w < matWidthM) cuts.push({ id: generateUUID(), type: 'Vertical', size: i * w });
            }
            for (let i = 1; i <= rows; i++) {
                if (i * h < matHeightM) cuts.push({ id: generateUUID(), type: 'Horizontal', size: i * h });
            }
            newLayouts.push({
                id: generateUUID(),
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
                if (i * w < matWidthM) cuts.push({ id: generateUUID(), type: 'Vertical', size: i * w });
            }
            for (let i = 1; i <= rRows; i++) {
                if (i * h < matHeightM) cuts.push({ id: generateUUID(), type: 'Horizontal', size: i * h });
            }

            newLayouts.push({
                id: generateUUID(),
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
        if (!material) return;
        const matWidthCm = material.width;
        const matHeightCm = material.height;
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
                        id: generateUUID(),
                        materialId: material.id,
                        points: rectPoints,
                        fragments: [{ id: generateUUID(), points: rectPoints }],
                        x: matWidthCm / 2,
                        y: matHeightCm / 2,
                        width: matWidthCm,
                        height: matHeightCm,
                        createdAt: new Date(),
                        sourceSheetId: generateUUID(),
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
                const sourceSheetId = generateUUID();
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
                            id: generateUUID(),
                            materialId: material.id,
                            points: relativePoints,
                            fragments: [{ id: generateUUID(), points: relativePoints }],
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
                            id: generateUUID(),
                            materialId: material.id,
                            points: rectPoints,
                            fragments: [{ id: generateUUID(), points: rectPoints }],
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

    return {
        layouts,
        setLayouts,
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
    };
}
