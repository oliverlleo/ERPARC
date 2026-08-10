from pathlib import Path

source_path = Path('scripts/finalize-security-hardening.py')
source = source_path.read_text(encoding='utf-8')
needle = "path.write_text(text, encoding='utf-8')\n\n\n# -----------------------------------------------------------------------------\n# index.html"
replacement = "path.write_text(text.rstrip() + '\\n', encoding='utf-8')\n\n\n# -----------------------------------------------------------------------------\n# index.html"
if source.count(needle) != 1:
    raise RuntimeError(f'notifications output normalizer marker count: {source.count(needle)}')
source = source.replace(needle, replacement, 1)
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})
