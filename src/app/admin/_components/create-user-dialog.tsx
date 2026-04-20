
'use client';

import { useState } from 'react';
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
import { createUser } from '../actions';
import { Loader, PlusCircle, Package, Wallet, FolderKanban, Calculator, ShieldCheck, Tag, Network } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

const createUserSchema = z.object({
  displayName: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor ingresa un correo válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  permissions: z.object({
    canManageUsers: z.boolean().default(false),
    canEditStandardMaterials: z.boolean().default(false),
    allowedModules: z.array(z.string()).default([]),
  }),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      permissions: {
        canManageUsers: false,
        canEditStandardMaterials: false,
        allowedModules: [],
      },
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: CreateUserFormValues) {
    try {
      const result = await createUser(data);

      if (result.success) {
        toast({
          title: 'Usuario Creado',
          description: `Se creó con éxito el usuario ${data.displayName}.`,
        });
        setOpen(false);
        form.reset();
      } else {
        toast({
          title: 'Error al Crear Usuario',
          description: result.error as string,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Crear Usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Ingresa los detalles del nuevo usuario. No se enviará correo automáticamente, asegúrate de compartir las credenciales de forma segura.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-user-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-2"
            autoComplete="off"
          >
            <ScrollArea className="max-h-[60vh] -mr-4 pr-4">
              <div className="space-y-4 py-2">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del usuario" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="user@example.com" {...field} autoComplete="new-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} autoComplete="new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                            disabled={isSubmitting}
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
                            disabled={isSubmitting}
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
                                  disabled={isSubmitting || form.watch('permissions.canManageUsers')}
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
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form="create-user-form"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader className="animate-spin mr-2" />}
            Crear Usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
