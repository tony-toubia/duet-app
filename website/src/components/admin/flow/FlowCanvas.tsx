'use client';

import { useCallback, useState, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TriggerNode } from './TriggerNode';
import { ActionNode } from './ActionNode';
import { ConditionNode } from './ConditionNode';
import { DelayNode } from './DelayNode';
import { ExitNode } from './ExitNode';
import { NodeEditor } from './NodeEditor';

const NODE_TYPE_PALETTE = [
  { type: 'action', label: 'Action', color: 'bg-primary' },
  { type: 'condition', label: 'Condition', color: 'bg-warning' },
  { type: 'delay', label: 'Delay', color: 'bg-text-muted' },
  { type: 'exit', label: 'Exit', color: 'bg-danger' },
];

const DEFAULT_DATA: Record<string, any> = {
  action: { channel: 'email', templateId: '' },
  condition: { conditionType: 'event_occurred', eventType: '', sinceTrigger: true },
  delay: { delayMs: 86400000 },
  exit: {},
};

interface FlowCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onSave: (nodes: Node[], edges: Edge[]) => void;
  isSaving?: boolean;
}

let idCounter = 0;
function generateId(type: string): string {
  return `${type}_${Date.now()}_${idCounter++}`;
}

export function FlowCanvas({
  initialNodes,
  initialEdges,
  onSave,
  isSaving,
}: FlowCanvasProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      action: ActionNode,
      condition: ConditionNode,
      delay: DelayNode,
      exit: ExitNode,
    }),
    []
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e_${Date.now()}_${idCounter++}`,
            animated: true,
          },
          eds
        )
      ),
    []
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleNodeDataChange = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data } : n))
    );
  }, []);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNodeId(null);
    },
    []
  );

  const handleAddNode = useCallback(
    (type: string) => {
      // Place new node below the bottom-most node
      const maxY = nodes.reduce(
        (max, n) => Math.max(max, n.position.y),
        0
      );
      const newNode: Node = {
        id: generateId(type),
        type,
        position: { x: 250, y: maxY + 140 },
        data: { ...DEFAULT_DATA[type] },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [nodes]
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="flex h-full">
      {/* Sidebar — Node palette */}
      <div className="w-44 bg-surface border-r border-glass-border p-3 flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
          Add Node
        </p>
        {NODE_TYPE_PALETTE.map((item) => (
          <button
            key={item.type}
            onClick={() => handleAddNode(item.type)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white bg-glass border border-glass-border hover:bg-glass-border transition-colors"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            {item.label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => onSave(nodes, edges)}
          disabled={isSaving}
          className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Flow'}
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls className="!bg-surface !border-glass-border [&>button]:!bg-glass [&>button]:!border-glass-border [&>button]:!fill-white" />
          <MiniMap
            className="!bg-surface !border-glass-border"
            nodeColor={(n) => {
              switch (n.type) {
                case 'trigger': return '#4ade80';
                case 'action': return '#e8734a';
                case 'condition': return '#fbbf24';
                case 'delay': return '#b0b8c8';
                case 'exit': return '#ef4444';
                default: return '#ffffff';
              }
            }}
          />
        </ReactFlow>
      </div>

      {/* Node editor sidebar */}
      {selectedNode && (
        <NodeEditor
          node={selectedNode}
          onChange={handleNodeDataChange}
          onDelete={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
