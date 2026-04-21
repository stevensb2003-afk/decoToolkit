'use client';

import { useState } from 'react';
import { Paperclip, Mic, Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 p-2 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all">
        
        <button 
          disabled={disabled}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
          title="Adjuntar archivo"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Escribe un mensaje..."
          className="flex-1 max-h-32 min-h-[40px] bg-transparent border-none focus:ring-0 resize-none py-2 px-2 text-gray-800 disabled:opacity-50"
        />

        {text.trim() ? (
          <button 
            onClick={handleSend}
            disabled={disabled}
            className="p-2 text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-colors flex-shrink-0 shadow-sm disabled:opacity-50"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        ) : (
          <button 
            disabled={disabled}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
            title="Enviar nota de voz"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
