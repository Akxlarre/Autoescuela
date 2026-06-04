# Investigación externa — Mejores prácticas de "Settings" (Perfil + Configuración)

> Deep search de patrones de industria (SaaS multi-tenant / ERP) para fundamentar el diseño de
> Ajustes del Sistema. Destilado y mapeado al contexto del proyecto (Angular + Supabase, multi-sede, multi-rol).
> **Fecha:** 2026-06-01.

---

## 1. Separación Perfil vs Account vs Settings (UX)

Hallazgo consistente en la industria: son **tres conceptos distintos** y mezclarlos genera fricción.

- **Profile** → información *sobre* la persona (nombre, foto, datos visibles). Orientado a identidad.
- **Account** → credenciales y seguridad (usuario, contraseña, email, sesiones).
- **Settings** → preferencias y configuración del comportamiento del sistema.

Ejemplos citados:
- **Spotify** separa perfil público de los settings de usuario (distintos usuarios, distintas intenciones).
- **Twitter/X** abre un *drawer* desde el icono de cuenta que separa "Account" de "Settings & privacy".

**Mapeo a nuestro proyecto:**
- **Mi Cuenta (drawer)** fusiona *Profile + Account* a nivel de usuario (correcto para una herramienta interna: el "perfil público" no aplica). → datos propios, clave, avatar, preferencias.
- **Configuración del Sistema (página)** es el *Settings* a nivel de organización/sede, exclusivo de admin.
- La decisión del grill (drawer para perfil, página para config) **coincide con el patrón de industria**: lo frecuente y personal va en un acceso rápido; lo extenso y administrativo va en página con categorías.

### Reglas de UX aplicables
- **Agrupar en categorías** y, si hay muchas, separar en subpáginas para reducir carga cognitiva → justifica las secciones (Finanzas, Académico, Matrícula, Alertas, Integraciones).
- **Traer al frente lo más usado** → en el drawer de Mi Cuenta, cambio de tema y clave arriba.
- **Etiquetado claro + ubicación intuitiva** → acceso desde el avatar (ya existe).

---

## 2. Almacenamiento: Key-Value + JSONB vs columnas tipadas

Hallazgos sobre persistencia de configuración en PostgreSQL multi-tenant:

| Enfoque | Pros | Contras |
|---|---|---|
| **Columnas tipadas** (1 columna por setting) | Validación nativa, queries simples, FK | Migración por cada parámetro nuevo → proliferación de esquema |
| **JSONB key-value** | Flexible, sin migraciones por parámetro | Validación en aplicación, queries algo menos directas |
| **EAV puro** (entity-attribute-value) | Muy flexible | **Rendimiento de query sufre**; desaconsejado |

**Recomendación de industria 2025:** **JSONB** ofrece flexibilidad sin proliferación de esquema; EAV funciona pero penaliza performance.

**Decisión para el proyecto:** key-value con `value jsonb` + columna `data_type` para validar en el `SettingsFacade` (Functional Core).
La cantidad de settings es baja y se lee poco frecuentemente (cacheable con SWR) → el costo de JSONB es irrelevante y ganamos no migrar por cada parámetro.

---

## 3. Aislamiento multi-tenant (multi-sede) con RLS

- El estándar 2025 es **Shared Database, Shared Schema (Pool model)** con una columna de tenant + **Row Level Security (RLS)** que fuerza el aislamiento en la capa de BD, en lugar de `WHERE tenant_id` manual en cada query.
- RLS reduce el riesgo de fuga de datos por error humano.

**Mapeo:** el proyecto ya usa exactamente este modelo (`branch_id` + RLS en todas las tablas). `school_settings` debe seguirlo:
- `branch_id` nullable (`NULL` = global), RLS espejo de `alert_config` (Admin CRUD / Sec R).
- Resolución de valor **en cascada**: `sede → global → default-en-código`. Esto da overrides por sede sin duplicar todos los settings en cada sede.

---

## 4. Patrones de seguridad para configuración sensible

- **Secretos NUNCA en la tabla de settings.** Credenciales de Webpay/correo viven en env vars de Edge Functions (server-side). En `school_settings` solo flags no sensibles (ej. `payment_mode = 'test' | 'production'`, remitente de correo).
- **Auditoría de cambios.** Toda mutación de configuración sensible debe quedar en `audit_log` (el proyecto ya tiene el patrón vía `AuditoriaFacade`).
- **Parámetros regulatorios protegidos.** Valores normativos (MTT: nota 75, escala 10–100, 7 módulos, HVC 30 días) → flag `is_regulatory` + UI de solo-lectura o edición con fricción reforzada.

---

## 5. Síntesis — Principios de diseño para nuestro "Ajustes del Sistema"

1. **Dos productos, no uno.** Mi Cuenta (drawer, todos) ≠ Configuración (página, admin).
2. **Backbone antes que UI.** `school_settings` + `SettingsFacade` + `resolveSetting()` puro y testeado primero.
3. **JSONB key-value** con `data_type` y `category`; validación en el facade.
4. **Cascada de resolución** `sede → global → default`; RLS espejo de `alert_config`.
5. **Secretos fuera**, flags dentro; **auditar** cambios sensibles.
6. **Regulatorios protegidos** (no inputs libres).
7. **Enlazar catálogos existentes** (cursos, servicios, descuentos, config-web), no duplicarlos.
8. **UX por categorías**, lo frecuente al frente.

---

## Fuentes

Arquitectura multi-tenant y almacenamiento:
- [The developer's guide to SaaS multi-tenant architecture — WorkOS](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- [SaaS Design: Multi-tenant Architecture Design Patterns (2025 Edition) — Zenn](https://zenn.dev/shineos/articles/saas-multi-tenant-architecture-2025?locale=en)
- [Multi-Tenant Database Architecture Patterns Explained — Bytebase](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/)
- [Multi-Tenant Architecture: The Complete Guide — bix-tech](https://bix-tech.com/multi-tenant-architecture-the-complete-guide-for-modern-saas-and-analytics-platforms-2/)

UX de Profile / Account / Settings:
- [Designing profile, account, and setting pages for better UX — Medium/Vosidiy](https://medium.com/design-bootcamp/designing-profile-account-and-setting-pages-for-better-ux-345ef4ca1490)
- [How to Improve App Settings UX — Toptal](https://www.toptal.com/designers/ux/settings-ux)
- [#FeatureCrushFriday: Account, Profile, and Settings — Medium/Versett](https://medium.com/curated-by-versett/featurecrushfriday-account-profile-and-settings-8f4dd5dbf863)
- [Account settings Page Design Examples — Nicelydone](https://nicelydone.club/pages/account-settings)
