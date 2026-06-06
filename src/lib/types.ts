
import type { Timestamp, FieldValue } from "firebase/firestore";

export type Unit = "m" | "cm";

export interface MaterialTexture {
  url: string;              // Firebase Storage download URL
  storagePath: string;      // e.g. textures/default/{id}.jpg
  originalWidth: number;    // pixels of the uploaded image
  originalHeight: number;   // pixels of the uploaded image
  uploadedAt: Timestamp;
  metadata?: {
    materialType?: string;
    colorPalette?: string[];
    pattern?: string;
    finish?: string;
    seamlessPrompt?: string;
    physicalWidth?: number;  // The real-world width this texture represents (e.g. 16cm)
    physicalHeight?: number; // The real-world height this texture represents (e.g. 30cm)
  };
}

export interface DefaultMaterial {
  id: string;
  name: string;
  width: number;            // stored in cm
  height: number;           // stored in cm
  createdAt: Timestamp;
  color?: string;           // HEX — shown in canvas/PDF when no texture
  categoryId?: string;      // ref to materialCategories/{id}
  texture?: MaterialTexture;
}

export interface MaterialCategory {
  id: string;
  name: string;             // e.g. "WPC 19mm", "Granito Premium"
  description?: string;
  order: number;            // display order
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  isAdmin?: boolean;
  permissions: {
    canManageUsers: boolean;
    canEditStandardMaterials: boolean;
    allowedModules: string[]; // ['caja', 'inventory', 'projects', 'calculator', 'admin', 'procesos']
  };
}


// ---- Main Project Document ----
export interface Project {
  surfaces: any;
  id: string;
  userId: string;
  projectName: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  materials: Material[];
  remnants: Remnant[];
  clientName?: string;
  clientPhone?: string;
}

export interface Material {
  id: string;
  name: string;
  height: number; // Stored in cm
  width: number; // Stored in cm
  color: string;  // Hex color — used when no texture is set
  installationOrientation: "Vertical" | "Horizontal";
  defaultMaterialId?: string;
  texture?: MaterialTexture; // optional: overrides color in canvas/PDF
}

export interface Remnant {
  id: string;
  materialId: string;
  points: Point[]; // Main path for backward compatibility
  fragments?: Fragment[]; // Support for multiple parts/holes
  x: number; // Center of bounding box
  y: number; // Center of bounding box
  width: number; // Bounding box width, in cm
  height: number; // Bounding box height, in cm
  createdAt: FieldValue | Date;
  sourceSheetId?: string;
}

export interface GroupedRemnant extends Remnant {
  count: number;
  shapeId: string;
  instanceIds: string[];
}


// ---- Sub-collections ----

export interface Surface {
  id: string;
  name: string;
  height: number; // in cm
  width: number; // in cm
}

export type Point = { x: number; y: number };

export interface Obstacle {
  id: string;
  name?: string;
  surfaceId: string;
  points: Point[]; // A list of ordered vertices defining the polygon
}

export interface PlacedPiece {
  id: string;
  placementId?: string;
  surfaceId: string;
  materialId: string;
  source: {
    type: 'material' | 'remnant';
    id: string;
  };
  x: number; // in cm
  y: number; // in cm
  width: number; // in cm
  height: number; // in cm;
  rotation: number; // in degrees
  fragments: Fragment[];
  createdAt: FieldValue | Date | Timestamp;
  sourceSheetId?: string;
}

export interface Fragment {
  id: string;
  points: Point[]; // Un array de vértices que definen el polígono
}


// ---- Client-side State Management ----

// The active "brush" can be a full material sheet or a remnant piece
export type Brush = (Material & { type: 'material' }) | (GroupedRemnant & { type: 'remnant' });
export type PivotPoint = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
export type MeasureMode = 'area' | 'vertex' | 'distance';

export interface HistoryState {
  pieces: PlacedPiece[];
  remnants: Remnant[];
}

export type HistoryAction = {
  type: 'add-pieces' | 'delete-pieces' | 'clear-all' | 'generate-cuts';
  payload: {
    oldState: HistoryState;
    newState: HistoryState;
  };
};


