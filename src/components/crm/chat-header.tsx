'use client';

import { Chat } from '@/lib/types/crm';
import { User, Phone, CheckCircle2, Bot, ArrowLeft } from 'lucide-react';

interface ChatHeaderProps {
  chat: Chat;
  onTakeChat: () => void;
  onBack?: () => void;
}

export function ChatHeader({ chat, onTakeChat, onBack }: ChatHeaderProps) {
  const getStatusBadge = () => {
    switch (chat.status) {
      case 'unassigned':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Sin asignar
          </span>
        );
      case 'assigned':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Asignado a {chat.assignedTo === 'current-user-id' ? 'ti' : 'otro asesor'}
          </span>
        );
      case 'bot_handling':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Bot className="w-3 h-3 mr-1" />
            AI Bot
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      <div className="flex items-center">
        {onBack && (
          <button 
            onClick={onBack}
            className="md:hidden mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500"
            title="Volver a los chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg mr-4 flex-shrink-0">
          {chat.contactName.charAt(0).toUpperCase()}
        </div>
        <div className="overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{chat.contactName}</h2>
          <div className="flex items-center text-sm text-gray-500 mt-1 flex-wrap gap-y-1">
            <Phone className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate mr-2">{chat.phone}</span>
            {getStatusBadge()}
          </div>
        </div>
      </div>

      <div>
        {chat.status === 'unassigned' && (
          <button
            onClick={onTakeChat}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium transition-colors shadow-sm ml-2 flex-shrink-0"
          >
            Tomar Chat
          </button>
        )}
      </div>
    </div>
  );
}
