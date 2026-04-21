"use client";

import {
    ReactFlow,
    Controls,
    Background,
    BackgroundVariant,
    MiniMap,
    Node,
    Edge,
    NodeChange,
    EdgeChange,
    Connection,
    OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface FlowCanvasProps {
    mode: "view" | "edit";
    nodes: Node[];
    edges: Edge[];
    nodeTypes: Record<string, any>;
    onNodesChange?: (changes: NodeChange[]) => void;
    onEdgesChange?: (changes: EdgeChange[]) => void;
    onConnect?: (connection: Connection) => void;
    onReconnect?: (oldEdge: Edge, newConnection: Connection) => void;
    onSelectionChange?: (params: OnSelectionChangeParams) => void;
    onNodeClick?: (event: React.MouseEvent, node: Node) => void;
    onPaneClick?: (event: React.MouseEvent) => void;
    showMiniMap?: boolean;
}

export function FlowCanvas({
    mode,
    nodes,
    edges,
    nodeTypes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    onSelectionChange,
    onNodeClick,
    onPaneClick,
    showMiniMap = false,
}: FlowCanvasProps) {
    const isView = mode === "view";

    return (
        <div className="flex-1 w-full h-full relative">
            {/* Dot pattern overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none z-0" />

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onReconnect={onReconnect}
                onSelectionChange={onSelectionChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodesDraggable={!isView}
                nodesConnectable={!isView}
                elementsSelectable={true}
                fitView
                fitViewOptions={{ padding: isView ? 0.4 : 0.25 }}
                attributionPosition="bottom-right"
                minZoom={0.1}
                maxZoom={2.5}
                className="bg-[#f8fafc]"
            >
            </ReactFlow>
        </div>
    );
}
