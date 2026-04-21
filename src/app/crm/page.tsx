"use client";

import { useState } from "react";
import { ChatSidebar } from "@/components/crm/chat-sidebar";
import { ChatArea } from "@/components/crm/chat-area";
import { SettingsLayout } from "@/components/crm/settings/settings-layout";
import { DirectoryLayout } from "@/components/crm/settings/directory-layout";
import { MOCK_CHATS, MOCK_MESSAGES, Chat, Message } from "@/lib/types/crm";
import { MaintenanceGate } from "@/components/auth/maintenance-gate";

export default function CRMPage() {
  // En la fase 2 esto vendrá de un Contexto de Auth real
  const isAdmin = true;
  const currentUserId = 'current-user-id';

  // Estados locales para la UI
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [messagesData, setMessagesData] = useState<Record<string, Message[]>>(MOCK_MESSAGES);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);

  // Manejador para seleccionar chat
  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setShowSettings(false); // Si selecciona un chat, cierra ajustes
    setShowDirectory(false); // Cierra directorio también

    // Marcar como leído si está seleccionado
    setChats(prev => prev.map(c =>
      c.id === chatId ? { ...c, unreadCount: 0 } : c
    ));
  };

  // Manejador para tomar chat no asignado
  const handleTakeChat = (chatId: string) => {
    setChats(prev => prev.map(c =>
      c.id === chatId ? { ...c, status: 'assigned', assignedTo: currentUserId } : c
    ));
  };

  // Manejador para enviar mensaje
  const handleSendMessage = (text: string) => {
    if (!selectedChatId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      chatId: selectedChatId,
      text,
      type: 'text',
      senderId: 'user',
      senderName: 'Asesor Actual',
      timestamp: Date.now()
    };

    // Actualizar mensajes
    setMessagesData(prev => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMessage]
    }));

    // Actualizar el lastMessage en la lista de chats
    setChats(prev => prev.map(c =>
      c.id === selectedChatId
        ? { ...c, lastMessage: text, lastMessageTimestamp: newMessage.timestamp }
        : c
    ));
  };

  const selectedChat = chats.find(c => c.id === selectedChatId) || null;
  const currentMessages = selectedChatId ? (messagesData[selectedChatId] || []) : [];

  return (
    <MaintenanceGate>
      <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950">
        {/* Eliminamos el Header global para dar una experiencia de pantalla completa 100vh tipo WhatsApp Web */}
        <main className="flex-1 flex overflow-hidden w-full mx-auto shadow-sm">
          {/* On mobile, hide sidebar if a chat or settings is open. Show it otherwise. */}
          <div className={`h-full flex-col w-full md:w-auto ${selectedChatId || showSettings || showDirectory ? 'hidden md:flex' : 'flex'}`}>
            <ChatSidebar
              chats={chats}
              selectedChatId={selectedChatId}
              onSelectChat={handleSelectChat}
              isAdmin={isAdmin}
              onOpenSettings={() => {
                setShowSettings(true);
                setShowDirectory(false);
                setSelectedChatId(null); // Deseleccionar chat al abrir ajustes
              }}
              onOpenDirectory={() => {
                setShowDirectory(true);
                setShowSettings(false);
                setSelectedChatId(null);
              }}
            />
          </div>

          {/* Panel Derecho: Settings, Directory o ChatArea */}
          {showSettings ? (
            <div className="flex-1 flex-col flex border-l border-gray-200 overflow-hidden">
              <SettingsLayout onClose={() => setShowSettings(false)} />
            </div>
          ) : showDirectory ? (
            <div className="flex-1 flex-col flex border-l border-gray-200 overflow-hidden">
              <DirectoryLayout onClose={() => setShowDirectory(false)} />
            </div>
          ) : (
            <div className={`flex-1 flex-col h-full overflow-hidden border-l border-gray-200 ${!selectedChatId ? 'hidden md:flex' : 'flex'}`}>
              <ChatArea
                chat={selectedChat}
                messages={currentMessages}
                onSendMessage={handleSendMessage}
                onTakeChat={handleTakeChat}
                onBack={() => setSelectedChatId(null)} // Botón de retroceso para móviles
              />
            </div>
          )}
        </main>
      </div>
    </MaintenanceGate>
  );
}
