import { collection, doc, setDoc, updateDoc, getDocs, query, where, orderBy, Timestamp, getDoc, limit, deleteDoc } from 'firebase/firestore';
import { initializeFirebaseClient } from '@/firebase';

const { firestore: db } = initializeFirebaseClient();
import { CashSession, CashTransaction, CashTransactionCategory, Branch, CashRegister } from './types';

export const BRANCHES_COLLECTION = 'branches';
export const CASH_REGISTERS_COLLECTION = 'cashRegisters';
export const CASH_SESSIONS_COLLECTION = 'cashSessions';
export const CASH_TRANSACTIONS_COLLECTION = 'cashTransactions';

export async function getBranches(): Promise<Branch[]> {
    const q = query(collection(db, BRANCHES_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Branch);
}

export async function getBranchRegisters(branchId: string): Promise<CashRegister[]> {
    const q = query(
        collection(db, CASH_REGISTERS_COLLECTION),
        where('branchId', '==', branchId)
    );
    const snapshot = await getDocs(q);
    const registers = snapshot.docs.map(doc => doc.data() as CashRegister);
    // Sort client-side to avoid composite index requirement
    return registers.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRegisters(): Promise<CashRegister[]> {
    const q = query(collection(db, CASH_REGISTERS_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as CashRegister);
}

export async function createBranch(name: string, isAdmin: boolean): Promise<string> {
    if (!isAdmin) throw new Error("Solo administradores pueden crear sucursales");
    const id = crypto.randomUUID();
    await setDoc(doc(db, BRANCHES_COLLECTION, id), {
        id,
        name,
        assignedAdmins: []
    });
    return id;
}

export async function createCaja(branchId: string, name: string, isAdmin: boolean, initialBalance?: number): Promise<string> {
    if (!isAdmin) throw new Error("Solo administradores pueden crear cajas");
    const id = crypto.randomUUID();
    await setDoc(doc(db, CASH_REGISTERS_COLLECTION, id), {
        id,
        branchId,
        name,
        assignedAdmins: [],
        initialBalance: initialBalance || 0,
        createdAt: new Date()
    });
    return id;
}

export async function updateBranch(branchId: string, name: string, assignedAdmins: string[], isAdmin: boolean): Promise<void> {
    if (!isAdmin) throw new Error("Solo administradores pueden editar sucursales");
    const docRef = doc(db, BRANCHES_COLLECTION, branchId);
    await updateDoc(docRef, { name, assignedAdmins });
}

export async function deleteBranch(branchId: string, isAdmin: boolean): Promise<void> {
    if (!isAdmin) throw new Error("Solo administradores pueden eliminar sucursales");

    // Check if it has registers
    const registers = await getBranchRegisters(branchId);
    if (registers.length > 0) {
        throw new Error("No se puede eliminar una sucursal que tiene cajas activas. Elimina las cajas primero.");
    }

    await deleteDoc(doc(db, BRANCHES_COLLECTION, branchId));
}

export async function updateCaja(cajaId: string, name: string, assignedAdmins: string[], isAdmin: boolean, branchId?: string, initialBalance?: number): Promise<void> {
    if (!isAdmin) throw new Error("Solo administradores pueden editar cajas");
    const docRef = doc(db, CASH_REGISTERS_COLLECTION, cajaId);
    const updates: any = { name, assignedAdmins };
    if (branchId) updates.branchId = branchId;
    if (initialBalance !== undefined) updates.initialBalance = initialBalance;
    await updateDoc(docRef, updates);
}

export async function deleteCaja(cajaId: string, isAdmin: boolean): Promise<void> {
    if (!isAdmin) throw new Error("Solo administradores pueden eliminar cajas");

    // Check if it has sessions
    const q = query(collection(db, CASH_SESSIONS_COLLECTION), where('cajaId', '==', cajaId), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        throw new Error("No se puede eliminar una caja que tiene historial de sesiones. Considera renombrarla.");
    }

    const docRef = doc(db, CASH_REGISTERS_COLLECTION, cajaId);
    await deleteDoc(docRef);
}

export async function openCashSession(
    branchId: string,
    cajaId: string,
    cajaName: string,
    userId: string,
    userName: string,
    openingBalance: number
): Promise<string> {
    const sessionId = crypto.randomUUID();
    const sessionRef = doc(db, CASH_SESSIONS_COLLECTION, sessionId);

    const newSession: CashSession = {
        id: sessionId,
        branchId,
        cajaId,
        cajaName,
        userId,
        userName,
        openedAt: Timestamp.now(),
        closedAt: null,
        openingBalance,
        closingBalance: null,
        status: 'open'
    };

    await setDoc(sessionRef, newSession);
    return sessionId;
}

export async function closeCashSession(
    sessionId: string,
    closingBalance: number,
    details: { base: number, physical: number, bank: number },
    closer?: { userId: string, userName: string }
): Promise<void> {
    const sessionRef = doc(db, CASH_SESSIONS_COLLECTION, sessionId);
    await updateDoc(sessionRef, {
        closedAt: Timestamp.now(),
        closingBalance,
        closingBase: details.base,
        closingTotalPhysical: details.physical,
        closingBankDeposit: details.bank,
        closedByUserId: closer?.userId || null,
        closedByUserName: closer?.userName || null,
        status: 'closed'
    });
}

export async function recordCashTransaction(
    branchId: string,
    cajaId: string,
    userId: string,
    userName: string,
    sessionId: string | null,
    type: 'income' | 'expense',
    amount: number,
    category: CashTransactionCategory,
    description: string,
    source: 'manual' | 'alegra_api' = 'manual'
): Promise<string> {
    const transactionId = crypto.randomUUID();
    const transactionRef = doc(db, CASH_TRANSACTIONS_COLLECTION, transactionId);

    const newTransaction: CashTransaction = {
        id: transactionId,
        branchId,
        cajaId,
        sessionId,
        userId,
        userName,
        type,
        amount,
        category,
        description,
        createdAt: Timestamp.now(),
        source,
        status: sessionId ? 'applied' : 'pending'
    };

    await setDoc(transactionRef, newTransaction);
    return transactionId;
}

export async function getOpenCashSession(cajaId: string): Promise<CashSession | null> {
    const q = query(
        collection(db, CASH_SESSIONS_COLLECTION),
        where('cajaId', '==', cajaId),
        where('status', '==', 'open')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    // Return the first open session found (there should only be one per caja)
    return snapshot.docs[0].data() as CashSession;
}

export async function getPendingTransactions(cajaId: string): Promise<CashTransaction[]> {
    const q = query(
        collection(db, CASH_TRANSACTIONS_COLLECTION),
        where('cajaId', '==', cajaId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as CashTransaction);
}

export async function getSessionTransactions(sessionId: string): Promise<CashTransaction[]> {
    const q = query(
        collection(db, CASH_TRANSACTIONS_COLLECTION),
        where('sessionId', '==', sessionId),
        orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as CashTransaction);
}

export async function getRecentSessions(cajaId: string, limitCount: number = 30): Promise<CashSession[]> {
    const q = query(
        collection(db, CASH_SESSIONS_COLLECTION),
        where('cajaId', '==', cajaId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as CashSession)
        .filter(session => session.status === 'closed')
        .sort((a, b) => {
            const timeA = (a.closedAt as any)?.toMillis?.() || (a.closedAt as Date)?.getTime?.() || 0;
            const timeB = (b.closedAt as any)?.toMillis?.() || (b.closedAt as Date)?.getTime?.() || 0;
            return timeB - timeA;
        })
        .slice(0, limitCount);
}

export async function getGlobalRecentSessions(days: number = 30): Promise<CashSession[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

    const q = query(
        collection(db, CASH_SESSIONS_COLLECTION),
        where('closedAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
        orderBy('closedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    // Filtrar manualmente por estado 'closed' para evitar requerir un índice compuesto
    return snapshot.docs
        .map(doc => doc.data() as CashSession)
        .filter(session => session.status === 'closed');
}

export async function getLastSession(cajaId: string): Promise<CashSession | null> {
    const q = query(
        collection(db, CASH_SESSIONS_COLLECTION),
        where('cajaId', '==', cajaId),
        where('status', '==', 'closed'),
        orderBy('closedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as CashSession;
}

export async function applyPendingTransactionsToSession(sessionId: string, transactionIds: string[]): Promise<void> {
    for (const txId of transactionIds) {
        const txRef = doc(db, CASH_TRANSACTIONS_COLLECTION, txId);
        await updateDoc(txRef, {
            sessionId: sessionId,
            status: 'applied',
            createdAt: Timestamp.now()
        });
    }
}

export async function getPlatformAdmins(): Promise<{ id: string, email: string, displayName: string }[]> {
    const q = query(collection(db, 'users'), where('isAdmin', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email,
        displayName: doc.data().displayName || doc.data().email
    }));
}

export async function getTransactionsByDateRange(
    branchId: string,
    cajaId: string,
    startDate: Date,
    endDate: Date
): Promise<CashTransaction[]> {
    const q = query(
        collection(db, CASH_TRANSACTIONS_COLLECTION),
        where('cajaId', '==', cajaId),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => doc.data() as CashTransaction);

    // Sort descending (newest first) client-side to avoid strict composite index requirements
    return transactions.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis?.() || (a.createdAt as Date)?.getTime?.() || 0;
        const timeB = (b.createdAt as any)?.toMillis?.() || (b.createdAt as Date)?.getTime?.() || 0;
        return timeB - timeA;
    });
}
