"use client";

import { Header } from "@/components/layout/header";
import { Users } from "lucide-react";

export default function CRMPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-zinc-950/50">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 text-center">
        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Users className="h-10 w-10 text-primary opacity-80" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-headline mb-4">Módulo CRM</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Próximamente... Aquí podrás gestionar tus clientes y dar seguimiento a tus prospectos.
        </p>
      </main>
    </div>
  );
}
