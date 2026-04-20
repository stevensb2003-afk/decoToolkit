"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Lock, Unlock, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { CashSession, CashTransaction, UserProfile } from "@/lib/types";
import { getOpenCashSession, getSessionTransactions } from "@/lib/cash-control";
import { useUser, useFirestore, useDoc } from "@/firebase";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { doc, onSnapshot, query, where, collection, limit, getDoc } from "firebase/firestore";

export function CashSummaryWidget() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [session, setSession] = useState<CashSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ income: 0, expense: 0 });
    const [defaultCajaId, setDefaultCajaId] = useState<string | null>(null);
    const [defaultCajaName, setDefaultCajaName] = useState<string | null>(null);
    const [branchName, setBranchName] = useState<string | null>(null);

    const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

    const [claims, setClaims] = useState<{ admin?: boolean }>({});
    const [isClaimsLoading, setIsClaimsLoading] = useState(true);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            setIsClaimsLoading(false);
            return;
        }
        user.getIdTokenResult().then((idTokenResult) => {
            setClaims({ admin: !!idTokenResult.claims.admin });
            setIsClaimsLoading(false);
        }).catch(error => {
            console.error("Error getting user token:", error);
            setIsClaimsLoading(false);
        });
    }, [user, isUserLoading]);

    const isAdmin = claims.admin === true || profile?.isAdmin === true;
    const allowedModules = profile?.permissions?.allowedModules || [];
    const hasCajaAccess = isAdmin || allowedModules.includes('caja');

    // 1. Escuchar la configuración global para saber cuál es la caja principal
    useEffect(() => {
        if (!firestore) return;
        const settingsRef = doc(firestore, 'settings', 'alegra');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDefaultCajaId(data.defaultCajaId || null);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [firestore]);

    // 2. Escuchar la sesión activa y metadata (nombres) de esa caja específica
    useEffect(() => {
        if (!firestore || !defaultCajaId) {
            if (!defaultCajaId) setLoading(false);
            return;
        }

        let isMounted = true;

        // Primero: Obtener metadata de la caja y sucursal (Nombre de Caja y Nombre de Sucursal)
        const fetchMetadataAndListen = async () => {
            try {
                const cajaSnap = await getDoc(doc(firestore, 'cashRegisters', defaultCajaId));
                if (cajaSnap.exists() && isMounted) {
                    const cajaData = cajaSnap.data();
                    setDefaultCajaName(cajaData.name || "Caja Principal");
                    if (cajaData.branchId) {
                        const branchSnap = await getDoc(doc(firestore, 'branches', cajaData.branchId));
                        if (branchSnap.exists() && isMounted) {
                            setBranchName((branchSnap.data() as any).name || "Sucursal");
                        } else if (isMounted) {
                            setBranchName("Sucursal");
                        }
                    } else if (isMounted) {
                        setBranchName("Sucursal");
                    }
                } else if (isMounted) {
                    setDefaultCajaName("Caja Principal");
                    setBranchName("Sucursal");
                }

                // Segundo: Escuchar la sesión activa en tiempo real
                const q = query(
                    collection(firestore, 'cashSessions'),
                    where('cajaId', '==', defaultCajaId),
                    where('status', '==', 'open'),
                    limit(1)
                );

                return onSnapshot(q, (snapshot) => {
                    if (!snapshot.empty && isMounted) {
                        const sessionData = snapshot.docs[0].data() as CashSession;
                        setSession(sessionData);
                        // Si la sesión tiene un nombre de caja específico, lo usamos
                        if (sessionData.cajaName) setDefaultCajaName(sessionData.cajaName);
                    } else if (isMounted) {
                        setSession(null);
                    }
                    if (isMounted) setLoading(false);
                });
            } catch (error) {
                console.error("Error fetching caja/branch metadata:", error);
                if (isMounted) {
                    setDefaultCajaName("Caja");
                    setBranchName("Sucursal");
                    setLoading(false);
                }
                return () => { };
            }
        };

        const unsubPromise = fetchMetadataAndListen();

        return () => {
            isMounted = false;
            unsubPromise.then(unsub => unsub && unsub());
        };
    }, [firestore, defaultCajaId]);

    // 3. Escuchar transacciones de la sesión activa en tiempo real
    useEffect(() => {
        if (!firestore || !session?.id) {
            setSummary({ income: 0, expense: 0 });
            return;
        }

        const q = query(
            collection(firestore, 'cashTransactions'),
            where('sessionId', '==', session.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const trans = snapshot.docs.map(d => d.data() as CashTransaction);
            const inc = trans.filter(t => t.type === 'income').reduce((acc: number, curr: CashTransaction) => acc + curr.amount, 0);
            const exp = trans.filter(t => t.type === 'expense').reduce((acc: number, curr: CashTransaction) => acc + curr.amount, 0);
            setSummary({ income: inc, expense: exp });
        });

        return () => unsubscribe();
    }, [firestore, session?.id]);

    if (loading || isUserLoading || isProfileLoading || isClaimsLoading) {
        return (
            <div className="w-full bg-muted/30 p-2 flex justify-center items-center h-14 border-b border-border/50">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary/50" />
                <span className="text-xs font-medium text-muted-foreground/70">Sincronizando caja...</span>
            </div>
        );
    }

    const isOpen = !!session;
    const total = (session?.openingBalance || 0) + summary.income - summary.expense;

    // Full mode for authorized users, Lite mode for others
    if (!hasCajaAccess) {
        return (
            <div
                className={cn(
                    "w-full transition-all duration-500 border-b relative overflow-hidden z-30 py-2",
                    isOpen
                        ? "bg-emerald-50/50 border-emerald-100"
                        : "bg-orange-50/50 border-orange-100"
                )}
            >
                <div className="container mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-1.5 rounded-lg text-white",
                            isOpen ? "bg-emerald-600" : "bg-orange-500"
                        )}>
                            {isOpen ? <Unlock size={14} /> : <Lock size={14} />}
                        </div>
                        <div className="flex flex-col">
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                isOpen ? "text-emerald-700" : "text-orange-700"
                            )}>
                                {branchName || '...'} — {defaultCajaName || '...'}
                            </span>
                            <span className={cn(
                                "text-sm font-bold",
                                isOpen ? "text-emerald-900" : "text-orange-900"
                            )}>
                                {isOpen ? "ABIERTA (Ventas activas)" : "CERRADA (Sin operación)"}
                            </span>
                        </div>
                    </div>
                    {!isOpen && (
                        <p className="text-[10px] italic text-orange-600 font-medium hidden sm:block">
                            * Notifica al administrador para iniciar jornada en {defaultCajaName || '...'} ({branchName || '...'})
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "w-full transition-all duration-500 border-b relative overflow-hidden z-30",
                isOpen
                    ? "bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-emerald-100"
                    : "bg-gradient-to-r from-orange-50 via-white to-orange-50 border-orange-100 shadow-[0_4px_12px_-4px_rgba(249,115,22,0.15)]"
            )}
        >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] pointer-events-none" />

            <div className="container mx-auto px-4 py-3 relative flex flex-col md:flex-row items-center justify-between gap-4">

                {/* Status Indicator Section */}
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "relative p-3 rounded-2xl shadow-sm transition-all duration-500",
                        isOpen ? "bg-emerald-600 text-white" : "bg-orange-500 text-white animate-pulse"
                    )}>
                        {isOpen ? <Unlock size={22} className="drop-shadow-sm" /> : <Lock size={22} className="drop-shadow-sm" />}
                        {!isOpen && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                            </span>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded",
                                isOpen ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                            )}>
                                {branchName || '...'}
                            </span>
                        </div>
                        <h2 className={cn(
                            "text-2xl font-black tracking-tighter leading-none",
                            isOpen ? "text-emerald-900" : "text-orange-900"
                        )}>
                            {isOpen ? "CAJA ABIERTA" : "CAJA CERRADA"} {defaultCajaName ? `— ${defaultCajaName}` : ''}
                        </h2>
                    </div>
                </div>

                {/* Data Section */}
                {isOpen ? (
                    <div className="flex items-center gap-2 sm:gap-8 bg-white/60 backdrop-blur-md p-2 px-4 rounded-2xl border border-emerald-100/50 shadow-inner">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-emerald-100 rounded-lg">
                                <ArrowUpCircle className="text-emerald-600" size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Ingresos</p>
                                <p className="text-base font-black font-mono text-emerald-700">₡{summary.income.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-emerald-200/50" />

                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-rose-100 rounded-lg">
                                <ArrowDownCircle className="text-rose-600" size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Egresos</p>
                                <p className="text-base font-black font-mono text-rose-600">-₡{summary.expense.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="h-10 w-px bg-emerald-200/50 hidden lg:block" />

                        <div className="hidden lg:block min-w-[120px]">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Balance Neto</p>
                            <p className={cn(
                                "text-lg font-black font-mono",
                                total >= 0 ? "text-emerald-700" : "text-rose-700"
                            )}>
                                {total >= 0 ? '+' : ''}₡{total.toLocaleString()}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-orange-700/80 bg-orange-100/50 px-4 py-2 rounded-full border border-orange-200/40">
                            <AlertCircle size={16} className="animate-bounce" />
                            <p className="text-sm font-bold italic tracking-tight">Atención: No olvides abrir "{defaultCajaName || '...'}" en {branchName || '...'} para iniciar las ventas</p>
                        </div>
                    </div>
                )}

                {/* Call to Action Section */}
                <div className="flex items-center gap-3">
                    {!isOpen ? (
                        <Button
                            asChild
                            className="bg-orange-600 hover:bg-orange-700 text-white font-black px-6 h-12 rounded-xl shadow-[0_4px_14px_0_rgba(249,115,22,0.39)] transition-all hover:scale-105 active:scale-95 text-base gap-2 group"
                        >
                            <Link href="/caja">
                                <Unlock size={18} />
                                ABRIR CAJA
                                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                            </Link>
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="outline" asChild className="h-11 rounded-xl font-bold border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-800 transition-all px-6">
                                <Link href="/caja">
                                    GESTIONAR
                                </Link>
                            </Button>
                            <Button variant="destructive" asChild className="h-11 rounded-xl font-bold shadow-sm px-6">
                                <Link href="/caja?action=close">
                                    CERRAR
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
