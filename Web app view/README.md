# Tramitá — Web app (cliente)

Entrada: `tramita-app-v2.html` (solo el HTML de las pantallas). Estilos y lógica están separados por responsabilidad.

## Estructura

```
Web app view/
├── tramita-app-v2.html     Estructura HTML de todas las pantallas (.page)
├── css/                    Se cargan en este orden (importa para la cascada)
│   ├── base.css            Variables (:root), reset, tipografía
│   ├── nav.css             Barra superior, menú móvil, menú de usuario
│   ├── buttons.css         Botones
│   ├── layout.css          Contenedores
│   ├── home.css            Hero, secciones, tarjetas de servicio, cómo funciona, beneficios, CTA
│   ├── service-detail.css  Detalle de servicio
│   ├── forms.css           Formularios
│   ├── checkout.css        Carrito, checkout, métodos de pago, cupón, comprobante, confirmación
│   ├── orders.css          Mis compras
│   ├── footer.css          Footer y botón flotante de WhatsApp
│   ├── feedback.css        Toast y loaders
│   └── responsive.css      Media queries (siempre de último)
└── js/                     Scripts clásicos (no módulos), cargados en este orden
    ├── core/config.js      URL y key de Supabase, cliente `sb`
    ├── core/state.js       Estado global (usuario, perfil, carrito, cupón, orden actual…)
    ├── utils/helpers.js    $, $$, fmt, saveCart, toast, openWA
    ├── ui/header.js        Badge del carrito, UI según sesión, menú de usuario
    ├── core/router.js      go(page), menú móvil, efecto scroll del nav
    ├── core/data-loader.js Carga de settings, categorías, servicios y cuentas de pago
    ├── features/catalog.js Iconos, tarjetas, filtros, detalle, agregar al carrito
    ├── features/cart.js    Carrito
    ├── features/auth.js    Sesión, login, registro, logout
    ├── features/account.js Mi cuenta
    ├── features/checkout.js   Checkout: datos, puntos disponibles, métodos de pago
    ├── features/pricing.js    Cupón, puntos, cálculo de totales y resumen
    ├── features/order-create.js Crear orden + items, pantalla de confirmación
    ├── features/receipts.js   Subida de comprobante
    ├── features/orders.js     Mis compras: estados, banners, reanudar subida
    └── app.js              init(): arranque y listener de cambios de sesión (siempre de último)
```

## Reglas para mantenerlo

- Los scripts son **clásicos** a propósito: el HTML usa `onclick="go(...)"` y similares, que necesitan funciones globales. No convertir a `type="module"` sin migrar esos handlers.
- El orden de `<script>` importa: `config` → `state` → resto → `app.js` al final.
- Abrir con un servidor local (`python -m http.server`) o directamente con doble clic; ambos funcionan.
