'use client';

import { useState } from 'react';
import { Search, Shield, User as UserIcon, Check } from 'lucide-react';

// Mock users data
const MOCK_USERS = [
  { id: 'u1', name: 'Admin Usuario', email: 'admin@deco.com', role: 'admin', hasAccess: true },
  { id: 'u2', name: 'Asesor Ventas 1', email: 'ventas1@deco.com', role: 'agent', hasAccess: true },
  { id: 'u3', name: 'Asesor Ventas 2', email: 'ventas2@deco.com', role: 'agent', hasAccess: false },
];

export function SettingsUsers() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [search, setSearch] = useState('');

  const toggleAccess = (userId: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, hasAccess: !u.hasAccess } : u));
  };

  const toggleRole = (userId: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, role: u.role === 'admin' ? 'agent' : 'admin' } : u));
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Gestión de Usuarios</h2>
        <p className="text-gray-500 text-sm">Controla quién tiene acceso al CRM y asigna roles de administrador.</p>
      </div>

      <div className="p-6">
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
          />
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="p-4">Usuario</th>
                <th className="p-4 text-center">Acceso CRM</th>
                <th className="p-4 text-center">Admin</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold mr-3 flex-shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleAccess(user.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${user.hasAccess ? 'bg-orange-500' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.hasAccess ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="p-4 text-center">
                     <button
                      onClick={() => toggleRole(user.id)}
                      disabled={!user.hasAccess}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${user.role === 'admin' ? 'bg-indigo-500' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.role === 'admin' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
