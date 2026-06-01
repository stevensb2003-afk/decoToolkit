"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from "@/firebase";
import {
  collection,
  query,
  getDocs,
  doc,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  Layers,
  Plus,
  Loader2,
  User as UserIcon,
  Package,
  LayoutGrid,
  ArrowRight,
  Sparkles,
  Phone,
  Building2,
} from "lucide-react";
import { convertToCm } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { CatalogMaterialPicker } from "@/app/project/[id]/_components/sheets/CatalogMaterialPicker";
import { NewMaterialCard } from "./_components/NewMaterialCard";
import { NewSurfaceRow } from "./_components/NewSurfaceRow";
import type { DefaultMaterial, Material, Project, UserProfile } from "@/lib/types";
import { useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface SurfaceFormValue {
  id: string;
  name: string;
  width: { value: number; unit: "m" | "cm" };
  height: { value: number; unit: "m" | "cm" };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const createCustomMaterial = (): Material => ({
  id: crypto.randomUUID(),
  name: "",
  width: 122,
  height: 244,
  color: "#C4956A",
  installationOrientation: "Vertical",
  defaultMaterialId: "custom",
});

const createSurface = (): SurfaceFormValue => ({
  id: crypto.randomUUID(),
  name: "",
  width: { value: 0, unit: "m" },
  height: { value: 0, unit: "m" },
});

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CreateProjectPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [surfaces, setSurfaces] = useState<SurfaceFormValue[]>([createSurface()]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // ── Firebase data ──────────────────────────────────────────────────────────
  const materialsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "defaultMaterials")) : null),
    [firestore]
  );
  const { isLoading: materialsLoading } =
    useCollection<DefaultMaterial>(materialsQuery);

  useEffect(() => {
    if (!firestore) return;
    const fetch = async () => {
      setUsersLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "users"));
        setAllUsers(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProfile));
      } catch {
        toast({ title: "Error", description: "No se cargó la lista de usuarios.", variant: "destructive" });
      } finally {
        setUsersLoading(false);
      }
    };
    fetch();
  }, [firestore, toast]);

  useEffect(() => {
    if (user && !assignedUserId) setAssignedUserId(user.uid);
  }, [user, assignedUserId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCatalogConfirm = useCallback(
    (selected: DefaultMaterial[]) => {
      setMaterials((prev) => {
        const existingIds = new Set(prev.map((m) => m.defaultMaterialId));
        const incoming = selected
          .filter((dm) => !existingIds.has(dm.id))
          .slice(0, 6 - prev.length)
          .map((dm) => ({
            id: crypto.randomUUID(),
            name: dm.name,
            width: dm.width,
            height: dm.height,
            color: dm.color ?? "#94a3b8",
            installationOrientation: "Vertical" as const,
            defaultMaterialId: dm.id,
            texture: dm.texture,
          }));
        return [...prev, ...incoming].slice(0, 6);
      });
      setCatalogOpen(false);
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    if (!projectName.trim()) {
      toast({ title: "Nombre requerido", description: "Ingresa un nombre para el proyecto.", variant: "destructive" });
      return;
    }
    if (materials.length === 0) {
      toast({ title: "Sin materiales", description: "Agrega al menos un material.", variant: "destructive" });
      return;
    }
    if (!surfaces.some((s) => s.name.trim())) {
      toast({ title: "Sin superficies", description: "Define al menos una superficie.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const processedMaterials: Material[] = materials.map((m) => ({
        ...m,
        width: typeof m.width === "number" ? m.width : convertToCm(m.width as any, "cm"),
        height: typeof m.height === "number" ? m.height : convertToCm(m.height as any, "cm"),
      }));

      const projectData: Omit<Project, "id" | "surfaces"> = {
        userId: assignedUserId || user.uid,
        projectName: projectName.trim(),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        materials: processedMaterials,
        remnants: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const projectRef = await addDoc(collection(firestore, "projects"), projectData);

      const batch = writeBatch(firestore);
      surfaces.filter((s) => s.name.trim()).forEach((s) => {
        const ref = doc(collection(firestore, "projects", projectRef.id, "surfaces"));
        batch.set(ref, {
          name: s.name.trim(),
          width: convertToCm(s.width.value, s.width.unit),
          height: convertToCm(s.height.value, s.height.unit),
        });
      });
      await batch.commit();

      toast({ title: "¡Proyecto creado!", description: "Redirigiendo al editor…" });
      router.push(`/project/${projectRef.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Ocurrió un error inesperado.", variant: "destructive" });
      setSubmitting(false);
    }
  };

  if (isUserLoading || materialsLoading || usersLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  const canAddMore = materials.length < 6;
  const existingDefaultIds = materials
    .map((m) => m.defaultMaterialId)
    .filter((id): id is string => !!id && id !== "custom");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">

            {/* ── Page Header ── */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-10"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Nuevo Proyecto</h1>
              </div>
              <p className="text-muted-foreground ml-11">
                Define los parámetros del proyecto para generar el plano de corte.
              </p>
            </motion.div>

            {/* ── Two-column layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── LEFT SIDEBAR: Project + Client details ── */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.08 }}
                className="lg:col-span-1 space-y-4"
              >
                {/* Project details card */}
                <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Proyecto</h2>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="projectName" className="text-xs text-muted-foreground">
                      Nombre *
                    </Label>
                    <Input
                      id="projectName"
                      placeholder="Ej., Remodelación de Cocina"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="h-9 bg-background/60 border-border/60 focus-visible:border-primary"
                    />
                  </div>

                  {/* Assigned user */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <UserIcon className="h-3 w-3" /> Asignado a
                    </Label>
                    <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                      <SelectTrigger className="h-9 bg-background/60 border-border/60">
                        <SelectValue placeholder="Seleccionar usuario…" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Client details card */}
                <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Cliente</h2>
                    <span className="text-xs text-muted-foreground ml-auto">Opcional</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="clientName" className="text-xs text-muted-foreground">Nombre</Label>
                    <Input
                      id="clientName"
                      placeholder="Ej., Juan Pérez"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="h-9 bg-background/60 border-border/60 focus-visible:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clientPhone" className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> Teléfono
                    </Label>
                    <Input
                      id="clientPhone"
                      placeholder="Ej., 8888-8888"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="h-9 bg-background/60 border-border/60 focus-visible:border-primary"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="w-full h-11 gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {submitting ? "Creando proyecto…" : "Crear Proyecto"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    disabled={submitting}
                    onClick={() => router.push("/projects")}
                    className="w-full h-10 text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </Button>
                </div>
              </motion.div>


              {/* ── RIGHT PANEL: Materials + Surfaces ── */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.12 }}
                className="lg:col-span-2 space-y-6"
              >
                {/* ── Materials section ── */}
                <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Materiales</h2>
                      <span className="text-xs text-muted-foreground">
                        {materials.length}/6
                      </span>
                    </div>
                    {canAddMore && (
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCatalogOpen(true)}
                          className="h-7 px-2.5 text-xs gap-1.5 border-border/60 hover:!bg-primary/10 hover:!text-primary hover:!border-primary/40"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Del catálogo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setMaterials((p) => [...p, createCustomMaterial()])
                          }
                          className="h-7 px-2.5 text-xs gap-1.5 border-border/60 hover:!bg-muted/40 hover:!text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Personalizado
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Empty state */}
                  {materials.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed border-border/40 bg-muted/10 gap-4"
                    >
                      <div className="h-14 w-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                        <Package className="h-6 w-6 text-primary/60" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-foreground/80">
                          Sin materiales aún
                        </p>
                        <p className="text-xs text-muted-foreground max-w-[220px]">
                          Agrega desde el catálogo o crea uno personalizado para este proyecto.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => setCatalogOpen(true)}
                          className="gap-1.5"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Del catálogo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMaterials([createCustomMaterial()])}
                          className="gap-1.5 border-border/60 hover:!bg-muted/40 hover:!text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Personalizado
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Material list */}
                  {materials.length > 0 && (
                    <div className="max-h-[380px] overflow-y-auto pr-1.5 space-y-3 scrollbar-thin scrollbar-thumb-muted-foreground/10 scrollbar-track-transparent">
                      <AnimatePresence mode="popLayout">
                        {materials.map((m, i) => (
                          <NewMaterialCard
                            key={m.id}
                            material={m}
                            index={i}
                            onChange={(updated) =>
                              setMaterials((p) =>
                                p.map((x) => (x.id === updated.id ? updated : x))
                              )
                            }
                            onDelete={() =>
                              setMaterials((p) => p.filter((x) => x.id !== m.id))
                            }
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* ── Surfaces section ── */}
                <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Superficies</h2>
                      <span className="text-xs text-muted-foreground">
                        {surfaces.length}/6
                      </span>
                    </div>
                    {surfaces.length < 6 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSurfaces((p) => [...p, createSurface()])}
                        className="h-7 px-2.5 text-xs gap-1.5 border-border/60 hover:!bg-muted/40 hover:!text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar
                      </Button>
                    )}
                  </div>

                  {/* Header labels */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 px-3 pb-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Nombre
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-20 text-right">
                      Ancho
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-16" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-20 text-right">
                      Alto
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-16" />
                    <span className="w-8" />
                  </div>

                  {/* Surface rows */}
                  <AnimatePresence mode="popLayout">
                    {surfaces.map((s, i) => (
                      <NewSurfaceRow
                        key={s.id}
                        surface={s}
                        canDelete={surfaces.length > 1}
                        onChange={(updated) =>
                          setSurfaces((p) =>
                            p.map((x) => (x.id === updated.id ? updated : x))
                          )
                        }
                        onDelete={() =>
                          setSurfaces((p) => p.filter((x) => x.id !== s.id))
                        }
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </div>
        </form>

        {/* Catalog picker dialog */}
        <CatalogMaterialPicker
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          existingMaterialDefaultIds={existingDefaultIds}
          onConfirm={handleCatalogConfirm}
        />
      </main>
    </div>
  );
}
