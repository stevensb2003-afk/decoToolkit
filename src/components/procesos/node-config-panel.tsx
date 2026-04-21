"use client";

import { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TipTapEditor } from "./tiptap-editor";
import { Trash2, Link as LinkIcon, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodeConfigPanelProps {
    selectedNode: Node | null;
    selectedEdge: Edge | null;
    onUpdateNode: (field: string, value: any) => void;
    onDeleteNode: () => void;
    onDeleteEdge: () => void;
}

const PLATFORMS = ["Ninguna", "DecoEntrega", "DecoToolkit", "DecoTrack", "Alegra", "Otros"];
const ROLES = ["Encargado", "Aprobador", "Ejecutor", "Revisador", "Otros"];

const ACCENT_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
    "#ef4444", "#64748b",
];

export function NodeConfigPanel({
    selectedNode,
    selectedEdge,
    onUpdateNode,
    onDeleteNode,
    onDeleteEdge,
}: NodeConfigPanelProps) {
    if (!selectedNode && !selectedEdge) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 text-muted-foreground gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                </div>
                <p className="text-sm">Selecciona un bloque o una conexión para editar sus propiedades.</p>
            </div>
        );
    }

    if (selectedEdge) {
        return (
            <div className="p-4 space-y-4">
                <div className="p-3 bg-muted rounded-lg border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Conexión seleccionada
                    </p>
                    <p className="text-xs text-slate-600">
                        Puedes arrastrar los extremos de las líneas en el canvas para reconectarlas a otros bloques.
                    </p>
                </div>
                <Button
                    onClick={onDeleteEdge}
                    variant="destructive"
                    className="w-full flex items-center gap-2"
                >
                    <Trash2 className="w-4 h-4" /> Eliminar conexión
                </Button>
            </div>
        );
    }

    if (!selectedNode) return null;

    const data = selectedNode.data as any;

    // Helper to ensure values are never empty and exist in allowed options
    const safeValue = (val: string | undefined | null, fallback: string, allowedOptions?: string[]) => {
        if (!val || val.trim() === "") return fallback;
        if (allowedOptions && !allowedOptions.includes(val)) return fallback;
        return val;
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-5 space-y-6 flex-1 overflow-y-auto">
                {/* Step name */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="node-label" className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Nombre del paso
                        </Label>
                        <button
                            type="button"
                            onClick={() => onUpdateNode("isBoldTitle", !data.isBoldTitle)}
                            className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded transition-all",
                                data.isBoldTitle
                                    ? "bg-primary/10 text-primary"
                                    : "text-slate-300 hover:text-slate-500"
                            )}
                            title="Activar título en negrita"
                        >
                            NEGRILLA
                        </button>
                    </div>
                    <Input
                        id="node-label"
                        value={data.label ?? ""}
                        onChange={(e) => onUpdateNode("label", e.target.value)}
                        placeholder="Ej: Inicio del proceso"
                        className={cn(
                            "h-11 bg-slate-50 border-slate-100 focus:bg-white transition-all rounded-xl",
                            data.isBoldTitle && "font-black text-slate-900"
                        )}
                    />
                </div>

                {/* Platform */}
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Plataforma
                    </Label>
                    <Select
                        value={safeValue(data.platform, "Ninguna", PLATFORMS)}
                        onValueChange={(val) => onUpdateNode("platform", val)}
                    >
                        <SelectTrigger className="h-11 bg-slate-50 border-slate-100 rounded-xl">
                            <SelectValue placeholder="Seleccionar plataforma" />
                        </SelectTrigger>
                        <SelectContent>
                            {PLATFORMS.map((p) => (
                                <SelectItem key={p} value={safeValue(p, "Otros")}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Role & Responsible — 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Rol
                        </Label>
                        <Select
                            value={safeValue(data.role, "Encargado", ROLES)}
                            onValueChange={(val) => onUpdateNode("role", val)}
                        >
                            <SelectTrigger className="h-11 bg-slate-50 border-slate-100 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map((r) => (
                                    <SelectItem key={r} value={safeValue(r, "Otros")}>{r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Nombre Responsable
                        </Label>
                        <Input
                            value={data.responsibleName ?? ""}
                            onChange={(e) => onUpdateNode("responsibleName", e.target.value)}
                            placeholder="Persona…"
                            className="h-11 bg-slate-50 border-slate-100 rounded-xl"
                        />
                    </div>
                </div>

                {/* Description — TipTap */}
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Instrucciones del paso
                    </Label>
                    <div className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50/50 focus-within:bg-white focus-within:border-primary/20 transition-all">
                        <TipTapEditor
                            content={data.description ?? ""}
                            onChange={(html) => onUpdateNode("description", html)}
                            placeholder="Describe detalladamente este paso del proceso…"
                        />
                    </div>
                </div>

                {/* External link */}
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1.5">
                        <LinkIcon className="w-3 h-3" /> URL Enlace (Opcional)
                    </Label>
                    <Input
                        value={data.linkUrl ?? ""}
                        onChange={(e) => onUpdateNode("linkUrl", e.target.value)}
                        placeholder="https://docs.google.com/..."
                        type="url"
                        className="h-11 bg-slate-50 border-slate-100 rounded-xl"
                    />
                </div>

                {/* Accent color */}
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1.5">
                        <Palette className="w-3 h-3" /> Personalización Visual
                    </Label>
                    <div className="flex flex-wrap gap-3 p-1">
                        {ACCENT_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => onUpdateNode("color", c)}
                                className="w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 shadow-sm"
                                style={{
                                    backgroundColor: c,
                                    borderColor: (data.color ?? "#6366f1") === c ? "white" : "transparent",
                                    outline: (data.color ?? "#6366f1") === c ? `2px solid ${c}` : "none"
                                }}
                                title={c}
                            />
                        ))}
                        <div className="relative group">
                            <input
                                type="color"
                                value={data.color ?? "#6366f1"}
                                onChange={(e) => onUpdateNode("color", e.target.value)}
                                className="w-8 h-8 rounded-xl border-2 border-slate-100 cursor-pointer overflow-hidden appearance-none bg-white p-0"
                                title="Color personalizado"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t bg-slate-50/50">
                <Button
                    onClick={onDeleteNode}
                    variant="ghost"
                    size="sm"
                    className="w-full flex items-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all font-bold"
                >
                    <Trash2 className="w-4 h-4" /> Eliminar paso
                </Button>
            </div>
        </div>
    );
}
