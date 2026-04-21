'use client';

import React from 'react';
import { useUser } from '@/firebase/provider';
import { Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface MaintenanceGateProps {
  children: React.ReactNode;
}

export function MaintenanceGate({ children }: MaintenanceGateProps) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  // Lista de correos de administradores (puedes añadir más si es necesario)
  // Lo ideal es que esto venga de una variable de entorno como process.env.NEXT_PUBLIC_ADMIN_EMAILS
  const adminEmails = [
    process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    'stevensb.2003@gmail.com', // <-- Tu correo exacto
  ].filter(Boolean);

  // Si está cargando el usuario, mostramos un spinner para que no haya parpadeo
  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si hay un usuario logueado Y su correo está en la lista de admins, le mostramos la app normal
  if (user && user.email && adminEmails.includes(user.email)) {
    return <>{children}</>;
  }

  // Para cualquier otro usuario (logueado o no logueado), mostramos la pantalla de mantenimiento
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4 text-center">
      <div className="max-w-md w-full bg-background p-8 rounded-2xl shadow-sm border border-border flex flex-col items-center space-y-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
          <Wrench className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">App en Construcción</h1>
          <p className="text-muted-foreground">
            Estamos trabajando en increíbles actualizaciones. La plataforma estará disponible muy pronto para todos nuestros usuarios.
          </p>
        </div>

        {/* Si el usuario NO está logueado, le damos la opción de ir al login para que el Admin pueda entrar */}
        {!user && (
          <div className="pt-4 w-full border-t border-border mt-4">
            <p className="text-sm text-muted-foreground mb-3">¿Eres administrador?</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Iniciar sesión
            </Button>
          </div>
        )}

        {/* Si el usuario SÍ está logueado pero no es admin, le avisamos */}
        {user && (
          <div className="pt-4 w-full border-t border-border mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Estás conectado como <span className="font-medium text-foreground">{user.email}</span>, pero no tienes acceso en este momento.
            </p>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => router.push('/')}
            >
              Volver al inicio
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
