
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PricingCalculator } from './_components/pricing-calculator';
import { RulesManager } from './_components/rules-manager';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { PricingSettings } from '@/lib/pricing-types';
import { Loader } from 'lucide-react';

const OWNER_EMAIL = 'stevensb.2003@gmail.com';

export default function PreciosDescuentosPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [activeTab, setActiveTab] = useState('calculadora');

    // Load user profile to check for module permissions
    const profileRef = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user?.uid, firestore]);
    const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

    // Load pricing settings to check for delegated admins
    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'pricing_settings', 'global');
    }, [firestore]);
    const { data: settings, isLoading: isSettingsLoading } = useDoc<PricingSettings>(settingsRef);

    const isAdmin = useMemo(() => {
        if (!user) return false;
        if (user.email === OWNER_EMAIL) return true;
        if (profile?.isAdmin) return true;

        // Check for delegated admin in module settings
        if (user.email && settings?.delegatedAdmins?.includes(user.email)) return true;

        return false;
    }, [user, profile, settings]);

    if (isUserLoading || isProfileLoading || isSettingsLoading) {
        return (
            <div className="flex h-screen flex-col">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Header />
            <main className="flex-1 container mx-auto py-8 px-4 max-w-5xl">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Precios & Descuentos</h1>
                    <p className="text-muted-foreground">
                        Calcula descuentos de venta y configura parámetros de negocio.
                    </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
                        <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
                        <TabsTrigger value="admin" disabled={!isAdmin}>Configuración</TabsTrigger>
                    </TabsList>

                    <TabsContent value="calculadora" className="space-y-4">
                        <PricingCalculator />
                    </TabsContent>

                    {isAdmin && (
                        <TabsContent value="admin" className="space-y-4">
                            <RulesManager settings={settings} />
                        </TabsContent>
                    )}
                </Tabs>
            </main>
        </div>
    );
}
