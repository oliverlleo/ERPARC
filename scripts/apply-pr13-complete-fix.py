from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{label}: end marker not found")
    return text[:start] + replacement + text[end:]


# -----------------------------------------------------------------------------
# index.html
# -----------------------------------------------------------------------------
path = Path("index.html")
text = path.read_text(encoding="utf-8")

text = replace_once(
    text,
    "    import { initializeRelatorios } from './relatorios.js';",
    "    import { initializeRelatorios } from './relatorios.js';\n"
    "    import { ensureFinancialLedger, fetchFinancialLedger, financialMovementDocId } from './financial-ledger.js';",
    "index ledger import",
)

text = replace_once(
    text,
    "const usuariosQueryForDropdown = query(collection(db, 'users', userId, 'usuarios'));",
    "const usuariosQueryForDropdown = query(collection(db, 'users', userId, 'systemUsers'));",
    "canonical systemUsers dropdown",
)

# Normal payment: persist the consolidated ledger in the same Firestore transaction.
payment_anchor = "                // 1. Create the new payment document"
payment_end = "\n\n                // 2. Update the main expense document"
payment_start = text.find(payment_anchor)
payment_end_pos = text.find(payment_end, payment_start)
if payment_start < 0 or payment_end_pos < 0:
    raise RuntimeError("normal payment transaction block not found")
payment_ledger = r'''

                const pagamentoLedgerRef = doc(
                    db,
                    'users',
                    userId,
                    'movimentacoesFinanceiras',
                    financialMovementDocId('pagamento', despesaId, novoPagamentoRef.id)
                );
                transaction.set(pagamentoLedgerRef, {
                    tipo: 'pagamento',
                    origemTipo: 'PAGAMENTO_DESPESA',
                    origemParentId: despesaId,
                    origemId: novoPagamentoRef.id,
                    dataTransacao,
                    valorPrincipal: valorPrincipalCents,
                    juros: jurosCents,
                    desconto: descontosCents,
                    contaBancariaId: contaSaidaId,
                    conciliado: false,
                    dataConciliacao: null,
                    usuarioConciliacao: null,
                    estornado: false,
                    migratedFromLegacy: false,
                    createdAt: serverTimestamp()
                });'''
text = text[:payment_end_pos] + payment_ledger + text[payment_end_pos:]

# Normal receipt.
receipt_anchor = "                    transaction.set(novoRecebimentoRef, {"
receipt_start = text.find(receipt_anchor)
receipt_end_marker = "\n\n                    const updateData = {"
receipt_end = text.find(receipt_end_marker, receipt_start)
if receipt_start < 0 or receipt_end < 0:
    raise RuntimeError("normal receipt transaction block not found")
receipt_ledger = r'''

                    const recebimentoLedgerRef = doc(
                        db,
                        'users',
                        userId,
                        'movimentacoesFinanceiras',
                        financialMovementDocId('recebimento', receitaId, novoRecebimentoRef.id)
                    );
                    transaction.set(recebimentoLedgerRef, {
                        tipo: 'recebimento',
                        origemTipo: 'RECEBIMENTO_RECEITA',
                        origemParentId: receitaId,
                        origemId: novoRecebimentoRef.id,
                        dataTransacao,
                        valorPrincipal: valorPrincipalCents,
                        juros: jurosCents,
                        desconto: descontosCents,
                        contaBancariaId: contaEntradaId,
                        conciliado: false,
                        dataConciliacao: null,
                        usuarioConciliacao: null,
                        estornado: false,
                        migratedFromLegacy: false,
                        createdAt: serverTimestamp()
                    });'''
text = text[:receipt_end] + receipt_ledger + text[receipt_end:]

# Initial receipt created together with a newly-created receivable.
initial_anchor = "                            const recebimentoRef = doc(collection(newDocRef, 'recebimentos'));"
initial_start = text.find(initial_anchor)
initial_block_end = text.find("\n                            });", initial_start)
if initial_start < 0 or initial_block_end < 0:
    raise RuntimeError("initial receipt transaction block not found")
