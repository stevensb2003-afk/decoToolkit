
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
import {
  Loader, PlusCircle, Package, Wallet, FolderKanban,
  Calculator, ShieldCheck, Tag, Network, CreditCard, CheckCircle2,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const MODULES = [
  { id: 'tilopay',             label: 'Tilopay (Pagos)',         icon: CreditCard,    color: 'text-indigo-600' },
  { id: 'caja',                label: 'Caja y Finanzas',         icon: Wallet,        color: 'text-blue-600'   },
  { id: 'inventory',           label: 'Catálogo & Inventario',   icon: Package,       color: 'text-emerald-600'},
  { id: 'projects',            label: 'Gestor de Proyectos',     icon: FolderKanban,  color: 'text-yellow-600' },
  { id: 'calculator',          label: 'Calculadora de Cortes',   icon: Calculator,    color: 'text-primary'    },
  { id: 'precios-descuentos',  label: 'Precios & Descuentos',    icon: Tag,           color: 'text-pink-600'   },
  { id: 'admin',               label: 'Panel de Control',        icon: ShieldCheck,   color: 'text-red-600'    },
  { id: 'procesos',            label: 'Procesos de Empresa',     icon: Network,       color: 'text-cyan-600'   },
];

const createUserSchema = z.object({
  displayName: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  email: z.string().email({ message: 'Por favor ingresa un correo válido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
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
      displayName: '',
      email: '',
      password: '',
      permissions: {
        canManageUsers: false,
        canEditStandardMaterials: false,
        allowedModules: [],
      },
    },
  });

  const { isSubmitting } = form.formState;
  const isAdmin = form.watch('permissions.canManageUsers');

  async function onSubmit(data: CreateUserFormValues) {
    try {
      const result = await createUser(data);
      if (result.success) {
        toast({ title: 'Usuario Creado', description: `Se creó con éxito el usuario ${data.displayName}.` });
        setOpen(false);
        form.reset();
      } else {
        toast({ title: 'Error al Crear Usuario', description: result.error as string, variant: 'destructive' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Ocurrió un error inesperado. Por favor intenta de nuevo.', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 sm:h-10 gap-2">
          <PlusCircle className="h-4 w-4" />
          Crear Usuario
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-0 rounded-2xl gap-0 overflow-hidden">
        {/* Header fijo */}
        <DialogHeader className="px-5 pt-5 pb-4 flex-shrink-0 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold">Crear Nuevo Usuario</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            Ingresa los datos y asigna accesos. Comparte las credenciales de forma segura.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="create-user-form"
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
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
                      <FormLabel className="text-sm font-semibold">Nombre Completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej. María García"
                          className="h-12 sm:h-10 text-base sm:text-sm rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email + Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="usuario@empresa.com"
                            className="h-12 sm:h-10 text-base sm:text-sm rounded-xl"
                            autoComplete="new-email"
                            {...field}
                          />
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
                        <FormLabel className="text-sm font-semibold">Contraseña</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Mínimo 6 caracteres"
                            className="h-12 sm:h-10 text-base sm:text-sm rounded-xl"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                              disabled={isSubmitting}
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
                              disabled={isSubmitting}
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
                          const Icon = mod.icon;
                          return (
                            <button
                              key={mod.id}
                              type="button"
                              disabled={isSubmitting || isAdmin}
                              onClick={() => {
                                if (isAdmin) return;
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
                                (isSubmitting || isAdmin) && 'opacity-60 cursor-not-allowed'
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
            <DialogFooter className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="h-11 sm:h-10 w-full sm:w-auto" disabled={isSubmitting}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                form="create-user-form"
                className="h-11 sm:h-10 w-full sm:w-auto"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader className="animate-spin mr-2 h-4 w-4" />}
                Crear Usuario
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
