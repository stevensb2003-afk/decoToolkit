"use client";

import { useState, useCallback, useMemo, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Network, Edit2, ExternalLink, User, Briefcase } from "lucide-react";
import Link from "next/link";
import { ProcessMap, UserProfile } from "@/lib/types";
import { ReactFlowProvider, useNodesState, useEdgesState, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildNodeTypes } from "@/components/procesos/premium-node";
import { FlowCanvas } from "@/components/procesos/flow-canvas";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function ProcessViewerInner({ processData, id, isAdmin }: {
    processData: ProcessMap; id: string; isAdmin: boolean;
}) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const onViewDetails = useCallback((nodeId: string) => {
        setSelectedNodeId(nodeId);
        setSheetOpen(true);
    }, []);

    const nodeTypes = useMemo(() => buildNodeTypes("view", undefined, onViewDetails), [onViewDetails]);

    const [nodes, setNodes] = useNodesState(
        (processData.nodes || []).map(n => ({ ...(n as any), type: "premium" }))
    );
    const [edges, setEdges] = useEdgesState(
        (processData.edges || []).map(e => ({
            ...(e as any),
            type: "smoothstep",
            style: { stroke: "#cbd5e1", strokeWidth: 2 },
            markerEnd: { type: "arrowclosed", color: "#cbd5e1", width: 16, height: 16 },
        }))
    );

    useEffect(() => {
        if (processData) {
            setNodes((processData.nodes as Node[]).map(n => ({ ...(n as any), type: "premium" })));
            setEdges((processData.edges as Edge[]).map(e => ({
                ...(e as any),
                type: "smoothstep",
                style: { stroke: "#cbd5e1", strokeWidth: 2 },
                markerEnd: { type: "arrowclosed", color: "#cbd5e1", width: 16, height: 16 },
            })));
        }
    }, [processData, setNodes, setEdges]);

    const displayEdges = useMemo(() => edges.map(e => ({
        ...e,
        animated: false,
        style: e.source === selectedNodeId
            ? { stroke: "hsl(var(--primary))", strokeWidth: 2.5 }
            : { stroke: "#cbd5e1", strokeWidth: 2 },
        markerEnd: {
            type: "arrowclosed",
            color: e.source === selectedNodeId ? "hsl(var(--primary))" : "#cbd5e1",
            width: 16, height: 16,
        },
    })), [edges, selectedNodeId]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
        if (sel.length === 0) {
            setSelectedNodeId(null);
            setSheetOpen(false);
        }
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
        setSheetOpen(false);
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        setEdges(eds => eds.map(e => ({ ...e, selected: false })));
    }, [setNodes, setEdges]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    const data = selectedNode?.data as any;

    return (
        <div className="flex flex-col flex-1 overflow-hidden relative">
            <div className="px-4 py-3 border-b bg-white/90 backdrop-blur-sm flex items-center justify-between z-10 shrink-0 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                        <Link href="/procesos"><ArrowLeft className="w-5 h-5" /></Link>
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-base font-bold flex items-center gap-2 truncate">
                            <Network className="w-4 h-4 text-primary shrink-0" />
                            {processData.title}
                        </h1>
                        <p className="text-xs text-muted-foreground truncate">{processData.description}</p>
                    </div>
                </div>
                {isAdmin && (
                    <Button asChild variant="outline" size="sm" className="gap-2 shrink-0 ml-2">
                        <Link href={`/procesos/admin/${id}`}>
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Editar</span>
                        </Link>
                    </Button>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                <FlowCanvas 
                    mode="view" 
                    nodes={nodes} 
                    edges={displayEdges} 
                    nodeTypes={nodeTypes} 
                    onSelectionChange={onSelectionChange}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                />
                {/* Subtle tap hint — bottom center, non-intrusive */}
                {!sheetOpen && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                        <div className="bg-slate-800/70 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            Toca un bloque para ver detalles
                        </div>
                    </div>
                )}
            </div>

            <Sheet open={sheetOpen} onOpenChange={(open) => {
                setSheetOpen(open);
                if (!open) {
                    setSelectedNodeId(null);
                    setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                    setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                }
            }}>
                <SheetContent side="right" className="w-full sm:max-w-lg xl:max-w-2xl flex flex-col p-0">
                    {selectedNode && data ? (
                        <>
                            <div className="h-1.5 w-full" style={{ backgroundColor: data.color ?? "hsl(var(--primary))" }} />
                            <SheetHeader className="px-5 pt-4 pb-3 border-b">
                                <SheetTitle className="text-base font-bold text-slate-800">{data.label}</SheetTitle>
                                {data.platform && data.platform !== "Ninguna" && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{data.platform}</span>
                                )}
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                                {(data.responsibleName || data.role) && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <User className="w-3.5 h-3.5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{data.role || "Responsable"}</p>
                                            <p className="text-sm font-semibold text-slate-800">{data.responsibleName || "Pendiente"}</p>
                                        </div>
                                    </div>
                                )}
                                {data.description && (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                                            <Briefcase className="w-3 h-3" /> Descripción
                                        </p>
                                        <div className="rich-text-content text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data.description }} />
                                    </div>
                                )}
                                {data.linkUrl && (
                                    <a href={data.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary font-medium hover:underline border border-primary/20 bg-primary/5 rounded-lg px-3 py-2">
                                        <ExternalLink className="w-4 h-4 shrink-0" />
                                        Abrir enlace externo
                                    </a>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
                            Selecciona un paso en el mapa para ver sus detalles.
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

export default function ProcessViewerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const profileRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);
    const processRef = useMemoFirebase(() => doc(firestore, "processes", id), [firestore, id]);
    const { data: processData, isLoading } = useDoc<ProcessMap>(processRef);

    if (isUserLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (!user) { router.push("/login"); return null; }
    if (!processData) return (
        <div className="flex flex-col h-screen items-center justify-center gap-4">
            <p className="text-muted-foreground">Proceso no encontrado.</p>
            <Button asChild><Link href="/procesos">Volver</Link></Button>
        </div>
    );

    const isAdmin = profile?.isAdmin ?? false;

    if (!processData.isPublished && !isAdmin) return (
        <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background px-4">
            <div className="max-w-md w-full text-center border p-6 rounded-xl shadow bg-destructive/10">
                <h2 className="text-xl font-bold text-destructive mb-2">Proceso No Publicado</h2>
                <p className="text-muted-foreground text-sm">Este proceso aún no está disponible para el público.</p>
                <Link href="/procesos" className="mt-4 inline-block text-primary hover:underline text-sm">← Volver al Directorio</Link>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen">
            <Header />
            <ReactFlowProvider>
                <ProcessViewerInner processData={processData} id={id} isAdmin={isAdmin} />
            </ReactFlowProvider>
        </div>
    );
}
