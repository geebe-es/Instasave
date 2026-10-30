import importlib.metadata
from pathlib import Path
import sys

parts = []
for distribution in sorted(importlib.metadata.distributions(), key=lambda dist: dist.metadata['Name'].lower()):
    parts.append(f"\n===== {distribution.metadata['Name']} {distribution.version} =====\n")
    for entry in distribution.files or []:
        if '.dist-info/licenses/' in str(entry).replace('\\', '/') or entry.name.lower() in {'license', 'license.txt', 'license.md', 'copying', 'notice'}:
            candidate = Path(distribution.locate_file(entry))
            if candidate.is_file():
                parts.append(candidate.read_text(encoding='utf-8', errors='replace'))
for candidate in [Path(sys.base_prefix) / 'LICENSE.txt', Path(sys.base_prefix) / 'LICENSE']:
    if candidate.is_file():
        parts.append('\n===== Python =====\n' + candidate.read_text(encoding='utf-8'))
Path('resources/PYTHON-NOTICES.txt').write_text('\n'.join(parts), encoding='utf-8')
