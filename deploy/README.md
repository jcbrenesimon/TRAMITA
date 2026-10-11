# Publicar en Hostinger

## 1. Generar los archivos

```bash
python deploy/build.py
```

Crea `dist/public_html/` — es lo único que se sube a Hostinger. La carpeta `dist/` no se sube a git.
Cada app queda en 4–5 archivos: `index.html`, `app.<hash>.css`, `app.<hash>.js`, `favicon.svg` y `.htaccess`.

## 2. Subir (hPanel → Archivos → Administrador de archivos → `public_html/`)

1. Borre los `app.*.css` / `app.*.js` viejos de `public_html/` y de `public_html/admin/` (cambian de nombre en cada versión).
2. Arrastre **el contenido** de `dist/public_html/` a `public_html/` y reemplace.
3. ⚠️ Si reemplaza `public_html/admin/.htaccess`, la contraseña de Hostinger del panel se pierde: vuelva a activarla en Avanzado → Proteger directorios. (Alternativa: no reemplace ese `.htaccess` si no cambió.)

## 3. Proteger el panel

hPanel → Avanzado → **Proteger directorios con contraseña** → carpeta `public_html/admin`.

## 4. Supabase

Authentication → **URL Configuration**:
- Site URL: `https://<dominio>`
- Redirect URLs: `https://<dominio>/**`

## Cuando exista el dominio propio (tramita.cr)

1. hPanel → Dominios → Subdominios → crear `admin`.
2. `python deploy/build.py --public-url https://tramita.cr`
3. Subir el contenido de `dist/public_html/admin/` a la carpeta del subdominio y protegerla.
4. Agregar `https://admin.tramita.cr/**` en las Redirect URLs de Supabase.
5. Actualizar la CSP de los `.htaccess` si cambia el proyecto de Supabase.