initial_block_end += len("\n                            });")
initial_ledger = r'''

                            const initialReceiptLedgerRef = doc(
                                db,
                                'users',
                                userId,
                                'movimentacoesFinanceiras',
                                financialMovementDocId('recebimento', newDocRef.id, recebimentoRef.id)
                            );
                            transaction.set(initialReceiptLedgerRef, {
                                tipo: 'recebimento',
                                origemTipo: 'RECEBIMENTO_RECEITA',
                                origemParentId: newDocRef.id,
                                origemId: recebimentoRef.id,
                                dataTransacao: document.getElementById('recebimento-data').value,
                                valorPrincipal: valorRecebidoCents,
                                juros: 0,
                                desconto: 0,
                                contaBancariaId: document.getElementById('recebimento-conta').value,
                                conciliado: false,
                                dataConciliacao: null,
                                usuarioConciliacao: null,
                                estornado: false,
                                migratedFromLegacy: false,
                                createdAt: serverTimestamp()
                            });'''
text = text[:initial_block_end] + initial_ledger + text[initial_block_end:]

text = replace_once(
    text,
    "                transaction.update(pagamentoRef, { estornado: true });",
    "                transaction.update(pagamentoRef, { estornado: true });\n"
    "                transaction.delete(doc(db, 'users', userId, 'movimentacoesFinanceiras', "
    "financialMovementDocId('pagamento', despesaId, pagamentoId)));",
    "payment reversal ledger cleanup",
)
text = replace_once(
    text,
    "                transaction.update(recebimentoRef, { estornado: true });",
    "                transaction.update(recebimentoRef, { estornado: true });\n"
    "                transaction.delete(doc(db, 'users', userId, 'movimentacoesFinanceiras', "
    "financialMovementDocId('recebimento', receitaId, recebimentoId)));",
    "receipt reversal ledger cleanup",
)

