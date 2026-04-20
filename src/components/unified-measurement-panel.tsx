import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Undo, Ruler, BoxSelect, ChevronDown, ChevronUp } from "lucide-react";
import { convertFromCm } from "@/lib/utils";
import { Measurement, VertexMeasurement } from "@/lib/types";

interface UnifiedMeasurementPanelProps {
    areaMeasurements: Measurement[];
    vertexMeasurements: VertexMeasurement[];
    onClearArea: () => void;
    onClearVertex: () => void;
    onUndoVertex: () => void;
    canUndoVertex: boolean;
}

export function UnifiedMeasurementPanel({
    areaMeasurements,
    vertexMeasurements,
    onClearArea,
    onClearVertex,
    onUndoVertex,
    canUndoVertex
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
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearArea} title="Borrar todas">
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    {isAreaExpanded && (
                        <CardContent className="p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                            {areaMeasurements.map((m, i) => (
                                <div key={m.id || i} className="flex justify-between items-center bg-muted/50 p-1.5 rounded">
                                    <span>#{i + 1}</span>
                                    <span className="font-mono">
                                        {convertFromCm(m.width, 'm').toFixed(2)}m x {convertFromCm(m.height, 'm').toFixed(2)}m
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}

            {(vertexMeasurements.length > 0 || canUndoVertex) && (
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
                    {isVertexExpanded && vertexMeasurements && vertexMeasurements.length > 0 && (
                        <CardContent className="p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                            {vertexMeasurements.map((m, i) => (
                                <div key={i} className="flex justify-between items-center bg-muted/50 p-1.5 rounded">
                                    <span>#{i + 1}</span>
                                    <span className="font-mono">
                                        {convertFromCm(m.length, 'm').toFixed(2)}m
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}
