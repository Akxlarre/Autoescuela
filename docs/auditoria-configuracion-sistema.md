# Auditoría — Configuración del Sistema y Perfil

> **Propósito.** Inventariar todo lo que hoy es configurable (o debería serlo) en el proyecto,
> para alimentar el spec de **Ajustes del Sistema + Mi Cuenta**.
> **Fecha:** 2026-06-01 · **Método:** barrido de `core/facades`, `core/utils`, `supabase/functions`, índices.
> **Decisiones del grill que enmarcan esta auditoría:**
> 1. Separar **Mi Cuenta** (drawer, todos los roles) de **Configuración del Sistema** (página `/app/admin/configuracion`, solo admin).
> 2. Introducir tabla **`school_settings` branch-scoped** (`branch_id` nullable = global) + `SettingsFacade`.
> 3. Alcance v1 = los 4 dominios (Perfil, Parámetros de negocio, Sedes y alertas, Integraciones y catálogos).

---

## 0. Estado actual (lo que YA existe — no reinventar)

| Pieza | Ubicación | Qué cubre hoy | Limitación |
|---|---|---|---|
| `AjustesDrawerComponent` | `shared/components/ajustes-drawer/` | Drawer con tabs *Mi Perfil* / *Ajustes* / *Seguridad* | Perfil es **solo lectura** + cambio de clave; "Ajustes" solo tiene tema, link a config-web y switcher de sede; "Seguridad" es solo un link a auditoría |
| `UserPanelComponent` | `shared/components/user-panel/` | Menú del avatar: `profile` \| `settings` + logout | — |
| `topbar.onUserAction()` | `layout/topbar.component.ts:279` | Abre el drawer | **Bug:** ignora el argumento; *Mi perfil* y *Ajustes* abren el mismo drawer/tab |
| `ThemeService` | `core/services/ui/theme.service.ts` | claro/oscuro/system, persiste en localStorage | Preferencia local, no por usuario en BD |
| `BranchFacade` | `core/facades/branch.facade.ts` | Sede activa (admin) | — |
| `WebsiteConfigFacade` | `core/facades/website-config.facade.ts` | Landing en caliente, precios editoriales | Ya es "configuración"; debe **enlazarse**, no duplicarse |
| `AuditoriaFacade` + `audit_log` | `core/facades/auditoria.facade.ts` | Log de operaciones de secretarias | Patrón a reutilizar para auditar cambios de config |
| **`alert_config`** (tabla) | DATABASE.md:18 — `branch_id`, Admin CRUD / Sec R | **Único configurable persistido hoy** | Es el patrón de referencia para `school_settings` |

**Conclusión:** existe el *cascarón* (drawer + menú) pero **no** la capa de persistencia de configuración. El 70% del trabajo es backend (tabla + facade), no UI.

---

## 1. Dominio A — Mi Cuenta / Perfil (por usuario, todos los roles)

Campos disponibles en el DTO `users` (`core/models/dto/user.model.ts`):

| Campo | Editable por el propio usuario | Notas |
|---|---|---|
| `first_names`, `paternal_last_name`, `maternal_last_name` | ⚠️ Depende de política | Cambiar el nombre puede afectar certificados/contratos ya emitidos |
| `email` | ⚠️ Requiere re-auth | Cambiar email implica `auth.admin.updateUserById` (ver patrón en `update-secretary`) |
| `phone` | ✅ Sí | Bajo riesgo |
| `rut` | ❌ No | Identificador de negocio |
| `role_id`, `branch_id`, `can_access_both_branches`, `active` | ❌ No | Solo admin vía gestión de usuarios |
| Contraseña | ✅ Sí | Ya implementado (`AuthFacade.updatePassword`) |
| Avatar | ✅ Sí (a implementar) | `currentUser().avatarUrl` ya se consume en UI pero **no hay upload**; falta columna/bucket |
| Preferencias UI (tema, notificaciones) | ✅ Sí | Hoy el tema vive en localStorage; evaluar persistir por usuario |

**Gaps de Perfil:**
- No hay edición de datos propios (solo lectura + clave).
- No hay upload de avatar (ni columna `avatar_url` en `users`, ni bucket dedicado verificado).
- Preferencias no persisten por usuario (se pierden entre dispositivos).

---

## 2. Dominio B — Parámetros de negocio (magic numbers a externalizar)

Constantes hardcodeadas detectadas en el código. **Scope sugerido** indica si el valor debería ser global o por sede en `school_settings`.

