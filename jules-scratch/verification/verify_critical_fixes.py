from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
index = (ROOT / 'index.html').read_text(encoding='utf-8')
crm = (ROOT / 'crm.html').read_text(encoding='utf-8')
fluxo = (ROOT / 'fluxo-de-caixa.js').read_text(encoding='utf-8')
relatorios = (ROOT / 'relatorios.js').read_text(encoding='utf-8')
rules = (ROOT / 'financial-rules.js').read_text(encoding='utf-8')

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
assert 'allocateProportionally' in index
assert 'parseMoneyToCents' in index
assert 'addMonthsClamped' in index
assert 'function calculateOpenBalance' in index
assert 'function deriveTitleStatus' in index
assert 'function readMoneyInput' in index
assert 'allocateProportionally' in rules
assert 'parseMoneyToCents' in rules
assert 'addMonthsClamped' in rules
assert 'valorPrincipal: base' in index
assert 'valorMovimentado' in index
assert 'classifyOverdueBucket' in relatorios
assert "case '90':" in relatorios
assert "show = diasAtraso > 90" not in relatorios

print('verify_critical_fixes.py: OK')