export interface ClientState {
  // Data loaded from Firestore
  projectId: string;
  surfaces: Surface[];
  materials: Material[];
  remnants: Remnant[];

  // UI State
  activeSurfaceId: string | null;
  editorScale: number; // Pixels per cm
  activeBrush: Brush | null;
  pivotPoint: PivotPoint;
  brushAngle: number;
  summaryViewMode: 'surface' | 'project';

  // Tool Options
  isFillMode: boolean;
  isObstacleSnapActive: boolean;
  isDragLockActive: boolean;

  // Active Tool State
  isEraserMode: boolean;
  isMeasureMode: boolean;
  measureMode: MeasureMode;
  isRepeating: boolean; // Add this if it was missing or part of another feature
  isHandMode: boolean;
  viewZoom: number;
  viewPan: { x: number; y: number };
  isRotating: boolean;
  showGrid: boolean;
  gridSpacing: number; // in cm

  // Undo/Redo History
  history: HistoryAction[];
  historyIndex: number;
}

export interface Measurement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startX?: number;
  startY?: number;
}

export interface VertexMeasurement {
  p1: Point;
  p2: Point;
  length: number;
}

export interface VertexFigure {
  id: string;
  segments: VertexMeasurement[];
}

// ---- Cash Control Types ----

export interface Branch {
  id: string;
  name: string;
  assignedAdmins?: string[];
  createdAt: Timestamp | Date;
}

export interface CashRegister {
  id: string;
  branchId: string;
  name: string;
  assignedAdmins?: string[];
  initialBalance?: number;
  createdAt: Timestamp | Date;
}

export interface CashSession {
  id: string;
  branchId: string;
  cajaId: string;
  cajaName?: string;
  userId: string;
  userName?: string; // Nombre del auditor o quien abrió
  openedAt: Timestamp | Date; // Firestore Timestamp
  closedAt: Timestamp | Date | null;
  openingBalance: number;
  closingBalance: number | null;
  status: 'open' | 'closed';
  closingBase?: number; // Lo que se queda en caja para el día siguiente
  closingTotalPhysical?: number; // El conteo físico total antes de retirar base
  closingBankDeposit?: number; // Lo que se fue al banco en el cierre
  closedByUserId?: string;
  closedByUserName?: string;
}

export type CashTransactionCategory = 'venta' | 'aporte' | 'gasto' | 'pago_proveedor' | 'nomina' | 'corte_parcial';

export interface CashTransaction {
  id: string;
  branchId: string;
  cajaId: string;
  sessionId: string | null; // Null if it's in the waiting room
  userId: string;
  userName?: string;
  type: 'income' | 'expense';
  amount: number;
  category: CashTransactionCategory;
  description: string;
  createdAt: Timestamp | Date;
  source: 'manual' | 'alegra_api';
  status: 'applied' | 'pending';
}

// ---- Processes Module ----

export interface ProcessNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    linkUrl?: string;
    color?: string;
    responsibleName?: string;
    role?: 'Encargado' | 'Aprobador' | 'Otros';
    platform?: 'DecoEntrega' | 'DecoToolkit' | 'DecoTrack' | 'Alegra' | 'Otros';
    isBoldTitle?: boolean;
  };
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
  type?: string;
  style?: Record<string, any>;
}

export interface ProcessMap {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  category?: string;           // ID of processCategories doc
  tags?: string[];             // Array of tags
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  nodeCount?: number;          // Denormalized for listing performance
  version: number;             // Incremented on each save
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;
  isPublished: boolean;
}

export interface ProcessVersion {
  id: string;
  versionNumber: number;
  savedAt: Timestamp | Date;   // Effective date
  savedBy: string;             // UID
  savedByName: string;         // Display name
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  changeNote?: string;
}

export interface ProcessCategory {
  id: string;
  name: string;
  color: string;               // Hex color for badge
  icon?: string;               // Lucide icon name (optional)
  order: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}
