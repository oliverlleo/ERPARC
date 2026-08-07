from pathlib import Path

source_path = Path('scripts/apply-pr13-complete-fix.py')
source = source_path.read_text(encoding='utf-8')

old_indent = 'old_reconciliation = """        try {'
new_old_indent = 'old_reconciliation = """            try {'
new_indent = 'new_reconciliation = """        try {'
new_new_indent = 'new_reconciliation = """            try {'

if source.count(old_indent) != 1:
    raise RuntimeError(f'old reconciliation definition not found exactly once: {source.count(old_indent)}')
if source.count(new_indent) != 1:
    raise RuntimeError(f'new reconciliation definition not found exactly once: {source.count(new_indent)}')

source = source.replace(old_indent, new_old_indent, 1)
source = source.replace(new_indent, new_new_indent, 1)
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})
