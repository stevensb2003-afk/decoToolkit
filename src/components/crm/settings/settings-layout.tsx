'use client';

import { useState } from 'react';
import { ArrowLeft, Users, Bot, MessageSquare, Tag as TagIcon } from 'lucide-react';
import { SettingsUsers } from './settings-users';
import { SettingsBot } from './settings-bot';
import { SettingsTags } from './settings-tags';

type SettingsTab = 'users' | 'bot' | 'tags' | 'quick-replies';

interface SettingsLayoutProps {
  onClose: () => void;
}

export function SettingsLayout({ onClose }: SettingsLayoutProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('bot');

  return (
    <div className="flex flex-col h-full bg-white md:flex-row">
      {/* Settings Sidebar */}
      <div className="w-full md:w-64 border-r border-gray-200 bg-gray-50/50 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center">
          <button 
            onClick={onClose}
            className="mr-3 p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">Ajustes CRM</h2>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('bot')}
            className={`flex items-center gap-3 w-full p-3 text-left rounded-xl font-medium transition-colors ${
              activeTab === 'bot' 
                ? 'bg-white shadow-sm border border-gray-200 text-orange-600' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
            }`}
          >
            <Bot className="w-5 h-5" />
            Agente AI
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-3 w-full p-3 text-left rounded-xl font-medium transition-colors ${
              activeTab === 'users' 
                ? 'bg-white shadow-sm border border-gray-200 text-orange-600' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
            }`}
          >
            <Users className="w-5 h-5" />
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-3 w-full p-3 text-left rounded-xl font-medium transition-colors ${
              activeTab === 'tags' 
                ? 'bg-white shadow-sm border border-gray-200 text-orange-600' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
            }`}
          >
            <TagIcon className="w-5 h-5" />
            Etiquetas
          </button>
          <button
            onClick={() => setActiveTab('quick-replies')}
            className={`flex items-center gap-3 w-full p-3 text-left rounded-xl font-medium transition-colors ${
              activeTab === 'quick-replies' 
                ? 'bg-white shadow-sm border border-gray-200 text-orange-600' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            Respuestas Rápidas
          </button>
        </div>
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="max-w-4xl mx-auto h-full">
          {activeTab === 'bot' && <SettingsBot />}
          {activeTab === 'users' && <SettingsUsers />}
          {activeTab === 'tags' && <SettingsTags />}
          {activeTab === 'quick-replies' && (
            <div className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Respuestas Rápidas</h3>
              <p className="text-gray-500 max-w-sm">
                Configura atajos de teclado para respuestas comunes. Esta funcionalidad estará disponible en la Fase 2.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
