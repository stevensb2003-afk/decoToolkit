"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { UserProfile, Project } from "@/lib/types";
import { doc, collection, query, where, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PlusCircle, Loader, Search, Filter, Layers,
  LayoutGrid, List, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { ProjectCard } from "./_components/ProjectCard";
import { ProjectListItem } from "./_components/ProjectListItem";
import { ProjectsLoadingSkeleton, ProjectsEmptyState } from "./_components/EmptyAndSkeleton";

const OWNER_EMAIL = 'stevensb.2003@gmail.com';
const GRID_PAGE_SIZE = 8;
const LIST_PAGE_SIZE = 8;

// ── Pagination UI ─────────────────────────────────────────────────────────────
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const showPages = pages.filter(
    p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  );

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {showPages.map((page, idx) => {
        const prev = showPages[idx - 1];
        const showEllipsis = prev && page - prev > 1;
        return (
          <span key={page} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-muted-foreground text-sm">…</span>}
            <Button
              variant={currentPage === page ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 text-sm"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          </span>
        );
      })}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const profileRef = useMemo(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  const [claims, setClaims] = useState<{ admin?: boolean }>({});
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) { setIsClaimsLoading(false); return; }
    user.getIdTokenResult()
      .then(r => { setClaims({ admin: !!r.claims.admin }); setIsClaimsLoading(false); })
      .catch(err => { console.error("Error getting user token:", err); setIsClaimsLoading(false); });
  }, [user, isUserLoading]);

  const isAdmin = claims.admin === true || profile?.isAdmin === true;
  const isOwner = user?.email === OWNER_EMAIL;

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!isProfileLoading && profile && !isUserLoading && user) {
      const allowed = profile.permissions?.allowedModules || [];
      if (!isOwner && !isAdmin && !allowed.includes('projects')) router.push('/');
    }
  }, [isProfileLoading, profile, isUserLoading, user, router, isOwner, isAdmin]);

  const projectsQuery = useMemoFirebase(() => {
    if (isClaimsLoading || !firestore || !user) return null;
    const col = collection(firestore, "projects");
    return isAdmin
      ? query(col, orderBy("createdAt", "desc"))
      : query(col, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
  }, [firestore, user, isAdmin, isClaimsLoading]);

  const { data: projects, isLoading: areProjectsLoading } = useCollection<Project>(projectsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, "users");
  }, [firestore, isAdmin]);

  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  // ── Filter + view state ────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isClient, setIsClient] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('projectsViewMode');
    if (saved === 'list' || saved === 'grid') setViewMode(saved);
  }, []);

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    setCurrentPage(1);
    localStorage.setItem('projectsViewMode', mode);
  };

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCreatorId]);

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

  const pageSize = viewMode === 'grid' ? GRID_PAGE_SIZE : LIST_PAGE_SIZE;
  const totalPages = Math.ceil(filteredProjects.length / pageSize);
  const pagedProjects = filteredProjects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    allUsers?.forEach(u => { map[u.id] = u.displayName || u.email; });
    if (user && profile) map[user.uid] = profile.displayName || user.email || '';
    return map;
  }, [allUsers, user, profile]);

  const isLoading = isUserLoading || isClaimsLoading || isProfileLoading ||
    (projectsQuery !== null && areProjectsLoading);
  const pageTitle = isAdmin ? "Todos los Proyectos" : "Mis Proyectos";

  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">

          {/* ── Header ── */}
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h1 className="text-3xl font-bold font-headline tracking-tight">{pageTitle}</h1>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <Button asChild variant="outline" className="w-full md:w-auto">
                  <Link href="/materials"><Layers className="mr-2 h-4 w-4" /> Materiales</Link>
                </Button>
                <Button asChild className="w-full md:w-auto shadow-lg shadow-primary/20">
                  <Link href="/project/new"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Proyecto</Link>
                </Button>
              </div>
            </div>

            {/* ── Filters Bar ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-muted/20 p-4 rounded-xl border border-primary/5">
              <div className="md:col-span-6 lg:col-span-7 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre de proyecto o cliente..."
                  className="pl-10 h-11 bg-white shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="md:col-span-4 lg:col-span-3">
                {isAdmin && allUsers && (
                  <Select value={selectedCreatorId} onValueChange={setSelectedCreatorId}>
                    <SelectTrigger className="h-11 bg-white shadow-sm">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filtrar por creador" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los creadores</SelectItem>
                      {allUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.displayName || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="md:col-span-2 lg:col-span-2 flex items-center md:justify-end">
                {isClient && (
                  <div className="flex items-center bg-white p-1 rounded-lg border border-primary/10 shadow-sm w-full md:w-auto justify-between md:justify-start">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => handleViewModeChange('grid')}
                      className={`h-9 px-3 w-1/2 md:w-auto ${viewMode === 'grid' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground'}`}
                      title="Vista Cuadrícula"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => handleViewModeChange('list')}
                      className={`h-9 px-3 w-1/2 md:w-auto ${viewMode === 'list' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground'}`}
                      title="Vista Lista"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center gap-4">
                <Loader className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium animate-pulse">Cargando proyectos...</p>
              </div>
            </div>
          ) : filteredProjects.length > 0 ? (
            <>
              {/* Results info */}
              <p className="text-xs text-muted-foreground mb-3">
                Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProjects.length)} de {filteredProjects.length} proyectos
              </p>

              {viewMode === 'grid' ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pagedProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      creatorName={userMap[project.userId]}
                      firestore={firestore}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-primary/10 bg-white overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Proyecto</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden lg:table-cell">Creador</TableHead>
                        <TableHead className="hidden sm:table-cell">Materiales</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedProjects.map(project => (
                        <ProjectListItem
                          key={project.id}
                          project={project}
                          creatorName={userMap[project.userId]}
                          firestore={firestore}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </>
          ) : (
            <ProjectsEmptyState />
          )}
        </div>
      </main>
    </>
  );
}
