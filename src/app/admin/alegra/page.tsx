'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RotateCcw, Filter, CheckCircle2, AlertCircle, ShoppingCart, Users, Receipt, Landmark, ArrowLeft } from 'lucide-react';
import { AlegraInvoice, AlegraItem, AlegraContact } from '@/lib/alegra';
import { syncInvoiceToCash } from '@/lib/alegra-actions';
import { useUser } from '@/firebase';
import { getBranches, getBranchRegisters } from '@/lib/cash-control';
import { Branch, CashRegister } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function AlegraDashboard() {
    const { user } = useUser();
    const { toast } = useToast();
    const [invoices, setInvoices] = useState<AlegraInvoice[]>([]);
    const [items, setItems] = useState<AlegraItem[]>([]);
    const [contacts, setContacts] = useState<AlegraContact[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [registers, setRegisters] = useState<CashRegister[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedCaja, setSelectedCaja] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'cash'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async (type: 'invoices' | 'items' | 'contacts') => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/alegra?type=${type}`);
            if (!response.ok) throw new Error(`Error al obtener ${type === 'invoices' ? 'facturas' : type === 'items' ? 'productos' : 'contactos'}`);
            const data = await response.json();

            if (type === 'invoices') setInvoices(data);
            if (type === 'items') setItems(data);
            if (type === 'contacts') setContacts(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadSelectionData = async () => {
        try {
            const b = await getBranches();
            setBranches(b);
            if (b.length > 0) {
                setSelectedBranch(b[0].id);
                const r = await getBranchRegisters(b[0].id);
                setRegisters(r);
                if (r.length > 0) setSelectedCaja(r[0].id);
            }
        } catch (err) {
            console.error("Error loading branch data", err);
        }
    };

    useEffect(() => {
        fetchData('invoices');
        fetchData('items');
        fetchData('contacts');
        loadSelectionData();
    }, []);

    useEffect(() => {
        if (selectedBranch) {
            getBranchRegisters(selectedBranch).then(setRegisters);
        }
    }, [selectedBranch]);

    const handleSync = async (invoice: AlegraInvoice) => {
        if (!user || !selectedBranch || !selectedCaja) {
            toast({
                title: "Configuración Requerida",
                description: "Por favor selecciona una sucursal y caja primero.",
                variant: "destructive"
            });
            return;
        }

        setSyncingId(invoice.id);
        try {
            const result = await syncInvoiceToCash(
                invoice.id,
                selectedBranch,
                selectedCaja,
                user.uid,
                user.displayName || user.email || 'Unknown'
            );

            if (result.success) {
                toast({
                    title: "Éxito",
                    description: result.message,
                });
            } else {
                toast({
                    title: "Error de Sincronización",
                    description: result.error,
                    variant: "destructive"
                });
            }
        } catch (err: any) {
            toast({
                title: "Error Inesperado",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setSyncingId(null);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.client.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (filterType === 'cash') {
            // Logic for cash sales: usually status is open and totalPaid > 0 or has a cash payment
            return matchesSearch && (inv.totalPaid > 0);
        }
        return matchesSearch;
    });

    return (
        <div className="p-8 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Ir al Inicio
                        </Button>
                    </Link>
                    <Link href="/admin">
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900">
                            <Landmark className="w-4 h-4 mr-2" />
                            Panel Administrativo
                        </Button>
                    </Link>
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Integración con Alegra</h1>
                        <p className="text-slate-500 mt-1">Visualiza y sincroniza tus datos de negocio desde Alegra.</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Sucursal</span>
                                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                    <SelectTrigger className="w-40 h-8 border-none bg-slate-50">
                                        <SelectValue placeholder="Seleccionar Sucursal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Caja</span>
                                <Select value={selectedCaja} onValueChange={setSelectedCaja}>
                                    <SelectTrigger className="w-40 h-8 border-none bg-slate-50">
                                        <SelectValue placeholder="Seleccionar Caja" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => {
                                fetchData('invoices');
                                fetchData('items');
                                fetchData('contacts');
                            }} disabled={loading}>
                                <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Actualizar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            <Tabs defaultValue="invoices" className="w-full">
                <TabsList className="bg-white border border-slate-200 p-1 rounded-xl mb-6 shadow-sm overflow-x-auto h-auto">
                    <TabsTrigger value="invoices" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                        <Receipt className="w-4 h-4 mr-2" /> Facturas
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                        <Users className="w-4 h-4 mr-2" /> Contactos
                    </TabsTrigger>
                    <TabsTrigger value="items" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                        <ShoppingCart className="w-4 h-4 mr-2" /> Productos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="invoices" className="mt-0">
                    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                        <CardHeader className="bg-white border-b border-slate-100 flex-col sm:flex-row items-center gap-4 justify-between pb-4">
                            <div className="flex items-center gap-4 w-full sm:flex-1">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Buscar número de factura o cliente..."
                                        className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-lg focus:ring-blue-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <Button
                                        variant={filterType === 'all' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className={`rounded-md px-4 ${filterType === 'all' ? 'bg-white shadow-sm' : ''}`}
                                        onClick={() => setFilterType('all')}
                                    >
                                        Todos
                                    </Button>
                                    <Button
                                        variant={filterType === 'cash' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className={`rounded-md px-4 ${filterType === 'cash' ? 'bg-white shadow-sm' : ''}`}
                                        onClick={() => setFilterType('cash')}
                                    >
                                        Solo Efectivo
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 text-slate-500 font-medium text-sm">
                                            <th className="px-6 py-4">Número</th>
                                            <th className="px-6 py-4">Cliente</th>
                                            <th className="px-6 py-4">Fecha</th>
                                            <th className="px-6 py-4">Estado</th>
                                            <th className="px-6 py-4">Total</th>
                                            <th className="px-6 py-4 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading && invoices.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-20 text-slate-400">Cargando datos...</td></tr>
                                        ) : filteredInvoices.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-20 text-slate-400">No se encontraron facturas.</td></tr>
                                        ) : filteredInvoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4 font-semibold text-blue-600">{inv.number}</td>
                                                <td className="px-6 py-4 text-slate-700 capitalize">{inv.client.name.toLowerCase()}</td>
                                                <td className="px-6 py-4 text-slate-600 font-mono text-sm">{inv.date}</td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={inv.status === 'open' ? 'secondary' : 'default'} className="rounded-full px-3 py-1 text-xs font-semibold">
                                                        {inv.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-900">₡{inv.total.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className={`text-emerald-600 hover:text-emerald-700 border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100/50 transition-all font-semibold ${syncingId === inv.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        onClick={() => handleSync(inv)}
                                                        disabled={syncingId === inv.id}
                                                    >
                                                        {syncingId === inv.id ? (
                                                            <RotateCcw className="w-3 h-3 animate-spin mr-1" />
                                                        ) : (
                                                            <Landmark className="w-3 h-3 mr-1" />
                                                        )}
                                                        Sincronizar a Caja
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="contacts">
                    <Card className="border-none shadow-md rounded-2xl overflow-hidden p-10 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {contacts.map(c => (
                                <div key={c.id} className="p-4 border border-slate-100 rounded-xl hover:shadow-sm transition-all hover:border-blue-100 bg-slate-50/30">
                                    <h3 className="font-bold text-slate-800">{c.name}</h3>
                                    <p className="text-sm text-slate-500 mt-1">{c.identification || 'No ID'}</p>
                                    <div className="flex gap-2 mt-3">
                                        {c.type.map(t => <Badge key={t} variant="secondary" className="capitalize text-[10px]">{t === 'client' ? 'cliente' : t === 'provider' ? 'proveedor' : t}</Badge>)}
                                    </div>
                                </div>
                            ))}
                            {contacts.length === 0 && <p className="col-span-full text-center text-slate-400 py-10">No se encontraron contactos.</p>}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="items">
                    <Card className="border-none shadow-md rounded-2xl overflow-hidden p-10 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {items.map(i => (
                                <div key={i.id} className="p-4 border border-slate-100 rounded-xl hover:shadow-sm transition-all hover:border-blue-100 bg-slate-50/30">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-slate-800 line-clamp-1">{i.name}</h3>
                                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100">₡{i.price.toLocaleString()}</Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{i.description || 'Sin descripción disponible'}</p>
                                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                                        <span className="text-[10px] text-slate-400 font-mono">ID: {i.id}</span>
                                        <Badge variant="outline" className="text-[10px] uppercase">{i.status === 'active' ? 'activo' : i.status}</Badge>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && <p className="col-span-full text-center text-slate-400 py-10">No se encontraron productos.</p>}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
