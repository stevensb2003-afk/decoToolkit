"use client";

import { Button } from "@/components/ui/button";
import { Plus, Save, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
    onAddNode: () => void;
    onSave: () => void;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
    onOpenHistory: () => void;
}

export function EditorToolbar({
    onAddNode,
    onSave,
    isSaving,
    hasUnsavedChanges,
    onOpenHistory,
}: EditorToolbarProps) {
    return (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl rounded-xl px-2 py-1.5">
            {/* Add node */}
            <Button
                onClick={onAddNode}
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium text-slate-700 hover:text-primary hover:bg-primary/5"
            >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Agregar paso</span>
            </Button>

            <div className="w-px h-5 bg-slate-200" />

            {/* Save */}
            <Button
                onClick={onSave}
                disabled={isSaving || !hasUnsavedChanges}
                size="sm"
                className={cn(
                    "h-8 gap-1.5 text-xs relative",
                    hasUnsavedChanges && !isSaving && "ring-2 ring-orange-300"
                )}
            >
                {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <Save className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                    {isSaving ? "Guardando…" : "Guardar"}
                </span>
                {hasUnsavedChanges && !isSaving && (
                    <Circle className="w-2 h-2 fill-orange-400 text-orange-400 absolute -top-1 -right-1" />
                )}
            </Button>

            <div className="w-px h-5 bg-slate-200" />

            {/* Version history */}
            <Button
                onClick={onOpenHistory}
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-slate-600 hover:text-primary hover:bg-primary/5"
                title="Historial de versiones"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Historial</span>
            </Button>
        </div>
    );
}
