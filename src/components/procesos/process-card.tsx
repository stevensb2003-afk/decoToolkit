"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Network, ArrowRight, Eye, EyeOff, Clock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessMap, ProcessCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProcessCardProps {
    process: ProcessMap;
    category?: ProcessCategory;
    actions?: React.ReactNode;
    showViewButton?: boolean;
    animationDelay?: number;
    className?: string;
}

export function ProcessCard({
    process,
    category,
    actions,
    showViewButton = true,
    animationDelay = 0,
    className,
}: ProcessCardProps) {
    const [pressed, setPressed] = useState(false);

    const updatedDate =
        process.updatedAt instanceof Date
            ? process.updatedAt
            : (process.updatedAt as any)?.toDate?.() ?? null;

    const nodeCount = process.nodeCount ?? process.nodes?.length ?? 0;

    const accent = category?.color ?? "hsl(var(--primary))";
    const accentBg = category?.color ? `${category.color}14` : "hsl(var(--primary) / 0.08)";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, delay: animationDelay, ease: [0.22, 1, 0.36, 1] }}
            className={cn("relative flex flex-col h-full", className)}
        >
            {/* Card shell */}
            <div
                onPointerDown={() => setPressed(true)}
                onPointerUp={() => setPressed(false)}
                onPointerLeave={() => setPressed(false)}
                className={cn(
                    "group relative flex flex-col flex-1 rounded-2xl overflow-hidden",
                    "border border-slate-200/80 bg-white",
                    "shadow-sm hover:shadow-md active:shadow-sm",
                    "transition-all duration-200 ease-out",
                    pressed && "scale-[0.98]"
                )}
                style={{ transform: pressed ? "scale(0.98)" : undefined }}
            >
                {/* Gradient header */}
                <div
                    className="relative h-16 flex items-end px-4 pb-3 overflow-hidden shrink-0"
                    style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}0d)` }}
                >
                    {/* Decorative circles */}
                    <div
                        className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20"
                        style={{ backgroundColor: accent }}
                    />
                    <div
                        className="absolute top-2 right-10 w-8 h-8 rounded-full opacity-10"
                        style={{ backgroundColor: accent }}
                    />

                    {/* Icon */}
                    <div
                        className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border border-white/60"
                        style={{ backgroundColor: accentBg }}
                    >
                        <Network className="w-4 h-4" style={{ color: accent }} />
                    </div>

                    {/* Status badge */}
                    <div className="ml-auto relative z-10">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full",
                                process.isPublished
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                            )}
                        >
                            {process.isPublished
                                ? <><Eye className="w-2.5 h-2.5" /> Público</>
                                : <><EyeOff className="w-2.5 h-2.5" /> Oculto</>
                            }
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-col flex-1 px-4 pb-4 pt-3 gap-2.5">
                    {/* Category chip */}
                    {category && (
                        <span
                            className="self-start text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border"
                            style={{
                                backgroundColor: `${accent}10`,
                                color: accent,
                                borderColor: `${accent}30`,
                            }}
                        >
                            {category.name}
                        </span>
                    )}

                    {/* Title */}
                    <h3 className="font-bold text-sm text-slate-800 leading-snug line-clamp-2">
                        {process.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-slate-500 line-clamp-2 flex-1 leading-relaxed">
                        {process.description || "Sin descripción disponible."}
                    </p>

                    {/* Meta row */}
                    {process.tags && process.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {process.tags.map(tag => (
                                <span key={tag} className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5" />
                            {nodeCount} {nodeCount === 1 ? "paso" : "pasos"}
                        </span>
                        {updatedDate && (
                            <span className="flex items-center gap-1 ml-auto">
                                <Clock className="w-2.5 h-2.5" />
                                {updatedDate.toLocaleDateString("es-CR", {
                                    day: "2-digit",
                                    month: "short",
                                })}
                            </span>
                        )}
                    </div>

                    {/* Footer actions */}
                    {(showViewButton || actions) && (
                        <div className="flex items-center gap-2 pt-1">
                            {showViewButton && (
                                <Button
                                    asChild
                                    size="sm"
                                    className="flex-1 h-8 text-xs gap-1.5 rounded-lg font-semibold"
                                    style={{ backgroundColor: accent, color: "white" }}
                                >
                                    <Link href={`/procesos/${process.id}`}>
                                        Abrir proceso
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </Button>
                            )}
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
