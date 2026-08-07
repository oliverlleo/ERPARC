import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    writeBatch,
    serverTimestamp,
    documentId
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const LEDGER_COLLECTION = 'movimentacoesFinanceiras';
const MIGRATION_COLLECTION = '_meta';
const MIGRATION_DOCUMENT = 'financialLedgerV1';
const migrationPromises = new Map();

export function financialMovementDocId(type, parentId, originId) {
    const prefix = type === 'pagamento' ? 'pagamento' : 'recebimento';
    return `${prefix}_${parentId}_${originId}`;
}

function movementOriginKey(type, parentId, originId) {
    if (!type || !parentId || !originId) return null;
    return `${type}:${parentId}:${originId}`;
}

async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            results[index] = await worker(items[index], index);
        }
    }

    const workers = Array.from(
        { length: Math.min(concurrency, Math.max(items.length, 1)) },
        () => runWorker()
    );
    await Promise.all(workers);
    return results;
}

function normalizeLegacyPayment(parentDoc, transactionDoc, bankMovement) {
    const data = transactionDoc.data();
    return {
        tipo: 'pagamento',
        origemTipo: 'PAGAMENTO_DESPESA',
        origemParentId: parentDoc.id,
        origemId: transactionDoc.id,
        dataTransacao: data.dataTransacao || null,
        valorPrincipal: data.valorPrincipal || 0,
        juros: data.jurosPagos || 0,
        desconto: data.descontosAplicados || 0,
        contaBancariaId: data.contaSaidaId || bankMovement?.contaBancariaId || null,
        conciliado: bankMovement?.conciliado ?? data.conciliado ?? false,
        dataConciliacao: bankMovement?.dataConciliacao || null,
        usuarioConciliacao: bankMovement?.usuarioConciliacao || null,
        estornado: false,
        migratedFromLegacy: true,
        sourceCreatedAt: data.createdAt || null
    };
}

function normalizeLegacyReceipt(parentDoc, transactionDoc, bankMovement) {
    const data = transactionDoc.data();
    return {
        tipo: 'recebimento',
        origemTipo: 'RECEBIMENTO_RECEITA',
        origemParentId: parentDoc.id,
        origemId: transactionDoc.id,
        dataTransacao: data.dataTransacao || null,
        valorPrincipal: data.valorPrincipal || 0,
        juros: data.jurosRecebidos || 0,
        desconto: data.descontosConcedidos || 0,
        contaBancariaId: data.contaEntradaId || bankMovement?.contaBancariaId || null,
        conciliado: bankMovement?.conciliado ?? data.conciliado ?? false,
        dataConciliacao: bankMovement?.dataConciliacao || null,
        usuarioConciliacao: bankMovement?.usuarioConciliacao || null,
        estornado: false,
        migratedFromLegacy: true,
        sourceCreatedAt: data.createdAt || null
    };
}

/**
 * Creates the consolidated financial ledger once for pre-ledger data.
 *
 * The legacy N+1 reads happen only during this idempotent migration. A marker is
 * written only after every deterministic ledger document is committed, so a
 * failed/interrupted migration can be retried safely without creating duplicates.
 */
