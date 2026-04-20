"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useUser, useCollection, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, where, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Network, Settings, BookOpen } from "lucide-react";
import Link from "next/link";
import { ProcessMap, UserProfile } from "@/lib/types";

export default function ProcesosDirectoryPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState("");

    const profileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(profileRef);
    const isAdmin = profile?.isAdmin || false;

    const q = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "processes"),
            // For the directory view, we only show published processes
            where("isPublished", "==", true)
            // Removed orderBy to avoid requiring a composite index
        );
    }, [firestore, user]);

    const { data: processes, isLoading, error } = useCollection<ProcessMap>(q);

    const sortedProcesses = useMemo(() => {
        if (!processes) return null;
        return [...processes].sort((a, b) => {
            const dateA = a.updatedAt instanceof Date ? a.updatedAt : (a.updatedAt as any)?.toDate?.() || new Date(0);
            const dateB = b.updatedAt instanceof Date ? b.updatedAt : (b.updatedAt as any)?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
    }, [processes]);

    const filteredProcesses = sortedProcesses?.filter((p: ProcessMap) =>
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

    if (error) {
        return (
            <div className="container mx-auto p-8 mt-16 text-center">
                <div className="bg-destructive/10 p-6 rounded-lg max-w-lg mx-auto">
                    <h2 className="text-xl font-bold text-destructive mb-2">Error al cargar procesos</h2>
                    <p className="text-muted-foreground mb-4">{(error as any).message || "Ocurrió un error inesperado."}</p>
                    <Button onClick={() => window.location.reload()}>Reintentar</Button>
                </div>
            </div>
        );
    }

    if (!user) {
        router.push("/login");
        return null;
    }

    return (
        <>
            <Header />
            <div className="container mx-auto p-4 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Directorio de Procesos</h1>
                        <p className="text-muted-foreground">
                            Explora y consulta los procesos de la empresa.
                        </p>
                    </div>
                    {isAdmin && (
                        <Button asChild variant="outline">
                            <Link href="/procesos/admin" className="flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Panel de Administración
                            </Link>
                        </Button>
                    )}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProcesses?.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                            No se encontraron procesos que coincidan con tu búsqueda.
                        </div>
                    ) : (
                        filteredProcesses?.map((process: ProcessMap) => (
                            <Card key={process.id} className="hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Network className="w-5 h-5 text-primary" />
                                        {process.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="line-clamp-3 mb-4">
                                        {process.description || "Sin descripción."}
                                    </CardDescription>
                                    <Button asChild className="w-full">
                                        <Link href={`/procesos/${process.id}`} className="flex items-center justify-center gap-2">
                                            <BookOpen className="w-4 h-4" />
                                            Ver Proceso
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
