import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/firebase/server";
import { FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin
const { firestore } = initializeFirebaseAdmin();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log("Webhook recibido de Tilopay:", JSON.stringify(data, null, 2));

    const code = data.code?.toString();
    const tilopayLinkId = data.tilopayLinkId?.toString();
    const auth = data.auth;

    if (!tilopayLinkId) {
      console.error("Webhook error: No se recibió tilopayLinkId", data);
      return NextResponse.json({ error: "Missing tilopayLinkId" }, { status: 400 });
    }

    if (code === "1") {
      console.log(`Procesando pago exitoso para tilopayLinkId: ${tilopayLinkId}`);
      
      const paymentsRef = firestore.collection("payment_links");
      const q = paymentsRef.where("tilopayLinkId", "==", tilopayLinkId);
      const snapshot = await q.get();

      if (snapshot.empty) {
        console.error(`Webhook error: No se encontró el documento de pago con tilopayLinkId: ${tilopayLinkId}`);
        return NextResponse.json({ error: "Payment link not found in database" }, { status: 404 });
      }

      const doc = snapshot.docs[0];
      const docData = doc.data();

      // Only update if it's not already paid
      if (docData.status !== "paid") {
        await doc.ref.update({
          status: "paid",
          auth: auth || "",
          updatedAt: FieldValue.serverTimestamp(),
          paymentMethod: "Tilopay" // or data.creditCardBrand + " " + data.last4CreditCardNumber
        });
        
        console.log(`Pago ${tilopayLinkId} actualizado a "paid" exitosamente vía Webhook.`);
      } else {
        console.log(`El pago con tilopayLinkId ${tilopayLinkId} ya estaba marcado como "paid".`);
      }

      return NextResponse.json({ message: "Webhook processed successfully" }, { status: 200 });
    } else {
      console.log(`Webhook recibido pero el código no es 1 (pago no completado o fallido). Code: ${code}`);
      return NextResponse.json({ message: "Webhook received, ignored due to code != 1" }, { status: 200 });
    }

  } catch (error: any) {
    console.error("Error procesando Webhook:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
