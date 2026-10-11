# Publicar en Hostinger

## 1. Generar los archivos

```bash
python deploy/build.py
```

Crea `dist/tramita-web.zip` y `dist/tramita-admin.zip` (la carpeta `dist/` no se sube a git).

## 2. Subir (hPanel → Archivos → Administrador de archivos)

| Zip | Dónde se extrae |
|---|---|
| `tramita-web.zip` | `public_html/` |
| `tramita-admin.zip` | `public_html/admin/` (crear la carpeta) |

Subir el zip a la carpeta → clic derecho → **Extraer** → borrar el zip.
En `public_html/` borrar el `default.php` / `index.php` de bienvenida de Hostinger si existe.
Activar "Mostrar archivos ocultos" y confirmar que cada carpeta tiene su `.htaccess`.

## 3. Proteger el panel

hPanel → Avanzado → **Proteger directorios con contraseña** → carpeta `public_html/admin`.
Quien no tenga esa contraseña no descarga ni el código del panel.

## 4. Supabase

Authentication → **URL Configuration**:
- Site URL: `https://<dominio>`
- Redirect URLs: `https://<dominio>/**`

## Cuando exista el dominio propio (tramita.cr)

1. hPanel → Dominios → Subdominios → crear `admin` (carpeta `public_html/admin` o la que asigne Hostinger).
2. `python deploy/build.py --public-url https://tramita.cr`
3. Subir `tramita-admin.zip` a la carpeta del subdominio y proteger esa carpeta.
4. Agregar `https://admin.tramita.cr/**` en las Redirect URLs de Supabase.

## Actualizar

Repetir 1 y 2 (reemplazando archivos). Las reglas de caché del `.htaccess` hacen que los
navegadores tomen la versión nueva sin necesidad de Ctrl+Shift+R.
