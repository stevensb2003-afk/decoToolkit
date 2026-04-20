import { NextResponse } from 'next/server';
import { getInvoices, getItems, getContacts } from '@/lib/alegra';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Extract remaining params
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        if (key !== 'type') params[key] = value;
    });

    try {
        let data;
        switch (type) {
            case 'invoices':
                data = await getInvoices(params);
                break;
            case 'items':
                data = await getItems(params);
                break;
            case 'contacts':
                data = await getContacts(params);
                break;
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Alegra API Proxy Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