dashboard = r'''    async function updateAllDashboardViews() {
        try {
            if (!effectiveUserId) return;

            await ensureFinancialLedger(db, effectiveUserId);

            const despesasQuery = query(collection(db, 'users', effectiveUserId, 'despesas'));
            const receitasQuery = query(collection(db, 'users', effectiveUserId, 'receitas'));
            const contasBancariasQuery = query(collection(db, 'users', effectiveUserId, 'contasBancarias'));

            const [despesasSnap, receitasSnap, contasBancariasSnap, financialMovements] = await Promise.all([
                getDocs(despesasQuery),
                getDocs(receitasQuery),
                getDocs(contasBancariasQuery),
                fetchFinancialLedger(db, effectiveUserId)
            ]);

            const allDespesas = despesasSnap.docs;
            const allReceitas = receitasSnap.docs;
            const allContasBancarias = contasBancariasSnap.docs;
            const despesasById = new Map(allDespesas.map(snapshotDoc => [snapshotDoc.id, snapshotDoc.data()]));
            const receitasById = new Map(allReceitas.map(snapshotDoc => [snapshotDoc.id, snapshotDoc.data()]));

            let totalSaldoInicial = 0;
            allContasBancarias.forEach(snapshotDoc => {
                totalSaldoInicial += snapshotDoc.data().saldoInicial || 0;
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            let provisaoAPagar = 0, provisaoAReceber = 0;
            let pagarTotalMes = 0, pagarPagoMes = 0, pagarVencidas = 0;
            let receberTotalMes = 0, receberRecebidoMes = 0, receberVencidos = 0;
            let movSaidas = 0, movEntradas = 0;

            allDespesas.forEach(snapshotDoc => {
                const data = snapshotDoc.data();
                const status = data.status || 'Pendente';
                const saldo = data.valorSaldo ?? 0;
                const vencimentoStr = data.vencimento;
                if (!vencimentoStr) return;

                const vencimento = new Date(vencimentoStr + 'T00:00:00');
                if (isNaN(vencimento.getTime()) || status === 'Pago') return;

                provisaoAPagar += saldo;
                if (vencimento.getMonth() === currentMonth && vencimento.getFullYear() === currentYear) {
                    pagarTotalMes += saldo;
                }
                if (vencimento < today) pagarVencidas += saldo;
            });

            allReceitas.forEach(snapshotDoc => {
                const data = snapshotDoc.data();
                const status = data.status || 'Pendente';
                if (status === 'Desdobrado') return;

                const saldo = data.saldoPendente ?? 0;
                const vencimentoStr = data.dataVencimento || data.vencimento;
                if (!vencimentoStr) return;

                const vencimento = new Date(vencimentoStr + 'T00:00:00');
                if (isNaN(vencimento.getTime()) || status === 'Recebido') return;

                provisaoAReceber += saldo;
                if (vencimento.getMonth() === currentMonth && vencimento.getFullYear() === currentYear) {
                    receberTotalMes += saldo;
                }
                if (vencimento < today) receberVencidos += saldo;
            });

            financialMovements.forEach(movement => {
                if (!movement.dataTransacao || movement.estornado === true) return;
                const transacaoDate = new Date(movement.dataTransacao + 'T00:00:00');
                if (isNaN(transacaoDate.getTime())) return;
                const valorPrincipal = movement.valorPrincipal || 0;

                if (movement.tipo === 'pagamento') {
                    if (!despesasById.has(movement.origemParentId)) return;
                    movSaidas += valorPrincipal;
                    if (transacaoDate.getMonth() === currentMonth && transacaoDate.getFullYear() === currentYear) {
                        pagarPagoMes += valorPrincipal;
                    }
                    return;
                }

                if (movement.tipo === 'recebimento') {
                    const receita = receitasById.get(movement.origemParentId);
                    if (!receita || (receita.status || 'Pendente') === 'Desdobrado') return;
                    movEntradas += valorPrincipal;
                    if (transacaoDate.getMonth() === currentMonth && transacaoDate.getFullYear() === currentYear) {
                        receberRecebidoMes += valorPrincipal;
                    }
                }
            });

            const saldoProvisao = totalSaldoInicial + provisaoAReceber - provisaoAPagar;
            const saldoMovimentacao = totalSaldoInicial + movEntradas - movSaidas;

            document.getElementById('dashboard-provisao-a-pagar').textContent = formatCurrency(provisaoAPagar);
            document.getElementById('dashboard-provisao-a-receber').textContent = formatCurrency(provisaoAReceber);

            const saldoProjetadoEl = document.getElementById('dashboard-provisao-saldo');
            saldoProjetadoEl.textContent = formatCurrency(saldoProvisao);
            saldoProjetadoEl.classList.remove('text-red-600', 'text-green-600', 'text-yellow-500', 'text-gray-900');
            if (saldoProvisao > 0) saldoProjetadoEl.classList.add('text-green-600');
            else if (saldoProvisao < 0) saldoProjetadoEl.classList.add('text-red-600');
            else saldoProjetadoEl.classList.add('text-yellow-500');

            document.getElementById('dashboard-pagar-total-mes').textContent = formatCurrency(pagarTotalMes);
            document.getElementById('dashboard-pagar-pago-mes').textContent = formatCurrency(pagarPagoMes);
            document.getElementById('dashboard-pagar-vencidas').textContent = formatCurrency(pagarVencidas);
            document.getElementById('total-a-pagar-card').textContent = formatCurrency(pagarTotalMes);
            document.getElementById('total-pago-card').textContent = formatCurrency(pagarPagoMes);
            document.getElementById('contas-vencidas-card').textContent = formatCurrency(pagarVencidas);
            document.getElementById('dashboard-receber-total-mes').textContent = formatCurrency(receberTotalMes);
            document.getElementById('dashboard-receber-recebido-mes').textContent = formatCurrency(receberRecebidoMes);
            document.getElementById('dashboard-receber-vencidos').textContent = formatCurrency(receberVencidos);
            document.getElementById('total-a-receber-card').textContent = formatCurrency(receberTotalMes);
            document.getElementById('total-recebido-card').textContent = formatCurrency(receberRecebidoMes);
            document.getElementById('titulos-vencidos-card').textContent = formatCurrency(receberVencidos);
            document.getElementById('dashboard-mov-saidas').textContent = formatCurrency(movSaidas);
            document.getElementById('dashboard-mov-entradas').textContent = formatCurrency(movEntradas);
            document.getElementById('dashboard-mov-saldo').textContent = formatCurrency(saldoMovimentacao);

            document.querySelectorAll('.saldo-em-conta-value').forEach(card => {
                card.textContent = formatCurrency(saldoMovimentacao);
            });

            document.getElementById('saldo-projetado-pagar-card').textContent = formatCurrency(saldoMovimentacao - pagarTotalMes);
            document.getElementById('saldo-projetado-receber-card').textContent = formatCurrency(saldoMovimentacao + receberTotalMes);
        } catch (error) {
            console.error("Error updating all dashboard views:", error);
        }
    }
'''
text = replace_between(
    text,
    "    async function updateAllDashboardViews() {",
    "\n\n    function processAndRenderReceberCalendarEvents(docs) {",
    dashboard,
    "dashboard replacement",
)
path.write_text(text, encoding="utf-8")


