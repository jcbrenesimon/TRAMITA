# Supabase — base de datos de Tramitá

## Estructura

| Carpeta / archivo | Qué es |
|---|---|
| `migrations/` | Cambios versionados, en orden de fecha. Todos son idempotentes (se pueden ejecutar dos veces) |
| `functions/notify-payment-approved/` | Edge Function opcional: correo al cliente cuando se aprueba su pago |

## Migraciones

| Archivo | Estado | Qué hace |
|---|---|---|
| `20261010_settings_publicos.sql` | ✅ ejecutada | Datos del negocio en `settings` y lectura pública de claves no sensibles |
| `20261011_01_emergencia_permisos_admin.sql` | ✅ ejecutada | Permisos de ejecución de las funciones `admin_*` |
| `20261011_02_permisos_equipo.sql` | ✅ ejecutada | `staff_profile()` y `current_user_role()` |
| `20261011_03_perfiles_y_usuarios.sql` | ✅ ejecutada | Perfiles, registro y usuarios del equipo |
| `20261011_04_ordenes_pagos_puntos.sql` | ✅ ejecutada | `create_order`, `validate_coupon`, aprobar/rechazar/cancelar, comprobantes y Storage |
| `20261011_05_busqueda_y_dashboard.sql` | ✅ ejecutada | Búsqueda paginada y dashboard en hora de Costa Rica |
| `20261011_06_registro_errores.sql` | ✅ ejecutada | Tabla `client_errors` y `log_client_error()` |
| `20261011_07_contenido_e_imagenes.sql` | ✅ ejecutada | Privacidad, términos, promesas, imágenes de servicios, limpieza de claves viejas |
| `20261011_08_imagenes_servicios_lectura.sql` | ✅ ejecutada | Lectura pública de imágenes de servicios |

### Cómo ejecutarlas

1. Supabase → **SQL Editor** → **New query**.
2. Pegar el contenido de cada archivo **pendiente (⏳), en orden de fecha** y presionar **Run**.
3. Al terminar, cambiar su estado a ✅ en esta tabla.

Si una falla, nada de ese archivo queda aplicado (cada uno corre en una transacción). Copie el mensaje de error y no siga con las demás.
