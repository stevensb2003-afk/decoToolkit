"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc } from "@/firebase";
import { UserProfile } from "@/lib/types";
import { doc, collection, query, where, orderBy, onSnapshot, limit, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Plus,
    Minus,
    History,
    ArrowRightLeft,
    Calendar,
    Filter,
    Wallet,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Clock,
    CheckCircle2,
    Trash2,
    Settings,
    Edit2,
    Pencil,
    X,
    Lock,
    Unlock,
    ArrowUpCircle,
    ArrowDownCircle,
    UserPlus,
    UserMinus,
    RefreshCw,
    BarChart3,
    Calculator
} from "lucide-react";
import {
    getOpenCashSession,
    getSessionTransactions,
    openCashSession,
    closeCashSession,
    recordCashTransaction,
    getPendingTransactions,
    applyPendingTransactionsToSession,
    getRecentSessions,
    getGlobalRecentSessions,
    getLastSession,
    getBranches,
    getBranchRegisters,
    getRegisters,
    createBranch,
    createCaja,
    updateBranch,
    deleteBranch,
    updateCaja,
    deleteCaja,
    getPlatformAdmins,
    CASH_SESSIONS_COLLECTION,
    CASH_TRANSACTIONS_COLLECTION
} from "@/lib/cash-control";
import { CashSession, CashTransaction, CashTransactionCategory, Branch, CashRegister } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function CashControlPage() {
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const firestore = useFirestore();
    const router = useRouter();

    const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

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

    const [activeSession, setActiveSession] = useState<CashSession | null>(null);
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<CashTransaction[]>([]);
    const [recentSessions, setRecentSessions] = useState<CashSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Cash Calculator state
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
    const COIN_DENOMINATIONS = [5, 10, 25, 50, 100, 500];
    const BILL_DENOMINATIONS = [1000, 2000, 5000, 10000, 20000];
    const ALL_DENOMINATIONS = [...COIN_DENOMINATIONS, ...BILL_DENOMINATIONS];
    const [calculatorCounts, setCalculatorCounts] = useState<Record<number, string>>(
        Object.fromEntries(ALL_DENOMINATIONS.map(d => [d, ""]))
    );
    const calculatorTotal = useMemo(() => {
        return ALL_DENOMINATIONS.reduce((sum, denom) => {
            const count = parseInt(calculatorCounts[denom] || "0", 10);
            return sum + (isNaN(count) ? 0 : count * denom);
        }, 0);
    }, [calculatorCounts]);

    // Forms state
    const [openingBalance, setOpeningBalance] = useState<string>("0");
    const [lastSession, setLastSession] = useState<CashSession | null>(null);
    const [isOpeningDialogOpen, setIsOpeningDialogOpen] = useState(false);

    // Closure simplified state
    const [isClosingDialogOpen, setIsClosingDialogOpen] = useState(false);
    const [isResponsibilityConfirmed, setIsResponsibilityConfirmed] = useState(false);

    // Partial withdrawal state
    const [isPartialWithdrawalOpen, setIsPartialWithdrawalOpen] = useState(false);
    const [partialWithdrawalAmount, setPartialWithdrawalAmount] = useState<string>("");
    const [partialWithdrawalNote, setPartialWithdrawalNote] = useState<string>("");

    const [incomeForm, setIncomeForm] = useState({
        amount: "",
        category: 'venta' as CashTransactionCategory,
        description: "",
        invoiceNumber: ""
    });

    const [expenseForm, setExpenseForm] = useState({
        amount: "",
        category: 'gasto' as CashTransactionCategory,
        description: ""
    });

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");
    const [cajas, setCajas] = useState<CashRegister[]>([]);
    const [selectedCajaId, setSelectedCajaId] = useState<string>("");

    // Global History state
    const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);
    const [globalRecentSessions, setGlobalRecentSessions] = useState<CashSession[]>([]);
    const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);

    // Management state
    const [isCreatingBranch, setIsCreatingBranch] = useState(false);
    const [newBranchName, setNewBranchName] = useState("");
    const [isCreatingCaja, setIsCreatingCaja] = useState(false);
    const [newCajaName, setNewCajaName] = useState("");
    const [newCajaBranchId, setNewCajaBranchId] = useState("");
    const [newCajaInitialBalance, setNewCajaInitialBalance] = useState("0");

    // Administration State
    const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
    const [editBranchName, setEditBranchName] = useState("");
    const [editBranchAdmins, setEditBranchAdmins] = useState<string[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState("");

    const [editingCajaId, setEditingCajaId] = useState<string | null>(null);
    const [editCajaName, setEditCajaName] = useState("");
    const [editCajaBranchId, setEditCajaBranchId] = useState("");
    const [editCajaAdmins, setEditCajaAdmins] = useState<string[]>([]);
    const [editCajaInitialBalance, setEditCajaInitialBalance] = useState("0");

    // Refinement State
    const [platformAdmins, setPlatformAdmins] = useState<{ id: string, email: string, displayName: string }[]>([]);

    // Alegra Integration State
    const [alegraEmail, setAlegraEmail] = useState("");
    const [alegraApiKey, setAlegraApiKey] = useState("");
    const [alegraDefaultCajaId, setAlegraDefaultCajaId] = useState<string>("");
    const [isSavingAlegra, setIsSavingAlegra] = useState(false);

    // Filtering State
    const [filterType, setFilterType] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");

    // Función temporal de mantenimiento (se eliminará después)
    const runSessionCleanup = async () => {
        try {
            const { getDocs, deleteDoc } = await import("firebase/firestore");

            console.log("--- Diagnóstico de Estructura ---");
            const bSnap = await getDocs(collection(firestore, "branches"));
            const branchesMap = bSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
            console.log("Sucursales registradas:", branchesMap);

            const cSnap = await getDocs(collection(firestore, "cashRegisters"));
            const registersMap = cSnap.docs.map(d => ({ id: d.id, name: d.data().name, bId: d.data().branchId }));
            console.log("Cajas registradas:", registersMap);

            // Intentar encontrar el ID real de la sucursal "Uruca" y caja "Principal"
            const realUruca = branchesMap.find(b => b.name?.toLowerCase().includes("uruca"));
            const realPrincipal = registersMap.find(r => r.name?.toLowerCase().includes("principal") && (r.bId === realUruca?.id || !realUruca));

            const targetBranchId = realUruca?.id || "uruca";
            const targetBranchName = realUruca?.name || "Uruca";
            const targetCajaId = realPrincipal?.id || "principal";
            const targetCajaName = realPrincipal?.name || "Principal";

            console.log(`Objetivo -> Sucursal: ${targetBranchName} (${targetBranchId}), Caja: ${targetCajaName} (${targetCajaId})`);

            const sessionsRef = collection(firestore, "cashSessions");
            const snap = await getDocs(sessionsRef);

            let countDeleted = 0;
            let countUpdated = 0;

            for (const docSnap of snap.docs) {
                const data = docSnap.data();
                const closureVal = Number(data.closingBalance || data.totalClosure || data.openingBalance || 0);
                const openedAt = data.openedAt?.toDate?.() || (data.openedAt instanceof Date ? data.openedAt : null);
                const isFeb27 = openedAt && openedAt.getMonth() === 1 && openedAt.getDate() === 27 && openedAt.getFullYear() === 2026;

                // REGLA PARA VINCULAR (27/02)
                const isUnknown = !data.branchId || data.branchId === "unknown" || data.branchName === "Desconocida";
                if (closureVal === 577260 || (isFeb27 && isUnknown)) {
                    console.log(`Corrigiendo sesión 27/02: ${docSnap.id}`);
                    await setDoc(doc(firestore, "cashSessions", docSnap.id), {
                        branchId: targetBranchId,
                        branchName: targetBranchName,
                        registerId: targetCajaId,
                        registerName: targetCajaName,
                        cajaId: targetCajaId,
                        cajaName: targetCajaName,
                        status: 'closed' // Asegurar que esté cerrada para que salga en historial
                    }, { merge: true });
                    countUpdated++;
                    continue;
                }

                // REGLA PARA ELIMINAR (PRUEBAS)
                if (closureVal === 80000) {
                    await deleteDoc(doc(firestore, "cashSessions", docSnap.id));
                    countDeleted++;
                }
            }

            toast({
                title: "Mantenimiento Finalizado",
                description: `Corregidos: ${countUpdated} (27/02). Eliminados: ${countDeleted}. Escaneados: ${snap.docs.length}.`
            });
        } catch (e) {
            console.error("Error en mantenimiento:", e);
            toast({ title: "Error", description: "Fallo el mantenimiento. Revisa la consola.", variant: "destructive" });
        }
    };

    useEffect(() => {
        if (isGlobalHistoryOpen) {
            setIsLoadingGlobal(true);
            getGlobalRecentSessions(10)
                .then((sessions: CashSession[]) => setGlobalRecentSessions(sessions))
                .catch((err: any) => {
                    console.error("Error cargando historial global:", err);
                    toast({ title: "Error", description: "No se pudo cargar el historial global", variant: "destructive" });
                })
                .finally(() => setIsLoadingGlobal(false));
        }
    }, [isGlobalHistoryOpen, toast]);

    useEffect(() => {
        const fetchAdmins = async () => {
            if (profile?.isAdmin) {
                try {
                    const admins = await getPlatformAdmins();
                    setPlatformAdmins(admins);
                } catch (error) {
                    console.error("Error fetching platform admins:", error);
                }
            }
        };
        fetchAdmins();
    }, [profile?.isAdmin]);

    useEffect(() => {
        const loadSettingsData = async () => {
            if (isSettingsOpen && profile?.isAdmin) {
                try {
                    const fetchedBranches = await getBranches();
                    setBranches(fetchedBranches);

                    const fetchedCajas = await getRegisters();
                    // If a branch is selected, filter them, otherwise show all
                    if (selectedBranchId) {
                        setCajas(fetchedCajas.filter(c => c.branchId === selectedBranchId));
                    } else {
                        setCajas(fetchedCajas);
                    }

                    // Load Alegra Settings
                    const alegraRef = doc(firestore, 'settings', 'alegra');
                    const alegraSnap = await getDoc(alegraRef);
                    if (alegraSnap.exists()) {
                        const data = alegraSnap.data();
                        setAlegraEmail(data.email || "");
                        setAlegraApiKey(data.apiKey || "");
                        setAlegraDefaultCajaId(data.defaultCajaId || "");
                    }
                } catch (error) {
                    console.error("Error loading settings data:", error);
                }
            }
        };
        loadSettingsData();
    }, [isSettingsOpen, profile?.isAdmin, selectedBranchId, firestore]);

    const handleSaveAlegraSettings = async () => {
        if (!profile?.isAdmin) return;
        setIsSavingAlegra(true);
        try {
            const alegraRef = doc(firestore, 'settings', 'alegra');
            await setDoc(alegraRef, {
                email: alegraEmail.trim(),
                apiKey: alegraApiKey.trim(),
                defaultCajaId: alegraDefaultCajaId.trim(),
                updatedAt: new Date()
            }, { merge: true });

            toast({
                title: "Configuración Guardada",
                description: "Los credenciales de Alegra se han actualizado correctamente."
            });
        } catch (error) {
            console.error("Error saving Alegra settings:", error);
            toast({
                title: "Error",
                description: "No se pudieron guardar los ajustes de Alegra",
                variant: "destructive"
            });
        } finally {
            setIsSavingAlegra(false);
        }
    };

    useEffect(() => {
        const loadBranches = async () => {
            if (!user || isProfileLoading || !profile) return;
            try {
                const fetchedBranches = await getBranches();

                // Filter branches based on permissions
                const accessibleBranches = profile.isAdmin
                    ? fetchedBranches
                    : fetchedBranches.filter(b => b.assignedAdmins?.includes(user.uid));

                setBranches(accessibleBranches);
                if (accessibleBranches.length > 0) {
                    const urucaBranch = accessibleBranches.find(b => b.name.toLowerCase() === 'uruca');
                    setSelectedBranchId(urucaBranch ? urucaBranch.id : accessibleBranches[0].id);
                }
            } catch (error) {
                console.error("Error fetching branches:", error);
            }
        };
        loadBranches();
    }, [user, profile, isProfileLoading]);

    useEffect(() => {
        const loadCajas = async () => {
            if (!selectedBranchId) {
                setCajas([]);
                setSelectedCajaId("");
                return;
            }
            try {
                const fetchedCajas = await getBranchRegisters(selectedBranchId);
                setCajas(fetchedCajas);
                if (fetchedCajas.length > 0) {
                    const principalCaja = fetchedCajas.find(c => c.name.toLowerCase() === 'principal');
                    setSelectedCajaId(principalCaja ? principalCaja.id : fetchedCajas[0].id);
                } else {
                    setSelectedCajaId("");
                }
            } catch (error) {
                console.error("Error fetching cajas:", error);
            }
        };
        loadCajas();
    }, [selectedBranchId]);

    // Real-time synchronization
    useEffect(() => {
        if (!user || !selectedCajaId) return;

        setLoading(true);

        const activeSessionQuery = query(
            collection(firestore, CASH_SESSIONS_COLLECTION),
            where('cajaId', '==', selectedCajaId),
            where('status', '==', 'open')
        );

        const pendingTxQuery = query(
            collection(firestore, CASH_TRANSACTIONS_COLLECTION),
            where('cajaId', '==', selectedCajaId)
        );

        const recentSessionsQuery = query(
            collection(firestore, CASH_SESSIONS_COLLECTION),
            where('cajaId', '==', selectedCajaId)
        );

        const unsubActiveSession = onSnapshot(activeSessionQuery, (snapshot) => {
            if (!snapshot.empty) {
                setActiveSession(snapshot.docs[0].data() as CashSession);
            } else {
                setActiveSession(null);
            }
        });

        const unsubPendingTxs = onSnapshot(pendingTxQuery, (snapshot) => {
            const allTxs = snapshot.docs.map(doc => doc.data() as CashTransaction);
            const pending = allTxs
                .filter(t => t.status === 'pending')
                .sort((a, b) => {
                    const timeA = (a.createdAt as any)?.toMillis?.() || (a.createdAt as Date)?.getTime?.() || 0;
                    const timeB = (b.createdAt as any)?.toMillis?.() || (b.createdAt as Date)?.getTime?.() || 0;
                    return timeA - timeB;
                });
            setPendingTransactions(pending);
        });

        const unsubRecentSessions = onSnapshot(recentSessionsQuery, (snapshot) => {
            const allSessions = snapshot.docs.map(doc => doc.data() as CashSession);
            const sessions = allSessions
                .filter(s => s.status === 'closed')
                .sort((a, b) => {
                    const timeA = (a.closedAt as any)?.toMillis?.() || (a.closedAt as Date)?.getTime?.() || 0;
                    const timeB = (b.closedAt as any)?.toMillis?.() || (b.closedAt as Date)?.getTime?.() || 0;
                    return timeB - timeA;
                })
                .slice(0, 10);
            setRecentSessions(sessions);
            if (sessions.length > 0) {
                setLastSession(sessions[0]);
                if (sessions[0].closingBase) {
                    setOpeningBalance(sessions[0].closingBase.toString());
                }
            } else {
                setLastSession(null);
            }
            setLoading(false);
        });



        return () => {
            unsubActiveSession();
            unsubPendingTxs();
            unsubRecentSessions();
        };
    }, [user, selectedCajaId]);

    useEffect(() => {
        if (!user) return;

        let targetSessionId = selectedSessionId || activeSession?.id;

        if (!targetSessionId) {
            setTransactions([]);
            return;
        }

        const txQuery = query(
            collection(firestore, CASH_TRANSACTIONS_COLLECTION),
            where('sessionId', '==', targetSessionId)
        );

        const unsubTxs = onSnapshot(txQuery, (snapshot) => {
            const txs = snapshot.docs.map(doc => doc.data() as CashTransaction)
                .sort((a, b) => {
                    const timeA = (a.createdAt as any)?.toMillis?.() || (a.createdAt as Date)?.getTime?.() || 0;
                    const timeB = (b.createdAt as any)?.toMillis?.() || (b.createdAt as Date)?.getTime?.() || 0;
                    return timeA - timeB;
                });
            setTransactions(txs);
        });

        return () => unsubTxs();
    }, [user, selectedSessionId, activeSession?.id]);

    // Calculations
    const stats = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const pendingTotal = pendingTransactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

        // Find the base for the currently viewed session
        const currentViewedSession = selectedSessionId
            ? recentSessions.find(s => s.id === selectedSessionId) || (activeSession?.id === selectedSessionId ? activeSession : null)
            : activeSession;

        let base = currentViewedSession?.openingBalance || 0;
        let currentBalance = base + income - expense;
        let isLastClosure = false;

        // Si no hay sesión activa ni seleccionada, mostramos el saldo del último cierre
        if (!currentViewedSession && lastSession) {
            currentBalance = lastSession.closingBalance || 0;
            isLastClosure = true;
        }

        return { income, expense, currentBalance, pendingTotal, base, isLastClosure };
    }, [transactions, activeSession, pendingTransactions, selectedSessionId, recentSessions, lastSession]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const matchesType =
                filterType === 'all' ||
                (filterType === 'income' && tx.type === 'income') ||
                (filterType === 'expense' && tx.type === 'expense' && tx.category !== 'corte_parcial') ||
                (filterType === 'withdrawal' && tx.category === 'corte_parcial');

            const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;

            return matchesType && matchesCategory;
        });
    }, [transactions, filterType, filterCategory]);

    const handleOpenCaja = async () => {
        if (!user) return;
        const amount = parseFloat(openingBalance);
        try {
            const cajaName = cajas.find(c => c.id === selectedCajaId)?.name || "Caja";
            const sessionId = await openCashSession(
                selectedBranchId,
                selectedCajaId,
                cajaName,
                user.uid,
                user.displayName || user.email || "Usuario",
                amount
            );

            // Apply pending transactions if any
            if (pendingTransactions.length > 0) {
                await applyPendingTransactionsToSession(sessionId, pendingTransactions.map(t => t.id));
            }

            toast({ title: "Caja abierta correctamente" });
            setIsOpeningDialogOpen(false);
        } catch (error) {
            toast({ title: "Error", description: "No se pudo abrir la caja", variant: "destructive" });
        }
    };

    const handleCloseCaja = async () => {
        if (!activeSession || !user) return;
        const balance = stats.currentBalance;

        try {
            await closeCashSession(
                activeSession.id,
                balance,
                { base: balance, physical: balance, bank: 0 },
                { userId: user.uid, userName: user.displayName || user.email || "Usuario" }
            );
            toast({ title: "Caja cerrada correctamente" });
            setIsClosingDialogOpen(false);
            setIsResponsibilityConfirmed(false);
        } catch (error) {
            toast({ title: "Error", description: "Error al cerrar la caja", variant: "destructive" });
        }
    };

    const handleAddTransaction = async (type: 'income' | 'expense') => {
        if (!user || !activeSession) return;

        const form = type === 'income' ? incomeForm : expenseForm;
        const amount = parseFloat(form.amount);

        if (isNaN(amount) || amount <= 0) {
            toast({ title: "Error", description: "Monto inválido", variant: "destructive" });
            return;
        }

        try {
            const finalDescription = type === 'income' && form.category === 'venta' && (form as any).invoiceNumber
                ? `${form.description} [Ref: ${(form as any).invoiceNumber}]`.trim()
                : form.description;

            await recordCashTransaction(
                selectedBranchId,
                selectedCajaId,
                user.uid,
                user.displayName || user.email || "Usuario",
                activeSession.id,
                type,
                amount,
                form.category,
                finalDescription,
                'manual'
            );
            toast({ title: "Movimiento registrado" });

            if (type === 'income') {
                setIncomeForm({ ...incomeForm, amount: "", description: "", invoiceNumber: "" });
            } else {
                setExpenseForm({ ...expenseForm, amount: "", description: "" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Error al registrar movimiento", variant: "destructive" });
        }
    };

    const handlePartialWithdrawal = async () => {
        if (!user || !activeSession) return;
        const amount = parseFloat(partialWithdrawalAmount);

        if (isNaN(amount) || amount <= 0) {
            toast({ title: "Error", description: "Monto inválido", variant: "destructive" });
            return;
        }

        try {
            await recordCashTransaction(
                selectedBranchId,
                selectedCajaId,
                user.uid,
                user.displayName || user.email || "Usuario",
                activeSession.id,
                'expense',
                amount,
                'corte_parcial',
                `Retiro de excedente: ${partialWithdrawalNote || 'Sin nota'}`,
                'manual'
            );
            toast({ title: "Retiro de excedente registrado" });
            setPartialWithdrawalAmount("");
            setPartialWithdrawalNote("");
            setIsPartialWithdrawalOpen(false);
        } catch (error) {
            toast({ title: "Error", description: "Error al registrar retiro", variant: "destructive" });
        }
    };

    const handleSaveSettings = async () => {
        if (profile?.isAdmin) {
            await handleSaveAlegraSettings();
        }
        setIsSettingsOpen(false);
    };

    const handleCreateBranch = async () => {
        if (!newBranchName.trim() || !profile?.isAdmin) return;
        try {
            const id = await createBranch(newBranchName, true);
            toast({ title: "Sucursal creada", description: `Se ha creado ${newBranchName}` });
            setNewBranchName("");
            setIsCreatingBranch(false);
            // Re-vincular la sucursal seleccionada si no había ninguna
            if (!selectedBranchId) setSelectedBranchId(id);
            // Recargar ramas
            const fetchedBranches = await getBranches();
            setBranches(fetchedBranches);
        } catch (error) {
            toast({ title: "Error", description: "No se pudo crear la sucursal", variant: "destructive" });
        }
    };

    const handleCreateCaja = async () => {
        if (!newCajaName.trim() || !newCajaBranchId || !profile?.isAdmin) return;
        try {
            const initialBal = parseFloat(newCajaInitialBalance) || 0;
            const id = await createCaja(newCajaBranchId, newCajaName, true, initialBal);
            toast({ title: "Caja creada", description: `Se ha creado ${newCajaName}` });
            setNewCajaName("");
            setNewCajaInitialBalance("0");
            setIsCreatingCaja(false);
            if (!selectedCajaId) setSelectedCajaId(id);
            const fetchedCajas = await getBranchRegisters(newCajaBranchId);
            setCajas(fetchedCajas);
        } catch (error) {
            toast({ title: "Error", description: "No se pudo crear la caja", variant: "destructive" });
        }
    };

    const handleUpdateBranch = async () => {
        if (!editingBranchId || !editBranchName.trim() || !profile?.isAdmin) return;
        try {
            await updateBranch(editingBranchId, editBranchName, editBranchAdmins, true);
            toast({ title: "Sucursal actualizada" });
            setEditingBranchId(null);
            const fetchedBranches = await getBranches();
            setBranches(fetchedBranches);
        } catch (error) {
            toast({ title: "Error", description: "No se pudo actualizar la sucursal", variant: "destructive" });
        }
    };

    const handleDeleteBranch = async (id: string) => {
        if (!profile?.isAdmin) return;
        if (!confirm("¿Estás seguro de eliminar esta sucursal?")) return;
        try {
            await deleteBranch(id, true);
            toast({ title: "Sucursal eliminada" });
            const fetchedBranches = await getBranches();
            setBranches(fetchedBranches);
            if (selectedBranchId === id) setSelectedBranchId("");
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleUpdateCaja = async () => {
        if (!editingCajaId || !editCajaName.trim() || !profile?.isAdmin) return;
        try {
            const initialBal = parseFloat(editCajaInitialBalance) || 0;
            await updateCaja(editingCajaId, editCajaName, editCajaAdmins, true, editCajaBranchId, initialBal);
            toast({ title: "Caja actualizada" });
            setEditingCajaId(null);
            // Si la caja se movió de sucursal y tenemos un filtro activo, recargamos según el filtro
            const fetchedCajas = selectedBranchId ? await getBranchRegisters(selectedBranchId) : await getRegisters();
            setCajas(fetchedCajas);
        } catch (error) {
            toast({ title: "Error", description: "No se pudo actualizar la caja", variant: "destructive" });
        }
    };

    const handleDeleteCaja = async (id: string) => {
        if (!profile?.isAdmin) return;
        if (!confirm("¿Estás seguro de eliminar esta caja?")) return;
        try {
            await deleteCaja(id, true);
            toast({ title: "Caja eliminada" });
            const fetchedCajas = await getBranchRegisters(selectedBranchId);
            setCajas(fetchedCajas);
            if (selectedCajaId === id) setSelectedCajaId("");
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div className="min-h-screen bg-muted/20 flex flex-col">
            <Header />

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Wallet className="text-primary" /> Control de Caja
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                                <SelectTrigger className="w-full sm:w-[160px] md:w-[200px] flex-1">
                                    <SelectValue placeholder="Sucursal..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map(b => (
                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedCajaId} onValueChange={setSelectedCajaId} disabled={!selectedBranchId || cajas.length === 0}>
                                <SelectTrigger className="w-full sm:w-[160px] md:w-[200px] flex-1">
                                    <SelectValue placeholder="Caja..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {cajas.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>




                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsCalculatorOpen(true)}
                                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Calculadora de Caja"
                            >
                                <Calculator className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (selectedBranchId && selectedCajaId) {
                                        router.push(`/caja/reportes?branchId=${selectedBranchId}&cajaId=${selectedCajaId}`);
                                    } else {
                                        toast({ title: "Atención", description: "Selecciona una sucursal y una caja primero para generar el reporte." });
                                    }
                                }}
                                className="h-9"
                                title="Generar Reporte"
                            >
                                <BarChart3 className="w-4 h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Generar Reporte</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsGlobalHistoryOpen(true)}
                                className="h-9"
                                title="Historial Global"
                            >
                                <History className="w-4 h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Historial Global</span>
                            </Button>
                            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[650px] w-[95vw] h-[90vh] sm:h-auto">
                                    <DialogHeader>
                                        <DialogTitle>Configuración de Caja</DialogTitle>
                                        <DialogDescription>
                                            Administra las sucursales, cajas y sus permisos.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                                        {/* Branch Administration */}
                                        <div className="space-y-4 p-3 border rounded-lg">
                                            <div className="flex items-center justify-between border-b pb-2 mb-2">
                                                <div className="flex items-center gap-2 text-sm font-bold">
                                                    <Wallet className="w-4 h-4" /> Sucursales
                                                </div>
                                                <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setIsCreatingBranch(!isCreatingBranch)}>
                                                    {isCreatingBranch ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                                                    {isCreatingBranch ? 'Cancelar' : 'Nueva'}
                                                </Button>
                                            </div>

                                            {isCreatingBranch && (
                                                <div className="space-y-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                                                    <Label className="text-xs font-bold">Crear Nueva Sucursal</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="Nombre de la sucursal..."
                                                            value={newBranchName}
                                                            onChange={(e) => setNewBranchName(e.target.value)}
                                                        />
                                                        <Button size="sm" onClick={handleCreateBranch}>Crear</Button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                {branches.map(branch => (
                                                    <div key={branch.id} className="border rounded-md p-3 bg-muted/10">
                                                        {editingBranchId === branch.id ? (
                                                            <div className="space-y-3">
                                                                <Input
                                                                    value={editBranchName}
                                                                    onChange={(e) => setEditBranchName(e.target.value)}
                                                                    placeholder="Nombre de sucursal"
                                                                />
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs">Permisos (Emails de Admins)</Label>
                                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                                        {editBranchAdmins.map(adminId => {
                                                                            const admin = platformAdmins.find(a => a.id === adminId);
                                                                            return (
                                                                                <div key={adminId} className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/20">
                                                                                    {admin?.displayName || admin?.email || adminId}
                                                                                    <X
                                                                                        className="w-3 h-3 cursor-pointer hover:text-destructive"
                                                                                        onClick={() => setEditBranchAdmins(prev => prev.filter(e => e !== adminId))}
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Select
                                                                            onValueChange={(val) => {
                                                                                if (val && !editBranchAdmins.includes(val)) {
                                                                                    setEditBranchAdmins([...editBranchAdmins, val]);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-8 text-xs">
                                                                                <SelectValue placeholder="Seleccionar Admin..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {platformAdmins
                                                                                    .filter(admin => !editBranchAdmins.includes(admin.id))
                                                                                    .map(admin => (
                                                                                        <SelectItem key={admin.id} value={admin.id}>
                                                                                            {admin.displayName} ({admin.email})
                                                                                        </SelectItem>
                                                                                    ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-end gap-2">
                                                                    <Button variant="ghost" size="sm" onClick={() => setEditingBranchId(null)}>Cancelar</Button>
                                                                    <Button size="sm" onClick={handleUpdateBranch}>Guardar</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="font-semibold text-sm">{branch.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {branch.assignedAdmins?.length || 0} admins asignados
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7"
                                                                        onClick={() => {
                                                                            setEditingBranchId(branch.id);
                                                                            setEditBranchName(branch.name);
                                                                            setEditBranchAdmins(branch.assignedAdmins || []);
                                                                        }}
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-destructive"
                                                                        onClick={() => handleDeleteBranch(branch.id)}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Caja Administration */}
                                        <div className="space-y-4 p-3 border rounded-lg">
                                            <div className="flex items-center justify-between border-b pb-2 mb-2">
                                                <div className="flex items-center gap-2 text-sm font-bold">
                                                    <Wallet className="w-4 h-4 text-primary" /> Cajas
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2"
                                                    onClick={() => {
                                                        setIsCreatingCaja(!isCreatingCaja);
                                                        if (!isCreatingCaja) {
                                                            setNewCajaBranchId(selectedBranchId);
                                                            setNewCajaName("");
                                                        }
                                                    }}
                                                >
                                                    {isCreatingCaja ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                                                    {isCreatingCaja ? 'Cancelar' : 'Nueva'}
                                                </Button>
                                            </div>

                                            {isCreatingCaja && (
                                                <div className="space-y-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                                                    <Label className="text-xs font-bold">Crear Nueva Caja</Label>
                                                    <div className="space-y-2">
                                                        <div className="grid grid-cols-1 gap-2">
                                                            <Select value={newCajaBranchId} onValueChange={setNewCajaBranchId}>
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="Seleccionar Sucursal..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {branches.map(b => (
                                                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Input
                                                                className="h-8 text-xs"
                                                                placeholder="Nombre de la caja..."
                                                                value={newCajaName}
                                                                onChange={(e) => setNewCajaName(e.target.value)}
                                                            />
                                                            <Input
                                                                className="h-8 text-xs"
                                                                type="number"
                                                                placeholder="Saldo Inicial Base..."
                                                                value={newCajaInitialBalance}
                                                                onChange={(e) => setNewCajaInitialBalance(e.target.value)}
                                                            />
                                                            <Button size="sm" className="h-8 text-xs" onClick={handleCreateCaja}>Crear Caja</Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                {cajas.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground text-center py-4 italic">
                                                        No hay cajas registradas {selectedBranchId ? 'en esta sucursal' : ''}.
                                                    </p>
                                                ) : (
                                                    cajas.map(caja => (
                                                        <div key={caja.id} className="border rounded-md bg-muted/5 flex flex-col">
                                                            {editingCajaId === caja.id ? (
                                                                <div className="p-3 space-y-3">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-bold">Sucursal</Label>
                                                                        <Select value={editCajaBranchId} onValueChange={setEditCajaBranchId}>
                                                                            <SelectTrigger className="h-8 text-xs">
                                                                                <SelectValue placeholder="Seleccionar Sucursal..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {branches.map(b => (
                                                                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-bold">Nombre</Label>
                                                                        <Input
                                                                            className="h-8 text-sm"
                                                                            value={editCajaName}
                                                                            onChange={(e) => setEditCajaName(e.target.value)}
                                                                            placeholder="Nombre de la caja"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-bold">Saldo Inicial Base (Opcional)</Label>
                                                                        <Input
                                                                            className="h-8 text-sm"
                                                                            type="number"
                                                                            value={editCajaInitialBalance}
                                                                            onChange={(e) => setEditCajaInitialBalance(e.target.value)}
                                                                            placeholder="Ej. 500000"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-bold">Admins Asignados</Label>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {editCajaAdmins.map(adminId => {
                                                                                const admin = platformAdmins.find(a => a.id === adminId);
                                                                                return (
                                                                                    <div key={adminId} className="bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/20">
                                                                                        {admin?.displayName || admin?.email || adminId}
                                                                                        <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setEditCajaAdmins(prev => prev.filter(e => e !== adminId))} />
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Select
                                                                                onValueChange={(val) => {
                                                                                    if (val && !editCajaAdmins.includes(val)) {
                                                                                        setEditCajaAdmins([...editCajaAdmins, val]);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="h-7 text-[10px]">
                                                                                    <SelectValue placeholder="Seleccionar Admin..." />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {platformAdmins
                                                                                        .filter(admin => !editCajaAdmins.includes(admin.id))
                                                                                        .map(admin => (
                                                                                            <SelectItem key={admin.id} value={admin.id}>
                                                                                                {admin.displayName}
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-end gap-2 mt-2">
                                                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingCajaId(null)}>Cancelar</Button>
                                                                        <Button size="sm" className="h-7 text-xs" onClick={handleUpdateCaja}>Guardar</Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-between p-2">
                                                                    <div>
                                                                        <span className="text-sm font-medium">{caja.name}</span>
                                                                        <p className="text-[9px] text-muted-foreground">
                                                                            Sucursal: {branches.find(b => b.id === caja.branchId)?.name || '...'} | {caja.assignedAdmins?.length || 0} admins
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6"
                                                                            onClick={() => {
                                                                                setEditingCajaId(caja.id);
                                                                                setEditCajaName(caja.name);
                                                                                setEditCajaBranchId(caja.branchId);
                                                                                setEditCajaAdmins(caja.assignedAdmins || []);
                                                                                setEditCajaInitialBalance((caja.initialBalance || 0).toString());
                                                                            }}
                                                                        >
                                                                            <Pencil className="w-3 h-3" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-destructive"
                                                                            onClick={() => handleDeleteCaja(caja.id)}
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Alegra Integration Administration */}
                                        <div className="space-y-4 p-4 border-2 border-primary/20 rounded-lg bg-primary/5 shadow-inner">
                                            <div className="flex items-center gap-2 text-sm font-black text-primary uppercase tracking-tight">
                                                <TrendingUp className="w-4 h-4" /> Integración Alegra Contabilidad
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-tight">
                                                Configura las credenciales para sincronizar automáticamente las facturas pagadas en efectivo.
                                            </p>
                                            <div className="space-y-1.5 pt-1">
                                                <Label className="text-[10px] font-bold uppercase">Caja Destino para Sincronización</Label>
                                                <Select value={alegraDefaultCajaId} onValueChange={setAlegraDefaultCajaId}>
                                                    <SelectTrigger className="h-8 text-xs bg-white">
                                                        <SelectValue placeholder="Seleccionar caja local..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {cajas.map((caja) => (
                                                            <SelectItem key={caja.id} value={caja.id} className="text-xs">
                                                                {caja.name} ({branches.find(b => b.id === caja.branchId)?.name || 'Sin sucursal'})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[9px] text-muted-foreground italic">
                                                    * Todos los registros de Alegra se cargarán en esta caja seleccionada.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-amber-50 p-2 rounded border border-amber-100 italic">
                                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                                <p className="text-[9px] text-amber-700 leading-none">
                                                    Esta configuración es global y permite que el sistema consulte facturas en tiempo real para asentar los pagos en las cajas correspondientes.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter className="flex flex-row justify-between sm:justify-between border-t pt-4">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border-amber-200"
                                            onClick={runSessionCleanup}
                                        >
                                            <RefreshCw size={16} className="mr-2" />
                                            Ejecutar Mantenimiento de Datos
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancelar</Button>
                                            <Button onClick={handleSaveSettings}>Guardar Configuración</Button>
                                        </div>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>

                {/* Main Grid Container for Responsive Ordering (Stats, Actions, Movements) */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* LEFT COLUMN: Stats and Movements */}
                    <div className="flex-1 space-y-6 overflow-hidden">
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <Card className="bg-gradient-to-br from-white to-emerald-50/30 border-emerald-100 shadow-sm overflow-hidden relative group">
                                <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-5 transition-transform group-hover:scale-110">
                                    <TrendingUp size={32} className="sm:hidden" />
                                    <TrendingUp size={64} className="hidden sm:block" />
                                </div>
                                <CardContent className="p-2 sm:pt-6 sm:px-6 sm:pb-6 relative">
                                    <p className="text-[7px] sm:text-[10px] text-emerald-700/70 uppercase font-black tracking-widest mb-0.5 sm:mb-1 leading-tight">Total Ingresos</p>
                                    <div className="flex items-baseline gap-0.5 sm:gap-1">
                                        <span className="text-xs sm:text-xl font-bold text-emerald-600">₡</span>
                                        <h3 className="text-sm sm:text-3xl font-black text-emerald-600 tracking-tighter font-mono leading-none">
                                            {stats.income.toLocaleString()}
                                        </h3>
                                    </div>
                                    <div className="mt-1 sm:mt-2 flex items-center gap-0.5 sm:gap-1 text-[6px] sm:text-[10px] font-bold text-emerald-600/60 bg-emerald-100/50 w-fit px-1 sm:px-2 py-0.5 rounded-full flex-wrap">
                                        <ArrowUpCircle size={8} className="shrink-0" />
                                        <span>+{((stats.income / (stats.currentBalance || 1)) * 100).toFixed(1)}% del balance</span>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-white to-rose-50/30 border-rose-100 shadow-sm overflow-hidden relative group">
                                <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-5 transition-transform group-hover:scale-110">
                                    <TrendingDown size={32} className="sm:hidden" />
                                    <TrendingDown size={64} className="hidden sm:block" />
                                </div>
                                <CardContent className="p-2 sm:pt-6 sm:px-6 sm:pb-6 relative">
                                    <p className="text-[7px] sm:text-[10px] text-rose-700/70 uppercase font-black tracking-widest mb-0.5 sm:mb-1 leading-tight">Total Egresos</p>
                                    <div className="flex items-baseline gap-0.5 sm:gap-1">
                                        <span className="text-xs sm:text-xl font-bold text-rose-600">₡</span>
                                        <h3 className="text-sm sm:text-3xl font-black text-rose-600 tracking-tighter font-mono leading-none">
                                            {stats.expense.toLocaleString()}
                                        </h3>
                                    </div>
                                    <div className="mt-1 sm:mt-2 flex items-center gap-0.5 sm:gap-1 text-[6px] sm:text-[10px] font-bold text-rose-600/60 bg-rose-100/50 w-fit px-1 sm:px-2 py-0.5 rounded-full flex-wrap">
                                        <ArrowDownCircle size={8} className="shrink-0" />
                                        <span>Movimientos de salida</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 overflow-hidden relative group">
                                <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 transition-transform group-hover:scale-110">
                                    <Wallet size={32} className="sm:hidden" />
                                    <Wallet size={64} className="hidden sm:block" />
                                </div>
                                <CardContent className="p-2 sm:pt-6 sm:px-6 sm:pb-6 relative">
                                    <p className="text-[7px] sm:text-[10px] font-black uppercase opacity-70 mb-0.5 sm:mb-1 leading-tight">
                                        {stats.isLastClosure ? "Último cierre" : "Saldo en caja"}
                                    </p>
                                    <div className="flex items-baseline gap-0.5 sm:gap-1">
                                        <span className="text-xs sm:text-xl font-bold opacity-80">₡</span>
                                        <h3 className="text-sm sm:text-3xl font-black tracking-tighter font-mono leading-none">
                                            {stats.currentBalance.toLocaleString()}
                                        </h3>
                                    </div>
                                    <div className="mt-1 sm:mt-2 flex flex-col gap-0.5 sm:gap-1">
                                        <div className="flex items-center gap-0.5 sm:gap-1 text-[6px] sm:text-[10px] font-bold bg-white/10 w-fit px-1 sm:px-2 py-0.5 rounded-full">
                                            {activeSession && !selectedSessionId ? <Unlock size={8} className="shrink-0" /> : <Lock size={8} className="shrink-0" />}
                                            <span>{activeSession && !selectedSessionId ? "Sesión activa" : "Cierre finalizado"}</span>
                                        </div>
                                        <p className="text-[6px] sm:text-[10px] font-medium opacity-70 ml-0.5 sm:ml-1 leading-tight break-words">
                                            {stats.isLastClosure && lastSession?.closedAt
                                                ? `Cerrado el ${format((lastSession.closedAt as any).toDate(), "dd/MM HH:mm")}${lastSession.closedByUserName ? ` por ${lastSession.closedByUserName}` : ''}`
                                                : `Base inicial: ₡${stats.base.toLocaleString()}`}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* List of Movements */}
                        <Card className="min-h-[400px]">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <History className="w-5 h-5 text-primary/60" />
                                        {selectedSessionId && selectedSessionId !== activeSession?.id
                                            ? `Movimientos del ${format(recentSessions.find(s => s.id === selectedSessionId)?.openedAt ? (recentSessions.find(s => s.id === selectedSessionId)?.openedAt as any).toDate() : new Date(), "dd 'de' MMMM", { locale: es })}`
                                            : "Movimientos del Día"}
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        {selectedSessionId && selectedSessionId !== activeSession?.id
                                            ? "Historial de transacciones de esta sesión"
                                            : "Detalle de entradas y salidas de hoy"}
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    {selectedSessionId && selectedSessionId !== activeSession?.id && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setSelectedSessionId(null)}
                                            className="h-8 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20"
                                        >
                                            <ArrowRightLeft className="w-3 h-3 mr-1" />
                                            Hoy
                                        </Button>
                                    )}
                                    <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg w-full sm:w-auto overflow-x-auto no-scrollbar">
                                        <div className="relative group/select">
                                            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground z-10 pointer-events-none group-focus-within/select:text-primary transition-colors" />
                                            <Select value={filterType} onValueChange={(val) => { setFilterType(val); setFilterCategory('all'); }}>
                                                <SelectTrigger className="w-[110px] sm:w-[120px] h-8 text-[11px] font-bold pl-7 bg-white/50 border-none shadow-none hover:bg-white transition-all">
                                                    <SelectValue placeholder="Tipo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all" className="text-[11px]">Todos</SelectItem>
                                                    <SelectItem value="income" className="text-[11px] text-green-600 font-medium">Ingresos</SelectItem>
                                                    <SelectItem value="expense" className="text-[11px] text-red-500 font-medium">Gastos</SelectItem>
                                                    <SelectItem value="withdrawal" className="text-[11px] text-blue-600 font-medium">Retiros</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="relative group/select">
                                            <Settings className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground z-10 pointer-events-none group-focus-within/select:text-primary transition-colors" />
                                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                                <SelectTrigger className="w-[130px] sm:w-[140px] h-8 text-[11px] font-bold pl-7 bg-white/50 border-none shadow-none hover:bg-white transition-all">
                                                    <SelectValue placeholder="Categoría" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all" className="text-[11px]">Categorías</SelectItem>
                                                    {(filterType === 'all' || filterType === 'income') && (
                                                        <>
                                                            <SelectItem value="venta" className="text-[11px]">Venta</SelectItem>
                                                            <SelectItem value="aporte" className="text-[11px]">Aporte Extra.</SelectItem>
                                                        </>
                                                    )}
                                                    {(filterType === 'all' || filterType === 'expense') && (
                                                        <>
                                                            <SelectItem value="gasto" className="text-[11px]">Gasto Gral.</SelectItem>
                                                            <SelectItem value="pago_proveedor" className="text-[11px]">Proveedores</SelectItem>
                                                            <SelectItem value="nomina" className="text-[11px]">Nómina</SelectItem>
                                                        </>
                                                    )}
                                                    {(filterType === 'all' || filterType === 'withdrawal') && (
                                                        <SelectItem value="corte_parcial" className="text-[11px]">Retiro Excedente</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {(filterType !== 'all' || filterCategory !== 'all') && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                onClick={() => { setFilterType('all'); setFilterCategory('all'); }}
                                                title="Limpiar filtros"
                                            >
                                                <X size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {filteredTransactions.length === 0 ? (
                                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                                            <Clock size={40} className="mb-2 opacity-20" />
                                            <p>{transactions.length === 0 ? "Aún no hay movimientos registrados hoy" : "No hay movimientos que coincidan con el filtro"}</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            {[...filteredTransactions].reverse().map((tx) => (
                                                <div key={tx.id} className="py-3 flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "p-2 rounded-full",
                                                            tx.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                                        )}>
                                                            {tx.type === 'income' ? <Plus size={16} /> : <Minus size={16} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold capitalize">
                                                                {tx.category.replace('_', ' ')}
                                                                {tx.source === 'alegra_api' && (
                                                                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-normal">API</span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">{tx.description || "Sin descripción"}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={cn("text-sm font-bold font-mono", tx.type === 'income' ? "text-green-600" : "text-red-500")}>
                                                            {tx.type === 'income' ? '+' : '-'}₡{tx.amount.toLocaleString()}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground italic">
                                                            {/* @ts-ignore */}
                                                            {format(tx.createdAt.toDate ? tx.createdAt.toDate() : tx.createdAt, "dd/MM/yyyy • HH:mm aaa")}
                                                            {tx.userName && ` • ${tx.userName}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div> {/* end of left column */}

                    {/* RIGHT COLUMN: Actions Sidebar */}
                    <div className="w-full md:w-80 lg:w-96 space-y-6">

                        {!activeSession ? (
                            <Card className="border-primary/50 bg-primary/5 overflow-hidden">
                                <div className="p-6 text-center space-y-4">
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                                        <Lock size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold">Caja Cerrada</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Para registrar movimientos necesitas abrir una nueva sesión diaria.
                                    </p>

                                    {pendingTransactions.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-md text-left flex items-start gap-2">
                                            <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                            <div>
                                                <p className="text-xs font-bold text-blue-800">Sala de Espera</p>
                                                <p className="text-[11px] text-blue-700">
                                                    Tienes {pendingTransactions.length} transacciones de Alegra esperando a ser aplicadas (₡{stats.pendingTotal}).
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <Dialog open={isOpeningDialogOpen} onOpenChange={setIsOpeningDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="w-full h-12 text-lg shadow-lg">Abrir Caja</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Abrir Caja de Hoy</DialogTitle>
                                                <DialogDescription>
                                                    Establece el monto inicial físico que tienes en caja.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4 space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="baseAmount">Monto Inicial (Base)</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-muted-foreground">₡</span>
                                                        <Input
                                                            id="baseAmount"
                                                            type="number"
                                                            className="pl-8"
                                                            value={openingBalance}
                                                            onChange={(e) => setOpeningBalance(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                {pendingTransactions.length > 0 && (
                                                    <div className="p-3 rounded-lg bg-muted flex items-center gap-3">
                                                        <CheckCircle2 className="text-blue-500" size={20} />
                                                        <p className="text-xs font-medium">
                                                            Se aplicarán automáticamente ₡{stats.pendingTotal} de transacciones pendientes.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsOpeningDialogOpen(false)}>Cancelar</Button>
                                                <Button onClick={handleOpenCaja}>Confirmar Apertura</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </Card>
                        ) : (
                            <>
                                {/* Income Form */}
                                <Card className="border-green-200 shadow-sm">
                                    <CardHeader className="py-2.5 border-b border-green-50 bg-green-50/20">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-green-700">
                                            <TrendingUp size={16} /> Registrar Ingreso
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            handleAddTransaction('income');
                                        }} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Origen</Label>
                                                    <Select
                                                        value={incomeForm.category}
                                                        onValueChange={(val: any) => setIncomeForm({ ...incomeForm, category: val })}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue placeholder="Tipo" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="venta">Venta</SelectItem>
                                                            <SelectItem value="aporte">Aporte Extra.</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase">Monto</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-9 font-mono font-bold"
                                                        placeholder="0.00"
                                                        value={incomeForm.amount}
                                                        onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {incomeForm.category === 'venta' && (
                                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase">Factura / Transacción</Label>
                                                    <Input
                                                        placeholder="N° de Documento"
                                                        className="h-9 border-blue-200 focus-visible:ring-blue-500"
                                                        value={incomeForm.invoiceNumber}
                                                        onChange={(e) => setIncomeForm({ ...incomeForm, invoiceNumber: e.target.value })}
                                                    />
                                                </div>
                                            )}
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Descripción</Label>
                                                <Input
                                                    placeholder="Nota (opcional)"
                                                    className="h-9"
                                                    value={incomeForm.description}
                                                    onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                                                />
                                            </div>
                                            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 h-9">
                                                Agregar Ingreso
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>

                                {/* Expense Form */}
                                <Card className="border-red-200 shadow-sm">
                                    <CardHeader className="py-2.5 border-b border-red-50 bg-red-50/20">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700">
                                            <TrendingDown size={16} /> Registrar Gasto
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            handleAddTransaction('expense');
                                        }} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Motivo</Label>
                                                    <Select
                                                        value={expenseForm.category}
                                                        onValueChange={(val: any) => setExpenseForm({ ...expenseForm, category: val })}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue placeholder="Tipo" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="gasto">Gasto Gral.</SelectItem>
                                                            <SelectItem value="pago_proveedor">Proveedores</SelectItem>
                                                            <SelectItem value="nomina">Nómina</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Monto</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-9"
                                                        placeholder="0.00"
                                                        value={expenseForm.amount}
                                                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Descripción</Label>
                                                <Input
                                                    placeholder="Nota (obligatoria)"
                                                    className="h-9"
                                                    value={expenseForm.description}
                                                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                                />
                                            </div>
                                            <Button type="submit" variant="destructive" className="w-full h-9">
                                                Registrar Gasto
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>

                                {/* Partial Withdrawal Section */}
                                <div className="pt-4 grid grid-cols-1 gap-3">
                                    <Dialog open={isPartialWithdrawalOpen} onOpenChange={setIsPartialWithdrawalOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full border-2 border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-600 hover:text-white hover:border-blue-600 h-11 font-bold shadow-sm gap-2 transition-all duration-300 group"
                                            >
                                                <ArrowRightLeft size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                                                Retiro de Excedente
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Retiro de Excedente (Corte Parcial)</DialogTitle>
                                                <DialogDescription>
                                                    Registra un retiro parcial de efectivo para bancos o caja fuerte sin cerrar la caja.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4 space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="partialAmount">Monto a Retirar</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-muted-foreground">₡</span>
                                                        <Input
                                                            id="partialAmount"
                                                            type="number"
                                                            className="pl-8"
                                                            placeholder="0"
                                                            value={partialWithdrawalAmount}
                                                            onChange={(e) => setPartialWithdrawalAmount(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="partialNote">Nota de Destino</Label>
                                                    <Input
                                                        id="partialNote"
                                                        placeholder="Ej: Depósito BAC, Caja Fuerte, etc."
                                                        value={partialWithdrawalNote}
                                                        onChange={(e) => setPartialWithdrawalNote(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsPartialWithdrawalOpen(false)}>Cancelar</Button>
                                                <Button onClick={handlePartialWithdrawal} className="bg-blue-600 hover:bg-blue-700">Confirmar Retiro</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    <Dialog open={isClosingDialogOpen} onOpenChange={setIsClosingDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full border-2 border-red-200 text-red-700 bg-red-50/50 hover:bg-red-600 hover:text-white hover:border-red-600 h-12 font-black shadow-md transition-all duration-300"
                                            >
                                                Cerrar Caja de Hoy
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Cierre de Caja Final</DialogTitle>
                                                <DialogDescription>
                                                    Confirma el saldo final para dar por terminada la jornada.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4 space-y-6">
                                                <div className="bg-blue-50 p-6 rounded-2xl flex flex-col items-center justify-center border border-blue-200 gap-2">
                                                    <span className="text-xs font-black uppercase tracking-widest text-blue-900">Monto Final: [Saldo en caja]</span>
                                                    <span className="text-4xl font-black font-mono text-blue-800">₡{stats.currentBalance.toLocaleString()}</span>
                                                    <p className="text-[10px] text-blue-900/60 text-center mt-2 px-4 font-medium">
                                                        Este monto se establecerá automáticamente como el saldo inicial para la próxima apertura.
                                                    </p>
                                                </div>

                                                <div className="space-y-4 pt-2">
                                                    <div className={cn(
                                                        "flex items-start space-x-3 p-4 rounded-xl border transition-all duration-300",
                                                        isResponsibilityConfirmed
                                                            ? "bg-emerald-50 border-emerald-200 shadow-sm"
                                                            : "bg-muted/30 border-dashed border-muted-foreground/20"
                                                    )}>
                                                        <Checkbox
                                                            id="confirmResponsibility"
                                                            checked={isResponsibilityConfirmed}
                                                            onCheckedChange={(checked: boolean) => setIsResponsibilityConfirmed(checked)}
                                                            className="mt-1"
                                                        />
                                                        <div className="grid gap-1.5 leading-none cursor-pointer" onClick={() => setIsResponsibilityConfirmed(!isResponsibilityConfirmed)}>
                                                            <Label htmlFor="confirmResponsibility" className="text-sm font-black text-foreground cursor-pointer">
                                                                CONFIRMACIÓN DE RESPONSABILIDAD
                                                            </Label>
                                                            <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                                                                "Certifico que he verificado físicamente el dinero en caja, confirmo que el saldo mostrado es correcto y asumo la responsabilidad total por este cierre y la integridad de los fondos."
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <DialogFooter className="gap-2 sm:gap-0">
                                                <Button variant="outline" onClick={() => setIsClosingDialogOpen(false)}>Cancelar</Button>
                                                <Button
                                                    variant="destructive"
                                                    className="font-black px-8"
                                                    disabled={!isResponsibilityConfirmed}
                                                    onClick={handleCloseCaja}
                                                >
                                                    EFECTUAR CIERRE
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </>
                        )
                        }

                        {/* Recent Closures */}
                        <Card>
                            <CardHeader className="pb-3 border-b border-muted">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <History size={16} /> Últimos Cierres
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 px-2">
                                <div className="space-y-1">
                                    {recentSessions.length === 0 ? (
                                        <p className="text-xs text-center text-muted-foreground py-4">No hay cierres recientes</p>
                                    ) : (
                                        recentSessions.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => setSelectedSessionId(s.id)}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-2 rounded-md transition-colors text-left",
                                                    selectedSessionId === s.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted"
                                                )}
                                            >
                                                <div>
                                                    <p className="text-xs font-bold">
                                                        {format(s.openedAt ? (s.openedAt as any).toDate() : new Date(), "EEEE dd/MM", { locale: es })}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground flex flex-col gap-0.5 mt-0.5">
                                                        <span>Físico: ₡{s.closingTotalPhysical?.toLocaleString() || s.closingBalance?.toLocaleString() || "0"}
                                                            {s.closingBankDeposit !== undefined && ` • Depósito: ₡${s.closingBankDeposit.toLocaleString()}`}</span>
                                                        {s.closedByUserName && (
                                                            <span className="font-medium text-primary/70 italic text-[9px]">Cerrado por: {s.closedByUserName}</span>
                                                        )}
                                                    </p>
                                                </div>
                                                <ChevronRight size={14} className="text-muted-foreground" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div> {/* end of right column */}
                </div> {/* end of flex layout */}
            </main>

            {/* Cash Calculator Dialog */}
            <Dialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen}>
                <DialogContent
                    className="sm:max-w-[480px] w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-primary" />
                            Calculadora de Caja
                        </DialogTitle>
                        <DialogDescription>
                            Conteo de efectivo para el cierre de caja. No se guardan registros.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 space-y-4 overflow-y-auto pr-1 flex-1 scrollbar-thin">
                        {/* Monedas */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-1">Monedas (CRC)</p>
                            <div className="space-y-1.5">
                                {COIN_DENOMINATIONS.map(denom => {
                                    const count = parseInt(calculatorCounts[denom] || "0", 10);
                                    const subtotal = isNaN(count) ? 0 : count * denom;
                                    return (
                                        <div key={denom} className="flex items-center gap-2 sm:gap-4 py-0.5">
                                            <span className="text-sm font-bold font-mono w-16 sm:w-20 text-right bg-muted/50 px-2 py-1.5 rounded-md shrink-0">
                                                ₡{denom.toLocaleString()}
                                            </span>
                                            <span className="text-muted-foreground text-xs shrink-0">×</span>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={calculatorCounts[denom]}
                                                onChange={(e) => setCalculatorCounts(prev => ({ ...prev, [denom]: e.target.value }))}
                                                className="w-20 sm:w-24 h-10 px-2 text-base font-mono text-center border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 no-spinner shrink-0"
                                            />
                                            <span className="text-muted-foreground text-xs shrink-0">=</span>
                                            <span className={`flex-1 text-base font-bold font-mono text-right truncate ${subtotal > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                                ₡{subtotal.toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Billetes */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-1">Billetes (CRC)</p>
                            <div className="space-y-1.5">
                                {BILL_DENOMINATIONS.map(denom => {
                                    const count = parseInt(calculatorCounts[denom] || "0", 10);
                                    const subtotal = isNaN(count) ? 0 : count * denom;
                                    return (
                                        <div key={denom} className="flex items-center gap-2 sm:gap-4 py-0.5">
                                            <span className="text-sm font-bold font-mono w-16 sm:w-20 text-right bg-muted/50 px-2 py-1.5 rounded-md shrink-0">
                                                ₡{denom.toLocaleString()}
                                            </span>
                                            <span className="text-muted-foreground text-xs shrink-0">×</span>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={calculatorCounts[denom]}
                                                onChange={(e) => setCalculatorCounts(prev => ({ ...prev, [denom]: e.target.value }))}
                                                className="w-20 sm:w-24 h-10 px-2 text-base font-mono text-center border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 no-spinner shrink-0"
                                            />
                                            <span className="text-muted-foreground text-xs shrink-0">=</span>
                                            <span className={`flex-1 text-base font-bold font-mono text-right truncate ${subtotal > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                                ₡{subtotal.toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between mt-2 shrink-0">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total en Caja</p>
                            <p className="text-3xl font-black font-mono text-primary tracking-tighter mt-0.5">
                                ₡{calculatorTotal.toLocaleString()}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-8"
                            onClick={() => setCalculatorCounts(Object.fromEntries(ALL_DENOMINATIONS.map(d => [d, ""])))}
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Limpiar
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCalculatorOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Global History Dialog */}
            <Dialog open={isGlobalHistoryOpen} onOpenChange={setIsGlobalHistoryOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Historial Global (10 Días)</DialogTitle>
                        <DialogDescription>
                            Registro de todos los cierres de caja en todas las sucursales durante los últimos 10 días.
                        </DialogDescription>
                    </DialogHeader>
                    {isLoadingGlobal ? (
                        <div className="py-12 flex justify-center items-center text-muted-foreground">
                            Cargando historial...
                        </div>
                    ) : globalRecentSessions.length === 0 ? (
                        <div className="py-12 flex justify-center items-center text-muted-foreground items-center gap-2">
                            <History size={20} className="opacity-50" />
                            <p>No hay cierres registrados en los últimos 10 días.</p>
                        </div>
                    ) : (
                        <div className="relative overflow-y-auto rounded-md border flex-1 custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase sticky top-0 backdrop-blur-sm z-10">
                                    <tr>
                                        <th className="px-4 py-3">Apertura</th>
                                        <th className="px-4 py-3">Sucursal</th>
                                        <th className="px-4 py-3">Cerrado por</th>
                                        <th className="px-4 py-3 text-right">Efectivo Fís.</th>
                                        <th className="px-4 py-3 text-right">Depósito</th>
                                        <th className="px-4 py-3 text-right bg-muted/30">Total Cierre</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y relative">
                                    {globalRecentSessions.map(session => (
                                        <tr key={session.id} className="bg-card hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                {format(session.openedAt ? (session.openedAt as any).toDate() : new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{branches.find(b => b.id === session.branchId)?.name || 'Desconocida'}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Caja: {session.cajaName || session.cajaId?.substring(0, 8)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span>{session.closedByUserName || "Sistema"}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-emerald-600 font-mono">
                                                ₡{(session.closingTotalPhysical || session.closingBalance || 0).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {session.closingBankDeposit !== undefined ? `₡${session.closingBankDeposit.toLocaleString()}` : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold font-mono bg-muted/10">
                                                ₡{((session.closingTotalPhysical || session.closingBalance || 0) + (session.closingBankDeposit || 0)).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
