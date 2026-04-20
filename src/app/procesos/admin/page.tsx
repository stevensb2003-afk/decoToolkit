"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useCollection, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Edit, Trash2, Network, ArrowLeft, Eye, EyeOff, Search } from "lucide-react";
import Link from "next/link";
import { ProcessMap, UserProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default function ProcesosAdminPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [newProcess, setNewProcess] = useState({
        title: "",
        description: "",
        isPublished: false
    });

    const profileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);
    const isAdmin = profile?.isAdmin || false;

    const q = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "processes"),
            orderBy("updatedAt", "desc")
        );
    }, [firestore, user]);

    const { data: processes, isLoading } = useCollection<ProcessMap>(q);

    const filteredProcesses = processes?.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isUserLoading || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // Double check authorization
    if (!user || (!isAdmin && !profile?.permissions?.allowedModules?.includes('admin'))) {
        // router.push("/login");
        // return null;
    }

    const handleCreateProcess = async () => {
        if (!newProcess.title.trim()) {
            toast({ title: "Error", description: "El título es obligatorio.", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const processRef = await addDoc(collection(firestore, "processes"), {
                title: newProcess.title,
                description: newProcess.description,
                isPublished: newProcess.isPublished,
                nodes: [],
                edges: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: user?.uid,
            });

            toast({ title: "Proceso Creado", description: "El proceso se ha creado exitosamente." });
            setIsCreateDialogOpen(false);
            setNewProcess({ title: "", description: "", isPublished: false });
            // Redirect to editor
            router.push(`/procesos/admin/${processRef.id}`);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProcess = async (id: string) => {
        if (confirm("¿Estás seguro de que deseas eliminar este proceso? Esta acción no se puede deshacer.")) {
            try {
                await deleteDoc(doc(firestore, "processes", id));
                toast({ title: "Proceso Eliminado", description: "El proceso se ha eliminado." });
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            }
        }
    };

    const handleTogglePublish = async (process: ProcessMap) => {
        try {
            await updateDoc(doc(firestore, "processes", process.id), {
                isPublished: !process.isPublished,
                updatedAt: new Date()
            });
            toast({ title: "Estado Actualizado", description: `El proceso ahora está ${!process.isPublished ? 'público' : 'oculto'}.` });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <>
            <Header />
            <div className="container mx-auto p-4 md:p-8 space-y-8">
                <Button variant="ghost" asChild className="mb-4">
                    <Link href="/procesos" className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Volver al Directorio
                    </Link>
                </Button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Administración de Procesos</h1>
                        <p className="text-muted-foreground">
                            Crea, edita y administra los procesos y mapas conceptuales.
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Nuevo Proceso
                    </Button>
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar procesos..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredProcesses?.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                            No hay procesos creados. Haz clic en "Nuevo Proceso" para comenzar.
                        </div>
                    ) : (
                        filteredProcesses?.map((process) => (
                            <Card key={process.id} className="flex flex-col md:flex-row justify-between items-center p-4 hover:shadow-sm transition-shadow">
                                <div className="flex-1 mb-4 md:mb-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-lg">{process.title}</h3>
                                        {process.isPublished ? (
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Eye className="w-3 h-3" /> Público
                                            </span>
                                        ) : (
                                            <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <EyeOff className="w-3 h-3" /> Oculto
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{process.description || "Sin descripción."}</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Actualizado: {process.updatedAt instanceof Date ? process.updatedAt.toLocaleDateString() : (process.updatedAt as any)?.toDate()?.toLocaleDateString() || ""}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <Button variant="outline" size="sm" onClick={() => handleTogglePublish(process)}>
                                        {process.isPublished ? "Ocultar" : "Publicar"}
                                    </Button>
                                    <Button asChild variant="default" size="sm">
                                        <Link href={`/procesos/admin/${process.id}`} className="flex items-center gap-2">
                                            <Edit className="w-4 h-4" />
                                            Editar Mapa
                                        </Link>
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteProcess(process.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Proceso</DialogTitle>
                        <DialogDescription>Define el título y descripción básica del proceso. Luego podrás crear el mapa conceptual.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título del Proceso</Label>
                            <Input
                                id="title"
                                value={newProcess.title}
                                onChange={(e) => setNewProcess({ ...newProcess, title: e.target.value })}
                                placeholder="Ej. Flujo de Ventas"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción (Opcional)</Label>
                            <Textarea
                                id="description"
                                value={newProcess.description}
                                onChange={(e) => setNewProcess({ ...newProcess, description: e.target.value })}
                                placeholder="Breve explicación del objetivo de este proceso."
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="isPublished"
                                checked={newProcess.isPublished}
                                onCheckedChange={(c) => setNewProcess({ ...newProcess, isPublished: !!c })}
                            />
                            <Label htmlFor="isPublished">Publicar inmediatamente (visible para empleados)</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>Cancelar</Button>
                        <Button onClick={handleCreateProcess} disabled={isCreating}>
                            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Crear y Editar Mapa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
