
"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, FileText, FolderKanban } from "lucide-react";
import { useUser } from "@/firebase";
import { Header } from "@/components/layout/header";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CashSummaryWidget } from "@/components/cash-control/summary-widget";
import { Wallet, Package, ShieldCheck, Tag, TrendingUp, Network, CreditCard } from "lucide-react";
import { useFirestore, useDoc } from "@/firebase";
import { UserProfile } from "@/lib/types";
import { doc } from "firebase/firestore";
import { useMemo } from "react";

export default function WelcomePage() {
  const { user, isUserLoading, userError } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  const allowedModules = profile?.permissions?.allowedModules || [];
  const isAdmin = profile?.isAdmin || user?.email === 'stevensb.2003@gmail.com';

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p>Cargando autenticación...</p>
        </div>
      </div>
    );
  }

  /* Added error handling display */
  if (userError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center border p-6 rounded shadow bg-destructive/10">
          <h2 className="text-xl font-bold text-destructive mb-2">Error de Autenticación</h2>
          <p>{userError.message}</p>
          <div className="mt-4">
            <Link href="/login" className="text-primary hover:underline">Ir al Login</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null; // Avoid flashing content while redirecting

  return (
    <>
      <Header />
      <CashSummaryWidget />
      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-start min-h-[calc(100vh-8rem)] bg-background text-center p-3 md:p-8 pt-6 md:pt-12">
          <header className="mb-6 md:mb-10 px-4">
            <Image src="/Logotipo_Azul.png" alt="DecoInnova Logo" width={220} height={66} className="mx-auto mb-3 object-contain md:w-[280px]" />
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-headline mb-2">
              Bienvenido a tu Suite de Herramientas
            </h1>
            <p className="text-muted-foreground text-sm md:text-lg max-w-2xl mx-auto">
              Selecciona una herramienta para comenzar.
            </p>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 w-full max-w-7xl px-2 md:px-0 pb-12">
            {(isAdmin || allowedModules.includes('calculator')) && (
              <ToolCard
                href="/calculator"
                icon={<Calculator className="h-7 w-7 md:h-10 md:w-10 text-primary" />}
                title="Calculadora"
                description="Calcula precios, IVA, inventario y más."
              />
            )}
            {(isAdmin || allowedModules.includes('projects')) && (
              <ToolCard
                href="/project/new"
                icon={<FileText className="h-7 w-7 md:h-10 md:w-10 text-green-500" />}
                title="Nuevo Proyecto"
                description="Crea un nuevo proyecto y define sus materiales."
              />
            )}
            {(isAdmin || allowedModules.includes('projects')) && (
              <ToolCard
                href="/projects"
                icon={<FolderKanban className="h-7 w-7 md:h-10 md:w-10 text-yellow-500" />}
                title="Mis Proyectos"
                description="Visualiza y gestiona todos tus proyectos."
              />
            )}
            {(isAdmin || allowedModules.includes('inventory')) && (
              <ToolCard
                href="/materials"
                icon={<Package className="h-7 w-7 md:h-10 md:w-10 text-purple-500" />}
                title="Materiales"
                description="Administra el catálogo y sus dimensiones."
              />
            )}
            {(isAdmin || allowedModules.includes('caja')) && (
              <ToolCard
                href="/caja"
                icon={<Wallet className="h-7 w-7 md:h-10 md:w-10 text-blue-500" />}
                title="Caja"
                description="Aperturas, cierres, ingresos y egresos."
              />
            )}
            {(isAdmin || allowedModules.includes('pricing')) && (
              <ToolCard
                href="/precios-descuentos"
                icon={<Tag className="h-7 w-7 md:h-10 md:w-10 text-pink-500" />}
                title="Precios"
                description="Calculadora de descuentos y configuración."
              />
            )}
            {(isAdmin || allowedModules.includes('admin')) && (
              <ToolCard
                href="/admin"
                icon={<ShieldCheck className="h-7 w-7 md:h-10 md:w-10 text-red-500" />}
                title="Panel Admin"
                description="Gestión de usuarios y accesos al sistema."
              />
            )}
            {(isAdmin || allowedModules.includes('admin')) && (
              <ToolCard
                href="/admin/alegra"
                icon={<TrendingUp className="h-7 w-7 md:h-10 md:w-10 text-indigo-500" />}
                title="Contabilidad"
                description="Sincroniza ventas y facturas de Alegra."
              />
            )}
            {(isAdmin || allowedModules.includes('procesos')) && (
              <ToolCard
                href="/procesos"
                icon={<Network className="h-7 w-7 md:h-10 md:w-10 text-cyan-500" />}
                title="Procesos"
                description="Directorio de procesos y mapas conceptuales."
              />
            )}
            {(isAdmin || allowedModules.includes('tilopay')) && (
              <ToolCard
                href="/tilopay"
                icon={<CreditCard className="h-7 w-7 md:h-10 md:w-10 text-indigo-600" />}
                title="Cobros Tilopay"
                description="Genera y gestiona links de pago rápidos."
              />
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function ToolCard({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string; }) {
  return (
    <Link href={href} className="group outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl block h-full">
      <Card className="h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out border-muted/60 bg-card/50 backdrop-blur-sm rounded-2xl overflow-hidden flex flex-col justify-start">
        <CardHeader className="items-center pb-2 pt-4 md:pt-6">
          <div className="p-2.5 md:p-3 rounded-2xl bg-background/80 shadow-sm border border-muted/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            {icon}
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-5 md:px-5 md:pb-6 text-center flex-grow flex flex-col justify-start">
          <CardTitle className="text-sm md:text-lg font-semibold mb-1 line-clamp-2 leading-tight">{title}</CardTitle>
          <CardDescription className="text-[11px] md:text-sm line-clamp-2 leading-snug">{description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
