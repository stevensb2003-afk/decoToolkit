"use client";

import { useState, useCallback, useMemo, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, updateDoc, addDoc, collection, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ProcessMap, UserProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
    ReactFlow, useNodesState, useEdgesState, addEdge,
    Connection, Edge, Node, ReactFlowProvider, useReactFlow,
    BackgroundVariant, ConnectionMode
} from "@xyflow/react";
import { Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, ArrowLeft, Network, Settings2, X, ChevronRight } from "lucide-react";
import { buildNodeTypes } from "@/components/procesos/premium-node";
import { NodeConfigPanel } from "@/components/procesos/node-config-panel";
import { EditorToolbar } from "@/components/procesos/editor-toolbar";
import { VersionHistoryPanel } from "@/components/procesos/version-history-panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function FlowEditor({ processId, initialNodes, initialEdges, processTitle, user, onUnsavedChange }: {
    processId: string; initialNodes: Node[]; initialEdges: Edge[]; processTitle: string; user: any; onUnsavedChange?: (val: boolean) => void;
}) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const reactFlowInstance = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes.map(n => ({ ...n, type: "premium" })));
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsaved, setHasUnsaved] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default open if desktop
    const [historyOpen, setHistoryOpen] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        onUnsavedChange?.(hasUnsaved);
    }, [hasUnsaved, onUnsavedChange]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const nodeTypes = useMemo(() => buildNodeTypes("edit", (sourceId, offset) => {
        const sourceNode = reactFlowInstance.getNode(sourceId);
        if (!sourceNode) return;
        const newId = crypto.randomUUID();
        const newNode: Node = {
            id: newId, type: "premium",
            position: { x: sourceNode.position.x + offset.x, y: sourceNode.position.y + offset.y },
            data: { label: "Nuevo Paso", description: "" }
        };
        const newEdge: Edge = {
            id: `e-${sourceId}-${newId}`, source: sourceId, target: newId,
            sourceHandle: "b", targetHandle: "t", type: "smoothstep"
        };
        setNodes(nds => [...nds, newNode]);
        setEdges(eds => [...eds, newEdge]);
        setHasUnsaved(true);
        setTimeout(() => setSelectedNode(newNode), 50);
    }), [reactFlowInstance, setNodes, setEdges]);

    const displayEdges = useMemo(() => edges.map(e => ({
        ...e, 
        type: "smoothstep",
        animated: false,
        style: e.source === selectedNodeId ? { stroke: "hsl(var(--primary))", strokeWidth: 2 } : undefined
    })), [edges, selectedNodeId]);

    const onConnect = useCallback((params: Connection) => {
        setEdges(eds => addEdge({ ...params, type: "smoothstep" }, eds));
        setHasUnsaved(true);
    }, [setEdges]);

    const onReconnect = useCallback((oldEdge: Edge, newConn: Connection) => {
        setEdges(els => els.map(e => e.id === oldEdge.id ? { ...e, ...newConn } : e) as Edge[]);
        setHasUnsaved(true);
    }, [setEdges]);

    const onNodeClick = useCallback((_: any, node: Node) => {
        setSelectedNode(node);
        setSelectedNodeId(node.id);
        setSelectedEdge(null);
        setIsSidebarOpen(true);
    }, []);

    const onEdgeClick = useCallback((_: any, edge: Edge) => {
        setSelectedEdge(edge);
        setSelectedNode(null);
        setSelectedNodeId(null);
        setIsSidebarOpen(true);
    }, []);

    const onSelectionChange = useCallback(({ nodes: sel, edges: selE }: { nodes: Node[]; edges: Edge[] }) => {
        if (sel.length > 0) {
            setSelectedNode(sel[0]);
            setSelectedNodeId(sel[0].id);
            setSelectedEdge(null);
            // Auto-open on any selection change
            setIsSidebarOpen(true);
        } else if (selE.length > 0) {
            setSelectedEdge(selE[0]);
            setSelectedNode(null);
            setSelectedNodeId(null);
            setIsSidebarOpen(true);
        } else {
            // When nothing is selected in React Flow:
            // Close the sidebar and clear selection state for both mobile and desktop
            setSelectedNode(null);
            setSelectedEdge(null);
            setSelectedNodeId(null);
            setIsSidebarOpen(false);
        }
    }, []);

    const closeSidebar = () => {
        setIsSidebarOpen(false);
        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectedNodeId(null);
        // CRITICAL: We must tell React Flow to deselect everything, 
        // otherwise onSelectionChange will re-trigger and re-open the sidebar.
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    };

    const updateNodeData = (field: string, value: any) => {
        if (!selectedNode) return;
        setNodes(nds => nds.map(n => {
            if (n.id !== selectedNode.id) return n;
            const updated = { ...n, data: { ...n.data, [field]: value } };
            setSelectedNode(updated);
            return updated;
        }));
        setHasUnsaved(true);
    };

    const handleAddNode = () => {
        const id = crypto.randomUUID();
        const center = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const newNode: Node = {
            id, type: "premium",
            position: { x: center.x + (Math.random() - 0.5) * 200, y: center.y + (Math.random() - 0.5) * 200 },
            data: { label: "Nuevo Paso", description: "" }
        };
        setNodes(nds => [...nds, newNode]);
        setHasUnsaved(true);
    };

    const handleDeleteNode = () => {
        if (!selectedNode) return;
        setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
        setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null); setIsSidebarOpen(false); setHasUnsaved(true);
    };

    const handleDeleteEdge = () => {
        if (!selectedEdge) return;
        setEdges(eds => eds.filter(e => e.id !== selectedEdge.id));
        setSelectedEdge(null); setHasUnsaved(true);
    };

    const sanitize = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(sanitize);
        if (obj !== null && typeof obj === "object") {
            return Object.fromEntries(
                Object.entries(obj)
                    .filter(([, v]) => v !== undefined)
                    .map(([k, v]) => [k, sanitize(v)])
            );
        }
        return obj;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();

            // Get current doc to snapshot as a version
            const processRef = doc(firestore, "processes", processId);
            const snap = await getDoc(processRef);
            if (snap.exists()) {
                const current = snap.data() as ProcessMap;
                const currentVersion = current.version ?? 1;
                // Save previous state as a version
                await addDoc(collection(firestore, "processes", processId, "versions"), {
                    versionNumber: currentVersion,
                    savedAt: new Date(),
                    savedBy: user.uid,
                    savedByName: user.displayName ?? user.email ?? "Admin",
                    nodes: sanitize(current.nodes ?? []),
                    edges: sanitize(current.edges ?? []),
                });
                // Update main doc with new state
                await updateDoc(processRef, {
                    nodes: sanitize(currentNodes),
                    edges: sanitize(currentEdges),
                    nodeCount: currentNodes.length,
                    version: currentVersion + 1,
                    updatedAt: new Date(),
                });
            } else {
                await updateDoc(processRef, {
                    nodes: sanitize(currentNodes),
                    edges: sanitize(currentEdges),
                    nodeCount: currentNodes.length,
                    updatedAt: new Date(),
                });
            }

            toast({ title: "Guardado", description: "El mapa se ha guardado y se creó una nueva versión." });
            setHasUnsaved(false);
        } catch (err: any) {
            toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRestoreVersion = (restoredNodes: Node[], restoredEdges: Edge[]) => {
        setNodes(restoredNodes.map(n => ({ ...n, type: "premium" })));
        setEdges(restoredEdges);
        setHasUnsaved(true);
    };

    return (
        <div className="flex-1 w-full relative flex h-full overflow-hidden bg-[#f8fafc]">
            {/* Dot pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

            {/* Floating toolbar */}
            <EditorToolbar
                onAddNode={handleAddNode}
                onSave={handleSave}
                isSaving={isSaving}
                hasUnsavedChanges={hasUnsaved}
                onOpenHistory={() => setHistoryOpen(true)}
            />

            {/* Canvas */}
            <div className="flex-1 h-full">
                <ReactFlow
                    nodes={nodes}
                    edges={displayEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={(c) => { onNodesChange(c); setHasUnsaved(true); }}
                    onEdgesChange={(c) => { onEdgesChange(c); }}
                    onNodesDelete={(deleted) => {
                        if (deleted.some(n => n.id === selectedNode?.id)) closeSidebar();
                    }}
                    onEdgesDelete={(deleted) => {
                        if (deleted.some(e => e.id === selectedEdge?.id)) closeSidebar();
                    }}
                    onConnect={onConnect}
                    onReconnect={onReconnect}
                    onSelectionChange={onSelectionChange}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={closeSidebar}
                    snapGrid={[20, 20]}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                    attributionPosition="bottom-right"
                >
                </ReactFlow>
            </div>

            {/* Sidebar desktop */}
            <div className={`
                hidden lg:flex flex-col border-l bg-card z-20 shrink-0
                transition-all duration-300 ease-in-out overflow-hidden
                ${isSidebarOpen ? "w-[450px] xl:w-[550px] 2xl:w-[650px]" : "w-0 border-l-0"}
            `}>
                <div className="px-5 py-4 border-b bg-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Settings2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 leading-tight">
                                {selectedNode ? "Config. Paso" : selectedEdge ? "Config. Conexión" : "Propiedades"}
                            </h2>
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Editor de detalles</p>
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" 
                        onClick={closeSidebar}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <NodeConfigPanel
                        selectedNode={selectedNode}
                        selectedEdge={selectedEdge}
                        onUpdateNode={updateNodeData}
                        onDeleteNode={handleDeleteNode}
                        onDeleteEdge={handleDeleteEdge}
                    />
                </div>
            </div>

            {/* Mobile sidebar as Sheet */}
            <Sheet open={isSidebarOpen && isMobile} onOpenChange={(open) => {
                if (!open) closeSidebar();
                else setIsSidebarOpen(true);
            }}>
                <SheetContent side="right" className="w-full sm:max-w-none p-0 flex flex-col lg:hidden border-none">
                    <SheetHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between shrink-0 space-y-0">
                        <SheetTitle className="text-base font-bold flex items-center gap-2 text-slate-700">
                            <Settings2 className="w-5 h-5 text-primary" />
                            {selectedNode ? "Configurar Paso" : selectedEdge ? "Configurar Conexión" : "Propiedades"}
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            Configuración de propiedades del paso o conexión seleccionada.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto pb-20">
                        <NodeConfigPanel
                            selectedNode={selectedNode}
                            selectedEdge={selectedEdge}
                            onUpdateNode={updateNodeData}
                            onDeleteNode={handleDeleteNode}
                            onDeleteEdge={handleDeleteEdge}
                        />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Version history */}
            <VersionHistoryPanel
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                processId={processId}
                onRestore={handleRestoreVersion}
            />
        </div>
    );
}

