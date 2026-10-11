# Supabase — base de datos de Tramitá

## Estructura

| Carpeta / archivo | Qué es |
|---|---|
| `baseline/20261011_00_esquema_produccion.sql` | Snapshot del esquema de producción **antes** de las migraciones del 11/10/2026 (respaldo y documentación; no ejecutar sobre producción) |
| `migrations/` | Cambios versionados, en orden de fecha. Todos son idempotentes (se pueden ejecutar dos veces) |
| `tests/` | Pruebas automáticas de las migraciones sobre un Postgres local (PGlite) |
| `functions/notify-payment-approved/` | Edge Function opcional: correo al cliente cuando se aprueba su pago |
| `diagnostico_esquema.sql` | Consulta de solo lectura para exportar el esquema actual (para nuevas migraciones) |

## Migraciones

| Archivo | Estado | Qué hace |
|---|---|---|
| `20261010_settings_publicos.sql` | ✅ ejecutada | Datos del negocio en `settings` y lectura pública de claves no sensibles |
| `20261011_01_emergencia_permisos_admin.sql` | ✅ ejecutada | Quita a los visitantes sin sesión el permiso de ejecutar `admin_*` |
| `20261011_02_permisos_equipo.sql` | ✅ ejecutada | `staff_profile()` y `current_user_role()` nuevos; corrige la validación de 10 funciones `admin_*` |
| `20261011_03_perfiles_y_usuarios.sql` | ✅ ejecutada | Columnas protegidas del perfil, registro completo, `admin_create_user` con identity, mínimo 8 caracteres |
| `20261011_04_ordenes_pagos_puntos.sql` | ✅ ejecutada | `create_order`, `validate_coupon`, aprobar/rechazar/cancelar, comprobantes y Storage |
| `20261011_05_busqueda_y_dashboard.sql` | ✅ ejecutada | Búsqueda paginada y dashboard en hora de Costa Rica |
| `20261011_06_registro_errores.sql` | ✅ ejecutada | Tabla `client_errors` y `log_client_error()` |
| `20261011_07_contenido_e_imagenes.sql` | ✅ ejecutada | Privacidad, términos, promesas, imágenes de servicios, limpieza de claves viejas |
| `20261011_08_imagenes_servicios_lectura.sql` | ⏳ | Corrige la subida de imágenes de servicios (faltaba el permiso de lectura) |

### Cómo ejecutarlas

1. Supabase → **SQL Editor** → **New query**.
2. Pegar el contenido de cada archivo **pendiente (⏳), en orden de fecha** y presionar **Run**.
3. Al terminar, cambiar su estado a ✅ en esta tabla.

Si una falla, nada de ese archivo queda aplicado (cada uno corre en una transacción). Copie el mensaje de error y no siga con las demás.

## Pruebas

```bash
cd supabase/tests
npm install
npm test
```

Carga `baseline/` en un Postgres local que imita Supabase (roles `anon`/`authenticated`, `auth.uid()`, Storage), ejecuta todas las migraciones dos veces y verifica todos los casos: ataques que deben fallar (crear admins sin sesión, editarse los puntos, leer comprobantes ajenos, precios manipulados…) y los flujos del negocio (crear orden, cupones, aprobar, cancelar, búsqueda).

**Regla:** toda migración nueva se agrega a `tests/test_migrations.mjs` antes de ejecutarla en producción.

## Pendientes que requieren al dueño del proyecto

- **Authentication → URL Configuration**: Site URL y Redirect URLs con el dominio publicado (sin esto los enlaces de confirmación y de recuperar contraseña no abren).
- **Authentication → Sign In / Providers → Email**: contraseña mínima de 8 caracteres (el código ya la exige; esto la exige también en el servidor de Auth).
- **Edge Function de correo** (opcional): ver instrucciones en `functions/notify-payment-approved/index.ts`.
