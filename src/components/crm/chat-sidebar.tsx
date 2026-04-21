'use client';

import { useState } from 'react';
import { Chat } from '@/lib/types/crm';
import { ChatList } from './chat-list';
import { Search, Inbox, User, Users, ShieldAlert, Bot, Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ChatSidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  isAdmin: boolean;
  onOpenSettings: () => void;
  onOpenDirectory: () => void;
}

type TabType = 'inbox' | 'bot' | 'mine' | 'all';

export function ChatSidebar({ chats, selectedChatId, onSelectChat, isAdmin, onOpenSettings, onOpenDirectory }: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter logic based on tab and search
  const filteredChats = chats.filter((chat) => {
    // 1. Search Filter
    const matchesSearch = chat.contactName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          chat.phone.includes(searchQuery);
    if (!matchesSearch) return false;

    // 2. Tab Filter
    switch (activeTab) {
      case 'inbox':
        return chat.status === 'unassigned';
      case 'bot':
        return chat.status === 'bot_handling';
      case 'mine':
        return chat.status === 'assigned' && chat.assignedTo === 'current-user-id'; // Mock user id
      case 'all':
        return true; // Show all for audit
      default:
        return false;
    }
  });

  return (
    <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col bg-white border-r border-gray-200 h-full flex-shrink-0">
      {/* Header & Search */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Link href="/" className="mr-3 p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" title="Volver al Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h2 className="text-xl font-bold text-gray-800">
              Mensajes
            </h2>
          </div>
          {isAdmin && (
            <div className="flex items-center">
              <button 
                onClick={onOpenDirectory}
                className="p-2 mr-1 rounded-full hover:bg-gray-200 text-gray-600 transition-colors" 
                title="Directorio de Clientes"
              >
                <Users className="w-5 h-5" />
              </button>
              <button 
                onClick={onOpenSettings}
                className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors" 
                title="Configuración CRM"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar contacto o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-sm text-sm"
          />
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Tabs - Scrollable horizontally on small screens if needed */}
      <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex-1 min-w-[80px] py-3 px-2 text-xs font-medium text-center border-b-2 flex flex-col items-center justify-center transition-colors ${
            activeTab === 'inbox' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Inbox className="w-5 h-5 mb-1" />
          Inbox
        </button>
        <button
          onClick={() => setActiveTab('bot')}
          className={`flex-1 min-w-[80px] py-3 px-2 text-xs font-medium text-center border-b-2 flex flex-col items-center justify-center transition-colors ${
            activeTab === 'bot' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Bot className="w-5 h-5 mb-1" />
          Bot Inbox
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          className={`flex-1 min-w-[80px] py-3 px-2 text-xs font-medium text-center border-b-2 flex flex-col items-center justify-center transition-colors ${
            activeTab === 'mine' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <User className="w-5 h-5 mb-1" />
          Míos
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 min-w-[80px] py-3 px-2 text-xs font-medium text-center border-b-2 flex flex-col items-center justify-center transition-colors ${
              activeTab === 'all' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ShieldAlert className="w-5 h-5 mb-1" />
            Todos
          </button>
        )}
      </div>

      {/* Chat List */}
      <ChatList 
        chats={filteredChats} 
        selectedChatId={selectedChatId} 
        onSelectChat={onSelectChat} 
      />
    </div>
  );
}
