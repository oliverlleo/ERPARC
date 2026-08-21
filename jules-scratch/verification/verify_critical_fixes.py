from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
index = (ROOT / 'index.html').read_text(encoding='utf-8')
crm = (ROOT / 'crm.html').read_text(encoding='utf-8')
fluxo = (ROOT / 'fluxo-de-caixa.js').read_text(encoding='utf-8')
relatorios = (ROOT / 'relatorios.js').read_text(encoding='utf-8')

assert 'where("senha"' not in index
assert 'where("senha"' not in crm
assert 'sessionStorage.setItem' not in index
assert 'sessionStorage.setItem' not in crm
assert index.count('transferenciaForm.addEventListener') == 1
assert 'transferenciaGrupos' in index
assert 'movimentacoesBancarias' in fluxo
assert "fetchCollection('movimentacoesBancarias'" in fluxo
assert 'allocateCents' in index
assert 'allocateCents' in fluxo
assert 'classifyOverdueBucket' in relatorios
assert "case '90':" in relatorios
assert "show = diasAtraso > 90" not in relatorios

print('verify_critical_fixes.py: OK')
