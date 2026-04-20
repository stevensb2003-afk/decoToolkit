import { NextResponse } from "next/server";
import { generatePaylink, checkTransactionStatus, cancelPaylink } from "@/lib/tilopay";
import { initializeFirebaseAdmin } from "@/firebase/server";
import { FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin
const { firestore } = initializeFirebaseAdmin();

// ─── POST: Crear link de pago ─────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 1. Llamar a Tilopay para generar el link
    const tilopayResponse = await generatePaylink(data);

    console.log("Tilopay createLinkPayment response:", JSON.stringify(tilopayResponse, null, 2));

    // La URL del link puede venir en distintos campos según la versión de la API
    const url = tilopayResponse.url || tilopayResponse.data?.url || tilopayResponse.payment_url || tilopayResponse.redirect || "";

    // El ID del link en Tilopay (int64 → convertir a string para búsquedas en Firestore)
    const tilopayLinkId = tilopayResponse.id?.toString() || "";

    // Nuestro orderNumber (ORDxxx) es el identificador principal para todo el flujo
    const orderId = data.order;

    if (!url) {
      console.error("Respuesta Tilopay sin URL:", JSON.stringify(tilopayResponse, null, 2));
      throw new Error("No se recibió una URL válida de pago desde Tilopay. Ver consola.");
    }

    // 2. Guardar en Firestore
    await firestore.collection("payment_links").add({
      tilopayOrderId: orderId,           // Nuestro ORDxxx (orderNumber enviado a Tilopay)
      tilopayLinkId: tilopayLinkId,      // ID del link en Tilopay (206038)
      tilopayTransactionId: "",          // Se llenará cuando el cliente complete el pago
      tilopayAuth: "",                   // Código de autorización bancaria
      url: url,
      amount: data.amount,
      currency: data.currency || "CRC",
      clientName: data.clientName || "",
      clientFirstName: data.firstName || "",
      clientLastName: data.lastName || "",
      clientEmail: data.clientEmail || "",
      clientPhone: data.clientPhone || "",
      description: data.description || "",
      status: "pending",
      createdBy: data.createdBy || "unknown",
      createdByName: data.createdByName || "Desconocido",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      rawTilopayResponse: tilopayResponse
    });

    return NextResponse.json({ url, orderId, status: "pending" });
  } catch (error: any) {
    console.error("Error POST /api/tilopay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── GET: Actualizar estado tras redirect o sincronización manual ──────────────
//
// MODO 1 — Callback automático (cliente regresa del pago):
//   Parámetros: orderId + code + auth + orderHash + tilopayTransaction
//   Tilopay ya nos dijo el estado via "code=1", no necesitamos consultarle de nuevo.
//   Solo buscamos el doc en Firestore y lo actualizamos con los datos recibidos.
//
// MODO 2 — Sincronización manual (admin fuerza la sincronización):
//   Parámetros: orderId (sin code)
//   Llamamos a Tilopay /api/v1/consult con el orderNumber para obtener el estado actual.
//
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parámetros del callback automático (vienen de Tilopay redirect)
    const orderId = searchParams.get("orderId");
    const docId = searchParams.get("docId");              // Firestore doc ID (lookup directo)
    const code = searchParams.get("code");               // "1" = aprobada
    const auth = searchParams.get("auth");               // Código de autorización
    const orderHash = searchParams.get("orderHash");     // Hash de seguridad
    const tilopayTransaction = searchParams.get("tilopayTransaction"); // ID de transacción Tilopay

    if (!orderId && !docId) {
      return NextResponse.json({ error: "Falta parámetro orderId o docId" }, { status: 400 });
    }

    // ─── Buscar el documento en Firestore ────────────────────────────────────
    let docRef: FirebaseFirestore.DocumentReference | null = null;
    let docData: any = null;

    // OPCIÓN A: lookup directo por docId (más eficiente, sin query)
    if (docId) {
      const snap = await firestore.collection("payment_links").doc(docId).get();
      if (snap.exists) {
        docRef = snap.ref;
        docData = snap.data();
      }
    }

    // OPCIÓN B: buscar por orderId (cascada de 3 campos)
    if (!docRef && orderId) {
      // Intento 1: por tilopayOrderId (nuestro ORDxxx)
      let snapshot = await firestore
        .collection("payment_links")
        .where("tilopayOrderId", "==", orderId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        docRef = snapshot.docs[0].ref;
        docData = snapshot.docs[0].data();
      }

      // Intento 2: por tilopayLinkId (ID numérico de Tilopay, ej. "206038")
      if (!docRef) {
        snapshot = await firestore
          .collection("payment_links")
          .where("tilopayLinkId", "==", orderId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          docRef = snapshot.docs[0].ref;
          docData = snapshot.docs[0].data();
        }
      }

      // Intento 3: por tilopayTransactionId (ID de transacción post-pago)
      if (!docRef) {
        snapshot = await firestore
          .collection("payment_links")
          .where("tilopayTransactionId", "==", orderId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          docRef = snapshot.docs[0].ref;
          docData = snapshot.docs[0].data();
        }
      }
    }

    if (!docRef || !docData) {
      return NextResponse.json(
        { error: `No se encontró ninguna orden con ID: ${orderId || docId}. Verifica que el ID sea correcto.` },
        { status: 404 }
      );
    }

    // ─── MODO 1: Callback automático (tenemos el code de Tilopay) ────────────
    if (code !== null && code !== undefined) {
      const isPaid = code === "1";
      const finalStatus = isPaid ? "paid" : "declined";

      // Solo actualizar si cambió el estado (evitar sobrescribir un "paid")
      if (docData.status !== "paid") {
        const updateData: any = {
          status: finalStatus,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (auth) updateData.tilopayAuth = auth;
        if (orderHash) updateData.tilopayOrderHash = orderHash;
        if (tilopayTransaction) updateData.tilopayTransactionId = tilopayTransaction;

        await docRef.update(updateData);

        console.log(`Callback: Orden ${orderId} actualizada a "${finalStatus}". Auth: ${auth}, TX: ${tilopayTransaction}`);
      } else {
        console.log(`Callback: Orden ${orderId} ya estaba como "paid", no se modifica.`);
      }

      return NextResponse.json({ status: finalStatus, source: "callback" });
    }

    // ─── MODO 2: Sincronización manual (consultamos a Tilopay) ───────────────
    // IMPORTANTE: Según la documentación de Tilopay, para consultar el estado de un
    // link de pago, se debe usar EXCLUSIVAMENTE el ID del link (tilopayLinkId).
    const linkId = docData.tilopayLinkId;

    let statusData: any = null;
    let finalStatus = "pending";
    let consultSucceeded = false;

    if (linkId) {
      try {
        console.log(`Sync manual: Intentando consult con linkId: ${linkId}`);
        const rawResult = await checkTransactionStatus(linkId);
        console.log("Tilopay consult response:", JSON.stringify(rawResult, null, 2));

        // Detectar respuesta vacía/no encontrada antes de procesar
        const isEmpty =
          rawResult?.message === "Does not exist" ||
          (Array.isArray(rawResult?.response) && rawResult.response.length === 0);

        if (!isEmpty) {
          // Extraer datos
          const record = Array.isArray(rawResult) ? rawResult[0] : (rawResult?.data?.[0] || rawResult?.response?.[0] || rawResult);

          // Creamos un string "searchable" con todos los valores de texto de la respuesta
          const allText = JSON.stringify(record).toUpperCase();

          const successKeywords = ["APPROVED", "PAID", "PAGADA", "PAGADO", "CAPTURED", "COMPLETADA", "APROBADA"];
          const declineKeywords = ["DECLINED", "DECLINADA", "REJECTED", "RECHAZADA", "FAILED"];

          const hasSuccessKeyword = successKeywords.some(key => allText.includes(key));
          const hasDeclineKeyword = declineKeywords.some(key => allText.includes(key));

          const isPaid = record.code === 1 || record.code === "1" || hasSuccessKeyword || record.paid === true || record.status === "paid" || record.status === 2;
          const isDeclined = !isPaid && (record.code === 3 || record.code === "3" || hasDeclineKeyword || record.status === 3);

          if (isPaid) finalStatus = "paid";
          else if (isDeclined) finalStatus = "declined";

          statusData = record;
          consultSucceeded = true;
        }
      } catch (consultError: any) {
        console.error(`Error consultando Tilopay con link ID ${linkId}:`, consultError.message);
      }
    }

    if (!consultSucceeded) {
      // Ningún intento funcionó — devolvemos estado cacheado de Firestore
      return NextResponse.json({
        status: docData.status || "pending",
        source: "firestore_cached",
        warning: "Tilopay no reconoció ninguno de los IDs disponibles. Verifica en el portal de Tilopay."
      });
    }

    // Actualizar Firestore si el estado cambió
    if (finalStatus !== "pending" && docData.status !== "paid") {
      const updateData: any = {
        status: finalStatus,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Capturar IDs transaccionales si Tilopay los provee en la consulta
      if (statusData?.auth) updateData.tilopayAuth = statusData.auth.toString();
      const txId = statusData?.transaction_id || statusData?.tilopayTransaction || statusData?.id_transaction;
      if (txId) updateData.tilopayTransactionId = txId.toString();

      await docRef.update(updateData);

      console.log(`Sync manual: Orden ${orderId} actualizada a "${finalStatus}". TX ID: ${txId || 'N/A'}`);
    }

    return NextResponse.json({
      status: finalStatus,
      source: "tilopay_consult",
      rawData: statusData
    });

  } catch (error: any) {
    console.error("Error GET /api/tilopay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Cancelar link de pago ───────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const docId = searchParams.get("docId");

    if (!orderId || !docId) {
      return NextResponse.json({ error: "Faltan parámetros (orderId, docId)" }, { status: 400 });
    }

    // 1. Verificar estado actual en Firestore
    const docRef = firestore.collection("payment_links").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "No se encontró el registro" }, { status: 404 });
    }

    const docData = docSnap.data();
    if (docData?.status === "paid") {
      return NextResponse.json({ 
        error: "No se puede eliminar una transacción que ya ha sido pagada." 
      }, { status: 400 });
    }

    // 2. Intentar cancelar en Tilopay (opcional: si falla Tilopay, igual marcamos como cancelado en Toolkit si el usuario lo desea, pero aquí lo hacemos secuencial)
    try {
      if (docData?.tilopayLinkId) {
        await cancelPaylink(docData.tilopayLinkId);
      } else {
        console.warn("No se encontró tilopayLinkId en el documento. No se pudo cancelar en Tilopay directamente.");
      }
    } catch (tilopayError) {
      console.warn("Error al cancelar en Tilopay (puede que el link ya no exista o ya esté inactivo):", tilopayError);
      // Continuamos para que al menos en el Toolkit quede como cancelado
    }

    // 3. Actualizar Firestore
    await docRef.update({
      status: "cancelled",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, status: "cancelled" });
  } catch (error: any) {
    console.error("Error DELETE /api/tilopay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
