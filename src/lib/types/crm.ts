export type ChatStatus = 'unassigned' | 'assigned' | 'bot_handling' | 'archived';
export type ContactSource = 'whatsapp' | 'instagram' | 'facebook' | 'web';

export interface Tag {
  id: string;
  name: string;
  color: string; // e.g. 'bg-blue-100 text-blue-800'
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: ContactSource;
  tagIds: string[];
}

export interface Chat {
  id: string;
  clientId: string;
  contactName: string;
  phone: string;
  source: ContactSource;
  status: ChatStatus;
  assignedTo?: string | null;
  assignedToName?: string | null;
  lastMessage?: string;
  lastMessageTimestamp?: number; // Unix timestamp
  unreadCount: number;
}

export type MessageType = 'text' | 'image' | 'audio' | 'pdf';

export interface Message {
  id: string;
  chatId: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  senderId: 'user' | 'client' | 'bot'; // 'user' is us, 'client' is the customer
  senderName?: string;
  timestamp: number; // Unix timestamp
}

// Mock Data
export const MOCK_TAGS: Tag[] = [
  { id: 'tag-1', name: 'VIP', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'tag-2', name: 'Cotización', color: 'bg-blue-100 text-blue-800' },
  { id: 'tag-3', name: 'Mayorista', color: 'bg-purple-100 text-purple-800' },
  { id: 'tag-4', name: 'Nuevo', color: 'bg-green-100 text-green-800' },
];

export const MOCK_CLIENTS: Client[] = [
  { id: 'cli-1', name: 'María Rojas', phone: '+506 8888-1111', email: 'maria@example.com', source: 'whatsapp', tagIds: ['tag-1', 'tag-2'] },
  { id: 'cli-2', name: 'Carlos Méndez', phone: '+506 8888-2222', source: 'instagram', tagIds: ['tag-4'] },
  { id: 'cli-3', name: 'Ana Patricia', phone: '+506 8888-3333', email: 'ana@ejemplo.com', source: 'facebook', tagIds: [] },
  { id: 'cli-4', name: 'Empresa XYZ', phone: '+506 8888-4444', email: 'contacto@xyz.com', source: 'web', tagIds: ['tag-3'] },
];

export const MOCK_CHATS: Chat[] = [
  {
    id: 'chat-1',
    clientId: 'cli-1',
    contactName: 'María Rojas',
    phone: '+506 8888-1111',
    source: 'whatsapp',
    status: 'unassigned',
    lastMessage: 'Hola, me gustaría cotizar una remodelación de cocina.',
    lastMessageTimestamp: Date.now() - 1000 * 60 * 5, // 5 mins ago
    unreadCount: 2,
  },
  {
    id: 'chat-2',
    clientId: 'cli-2',
    contactName: 'Carlos Méndez',
    phone: '+506 8888-2222',
    source: 'instagram',
    status: 'unassigned',
    lastMessage: '¿Tienen disponibilidad para este mes?',
    lastMessageTimestamp: Date.now() - 1000 * 60 * 30, // 30 mins ago
    unreadCount: 1,
  },
  {
    id: 'chat-3',
    clientId: 'cli-3',
    contactName: 'Ana Patricia',
    phone: '+506 8888-3333',
    source: 'facebook',
    status: 'assigned',
    assignedTo: 'current-user-id',
    assignedToName: 'Juan Asesor',
    lastMessage: 'Perfecto, envíenme el PDF por favor.',
    lastMessageTimestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    unreadCount: 0,
  },
  {
    id: 'chat-4',
    clientId: 'cli-4',
    contactName: 'Empresa XYZ',
    phone: '+506 8888-4444',
    source: 'web',
    status: 'bot_handling',
    lastMessage: '¿Cuál es su horario de atención?',
    lastMessageTimestamp: Date.now() - 1000 * 60, // 1 min ago
    unreadCount: 0,
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  'chat-1': [
    { id: 'msg-1', chatId: 'chat-1', text: '¡Hola! Bienvenidos a DecoToolkit.', type: 'text', senderId: 'bot', timestamp: Date.now() - 1000 * 60 * 10 },
    { id: 'msg-2', chatId: 'chat-1', text: 'Hola, me gustaría cotizar una remodelación de cocina.', type: 'text', senderId: 'client', timestamp: Date.now() - 1000 * 60 * 5 },
  ],
  'chat-3': [
    { id: 'msg-3', chatId: 'chat-3', text: 'Hola Ana, adjunto el diseño preliminar.', type: 'text', senderId: 'user', senderName: 'Juan Asesor', timestamp: Date.now() - 1000 * 60 * 60 * 3 },
    { id: 'msg-4', chatId: 'chat-3', text: 'Perfecto, envíenme el PDF por favor.', type: 'text', senderId: 'client', timestamp: Date.now() - 1000 * 60 * 60 * 2 },
  ]
};
