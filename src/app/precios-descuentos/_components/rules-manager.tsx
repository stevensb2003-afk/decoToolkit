"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useAuth, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Plus, Trash2, Edit, Percent, Truck, Settings2, MapPin, Banknote, Info, UserPlus, X, ShieldCheck, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OWNER_EMAIL = 'stevensb.2003@gmail.com';

export function RulesManager({ settings }: { settings: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [costPerKm, setCostPerKm] = useState(settings?.costPerKm || 0);
    const [savingSettings, setSavingSettings] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');

    const rulesQuery = useMemoFirebase(() => {
        return query(collection(firestore, 'pricing_rules'));
    }, [firestore]);

    const { data: rules, isLoading } = useCollection(rulesQuery);

    // Users Collection strictly for selecting admins
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), orderBy('displayName'));
    }, [firestore]);

    const { data: usersData, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

    useEffect(() => {
        if (settings?.costPerKm !== undefined) {
            setCostPerKm(settings.costPerKm);
        }
    }, [settings]);


    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await setDoc(doc(firestore, 'settings', 'pricing'), {
                ...settings,
                costPerKm: costPerKm,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            toast({ title: "Configuración guardada", description: "El costo por kilómetro ha sido actualizado." });
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron guardar los ajustes.", variant: "destructive" });
        } finally {
            setSavingSettings(false);
        }
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
            toast({ title: "Email Inválido", description: "Por favor, ingresa un correo válido.", variant: "destructive" });
            return;
        }
        setSavingSettings(true);
        try {
            const currentAdmins = settings?.delegatedAdmins || [];
            if (currentAdmins.includes(newAdminEmail)) {
                toast({ title: "Usuario Existente", description: "Este usuario ya es administrador." });
                setSavingSettings(false);
                return;
            }
            await setDoc(doc(firestore, 'settings', 'pricing'), {
                ...settings,
                delegatedAdmins: [...currentAdmins, newAdminEmail],
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setNewAdminEmail('');
            toast({ title: "Administrador Añadido", description: `Se ha concedido acceso a ${newAdminEmail}.` });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo añadir al administrador.", variant: "destructive" });
        } finally {
            setSavingSettings(false);
        }
    };

    const handleRemoveAdmin = async (email: string) => {
        if (!settings) return;
        setSavingSettings(true);
        try {
            const updatedAdmins = settings.delegatedAdmins.filter((e: string) => e !== email);
            await setDoc(doc(firestore, 'settings', 'pricing'), {
                ...settings,
                delegatedAdmins: updatedAdmins
            });
            toast({ title: "Acceso Revocado", description: `Se ha eliminado el acceso para ${email}.` });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo revocar el acceso.", variant: "destructive" });
        } finally {
            setSavingSettings(true);
        }
    };

    const handleToggleStatus = async (rule: any) => {
        try {
            await updateDoc(doc(firestore, 'pricing_rules', rule.id), {
                isActive: !rule.isActive
            });
            toast({
                title: rule.isActive ? "Regla Pausada" : "Regla Activada",
                description: `La regla "${rule.name}" ha sido ${rule.isActive ? 'pausada' : 'activada'}.`
            });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
        }
    };

    const handleSaveRule = async () => {
        if (!editingRule?.name) return;
        setSaving(true);
        try {
            const ruleToSave = {
                ...editingRule,
                updatedAt: new Date().toISOString()
            };

            if (editingRule.id) {
                await updateDoc(doc(firestore, 'pricing_rules', editingRule.id), ruleToSave);
            } else {
                await setDoc(doc(collection(firestore, 'pricing_rules')), ruleToSave);
            }

            setIsRuleDialogOpen(false);
            toast({ title: editingRule.id ? "Regla actualizada" : "Regla creada" });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo guardar la regla.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('¿Eliminar esta regla?')) return;
        try {
            await deleteDoc(doc(firestore, 'pricing_rules', id));
            toast({ title: "Regla eliminada" });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo eliminar la regla.", variant: "destructive" });
        }
    };

    const togglePaymentMethod = (method: string) => {
        const current = editingRule?.paymentMethods || [];
        let updated;
        if (method === 'all') {
            updated = current.includes('all') ? [] : ['all'];
        } else {
            updated = current.includes(method)
                ? current.filter((m: string) => m !== method)
                : [...current.filter((m: string) => m !== 'all'), method];
        }
        setEditingRule({ ...editingRule, paymentMethods: updated });
    };

    return (
        <div className="space-y-6">
            {/* Global Settings Card */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-primary" />
                        Configuración de Transporte
                    </CardTitle>
                    <CardDescription>
                        Define los valores base para los cálculos de envío.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-2 min-w-[200px]">
                            <Label htmlFor="costPerKm" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                                Costo Base por Kilómetro (₡)
                            </Label>
                            <div className="relative">
                                <Banknote className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="costPerKm"
                                    type="number"
                                    className="pl-9 h-10 border-primary/20 focus-visible:ring-primary shadow-sm"
                                    value={costPerKm || ''}
                                    onChange={e => setCostPerKm(parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleSaveSettings}
                            disabled={savingSettings || costPerKm === settings?.costPerKm}
                            className="h-10 px-6 shadow-md"
                        >
                            {savingSettings ? 'Guardando...' : 'Actualizar Global'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Rules Table Card */}
            <Card className="shadow-sm border-muted/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Percent className="h-6 w-6 text-primary" />
                            Reglas de Descuento
                        </CardTitle>
                        <CardDescription>
                            Automatiza beneficios por volumen de compra y cercanía.
                        </CardDescription>
                    </div>
                    <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setEditingRule({
                                name: '',
                                isActive: true,
                                transportBenefitType: 'none',
                                transportBenefitValue: 0,
                                amountCondition: 'min',
                                minAmount: 0,
                                maxAmount: 0,
                                distanceCondition: 'min',
                                minDistance: 0,
                                maxDistance: 0,
                                discountPercent: 0,
                                paymentMethods: ['all']
                            })} className="shadow-sm border-primary/20">
                                <Plus className="h-4 w-4 mr-2" />
                                Nueva Regla
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                            <DialogHeader className="border-b pb-4">
                                <DialogTitle className="text-2xl">{editingRule?.id ? 'Editar Regla' : 'Nueva Regla de Descuento'}</DialogTitle>
                                <DialogDescription>Configura los parámetros para que este beneficio se aplique automáticamente.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-6 md:grid-cols-2">
                                {/* Left Column: Identity and Product Discount */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="font-bold">Nombre descriptivo de la Regla</Label>
                                        <Input
                                            value={editingRule?.name ?? ''}
                                            onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                                            placeholder="Ej: Promo Verano / Envío Gratis GAM"
                                            className="h-11"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border bg-muted/20">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Dto. Productos (%)</Label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={editingRule?.discountPercent || ''}
                                                onChange={e => setEditingRule({ ...editingRule, discountPercent: parseFloat(e.target.value) || 0 })}
                                                className="h-10 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="flex flex-col justify-center items-center space-y-2 pt-2">
                                            <Label htmlFor="isActive" className="text-xs font-bold uppercase cursor-pointer">Estado</Label>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    id="isActive"
                                                    checked={editingRule?.isActive}
                                                    onCheckedChange={val => setEditingRule({ ...editingRule, isActive: val })}
                                                />
                                                <span className="text-sm font-medium">{editingRule?.isActive ? 'Activa' : 'Pausada'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Métodos de Pago Aplicables</Label>
                                        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="pm-all"
                                                    checked={editingRule?.paymentMethods?.includes('all')}
                                                    onCheckedChange={() => togglePaymentMethod('all')}
                                                />
                                                <Label htmlFor="pm-all" className="text-sm font-medium cursor-pointer">Cualquier Método</Label>
                                            </div>
                                            {['Efectivo', 'Transferencia', 'Tarjeta', 'Sinpe Movil'].map((pm) => (
                                                <div key={pm} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`pm-${pm}`}
                                                        checked={editingRule?.paymentMethods?.includes(pm)}
                                                        onCheckedChange={() => togglePaymentMethod(pm)}
                                                    />
                                                    <Label htmlFor={`pm-${pm}`} className="text-sm font-medium cursor-pointer">{pm}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Conditions and Shipping Benefit */}
                                <div className="space-y-6">
                                    {/* Sale Amount Condition */}
                                    <div className="space-y-4 rounded-xl border p-4 bg-blue-50/30">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label className="font-bold flex items-center gap-2">
                                                <Banknote className="h-4 w-4 text-primary" /> Venta
                                            </Label>
                                            <Select
                                                value={editingRule?.amountCondition || 'min'}
                                                onValueChange={(val: any) => setEditingRule({ ...editingRule, amountCondition: val })}
                                            >
                                                <SelectTrigger className="w-[130px] h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="min">Mínimo (&gt;=)</SelectItem>
                                                    <SelectItem value="max">Máximo (&lt;=)</SelectItem>
                                                    <SelectItem value="between">Entre (Rango)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">{editingRule?.amountCondition === 'max' ? 'Hacia abajo' : 'Desde'}</Label>
                                                <Input type="number" placeholder="0" className="h-9" value={editingRule?.minAmount || ''} onChange={e => setEditingRule({ ...editingRule, minAmount: parseFloat(e.target.value) || 0 })} />
                                            </div>
                                            {editingRule?.amountCondition === 'between' && (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
                                                    <Input type="number" placeholder="0" className="h-9" value={editingRule?.maxAmount || ''} onChange={e => setEditingRule({ ...editingRule, maxAmount: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Distance Condition */}
                                    <div className="space-y-4 rounded-xl border p-4 bg-orange-50/30">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label className="font-bold flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-orange-600" /> Distancia
                                            </Label>
                                            <Select
                                                value={editingRule?.distanceCondition || 'min'}
                                                onValueChange={(val: any) => setEditingRule({ ...editingRule, distanceCondition: val })}
                                            >
                                                <SelectTrigger className="w-[130px] h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="min">Mínima (km)</SelectItem>
                                                    <SelectItem value="max">Máxima (km)</SelectItem>
                                                    <SelectItem value="between">Rango (km)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">KM</Label>
                                                <Input type="number" placeholder="0" className="h-9" value={editingRule?.minDistance || ''} onChange={e => setEditingRule({ ...editingRule, minDistance: parseFloat(e.target.value) || 0 })} />
                                            </div>
                                            {editingRule?.distanceCondition === 'between' && (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
                                                    <Input type="number" placeholder="0" className="h-9" value={editingRule?.maxDistance || ''} onChange={e => setEditingRule({ ...editingRule, maxDistance: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Transport Benefit */}
                                    <div className="space-y-3 rounded-xl border p-4 bg-primary/5 border-primary/20">
                                        <h4 className="text-xs font-bold uppercase flex items-center gap-2 text-primary">
                                            <Truck className="h-4 w-4" /> Beneficio de Envío
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Tipo</Label>
                                                <Select
                                                    value={editingRule?.transportBenefitType}
                                                    onValueChange={(val: any) => setEditingRule({ ...editingRule, transportBenefitType: val })}
                                                >
                                                    <SelectTrigger className="h-9 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Sin Beneficio</SelectItem>
                                                        <SelectItem value="free">¡Envío Gratis!</SelectItem>
                                                        <SelectItem value="fixed">Tarifa Plana</SelectItem>
                                                        <SelectItem value="percentage">Descuento (%)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {editingRule?.transportBenefitType !== 'none' && editingRule?.transportBenefitType !== 'free' && (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase">{editingRule?.transportBenefitType === 'fixed' ? 'Valor (₡)' : 'Dto (%)'}</Label>
                                                    <Input type="number" placeholder="0" className="h-9" value={editingRule?.transportBenefitValue || ''} onChange={e => setEditingRule({ ...editingRule, transportBenefitValue: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="border-t pt-6">
                                <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSaveRule} disabled={saving} className="px-8 shadow-md">
                                    {saving ? 'Guardando...' : editingRule?.id ? 'Guardar Cambios' : 'Activar Regla'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent className="px-0 md:px-6">
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-pulse border-2 border-dashed rounded-xl">
                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                Cargando reglas de negocio...
                            </div>
                        ) : rules?.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                No existen reglas de descuento configuradas.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {rules?.map((rule: any) => (
                                    <div
                                        key={rule.id}
                                        className={`group relative flex flex-col rounded-xl border-2 transition-all duration-200 overflow-hidden ${!rule.isActive
                                            ? 'bg-slate-50/50 border-slate-200/60 grayscale-[0.3]'
                                            : 'bg-white border-blue-50 hover:border-blue-100 hover:shadow-md'
                                            }`}
                                    >
                                        {/* Card Header: Name & Actions */}
                                        <div className={`flex items-center justify-between px-5 py-3 border-b ${!rule.isActive ? 'bg-slate-100/50' : 'bg-blue-50/30'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-lg ${!rule.isActive ? 'bg-slate-200 text-slate-500' : 'bg-blue-500 text-white'}`}>
                                                    <Percent className="h-4 w-4" />
                                                </div>
                                                <h3 className={`font-bold text-base ${!rule.isActive ? 'text-slate-500' : 'text-slate-900'}`}>{rule.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => { setEditingRule(rule); setIsRuleDialogOpen(true); }}
                                                    className="h-8 w-8 hover:bg-blue-100 text-slate-600"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Card Body: Info Columns */}
                                        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-6">
                                            {/* Column 1: Payment Methods */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Pagos Aceptados</Label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {rule.paymentMethods?.includes('all') ? (
                                                        <Badge variant="outline" className={`text-[10px] font-medium ${!rule.isActive ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                            Todos los pagos
                                                        </Badge>
                                                    ) : (
                                                        rule.paymentMethods?.map((pm: string) => (
                                                            <Badge key={pm} variant="outline" className={`text-[10px] font-medium ${!rule.isActive ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                                {pm}
                                                            </Badge>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Column 2: Conditions */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Condiciones</Label>
                                                <div className="space-y-1.5">
                                                    <div className={`flex items-center gap-2 text-xs font-medium ${!rule.isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        <Banknote className="h-3.5 w-3.5 text-slate-400" />
                                                        {rule.amountCondition === 'between' ? `₡${rule.minAmount.toLocaleString()} - ₡${rule.maxAmount?.toLocaleString()}` :
                                                            rule.amountCondition === 'max' ? `Hasta ₡${rule.minAmount.toLocaleString()}` :
                                                                `Desde ₡${rule.minAmount.toLocaleString()}`}
                                                    </div>
                                                    <div className={`flex items-center gap-2 text-xs font-medium ${!rule.isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                        {rule.distanceCondition === 'between' ? `${rule.minDistance} - ${rule.maxDistance} km` :
                                                            rule.distanceCondition === 'max' ? `<= ${rule.minDistance} km` :
                                                                `>= ${rule.minDistance} km`}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 3: Benefits */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Beneficios</Label>
                                                <div className="space-y-2">
                                                    <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${!rule.isActive ? 'bg-slate-200 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                                                        {rule.discountPercent}% de descuento
                                                    </div>
                                                    {rule.transportBenefitType !== 'none' && (
                                                        <div className={`flex items-center gap-2 text-xs font-medium ${!rule.isActive ? 'text-slate-400' : 'text-blue-600'}`}>
                                                            <Truck className="h-3.5 w-3.5" />
                                                            {rule.transportBenefitType === 'free' ? 'Envío GRATIS' :
                                                                rule.transportBenefitType === 'percentage' ? `-${rule.transportBenefitValue}% en Envío` :
                                                                    `Monto Fijo: ₡${rule.transportBenefitValue?.toLocaleString()}`}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Column 4: Status Switch */}
                                            <div className="flex flex-col md:items-end justify-center md:border-l md:pl-6 border-slate-100">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Estado</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold ${!rule.isActive ? 'text-slate-400' : 'text-green-600'}`}>
                                                            {rule.isActive ? 'ACTIVA' : 'INACTIVA'}
                                                        </span>
                                                        <Switch
                                                            checked={rule.isActive}
                                                            onCheckedChange={() => handleToggleStatus(rule)}
                                                            className="data-[state=checked]:bg-green-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Hint Card */}
            <div className="flex items-center gap-2 p-4 bg-muted/40 rounded-lg border border-dashed text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <p>Las reglas se evalúan de arriba hacia abajo. En caso de cumplir múltiples reglas, se aplicará el descuento más beneficioso en productos y transporte.</p>
            </div>

            {/* Administradores Delegados (New Restored Design) */}
            {user?.email === OWNER_EMAIL && (
                <div className="bg-[#f0f7ff] border border-blue-100 rounded-lg p-6 space-y-6">
                    <div className="flex flex-col mb-1">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-[#0f172a]">
                            <ShieldCheck className="h-5 w-5 text-blue-500" />
                            Admins Delegados
                        </h3>
                        <p className="text-sm text-slate-500">Usuarios con permiso para gestionar estas reglas.</p>
                    </div>

                    <div className="flex gap-3">
                        <Select value={newAdminEmail} onValueChange={setNewAdminEmail}>
                            <SelectTrigger className="flex-1 h-10 bg-white border-slate-200">
                                <SelectValue placeholder="Seleccionar usuario..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {isUsersLoading ? (
                                    <SelectItem value="loading" disabled>Cargando usuarios...</SelectItem>
                                ) : (
                                    usersData?.map((u) => (
                                        <SelectItem key={u.email} value={u.email}>
                                            <div className="flex flex-col items-start gap-1 py-1">
                                                <span className="font-medium leading-none">{u.displayName || 'Sin nombre'}</span>
                                                <span className="text-xs text-muted-foreground">{u.email}</span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={handleAddAdmin}
                            disabled={savingSettings || !newAdminEmail}
                            className="h-10 px-6 bg-[#93c5fd] hover:bg-[#60a5fa] text-[#1e3a8a] border-none shadow-sm transition-colors"
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Agregar
                        </Button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {settings?.delegatedAdmins?.map((email: string) => {
                            const adminUser = usersData?.find(u => u.email === email);
                            return (
                                <div key={email} className="flex items-center justify-between p-4 rounded-md border border-slate-200 bg-white shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900">{adminUser?.displayName || 'Usuario Externo'}</span>
                                        <span className="text-sm text-slate-500">{email}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveAdmin(email)}
                                        className="h-auto p-0 text-red-500 hover:text-red-700 hover:bg-transparent font-medium"
                                    >
                                        Revocar
                                    </Button>
                                </div>
                            );
                        })}

                        {!settings?.delegatedAdmins?.length && (
                            <div className="text-sm text-center py-4 text-slate-500 border border-dashed rounded-md bg-white/50">
                                No hay administradores delegados. Selecciona un usuario para otorgarle acceso.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
