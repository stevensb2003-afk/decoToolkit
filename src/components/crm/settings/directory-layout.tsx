'use client';

import { useState } from 'react';
import { Search, X, Users, Mail, Phone, ExternalLink, Filter } from 'lucide-react';
import { MOCK_CLIENTS, MOCK_TAGS } from '@/lib/types/crm';

interface DirectoryLayoutProps {
  onClose: () => void;
}

export function DirectoryLayout({ onClose }: DirectoryLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');

  const filteredClients = MOCK_CLIENTS.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          client.phone.includes(searchQuery) ||
                          (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = selectedTag === 'all' || client.tagIds.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full animate-in fade-in slide-in-from-right-4 duration-300 relative z-10">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={onClose}
            className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors md:hidden"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-xl mr-4">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Directorio de Clientes</h2>
            <p className="text-sm text-gray-500 hidden sm:block">Gestiona contactos, correos y etiquetas</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors hidden md:block"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 md:p-6 bg-white border-b border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm text-sm"
            />
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          </div>
          
          <div className="relative min-w-[200px]">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm text-sm appearance-none cursor-pointer"
            >
              <option value="all">Todas las etiquetas</option>
              {MOCK_TAGS.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Client Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClients.map(client => (
            <div key={client.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg mr-3 shadow-inner">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{client.name}</h3>
                    <span className="text-xs px-2 py-0.5 mt-1 inline-block bg-gray-100 text-gray-600 rounded-full font-medium capitalize border border-gray-200">
                      {client.source}
                    </span>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  {client.phone}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  {client.email ? (
                    client.email
                  ) : (
                    <button className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs font-medium">
                      + Vincular Correo
                    </button>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                {client.tagIds.map(tagId => {
                  const tag = MOCK_TAGS.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <span key={tag.id} className={`text-xs px-2 py-1 rounded-md font-medium border border-transparent ${tag.color}`}>
                      {tag.name}
                    </span>
                  );
                })}
                <button className="text-xs px-2 py-1 rounded-md font-medium text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
                  + Etiqueta
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {filteredClients.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Users className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No se encontraron clientes</p>
            <p className="text-sm">Intenta con otros filtros de búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
