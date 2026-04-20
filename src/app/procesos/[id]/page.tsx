"use client";

import { useState, useCallback, useMemo, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useDoc, useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Network, Edit2 } from "lucide-react";
import Link from "next/link";
import { ProcessMap, UserProfile } from "@/lib/types";
import {
    ReactFlow,
    Controls,
    Background,
    Panel,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    Handle,
    Position,
    BackgroundVariant
} from '@xyflow/react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import '@xyflow/react/dist/style.css';

const nodeTypes = {
    premium: ({ data }: {
        data: {
            label: string;
            description?: string;
            linkUrl?: string;
            color?: string;
            responsibleName?: string;
            role?: string;
            platform?: string;
            isBoldTitle?: boolean;
        }
    }) => (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative group">
                        {/* Accent bar */}
                        <div
                            className="absolute -left-1 top-0 bottom-0 w-1.5 rounded-l-md z-10"
                            style={{ backgroundColor: data.color || 'var(--primary)' }}
                        />
                        <div className="px-5 py-3 shadow-xl rounded-md bg-white/95 backdrop-blur-sm border border-slate-200/50 min-w-[200px] text-center hover:border-primary/50 hover:shadow-2xl transition-all duration-300 cursor-help overflow-hidden">
                            {/* 4 Visual points, each acting as both Source and Target */}
                            {/* Top */}
                            <Handle type="target" position={Position.Top} id="t" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors" />
                            <Handle type="source" position={Position.Top} id="t-s" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors !opacity-0" />

                            {/* Left */}
                            <Handle type="target" position={Position.Left} id="l" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors" />
                            <Handle type="source" position={Position.Left} id="l-s" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors !opacity-0" />

                            {/* Platform Tag */}
                            {data.platform && (
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">
                                    {data.platform}
                                </div>
                            )}

                            <div className={`${data.isBoldTitle ? 'font-bold' : 'font-semibold'} text-sm text-slate-800 tracking-tight`}>
                                {data.label}
                            </div>

                            {/* Responsible/Role Info */}
                            {(data.responsibleName || data.role) && (
                                <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-col items-center">
                                    <div className="text-[10px] text-slate-500 font-medium leading-none">
                                        {data.role || 'Responsable'}
                                    </div>
                                    <div className="text-[10px] text-slate-700 font-bold mt-0.5">
                                        {data.responsibleName || 'Pendiente'}
                                    </div>
                                </div>
                            )}

                            {data.linkUrl && (
                                <div className="text-[10px] text-primary font-medium hover:underline mt-2 flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 italic">
                                    Enlace externo
                                </div>
                            )}

                            {/* Right */}
                            <Handle type="source" position={Position.Right} id="r" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors" />
                            <Handle type="target" position={Position.Right} id="r-t" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors !opacity-0" />

                            {/* Bottom */}
                            <Handle type="source" position={Position.Bottom} id="b" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors" />
                            <Handle type="target" position={Position.Bottom} id="b-t" className="!w-2 !h-2 !bg-slate-300 group-hover:!bg-primary !transition-colors !opacity-0" />
                        </div>
                    </div>
                </TooltipTrigger>
                {data.description && (
                    <TooltipContent side="top" className="max-w-[320px] p-4 text-sm bg-slate-900 text-white rounded-xl shadow-2xl border-none">
                        <div className="space-y-2">
                            <p className="font-bold text-[10px] text-primary uppercase tracking-[0.1em] border-b border-white/10 pb-1">Detalles del paso</p>
                            <div
                                className="leading-relaxed text-slate-100 rich-text-content text-xs"
                                dangerouslySetInnerHTML={{ __html: data.description }}
                            />
                        </div>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    )
};

export default function ProcessViewerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);

    const processRef = useMemo(() => doc(firestore, 'processes', id), [firestore, id]);
    const { data: processData, isLoading } = useDoc<ProcessMap>(processRef);

    const initialNodes: Node[] = (processData?.nodes || []).map(n => ({ ...n, type: 'premium' }));
    const initialEdges: Edge[] = processData?.edges || [];

    const [nodes, setNodes] = useNodesState(initialNodes);
    const [edges, setEdges] = useEdgesState(initialEdges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
        if (nodes.length > 0) {
            setSelectedNodeId(nodes[0].id);
        } else {
            setSelectedNodeId(null);
        }
    }, []);

    useEffect(() => {
        if (processData) {
            setNodes((processData.nodes as Node[]).map(n => ({ ...n, type: 'premium' })));
            setEdges((processData.edges as Edge[]).map(e => ({
                ...e,
                type: 'smoothstep',
                animated: false,
                style: { 
                    stroke: '#94a3b8', 
                    strokeWidth: 2, 
                    strokeDasharray: '5, 5', // Always dashed
                    transition: 'stroke 0.3s, stroke-width 0.3s' 
                }
            })));
        }
    }, [processData, setNodes, setEdges]);

    const displayEdges = useMemo(() => {
        return edges.map(edge => ({
            ...edge,
            animated: edge.source === selectedNodeId,
            style: undefined, // Let CSS handle everything for stability
        }));
    }, [edges, selectedNodeId]);


    if (isUserLoading || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!user || !processData) {
        if (!isLoading && !processData) {
            return (
                <div className="flex flex-col h-screen items-center justify-center gap-4">
                    <p>Proceso no encontrado o no disponible.</p>
                    <Button asChild>
                        <Link href="/procesos">Volver</Link>
                    </Button>
                </div>
            );
        }
        return null;
    }

    const isAdmin = profile?.isAdmin || profile?.permissions?.allowedModules?.includes('admin');
    if (!processData.isPublished && !isAdmin) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background">
                <div className="max-w-md text-center border p-6 rounded shadow bg-destructive/10">
                    <h2 className="text-xl font-bold text-destructive mb-2">Acceso Denegado</h2>
                    <p>Este proceso aún no ha sido publicado. Si eres administrador, usa el Panel de Administración para publicarlo.</p>
                    <div className="mt-4">
                        <Link href="/procesos" className="text-primary hover:underline">Volver al Directorio</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen">
            <Header />
            <div className="flex flex-col flex-1 overflow-hidden relative">
                <div className="p-4 border-b bg-card flex items-center justify-between z-10 shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/procesos">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Network className="w-5 h-5 text-primary" />
                                {processData.title}
                            </h1>
                            <p className="text-sm text-muted-foreground">{processData.description}</p>
                        </div>
                    </div>

                    {isAdmin && (
                        <Button asChild variant="outline" size="sm" className="gap-2">
                            <Link href={`/procesos/admin/${id}`}>
                                <Edit2 className="w-4 h-4" />
                                Editar Proceso
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="flex-1 w-full bg-[#f8fafc] relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
                    <ReactFlow
                        nodes={nodes}
                        edges={displayEdges}
                        nodeTypes={nodeTypes}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={true}
                        onSelectionChange={onSelectionChange}
                        fitView
                        attributionPosition="bottom-right"
                        minZoom={0.1}
                        maxZoom={2}
                    >
                        <Background variant={BackgroundVariant.Dots} color="#cbd5e1" gap={20} />
                        <Controls className="bg-white/80 backdrop-blur-md border-slate-200 shadow-xl rounded-lg" />
                        <Panel position="top-right" className="bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-xl text-[11px] border border-slate-200/50 text-slate-600 font-medium max-w-[200px]">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-slate-900 font-bold uppercase tracking-wider">Modo Lectura</span>
                            </div>
                            Mueve el ratón para desplazar y usa la rueda para hacer zoom.
                        </Panel>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}
