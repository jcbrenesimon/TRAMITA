# Tramitá — Web app (cliente)

Entrada: `tramita-app-v2.html` (el HTML de todas las pantallas). Estilos y lógica están separados por responsabilidad. En producción `deploy/build.py` los une en `app.<hash>.css` y `app.<hash>.js`.

## Rutas (URL real de cada pantalla)

`#/` inicio · `#/servicios` · `#/servicios/<slug>` · `#/carrito` · `#/pago` · `#/confirmacion` · `#/ingresar` · `#/registro` · `#/recuperar` · `#/nueva-contrasena` · `#/cuenta` · `#/compras` · `#/contacto` · `#/privacidad` · `#/terminos`

## Estructura

```
Web app view/
├── tramita-app-v2.html     Pantallas (.page), SEO y accesibilidad
├── favicon.svg, robots.txt
├── css/                    Se cargan en este orden (importa para la cascada)
│   ├── base.css            Variables, reset, accesibilidad, utilidades, reglas de sesión (auth-only/guest-only)
│   ├── nav.css             Barra superior, menú móvil, menú de usuario
│   ├── buttons.css         Botones
│   ├── layout.css          Contenedores y páginas
│   ├── home.css            Inicio, tarjetas de servicio, cómo funciona, beneficios
│   ├── service-detail.css  Detalle de servicio y migas de pan
│   ├── forms.css           Formularios
│   ├── checkout.css        Carrito, checkout, métodos de pago, cupón, comprobante, confirmación
│   ├── orders.css          Mis compras y estados
│   ├── footer.css          Footer y botón flotante de WhatsApp
│   ├── feedback.css        Toast, loaders y avisos
│   ├── legal.css           Privacidad, términos y contacto
│   └── responsive.css      Celular (≤420), tablet (≥640), escritorio (≥900) — siempre de último
└── js/                     Scripts clásicos (no módulos), cargados en este orden
    ├── core/config.js      Supabase (PKCE) y constantes
    ├── core/state.js       Estado global; carrito [{id, qty}]
    ├── utils/helpers.js    $, esc() (escapar HTML), safeUrl, toast, WhatsApp, errores en español
    ├── utils/errors.js     Envía los errores de JS a log_client_error()
    ├── utils/icons.js      Íconos de servicio (car, doc, more o emoji)
    ├── ui/header.js        Badge del carrito, UI según sesión, menús
    ├── core/router.js      Rutas #/…, título de la página y foco accesible
    ├── core/data-loader.js settings, categorías, servicios y cuentas de pago
    ├── features/catalog.js     Tarjetas, filtros y detalle
    ├── features/cart.js        Carrito con cantidades
    ├── features/auth.js        Sesión, login, registro, recuperar/cambiar contraseña
    ├── features/account.js     Mi cuenta
    ├── features/checkout.js    Datos y métodos de pago
    ├── features/pricing.js     Cupón (validate_coupon), puntos y vista previa del total
    ├── features/order-create.js create_order() y confirmación
    ├── features/receipts.js    Subida del comprobante (clic o arrastrar)
    ├── features/orders.js      Mis compras
    ├── features/legal.js       Privacidad y términos desde settings
    └── app.js              Arranque (siempre de último)
```

## Reglas para mantenerlo

- **Todo dato de la base de datos o del usuario que entre a `innerHTML` pasa por `esc()`.** URLs externas por `safeUrl()`.
- Montos, cupones y puntos los calcula la base de datos (`create_order`, `validate_coupon`). El navegador solo muestra una vista previa.
- Los datos del negocio (contacto, horario, estadísticas, textos legales) vienen de `settings` y se editan en el panel → Configuración.
- Los scripts son clásicos a propósito: el HTML usa `onclick="..."`, que necesita funciones globales.
- Para probar en local: `python -m http.server` dentro de esta carpeta.
