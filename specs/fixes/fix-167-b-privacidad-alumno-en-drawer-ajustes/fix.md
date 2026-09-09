# Fix: Privacidad del alumno vive en el drawer global de Ajustes, no en página standalone
> id: fix-167-b-privacidad-alumno-en-drawer-ajustes
> refs: 0040-b-consentimiento-comunicaciones-alumno
> status: done
> closed: 2026-09-09
> created: 2026-09-09

## Root Cause

Al implementar AC7/AC8 de la spec 0040-b se creó una página standalone
(`/app/alumno/privacidad`, `AlumnoPrivacidadComponent`) y un grupo de menú nuevo ("Mi Cuenta")
en `ALUMNO_NAV`, sin descubrir primero que el proyecto **ya tiene** un patrón establecido para
esto: `AjustesDrawerComponent` — un drawer global abierto desde el ícono de perfil del topbar
(`layoutDrawer.open(AjustesDrawerComponent, 'Ajustes del Sistema', 'settings')`), disponible
para **los 4 roles**, con tabs "Mi Perfil" / "Ajustes" / "Seguridad" (admin). El tab "Ajustes"
ya muestra configuración condicional por rol (tema, límite de agenda solo admin/secretaria,
horarios/precios/tarifas/descuentos solo admin).

Consecuencia práctica, no solo de consistencia: el Art. 12 exige que el medio de revocación
sea *"permanentemente disponible"* — un drawer accesible desde el ícono de perfil en **toda
pantalla** cumple ese estándar mejor que un ítem de menú lateral que además requiere
navegar a una ruta nueva.

## ACs Afectados

- AC7 (spec 0040-b): sigue cumplido — el alumno ve el estado de su consentimiento
  promocional y un control para revocarlo. Cambia **dónde** vive (tab "Ajustes" del drawer
  global en vez de página standalone), no el comportamiento.
- AC8 (spec 0040-b): sigue cumplido sin cambios — mismo `ConsentsFacade.revoke()`, mismo
  `ConfirmModalService`.

## Cambio

- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts`
  — agrega la card de comunicaciones promocionales al tab "Ajustes", gateada a
  `currentUser()?.role === 'alumno'`. Inyecta `ConsentsFacade`, carga en el constructor
  (solo si el rol es alumno) vía `effect()`.
- **Eliminado:** `src/app/features/alumno/privacidad/` (componente + spec) — el standalone
  page ya no existe.
- **Archivo:** `src/app/app.routes.ts` — se quita la ruta `/app/alumno/privacidad`.
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts` — se quita el grupo "Mi
  Cuenta" de `ALUMNO_NAV` (era exclusivamente para este ítem).
- Índices actualizados: `indices/COMPONENTS.md`, `indices/ROUTES.md`.

## Test de Regresión

- `.spec.ts` del drawer no existe hoy (componente sin tests, mismo criterio que otros
  drawers de configuración del proyecto — UI condicional simple, sin `computed()` de lógica
  compleja más allá de lo ya probado en `ConsentsFacade`).
- QA manual en browser real (mismo patrón que la spec original): login como `alumno@test.com`,
  abrir Ajustes desde el topbar, ver la card de comunicaciones promocionales en el tab
  "Ajustes", confirmar que NO aparece para otros roles.
- `npm run test:ci` y `npm run lint:arch` en verde tras el cambio.

**Verificado (2026-09-09):**
- `npm run lint:arch` → 0 errores, ARCH-25 volvió a 9 (baseline; había subido a 10 tras
  agregar la card con un wrapper ad-hoc, corregido a `.card p-4 space-y-3`).
- `npm run test:ci` → 2349 passed, 5 skipped (188 test files, exit 0).
- QA visual en browser (rol `alumno@test.com`): drawer abierto desde el topbar → tab
  "Ajustes" → card "Promociones y Novedades" visible con el estado esperado
  ("Todavía no tienes una preferencia... registrada" para esta cuenta seed sin
  consentimiento promocional previo). Cards de admin/secretaria correctamente ausentes
  (gate `@if (isAlumno())` / `@if (canManageSiteConfig())`).
