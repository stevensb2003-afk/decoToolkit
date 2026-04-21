'use client';

import { Message } from '@/lib/types/crm';
import { Bot, FileText, Image as ImageIcon, Mic } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUs = message.senderId === 'user' || message.senderId === 'bot';
  const isBot = message.senderId === 'bot';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMedia = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="mt-2 mb-1 flex items-center bg-black/5 rounded-lg p-2">
            <ImageIcon className="w-5 h-5 mr-2 text-gray-500" />
            <span className="text-sm italic">Imagen adjunta</span>
          </div>
        );
      case 'audio':
        return (
          <div className="mt-2 mb-1 flex items-center bg-black/5 rounded-lg p-2">
            <Mic className="w-5 h-5 mr-2 text-gray-500" />
            <span className="text-sm italic">Mensaje de voz</span>
            {/* Audio player placeholder */}
            <div className="ml-3 h-1 w-24 bg-gray-300 rounded-full overflow-hidden">
              <div className="w-1/3 h-full bg-orange-500"></div>
            </div>
            <span className="ml-2 text-xs text-gray-500">0:12</span>
          </div>
        );
      case 'pdf':
        return (
          <div className="mt-2 mb-1 flex items-center bg-black/5 rounded-lg p-3">
            <FileText className="w-6 h-6 mr-3 text-red-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Documento.pdf</span>
              <span className="text-xs text-gray-500">1.2 MB</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex w-full mb-4 ${isUs ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col max-w-[75%] ${isUs ? 'items-end' : 'items-start'}`}>
        
        {/* Sender Name (mostly for bot or team view) */}
        {isUs && message.senderName && (
          <span className="text-xs text-gray-500 mb-1 mr-1 flex items-center">
            {isBot && <Bot className="w-3 h-3 mr-1" />}
            {message.senderName}
          </span>
        )}

        <div
          className={`relative px-4 py-2 rounded-2xl shadow-sm ${
            isUs
              ? 'bg-orange-500 text-white rounded-br-sm'
              : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
          }`}
        >
          {message.text && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
          )}
          
          {renderMedia()}
          
          <div
            className={`text-[10px] mt-1 text-right ${
              isUs ? 'text-orange-100' : 'text-gray-400'
            }`}
          >
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
