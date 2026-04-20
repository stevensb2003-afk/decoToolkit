"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc } from "@/firebase";
import { UserProfile } from "@/lib/types";
import { doc } from "firebase/firestore";
import { Header } from "@/components/layout/header";
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getTransactionsByDateRange, getBranches, getBranchRegisters } from "@/lib/cash-control";
import { CashTransaction, Branch, CashRegister } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
    Filter,
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
    Calendar,
    Wallet
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type DateRangePreset = '1w' | '2w' | '1m' | '3m' | '6m' | '1y' | 'custom';
type TxFilterType = 'all' | 'income' | 'expense';

function ReportsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialBranchId = searchParams.get('branchId');
    const initialCajaId = searchParams.get('cajaId');
    const { toast } = useToast();

    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

    const [preset, setPreset] = useState<DateRangePreset>('1w');
    const [startDate, setStartDate] = useState<string>(format(subWeeks(new Date(), 1), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

    const [filterType, setFilterType] = useState<TxFilterType>('all');

    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasQueried, setHasQueried] = useState(false);

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || "");
    const [cajas, setCajas] = useState<CashRegister[]>([]);
    const [selectedCajaId, setSelectedCajaId] = useState<string>(initialCajaId || "");

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    useEffect(() => {
        if (!isProfileLoading && profile && !isUserLoading && user) {
            const allowedModules = profile.permissions?.allowedModules || [];
            const isAdmin = profile.isAdmin || false;
            if (!isAdmin && !allowedModules.includes('caja')) {
                router.push('/');
            }
        }
    }, [isProfileLoading, profile, isUserLoading, user, router]);

    useEffect(() => {
        const loadBranches = async () => {
            if (!user || isProfileLoading || !profile) return;
            try {
                const fetchedBranches = await getBranches();
                const accessibleBranches = profile.isAdmin
                    ? fetchedBranches
                    : fetchedBranches.filter(b => b.assignedAdmins?.includes(user.uid));
                
                setBranches(accessibleBranches);
                
                if (!selectedBranchId && accessibleBranches.length > 0) {
                    const defaultBranch = accessibleBranches.find(b => b.name.toLowerCase() === 'uruca') || accessibleBranches[0];
                    setSelectedBranchId(defaultBranch.id);
                }
            } catch (error) {
                console.error("Error fetching branches:", error);
            }
        };
        loadBranches();
    }, [user, profile, isProfileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const loadCajas = async () => {
            if (!selectedBranchId) {
                setCajas([]);
                if (!initialCajaId) setSelectedCajaId("");
                return;
            }
            try {
                const fetchedCajas = await getBranchRegisters(selectedBranchId);
                setCajas(fetchedCajas);
                
                if (fetchedCajas.length > 0) {
                    const isValidCaja = fetchedCajas.some(c => c.id === selectedCajaId);
                    if (!isValidCaja) {
                         const mainCaja = fetchedCajas.find(c => c.name.toLowerCase() === 'principal') || fetchedCajas[0];
                         setSelectedCajaId(mainCaja.id);
                    }
                } else {
                    setSelectedCajaId("");
                }
            } catch (error) {
                console.error("Error fetching cajas:", error);
            }
        };
        loadCajas();
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePresetChange = (val: DateRangePreset) => {
        setPreset(val);
        const end = new Date();
        let start = new Date();

        switch (val) {
            case '1w': start = subWeeks(end, 1); break;
            case '2w': start = subWeeks(end, 2); break;
            case '1m': start = subMonths(end, 1); break;
            case '3m': start = subMonths(end, 3); break;
            case '6m': start = subMonths(end, 6); break;
            case '1y': start = subMonths(end, 12); break;
            case 'custom': return; // Leave start/end as is
        }

        setStartDate(format(start, "yyyy-MM-dd"));
        setEndDate(format(end, "yyyy-MM-dd"));
    };

    const handleGenerate = async () => {
        if (!selectedBranchId || !selectedCajaId) {
            toast({ title: "Error", description: "Selecciona una sucursal y una caja.", variant: "destructive" });
            return;
        }

        const start = startOfDay(new Date(`${startDate}T00:00:00`));
        const end = endOfDay(new Date(`${endDate}T00:00:00`));

        if (start > end) {
            toast({ title: "Error", description: "La fecha de inicio no puede ser mayor a la fecha de fin.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const data = await getTransactionsByDateRange(selectedBranchId, selectedCajaId, start, end);
            setTransactions(data);
            setHasQueried(true);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo generar el reporte.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (filterType === 'all') return true;
            return t.type === filterType;
        });
    }, [transactions, filterType]);

    const stats = useMemo(() => {
        let ingresos = 0;
        let egresos = 0;
        transactions.forEach(t => {
            if (t.type === 'income') ingresos += t.amount;
            else if (t.type === 'expense') egresos += t.amount;
        });

        return { ingresos, egresos, balance: ingresos - egresos };
    }, [transactions]);

    const getCategoryLabel = (cat: string) => {
        const labels: Record<string, string> = {
            venta: "Ingreso por Venta",
            aporte: "Aporte Manual",
            gasto: "Gasto General",
            pago_proveedor: "Pago a Proveedor",
            nomina: "Nómina",
            corte_parcial: "Retiro Parcial"
        };
        return labels[cat] || cat;
    };

    if (isUserLoading || isProfileLoading) {
        return <div>Cargando...</div>;
    }

    return (
        <div className="min-h-screen bg-muted/20 flex flex-col">
            <Header />

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">

                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Filter className="text-primary w-6 h-6" /> Reportes de Movimientos
                            </h1>
                            <p className="text-sm text-muted-foreground">Analiza el historial completo de tu flujo de caja</p>
                        </div>
                    </div>
                </div>

                {/* Filters Section */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5" /> Selector de Temporalidad
                        </CardTitle>
                        <CardDescription>Escoge el rango de fechas que deseas analizar</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                            <div className="space-y-2">
                                <Label>Sucursal</Label>
                                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches.map(b => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Caja</Label>
                                <Select value={selectedCajaId} onValueChange={setSelectedCajaId} disabled={!selectedBranchId || cajas.length === 0}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cajas.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Rango de Fecha</Label>
                                <Select value={preset} onValueChange={(val: DateRangePreset) => handlePresetChange(val)}>
                                    <SelectTrigger className="text-left">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1w">Última Semana</SelectItem>
                                        <SelectItem value="2w">Últimas 2 Semanas</SelectItem>
                                        <SelectItem value="1m">Último Mes</SelectItem>
                                        <SelectItem value="3m">Últimos 3 Meses</SelectItem>
                                        <SelectItem value="6m">Últimos 6 Meses</SelectItem>
                                        <SelectItem value="1y">1 Año</SelectItem>
                                        <SelectItem value="custom">Personalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Fecha de Inicio</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setPreset('custom');
                                    }}
                                    disabled={preset !== 'custom'}
                                    className="w-full"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Fecha de Fin</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setPreset('custom');
                                    }}
                                    disabled={preset !== 'custom'}
                                    className="w-full"
                                />
                            </div>

                            <div className="flex items-end">
                                <Button
                                    className="w-full"
                                    onClick={handleGenerate}
                                    disabled={isLoading || !selectedBranchId || !selectedCajaId}
                                >
                                    {isLoading ? 'Generando...' : 'Buscar'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Section */}
                {hasQueried && (
                    <div className="space-y-6">

                        {/* Highlights */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Card>
                                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm border-b pb-1 font-medium w-full text-muted-foreground">Total Ingresos</p>
                                    <p className="text-2xl font-bold font-mono text-emerald-600">{formatCurrency(stats.ingresos)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                                    <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full">
                                        <TrendingDown className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm border-b pb-1 font-medium w-full text-muted-foreground">Total Egresos</p>
                                    <p className="text-2xl font-bold font-mono text-rose-600">{formatCurrency(stats.egresos)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                                    <div className="p-3 bg-primary/10 text-primary rounded-full">
                                        <Wallet className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm border-b pb-1 font-medium w-full text-muted-foreground">Balance Neto</p>
                                    <p className={stats.balance >= 0 ? "text-2xl font-bold font-mono text-emerald-600" : "text-2xl font-bold font-mono text-rose-600"}>
                                        {formatCurrency(stats.balance)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Table */}
                        <Card>
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4">
                                <CardTitle className="text-lg">Detalle de Transacciones</CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={filterType === 'all' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterType('all')}
                                    >
                                        Todos
                                    </Button>
                                    <Button
                                        variant={filterType === 'income' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterType('income')}
                                        className={filterType === 'income' ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                                    >
                                        Ingresos
                                    </Button>
                                    <Button
                                        variant={filterType === 'expense' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterType('expense')}
                                        className={filterType === 'expense' ? "bg-rose-600 hover:bg-rose-700" : ""}
                                    >
                                        Egresos
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredTransactions.length === 0 ? (
                                    <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                        <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p>No se encontraron movimientos en este período.</p>
                                    </div>
                                ) : (
                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Tipo</TableHead>
                                                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                                                    <TableHead className="max-w-[150px] md:max-w-xs">Descripción</TableHead>
                                                    <TableHead>Usuario</TableHead>
                                                    <TableHead className="text-right">Monto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredTransactions.map(tx => {
                                                    const date = tx.createdAt ? ((tx.createdAt as any).toDate ? (tx.createdAt as any).toDate() : new Date(tx.createdAt as any)) : new Date();
                                                    return (
                                                        <TableRow key={tx.id}>
                                                            <TableCell className="whitespace-nowrap">
                                                                <div className="font-medium text-sm">{format(date, "dd MMM yyyy", { locale: es })}</div>
                                                                <div className="text-xs text-muted-foreground">{format(date, "HH:mm")}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {tx.type === 'income' ? (
                                                                    <div className="flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded w-fit text-xs font-medium">
                                                                        <TrendingUp className="w-3 h-3" /> Ingreso
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 text-rose-600 bg-rose-500/10 px-2 py-1 rounded w-fit text-xs font-medium">
                                                                        <TrendingDown className="w-3 h-3" /> Egreso
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="hidden md:table-cell">
                                                                <span className="text-sm font-medium border px-2 py-0.5 rounded-full text-muted-foreground">
                                                                    {getCategoryLabel(tx.category)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="max-w-[150px] md:max-w-xs truncate text-sm">
                                                                {tx.description}
                                                            </TableCell>
                                                            <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">
                                                                {tx.userName || 'Usuario'}
                                                            </TableCell>
                                                            <TableCell className={`text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center">
                <p className="text-muted-foreground animate-pulse">Cargando reportes...</p>
            </div>
        }>
            <ReportsContent />
        </Suspense>
    );
}
