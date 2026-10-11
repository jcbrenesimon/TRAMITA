"""
Prepara la web y el panel admin para publicar en Hostinger.

Uso (desde la carpeta TRAMITA):
    python deploy/build.py                      # panel en /admin (dominio temporal)
    python deploy/build.py --public-url https://tramita.cr   # panel en admin.tramita.cr

Genera:
    dist/web/      -> subir a public_html/
    dist/admin/    -> subir a public_html/admin/   (o a la carpeta del subdominio admin)
    dist/tramita-web.zip, dist/tramita-admin.zip

No modifica "Web app view/" ni "Admin view/".
"""
import argparse
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / 'deploy'
DIST = ROOT / 'dist'

APPS = [
    # (carpeta fuente, archivo de entrada, carpeta destino, .htaccess)
    ('Web app view', 'tramita-app-v2.html', 'web', 'web.htaccess'),
    ('Admin view', 'tramita-admin.html', 'admin', 'admin.htaccess'),
]

# Archivos de la fuente que no se publican
EXCLUDE = {'README.md'}


def build_app(src_name, entry, out_name, htaccess):
    src = ROOT / src_name
    out = DIST / out_name
    shutil.copytree(src, out, ignore=lambda d, files: [f for f in files if f in EXCLUDE])
    (out / entry).rename(out / 'index.html')
    shutil.copy(DEPLOY / htaccess, out / '.htaccess')
    return out


def set_public_url(admin_dir, public_url):
    config = admin_dir / 'js' / 'core' / 'config.js'
    text = config.read_text(encoding='utf-8')
    text, n = re.subn(r"const PUBLIC_APP_URL = '[^']*';", f"const PUBLIC_APP_URL = '{public_url}';", text)
    if n != 1:
        raise SystemExit('No se encontró PUBLIC_APP_URL en admin/js/core/config.js')
    config.write_text(text, encoding='utf-8')


def zip_dir(folder, zip_path):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(folder.rglob('*')):
            if f.is_file():
                z.write(f, f.relative_to(folder).as_posix())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--public-url', default='/',
                        help="URL de la web pública para el enlace del login del admin (por defecto '/')")
    args = parser.parse_args()

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    outs = {name: build_app(src, entry, name, ht) for src, entry, name, ht in APPS}
    set_public_url(outs['admin'], args.public_url)

    for name, folder in outs.items():
        zip_path = DIST / f'tramita-{name}.zip'
        zip_dir(folder, zip_path)
        count = sum(1 for f in folder.rglob('*') if f.is_file())
        print(f'{name:6} -> {folder.relative_to(ROOT)}  ({count} archivos)  zip: {zip_path.name}')

    # Carpeta lista para arrastrar su CONTENIDO a public_html/ (web en la raíz, panel en admin/)
    public_html = DIST / 'public_html'
    shutil.copytree(outs['web'], public_html)
    shutil.copytree(outs['admin'], public_html / 'admin')
    count = sum(1 for f in public_html.rglob('*') if f.is_file())
    print(f'public_html -> {public_html.relative_to(ROOT)}  ({count} archivos)')


if __name__ == '__main__':
    main()
