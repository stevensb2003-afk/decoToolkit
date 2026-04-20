"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, ArrowRight, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

function TilopayCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    // ─── Parámetros que Tilopay adjunta en la URL de redirect (método GET) ───
    // code: "1" = aprobada, otro valor = rechazada
    // order: el orderNumber que nosotros enviamos al crear el link
    // auth: código de autorización bancaria
    // OrderHash: hash de seguridad
    // returnData: nuestra metadata en base64 devuelta intacta
    // tilopay-transaction: ID de transacción de Tilopay

    const code = searchParams.get("code");
    const tilopayOrder = searchParams.get("order");           // Nuestro orderNumber devuelto por Tilopay
    const auth = searchParams.get("auth");
    const orderHash = searchParams.get("OrderHash");
    const returnDataB64 = searchParams.get("returnData");
    const tilopayTransaction = searchParams.get("tilopay-transaction");
    const localRef = searchParams.get("localRef");            // Nuestro fallback en la URL base

    // Decodificar returnData para recuperar el orderId con certeza
    let orderId: string | null = tilopayOrder || localRef;
    let decodedMeta: any = null;

    if (returnDataB64) {
      try {
        // Convertir de base64 URL-safe (- y _) de vuelta a base64 estándar (+ y /)
        // y restaurar el padding con = que fue eliminado al codificar
        const standardB64 = returnDataB64
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(returnDataB64.length + (4 - returnDataB64.length % 4) % 4, '=');
        decodedMeta = JSON.parse(atob(standardB64));
        // returnData es nuestra fuente más confiable del orderId
        if (decodedMeta?.orderId) {
          orderId = decodedMeta.orderId;
        }
      } catch (e) {
        console.warn("No se pudo decodificar returnData:", e);
      }
    }

    if (!orderId) {
      setStatus("error");
      setOrderDetails({ message: "No se encontró información de la orden. Contacta a soporte." });
      return;
    }

    const isPaid = code === "1";

    // ─── Llamar al backend para actualizar Firestore ───
    // Pasamos TODOS los datos que recibimos de Tilopay para que el backend
    // pueda actualizar el documento correctamente sin llamar a Tilopay de nuevo.
    const queryParams = new URLSearchParams();
    queryParams.append("orderId", orderId);
    queryParams.append("code", code || "");
    if (auth) queryParams.append("auth", auth);
    if (orderHash) queryParams.append("orderHash", orderHash);
    if (tilopayTransaction) queryParams.append("tilopayTransaction", tilopayTransaction);

    fetch(`/api/tilopay?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        console.log("Sync con backend completado:", data);
      })
      .catch(err => {
        console.error("Error en sync con backend:", err);
      });

    // ─── Actualizar UI de forma inmediata (optimista) ───
    if (isPaid) {
      setStatus("success");
      setOrderDetails({
        orderId,
        auth: auth || "N/A",
        tilopayTransaction: tilopayTransaction || null,
        description: decodedMeta?.description || null,
        clientName: decodedMeta?.clientName || null,
      });
    } else {
      setStatus("error");
      setOrderDetails({
        orderId,
        message: searchParams.get("description") || "La transacción fue declinada o hubo un error en el pago.",
      });
    }

  }, [searchParams]);

  return (
    <>
      <Header />
      <main className="flex-1 min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">

        {status === "loading" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-indigo-600 gap-4"
          >
            <Loader2 className="w-16 h-16 animate-spin" />
            <p className="text-lg font-medium text-slate-600">Verificando transacción...</p>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              <CardHeader className="text-center pt-8 pb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mx-auto bg-emerald-100 p-3 rounded-full w-20 h-20 flex items-center justify-center mb-4"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </motion.div>
                <CardTitle className="text-2xl font-bold text-slate-900">¡Pago Exitoso!</CardTitle>
                <CardDescription className="text-base">
                  {orderDetails?.clientName
                    ? `Gracias ${orderDetails.clientName}, tu pago fue procesado correctamente.`
                    : "Tu transacción ha sido procesada correctamente."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Orden</span>
                    <span className="font-semibold text-slate-900">{orderDetails?.orderId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Autorización</span>
                    <span className="font-semibold text-slate-900">{orderDetails?.auth}</span>
                  </div>
                  {orderDetails?.tilopayTransaction && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Transacción</span>
                      <span className="font-semibold text-slate-900">{orderDetails.tilopayTransaction}</span>
                    </div>
                  )}
                  {orderDetails?.description && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Concepto</span>
                      <span className="font-semibold text-slate-900 text-right max-w-[60%] truncate">{orderDetails.description}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => router.push("/")}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg transition-all"
                >
                  Volver al inicio <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
              <CardHeader className="text-center pt-8 pb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mx-auto bg-red-100 p-3 rounded-full w-20 h-20 flex items-center justify-center mb-4"
                >
                  <XCircle className="w-10 h-10 text-red-600" />
                </motion.div>
                <CardTitle className="text-2xl font-bold text-slate-900">Pago Declinado</CardTitle>
                <CardDescription className="text-base text-red-600">
                  {orderDetails?.message || "No pudimos procesar tu pago."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderDetails?.orderId && (
                  <div className="bg-slate-50 p-4 rounded-xl flex justify-between text-sm border border-slate-100">
                    <span className="text-slate-500">Orden</span>
                    <span className="font-semibold text-slate-900">{orderDetails.orderId}</span>
                  </div>
                )}
                <p className="text-sm text-center text-slate-500">
                  Por favor intenta con otro método de pago o contacta a tu banco.
                </p>
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push("/")}
                  className="w-full"
                >
                  Volver al inicio
                </Button>
                <Button
                  onClick={() => router.back()}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Reintentar
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

      </main>
    </>
  );
}

export default function TilopayCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="w-12 h-12 text-slate-400 animate-spin" />
      </div>
    }>
      <TilopayCallbackContent />
    </Suspense>
  );
}
