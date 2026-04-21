'use client';

import { Chat, Message } from '@/lib/types/crm';
import { ChatHeader } from './chat-header';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';

interface ChatAreaProps {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onTakeChat: (chatId: string) => void;
  onBack?: () => void;
}

export function ChatArea({ chat, messages, onSendMessage, onTakeChat, onBack }: ChatAreaProps) {
  if (!chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-gray-500 h-full p-8 text-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-700 mb-2">DecoToolkit CRM</h2>
        <p className="max-w-md">Selecciona un chat de la lista de la izquierda para comenzar a enviar mensajes, o revisa la bandeja de entrada para atender nuevas solicitudes.</p>
      </div>
    );
  }

  const isInputDisabled = chat.status === 'unassigned' || (chat.status === 'assigned' && chat.assignedTo !== 'current-user-id');

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      <ChatHeader chat={chat} onTakeChat={() => onTakeChat(chat.id)} onBack={onBack} />
      
      <MessageList messages={messages} />

      {/* Warning overlay if we can't type */}
      {isInputDisabled && chat.status !== 'unassigned' && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="bg-gray-800 text-white text-xs px-4 py-2 rounded-full opacity-90 shadow-lg">
            Solo lectura. Este chat está asignado a otro asesor.
          </div>
        </div>
      )}

      {chat.status === 'unassigned' && (
         <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 pointer-events-none">
         <div className="bg-orange-500 text-white text-xs px-4 py-2 rounded-full shadow-lg">
           Debes "Tomar Chat" para poder responder.
         </div>
       </div>
      )}

      <ChatInput onSendMessage={onSendMessage} disabled={isInputDisabled} />
    </div>
  );
}
