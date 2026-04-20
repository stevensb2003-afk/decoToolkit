"use client";

import { useState, useCallback, useMemo, useEffect, use, createContext, useContext, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useDoc, useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ProcessMap, UserProfile, ProcessNode, ProcessEdge } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
    ReactFlow,
    Controls,
    Background,
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    ReactFlowProvider,
    useReactFlow,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import {
    Trash2,
    Save,
    Plus,
    CheckCircle2, AlertCircle, Clock, Layout, ArrowLeft,
    Settings2, X, Bold, Italic, Underline, List, Loader2, Strikethrough, Type
} from "lucide-react";

const QuickAddContext = createContext<((id: string, offset: { x: number, y: number }) => void) | null>(null);

const nodeTypes = {
    premium: ({ data, id }: {
        id: string;
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
    }) => {
        const onQuickAdd = useContext(QuickAddContext);

        return (
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

                            {/* Quick Add Button */}
                            {onQuickAdd && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onQuickAdd(id, { x: 0, y: 150 });
                                    }}
                                    className="absolute -bottom-2 -right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 z-20"
                                    title="Añadir paso siguiente"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            )}
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
        );
    }
};

function FlowEditor({ processId, initialNodes, initialEdges, processTitle }: {
    processId: string,
    initialNodes: Node[],
    initialEdges: Edge[],
    processTitle: string
}) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const reactFlowInstance = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes.map(n => ({ ...n, type: 'premium' })));
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        list: false
    });

    // Detectar formatos activos según la posición del cursor
    useEffect(() => {
        const handleSelectionChange = () => {
            if (!editorRef.current) return;
            
            // Solo actualizar si el foco está en el editor
            const selection = window.getSelection();
            if (selection && editorRef.current.contains(selection.anchorNode)) {
                setActiveFormats({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strikeThrough: document.queryCommandState('strikeThrough'),
                    list: document.queryCommandState('insertUnorderedList')
                });
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    // Sync editor content only when switching nodes
    useEffect(() => {
        if (editorRef.current && selectedNode) {
            const currentContent = (selectedNode.data?.description as string) || "";
            if (editorRef.current.innerHTML !== currentContent) {
                editorRef.current.innerHTML = currentContent;
            }
        }
    }, [selectedNode?.id]);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds)), [setEdges]);

    const onReconnect = useCallback(
        (oldEdge: Edge, newConnection: Connection) =>
            setEdges((els) => {
                const updatedEdges = els.map((edge) => {
                    if (edge.id === oldEdge.id) {
                        return {
                            ...edge,
                            target: newConnection.target,
                            targetHandle: newConnection.targetHandle,
                            source: newConnection.source,
                            sourceHandle: newConnection.sourceHandle
                        };
                    }
                    return edge;
                });
                return updatedEdges as Edge[];
            }),
        [setEdges]
    );

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const onSelectionChange = useCallback(({ nodes, edges }: { nodes: Node[], edges: Edge[] }) => {
        if (nodes.length > 0) {
            setSelectedNode(nodes[0]);
            setSelectedNodeId(nodes[0].id);
            setSelectedEdge(null);
        } else if (edges.length > 0) {
            setSelectedEdge(edges[0]);
            setSelectedNode(null);
            setSelectedNodeId(null);
        } else {
            setSelectedNode(null);
            setSelectedEdge(null);
            setSelectedNodeId(null);
        }
    }, []);

    const displayEdges = useMemo(() => {
        return edges.map(edge => ({
            ...edge,
            type: 'smoothstep',
            animated: edge.source === selectedNodeId,
            style: undefined, // Let CSS handle everything for stability
        }));
    }, [edges, selectedNodeId]);

    const handleQuickAdd = useCallback((sourceId: string, offset: { x: number, y: number }) => {
        const sourceNode = reactFlowInstance.getNode(sourceId);
        if (!sourceNode) return;

        const newNodeId = uuidv4();
        const newNode: Node = {
            id: newNodeId,
            type: 'premium',
            position: {
                x: sourceNode.position.x + offset.x,
                y: sourceNode.position.y + offset.y
            },
            data: {
                label: 'Nuevo Paso',
                description: '',
            }
        };

        const newEdge: Edge = {
            id: `e-${sourceId}-${newNodeId}`,
            source: sourceId,
            target: newNodeId,
            sourceHandle: 'b',
            targetHandle: 't',
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#94a3b8', strokeWidth: 2 }
        };

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);

        // Select the new node
        setTimeout(() => {
            setSelectedNode(newNode);
        }, 50);

        toast({
            title: "Paso añadido",
            description: "Se ha creado un nuevo paso conectado automáticamente.",
        });
    }, [reactFlowInstance, setNodes, setEdges, toast]);

    const handleAddNode = () => {
        const id = uuidv4();
        const newNode: Node = {
            id,
            type: 'premium',
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
            data: {
                label: 'Nuevo Paso',
                description: '',
            }
        };
        setNodes((nds) => [...nds, newNode]);
    };

    // Initialize nodes with onQuickAdd callback
    // Removed the buggy useEffect here

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();

            // Sanitize to avoid Firebase 'undefined' error
            const sanitize = (obj: any): any => {
                if (Array.isArray(obj)) return obj.map(sanitize);
                if (obj !== null && typeof obj === 'object') {
                    return Object.fromEntries(
                        Object.entries(obj)
                            .filter(([_, v]) => v !== undefined)
                            .map(([k, v]) => [k, sanitize(v)])
                    );
                }
                return obj;
            };

            const cleanNodes = sanitize(currentNodes);
            const cleanEdges = sanitize(currentEdges);

            await updateDoc(doc(firestore, 'processes', processId), {
                nodes: cleanNodes,
                edges: cleanEdges,
                updatedAt: new Date()
            });
            toast({ title: "Guardado", description: "El mapa se ha guardado correctamente." });
        } catch (error: any) {
            console.error("Error saving:", error);
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const updateSelectedNodeData = (field: string, value: any) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === selectedNode.id) {
                    node.data = {
                        ...node.data,
                        [field]: value
                    };
                    // Also update local selectedNode state so panel reflects change immediately
                    setSelectedNode(node);
                }
                return node;
            })
        );
    };

    const handleDeleteSelectedNode = () => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
    };

    const handleDeleteSelectedEdge = () => {
        if (!selectedEdge) return;
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
        setSelectedEdge(null);
    };

    return (
        <QuickAddContext.Provider value={handleQuickAdd}>
            <div className="flex-1 w-full bg-[#f8fafc] relative flex h-full overflow-hidden">
                <div className="flex-1 h-full relative">
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />
                    <ReactFlow
                        nodes={nodes}
                        edges={displayEdges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onReconnect={onReconnect}
                        onSelectionChange={(params) => {
                            onSelectionChange(params);
                            // On mobile, open sidebar when something is selected
                            if ((params.nodes.length > 0 || params.edges.length > 0) && window.innerWidth < 1024) {
                                setIsSidebarOpen(true);
                            }
                        }}
                        fitView
                        attributionPosition="bottom-right"
                    >
                        <Background variant={BackgroundVariant.Dots} color="#cbd5e1" gap={20} />
                        <Controls className="bg-white/80 backdrop-blur-md border-slate-200 shadow-xl rounded-lg" />
                    </ReactFlow>
                </div>

                {/* Mobile Sidebar Toggle - Only visible when something is selected or sidebar is open */}
                {(selectedNode || selectedEdge || isSidebarOpen) && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-4 right-4 z-50 lg:hidden shadow-md border"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        {isSidebarOpen ? <X className="w-4 h-4 mr-2" /> : <Settings2 className="w-4 h-4 mr-2" />}
                        {isSidebarOpen ? 'Cerrar' : 'Configuración'}
                    </Button>
                )}

                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    <Button onClick={handleAddNode} variant="secondary" size="sm" className="bg-white/90 backdrop-blur shadow-sm border-slate-200">
                        <Plus className="w-4 h-4 mr-2 text-primary" /> Agregar Paso
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} size="sm" className="shadow-lg">
                        <Save className={`${isSaving ? 'animate-spin' : ''} w-4 h-4 mr-2`} />
                        {isSaving ? 'Guardando...' : 'Guardar Mapa'}
                    </Button>
                </div>

                {/* Responsive Sidebar */}
                <div className={`
                    ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                    fixed lg:relative inset-y-0 right-0 w-80 
                    border-l bg-card flex flex-col z-40 lg:z-20 
                    transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
                    overflow-y-auto
                `}>
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between lg:block">
                        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700">
                            <Settings2 className="w-4 h-4 text-primary" />
                            {selectedNode ? 'Configuración Nodo' : selectedEdge ? 'Configuración Conexión' : 'Configuración'}
                        </h2>
                        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto">
                        {selectedNode ? (
                            <div className="space-y-4">
                                {/* ... existing node config ... */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="node-label">Nombre del Paso</Label>
                                        <Button
                                            variant={selectedNode.data?.isBoldTitle ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 px-2"
                                            onClick={() => updateSelectedNodeData('isBoldTitle', !selectedNode.data?.isBoldTitle)}
                                        >
                                            <Bold className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <Input
                                        id="node-label"
                                        value={(selectedNode.data?.label as string) || ""}
                                        onChange={(e) => updateSelectedNodeData('label', e.target.value)}
                                        placeholder="Ej: Inicio de Proceso"
                                        className={selectedNode.data?.isBoldTitle ? 'font-bold' : ''}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="node-platform">Plataforma</Label>
                                    <Select
                                        value={(selectedNode.data?.platform as string) || "Ninguna"}
                                        onValueChange={(val) => updateSelectedNodeData('platform', val)}
                                    >
                                        <SelectTrigger id="node-platform">
                                            <SelectValue placeholder="Seleccionar plataforma" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Ninguna">Ninguna</SelectItem>
                                            <SelectItem value="DecoEntrega">DecoEntrega</SelectItem>
                                            <SelectItem value="DecoToolkit">DecoToolkit</SelectItem>
                                            <SelectItem value="DecoTrack">DecoTrack</SelectItem>
                                            <SelectItem value="Alegra">Alegra</SelectItem>
                                            <SelectItem value="Otros">Otros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="node-role">Rol</Label>
                                        <Select
                                            value={(selectedNode.data?.role as string) || "Encargado"}
                                            onValueChange={(val) => updateSelectedNodeData('role', val)}
                                        >
                                            <SelectTrigger id="node-role">
                                                <SelectValue placeholder="Rol" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Encargado">Encargado</SelectItem>
                                                <SelectItem value="Aprobador">Aprobador</SelectItem>
                                                <SelectItem value="Otros">Otros</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="node-responsible">Nombre</Label>
                                        <Input
                                            id="node-responsible"
                                            value={(selectedNode.data?.responsibleName as string) || ""}
                                            onChange={(e) => updateSelectedNodeData('responsibleName', e.target.value)}
                                            placeholder="Persona"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Descripción Visual</Label>
                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                                            <Button 
                                                variant={activeFormats.bold ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 w-7 p-0" 
                                                title="Negrita" onMouseDown={(e) => e.preventDefault()} 
                                                onClick={() => {
                                                    document.execCommand('bold', false);
                                                    setActiveFormats(prev => ({ ...prev, bold: document.queryCommandState('bold') }));
                                                    editorRef.current?.focus();
                                                }}>
                                                <Bold className={`w-3 h-3 ${activeFormats.bold ? 'text-primary' : ''}`} />
                                            </Button>
                                            <Button 
                                                variant={activeFormats.italic ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 w-7 p-0" 
                                                title="Itálica" onMouseDown={(e) => e.preventDefault()} 
                                                onClick={() => {
                                                    document.execCommand('italic', false);
                                                    setActiveFormats(prev => ({ ...prev, italic: document.queryCommandState('italic') }));
                                                    editorRef.current?.focus();
                                                }}>
                                                <Italic className={`w-3 h-3 ${activeFormats.italic ? 'text-primary' : ''}`} />
                                            </Button>
                                            <Button 
                                                variant={activeFormats.underline ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 w-7 p-0" 
                                                title="Subrayado" onMouseDown={(e) => e.preventDefault()} 
                                                onClick={() => {
                                                    document.execCommand('underline', false);
                                                    setActiveFormats(prev => ({ ...prev, underline: document.queryCommandState('underline') }));
                                                    editorRef.current?.focus();
                                                }}>
                                                <Underline className={`w-3 h-3 ${activeFormats.underline ? 'text-primary' : ''}`} />
                                            </Button>
                                            <Button 
                                                variant={activeFormats.strikeThrough ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 w-7 p-0" 
                                                title="Tachado" onMouseDown={(e) => e.preventDefault()} 
                                                onClick={() => {
                                                    document.execCommand('strikeThrough', false);
                                                    setActiveFormats(prev => ({ ...prev, strikeThrough: document.queryCommandState('strikeThrough') }));
                                                    editorRef.current?.focus();
                                                }}>
                                                <Strikethrough className={`w-3 h-3 ${activeFormats.strikeThrough ? 'text-primary' : ''}`} />
                                            </Button>
                                            <div className="w-[1px] h-4 bg-slate-300 mx-0.5 mt-1.5" />
                                            <Button 
                                                variant={activeFormats.list ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 w-7 p-0" 
                                                title="Lista" onMouseDown={(e) => e.preventDefault()} 
                                                onClick={() => {
                                                    document.execCommand('insertUnorderedList', false);
                                                    setActiveFormats(prev => ({ ...prev, list: document.queryCommandState('insertUnorderedList') }));
                                                    editorRef.current?.focus();
                                                }}>
                                                <List className={`w-3 h-3 ${activeFormats.list ? 'text-primary' : ''}`} />
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div 
                                        ref={editorRef}
                                        className="min-h-[150px] w-full p-3 text-sm rounded-md border bg-white focus-within:ring-2 focus-within:ring-primary/20 transition-all rich-text-content shadow-inner overflow-y-auto max-h-[300px]"
                                        contentEditable
                                        onInput={(e) => {
                                            // Actulizar sin gatillar re-render del div
                                            updateSelectedNodeData('description', e.currentTarget.innerHTML);
                                        }}
                                        onBlur={(e) => {
                                            updateSelectedNodeData('description', e.currentTarget.innerHTML);
                                        }}
                                        style={{ outline: 'none' }}
                                    />
                                    <p className="text-[10px] text-slate-400 italic">Los cambios vinculados se guardan al escribir.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="node-link">URL Enlace (Opcional)</Label>
                                    <Input
                                        id="node-link"
                                        value={(selectedNode.data?.linkUrl as string) || ""}
                                        onChange={(e) => updateSelectedNodeData('linkUrl', e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="node-color">Color de Acento</Label>
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            id="node-color"
                                            type="color"
                                            className="w-12 h-10 p-1 rounded cursor-pointer"
                                            value={(selectedNode.data?.color as string) || "#3b82f6"}
                                            onChange={(e) => updateSelectedNodeData('color', e.target.value)}
                                        />
                                        <Input
                                            type="text"
                                            value={(selectedNode.data?.color as string) || "#3b82f6"}
                                            onChange={(e) => updateSelectedNodeData('color', e.target.value)}
                                            className="font-mono text-xs uppercase"
                                        />
                                    </div>
                                </div>

                                <Button onClick={handleDeleteSelectedNode} variant="destructive" className="w-full mt-4 flex items-center justify-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Eliminar Paso
                                </Button>
                            </div>
                        ) : selectedEdge ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg border border-slate-200">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Detalles de Conexión</p>
                                    <p className="text-sm text-slate-700">Puedes arrastrar los extremos de las líneas en el mapa para reconectarlas a otros bloques.</p>
                                </div>
                                <Button onClick={handleDeleteSelectedEdge} variant="destructive" className="w-full flex items-center justify-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Eliminar Conexión
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground mt-8">
                                Selecciona un bloque o una línea en el mapa para editar sus propiedades.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </QuickAddContext.Provider>
    );
}

export default function ProcessEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);
    const isAdmin = profile?.isAdmin || profile?.permissions?.allowedModules?.includes('admin');

    const processRef = useMemo(() => doc(firestore, 'processes', id), [firestore, id]);
    const { data: processData, isLoading } = useDoc<ProcessMap>(processRef);

    if (isUserLoading || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!user || !isAdmin) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background">
                <div className="max-w-md text-center border p-6 rounded shadow bg-destructive/10">
                    <h2 className="text-xl font-bold text-destructive mb-2">Acceso Denegado</h2>
                    <p>No tienes permisos para acceder al editor de procesos.</p>
                    <div className="mt-4">
                        <Link href="/" className="text-primary hover:underline">Volver al Inicio</Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!processData && !isLoading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4">
                <p>Proceso no encontrado.</p>
                <Button asChild>
                    <Link href="/procesos/admin">Volver</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh)]">
            <Header />
            <div className="flex flex-col flex-1 overflow-hidden relative">
                <div className="p-4 border-b bg-card flex items-center justify-between z-10 shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/procesos/admin">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                Editor: {processData?.title}
                            </h1>
                            <p className="text-sm text-muted-foreground">{processData?.description}</p>
                        </div>
                    </div>
                </div>

                {processData && (
                    <ReactFlowProvider>
                        <FlowEditor
                            processId={id}
                            initialNodes={processData.nodes as Node[]}
                            initialEdges={processData.edges as Edge[]}
                            processTitle={processData.title}
                        />
                    </ReactFlowProvider>
                )}
            </div>
        </div>
    );
}
