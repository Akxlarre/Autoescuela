# Spec 0003-b — Landing Pages & Panel de Control — Autoescuelas Chillán

> **Status:** approved
> **Created:** 2026-05-21
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Solicitud del equipo junior — Fase 3 de la integración Koa + Landings Chillán.

**Persona afectada:** Admin (multi-sede) y Secretaria (sede asignada); visitantes públicos de autoescuelachillan.cl y conductoreschillan.cl.

**Problema que resuelve:**
Actualmente los precios, promociones y contenido de las landing pages de Autoescuela Chillán (Azul) y Conductores Chillán (Roja) son estáticos y requieren redeploys manuales para actualizarse. Esto genera demoras operativas, riesgo de inconsistencias entre sedes y cero capacidad de reacción ante campañas comerciales. Si no se resuelve, cualquier cambio de precio o promoción implica intervención técnica, ralentizando el negocio.

**Hipótesis de valor:**
Si el Admin o Secretaria puede editar precios, promociones y FAQs desde Koa y estos se reflejan en caliente en las landing pages sin redespliegue, se reducirá el tiempo de actualización de días a segundos.

---

## 2. User Stories

- **US1**: Como Admin, quiero seleccionar entre "Autoescuela Chillán" y "Conductores Chillán" en un selector de sedes y editar su configuración web completa (precios, hero, cursos, FAQs, contacto), para gestionar ambas marcas de forma independiente desde un único panel.
- **US2**: Como Secretaria, quiero acceder a la configuración web de mi sede asignada sin poder ver ni modificar la de la otra sede, para actualizar promociones o precios de forma autónoma y segura.
- **US3**: Como visitante público de autoescuelachillan.cl o conductoreschillan.cl, quiero ver precios y promociones actualizados en tiempo real sin percibir recargas ni CLS, para tomar decisiones de inscripción con información vigente.
- **US4**: Como Admin, quiero que cada guardado en el panel quede registrado en audit_logs con un diff en español (quién, qué, cuándo), para auditar cambios y revertir errores operativos.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un usuario autenticado con rol `admin`, When navega a `/app/admin/configuracion-web`, Then ve un selector de sedes (Autoescuela Azul / Conductores Roja) en la cabecera y el formulario carga la configuración de la sede seleccionada.
- **AC2**: Given un usuario autenticado con rol `secretaria` asignada al `branch_id=2`, When navega a `/app/secretaria/configuracion-web`, Then el selector de sedes NO aparece y el formulario carga únicamente la configuración de `branch_id=2`.
- **AC3**: Given una Secretaria de branch 2, When intenta ejecutar un UPSERT con `branch_id=1` (p. ej. via DevTools), Then Supabase retorna error `42501 insufficient_privilege` y la UI muestra un mensaje de error amigable.
- **AC4**: Given el Admin edita el precio del curso "Clase B" a `$360.000` en Autoescuela Chillán y guarda, When abre `autoescuelachillan.cl` en un navegador fresco, Then el micro-script inline hidrata el precio a `$360.000` en menos de 2 segundos sin recargar la página completa.
- **AC5**: Given el Admin guarda cualquier cambio en `website_config`, Then se crea un registro en `audit_logs` con el `diff` en español, el `user_id` del editor y el timestamp exacto.
- **AC6**: Given el panel de "Gestión de Cursos", When el usuario agrega un curso nuevo y guarda, Then el curso aparece en la landing pública con el estado correcto (nombre, precio, badge "Destacado" si aplica).
- **AC7**: Given el toggle de "Banner Promocional" desactivado, When el Admin lo activa, completa los campos y guarda, Then el banner aparece visible en la landing correspondiente.
- **AC8**: Given el formulario con un campo de precio vacío o inválido, When el usuario intenta guardar, Then el botón "Guardar Cambios" permanece deshabilitado y se muestra un mensaje de validación inline.

### Edge cases obligatorios

- **AC-E1**: Given que `website_config` no tiene fila para `branch_id=X` (primera vez), When el Facade llama `loadConfig(X)`, Then inicializa un JSON vacío estructurado (no null) y el formulario es editable con campos en blanco.
- **AC-E2**: Given un error de red al guardar, When `saveConfig()` falla, Then `isSaving()` vuelve a `false`, `error()` contiene mensaje amigable y el formulario sigue editable sin pérdida de los datos locales.
- **AC-E3**: Given el Admin cambia de sede en el selector, When la nueva sede está cargando, Then `isLoading()` es `true` y el formulario muestra skeleton hasta completar la carga.

---

## 4. Out of scope

- ❌ Modificar el micro-script de hidratación en `webs/src/layouts/LandingLayout.astro` — ya existe y funciona correctamente.
- ❌ Modificar los JSON estáticos `webs/src/content/site/azul.json` y `roja.json` — siguen siendo el fallback build-time.
- ❌ Editor WYSIWYG o preview live de la landing dentro de Koa.
- ❌ Versionado histórico de configuraciones (más allá del registro en `audit_logs`).
- ❌ Gestión de imágenes o assets multimedia (solo URLs externas en campos de texto).
- ❌ Migrar la api key anon hardcodeada en `LandingLayout.astro` a variables de entorno (deuda técnica a atacar en spec separada de seguridad).
- ❌ Integración de pagos o formularios de inscripción en las landing pages.
- ❌ Notificaciones push/email al publicar cambios.
- ❌ Gestión de `testimonials` desde el panel (los testimonios son contenido editorial, no operativo).

