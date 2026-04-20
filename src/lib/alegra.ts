/**
 * Alegra API Utility
 * Base URL: https://api.alegra.com/api/v1/
 * Auth: Basic (email:token base64)
 */

const BASE_URL = 'https://api.alegra.com/api/v1';

export interface AlegraInvoice {
    id: string;
    number: string;
    date: string;
    dueDate: string;
    status: string;
    total: number;
    totalPaid: number;
    client: {
        id: string;
        name: string;
        identification?: string;
    };
    payments?: Array<{
        date: string;
        amount: number;
        paymentMethod: string;
    }>;
}

export interface AlegraItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    reference?: string;
    status: string;
}

export interface AlegraContact {
    id: string;
    name: string;
    identification?: string;
    email?: string;
    phone?: string;
    type: string[];
}

export async function getAlegraData(endpoint: string, params: Record<string, string> = {}) {
    const email = process.env.ALEGRA_API_EMAIL;
    const token = process.env.ALEGRA_API_TOKEN;

    if (!email || !token) {
        throw new Error('Alegra credentials not found in environment variables');
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
        },
        next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alegra API error: ${response.status} ${errorText}`);
    }

    return response.json();
}

export async function getInvoices(params: Record<string, string> = {}): Promise<AlegraInvoice[]> {
    return getAlegraData('invoices', params);
}

export async function getItems(params: Record<string, string> = {}): Promise<AlegraItem[]> {
    return getAlegraData('items', params);
}

export async function getContacts(params: Record<string, string> = {}): Promise<AlegraContact[]> {
    return getAlegraData('contacts', params);
}