| Parámetro | Valor actual | Ubicación | Scope sugerido | Riesgo |
|---|---|---|---|---|
| Fondo inicial de caja | `50.000` | `cuadratura.facade.ts:58`, `historial-cuadraturas.facade.ts:31` | **Por sede** | Bajo |
| Tarifa hora instructor (default) | `5.000` | `liquidaciones.facade.ts:15` (`AMOUNT_PER_HOUR_DEFAULT`) | **Por sede** (override por instructor en `instructor_monthly_payments`) | Medio (afecta nómina) |
| % asistencia teórica mínima | `75` | `certificacion-profesional.facade.ts:18`, `archivo-profesional.facade.ts:16`, `admin-alumno-detalle.facade.ts:40` | **Global** ⚠️ regulatorio | Alto |
| Nota mínima aprobación | `75` | `professional-modules.ts:13` (`GRADE_PASS`), `certificacion-profesional.facade.ts:20`, `libro-de-clases.facade.ts:469` | **Global** ⚠️ regulatorio (MTT) | Alto |
| Escala de notas | `10`–`100` | `professional-modules.ts` (`GRADE_MIN`/`GRADE_MAX`) | **Global** ⚠️ regulatorio | Alto |
| N° de módulos profesional | `7` | `professional-modules.ts` (`MODULE_COUNT`) | **Global** ⚠️ regulatorio | Alto |
| Antigüedad máxima HVC | `30 días` | `enrollment-documents.facade.ts` (RF-082.3) | **Global** ⚠️ regulatorio | Alto |
| Depósito matrícula parcial | `50%` (`base_price/2`) | `enrollment-payment.facade.ts`, edge `public-enrollment` | **Por sede o por curso** | Medio |
| Sesiones prácticas Clase B | `6` (parcial) / `12` (total) | `enrollment.facade.ts` (derivado de `practical_hours`) | **Por curso** (ya parametrizado vía `courses`) | Bajo |
| Duración clase práctica | `0.75 h` (45 min) | `instructor-horas.facade.ts:211` | **Global** | Medio |
| TTL hold de slots | `20 min` | edge `public-enrollment`, `student-payment` | **Global** (técnico) | Bajo |
| Polling de grilla | `15 s` | `public-enrollment.facade.ts:1255` | **Global** (técnico) | Bajo |
| Timeout `whenReady` auth | `5000 ms` | `auth.facade.ts:37` | **No exponer** (interno) | — |

> **⚠️ Regulatorios (MTT).** Los valores marcados (`75`, escala `10–100`, `7` módulos, HVC `30 días`) derivan de normativa chilena.
> Recomendación: persistirlos en `school_settings` con un flag **`is_regulatory = true`** y mostrarlos en la UI como **solo-lectura o protegidos**
> (editables solo con confirmación reforzada + auditoría), no como un input libre. Externalizarlos da trazabilidad sin invitar a romper la norma.

---

## 3. Dominio C — Sedes y alertas

| Recurso | Tabla / Facade | Configurable | Acción propuesta |
|---|---|---|---|
| Sedes | `branches` (`id`, `slug`, `has_professional`) + `BranchFacade` | Nombre, slug, `has_professional` | CRUD de sedes en Configuración (hoy no hay UI de gestión de sedes) |
| Umbrales de vencimiento | **`alert_config`** (`alert_type`, `branch_id`) — Admin CRUD / Sec R | Días-antes por tipo de documento | UI dedicada (hoy es tabla sin pantalla de edición verificada) |
| Roles | `roles` (`id`, `name`) | Catálogo de roles | Solo lectura (riesgo alto editar) |

---

## 4. Dominio D — Integraciones y catálogos

### 4a. Integraciones (configuración sensible — viven en env vars de Edge Functions)

| Integración | Dónde | Configurable hoy | Nota de seguridad |
|---|---|---|---|
| Webpay Plus / Transbank | edges `public-enrollment`, `student-payment` | Commerce code / API key vía env; tarjetas de prueba hardcodeadas | **NUNCA** exponer secretos en la tabla `school_settings`; solo flags no sensibles (ej. modo test/producción) |
| Correo (certificados / Zoom) | `send-certificate-email`, `send-zoom-email` | Proveedor vía env | Remitente y plantillas podrían ser configurables; credenciales no |
| API de feriados | `apis.digital.gob.cl/fl/feriados` en `promociones.facade.ts` | URL hardcodeada, falla silenciosa | Configurable (endpoint + toggle) |
| Supabase Storage | buckets `documents`, `public-uploads` | Paths hardcodeados | No exponer |

