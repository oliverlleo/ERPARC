from pathlib import Path
import re

source_path = Path('scripts/apply-pr13-complete-fix.py')
source = source_path.read_text(encoding='utf-8')

replacement = r'''old_reconciliation = """        try {\n            await updateDoc(docRef, { conciliado: isConciliado });\n            const row = checkbox.closest('tr');\n            row.classList.toggle('bg-green-50', isConciliado);"""
new_reconciliation = """        try {\n            if (type === 'pagamento' || type === 'recebimento') {\n                const ledgerRef = doc(\n                    db,\n                    `users/${userId}/movimentacoesFinanceiras`,\n                    financialMovementDocId(type, parentId, transacaoId)\n                );\n                await Promise.all([\n                    updateDoc(docRef, { conciliado: isConciliado }),\n                    updateDoc(ledgerRef, { conciliado: isConciliado })\n                ]);\n            } else {\n                await updateDoc(docRef, { conciliado: isConciliado });\n            }\n            const row = checkbox.closest('tr');\n            row.classList.toggle('bg-green-50', isConciliado);"""'''

source, count = re.subn(
    r'old_reconciliation = """.*?"""\nnew_reconciliation = """.*?"""',
    lambda _: replacement,
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f'could not patch reconciliation matcher; replacements={count}')

exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})
