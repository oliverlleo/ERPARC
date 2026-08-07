from pathlib import Path

source_path = Path('scripts/apply-pr13-complete-fix.py')
source = source_path.read_text(encoding='utf-8')

old_call = 'text = replace_once(text, old_reconciliation, new_reconciliation, "cash-flow reconciliation ledger sync")'
if source.count(old_call) != 1:
    raise RuntimeError(f'reconciliation call not found exactly once: {source.count(old_call)}')
source = source.replace(old_call, 'pass  # reconciliation is patched against the real file below', 1)

old_estorno_anchor = '    async function estornarLancamentoSelecionado() {'
real_estorno_anchor = '    async function handleEstorno() {'
if source.count(old_estorno_anchor) != 1:
    raise RuntimeError(f'bank reversal anchor definition not found exactly once: {source.count(old_estorno_anchor)}')
source = source.replace(old_estorno_anchor, real_estorno_anchor, 1)

# Apply every other deterministic source transformation first.
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})

# Patch the actual reconciliation block after the main transformation has written
# fluxo-de-caixa.js. Keeping this separate makes the matcher reflect the real
# indentation and prevents an approximate patch from being committed.
fluxo_path = Path('fluxo-de-caixa.js')
fluxo = fluxo_path.read_text(encoding='utf-8')
old = """            try {\n                await updateDoc(docRef, { conciliado: isConciliado });\n                const row = checkbox.closest('tr');\n                row.classList.toggle('bg-green-50', isConciliado);"""
new = """            try {\n                if (type === 'pagamento' || type === 'recebimento') {\n                    const ledgerRef = doc(\n                        db,\n                        `users/${userId}/movimentacoesFinanceiras`,\n                        financialMovementDocId(type, parentId, transacaoId)\n                    );\n                    await Promise.all([\n                        updateDoc(docRef, { conciliado: isConciliado }),\n                        updateDoc(ledgerRef, { conciliado: isConciliado })\n                    ]);\n                } else {\n                    await updateDoc(docRef, { conciliado: isConciliado });\n                }\n                const row = checkbox.closest('tr');\n                row.classList.toggle('bg-green-50', isConciliado);"""
if fluxo.count(old) != 1:
    raise RuntimeError(f'real cash-flow reconciliation block: expected 1 occurrence, found {fluxo.count(old)}')
fluxo_path.write_text(fluxo.replace(old, new, 1), encoding='utf-8')
print('PR13 complete patch including reconciliation applied successfully')
