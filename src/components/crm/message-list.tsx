'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/lib/types/crm';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex items-center justify-center">
        <p className="text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm text-sm">
          No hay mensajes en este chat aún.
        </p>
      </div>
    );
  }

  // Simple grouping by date (mock implementation)
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-2 relative">
      <div className="flex justify-center mb-6">
        <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
          Hoy
        </span>
      </div>
      
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
