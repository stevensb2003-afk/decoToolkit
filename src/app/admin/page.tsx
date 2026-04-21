
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
import { motion, AnimatePresence } from 'framer-motion';

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
          <div className="container mx-auto max-w-7xl p-4 md:p-8">
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
        <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
          <header className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold font-headline text-slate-900 tracking-tight">Panel de Control</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Administra los usuarios y las integraciones externas.</p>
          </header>

          <Tabs defaultValue="users" className="space-y-6 md:space-y-8">
            <div className="w-full pb-2">
              <TabsList className="bg-white/80 backdrop-blur-md border border-slate-200/60 p-1.5 rounded-2xl shadow-sm flex flex-col sm:flex-row h-auto w-full gap-1">
                <TabsTrigger value="users" className="px-5 py-3 sm:py-2.5 rounded-xl data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 w-full sm:w-auto flex-1 transition-all">
                  <UserRoundCog className="w-5 h-5 sm:w-4 sm:h-4 mr-3 sm:mr-2" />
                  Gestión de Usuarios
                </TabsTrigger>
                <TabsTrigger value="alegra" className="px-5 py-3 sm:py-2.5 rounded-xl data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 w-full sm:w-auto flex-1 transition-all">
                  <TrendingUp className="w-5 h-5 sm:w-4 sm:h-4 mr-3 sm:mr-2" />
                  Integración Alegra
                </TabsTrigger>
                <TabsTrigger value="tilopay" className="px-5 py-3 sm:py-2.5 rounded-xl data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 w-full sm:w-auto flex-1 transition-all">
                  <CreditCard className="w-5 h-5 sm:w-4 sm:h-4 mr-3 sm:mr-2" />
                  Tilopay (Pagos)
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="users" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Usuarios del Sistema</h2>
                  <p className="text-sm text-slate-500">Visualiza usuarios y gestiona sus permisos.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  {!usersLoading && !isOwnerVerified && <ValidateOwnerButton />}
                  <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto"><CreateUserDialog /></div>
                </div>
              </div>

              <Card className="border border-slate-200/60 shadow-lg shadow-slate-200/20 rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm">
                <CardHeader className="bg-white/50 border-b border-slate-100 px-4 sm:px-6 py-5">
                  <CardTitle className="text-lg">Todos los Usuarios</CardTitle>
                  <CardDescription>Lista de todos los usuarios registrados en el sistema.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
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
                <Card className="border border-slate-200/60 shadow-lg shadow-slate-200/20 rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white/90 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">Dashboard de Alegra</CardTitle>
                    <CardDescription>Visualiza facturas, productos y contactos directamente desde Alegra.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6 shadow-md shadow-blue-200 transition-all" asChild>
                      <Link href="/admin/alegra">
                        Ir al Dashboard
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200/60 shadow-lg shadow-slate-200/20 rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                      <RotateCcw className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">Estado de Sincronización</CardTitle>
                    <CardDescription>La conexión con Alegra está configurada centralmente en el servidor.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </div>
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
                <Card className="border border-slate-200/60 shadow-lg shadow-slate-200/20 rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white/90 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">Monitor de Transacciones</CardTitle>
                    <CardDescription>Revisa todos los links de pago generados y sus estados.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6 shadow-md shadow-indigo-200 transition-all" asChild>
                      <Link href="/tilopay">
                        Ir al Módulo Tilopay
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200/60 shadow-lg shadow-slate-200/20 rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">Estado del Webhook</CardTitle>
                    <CardDescription>Confirmación automática de pagos.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </div>
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
      <Alert variant="destructive" className="m-4 sm:m-0 rounded-2xl">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error al Cargar Usuarios</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-2xl m-4 sm:m-0 border-slate-200">
        <h3 className="text-lg font-semibold text-slate-700">No se encontraron usuarios</h3>
        <p className="text-muted-foreground mt-1">
          Si eres el propietario, haz clic en "Validar Propietario" para crear tu perfil.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View: Cards */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:hidden bg-slate-50/30">
        <AnimatePresence>
          {users.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, ease: "easeOut" }}
            >
              <UserCard user={user} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Desktop View: Table */}
      <div className="hidden sm:block border rounded-2xl overflow-hidden m-6 shadow-sm border-slate-200">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-slate-600">Nombre</TableHead>
              <TableHead className="font-semibold text-slate-600">Correo</TableHead>
              <TableHead className="font-semibold text-slate-600">Rol</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <UserRow key={user.id} user={user} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function UserCard({ user }: { user: UserProfile }) {
  const { user: currentUser } = useUser();
  const isOwner = user.email === OWNER_EMAIL;
  const isAdmin = user.isAdmin === true;
  const isCurrentUserOwner = currentUser?.email === OWNER_EMAIL;

  let role = 'Colaborador';
  let badgeVariant: "default" | "secondary" | "outline" = 'outline';

  if (isOwner) {
    role = 'Propietario';
    badgeVariant = 'default';
  } else if (isAdmin) {
    role = 'Administrador';
    badgeVariant = 'default';
  }

  const canBeManaged = isCurrentUserOwner && !isOwner;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1 overflow-hidden">
          <h3 className="font-bold text-slate-900 truncate">{user.displayName}</h3>
          <p className="text-sm text-slate-500 truncate">{user.email}</p>
        </div>
        <Badge variant={badgeVariant} className="shrink-0 rounded-full px-3 py-0.5">{role}</Badge>
      </div>
      <div className="pt-3 border-t border-slate-100 flex justify-end">
        <ManageUserDialog user={user} canBeManaged={canBeManaged} />
      </div>
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
    <TableRow className="hover:bg-slate-50/50">
      <TableCell className="font-medium">{user.displayName}</TableCell>
      <TableCell className="text-slate-600">{user.email}</TableCell>
      <TableCell><Badge variant={badgeVariant} className="rounded-full">{role}</Badge></TableCell>
      <TableCell className="text-right">
        <ManageUserDialog user={user} canBeManaged={canBeManaged} />
      </TableCell>
    </TableRow>
  );
}

function UsersTableSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 p-4 sm:hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
             <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32 rounded-full" />
                  <Skeleton className="h-4 w-40 rounded-full" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
             </div>
             <div className="pt-3 border-t border-slate-50 flex justify-end">
                <Skeleton className="h-9 w-24 rounded-lg" />
             </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block space-y-4 m-6">
        <div className="border rounded-2xl overflow-hidden border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
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
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto rounded-lg" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
