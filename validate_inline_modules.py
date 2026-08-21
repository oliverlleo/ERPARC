from pathlib import Path
import re
import subprocess
import tempfile


def validate(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    scripts = re.findall(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', text, flags=re.IGNORECASE | re.DOTALL)
    inline_module_count = 0
    for index, (attrs, body) in enumerate(scripts):
        if 'src=' in attrs or 'type="module"' not in attrs and "type='module'" not in attrs:
            continue
        inline_module_count += 1
        with tempfile.NamedTemporaryFile('w', suffix='.mjs', encoding='utf-8', delete=False) as handle:
            handle.write(body)
            temp_path = handle.name
        result = subprocess.run(['node', '--check', temp_path], capture_output=True, text=True)
        if result.returncode != 0:
            raise SystemExit(f'{path}: script inline {index} inválido:\n{result.stderr}')
    print(f'{path}: {inline_module_count} script(s) inline validado(s)')


for filename in ('index.html', 'crm.html'):
    validate(Path(filename))
