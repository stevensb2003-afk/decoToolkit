'use server';

import { getInvoices, AlegraInvoice } from './alegra';
import { recordCashTransaction, getOpenCashSession } from './cash-control';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { initializeFirebaseClient } from '@/firebase';

const { firestore: db } = initializeFirebaseClient();

export async function syncInvoiceToCash(invoiceId: string, branchId: string, cajaId: string, userId: string, userName: string) {
    try {
        // 1. Fetch invoice details to verify
        const invoices = await getInvoices({ id: invoiceId });
        const invoice = invoices.find(inv => inv.id === invoiceId);

        if (!invoice) throw new Error('Invoice not found in Alegra');

        // 2. Check if already synced
        const q = query(
            collection(db, 'cashTransactions'),
            where('description', '>=', `Alegra Sync ID: ${invoiceId}`),
            where('description', '<=', `Alegra Sync ID: ${invoiceId}\uf8ff`)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
            throw new Error('This invoice has already been synchronized.');
        }

        // 3. Find active session (optional, recordCashTransaction handles pending if sessionId is null)
        const session = await getOpenCashSession(cajaId);

        // 4. Record transaction
        const description = `Alegra Sync ID: ${invoiceId} | Factura: ${invoice.number} | Cliente: ${invoice.client.name}`;

        await recordCashTransaction(
            branchId,
            cajaId,
            userId,
            userName,
            session ? session.id : null,
            'income',
            invoice.total,
            'venta',
            description,
            'alegra_api'
        );

        return { success: true, message: `Factura ${invoice.number} sincronizada correctamente.` };
    } catch (error: any) {
        console.error('Sync Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getAlegraSummary() {
    try {
        const invoices = await getInvoices({ status: 'open', limit: '50' });
        const cashInvoices = invoices.filter(inv => inv.totalPaid > 0); // Simplified filter

        return {
            totalCount: invoices.length,
            cashCount: cashInvoices.length,
            cashTotal: cashInvoices.reduce((sum, inv) => sum + inv.total, 0)
        };
    } catch (error) {
        return null;
    }
}
