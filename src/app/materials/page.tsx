"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { UserProfile } from "@/lib/types";
import { useRouter } from "next/navigation";
import { doc } from "firebase/firestore";
import type { DefaultMaterial, Unit } from "@/lib/types";
import {
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { convertFromCm } from "@/lib/utils";
import { createDefaultMaterial, updateDefaultMaterial, deleteDefaultMaterial } from "@/lib/actions";
import { Pencil, Trash2, Terminal, Ruler, PackagePlus, Maximize, Layers, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Header } from "@/components/layout/header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";

const DimensionInputSchema = z.object({
  value: z.coerce.number({ invalid_type_error: "El valor debe ser un número" }).positive("El valor debe ser positivo"),
  unit: z.enum(["m", "cm"]),
});

const DefaultMaterialFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  width: DimensionInputSchema,
  height: DimensionInputSchema,
});

type DefaultMaterialFormValues = z.infer<typeof DefaultMaterialFormSchema>;

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export default function DefaultMaterialsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!isProfileLoading && profile && !isUserLoading && user) {
      const allowedModules = profile.permissions?.allowedModules || [];
      const isAdmin = profile.isAdmin || false;
      if (!isAdmin && !allowedModules.includes('inventory')) {
        router.push('/');
      }
    }
  }, [isProfileLoading, profile, isUserLoading, user, router]);

  const form = useForm<DefaultMaterialFormValues>({
    resolver: zodResolver(DefaultMaterialFormSchema),
    defaultValues: {
      name: "",
      width: { value: 0, unit: "m" },
      height: { value: 0, unit: "m" },
    },
  });

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "defaultMaterials"),
      orderBy("createdAt", "desc")
    );
  }, [firestore]);

  const { data: materials, isLoading, error } = useCollection<DefaultMaterial>(materialsQuery);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    if (!searchQuery.trim()) return materials;
    return materials.filter(material => 
      material.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [materials, searchQuery]);

  const onSubmit = async (data: DefaultMaterialFormValues) => {
    const result = await createDefaultMaterial(data);

    if (result?.success) {
      toast({
        title: "Éxito",
        description: "El material estándar ha sido creado exitosamente.",
      });
      form.reset();
    } else {
      toast({
        title: "Error",
        description: result?.error || "Error al crear el material estándar.",
        variant: "destructive",
      });
    }
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-4 md:gap-6">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-zinc-950/50">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-7xl p-4 md:p-8">
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="p-3 bg-primary/10 rounded-xl">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight text-foreground">Materiales Estándar</h1>
              <p className="text-muted-foreground mt-1">Gestiona las plantillas base para tus cálculos de inventario y cotizaciones.</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Panel de Formulario */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-4 lg:sticky lg:top-8"
            >
              <Card className="border-border/50 shadow-xl shadow-primary/5 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <PackagePlus className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">Nuevo Material</CardTitle>
                  </div>
                  <CardDescription>
                    Agrega un formato de material que usarás frecuentemente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-foreground/80">Nombre Comercial</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-background/50 focus-visible:ring-primary/50 transition-shadow" placeholder="ej. Lámina PVC Blanca" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="width"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-semibold text-foreground/80 flex items-center gap-1">
                                <Maximize className="h-3.5 w-3.5" /> Ancho
                              </FormLabel>
                              <div className="flex gap-1.5">
                                <FormControl>
                                  <Input className="h-11 bg-background/50 px-3 transition-shadow" type="number" step="any" placeholder="1.22" {...form.register("width.value")} />
                                </FormControl>
                                <Select onValueChange={(unit) => form.setValue("width.unit", unit as Unit)} defaultValue={field.value.unit}>
                                  <SelectTrigger className="w-[75px] h-11 bg-background/50 px-2 transition-shadow">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="m">m</SelectItem>
                                    <SelectItem value="cm">cm</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="height"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-semibold text-foreground/80 flex items-center gap-1">
                                <Ruler className="h-3.5 w-3.5" /> Alto
                              </FormLabel>
                              <div className="flex gap-1.5">
                                <FormControl>
                                  <Input className="h-11 bg-background/50 px-3 transition-shadow" type="number" step="any" placeholder="2.44" {...form.register("height.value")} />
                                </FormControl>
                                <Select onValueChange={(unit) => form.setValue("height.unit", unit as Unit)} defaultValue={field.value.unit}>
                                  <SelectTrigger className="w-[75px] h-11 bg-background/50 px-2 transition-shadow">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="m">m</SelectItem>
                                    <SelectItem value="cm">cm</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button 
                        type="submit" 
                        disabled={form.formState.isSubmitting}
                        className="w-full h-11 font-medium transition-all active:scale-[0.98] mt-2"
                      >
                        {form.formState.isSubmitting ? "Creando..." : "Crear Material"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Panel de Lista */}
            <div className="lg:col-span-8 flex flex-col gap-4 min-h-[500px]">
              
              {/* Barra de Búsqueda */}
              {materials && materials.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative"
                >
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                  <Input 
                    placeholder="Buscar materiales por nombre..." 
                    className="h-12 pl-11 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md border-border/50 shadow-sm focus-visible:ring-primary/50 text-base"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </motion.div>
              )}

              {isLoading || isUserLoading ? (
                <LoadingSkeleton />
              ) : error ? (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-bottom-4">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error de Acceso</AlertTitle>
                  <AlertDescription>
                    No tienes permiso para ver la lista de materiales o ocurrió un error. Contacta a un administrador.
                  </AlertDescription>
                </Alert>
              ) : materials && materials.length > 0 ? (
                filteredMaterials.length > 0 ? (
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 md:gap-6"
                  >
                    <AnimatePresence>
                      {filteredMaterials.map((material) => (
                        <MaterialCard key={material.id} material={material} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border/50 bg-background/50 rounded-3xl min-h-[300px]"
                  >
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No se encontraron resultados</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm">
                      No hay materiales que coincidan con "{searchQuery}".
                    </p>
                    <Button 
                      variant="link" 
                      onClick={() => setSearchQuery("")}
                      className="mt-2"
                    >
                      Limpiar búsqueda
                    </Button>
                  </motion.div>
                )
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-primary/20 bg-primary/5 rounded-3xl h-full min-h-[400px]"
                >
                  <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-5">
                    <Layers className="h-10 w-10 text-primary opacity-60" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Tu catálogo está vacío</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Comienza agregando tu primer material estándar usando el formulario. Estos materiales estarán disponibles para cotizaciones y cálculos de inventario.
                  </p>
                </motion.div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

function MaterialCard({ material }: { material: DefaultMaterial }) {
  const [open, setOpen] = useState(false);
  const editForm = useForm<DefaultMaterialFormValues>({
    resolver: zodResolver(DefaultMaterialFormSchema),
    defaultValues: {
      name: material.name,
      width: { value: convertFromCm(material.width, "m"), unit: "m" },
      height: { value: convertFromCm(material.height, "m"), unit: "m" },
    },
  });

  const onEditSubmit = async (data: DefaultMaterialFormValues) => {
    const result = await updateDefaultMaterial(material.id, data);
    if (result?.success) {
      toast({
        title: "Actualizado",
        description: "El material se actualizó correctamente.",
      });
      setOpen(false);
    } else {
      toast({
        title: "Error",
        description: result?.error || "Error al actualizar.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    const result = await deleteDefaultMaterial(material.id);
    if (result?.success) {
      toast({
        title: "Eliminado",
        description: "El material fue removido de la base de datos.",
      });
    } else {
      toast({
        title: "Error",
        description: result?.error || "No se pudo eliminar el material.",
        variant: "destructive",
      });
    }
  }

  const resetForm = () => {
    editForm.reset({
      name: material.name,
      width: { value: convertFromCm(material.width, "m"), unit: "m" },
      height: { value: convertFromCm(material.height, "m"), unit: "m" },
    });
  }

  return (
    <motion.div variants={itemVariants} layoutId={`card-${material.id}`}>
      <Card className="group overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col h-full">
        <CardHeader className="p-5 pb-3 bg-gradient-to-br from-background via-background to-secondary/10 border-b border-border/40 grow-0">
          <div className="flex justify-between items-start gap-3">
            <CardTitle className="text-lg leading-tight font-semibold line-clamp-2 pr-2">{material.name}</CardTitle>
            
            <div className="flex items-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-md rounded-full p-1 border border-border/50 shadow-sm shrink-0">
               <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-primary" />
                        Editar Material
                      </DialogTitle>
                      <DialogDescription>
                        Ajusta las dimensiones base. Los cambios aplicarán para futuros usos.
                      </DialogDescription>
                    </DialogHeader>

                    <Form {...editForm}>
                      <form id={`edit-form-${material.id}`} onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-5 py-4">
                        <FormField
                          control={editForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre Comercial</FormLabel>
                              <FormControl>
                                <Input placeholder="ej. Lámina PVC" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={editForm.control}
                            name="width"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> Ancho</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <Input type="number" step="any" {...editForm.register("width.value")} />
                                  </FormControl>
                                  <Select onValueChange={(unit) => editForm.setValue("width.unit", unit as Unit)} defaultValue={field.value.unit}>
                                    <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="m">m</SelectItem>
                                      <SelectItem value="cm">cm</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="height"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> Alto</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <Input type="number" step="any" {...editForm.register("height.value")} />
                                  </FormControl>
                                  <Select onValueChange={(unit) => editForm.setValue("height.unit", unit as Unit)} defaultValue={field.value.unit}>
                                    <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="m">m</SelectItem>
                                      <SelectItem value="cm">cm</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </form>
                    </Form>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancelar</Button>
                      </DialogClose>
                      <Button type="submit" form={`edit-form-${material.id}`} disabled={editForm.formState.isSubmitting}>
                        {editForm.formState.isSubmitting ? "Guardando..." : "Guardar Cambios"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar material?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. <strong className="text-foreground">{material.name}</strong> será eliminado de la lista de plantillas disponibles.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Sí, eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-4 grow flex flex-col justify-center">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col bg-secondary/30 rounded-xl p-3.5 border border-secondary/50">
              <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                 <Maximize className="h-3.5 w-3.5 text-primary/70" /> Ancho
              </span>
              <span className="text-xl font-semibold text-foreground tracking-tight">
                {convertFromCm(material.width, "m")} <span className="text-sm text-muted-foreground font-medium">m</span>
                <span className="block text-xs text-muted-foreground/70 font-normal mt-0.5">({material.width}cm)</span>
              </span>
            </div>
            <div className="flex flex-col bg-secondary/30 rounded-xl p-3.5 border border-secondary/50">
              <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                 <Ruler className="h-3.5 w-3.5 text-primary/70" /> Alto
              </span>
              <span className="text-xl font-semibold text-foreground tracking-tight">
                {convertFromCm(material.height, "m")} <span className="text-sm text-muted-foreground font-medium">m</span>
                <span className="block text-xs text-muted-foreground/70 font-normal mt-0.5">({material.height}cm)</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
