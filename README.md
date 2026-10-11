# Tramitá

Plataforma web para contratar servicios de tramitología en Costa Rica: recuperación de placas, apostillas, certificaciones y gestiones vehiculares y legales, con precios publicados, pago por SINPE Móvil o transferencia y seguimiento de cada orden.

| | |
|---|---|
| **Web pública** | Catálogo, carrito, checkout, subida de comprobantes, "Mis compras", cuenta, puntos y cupones |
| **Panel administrativo** | Comprobantes, órdenes, usuarios, catálogo, cuentas bancarias, cupones, configuración y registro de errores |
| **Backend** | [Supabase](https://supabase.com): PostgreSQL, Auth y Storage |
| **Hosting** | Hostinger (archivos estáticos) |

---

## Arquitectura

```
 Navegador (cliente)            Navegador (equipo)
 Web app view/                  Admin view/
        │                              │
        └──────── supabase-js ─────────┘
                       │
              ┌────────▼─────────┐
              │     Supabase     │
              │  Auth · Storage  │
              │    PostgreSQL    │
              │  Funciones RPC   │
              └──────────────────┘
```

- **Sin servidor propio.** La lógica del negocio vive en funciones de PostgreSQL; el navegador muestra los datos y llama a esas funciones.
- **Los montos los calcula la base de datos.** Lo que muestra la web antes de confirmar una orden es una vista previa.
- **Los datos del negocio vienen de la base de datos** (contacto, horario, estadísticas, textos legales, cuentas de pago) y se editan desde el panel → Configuración.
- **Frontend sin framework:** HTML + CSS + JavaScript, separado por responsabilidad. Para producción, `deploy/build.py` une todo en un archivo CSS y uno JS por app.

## Estructura del repositorio

```
TRAMITA/
├── Web app view/      Web pública para clientes         (ver su README)
├── Admin view/        Panel administrativo del equipo   (ver su README)
├── supabase/
│   ├── migrations/    Cambios de la base de datos, en orden
│   └── functions/     Edge Function: correo al aprobar un pago
└── deploy/
    ├── build.py       Genera dist/public_html para subir a Hostinger
    ├── web.htaccess   Reglas del servidor para la web
    └── admin.htaccess Reglas del servidor para el panel
```

`dist/` se genera con el build y no se versiona.

## Desarrollo local

Requisito: Python 3.

```bash
# Web pública → http://localhost:8000/tramita-app-v2.html
cd "Web app view" && python -m http.server 8000

# Panel → http://localhost:8001/tramita-admin.html
cd "Admin view" && python -m http.server 8001
```

Las dos apps se conectan al proyecto de Supabase configurado en `js/core/config.js` con la *publishable key*, que está hecha para usarse en el navegador.

> ⚠️ Nunca agregar al repositorio la *secret key* / *service_role* ni claves de terceros. Esas van en **Supabase → Edge Functions → Secrets**.

## Publicar en Hostinger

```bash
python deploy/build.py
```

Luego arrastrar el **contenido** de `dist/public_html/` al `public_html/` del Administrador de archivos de hPanel. Pasos completos en [`deploy/README.md`](deploy/README.md).

## Base de datos

Las migraciones están en [`supabase/migrations`](supabase/migrations) y se ejecutan en orden en **Supabase → SQL Editor**. Instrucciones y estado en [`supabase/README.md`](supabase/README.md).

## Roles

| Rol | Acceso |
|---|---|
| `cliente` | Web pública: compras, comprobantes, su cuenta y puntos |
| `consulta` | Panel en modo solo lectura |
| `operador` | Aprobar/rechazar comprobantes, cambiar estados y notas de órdenes |
| `admin` | Todo lo anterior + usuarios, catálogo, cuentas bancarias, cupones y configuración |

## Convenciones

- Todo dato que se inserta como HTML pasa por `esc()`; las URLs externas por `safeUrl()`.
- Las acciones del panel usan las funciones `admin_*` de la base de datos.
- Toda migración es idempotente (se puede ejecutar dos veces sin efectos).

## Próximos pasos

- Dominio propio y panel en un subdominio.
- Pasarela de pago y factura electrónica.
