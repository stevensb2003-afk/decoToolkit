interface TilopayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Variable en memoria para cachear el token
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export const getTilopayToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedToken;
  }

  const url = `${process.env.TILOPAY_BASE_URL}/api/v1/login`;

  const payload = {
    apiuser: process.env.TILOPAY_API_USER,
    password: process.env.TILOPAY_API_PASSWORD
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error obteniendo token Tilopay:", errorText, "URL:", url);
    throw new Error("Fallo en la autenticación con Tilopay.");
  }

  const data = await response.json();

  if (data.access_token) {
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    return cachedToken as string;
  } else if (data.token) {
    cachedToken = data.token;
    tokenExpiresAt = Date.now() + (3600 * 1000);
    return cachedToken as string;
  }

  throw new Error("Respuesta de login inesperada de Tilopay");
};

export interface PaylinkRequest {
  amount: number;
  currency: string;
  order: string;           // Nuestro orderNumber (ORDxxx) — identificador principal
  description: string;     // Descripción interna, va en returnData (no en concepto Tilopay)
  clientName: string;
  firstName?: string;
  lastName?: string;
  clientEmail?: string;
  clientPhone?: string;    // Teléfono del cliente para pre-llenar billing
  redirectUrl?: string;
  appUrl?: string; // Para enviar el webhook correcto dinámicamente
}

export const generatePaylink = async (data: PaylinkRequest) => {
  const url = `${process.env.TILOPAY_BASE_URL}/api/v1/createLinkPayment`;
  const token = await getTilopayToken();
  const baseUrl = data.appUrl || process.env.NEXT_PUBLIC_APP_URL;
  const payload = {
    key: process.env.TILOPAY_API_KEY,
    amount: data.amount.toFixed(2),
    currency: data.currency || "CRC",
    reference: data.order,
    type: 1,       // 1 = Link de un solo uso
    description: data.description || "Pago de Servicios",
    client: data.clientName,
    webhook_url: `${baseUrl}/api/tilopay/webhook`
  };

  console.log("Tilopay generatePaylink payload:", JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Tilopay generatePaylink error:", errorText, "URL:", url);
    throw new Error(`Error generando link de pago en Tilopay: ${response.statusText}`);
  }

  return response.json();
};

export const checkTransactionStatus = async (linkId: string) => {
  const url = `${process.env.TILOPAY_BASE_URL}/api/v1/getDetailLinkPayment/${linkId}/${process.env.TILOPAY_API_KEY}`;
  const token = await getTilopayToken();

  console.log("Tilopay getDetailLinkPayment URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Tilopay checkTransactionStatus error:", errorText, "URL:", url);
    throw new Error(`Error consultando estado en Tilopay: ${response.statusText}`);
  }

  const result = await response.json();
  console.log("Tilopay checkTransactionStatus response:", JSON.stringify(result, null, 2));
  return result;
};

export const cancelPaylink = async (linkId: string) => {
  const url = `${process.env.TILOPAY_BASE_URL}/api/v1/deleteLinkPayment`;
  const token = await getTilopayToken();

  const payload = {
    key: process.env.TILOPAY_API_KEY,
    id: linkId
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Tilopay cancelPaylink error:", errorText, "URL:", url);
    throw new Error(`Error cancelando link de pago en Tilopay: ${response.statusText}`);
  }

  return response.json();
};