export async function ensureFinancialLedger(db, userId) {
    if (!db || !userId) return;
    if (migrationPromises.has(userId)) return migrationPromises.get(userId);

    const migrationPromise = (async () => {
        const markerRef = doc(db, 'users', userId, MIGRATION_COLLECTION, MIGRATION_DOCUMENT);
        const markerSnap = await getDoc(markerRef);
        if (markerSnap.exists() && markerSnap.data().completed === true) return;

        const despesasRef = collection(db, 'users', userId, 'despesas');
        const receitasRef = collection(db, 'users', userId, 'receitas');
        const bankMovementsRef = collection(db, 'users', userId, 'movimentacoesBancarias');

        const [despesasSnap, receitasSnap, bankMovementsSnap] = await Promise.all([
            getDocs(despesasRef),
            getDocs(receitasRef),
            getDocs(bankMovementsRef)
        ]);

        const bankMovementsByOrigin = new Map();
        bankMovementsSnap.forEach(bankDoc => {
            const data = bankDoc.data();
            if (data.estornado === true) return;

            let type = null;
            if (data.origemTipo === 'PAGAMENTO_DESPESA') type = 'pagamento';
            if (data.origemTipo === 'RECEBIMENTO_RECEITA') type = 'recebimento';

            const key = movementOriginKey(type, data.origemParentId, data.origemId);
            if (key) bankMovementsByOrigin.set(key, data);
        });

        const records = [];

        const paymentGroups = await mapWithConcurrency(despesasSnap.docs, 12, async parentDoc => {
            const snapshot = await getDocs(collection(parentDoc.ref, 'pagamentos'));
            const group = [];
            snapshot.forEach(transactionDoc => {
                const data = transactionDoc.data();
                if (data.estornado === true || data.tipoTransacao === 'Estorno' || data.tipoTransacao !== 'Pagamento') return;
                const key = movementOriginKey('pagamento', parentDoc.id, transactionDoc.id);
                group.push({
                    id: financialMovementDocId('pagamento', parentDoc.id, transactionDoc.id),
                    data: normalizeLegacyPayment(parentDoc, transactionDoc, bankMovementsByOrigin.get(key))
                });
            });
            return group;
        });

        const receiptGroups = await mapWithConcurrency(receitasSnap.docs, 12, async parentDoc => {
            const snapshot = await getDocs(collection(parentDoc.ref, 'recebimentos'));
            const group = [];
            snapshot.forEach(transactionDoc => {
                const data = transactionDoc.data();
                if (data.estornado === true || data.tipoTransacao === 'Estorno' || data.tipoTransacao !== 'Recebimento') return;
                const key = movementOriginKey('recebimento', parentDoc.id, transactionDoc.id);
                group.push({
                    id: financialMovementDocId('recebimento', parentDoc.id, transactionDoc.id),
                    data: normalizeLegacyReceipt(parentDoc, transactionDoc, bankMovementsByOrigin.get(key))
                });
            });
            return group;
        });

        paymentGroups.forEach(group => records.push(...group));
        receiptGroups.forEach(group => records.push(...group));

        const ledgerRef = collection(db, 'users', userId, LEDGER_COLLECTION);
        const batchSize = 400;
        for (let offset = 0; offset < records.length; offset += batchSize) {
            const batch = writeBatch(db);
            records.slice(offset, offset + batchSize).forEach(record => {
                batch.set(doc(ledgerRef, record.id), {
                    ...record.data,
                    migratedAt: serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
        }

        const markerBatch = writeBatch(db);
        markerBatch.set(markerRef, {
            completed: true,
            version: 1,
            migratedRecords: records.length,
            completedAt: serverTimestamp()
        }, { merge: true });
        await markerBatch.commit();
    })().catch(error => {
        migrationPromises.delete(userId);
        throw error;
    });

    migrationPromises.set(userId, migrationPromise);
    return migrationPromise;
}

export async function fetchFinancialLedger(db, userId, options = {}) {
    const {
        startDate = null,
        endDate = null,
        inclusive = true,
        types = null
    } = options;

    await ensureFinancialLedger(db, userId);

    const constraints = [];
    if (startDate) {
        constraints.push(where('dataTransacao', inclusive ? '>=' : '<', startDate));
    }
    if (endDate) {
        constraints.push(where('dataTransacao', inclusive ? '<=' : '<', endDate));
    }

    const ledgerRef = collection(db, 'users', userId, LEDGER_COLLECTION);
    const ledgerQuery = constraints.length > 0 ? query(ledgerRef, ...constraints) : query(ledgerRef);
    const snapshot = await getDocs(ledgerQuery);
    const allowedTypes = Array.isArray(types) && types.length > 0 ? new Set(types) : null;

    return snapshot.docs
        .map(snapshotDoc => ({ id: snapshotDoc.id, ...snapshotDoc.data() }))
        .filter(movement => movement.estornado !== true)
        .filter(movement => !allowedTypes || allowedTypes.has(movement.tipo));
}

export async function fetchDocumentsByIds(db, userId, collectionName, ids) {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    const documents = new Map();
    if (uniqueIds.length === 0) return documents;

    const collectionRef = collection(db, 'users', userId, collectionName);
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += 30) {
        chunks.push(uniqueIds.slice(i, i + 30));
    }

    const snapshots = await mapWithConcurrency(chunks, 6, chunk =>
        getDocs(query(collectionRef, where(documentId(), 'in', chunk)))
    );

    snapshots.forEach(snapshot => {
        snapshot.forEach(snapshotDoc => documents.set(snapshotDoc.id, snapshotDoc));
    });

    return documents;
}
