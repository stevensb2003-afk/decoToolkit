"use client";

import { Handle, Position } from "@xyflow/react";
import { Plus, User, Briefcase } from "lucide-react";

export type PremiumNodeMode = "view" | "edit";

interface PremiumNodeData {
    label: string;
    description?: string;
    linkUrl?: string;
    color?: string;
    responsibleName?: string;
    role?: string;
    platform?: string;
    isBoldTitle?: boolean;
}

interface PremiumNodeProps {
    id: string;
    data: PremiumNodeData;
    selected?: boolean;
    mode?: PremiumNodeMode;
    onQuickAdd?: (id: string, offset: { x: number; y: number }) => void;
    onViewDetails?: (id: string) => void;
}

/** Invisible handle — used in view mode so ReactFlow edges still connect, but the dot is hidden */
function InvisibleHandle({ type, position, id, style }: { type: "source" | "target"; position: Position; id: string; style?: React.CSSProperties }) {
    return (
        <Handle
            type={type}
            position={position}
            id={id}
            style={{ opacity: 0, pointerEvents: "none", width: 1, height: 1, minWidth: 1, minHeight: 1, border: "none", background: "transparent", ...style }}
        />
    );
}

export function PremiumNode({ id, data, selected, mode = "view", onQuickAdd, onViewDetails }: PremiumNodeProps) {
    const accentColor = data.color || "hsl(var(--primary))";
    const hasDetails = !!data.description || !!data.responsibleName || !!data.linkUrl;
    const isView = mode === "view";

    return (
        <div className="relative group">
            {/* ── HANDLES ── */}
            {isView ? (
                <>
                    {/* Top */}
                    <InvisibleHandle type="target" position={Position.Top} id="t-l" style={{ left: '25%' }} />
                    <InvisibleHandle type="source" position={Position.Top} id="t-l-s" style={{ left: '25%' }} />
                    <InvisibleHandle type="target" position={Position.Top} id="t" style={{ left: '50%' }} />
                    <InvisibleHandle type="source" position={Position.Top} id="t-s" style={{ left: '50%' }} />
                    <InvisibleHandle type="target" position={Position.Top} id="t-r" style={{ left: '75%' }} />
                    <InvisibleHandle type="source" position={Position.Top} id="t-r-s" style={{ left: '75%' }} />
                    
                    {/* Left */}
                    <InvisibleHandle type="target" position={Position.Left} id="l" style={{ top: '50%' }} />
                    <InvisibleHandle type="source" position={Position.Left} id="l-s" style={{ top: '50%' }} />
                    
                    {/* Right */}
                    <InvisibleHandle type="source" position={Position.Right} id="r" style={{ top: '50%' }} />
                    <InvisibleHandle type="target" position={Position.Right} id="r-t" style={{ top: '50%' }} />
                    
                    {/* Bottom */}
                    <InvisibleHandle type="source" position={Position.Bottom} id="b-l" style={{ left: '25%' }} />
                    <InvisibleHandle type="target" position={Position.Bottom} id="b-l-t" style={{ left: '25%' }} />
                    <InvisibleHandle type="source" position={Position.Bottom} id="b" style={{ left: '50%' }} />
                    <InvisibleHandle type="target" position={Position.Bottom} id="b-t" style={{ left: '50%' }} />
                    <InvisibleHandle type="source" position={Position.Bottom} id="b-r" style={{ left: '75%' }} />
                    <InvisibleHandle type="target" position={Position.Bottom} id="b-r-t" style={{ left: '75%' }} />
                </>
            ) : (
                <>
                    {/* Top Handles */}
                    <Handle type="target" position={Position.Top} id="t-l" style={{ left: '25%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-top-1.5 z-50" />
                    <Handle type="source" position={Position.Top} id="t-l-s" style={{ left: '25%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-top-1.5 z-50" />
                    
                    <Handle type="target" position={Position.Top} id="t" style={{ left: '50%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-top-1.5 z-50" />
                    <Handle type="source" position={Position.Top} id="t-s" style={{ left: '50%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-top-1.5 z-50" />
                    
                    <Handle type="target" position={Position.Top} id="t-r" style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-top-1.5 z-50" />
                    <Handle type="source" position={Position.Top} id="t-r-s" style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-top-1.5 z-50" />
                    
                    {/* Left Handle */}
                    <Handle type="target" position={Position.Left} id="l" style={{ top: '50%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-left-1.5 z-50" />
                    <Handle type="source" position={Position.Left} id="l-s" style={{ top: '50%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-left-1.5 z-50" />
                    
                    {/* Right Handle */}
                    <Handle type="source" position={Position.Right} id="r" style={{ top: '50%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-right-1.5 z-50" />
                    <Handle type="target" position={Position.Right} id="r-t" style={{ top: '50%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-right-1.5 z-50" />
                    
                    {/* Bottom Handles */}
                    <Handle type="source" position={Position.Bottom} id="b-l" style={{ left: '25%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-bottom-1.5 z-50" />
                    <Handle type="target" position={Position.Bottom} id="b-l-t" style={{ left: '25%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-bottom-1.5 z-50" />
                    
                    <Handle type="source" position={Position.Bottom} id="b" style={{ left: '50%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-bottom-1.5 z-50" />
                    <Handle type="target" position={Position.Bottom} id="b-t" style={{ left: '50%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-bottom-1.5 z-50" />
                    
                    <Handle type="source" position={Position.Bottom} id="b-r" style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-slate-300 hover:!bg-primary !border-2 !border-white !transition-colors !-bottom-1.5 z-50" />
                    <Handle type="target" position={Position.Bottom} id="b-r-t" style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-transparent !border-none !-bottom-1.5 z-50" />
                </>
            )}

            {/* ── PREMIUM CARD ── */}
            <div
                className={`
                    relative rounded-2xl bg-white overflow-hidden w-[200px]
                    transition-all duration-300 cursor-pointer select-none
                    ${selected
                        ? "shadow-2xl -translate-y-1 outline outline-2"
                        : "shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] hover:shadow-xl hover:-translate-y-0.5"
                    }
                `}
                style={{
                    outlineColor: selected ? accentColor : "transparent",
                    boxShadow: selected ? `0 10px 40px ${accentColor}25` : undefined
                }}
            >
                {/* Side Accent Bar */}
                <div 
                    className="absolute left-0 top-0 bottom-0 w-1.5 z-10"
                    style={{ 
                        background: `linear-gradient(to bottom, ${accentColor}, ${accentColor}cc)` 
                    }}
                />

                {/* Body Content */}
                <div className="pt-2.5 pb-3 pl-5 pr-4 bg-white flex flex-col">
                    {/* Platform Tag (Small & Subtle) */}
                    {data.platform && data.platform !== "Ninguna" && (
                        <div className="mb-0.5">
                             <span className="text-[7px] font-black uppercase tracking-[0.15em] leading-none" style={{ color: accentColor }}>
                                {data.platform}
                            </span>
                        </div>
                    )}

                    {/* Title */}
                    <div className={`text-[13px] text-slate-800 leading-[1.3] ${data.isBoldTitle ? "font-extrabold" : "font-bold"}`}>
                        {data.label}
                    </div>

                    {/* Metadata Pill */}
                    {(data.responsibleName || data.role) && (
                        <div className="mt-2.5 flex items-center gap-1.5 py-1 px-2 bg-slate-50 rounded-md border border-slate-100">
                            <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <div className="text-[9px] text-slate-500 font-bold truncate tracking-tight">
                                {data.responsibleName || data.role}
                            </div>
                        </div>
                    )}

                    {/* Tap indicator */}
                    {isView && hasDetails && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewDetails?.(id);
                            }}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border transition-colors hover:bg-black/5" 
                            style={{ borderColor: `${accentColor}20`, backgroundColor: `${accentColor}05` }}
                        >
                             <Briefcase className="w-3 h-3" style={{ color: accentColor }} />
                             <span className="text-[10px] font-bold" style={{ color: accentColor }}>
                                Ver detalles
                             </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick-add button — edit mode only */}
            {!isView && onQuickAdd && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onQuickAdd(id, { x: 240, y: 0 });
                    }}
                    className="absolute -right-3 -bottom-3 w-7 h-7 bg-white text-primary rounded-full flex items-center justify-center shadow-xl border border-slate-100 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 z-[100]"
                    style={{ color: accentColor }}
                >
                    <Plus className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

/** Pre-built nodeTypes map for ReactFlow */
export function buildNodeTypes(
    mode: PremiumNodeMode,
    onQuickAdd?: (id: string, offset: { x: number; y: number }) => void,
    onViewDetails?: (id: string) => void
) {
    return {
        premium: ({ id, data, selected }: { id: string; data: any; selected: boolean }) => (
            <PremiumNode id={id} data={data} selected={selected} mode={mode} onQuickAdd={onQuickAdd} onViewDetails={onViewDetails} />
        ),
    };
}
