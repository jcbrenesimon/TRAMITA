# Tramitá

Plataforma web para contratar servicios de tramitología en Costa Rica: recuperación de placas, apostillas, certificaciones y gestiones vehiculares y legales, con precios publicados, pago por SINPE Móvil o transferencia y seguimiento de cada orden.

**Sitio:** https://springgreen-mink-132791.hostingersite.com (dominio temporal de Hostinger)

| | |
|---|---|
| **Web pública** | Catálogo, carrito, checkout, subida de comprobantes, "Mis compras", cuenta, puntos y cupones |
| **Panel administrativo** | Comprobantes, órdenes, usuarios, catálogo, cuentas bancarias, cupones, configuración y registro de errores |
| **Backend** | [Supabase](https://supabase.com): PostgreSQL + Auth + Storage + Row Level Security |
| **Hosting** | Hostinger (archivos estáticos) |

---

## Arquitectura

```
 Navegador (cliente)            Navegador (equipo)
 Web app view/                  Admin view/   ← protegido con contraseña de Hostinger
        │                              │
        └──────── supabase-js ─────────┘   (publishable key: pública por diseño)
                       │
              ┌────────▼─────────┐
              │     Supabase     │
              │  Auth · Storage  │
              │  PostgreSQL+RLS  │
              │  Funciones RPC   │  create_order, validate_coupon, admin_* …
              └──────────────────┘
```

- **Sin servidor propio.** La lógica que maneja dinero y permisos vive en funciones de PostgreSQL (`SECURITY DEFINER`) que validan el rol del usuario. El navegador solo muestra datos y llama a esas funciones.
- **Los montos los calcula la base de datos.** Precios, cupones, puntos y totales se calculan en `create_order()`; lo que muestra la web es una vista previa.
- **Los datos del negocio vienen de la base de datos** (contacto, horario, estadísticas, textos legales, cuentas de pago) y se editan desde el panel → Configuración.
- **Frontend sin framework ni compilación obligatoria:** HTML + CSS + JavaScript clásico, separado por responsabilidad. Para producción, `deploy/build.py` une todo en un archivo CSS y uno JS por app.

## Estructura del repositorio

```
TRAMITA/
├── Web app view/      Web pública para clientes         (ver su README)
├── Admin view/        Panel administrativo del equipo   (ver su README)
├── supabase/
│   ├── migrations/    Cambios de la base de datos, en orden (idempotentes)
│   ├── baseline/      Snapshot del esquema antes de las migraciones de 2026-10-11
│   ├── tests/         Pruebas automáticas de las migraciones (Postgres local)
│   ├── functions/     Edge Function opcional: correo al aprobar un pago
│   └── diagnostico_esquema.sql   Consulta de solo lectura para exportar el esquema
└── deploy/
    ├── build.py       Genera dist/public_html para subir a Hostinger
    ├── web.htaccess   Reglas del servidor para la web (HTTPS, CSP, caché)
    └── admin.htaccess Reglas del servidor para el panel
```

`dist/` se genera con el build y no se versiona.

## Desarrollo local

Requisitos: Python 3 (y Node.js 18+ solo para las pruebas de base de datos).

```bash
# Web pública → http://localhost:8000/tramita-app-v2.html
cd "Web app view" && python -m http.server 8000

# Panel → http://localhost:8001/tramita-admin.html
cd "Admin view" && python -m http.server 8001
```

Las dos apps se conectan al proyecto de Supabase configurado en `js/core/config.js`. Usan la **publishable key**, que está hecha para ir en el navegador; la seguridad la dan las políticas RLS y las funciones de la base de datos.

> ⚠️ Nunca agregar al código la *secret key* / *service_role* ni claves de terceros (Resend, pasarelas de pago). Esas van en **Supabase → Edge Functions → Secrets**.

## Publicar en Hostinger

```bash
python deploy/build.py
```

Luego arrastrar el **contenido** de `dist/public_html/` al `public_html/` del Administrador de archivos de hPanel. Pasos completos (caché, contraseña del panel, dominio propio) en [`deploy/README.md`](deploy/README.md).

## Base de datos

Las migraciones están en [`supabase/migrations`](supabase/migrations) y se ejecutan en orden en **Supabase → SQL Editor**. Su estado y las instrucciones están en [`supabase/README.md`](supabase/README.md).

### Pruebas

```bash
cd supabase/tests
npm install
npm test
```

Levanta un PostgreSQL local (PGlite) que imita Supabase, carga el esquema de producción, aplica todas las migraciones dos veces y verifica **81 casos**: intentos de ataque que deben fallar (crear administradores sin sesión, editarse los puntos, leer comprobantes ajenos, manipular precios, XSS en imágenes) y los flujos del negocio (comprar, cupones, aprobar, cancelar con devolución de puntos, búsqueda, imágenes de servicios).

**Regla:** toda migración nueva se agrega a las pruebas antes de ejecutarla en producción.

## Seguridad

- **Permisos en la base de datos:** RLS en todas las tablas; las funciones `admin_*` solo se ejecutan con sesión y validan el rol (`staff_profile()`); los clientes no pueden escribir órdenes, puntos ni estados directamente.
- **Columnas protegidas:** un cliente puede editar sus datos personales, pero no su rol, puntos ni código de referido.
- **Storage:** cada cliente solo lee y escribe su propia carpeta de comprobantes; las imágenes de servicios son públicas y solo el admin las sube.
- **XSS:** todo dato que se inserta como HTML pasa por `esc()`; las URLs externas por `safeUrl()`.
- **Servidor:** HTTPS obligatorio, Content-Security-Policy, HSTS, protección contra iframes, `supabase-js` con versión fija e integridad SRI, panel con contraseña adicional de Hostinger y sin indexar.
- **Monitoreo:** los errores de JavaScript de las dos apps se registran en `client_errors` y se ven en el panel → Errores.

## Roles

| Rol | Acceso |
|---|---|
| `cliente` | Web pública: compras, comprobantes, su cuenta y puntos |
| `consulta` | Panel en modo solo lectura |
| `operador` | Aprobar/rechazar comprobantes, cambiar estados y notas de órdenes |
| `admin` | Todo lo anterior + usuarios, catálogo, cuentas bancarias, cupones y configuración |

## Pendientes

- Dominio propio (`tramita.cr`) y panel en `admin.tramita.cr`.
- Supabase: URL Configuration (enlaces de confirmación y recuperación de contraseña), contraseña mínima de 8 caracteres en Auth y secretos de la Edge Function de correo.
- Supabase Pro (respaldos) antes de recibir pagos reales.
- Pasarela de pago y factura electrónica de Hacienda.
- Revisión legal de la política de privacidad y los términos (borradores en el panel → Configuración).

---

Desarrollado por AASA Automatización Avanzada, S.A.
