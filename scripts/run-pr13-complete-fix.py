from pathlib import Path

source_path = Path('scripts/apply-pr13-complete-fix.py')
source = source_path.read_text(encoding='utf-8')

old_call = 'text = replace_once(text, old_reconciliation, new_reconciliation, "cash-flow reconciliation ledger sync")'
new_call = r'''text, reconciliation_count = re.subn(
    r"        try \\{\\s*await updateDoc\\(docRef, \\{ conciliado: isConciliado \\}\\);\\s*const row = checkbox\\.closest\\('tr'\\);\\s*row\\.classList\\.toggle\\('bg-green-50', isConciliado\\);",
    lambda _: new_reconciliation,
    text,
    count=1,
    flags=re.S,
)
if reconciliation_count != 1:
    raise RuntimeError(f"cash-flow reconciliation ledger sync: expected 1 occurrence, found {reconciliation_count}")'''

if source.count(old_call) != 1:
    raise RuntimeError(f'could not patch reconciliation call; occurrences={source.count(old_call)}')
source = source.replace(old_call, new_call, 1)

exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})
