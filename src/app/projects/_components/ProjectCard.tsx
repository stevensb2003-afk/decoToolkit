'use client';

import { useState } from "react";
import Link from "next/link";
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
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { ArrowRight, User, Loader, Download, Trash2, Phone } from "lucide-react";
import type { Project, DefaultMaterial } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
  creatorName?: string;
  firestore: Firestore;
}

export function ProjectCard({ project, creatorName, firestore }: ProjectCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const { toast } = useToast();

  const getFormattedDate = () => {
    if (project.createdAt && project.createdAt instanceof Timestamp) {
      return format(project.createdAt.toDate(), 'd MMMM, yyyy', { locale: es });
    }
    return 'N/A';
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
      console.error("Error generating PDF from card:", error);
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
    <Card className="flex flex-col h-full transition-shadow duration-300 hover:shadow-lg border-primary/10 relative group">
      <div className="absolute top-2 right-2 z-10">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-destructive hover:bg-transparent transition-colors" title="Eliminar Proyecto">
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
                Eliminar Proyecto
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <CardHeader className="pb-3 pr-10">
        <CardTitle className="truncate text-xl">
          <Link href={`/project/${project.id}`} className="hover:underline hover:text-primary transition-colors">
            {project.projectName}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-center text-xs">Creado el: {getFormattedDate()}</CardDescription>
      </CardHeader>

      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2">
          {project.clientName && (
            <div className="flex flex-col gap-1 bg-muted/30 p-2 rounded-md">
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">{project.clientName}</span>
              </div>
              {project.clientPhone && (
                <div className="flex items-center text-xs text-muted-foreground/70 ml-6">
                  <Phone className="mr-2 h-3 w-3" />
                  <span>{project.clientPhone}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center text-xs text-muted-foreground/80 px-2">
            <span>{project.materials.length} Material{project.materials.length !== 1 ? 'es' : ''}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-3 pt-0">
        <div className="w-full flex items-center justify-between text-[10px] text-muted-foreground/60 px-1 italic">
          <span>Editor: {creatorName || 'Desconocido'}</span>
        </div>
        <div className="flex w-full gap-2">
          <Button asChild className="flex-grow bg-primary hover:bg-primary/90 shadow-sm">
            <Link href={`/project/${project.id}`}>
              Abrir Editor <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors shadow-sm" onClick={handleDownloadPDF} disabled={isGenerating} title="Descargar Reporte PDF">
            {isGenerating ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