### 4b. Catálogos existentes (ENLAZAR, no duplicar)

Estos ya tienen su propio facade y pantalla. Configuración debe **linkear** a ellos:

| Catálogo | Facade | Pantalla |
|---|---|---|
| Cursos | `CoursesFacade` | (operacional) |
| Servicios especiales | `ServiciosEspecialesFacade` | `/app/*/servicios-especiales` |
| Descuentos | `EnrollmentPaymentFacade` (tabla `discounts`) | — (gap: no hay CRUD dedicado) |
| Config web / landing | `WebsiteConfigFacade` | `/app/*/configuracion-web` |

---

## 5. Modelo de persistencia propuesto — `school_settings`

Alineado con la decisión del grill (branch-scoped) y el patrón de `alert_config`.

```sql
-- Esquema propuesto (a refinar en el spec)
create table public.school_settings (
  id            bigint generated always as identity primary key,
  branch_id     bigint references public.branches(id),   -- NULL = valor global
  category      text not null,        -- 'finanzas' | 'academico' | 'matricula' | 'alertas' | 'integraciones'
  key           text not null,        -- ej. 'cash_initial_fund', 'instructor_hour_rate'
  value         jsonb not null,       -- valor tipado (número, string, bool, objeto)
  data_type     text not null,        -- 'number' | 'string' | 'boolean' | 'percent' | 'days'
  is_regulatory boolean not null default false,  -- protegido (MTT)
  updated_by    bigint references public.users(id),
  updated_at    timestamptz not null default now(),
  unique (branch_id, key)
);
-- RLS: Admin CRUD, Secretaria R (espejo de alert_config)
-- Resolución de valor: COALESCE(valor de la sede, valor global, default en código)
```

**Patrón de lectura (Functional Core):** un helper puro `resolveSetting(key, branchId, rows, fallback)` que aplica
`sede → global → default-en-código`. Los facades de negocio (`CuadraturaFacade`, `LiquidacionesFacade`, etc.)
consumen `SettingsFacade` en lugar de sus constantes locales.

> **JSONB vs columnas tipadas:** ver `docs/research/settings-best-practices.md`. Se elige **key-value + JSONB**
> por flexibilidad (evita migraciones por cada nuevo parámetro), con `data_type` para validación en el facade.

---

## 6. Matriz de permisos propuesta

| Sección | Admin | Secretaria | Instructor / Alumno / Relator |
|---|---|---|---|
| Mi Cuenta (perfil propio) | ✅ | ✅ | ✅ |
| Config — Parámetros de negocio | ✅ CRUD | 👁️ Lectura | ❌ |
| Config — Regulatorios (MTT) | ✅ CRUD protegido + auditoría | 👁️ Lectura | ❌ |
| Config — Sedes | ✅ CRUD | ❌ | ❌ |
| Config — Alertas (`alert_config`) | ✅ CRUD | 👁️ Lectura | ❌ |
| Config — Integraciones | ✅ (flags no sensibles) | ❌ | ❌ |

Todo cambio en Configuración debe registrarse en `audit_log` (reutilizar patrón existente).

---

## 7. Gaps y decisiones pendientes para el spec

1. **Avatar:** ¿columna `avatar_url` en `users` + bucket nuevo, o reutilizar `documents`?
2. **Persistir tema por usuario** en BD vs mantener solo localStorage.
3. **Edición de nombre/email propio:** ¿se permite o queda bloqueado por integridad de certificados/contratos?
4. **Regulatorios:** ¿editables-con-fricción o estrictamente solo-lectura en v1?
5. **Depósito 50%:** ¿scope por sede o por curso?
6. **Catálogo de descuentos:** hoy no tiene CRUD dedicado — ¿entra en Configuración v1 o queda fuera?
7. **Resolución de settings:** confirmar cascada `sede → global → default`.

---

## 8. Recomendación de secuencia (para el plan)

1. Backbone primero: migración `school_settings` + RLS + `SettingsFacade` + helper puro `resolveSetting` (con tests).
2. Refactor incremental: migrar `CuadraturaFacade` y `LiquidacionesFacade` a leer de `SettingsFacade` (pilotos de bajo riesgo).
3. UI Configuración: página `/app/admin/configuracion` con secciones por categoría.
4. UI Mi Cuenta: enriquecer el drawer (edición de datos, avatar, preferencias) y **arreglar el bug** de `onUserAction`.
5. Integraciones y catálogos: enlaces + flags no sensibles (último, menor riesgo/valor en v1).
