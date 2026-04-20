
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
import { Loader, Package, Wallet, FolderKanban, Calculator, ShieldCheck, Trash2, TriangleAlert, Tag, Network, CreditCard } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
} from "@/components/ui/alert-dialog";

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  permissions: z.object({
    canManageUsers: z.boolean().default(false),
    canEditStandardMaterials: z.boolean().default(false),
    allowedModules: z.array(z.string()).default([]),
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ManageUserDialog({ user, canBeManaged }: { user: UserProfile, canBeManaged: boolean }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
  });

  // Reset form values whenever the dialog is opened or the user prop changes.
  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName,
        permissions: {
          canManageUsers: user.permissions?.canManageUsers ?? false,
          canEditStandardMaterials:
            user.permissions?.canEditStandardMaterials ?? false,
          allowedModules: user.permissions?.allowedModules ?? [],
        },
      });
    }
  }, [user, open, form]);

  const { isSubmitting } = form.formState;

  async function onSubmit(data: ProfileFormValues) {
    try {
      await updateUserProfile(user.id, data);

      toast({
        title: 'Perfil Actualizado',
        description: `Se actualizó con éxito el perfil de ${data.displayName}.`,
      });
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil. Por favor, intenta de nuevo.',
        variant: 'destructive',
      });
    }
  }

  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteUser(user.id);
      if (result.success) {
        toast({
          title: 'Usuario Eliminado',
          description: `El usuario ${user.displayName} ha sido removido permanentemente.`,
        });
        setOpen(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al eliminar usuario',
        description: error.message || 'No se pudo eliminar el usuario.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Gestionar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar Usuario</DialogTitle>
          <DialogDescription>
            Editando el perfil de <span className="font-semibold">{user.displayName}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="profile-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-2"
          >
            <ScrollArea className="max-h-[60vh] -mr-4 pr-4">
              <div className="space-y-4 py-2">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Visible</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del usuario" {...field} disabled={!canBeManaged} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="permissions.canManageUsers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">
                            Administrador
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!canBeManaged || isSubmitting}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="permissions.canEditStandardMaterials"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">
                            Editor de Materiales
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!canBeManaged || isSubmitting}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex flex-col gap-1">
                    <FormLabel className="text-base font-bold">Módulos Permitidos</FormLabel>
                    <FormDescription className="text-xs">Acceso por módulo.</FormDescription>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'tilopay', label: 'Tilopay (Pagos)', icon: CreditCard },
                      { id: 'caja', label: 'Caja y Finanzas', icon: Wallet },
                      { id: 'inventory', label: 'Inventario de Materiales', icon: Package },
                      { id: 'projects', label: 'Gestor de Proyectos', icon: FolderKanban },
                      { id: 'calculator', label: 'Calculadora de Cortes', icon: Calculator },
                      { id: 'precios-descuentos', label: 'Precios & Descuentos', icon: Tag },
                      { id: 'admin', label: 'Panel de Control (Admin)', icon: ShieldCheck },
                      { id: 'procesos', label: 'Procesos de Empresa', icon: Network },
                    ].map((mod) => (
                      <FormField
                        key={mod.id}
                        control={form.control}
                        name="permissions.allowedModules"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={mod.id}
                              className="flex flex-row items-center space-x-3 space-y-0 p-2 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={form.watch('permissions.canManageUsers') || field.value?.includes(mod.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, mod.id])
                                      : field.onChange(
                                        field.value?.filter(
                                          (value: string) => value !== mod.id
                                        )
                                      )
                                  }}
                                  disabled={!canBeManaged || isSubmitting || form.watch('permissions.canManageUsers')}
                                />
                              </FormControl>
                              <div className="flex items-center gap-2">
                                <mod.icon className="h-4 w-4 text-muted-foreground" />
                                <FormLabel className="text-xs font-medium cursor-pointer">
                                  {mod.label}
                                </FormLabel>
                              </div>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </form>
        </Form>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canBeManaged && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="sm:mr-auto" disabled={isSubmitting || isDeleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Usuario
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <TriangleAlert className="h-5 w-5 text-destructive" />
                    ¿Estás absolutamente seguro?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente la cuenta de <strong>{user.displayName}</strong> de Firebase Authentication y su perfil de la base de datos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Confirmar Eliminación
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="flex-1 sm:flex-none" disabled={isSubmitting || isDeleting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="profile-form"
              className="flex-1 sm:flex-none"
              disabled={!canBeManaged || isSubmitting || isDeleting}
            >
              {isSubmitting && <Loader className="animate-spin mr-2" />}
              Guardar Cambios
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