# -----------------------------------------------------------------------------
# notifications.js — canonical collection is now fixed at the source.
# -----------------------------------------------------------------------------
path = Path("notifications.js")
text = path.read_text(encoding="utf-8")
bridge_start = text.find("/**\n * Keeps the employee/system-user association dropdown")
bridge_end = text.find("/**\n * Checks if a specific notification already exists", bridge_start)
if bridge_start < 0 or bridge_end < 0:
    raise RuntimeError("notifications compatibility bridge not found")
text = text[:bridge_start] + text[bridge_end:]
text = replace_once(text, "    syncSystemUsersDropdown(db, userId);\n", "", "bridge invocation")
path.write_text(text, encoding="utf-8")


# -----------------------------------------------------------------------------
# fluxo-de-caixa.js
# -----------------------------------------------------------------------------
path = Path("fluxo-de-caixa.js")
text = path.read_text(encoding="utf-8")
first_line_end = text.find("\n")
text = text[:first_line_end + 1] + (
    "import { fetchFinancialLedger, fetchDocumentsByIds, financialMovementDocId } from './financial-ledger.js';\n"
) + text[first_line_end + 1:]

# Remove recurring parent->subcollection N+1 helper entirely.
text = replace_between(
    text,
    "    async function fetchTransactionsEfficiently(",
    "    async function fetchProjectedTransactions(",
    "",
    "legacy N+1 helper removal",
)

text = replace_once(
    text,
    """                const [pagamentos, recebimentos, transferencias] = await Promise.all([\n                    fetchTransactionsEfficiently('despesas', 'pagamentos', startDate, endDate),\n                    fetchTransactionsEfficiently('receitas', 'recebimentos', startDate, endDate),\n                    fetchCollection('transferencias', startDate, endDate)\n                ]);\n                const realizedTransactions = await enrichAndUnifyTransactions(pagamentos, recebimentos, transferencias);""",
    """                const [financialMovements, transferencias] = await Promise.all([\n                    fetchFinancialLedger(db, userId, { startDate, endDate }),\n                    fetchCollection('transferencias', startDate, endDate)\n                ]);\n                const realizedTransactions = await enrichAndUnifyTransactions(financialMovements, transferencias);""",
    "current period ledger read",
)

text = replace_once(
    text,
    """        const [pagamentos, recebimentos, transferencias] = await Promise.all([\n            fetchTransactionsEfficiently('despesas', 'pagamentos', null, startDate, false),\n            fetchTransactionsEfficiently('receitas', 'recebimentos', null, startDate, false),\n            fetchCollection('transferencias', null, startDate, false)\n        ]);\n\n        const allTransactions = await enrichAndUnifyTransactions(pagamentos, recebimentos, transferencias);""",
    """        const [financialMovements, transferencias] = await Promise.all([\n            fetchFinancialLedger(db, userId, { endDate: startDate, inclusive: false }),\n            fetchCollection('transferencias', null, startDate, false)\n        ]);\n\n        const allTransactions = await enrichAndUnifyTransactions(financialMovements, transferencias);""",
    "previous balance ledger read",
)

text = replace_once(
    text,
    """            const [pagamentosAnteriores, recebimentosAnteriores] = await Promise.all([\n                fetchTransactionsEfficiently('despesas', 'pagamentos', prevStartDateStr, prevEndDateStr),\n                fetchTransactionsEfficiently('receitas', 'recebimentos', prevStartDateStr, prevEndDateStr)\n            ]);\n\n            const transacoesAnteriores = await enrichAndUnifyTransactions(pagamentosAnteriores, recebimentosAnteriores, []);""",
    """            const financialMovementsAnteriores = await fetchFinancialLedger(db, userId, {\n                startDate: prevStartDateStr,\n                endDate: prevEndDateStr\n            });\n\n            const transacoesAnteriores = await enrichAndUnifyTransactions(financialMovementsAnteriores, []);""",
    "comparison previous period ledger read",
)
text = replace_once(
    text,
    """            const [pagamentosAtuais, recebimentosAtuais] = await Promise.all([\n                fetchTransactionsEfficiently('despesas', 'pagamentos', startDateStr, endDateStr),\n                fetchTransactionsEfficiently('receitas', 'recebimentos', startDateStr, endDateStr)\n            ]);\n            const transacoesAtuais = await enrichAndUnifyTransactions(pagamentosAtuais, recebimentosAtuais, []);""",
    """            const financialMovementsAtuais = await fetchFinancialLedger(db, userId, {\n                startDate: startDateStr,\n                endDate: endDateStr\n            });\n            const transacoesAtuais = await enrichAndUnifyTransactions(financialMovementsAtuais, []);""",
    "comparison current period ledger read",
)

