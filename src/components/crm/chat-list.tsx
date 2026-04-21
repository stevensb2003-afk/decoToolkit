'use client';

import { Chat, ContactSource } from '@/lib/types/crm';
import { User, Clock, MessageCircle, Instagram, Facebook, Globe } from 'lucide-react';

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

export function ChatList({ chats, selectedChatId, onSelectChat }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
        <User className="w-12 h-12 mb-4 text-gray-300" />
        <p>No hay chats en esta categoría.</p>
      </div>
    );
  }

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const SourceIcon = ({ source }: { source: ContactSource }) => {
    switch (source) {
      case 'whatsapp': return <MessageCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'instagram': return <Instagram className="w-3.5 h-3.5 text-pink-500" />;
      case 'facebook': return <Facebook className="w-3.5 h-3.5 text-blue-600" />;
      case 'web': return <Globe className="w-3.5 h-3.5 text-gray-500" />;
      default: return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {chats.map((chat) => (
        <div
          key={chat.id}
          onClick={() => onSelectChat(chat.id)}
          className={`flex items-center p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
            selectedChatId === chat.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : 'border-l-4 border-l-transparent'
          }`}
        >
          {/* Avatar Placeholder */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500 font-bold text-lg">
              {chat.contactName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
              <SourceIcon source={chat.source} />
            </div>
          </div>
          
          <div className="ml-4 flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-0.5">
              <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">
                {chat.contactName}
              </h3>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatTime(chat.lastMessageTimestamp)}
              </span>
            </div>
            {/* Show owner if assigned */}
            {chat.assignedToName && (
               <div className="text-[10px] uppercase font-bold text-orange-600/80 tracking-wider mb-0.5">
                 Atendido por: {chat.assignedToName}
               </div>
            )}
            <div className="flex justify-between items-center mt-0.5">
              <p className="text-sm text-gray-500 truncate flex-1 mr-2">
                {chat.lastMessage || 'Sin mensajes aún'}
              </p>
              {chat.unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex-shrink-0 shadow-sm">
                  {chat.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