---

## 5. Dependencias

### Specs previas
- 0001 (done) y 0002 (done): sistema de tareas multi-rol — independientes, sin bloqueo.

### Capacidades del proyecto que se asumen existentes
- `AuthFacade` con `currentUser()` expuesto vía Signal (incluye `role` y `branchId`).
- `BranchFacade` con `selectedBranchId()` y lista de branches para el selector Admin.
- `SupabaseService` con cliente autenticado y anónimo configurados.
- `ToastService` para feedback de éxito/error.
- `audit_logs` tabla existente en Supabase para registrar eventos.
- Guard `hasRoleGuard` protegiendo rutas por rol.
- Sistema de diseño Bento Grid + GSAP disponible (`GsapAnimationsService.animateBentoGrid()`).
- **[YA EXISTE EN `webs/`]** Micro-script de hidratación en `webs/src/layouts/LandingLayout.astro` — ya hace `fetch` a `website_config` filtrando por `branch_id` y actualiza en DOM: precios (`.price-value`, `.price-note` via `[data-course-index]`), promo (`#promo-banner-container`, `#promo-badge`, `#promo-title`, `#promo-desc`, `#promo-btn`).
- **[YA EXISTE EN `webs/`]** Tipado `SiteData` en `webs/src/lib/types.ts` — es la fuente de verdad del esquema JSONB. Ver sección 6.
- **[YA EXISTE EN `webs/`]** Datos semilla en `webs/src/content/site/azul.json` (Autoescuela Chillán, branch 1) y `roja.json` (Conductores Chillán, branch 2).

### Capacidades nuevas requeridas
- Tabla `website_config` en Supabase (migración SQL nueva con RLS completo) — la tabla NO existe aún; el script en Astro ya la referencia pero falla silenciosamente.
- `WebsiteConfigFacade` (`core/facades/website-config.facade.ts`).
- `AdminConfiguracionWebComponent` (`features/admin/configuracion-web/`).
- Rutas lazy `/app/admin/configuracion-web` y `/app/secretaria/configuracion-web`.
- Modelo DTO `WebsiteConfig` en `core/models/dto/website-config.model.ts` (importar/espejo del tipo de `webs/src/lib/types.ts`).

---

## 6. Datos y modelo (preliminar)

**Tablas nuevas / modificadas:**
- `website_config` (nueva):
  - `id` BIGSERIAL PK
  - `branch_id` SMALLINT UNIQUE NOT NULL (1=Azul, 2=Roja)
  - `config` JSONB NOT NULL (estructura `SiteData` completa — ver abajo)
  - `updated_at` TIMESTAMPTZ DEFAULT now()
  - `updated_by` UUID REFERENCES auth.users(id)

**Estructura JSONB `SiteData`** (extraída de `webs/src/lib/types.ts` — fuente canónica):
```typescript
interface SiteData {
  brand: {
    name: string; shortName: string; slogan: string;
    theme: 'azul' | 'roja'; domain: string;
    logo: string; ogImage: string; branchId: number;
  };
  hero: {
    headline: string; subheadline: string;
    cta: { text: string; whatsapp: string; };
    features: Array<{ icon: string; text: string; }>;  // 3 ítems
  };
  courses: Array<{
    name: string; description: string; price: number;
    priceNote?: string; licenseClass: string; duration: string;
    includes: string[]; highlighted: boolean; badge?: string;
  }>;
  whyUs: Array<{ icon: string; title: string; description: string; }>;
  faqs: Array<{ question: string; answer: string; }>;
  contact: {
    address: string; city: string; region: string;
    phone: string; whatsapp: string; email: string;
    mapEmbedUrl: string; geo: { lat: number; lng: number; };
  };
  hours: Array<{ days: string; hours: string; }>;
  promo?: {
    active: boolean; title: string; description: string; badge?: string;
  };
  social?: { facebook?: string; instagram?: string; tiktok?: string; };
  // testimonials excluido del panel — out of scope
}
```

**Selectores DOM que ya usa el micro-script Astro** (no modificar sin coordinar con `webs/`):
- Precios: `[data-course-index="N"] .price-value` y `.price-note`
- Promo: `#promo-banner-container`, `#promo-badge`, `#promo-title`, `#promo-desc`, `#promo-btn`

**RLS requerida:**
- `SELECT`: `anon` + `authenticated` (lectura pública — metadatos de marketing no sensibles).
- `INSERT/UPDATE/DELETE`: solo si `auth.jwt() ->> 'role' = 'admin'` OR (`auth.jwt() ->> 'role' = 'secretaria'` AND `branch_id = (SELECT branch_id FROM users WHERE supabase_uid = auth.uid())`).
- Trigger `trg_website_config_audit` → INSERT en `audit_logs` con `jsonb_diff` en cada UPDATE.