enrichment = r'''    async function enrichAndUnifyTransactions(financialMovements, transferencias) {
        const unified = [];
        const pagamentos = financialMovements.filter(movement => movement.tipo === 'pagamento');
        const recebimentos = financialMovements.filter(movement => movement.tipo === 'recebimento');

        const [despesasById, receitasById, planoContasSnap] = await Promise.all([
            fetchDocumentsByIds(db, userId, 'despesas', pagamentos.map(movement => movement.origemParentId)),
            fetchDocumentsByIds(db, userId, 'receitas', recebimentos.map(movement => movement.origemParentId)),
            getDocs(collection(db, `users/${userId}/planosDeContas`))
        ]);

        const planoContasMap = new Map();
        planoContasSnap.forEach(snapshotDoc => planoContasMap.set(snapshotDoc.id, snapshotDoc.data()));

        for (const movement of pagamentos) {
            const despesaSnap = despesasById.get(movement.origemParentId);
            if (!despesaSnap || movement.estornado === true) continue;
            const despesaData = despesaSnap.data();
            const categoria = planoContasMap.get(despesaData.categoriaId);
            unified.push({
                id: movement.origemId || movement.id,
                parentId: movement.origemParentId,
                data: movement.dataTransacao,
                descricao: despesaData.descricao,
                participante: despesaData.favorecidoNome || 'N/A',
                planoDeConta: categoria ? categoria.nome : 'N/A',
                dataVencimento: despesaData.vencimento,
                tipoAtividade: categoria ? categoria.tipoDeAtividade : 'Operacional',
                entrada: 0,
                saida: movement.valorPrincipal || 0,
                juros: movement.juros || 0,
                desconto: movement.desconto || 0,
                contaId: movement.contaBancariaId,
                conciliado: movement.conciliado || false,
                type: 'pagamento'
            });
        }

        for (const movement of recebimentos) {
            const receitaSnap = receitasById.get(movement.origemParentId);
            if (!receitaSnap || movement.estornado === true) continue;
            const receitaData = receitaSnap.data();
            if ((receitaData.status || 'Pendente') === 'Desdobrado') continue;
            const categoria = planoContasMap.get(receitaData.categoriaId);
            unified.push({
                id: movement.origemId || movement.id,
                parentId: movement.origemParentId,
                data: movement.dataTransacao,
                descricao: receitaData.descricao,
                participante: receitaData.clienteNome || 'N/A',
                planoDeConta: categoria ? categoria.nome : 'N/A',
                dataVencimento: receitaData.dataVencimento || receitaData.vencimento,
                tipoAtividade: categoria ? categoria.tipoDeAtividade : 'Operacional',
                entrada: movement.valorPrincipal || 0,
                saida: 0,
                juros: movement.juros || 0,
                desconto: movement.desconto || 0,
                contaId: movement.contaBancariaId,
                conciliado: movement.conciliado || false,
                type: 'recebimento'
            });
        }

        for (const snapshotDoc of transferencias) {
            const data = snapshotDoc.data();
            unified.push({
                id: snapshotDoc.id,
                data: data.dataTransacao,
                descricao: `Transferência de ${data.contaOrigemNome} para ${data.contaDestinoNome}`,
                participante: 'Interno',
                planoDeConta: 'Transferência',
                dataVencimento: data.dataTransacao,
                tipoAtividade: 'N/A',
                valor: data.valor,
                juros: 0,
                desconto: 0,
                contaOrigemId: data.contaOrigemId,
                contaDestinoId: data.contaDestinoId,
                conciliado: data.conciliado || false,
                type: 'transferencia'
            });
        }

        return unified.sort((a, b) => new Date(a.data) - new Date(b.data));
    }

'''
text = replace_between(
    text,
    "    async function enrichAndUnifyTransactions(",
    "    function applyFilters(transactions, contaId, conciliacaoStatus) {",
    enrichment,
    "ledger enrichment",
)

