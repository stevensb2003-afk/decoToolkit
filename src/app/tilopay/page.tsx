"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { collection, query, where, doc } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader, Copy, RefreshCw, XCircle, CreditCard, Link as LinkIcon, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle, Ban, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserProfile } from "@/lib/types";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

const formSchema = z.object({
  firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  amount: z.number().min(100, "El monto mínimo es de 100 CRC"),
  description: z.string().optional()
});

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none gap-1"><CheckCircle2 className="w-3 h-3" />Pagado</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>;
    case "declined":
      return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-200 border-none gap-1"><AlertCircle className="w-3 h-3" />Declinado</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-slate-500 border-slate-200 gap-1"><Ban className="w-3 h-3" />Cancelado</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function TilopayPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(true); // Para móvil: colapsar/expandir formulario
  const [consultingId, setConsultingId] = useState<string | null>(null);
  
  // Búsqueda y filtros del historial
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Sincronización Manual
  const [manualOrderId, setManualOrderId] = useState("");
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isSyncExpanded, setIsSyncExpanded] = useState(false);

  const profileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  const isAdmin = profile?.isAdmin || user?.email === 'stevensb.2003@gmail.com';
  const hasAccess = isAdmin || (profile?.permissions?.allowedModules || []).includes("tilopay");

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        router.push("/login");
      } else if (!hasAccess) {
        router.push("/");
      }
    }
  }, [user, isUserLoading, isProfileLoading, hasAccess, router]);

  const linksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    if (isAdmin) {
      return query(collection(firestore, "payment_links"));
    }
    return query(collection(firestore, "payment_links"), where("createdBy", "==", user.uid));
  }, [firestore, user, isAdmin]);

  const { data: links, isLoading: linksLoading } = useCollection<any>(linksQuery);

  const sortedLinks = useMemo(() => {
    if (!links) return [];
    return [...links].sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0;
      const timeB = b.createdAt?.toMillis() || 0;
      return timeB - timeA;
    });
  }, [links]);

  // Links filtrados por búsqueda y estado
  const filteredLinks = useMemo(() => {
    let result = sortedLinks;
    // Filtro por estado
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }
    // Filtro por búsqueda (nombre cliente, descripción, orderId)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.clientName?.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q) ||
          l.tilopayOrderId?.toLowerCase().includes(q) ||
          l.clientEmail?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sortedLinks, searchQuery, statusFilter]);

  // Contadores por estado para los pills de filtro
  const statusCounts = useMemo(() => ({
    all: sortedLinks.length,
    pending: sortedLinks.filter((l) => l.status === "pending").length,
    paid: sortedLinks.filter((l) => l.status === "paid").length,
    declined: sortedLinks.filter((l) => l.status === "declined").length,
    cancelled: sortedLinks.filter((l) => l.status === "cancelled").length,
  }), [sortedLinks]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsedAmount = parseFloat(amount);
    const result = formSchema.safeParse({
        firstName,
        lastName,
        amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        description
    });

    if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach(issue => {
            if (issue.path[0]) {
                fieldErrors[issue.path[0].toString()] = issue.message;
            }
        });
        setErrors(fieldErrors);
        return;
    }

    setIsGenerating(true);
    setGeneratedUrl("");

    try {
      const response = await fetch("/api/tilopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: result.data.amount,
          currency: "CRC",
          order: `ORD${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(-3).toUpperCase()}`,
          clientName: `${result.data.firstName} ${result.data.lastName}`.trim(),
          firstName: result.data.firstName,
          lastName: result.data.lastName,
          description: result.data.description,
          createdBy: user?.uid,
          createdByName: profile?.displayName || user?.displayName || user?.email || "Usuario",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al generar link");

      setGeneratedUrl(data.url);
      setAmount("");
      setFirstName("");
      setLastName("");
      setDescription("");
      toast({ title: "Link Generado", description: "El link de pago está listo para ser enviado." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Copiado", description: "Link de pago copiado al portapapeles." });
  };

  const handleCheckStatus = async (docId: string, orderId: string) => {
    setConsultingId(docId);
    try {
      toast({ title: "Consultando...", description: "Verificando el estado con Tilopay." });
      // Pasamos docId para lookup directo en Firestore (más rápido y confiable)
      const res = await fetch(`/api/tilopay?docId=${encodeURIComponent(docId)}&orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al consultar estado");

      const statusMap: Record<string, string> = { paid: "PAGADO ✅", pending: "PENDIENTE ⏳", declined: "DECLINADO ❌", cancelled: "CANCELADO" };
      
      if (data.source === "firestore_cached") {
        toast({ 
          title: "Pago no procesado aún", 
          description: `Tilopay no registra ningún pago para este link. Estado actual: ${statusMap[data.status] || data.status}. El cliente aún no ha completado el pago.`,
          variant: "default"
        });
      } else {
        toast({ 
          title: "Estado Confirmado por Tilopay", 
          description: `Estado: ${statusMap[data.status] || data.status.toUpperCase()}`,
          variant: "default"
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setConsultingId(null);
    }
  };

  const handleCancel = async (docId: string, orderId: string) => {
    if (!confirm("¿Seguro que deseas cancelar este link de pago?")) return;
    try {
      const res = await fetch(`/api/tilopay?orderId=${orderId}&docId=${docId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cancelar");
      toast({ title: "Cancelado", description: "El link ha sido cancelado exitosamente." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleManualSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrderId.trim()) return;
    setIsManualSyncing(true);
    try {
      toast({ title: "Consultando Tilopay...", description: `Buscando ${manualOrderId}...` });
      // Llama a la API que ahora usa el mapeo avanzado
      const res = await fetch(`/api/tilopay?orderId=${encodeURIComponent(manualOrderId.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se encontró o hubo un error");

      const statusMap: Record<string, string> = { paid: "PAGADO ✅", pending: "PENDIENTE ⏳", declined: "DECLINADO ❌", cancelled: "CANCELADO" };
      toast({ 
        title: "Sincronización Exitosa", 
        description: `Estado recuperado: ${statusMap[data.status] || data.status.toUpperCase()}`,
        variant: "default"
      });
      setManualOrderId("");
    } catch (error: any) {
      toast({ title: "Error de Sincronización", description: error.message, variant: "destructive" });
    } finally {
      setIsManualSyncing(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader className="animate-spin w-8 h-8" /></div>;
  }

  if (!hasAccess) return null;

  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-indigo-50/30">
        {/* Contenedor expandido: usamos casi todo el ancho disponible */}
        <div className="w-full px-2 sm:px-4 lg:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
          
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-1 md:px-2"
          >
            <div className="p-2.5 bg-indigo-100/50 backdrop-blur-md rounded-2xl border border-indigo-100 shadow-sm shrink-0">
                <CreditCard className="w-6 h-6 md:w-7 md:h-7 text-indigo-600" />
            </div>
            <div>
                <h1 className="text-xl md:text-3xl font-bold font-headline text-slate-900 leading-tight">
                Pagos Tilopay
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">Genera y administra cobros rápidamente.</p>
            </div>
          </motion.header>

          {/* Layout: en móvil apilado, en escritorio lado a lado con tabla prioritaria */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            
            {/* FORMULARIO Y HERRAMIENTAS */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:w-80 xl:w-[400px] shrink-0 flex flex-col gap-4 md:gap-6"
            >
              <Card className="border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-indigo-100/40 rounded-3xl overflow-hidden relative shrink-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                
                {/* Header del formulario - Clickeable en móvil */}
                <CardHeader 
                  className="bg-white/50 border-b border-white/20 pb-4 pt-7 cursor-pointer lg:cursor-default"
                  onClick={() => setFormOpen(!formOpen)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Generar Link de Pago</CardTitle>
                      <CardDescription className="text-sm mt-0.5">Crea un link seguro para enviar por WhatsApp o correo.</CardDescription>
                    </div>
                    <div className="lg:hidden text-slate-400">
                      {formOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </CardHeader>

                <AnimatePresence>
                  {(formOpen) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <CardContent className="pt-5">
                        <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-slate-700 text-sm">Nombre</Label>
                              <Input 
                                placeholder="Nombre" 
                                value={firstName} 
                                onChange={(e) => setFirstName(e.target.value)}
                                className={`bg-white/80 border-slate-200 focus-visible:ring-indigo-500 transition-all h-9 ${errors.firstName ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                              />
                              {errors.firstName && <p className="text-xs text-red-500 font-medium">{errors.firstName}</p>}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-slate-700 text-sm">Apellido</Label>
                              <Input 
                                placeholder="Apellido" 
                                value={lastName} 
                                onChange={(e) => setLastName(e.target.value)}
                                className={`bg-white/80 border-slate-200 focus-visible:ring-indigo-500 transition-all h-9 ${errors.lastName ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                              />
                              {errors.lastName && <p className="text-xs text-red-500 font-medium">{errors.lastName}</p>}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-slate-700 text-sm">Monto (CRC)</Label>
                            <Input 
                              type="number" 
                              min="1" 
                              step="0.01" 
                              placeholder="Ej. 15000" 
                              value={amount} 
                              onChange={(e) => setAmount(e.target.value)}
                              className={`bg-white/80 border-slate-200 focus-visible:ring-indigo-500 transition-all h-9 ${errors.amount ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            />
                            {errors.amount && <p className="text-xs text-red-500 font-medium">{errors.amount}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-slate-700 text-sm">Descripción / Referencia</Label>
                            <Input 
                              placeholder="Detalle del cobro (opcional)" 
                              value={description} 
                              onChange={(e) => setDescription(e.target.value)}
                              className="bg-white/80 border-slate-200 focus-visible:ring-indigo-500 transition-all h-9"
                            />
                          </div>
                          <div className="pt-2">
                            <Button 
                              type="submit" 
                              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all rounded-xl h-11" 
                              disabled={isGenerating}
                            >
                              {isGenerating ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                              {isGenerating ? "Generando..." : "Crear Link de Pago"}
                            </Button>
                          </div>
                        </form>
                      </CardContent>

                      <AnimatePresence>
                        {generatedUrl && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <CardFooter className="bg-indigo-50/80 border-t border-indigo-100/50 flex flex-col items-stretch p-4 gap-3">
                              <p className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                ¡Link generado exitosamente!
                              </p>
                              <div className="flex gap-2">
                                <Input readOnly value={generatedUrl} className="bg-white border-indigo-200 text-indigo-900 shadow-inner text-xs h-9" />
                                <Button variant="secondary" onClick={() => handleCopy(generatedUrl)} className="bg-white hover:bg-slate-100 text-indigo-700 shadow-sm border border-slate-200 shrink-0">
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardFooter>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {isAdmin && (
                <Card className="border border-white/40 bg-white/70 backdrop-blur-xl shadow-md rounded-2xl overflow-hidden transition-all duration-300">
                  <CardHeader 
                    className="bg-slate-50/50 border-b border-slate-100 py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    onClick={() => setIsSyncExpanded(!isSyncExpanded)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                        <RefreshCw className={`w-4 h-4 text-indigo-500 ${isManualSyncing ? 'animate-spin' : ''}`} />
                        Sincronización Manual
                      </CardTitle>
                      <div className="text-slate-400">
                        {isSyncExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </CardHeader>
                  <AnimatePresence>
                    {isSyncExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <CardContent className="p-4 pt-4">
                          <form onSubmit={handleManualSync} className="flex gap-2">
                            <Input 
                              placeholder="ID (Ej: TPYS-1234, DT-..., ORD-...)" 
                              value={manualOrderId}
                              onChange={(e) => setManualOrderId(e.target.value)}
                              className="bg-white/80 border-slate-200 h-9 text-xs focus-visible:ring-indigo-500"
                            />
                            <Button 
                              type="submit" 
                              disabled={isManualSyncing || !manualOrderId.trim()}
                              className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white shrink-0 rounded-lg transition-all"
                            >
                              {isManualSyncing ? <Loader className="w-4 h-4 animate-spin" /> : "Sincronizar"}
                            </Button>
                          </form>
                          <p className="text-[10px] text-slate-500 mt-2 leading-tight px-0.5">
                            Usa esta herramienta si un pago no se actualiza. Pega el ID que aparece en el dashboard de Tilopay.
                          </p>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}
            </motion.div>

            {/* HISTORIAL - Toma todo el espacio restante */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-1 min-w-0"
            >
              <Card className="border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/50 rounded-3xl h-full flex flex-col">
                <CardHeader className="border-b border-white/20 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Historial de Transacciones</CardTitle>
                      <CardDescription className="text-sm">
                        {isAdmin ? "Todas las transacciones de la empresa." : "Tus transacciones recientes."}
                      </CardDescription>
                    </div>
                    {/* Barra de búsqueda */}
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar cliente, ID, concepto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                      />
                    </div>
                  </div>
                  {/* Pills de filtro por estado */}
                  <div className="flex gap-2 flex-wrap mt-2">
                    {([
                      { key: "all", label: "Todos" },
                      { key: "paid", label: "Pagados" },
                      { key: "pending", label: "Pendientes" },
                      { key: "declined", label: "Declinados" },
                      { key: "cancelled", label: "Cancelados" },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                          statusFilter === key
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                      >
                        {label}
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                          statusFilter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          {statusCounts[key]}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                  {linksLoading ? (
                    <div className="p-12 flex justify-center items-center flex-1">
                      <Loader className="animate-spin w-8 h-8 text-indigo-400" />
                    </div>
                  ) : filteredLinks.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex-1 flex items-center justify-center flex-col gap-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <Search className="w-8 h-8 text-slate-300" />
                      </div>
                      <p>{sortedLinks.length === 0 ? "No hay links de pago registrados." : "No se encontraron resultados para tu búsqueda."}</p>
                    </div>
                  ) : (
                    <>
                      {/* Vista de tabla - solo en pantallas medianas y grandes */}
                      <div className="hidden md:block overflow-auto flex-1 max-h-[550px] relative scrollbar-thin scrollbar-thumb-slate-200">
                        <Table>
                          <TableHeader className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                            <TableRow className="border-slate-100 hover:bg-transparent">
                              <TableHead className="font-semibold text-slate-600 py-3 pl-4 text-xs uppercase tracking-wider bg-slate-50/50">Fecha</TableHead>
                              <TableHead className="font-semibold text-slate-600 py-3 text-xs uppercase tracking-wider bg-slate-50/50">Cliente</TableHead>
                              <TableHead className="font-semibold text-slate-600 py-3 text-xs uppercase tracking-wider bg-slate-50/50"># Tilopay</TableHead>
                              <TableHead className="font-semibold text-slate-600 py-3 text-xs uppercase tracking-wider bg-slate-50/50">Monto</TableHead>
                              <TableHead className="font-semibold text-slate-600 py-3 text-xs uppercase tracking-wider bg-slate-50/50">Creado Por</TableHead>
                              <TableHead className="font-semibold text-slate-600 py-3 text-xs uppercase tracking-wider bg-slate-50/50">Estado</TableHead>
                              <TableHead className="text-right font-semibold text-slate-600 py-3 pr-4 text-xs uppercase tracking-wider bg-slate-50/50">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLinks.map((link) => (
                              <TableRow key={link.id} className="border-slate-100/50 hover:bg-slate-50/80 transition-colors group">
                                <TableCell className="whitespace-nowrap text-slate-600 text-xs pl-4 py-2.5">
                                  {link.createdAt ? new Date(link.createdAt.toMillis()).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                </TableCell>
                                <TableCell className="font-medium text-slate-900 py-2.5 max-w-[180px] truncate">
                                  <div className="truncate">{link.clientName}</div>
                                  {link.description && <div className="text-[10px] text-slate-500 font-normal mt-0.5 truncate">{link.description}</div>}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  {link.tilopayLinkId ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-mono font-semibold rounded-md border border-indigo-100">
                                      #{link.tilopayLinkId}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium text-slate-700 py-2.5 whitespace-nowrap text-sm">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: link.currency || 'CRC' }).format(link.amount)}
                                </TableCell>
                                <TableCell className="text-slate-600 text-xs py-2.5 max-w-[150px] truncate">
                                  {link.createdByName || 'Desconocido'}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <StatusBadge status={link.status} />
                                </TableCell>
                                <TableCell className="text-right pr-4 py-2.5">
                                  <div className="flex items-center justify-end gap-1 transition-opacity">
                                    {link.status === "pending" && (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Copiar link" onClick={() => handleCopy(link.url)}>
                                          <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50" title="Verificar estado" onClick={() => handleCheckStatus(link.id, link.tilopayOrderId)} disabled={consultingId === link.id}>
                                          <RefreshCw className={`w-4 h-4 ${consultingId === link.id ? 'animate-spin' : ''}`} />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" title="Cancelar link" onClick={() => handleCancel(link.id, link.tilopayOrderId)}>
                                          <XCircle className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                    {link.status !== "pending" && (
                                      <span className="text-xs text-slate-400 italic font-medium px-2">Finalizado</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Vista de tarjetas - solo en móvil */}
                      <div className="md:hidden flex flex-col divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                        {filteredLinks.map((link) => (
                          <div key={link.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{link.clientName}</p>
                                {link.description && <p className="text-xs text-slate-500 truncate mt-0.5">{link.description}</p>}
                              </div>
                              <StatusBadge status={link.status} />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-lg font-bold text-slate-800">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: link.currency || 'CRC' }).format(link.amount)}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {link.createdAt ? new Date(link.createdAt.toMillis()).toLocaleDateString('es-CR') : 'N/A'} · {link.createdByName || 'Desconocido'}
                                </p>
                              </div>
                              {link.status === "pending" && (
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-slate-700" onClick={() => handleCopy(link.url)}>
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-9 w-9 text-indigo-500 hover:text-indigo-700" onClick={() => handleCheckStatus(link.id, link.tilopayOrderId)} disabled={consultingId === link.id}>
                                    <RefreshCw className={`w-4 h-4 ${consultingId === link.id ? 'animate-spin' : ''}`} />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 hover:text-red-600" onClick={() => handleCancel(link.id, link.tilopayOrderId)}>
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </>
  );
}
