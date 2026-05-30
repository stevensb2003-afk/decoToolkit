import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Undo, Ruler, BoxSelect, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { convertFromCm } from "@/lib/utils";
import { Measurement, VertexMeasurement, VertexFigure } from "@/lib/types";

interface UnifiedMeasurementPanelProps {
    areaMeasurements: Measurement[];
    vertexMeasurements: VertexMeasurement[];
    savedVertexFigures?: VertexFigure[];
    onClearArea: () => void;
    onClearVertex: () => void;
    onUndoVertex: () => void;
    canUndoVertex: boolean;
    showAreaMeasurements: boolean;
    showVertexMeasurements: boolean;
    onToggleAreaVisibility: () => void;
    onToggleVertexVisibility: () => void;
    hiddenAreaIds: string[];
    hiddenVertexFigureIds: string[];
    onToggleAreaItemVisibility: (id: string) => void;
    onToggleVertexFigureItemVisibility: (id: string) => void;
    onDeleteAreaItem: (id: string) => void;
    onDeleteVertexFigureItem: (id: string) => void;
}

export function UnifiedMeasurementPanel({
    areaMeasurements,
    vertexMeasurements,
    savedVertexFigures = [],
    onClearArea,
    onClearVertex,
    onUndoVertex,
    canUndoVertex,
    showAreaMeasurements,
    showVertexMeasurements,
    onToggleAreaVisibility,
    onToggleVertexVisibility,
    hiddenAreaIds,
    hiddenVertexFigureIds,
    onToggleAreaItemVisibility,
    onToggleVertexFigureItemVisibility,
    onDeleteAreaItem,
    onDeleteVertexFigureItem,
}: UnifiedMeasurementPanelProps) {
    const [isAreaExpanded, setIsAreaExpanded] = useState(true);
    const [isVertexExpanded, setIsVertexExpanded] = useState(true);

    return (
        <div className="absolute top-4 left-4 z-40 w-64 space-y-2">
            {areaMeasurements.length > 0 && (
                <Card className="shadow-lg bg-background/95 backdrop-blur">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <button
                                onClick={() => setIsAreaExpanded(!isAreaExpanded)}
                                className="flex items-center gap-2 hover:opacity-75 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {isAreaExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="flex items-center gap-2">
                                    <BoxSelect className="h-4 w-4" /> Áreas
                                </span>
                            </button>
                            {isAreaExpanded && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleAreaVisibility} title={showAreaMeasurements ? "Ocultar en lienzo" : "Mostrar en lienzo"}>
                                        {showAreaMeasurements ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearArea} title="Borrar todas">
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </CardTitle>
                    </CardHeader>
                    {isAreaExpanded && (
                        <CardContent className="p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                            {areaMeasurements.map((m, i) => (
                                <div key={m.id || i} className="flex justify-between items-center bg-muted/50 p-1.5 rounded group/item">
                                    <span>#{i + 1}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono">
                                            {convertFromCm(m.width, 'm').toFixed(2)}m x {convertFromCm(m.height, 'm').toFixed(2)}m
                                        </span>
                                        <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onToggleAreaItemVisibility(m.id)} title={hiddenAreaIds.includes(m.id) ? "Mostrar" : "Ocultar"}>
                                                {hiddenAreaIds.includes(m.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => onDeleteAreaItem(m.id)} title="Eliminar">
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}

            {(vertexMeasurements.length > 0 || savedVertexFigures.length > 0 || canUndoVertex) && (
                <Card className="shadow-lg bg-background/95 backdrop-blur">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <button
                                onClick={() => setIsVertexExpanded(!isVertexExpanded)}
                                className="flex items-center gap-2 hover:opacity-75 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {isVertexExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="flex items-center gap-2">
                                    <Ruler className="h-4 w-4" /> Distancias
                                </span>
                            </button>
                            {isVertexExpanded && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleVertexVisibility} title={showVertexMeasurements ? "Ocultar en lienzo" : "Mostrar en lienzo"}>
                                        {showVertexMeasurements ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={onUndoVertex}
                                        disabled={!canUndoVertex}
                                        title="Deshacer último punto"
                                    >
                                        <Undo className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearVertex} title="Borrar todas">
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </CardTitle>
                    </CardHeader>
                    {isVertexExpanded && (vertexMeasurements.length > 0 || savedVertexFigures.length > 0) && (
                        <CardContent className="p-3 max-h-64 overflow-y-auto text-xs space-y-3">
                            {savedVertexFigures.map((fig, figIndex) => (
                                <details key={fig.id} className="space-y-1 group/details">
                                    <summary className="font-semibold text-muted-foreground cursor-pointer flex items-center justify-between list-none [&::-webkit-details-marker]:hidden select-none bg-muted/20 p-1 rounded hover:bg-muted/40 transition-colors group/summary">
                                        <div className="flex items-center gap-2">
                                            <ChevronDown className="h-4 w-4 transition-transform group-open/details:rotate-180" />
                                            <span>Figura {figIndex + 1}</span>
                                        </div>
                                        <div className="flex items-center opacity-0 group-hover/summary:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.preventDefault(); onToggleVertexFigureItemVisibility(fig.id); }} title={hiddenVertexFigureIds.includes(fig.id) ? "Mostrar" : "Ocultar"}>
                                                {hiddenVertexFigureIds.includes(fig.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={(e) => { e.preventDefault(); onDeleteVertexFigureItem(fig.id); }} title="Eliminar">
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </summary>
                                    <div className="space-y-1 mt-1 pl-6">
                                        {fig.segments.map((m, i) => (
                                            <div key={i} className="flex justify-between items-center bg-muted/50 p-1.5 rounded">
                                                <span>Línea {i + 1}</span>
                                                <span className="font-mono">
                                                    {convertFromCm(m.length, 'm').toFixed(2)}m
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))}
                            {vertexMeasurements.length > 0 && (
                                <div className="space-y-1">
                                    <div className="font-semibold text-muted-foreground">Dibujando...</div>
                                    {vertexMeasurements.map((m, i) => (
                                        <div key={i} className="flex justify-between items-center bg-muted/50 p-1.5 rounded">
                                            <span>Línea {i + 1}</span>
                                            <span className="font-mono">
                                                {convertFromCm(m.length, 'm').toFixed(2)}m
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}