# Cash-flow reconciliation must update both the legacy source and the ledger.
old_reconciliation = """        try {\n            await updateDoc(docRef, { conciliado: isConciliado });\n            console.log(`Transação ${transacaoId} atualizada para conciliado: ${isConciliado}`);"""
new_reconciliation = """        try {\n            if (type === 'pagamento' || type === 'recebimento') {\n                const ledgerRef = doc(\n                    db,\n                    `users/${userId}/movimentacoesFinanceiras`,\n                    financialMovementDocId(type, parentId, transacaoId)\n                );\n                await Promise.all([\n                    updateDoc(docRef, { conciliado: isConciliado }),\n                    updateDoc(ledgerRef, { conciliado: isConciliado })\n                ]);\n            } else {\n                await updateDoc(docRef, { conciliado: isConciliado });\n            }\n            console.log(`Transação ${transacaoId} atualizada para conciliado: ${isConciliado}`);"""
text = replace_once(text, old_reconciliation, new_reconciliation, "cash-flow reconciliation ledger sync")
path.write_text(text, encoding="utf-8")


# -----------------------------------------------------------------------------
# movimentacao-bancaria.js
# -----------------------------------------------------------------------------
path = Path("movimentacao-bancaria.js")
text = path.read_text(encoding="utf-8")
first_line_end = text.find("\n")
text = text[:first_line_end + 1] + (
    "import { ensureFinancialLedger, financialMovementDocId } from './financial-ledger.js';\n"
) + text[first_line_end + 1:]

text = replace_once(
    text,
    "        if (selectedIds.length === 0) return;\n\n        const batch = writeBatch(db);",
    "        if (selectedIds.length === 0) return;\n\n        await ensureFinancialLedger(db, userId);\n        const batch = writeBatch(db);",
    "bank reconciliation migration guard",
)

old_update = """            batch.update(ref, {\n                conciliado: conciliar,\n                dataConciliacao: conciliar ? new Date().toISOString().split('T')[0] : null,\n                usuarioConciliacao: conciliar ? currentUserName : null\n            });"""
new_update = """            const reconciliationData = {\n                conciliado: conciliar,\n                dataConciliacao: conciliar ? new Date().toISOString().split('T')[0] : null,\n                usuarioConciliacao: conciliar ? currentUserName : null\n            };\n            batch.update(ref, reconciliationData);\n\n            const movement = allMovimentacoes.find(item => item.id === id);\n            const ledgerType = movement?.origemTipo === 'PAGAMENTO_DESPESA'\n                ? 'pagamento'\n                : (movement?.origemTipo === 'RECEBIMENTO_RECEITA' ? 'recebimento' : null);\n            if (ledgerType && movement.origemParentId && movement.origemId) {\n                const ledgerRef = doc(\n                    db,\n                    `users/${userId}/movimentacoesFinanceiras`,\n                    financialMovementDocId(ledgerType, movement.origemParentId, movement.origemId)\n                );\n                batch.update(ledgerRef, reconciliationData);\n            }"""
text = replace_once(text, old_update, new_update, "bank reconciliation ledger sync")

# Only the estorno handler contains this runTransaction pattern with movRef logic.
estorno_anchor = "    async function estornarLancamentoSelecionado() {"
estorno_start = text.find(estorno_anchor)
if estorno_start < 0:
    raise RuntimeError("bank reversal function not found")
run_tx = text.find("            await runTransaction(db, async (transaction) => {", estorno_start)
if run_tx < 0:
    raise RuntimeError("bank reversal transaction not found")
text = text[:run_tx] + "            await ensureFinancialLedger(db, userId);\n" + text[run_tx:]

manual_guard = """                if (!movData.origemParentId || !movData.origemId || !movData.origemTipo.includes('_')) {\n                    transaction.delete(movRef);\n                    return; // Fim da operação para lançamentos manuais\n                }"""
ledger_guard = manual_guard + """\n\n                const ledgerType = movData.origemTipo === 'PAGAMENTO_DESPESA'\n                    ? 'pagamento'\n                    : (movData.origemTipo === 'RECEBIMENTO_RECEITA' ? 'recebimento' : null);\n                const financialLedgerRef = ledgerType\n                    ? doc(\n                        db,\n                        `users/${userId}/movimentacoesFinanceiras`,\n                        financialMovementDocId(ledgerType, movData.origemParentId, movData.origemId)\n                    )\n                    : null;"""
text = replace_once(text, manual_guard, ledger_guard, "bank reversal ledger reference")
text = replace_once(
    text,
    "                // Deleta a movimentação bancária da tela de conciliação\n                transaction.delete(movRef);",
    "                // Deleta a movimentação bancária da tela de conciliação\n"
    "                transaction.delete(movRef);\n"
    "                if (financialLedgerRef) transaction.delete(financialLedgerRef);",
    "bank reversal ledger cleanup",
)
path.write_text(text, encoding="utf-8")

print("PR13 complete patch applied successfully")
