'use client';

import { useState } from 'react';
import { Bot, Save, AlertCircle, Sparkles, Tag, FileText, Settings as SettingsIcon, Plus, X } from 'lucide-react';

type BotTab = 'prompt' | 'offers' | 'prices' | 'rules';

export function SettingsBot() {
  const [activeTab, setActiveTab] = useState<BotTab>('prompt');

  // Prompt State
  const [prompt, setPrompt] = useState('Eres un asistente virtual experto en materiales de construcción y diseño de interiores para la empresa DecoInnova. Tu objetivo es ayudar a los clientes a encontrar productos, responder preguntas frecuentes y capturar leads comerciales.');
  const [temperature, setTemperature] = useState(0.7);

  // Offers State
  const [offers, setOffers] = useState([
    { id: 1, title: '20% en Pisos de Cerámica', active: true },
    { id: 2, title: 'Envío gratis en compras mayores a $500', active: true }
  ]);
  const [newOffer, setNewOffer] = useState('');

  // Prices State
  const [priceContext, setPriceContext] = useState('Mencionar que los precios pueden variar. Ofrecer enviar un catálogo PDF si preguntan por más de 3 productos.');

  // Rules State
  const [autoAssign, setAutoAssign] = useState(true);

  const addOffer = () => {
    if (!newOffer.trim()) return;
    setOffers([...offers, { id: Date.now(), title: newOffer, active: true }]);
    setNewOffer('');
  };

  const removeOffer = (id: number) => {
    setOffers(offers.filter(o => o.id !== id));
  };

  const toggleOffer = (id: number) => {
    setOffers(offers.map(o => o.id === id ? { ...o, active: !o.active } : o));
  };

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
      <div className="p-6 border-b border-gray-100 flex justify-between items-start sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
            <Bot className="w-6 h-6 mr-2 text-indigo-500" />
            Configuración del Agente IA
          </h2>
          <p className="text-gray-500 text-sm max-w-xl">
            Ajusta el comportamiento, conocimiento base y reglas de negocio del bot.
          </p>
        </div>
        <button className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Save className="w-4 h-4 mr-2" />
          Guardar Cambios
        </button>
      </div>

      <div className="p-6 max-w-4xl">
        {/* Tabs internas */}
        <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl mb-8 border border-gray-200/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'prompt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Prompt & Tono
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'offers' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <Tag className="w-4 h-4 mr-2" />
            Ofertas del Mes
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'prices' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Lista de Precios
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'rules' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <SettingsIcon className="w-4 h-4 mr-2" />
            Reglas de Negocio
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* 1. Prompt */}
          {activeTab === 'prompt' && (
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  Prompt Maestro (Instrucciones Base)
                </label>
                <p className="text-xs text-gray-500 mb-2">Este es el contexto que el bot leerá antes de responder cualquier mensaje. Sé claro sobre el tono y las restricciones.</p>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-48 p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-y text-sm leading-relaxed text-gray-800"
                  placeholder="Escribe las instrucciones para el bot..."
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <label className="block text-sm font-semibold text-gray-700">
                  Creatividad (Temperatura: {temperature})
                </label>
                <p className="text-xs text-gray-500">Valores cercanos a 0 hacen al bot más estricto y factual. Valores cercanos a 1 lo hacen más creativo pero propenso a inventar información.</p>
                <input 
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Preciso</span>
                  <span>Balanceado</span>
                  <span>Creativo</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Offers */}
          {activeTab === 'offers' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                <h3 className="text-amber-800 font-medium flex items-center mb-2">
                  <Tag className="w-5 h-5 mr-2" />
                  Inyectar promociones al contexto
                </h3>
                <p className="text-sm text-amber-700/80">
                  Las ofertas activas se añadirán automáticamente al conocimiento del bot para que pueda ofrecerlas a los clientes cuando sea relevante.
                </p>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ej: 15% de descuento en Pinturas..."
                  value={newOffer}
                  onChange={(e) => setNewOffer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addOffer()}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                />
                <button
                  onClick={addOffer}
                  disabled={!newOffer.trim()}
                  className="flex items-center px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir Oferta
                </button>
              </div>

              <div className="space-y-3 mt-6">
                {offers.map(offer => (
                  <div key={offer.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${offer.active ? 'bg-white border-amber-200 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={offer.active}
                        onChange={() => toggleOffer(offer.id)}
                        className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer"
                      />
                      <span className={`text-sm font-medium ${offer.active ? 'text-gray-800' : 'text-gray-500 line-through'}`}>
                        {offer.title}
                      </span>
                    </div>
                    <button
                      onClick={() => removeOffer(offer.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {offers.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    No hay ofertas configuradas.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 3. Prices */}
          {activeTab === 'prices' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
                <h3 className="text-emerald-800 font-medium flex items-center mb-2">
                  <FileText className="w-5 h-5 mr-2" />
                  Gestión de Precios
                </h3>
                <p className="text-sm text-emerald-700/80">
                  Define cómo el bot debe manejar las consultas de precios. Puedes darle instrucciones específicas o enlazar un documento.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Instrucciones sobre precios
                </label>
                <textarea 
                  value={priceContext}
                  onChange={(e) => setPriceContext(e.target.value)}
                  className="w-full h-32 p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-y text-sm leading-relaxed text-gray-800"
                  placeholder="Ej: Todos los precios incluyen IVA. No dar precios de instalación, pedir que un asesor lo contacte..."
                />
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-white flex flex-col items-center justify-center text-center mt-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">Catálogo PDF / Base de Conocimiento</h4>
                <p className="text-sm text-gray-500 max-w-sm mb-4">
                  Sube un PDF o CSV con tus productos y precios para que el bot pueda consultarlo en tiempo real (Fase 2).
                </p>
                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-not-allowed opacity-50">
                  Subir Archivo
                </button>
              </div>
            </div>
          )}

          {/* 4. Rules */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-6">
                <h3 className="text-rose-800 font-medium flex items-center mb-2">
                  <SettingsIcon className="w-5 h-5 mr-2" />
                  Reglas de Escalamiento
                </h3>
                <p className="text-sm text-rose-700/80">
                  Define en qué momento el bot debe detenerse y transferir la conversación a un asesor humano.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <div className="flex items-center h-5">
                    <input
                      id="autoAssign"
                      type="checkbox"
                      checked={autoAssign}
                      onChange={(e) => setAutoAssign(e.target.checked)}
                      className="w-4 h-4 text-rose-600 bg-gray-100 border-gray-300 rounded focus:ring-rose-500 focus:ring-2"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="autoAssign" className="font-medium text-gray-900 cursor-pointer">Auto-escalar en caso de duda o frustración</label>
                    <p className="text-gray-500 mt-1">Si el bot no sabe la respuesta 2 veces seguidas o detecta lenguaje de frustración, pasará el estado del chat a "Sin asignar" para que aparezca en el Inbox general.</p>
                  </div>
                </div>

                <div className="flex items-start p-4 bg-white border border-gray-200 rounded-xl shadow-sm opacity-60">
                  <div className="flex items-center h-5">
                    <input type="checkbox" disabled className="w-4 h-4 rounded" />
                  </div>
                  <div className="ml-3 text-sm">
                    <label className="font-medium text-gray-900">Escalar si el cliente pide hablar con un humano (Próximamente)</label>
                    <p className="text-gray-500 mt-1">Detecta intenciones como "quiero hablar con un asesor" o "pásame con alguien".</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        
        {/* Informational alert */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mt-12">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Los cambios realizados aquí afectan a todos los nuevos chats que se generen a partir del momento de guardar. Los chats en curso mantendrán el contexto anterior por un lapso breve.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
