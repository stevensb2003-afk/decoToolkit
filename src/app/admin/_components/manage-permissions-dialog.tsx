
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types';
import { updateUserProfile, deleteUser } from '../actions';
import {
  Loader, Package, Wallet, FolderKanban, Calculator, ShieldCheck,
  Trash2, TriangleAlert, Tag, Network, CreditCard, CheckCircle2,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const MODULES = [
  { id: 'tilopay',            label: 'Tilopay (Pagos)',        icon: CreditCard,   color: 'text-indigo-600' },
  { id: 'caja',               label: 'Caja y Finanzas',        icon: Wallet,       color: 'text-blue-600'   },
  { id: 'inventory',          label: 'Catálogo & Inventario',  icon: Package,      color: 'text-emerald-600'},
  { id: 'projects',           label: 'Gestor de Proyectos',    icon: FolderKanban, color: 'text-yellow-600' },
  { id: 'calculator',         label: 'Calculadora de Cortes',  icon: Calculator,   color: 'text-primary'    },
  { id: 'precios-descuentos', label: 'Precios & Descuentos',   icon: Tag,          color: 'text-pink-600'   },
  { id: 'admin',              label: 'Panel de Control',       icon: ShieldCheck,  color: 'text-red-600'    },
  { id: 'procesos',           label: 'Procesos de Empresa',    icon: Network,      color: 'text-cyan-600'   },
];

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  permissions: z.object({
    canManageUsers: z.boolean().default(false),
    canEditStandardMaterials: z.boolean().default(false),
    allowedModules: z.array(z.string()).default([]),
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ManageUserDialog({ user, canBeManaged }: { user: UserProfile; canBeManaged: boolean }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName,
        permissions: {
          canManageUsers: user.permissions?.canManageUsers ?? false,
          canEditStandardMaterials: user.permissions?.canEditStandardMaterials ?? false,
          allowedModules: user.permissions?.allowedModules ?? [],
        },
      });
    }
  }, [user, open, form]);

  const { isSubmitting } = form.formState;
  const isAdmin = form.watch('permissions.canManageUsers');

  async function onSubmit(data: ProfileFormValues) {
    try {
      await updateUserProfile(user.id, data);
      toast({ title: 'Perfil Actualizado', description: `Se actualizó con éxito el perfil de ${data.displayName}.` });
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo actualizar el perfil. Por favor, intenta de nuevo.', variant: 'destructive' });
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteUser(user.id);
      if (result.success) {
        toast({ title: 'Usuario Eliminado', description: `El usuario ${user.displayName} ha sido removido permanentemente.` });
        setOpen(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error al eliminar usuario', description: error.message || 'No se pudo eliminar el usuario.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 text-sm rounded-xl">Gestionar</Button>
      </DialogTrigger>

      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-0 rounded-2xl gap-0 overflow-hidden">
        {/* Header fijo */}
        <DialogHeader className="px-5 pt-5 pb-4 flex-shrink-0 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold">Gestionar Usuario</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            Editando el perfil de <span className="font-semibold text-slate-700">{user.displayName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="profile-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 overflow-hidden flex flex-col"
          >
            {/* Cuerpo con scroll */}
            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-5 px-5 py-4 pb-6">

                {/* Nombre */}
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Nombre Visible</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nombre del usuario"
                          className="h-12 sm:h-10 text-base sm:text-sm rounded-xl"
                          disabled={!canBeManaged}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Roles - Switches */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Roles de Sistema</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="permissions.canManageUsers"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 min-h-[56px]">
                          <div>
                            <FormLabel className="text-sm font-medium cursor-pointer">Administrador</FormLabel>
                            <p className="text-[11px] text-muted-foreground">Acceso total</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!canBeManaged || isSubmitting}
                              className="shrink-0"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="permissions.canEditStandardMaterials"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 min-h-[56px]">
                          <div>
                            <FormLabel className="text-sm font-medium cursor-pointer">Editor Materiales</FormLabel>
                            <p className="text-[11px] text-muted-foreground">Edita el catálogo base</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!canBeManaged || isSubmitting}
                              className="shrink-0"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Módulos Permitidos */}
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Módulos Permitidos</p>
                    <FormDescription className="text-xs mt-0.5">
                      {isAdmin ? 'El rol Administrador desbloquea todos los módulos.' : 'Selecciona los módulos a los que tendrá acceso.'}
                    </FormDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="permissions.allowedModules"
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {MODULES.map((mod) => {
                          const isChecked = isAdmin || field.value?.includes(mod.id);
                          const isDisabled = !canBeManaged || isSubmitting || isAdmin;
                          const Icon = mod.icon;
                          return (
                            <button
                              key={mod.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => {
                                if (isDisabled) return;
                                const current = field.value ?? [];
                                field.onChange(
                                  isChecked
                                    ? current.filter((v) => v !== mod.id)
                                    : [...current, mod.id]
                                );
                              }}
                              className={cn(
                                'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-150 min-h-[52px] active:scale-[0.97]',
                                isChecked
                                  ? 'border-primary/40 bg-primary/5 shadow-sm'
                                  : 'border-slate-200 bg-white hover:bg-slate-50',
                                isDisabled && 'opacity-60 cursor-not-allowed'
                              )}
                            >
                              <div className={cn('shrink-0 h-5 w-5', isChecked ? mod.color : 'text-muted-foreground')}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <span className={cn(
                                'text-xs font-medium leading-tight flex-1',
                                isChecked ? 'text-slate-800' : 'text-slate-600'
                              )}>
                                {mod.label}
                              </span>
                              {isChecked && (
                                <CheckCircle2 className="shrink-0 h-4 w-4 text-primary" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                </div>

              </div>
            </ScrollArea>

            {/* Footer fijo */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100">
              <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                {/* Botón Eliminar — izquierda en desktop */}
                {canBeManaged && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-11 sm:h-10 w-full sm:mr-auto sm:w-auto gap-2"
                        disabled={isSubmitting || isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[92vw] sm:max-w-md rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                          <TriangleAlert className="h-5 w-5" />
                          ¿Estás absolutamente seguro?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esto eliminará permanentemente la cuenta de{' '}
                          <strong>{user.displayName}</strong> de Firebase Authentication y su perfil de la base de datos. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                        <AlertDialogCancel className="h-11 sm:h-10 w-full sm:w-auto" disabled={isDeleting}>
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => { e.preventDefault(); handleDelete(); }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-11 sm:h-10 w-full sm:w-auto gap-2"
                          disabled={isDeleting}
                        >
                          {isDeleting ? <Loader className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                          Confirmar Eliminación
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Cancelar + Guardar */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1 sm:flex-none h-11 sm:h-10"
                      disabled={isSubmitting || isDeleting}
                    >
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    form="profile-form"
                    className="flex-1 sm:flex-none h-11 sm:h-10 gap-2"
                    disabled={!canBeManaged || isSubmitting || isDeleting}
                  >
                    {isSubmitting && <Loader className="animate-spin h-4 w-4" />}
                    Guardar
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
