'use client';

import { useState } from 'react';
import { Tag as TagIcon, Plus, X, Save } from 'lucide-react';
import { MOCK_TAGS, Tag } from '@/lib/types/crm';

const PREDEFINED_COLORS = [
  'bg-slate-100 text-slate-800 border-slate-200',
  'bg-red-100 text-red-800 border-red-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-rose-100 text-rose-800 border-rose-200',
];

export function SettingsTags() {
  const [tags, setTags] = useState<Tag[]>(MOCK_TAGS.map(t => ({ ...t, color: t.color + (t.color.includes('border') ? '' : ' border-transparent') })));
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PREDEFINED_COLORS[11]); // Default Blue

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      name: newTagName,
      color: newTagColor,
    };
    setTags([...tags, newTag]);
    setNewTagName('');
  };

  const handleRemoveTag = (id: string) => {
    setTags(tags.filter(t => t.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
      <div className="p-6 border-b border-gray-100 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
            <TagIcon className="w-6 h-6 mr-2 text-pink-500" />
            Etiquetas del CRM
          </h2>
          <p className="text-gray-500 text-sm max-w-xl">
            Gestiona las etiquetas predefinidas para clasificar a tus clientes en el directorio.
          </p>
        </div>
        <button className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Save className="w-4 h-4 mr-2" />
          Guardar Cambios
        </button>
      </div>

      <div className="p-6 max-w-4xl">
        {/* Nueva etiqueta */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8">
          <h3 className="font-semibold text-gray-800 mb-4">Crear Nueva Etiqueta</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Nombre de la etiqueta..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
            <div className="flex-1 flex flex-wrap gap-2 items-center">
              {PREDEFINED_COLORS.map((colorClass, idx) => (
                <button
                  key={idx}
                  onClick={() => setNewTagColor(colorClass)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    newTagColor === colorClass ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-110'
                  } ${colorClass.split(' ')[0]}`} // Use just the bg- color for the dot
                  title={colorClass}
                />
              ))}
            </div>
            <button
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
              className="flex items-center justify-center px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors shadow-sm h-[42px]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Añadir
            </button>
          </div>
          
          {/* Preview */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            Vista previa: 
            <span className={`px-3 py-1 rounded-md text-xs font-medium border ${newTagColor}`}>
              {newTagName || 'Nombre de etiqueta'}
            </span>
          </div>
        </div>

        {/* Lista de etiquetas */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-4">Etiquetas Actuales</h3>
          <div className="flex flex-wrap gap-3">
            {tags.map(tag => (
              <div key={tag.id} className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all group border ${tag.color}`}>
                {tag.name}
                <button 
                  onClick={() => handleRemoveTag(tag.id)}
                  className="ml-2 p-0.5 rounded-full hover:bg-black/10 transition-colors opacity-60 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-gray-500 text-sm">No hay etiquetas creadas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
