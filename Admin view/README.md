# Tramitá — Panel administrativo

Entrada: `tramita-admin.html` (solo el HTML: login, acceso restringido y el shell del panel). Estilos y lógica están separados por responsabilidad.

## Estructura

```
Admin view/
├── tramita-admin.html        Login, acceso restringido, sidebar, topbar, contenedor de vistas
├── css/                      Se cargan en este orden (importa para la cascada)
│   ├── base.css              Variables (:root), reset, tipografía
│   ├── login.css             Pantalla de ingreso
│   ├── layout.css            Sidebar, topbar, contenido, menú móvil
│   ├── buttons.css           Botones
│   ├── dashboard.css         Tarjetas KPI
│   ├── components.css        Encabezado de sección, tablas, badges, filtros, estados vacíos
│   ├── modal.css             Ventanas modales
│   ├── forms.css             Formularios
│   ├── order-detail.css      Detalle de orden y comprobante
│   ├── feedback.css          Loading y toast
│   └── access-denied.css     Pantalla "Acceso restringido"
└── js/                       Scripts clásicos (no módulos), cargados en este orden
    ├── core/config.js        URL y key de Supabase, cliente `sb`
    ├── core/state.js         Estado global (usuario, vista actual, filtros)
    ├── utils/helpers.js      $, $$, fmt, fmtDate, fmtDateTime, fmtDateOnly, toast, getInitials
    ├── features/auth.js      checkSession, login/denied/app, doLogin, doLogout
    ├── core/router.js        go(view), sidebar, título, buscador global
    ├── features/dashboard.js KPIs, "Requieren su atención", actividad reciente
    ├── utils/time.js         timeAgo
    ├── core/labels.js        ORDER_LABELS, PAY_LABELS, RECEIPT_LABELS, ROLE_LABELS
    ├── features/receipts.js        Lista y filtros de comprobantes
    ├── features/receipt-review.js  Ver, aprobar y rechazar comprobante
    ├── features/orders.js          Lista, filtros y búsqueda de órdenes
    ├── features/order-detail.js    Detalle, cambio de estado, notas de bitácora
    ├── utils/whatsapp.js           openWA(phone, message)
    ├── features/users.js           Lista, filtros y creación de usuarios
    ├── features/user-detail.js     Ficha del usuario y edición
    ├── features/user-actions.js    Resetear contraseña, activar/desactivar, eliminar, rol, puntos
    ├── features/services.js        CRUD de servicios
    ├── features/categories.js      CRUD de categorías
    ├── features/payment-accounts.js CRUD de cuentas bancarias
    ├── features/coupons.js         CRUD de cupones
    ├── features/settings.js        Configuración del negocio y programa de puntos
    ├── ui/modal.js                 showModal, closeModal, closeModalBackdrop
    └── app.js                init(): arranque y auto-refresh del dashboard (siempre de último)
```

## Reglas para mantenerlo

- Los scripts son **clásicos** a propósito: el HTML generado usa `onclick="openOrderModal(...)"` y similares, que necesitan funciones globales. No convertir a `type="module"` sin migrar esos handlers.
- El orden de `<script>` importa: `config` → `state` → resto → `app.js` al final.
- Para probar en local: `python -m http.server` dentro de esta carpeta.
