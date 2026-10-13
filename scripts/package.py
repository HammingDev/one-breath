"""Build a Chrome Web Store ZIP with manifest.json at its root."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
extension = root / 'extension'
version = json.loads((extension / 'manifest.json').read_text())['version']
out = root / 'dist' / f'one-breath-{version}-store.zip'
out.parent.mkdir(exist_ok=True)
allowed = {'.js', '.json', '.html', '.css', '.png'}
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for file in sorted(extension.rglob('*')):
        relative = file.relative_to(extension)
        if file.is_file() and file.suffix in allowed and not any(part.startswith(('.', '_')) for part in relative.parts):
            archive.write(file, relative.as_posix())
    archive.write(root / 'LICENSE', 'LICENSE')
with ZipFile(out) as archive:
    assert 'manifest.json' in archive.namelist()
    assert not any('_metadata' in name for name in archive.namelist())
print(out)
