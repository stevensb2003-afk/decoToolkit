"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { ProcessVersion } from "@/lib/types";
import { Node, Edge } from "@xyflow/react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, Clock } from "lucide-react";

interface VersionHistoryPanelProps {
    open: boolean;
    onClose: () => void;
    processId: string;
    onRestore: (nodes: Node[], edges: Edge[]) => void;
}

export function VersionHistoryPanel({
    open,
    onClose,
    processId,
    onRestore,
}: VersionHistoryPanelProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [restoreTarget, setRestoreTarget] = useState<ProcessVersion | null>(null);

    const q = useMemoFirebase(
        () =>
            query(
                collection(firestore, "processes", processId, "versions"),
                orderBy("versionNumber", "desc")
            ),
        [firestore, processId]
    );

    const { data: versions, isLoading } = useCollection<ProcessVersion>(q);

    const handleRestore = async () => {
        if (!restoreTarget) return;
        try {
            onRestore(restoreTarget.nodes as Node[], restoreTarget.edges as Edge[]);
            toast({
                title: `Versión ${restoreTarget.versionNumber} restaurada`,
                description: "El canvas ahora muestra el estado de esa versión. Guarda para confirmar.",
            });
            setRestoreTarget(null);
            onClose();
        } catch (err: any) {
            toast({ title: "Error al restaurar", description: err.message, variant: "destructive" });
        }
    };

    const formatDate = (date: any) => {
        const d = date instanceof Date ? date : date?.toDate?.() ?? new Date(0);
        return d.toLocaleString("es-CR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <>
            <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
                <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col">
                    <SheetHeader className="pb-3 border-b">
                        <SheetTitle className="flex items-center gap-2 text-base">
                            <Clock className="w-4 h-4 text-primary" />
                            Historial de versiones
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto py-3 space-y-2">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : !versions?.length ? (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                No hay versiones guardadas aún. El historial se genera automáticamente al guardar.
                            </div>
                        ) : (
                            versions.map((version) => (
                                <div
                                    key={version.id}
                                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                v{version.versionNumber}
                                            </span>
                                            <span className="text-xs text-slate-500 truncate">
                                                {version.savedByName || "Admin"}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            {formatDate(version.savedAt)}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {version.nodes?.length ?? 0} pasos · {version.edges?.length ?? 0} conexiones
                                        </p>
                                        {version.changeNote && (
                                            <p className="text-[11px] italic text-slate-500 mt-1 border-l-2 border-primary/30 pl-2">
                                                {version.changeNote}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1 shrink-0"
                                        onClick={() => setRestoreTarget(version)}
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Restaurar
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Restore confirmation */}
            <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Restaurar versión {restoreTarget?.versionNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El canvas se cargará con el estado guardado el{" "}
                            <strong>{restoreTarget ? formatDate(restoreTarget.savedAt) : ""}</strong>.
                            Los cambios actuales no se perderán hasta que guardes de nuevo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore}>
                            Restaurar versión
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
