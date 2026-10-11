# Tramitá — Panel administrativo

Entrada: `tramita-admin.html` (login, acceso restringido y el shell del panel). En producción `deploy/build.py` une los estilos y scripts en `app.<hash>.css` y `app.<hash>.js`.

Cada vista vive en la URL (`#dashboard`, `#orders`, `#users`, `#settings`, `#errors`…): recargar no la pierde.

## Seguridad

- Los permisos reales están en la base de datos (`staff_profile()`, RLS); ocultar un botón en el panel es solo comodidad.

## Estructura

```
Admin view/
├── tramita-admin.html
├── favicon.svg
├── css/                      Se cargan en este orden
│   ├── base.css              Variables, reset, accesibilidad, utilidades
│   ├── login.css             Pantalla de ingreso
│   ├── layout.css            Sidebar (cajón en celular), topbar, contenido
│   ├── buttons.css           Botones
│   ├── dashboard.css         Encabezados de vista y KPIs
│   ├── components.css        Tablas, paginación, badges, filtros, búsqueda, estados vacíos
│   ├── modal.css             Modales (pantalla completa en celular)
│   ├── forms.css             Formularios, imagen e ícono de servicio
│   ├── order-detail.css      Detalle de orden, bitácora y comprobantes
│   ├── feedback.css          Loading, toast y avisos
│   ├── access-denied.css     Pantalla "Acceso restringido"
│   └── responsive.css        Tablas → tarjetas (≤760), escritorio (≥1024) — siempre de último
└── js/                       Scripts clásicos (no módulos)
    ├── core/config.js        Supabase y constantes
    ├── core/state.js         Estado global, isAdmin(), canOperate()
    ├── utils/helpers.js      esc(), safeUrl, toast, rpcError, filas clicables accesibles
    ├── utils/errors.js       Envía los errores de JS a log_client_error()
    ├── utils/icons.js        Íconos de servicio (mismas claves que la web)
    ├── utils/time.js         timeAgo
    ├── utils/whatsapp.js     openWA(teléfono, mensaje)
    ├── core/labels.js        Etiquetas de estados, roles, métodos de pago
    ├── ui/modal.js           Modal accesible (Escape, foco)
    ├── ui/table.js           dataTable() responsive y paginación
    ├── features/auth.js      Sesión, roles, login
    ├── core/router.js        Vistas por URL, sidebar, buscador global
    ├── features/dashboard.js       KPIs y actividad
    ├── features/receipts.js        Lista de comprobantes
    ├── features/receipt-review.js  Aprobar / rechazar (+ WhatsApp y correo)
    ├── features/orders.js          Búsqueda paginada (admin_search_orders)
    ├── features/order-detail.js    Detalle, estados, cancelación, bitácora
    ├── features/users.js           Búsqueda paginada (admin_search_users) y creación
    ├── features/user-detail.js     Ficha y edición
    ├── features/user-actions.js    Contraseña, activar, eliminar, rol, puntos
    ├── features/services.js        Servicios, ícono e imagen
    ├── features/categories.js      Categorías
    ├── features/payment-accounts.js Cuentas bancarias
    ├── features/coupons.js         Cupones
    ├── features/settings.js        Datos del negocio, textos legales, puntos
    ├── features/errors.js          Registro de errores de las apps
    └── app.js                Arranque (siempre de último)
```

## Reglas para mantenerlo

- **Todo dato de la base de datos que entre a `innerHTML` pasa por `esc()`.** Títulos de `showModal()` se escapan solos.
- Las acciones usan funciones `admin_*` (nunca `update`/`insert` directo a las tablas: la base de datos lo bloquea).
- Para tablas use `dataTable()`: se convierten en tarjetas en el celular.
- Para probar en local: `python -m http.server` dentro de esta carpeta.