export default function ProcessEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const [hasUnsaved, setHasUnsaved] = useState(false);
    const [showExitAlert, setShowExitAlert] = useState(false);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsaved) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsaved]);

    const handleGoBack = (e: React.MouseEvent) => {
        if (hasUnsaved) {
            e.preventDefault();
            setShowExitAlert(true);
        }
    };

    const profileRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);
    const isAdmin = profile?.isAdmin ?? false;

    const processRef = useMemoFirebase(() => doc(firestore, "processes", id), [firestore, id]);
    const { data: processData, isLoading } = useDoc<ProcessMap>(processRef);

    if (isUserLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    if (!user || !isAdmin) return (
        <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background px-4">
            <div className="max-w-md w-full text-center border p-6 rounded-xl shadow bg-destructive/10">
                <h2 className="text-xl font-bold text-destructive mb-2">Acceso Denegado</h2>
                <p className="text-sm text-muted-foreground">No tienes permisos para acceder al editor de procesos.</p>
                <Link href="/procesos" className="mt-4 inline-block text-primary hover:underline text-sm">← Volver</Link>
            </div>
        </div>
    );

    if (!processData) return (
        <div className="flex flex-col h-screen items-center justify-center gap-4">
            <p className="text-muted-foreground">Proceso no encontrado.</p>
            <Button asChild><Link href="/procesos/admin">Volver</Link></Button>
        </div>
    );

    return (
        <div className="flex flex-col h-screen">
            <Header />
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Header bar */}
                <div className="px-4 py-3 border-b bg-white/90 backdrop-blur-sm flex items-center gap-3 z-10 shrink-0 shadow-sm">
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                        <Link href="/procesos/admin" onClick={handleGoBack}><ArrowLeft className="w-5 h-5" /></Link>
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-base font-bold flex items-center gap-2 truncate">
                            <Network className="w-4 h-4 text-primary shrink-0" />
                            {processData.title}
                        </h1>
                        <p className="text-xs text-muted-foreground truncate">{processData.description}</p>
                    </div>
                    {(processData as any).version && (
                        <span className="ml-auto shrink-0 text-[10px] font-bold text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
                            v{(processData as any).version}
                        </span>
                    )}
                </div>

                <ReactFlowProvider>
                    <FlowEditor
                        processId={id}
                        initialNodes={processData.nodes as Node[]}
                        initialEdges={processData.edges as Edge[]}
                        processTitle={processData.title}
                        user={user}
                        onUnsavedChange={setHasUnsaved}
                    />
                </ReactFlowProvider>

                <AlertDialog open={showExitAlert} onOpenChange={setShowExitAlert}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Descartar cambios no guardados?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tienes cambios en el mapa del proceso que no han sido guardados. Si sales ahora, estos cambios se perderán.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => router.push("/procesos/admin")}>
                                Salir sin guardar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
