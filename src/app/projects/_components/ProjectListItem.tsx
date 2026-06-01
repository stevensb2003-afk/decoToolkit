'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Timestamp, getDocs, collection, writeBatch, doc, type Firestore } from "firebase/firestore";
import { generateProjectPDF } from "@/lib/pdf-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { User, Loader, Download, Trash2 } from "lucide-react";
import type { Project, DefaultMaterial } from "@/lib/types";

interface ProjectListItemProps {
  project: Project;
  creatorName?: string;
  firestore: Firestore;
}

export function ProjectListItem({ project, creatorName, firestore }: ProjectListItemProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const { toast } = useToast();

  const getFormattedDate = () => {
    if (project.createdAt && project.createdAt instanceof Timestamp) {
      return format(project.createdAt.toDate(), 'd MMM, yy', { locale: es });
    }
    return 'N/A';
  };

  const handleRowClick = () => {
    router.push(`/project/${project.id}`);
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const surfacesSnapshot = await getDocs(collection(firestore, "projects", project.id, "surfaces"));
      const piecesSnapshot = await getDocs(collection(firestore, "projects", project.id, "placedPieces"));
      const obstaclesSnapshot = await getDocs(collection(firestore, "projects", project.id, "obstacles"));

      const surfaces = surfacesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const placedPieces = piecesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      placedPieces.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeA - timeB;
      });
      const obstacles = obstaclesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const defaultMaterialsSnap = await getDocs(collection(firestore, "defaultMaterials"));
      const defaultMaterials = defaultMaterialsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as DefaultMaterial[];

      await generateProjectPDF({ project, surfaces, placedPieces, obstacles, remnants: project.remnants || [], defaultMaterials, creatorName });
    } catch (error) {
      console.error("Error generating PDF from list item:", error);
      toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmation !== project.projectName) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      for (const colName of ["surfaces", "placedPieces", "obstacles"]) {
        const snapshot = await getDocs(collection(firestore, "projects", project.id, colName));
        snapshot.docs.forEach(d => batch.delete(d.ref));
      }
      batch.delete(doc(firestore, "projects", project.id));
      await batch.commit();
      toast({ title: "Proyecto eliminado", description: `El proyecto "${project.projectName}" ha sido eliminado correctamente.` });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({ title: "Error", description: "No se pudo eliminar el proyecto.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TableRow
      className="group hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={handleRowClick}
    >
      <TableCell className="font-medium py-3">
        <div className="flex flex-col">
          <span className="hover:text-primary transition-colors text-base truncate max-w-[180px] sm:max-w-[200px] md:max-w-[250px]">
            {project.projectName}
          </span>
          <span className="text-[10px] text-muted-foreground md:hidden mt-0.5">{getFormattedDate()}</span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm whitespace-nowrap">{getFormattedDate()}</TableCell>
      <TableCell className="py-3">
        {project.clientName ? (
          <div className="flex flex-col">
            <span className="text-sm flex items-center truncate max-w-[140px] sm:max-w-[150px] md:max-w-[200px]">
              <User className="mr-1 h-3 w-3 flex-shrink-0 text-primary" />{project.clientName}
            </span>
            {project.clientPhone && (
              <span className="text-[10px] text-muted-foreground ml-4 truncate max-w-[140px]">{project.clientPhone}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs italic">Sin cliente</span>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
        {creatorName || 'Desconocido'}
      </TableCell>
      <TableCell className="hidden sm:table-cell py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
          {project.materials.length} Mat.
        </span>
      </TableCell>
      {/* Isolated actions cell — stops row click propagation */}
      <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary hover:text-white transition-colors" onClick={handleDownloadPDF} disabled={isGenerating} title="Descargar Reporte PDF">
            {isGenerating ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Eliminar Proyecto">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente el proyecto
                  <strong> "{project.projectName}"</strong> y todos sus datos asociados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="my-4 space-y-2">
                <p className="text-sm font-medium">Para confirmar, escriba el nombre del proyecto a continuación:</p>
                <Input value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={project.projectName} className="border-primary/20 focus-visible:ring-primary" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProject} disabled={deleteConfirmation !== project.projectName || isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {isDeleting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