**Modelos TS en Koa:**
- `WebsiteConfig` (DTO en `core/models/dto/website-config.model.ts`): refleja columnas de la tabla.
- `SiteData` (tipo interno del JSONB): espejo exacto de `webs/src/lib/types.ts`, sin testimonials.

---

## 7. UX y flujos (preliminar)

**Pantallas afectadas:**
- `/app/admin/configuracion-web` (nueva)
- `/app/secretaria/configuracion-web` (nueva, mismo componente)
- Sidebar menu: grupo "Administración" (admin) y "Operaciones" (secretaria)

**Flujo principal — Admin (happy path):**
1. Admin abre `/app/admin/configuracion-web` → ve selector de sedes + tab "General & Redes" cargado.
2. Cambia a tab "Gestión de Cursos" → edita precio Clase B → activa toggle "Destacado".
3. Pulsa botón flotante "Guardar Cambios" → spinner → toast "Configuración guardada" → signal `config` actualizado.
4. Visita `autoescuelachillan.cl` → el micro-script inline hidrata el precio actualizado en <2s.

**Flujo alternativo — Secretaria:**
1. Secretaria abre `/app/secretaria/configuracion-web` → sin selector de sedes, carga directa de su branch.
2. Activa "Banner Promocional" → completa campos → guarda → toast éxito.

**Estados especiales:**
- `isLoading = true` → skeleton sobre el formulario completo.
- `isSaving = true` → botón "Guardar" muestra spinner, deshabilitado.
- `error !== null` → alerta inline sobre el formulario con mensaje amigable y opción de reintentar.
- Sin datos previos (primera vez) → formulario con campos vacíos pero funcional.

---

## 8. Métricas de éxito post-launch

- Tiempo de actualización de precios en landing: de días a < 30 segundos.
- 0 errores de acceso cruzado entre sedes en Supabase logs (RLS violations = 0 para usuarios legítimos).
- Auditoría completa: 100% de los saves registrados en `audit_logs` con diff.
- Hidratación en caliente en las landing pages en < 2 segundos (medido con Lighthouse).

---

## 9. Notas / decisiones abiertas

- [x] **Estructura exacta de `SiteData` JSONB:** Resuelta — extraída de `webs/src/lib/types.ts`. Ver sección 6.
- [x] **Micro-script Astro:** Ya existe en `webs/src/layouts/LandingLayout.astro`. Esta spec NO modifica ese archivo.
- [x] **Trigger de auditoría:** Trigger SQL en Postgres (`trg_website_config_audit`). Razón: garantiza auditoría incluso con UPSERTs directos desde el dashboard de Supabase, no bypasseable por el Facade.
- [x] **Seed inicial:** No se incluye en la migración SQL de Koa. Los JSON semilla (`azul.json`, `roja.json`) viven en `webs/src/content/site/` como referencia canónica — el Admin deberá cargar la configuración inicial desde el panel por primera vez.
- [ ] **Ícono `globe` en Lucide:** Verificar que esté registrado en `provideIcons()` en `app.config.ts` antes de implementar el menú lateral.
- [ ] **API key anon hardcodeada:** En `webs/src/layouts/LandingLayout.astro` la anon key está embebida en el script inline. Aceptable para anon keys de Supabase (públicas por diseño), pero candidata a moverse a `import.meta.env` en una spec futura de hardening.

---

## Apéndice — Estructura del repo `webs/`

```
webs/
├── src/
│   ├── lib/
│   │   ├── types.ts                    ← Fuente canónica de SiteData
│   │   └── data/getSiteData.ts         ← Carga desde colecciones Astro (build-time)
│   ├── content/site/
│   │   ├── azul.json                   ← Datos semilla Autoescuela Chillán (branch 1)
│   │   └── roja.json                   ← Datos semilla Conductores Chillán (branch 2)
│   ├── layouts/LandingLayout.astro     ← Micro-script hydration (ya implementado)
│   └── components/                     ← Hero, Pricing, FAQ, Location, PromoBanner...
├── astro.config.mjs                    ← Multi-brand via env BRAND=azul|roja
└── package.json                        ← build:all → dist/azul/ + dist/roja/
```

**Endpoint que ya usa el micro-script:**
`GET https://skvekggejikzxhzsjmkz.supabase.co/rest/v1/website_config?branch_id=eq.{branchId}&select=config`

**Referencia de datos semilla (NO se migran automáticamente):**
Los JSON `azul.json` y `roja.json` sirven como documentación de la estructura esperada y guía para que el Admin cargue la configuración inicial desde el panel. No se inyectan en la migración SQL.

---

## Changelog

- 2026-05-21 — draft inicial por Akxlarre
- 2026-05-21 — sección 6 completada con tipado real extraído de `webs/src/lib/types.ts`; micro-script confirmado como existente; decisiones abiertas actualizadas; Apéndice de estructura `webs/` añadido
- 2026-05-21 — decisiones cerradas: trigger SQL para auditoría, seed NO en migración (referencia en `webs/` solamente)
