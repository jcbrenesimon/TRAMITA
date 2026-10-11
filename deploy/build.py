"""
Prepara la web y el panel admin para publicar en Hostinger.

Uso (desde la carpeta TRAMITA):
    python deploy/build.py                                   # panel en /admin (dominio temporal)
    python deploy/build.py --public-url https://tramita.cr   # panel en admin.tramita.cr

Genera:
    dist/public_html/   -> arrastrar su CONTENIDO a public_html/ (web en la raíz, panel en admin/)

Producción (#23): los CSS y JS de cada app se unen en un solo archivo con
nombre por contenido (app.<hash>.css / app.<hash>.js): menos peticiones y el
navegador puede guardarlos en caché sin quedarse con versiones viejas.

No modifica "Web app view/" ni "Admin view/".
"""
import argparse
import hashlib
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / 'deploy'
DIST = ROOT / 'dist'

APPS = [
    # (carpeta fuente, archivo de entrada, carpeta destino, .htaccess)
    ('Web app view', 'tramita-app-v2.html', '.', 'web.htaccess'),
    ('Admin view', 'tramita-admin.html', 'admin', 'admin.htaccess'),
]

LINK_RE = re.compile(r'^<link rel="stylesheet" href="(css/[^"]+)">\n', re.M)
SCRIPT_RE = re.compile(r'^<script src="(js/[^"]+)"></script>\n', re.M)


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def minify_css(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)        # comentarios
    css = re.sub(r'\s+', ' ', css)                          # espacios
    css = re.sub(r'\s*([{}:;,>])\s*', r'\1', css)
    return css.replace(';}', '}').strip() + '\n'


def bundle(src_dir, html):
    css_files = LINK_RE.findall(html)
    js_files = SCRIPT_RE.findall(html)
    css = ''.join(minify_css((src_dir / f).read_text(encoding='utf-8')) for f in css_files)
    # Los scripts son clásicos (globales): se concatenan en el mismo orden
    js = '\n;\n'.join(f'/* {f} */\n' + (src_dir / f).read_text(encoding='utf-8') for f in js_files)
    css_name = f"app.{hashlib.sha256(css.encode()).hexdigest()[:10]}.css"
    js_name = f"app.{hashlib.sha256(js.encode()).hexdigest()[:10]}.js"

    first_link = LINK_RE.search(html)
    html = html[:first_link.start()] + f'<link rel="stylesheet" href="{css_name}">\n' + html[first_link.start():]
    html = LINK_RE.sub('', html)
    first_script = SCRIPT_RE.search(html)
    html = html[:first_script.start()] + f'<script src="{js_name}"></script>\n' + html[first_script.start():]
    html = SCRIPT_RE.sub('', html)
    return html, {css_name: css, js_name: js}, len(css_files), len(js_files)


def build_app(src_name, entry, out_name, htaccess, public_url=None):
    src = ROOT / src_name
    out = DIST / 'public_html' / out_name
    out.mkdir(parents=True, exist_ok=True)
    html = (src / entry).read_text(encoding='utf-8')
    html, assets, n_css, n_js = bundle(src, html)
    for name, content in assets.items():
        if public_url is not None and name.endswith('.js'):
            content, n = re.subn(r"const PUBLIC_APP_URL = '[^']*';", f"const PUBLIC_APP_URL = '{public_url}';", content)
            if n != 1:
                raise SystemExit('No se encontró PUBLIC_APP_URL en el panel')
        write(out / name, content)
    write(out / 'index.html', html)
    for extra in ('favicon.svg', 'robots.txt'):
        if (src / extra).exists():
            shutil.copy(src / extra, out / extra)
    shutil.copy(DEPLOY / htaccess, out / '.htaccess')
    return out, n_css, n_js


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--public-url', default='/',
                        help="URL de la web pública para el enlace del login del admin (por defecto '/')")
    args = parser.parse_args()

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    for src, entry, name, ht in APPS:
        out, n_css, n_js = build_app(src, entry, name, ht, args.public_url if name == 'admin' else None)
        files = sorted(p.name for p in out.iterdir() if p.is_file())
        print(f'{src:13} -> {out.relative_to(ROOT)}  ({n_css} CSS + {n_js} JS unidos)  {files}')


if __name__ == '__main__':
    main()
