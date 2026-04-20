
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { UserProfile, Project, DefaultMaterial } from "@/lib/types";
import { useRouter } from "next/navigation";
import { doc, getDocs, collection, query, where, orderBy, Timestamp, writeBatch, deleteDoc, type Firestore, type Query } from "firebase/firestore";
import { generateProjectPDF } from "@/lib/pdf-report";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle, ArrowRight, User, Loader, Search, Filter, FolderKanban, Download, Trash2, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OWNER_EMAIL = 'stevensb.2003@gmail.com';

function ProjectCard({ project, creatorName, firestore }: { project: Project; creatorName?: string; firestore: Firestore }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const { toast } = useToast();

  const getFormattedDate = () => {
    if (project.createdAt && project.createdAt instanceof Timestamp) {
      return format(project.createdAt.toDate(), 'd MMMM, yyyy', { locale: es });
    }
    return 'N/A';
  }

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isGenerating) return;
    setIsGenerating(true);

    try {
      // Fetch sub-collections on-demand
      const surfacesSnapshot = await getDocs(collection(firestore, "projects", project.id, "surfaces"));
      const piecesSnapshot = await getDocs(collection(firestore, "projects", project.id, "placedPieces"));
      const obstaclesSnapshot = await getDocs(collection(firestore, "projects", project.id, "obstacles"));

      const surfaces = surfacesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const placedPieces = piecesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Sort pieces by createdAt to mimic Editor Z-Index (capas)
      placedPieces.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeA - timeB;
      });

      const obstacles = obstaclesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const defaultMaterialsCol = collection(firestore, "defaultMaterials");
      const defaultMaterialsSnap = await getDocs(defaultMaterialsCol);
      const defaultMaterials = defaultMaterialsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DefaultMaterial[];

      await generateProjectPDF({
        project,
        surfaces,
        placedPieces,
        obstacles,
        remnants: project.remnants || [],
        defaultMaterials,
        creatorName
      });
    } catch (error) {
      console.error("Error generating PDF from card:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmation !== project.projectName) return;

    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);

      // Delete sub-collections
      const collectionsToClean = ["surfaces", "placedPieces", "obstacles"];
      for (const colName of collectionsToClean) {
        const colRef = collection(firestore, "projects", project.id, colName);
        const snapshot = await getDocs(colRef);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      // Delete main document
      batch.delete(doc(firestore, "projects", project.id));

      await batch.commit();

      toast({
        title: "Proyecto eliminado",
        description: `El proyecto "${project.projectName}" ha sido eliminado correctamente.`,
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="flex flex-col h-full transition-shadow duration-300 hover:shadow-lg border-primary/10 relative group">
      <div className="absolute top-2 right-2 z-10">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground/60 hover:text-destructive hover:bg-transparent transition-colors"
              title="Eliminar Proyecto"
            >
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
              <p className="text-sm font-medium">
                Para confirmar, escriba el nombre del proyecto a continuación:
              </p>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={project.projectName}
                className="border-primary/20 focus-visible:ring-primary"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProject}
                disabled={deleteConfirmation !== project.projectName || isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                Eliminar Proyecto
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <CardHeader className="pb-3 pr-10">
        <CardTitle className="truncate text-xl">{project.projectName}</CardTitle>
        <CardDescription className="flex items-center text-xs">
          Creado el: {getFormattedDate()}
        </CardDescription>
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
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors shadow-sm"
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            title="Descargar Reporte PDF"
          >
            {isGenerating ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function ProjectsLoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/4 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function ProjectsEmptyState() {
  return (
    <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/10">
      <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <FolderKanban className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold">No se encontraron proyectos</h2>
      <p className="text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
        Comienza creando tu primer proyecto o ajusta los filtros de búsqueda.
      </p>
      <Button asChild className="shadow-md">
        <Link href="/project/new">
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Proyecto
        </Link>
      </Button>
    </div>
  );
}

export default function ProjectsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  // --- CORRECT WAY TO GET CLAIMS ---
  const [claims, setClaims] = useState<{ admin?: boolean }>({});
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setIsClaimsLoading(false);
      return;
    }
    user.getIdTokenResult().then((idTokenResult) => {
      setClaims({ admin: !!idTokenResult.claims.admin });
      setIsClaimsLoading(false);
    }).catch(error => {
      console.error("Error getting user token:", error);
      setIsClaimsLoading(false);
    });
  }, [user, isUserLoading]);

  const isAdmin = claims.admin === true || profile?.isAdmin === true;
  const isOwner = user?.email === OWNER_EMAIL;

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!isProfileLoading && profile && !isUserLoading && user) {
      const allowedModules = profile.permissions?.allowedModules || [];
      if (!isOwner && !isAdmin && !allowedModules.includes('projects')) {
        router.push('/');
      }
    }
  }, [isProfileLoading, profile, isUserLoading, user, router, isOwner, isAdmin]);

  const projectsQuery = useMemoFirebase(() => {
    if (isClaimsLoading || !firestore || !user) {
      return null;
    }

    const projectsCollection = collection(firestore, "projects");

    if (isAdmin) {
      // Admin sees all projects
      return query(projectsCollection, orderBy("createdAt", "desc"));
    } else {
      // Regular user sees only their own projects
      return query(projectsCollection, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    }
  }, [firestore, user, isAdmin, isClaimsLoading]);

  const { data: projects, isLoading: areProjectsLoading } = useCollection<Project>(projectsQuery);

  // Fetch all users for name mapping and filter
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, "users");
  }, [firestore, isAdmin]);

  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  // State for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>("all");

  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    return projects.filter(p => {
      const matchesSearch =
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      const matchesCreator = selectedCreatorId === "all" || p.userId === selectedCreatorId;

      return matchesSearch && matchesCreator;
    });
  }, [projects, searchTerm, selectedCreatorId]);

  const isLoading = isUserLoading || isClaimsLoading || isProfileLoading || (projectsQuery !== null && areProjectsLoading);

  const pageTitle = isAdmin ? "Todos los Proyectos" : "Mis Proyectos";

  // Create a user map for easy lookup
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (allUsers) {
      allUsers.forEach(u => {
        map[u.id] = u.displayName || u.email;
      });
    }
    // Also add the current user just in case
    if (user && profile) {
      map[user.uid] = profile.displayName || user.email || '';
    }
    return map;
  }, [allUsers, user, profile]);

  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 md:p-8">
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h1 className="text-3xl font-bold font-headline tracking-tight">{pageTitle}</h1>
              <Button asChild className="w-full md:w-auto shadow-lg shadow-primary/20">
                <Link href="/project/new">
                  <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Proyecto
                </Link>
              </Button>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-muted/20 p-4 rounded-xl border border-primary/5">
              <div className="md:col-span-8 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre de proyecto o cliente..."
                  className="pl-10 h-11 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="md:col-span-4">
                {isAdmin && allUsers && (
                  <Select value={selectedCreatorId} onValueChange={setSelectedCreatorId}>
                    <SelectTrigger className="h-11 bg-white">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filtrar por creador" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los creadores</SelectItem>
                      {allUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.displayName || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center gap-4">
                <Loader className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium animate-pulse">Cargando proyectos...</p>
              </div>
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  creatorName={userMap[project.userId]}
                  firestore={firestore}
                />
              ))}
            </div>
          ) : (
            <ProjectsEmptyState />
          )}
        </div>
      </main>
    </>
  );
}
