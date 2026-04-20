
'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo, useTransition } from 'react';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ManageUserDialog } from './_components/manage-permissions-dialog';
import { CreateUserDialog } from './_components/create-user-dialog';
import { UserProfile } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, RotateCcw, Filter, CheckCircle2, AlertCircle, ShoppingCart, Users, Receipt, Landmark, Terminal, Loader, ShieldQuestion, TrendingUp, UserRoundCog, CreditCard } from 'lucide-react';
import { collection, query, orderBy, type Firestore, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ensureOwnerProfile } from './actions';
import { useToast } from '@/hooks/use-toast';
import { useDoc } from '@/firebase';

const OWNER_EMAIL = 'stevensb.2003@gmail.com';

function ValidateOwnerButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleValidate = () => {
    startTransition(async () => {
      const result = await ensureOwnerProfile();
      if (result.success) {
        toast({
          title: "¡Validación Exitosa!",
          description: result.message,
        });
      } else {
        toast({
          title: "Error de Validación",
          description: result.message,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Button onClick={handleValidate} disabled={isPending} variant="outline">
      {isPending ? (
        <><Loader className="mr-2 h-4 w-4 animate-spin" /> Validando...</>
      ) : (
        <><ShieldQuestion className="mr-2 h-4 w-4" /> Validar Propietario</>
      )}
    </Button>
  );
}

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [claims, setClaims] = useState<{ admin?: boolean }>({});
  const [checkingClaims, setCheckingClaims] = useState(true);

  // --- STATE LIFTED UP FROM UsersTable ---
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('displayName'));
  }, [firestore]);

  const { data: users, isLoading: usersLoading, error: usersError } = useCollection<UserProfile>(usersQuery);
  // --- END OF LIFTED STATE ---

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setCheckingClaims(false);
      return;
    }
    user.getIdTokenResult().then((idTokenResult) => {
      setClaims({ admin: !!idTokenResult.claims.admin });
      setCheckingClaims(false);
    }).catch(error => {
      console.error("Error getting user token:", error);
      setCheckingClaims(false);
    });
  }, [user, isUserLoading]);

  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  const isAuthorized = useMemo(() => {
    if (checkingClaims || isUserLoading || isProfileLoading) return null;
    if (!user) return false;

    const userIsOwner = user.email === OWNER_EMAIL;
    const userIsAdmin = !!claims.admin || profile?.isAdmin || false;
    const hasModuleAccess = profile?.permissions?.allowedModules?.includes('admin') || false;

    return userIsOwner || userIsAdmin || hasModuleAccess;
  }, [user, claims, checkingClaims, isUserLoading, isProfileLoading, profile]);

  useEffect(() => {
    if (isAuthorized === false) {
      router.push('/');
    }
  }, [isAuthorized, router]);

  const isOwnerVerified = useMemo(() => {
    if (!users) return false;
    return users.some(u => u.email === OWNER_EMAIL);
  }, [users]);

  if (isAuthorized !== true) {
    return (
      <>
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-5xl p-4 md:p-8">
            <div className="flex items-center justify-center h-64">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4">Verificando permisos...</p>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        <div className="container mx-auto max-w-5xl p-4 md:p-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold font-headline text-slate-900">Panel de Control</h1>
            <p className="text-muted-foreground">Administra los usuarios y las integraciones externas.</p>
          </header>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              <TabsTrigger value="users" className="px-6 py-2 rounded-lg data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                <UserRoundCog className="w-4 h-4 mr-2" />
                Gestión de Usuarios
              </TabsTrigger>
              <TabsTrigger value="alegra" className="px-6 py-2 rounded-lg data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                <TrendingUp className="w-4 h-4 mr-2" />
                Integración Alegra
              </TabsTrigger>
              <TabsTrigger value="tilopay" className="px-6 py-2 rounded-lg data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                <CreditCard className="w-4 h-4 mr-2" />
                Tilopay (Pagos)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Usuarios del Sistema</h2>
                  <p className="text-sm text-slate-500">Visualiza usuarios y gestiona sus permisos.</p>
                </div>
                <div className="flex items-center gap-2">
                  {!usersLoading && !isOwnerVerified && <ValidateOwnerButton />}
                  <CreateUserDialog />
                </div>
              </div>

              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100">
                  <CardTitle>Todos los Usuarios</CardTitle>
                  <CardDescription>Lista de todos los usuarios registrados en el sistema.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <UsersTable users={users} isLoading={usersLoading} error={usersError} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alegra" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Contabilidad Alegra</h2>
                  <p className="text-sm text-slate-500">Configura y accede al panel de sincronización con Alegra.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-shadow bg-white">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <CardTitle>Dashboard de Alegra</CardTitle>
                    <CardDescription>Visualiza facturas, productos y contactos directamente desde Alegra.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6" asChild>
                      <Link href="/admin/alegra">
                        Ir al Dashboard
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-white">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                      <RotateCcw className="w-6 h-6" />
                    </div>
                    <CardTitle>Estado de Sincronización</CardTitle>
                    <CardDescription>La conexión con Alegra está configurada centralmente en el servidor.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-emerald-700">Conexión API Activa</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tilopay" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Pasarela Tilopay</h2>
                  <p className="text-sm text-slate-500">Supervisa las transacciones globales y el estado de la conexión.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-shadow bg-white">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <CardTitle>Monitor de Transacciones</CardTitle>
                    <CardDescription>Revisa todos los links de pago generados y sus estados.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6" asChild>
                      <Link href="/tilopay">
                        Ir al Módulo Tilopay
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-white">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <CardTitle>Estado del Webhook</CardTitle>
                    <CardDescription>Confirmación automática de pagos.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-emerald-700">Endpoint Activo</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}

// UsersTable now receives data as props
function UsersTable({ users, isLoading, error }: { users: UserProfile[] | null, isLoading: boolean, error: Error | null }) {
  if (isLoading) {
    return <UsersTableSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error al Cargar Usuarios</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <h3 className="text-lg font-semibold">No se encontraron usuarios</h3>
        <p className="text-muted-foreground mt-1">
          Si eres el propietario, haz clic en "Validar Propietario" para crear tu perfil.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(user => (
            <UserRow key={user.id} user={user} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserRow({ user }: { user: UserProfile }) {
  const { user: currentUser } = useUser();
  const isOwner = user.email === OWNER_EMAIL;
  const isAdmin = user.isAdmin === true;
  const isCurrentUserOwner = currentUser?.email === OWNER_EMAIL;

  let role = 'Colaborador';
  let badgeVariant: "default" | "secondary" = 'secondary';

  if (isOwner) {
    role = 'Propietario';
    badgeVariant = 'default';
  } else if (isAdmin) {
    role = 'Administrador';
    badgeVariant = 'default';
  }

  const canBeManaged = isCurrentUserOwner && !isOwner;

  return (
    <TableRow>
      <TableCell className="font-medium">{user.displayName}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell><Badge variant={badgeVariant}>{role}</Badge></TableCell>
      <TableCell className="text-right">
        <ManageUserDialog user={user} canBeManaged={canBeManaged} />
      </TableCell>
    </TableRow>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead><Skeleton className="h-5 w-40" /></TableHead>
              <TableHead><Skeleton className="h-5 w-20" /></TableHead>
              <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
