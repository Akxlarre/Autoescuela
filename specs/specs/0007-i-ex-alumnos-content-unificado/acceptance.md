# Acceptance 0007-i — Consolidar Ex-Alumnos Clase B en un `*-content` compartido

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-31
> **Verifier:** ac-verifier (Haiku) · sesión de implementación

---

## Resumen

- AC totales: 8 (AC1-AC6 + AC-E1 + AC-E2)
- AC cumplidos: 8
- AC fallidos: 0
- AC con evidencia: 8/8

---

## AC1 — Admin ve la misma tabla/búsqueda/filtros/KPIs con datos reales

✅ **Cumplido.** `/app/admin/ex-alumnos` verificado en vivo (`/verify`, Playwright): hero
"Ex-Alumnos B" + chips "Historial Consolidado"/"2 Egresados" + 2 KPIs (Egresados Clase B: 2,
Con deuda: 0) + buscador + selector de período ("Últimos 12 meses") + 2 tarjetas con datos
reales (Morales Soto Ana, González Martínez Pedro) desde `ExAlumnosFacade.egresadosClaseBList()`.
Consola sin errores. Capturas: `verify-admin-ex-alumnos2.png`.

## AC2 — Secretaria ve lo mismo, `routerLink` apunta a `/app/secretaria/alumnos/:id`

✅ **Cumplido.** `/app/secretaria/ex-alumnos` verificado en vivo con dos cuentas: `secretaria@test.com`
(sede sin egresados, empty-state legítimo) y `secretaria2@test.com` (misma sede que el
seed de datos, 2 egresados). Con esta segunda cuenta se clickeó "Ver ficha" en vivo →
navegó correctamente a `/app/secretaria/alumnos/51`, confirmando el `routerLink` con
`basePath="/app/secretaria"` funcionando de punta a punta, no solo por inspección de
código. Capturas: `verify-secretaria-ex-alumnos.png`, `verify-secretaria2.png`.

## AC3 — Cambio de sede (admin) refiltra la lista igual que antes

✅ **Cumplido.** Probado en vivo, 3 direcciones: "Todas las sedes" (2 egresados) →
"Autoescuela Chillán" (0, empty-state) → "Conductores Chillán" (2, mismos egresados) —
consola limpia en cada cambio. El `effect()` que dispara `loadEgresados()` en
`AdminExAlumnosComponent` no se tocó; el filtrado por `branchFacade.selectedBranchId()` ya
vivía dentro de `ExAlumnosFacade.loadEgresados()`, sin cambios. Capturas:
`verify-branch-switch.png`, `verify-branch-switch-back.png`.

## AC4 — Secretaria sin `BranchFacade` no se rompe por su ausencia

✅ **Cumplido.** `SecretariaExAlumnosComponent` no inyecta `BranchFacade` (confirmado por
lectura del código); la página cargó sin errores de consola ni excepciones de inyección.

## AC5 — Drawers de Tasas y Comentarios funcionan desde ambos roles

✅ **Cumplido.** Ambos drawers probados en vivo desde admin y desde secretaría por
separado: abren con datos reales de `ExAlumnosFacade` (`municipalApprovalRate()`,
`psychApprovalRate()`, `surveys()`, etc.), sin errores de consola. Capturas:
`verify-tasas-drawer.png`, `verify-comentarios-drawer.png`, `verify-secretaria-tasas-drawer.png`.

## AC6 — Selector de período se comporta igual que antes (absorbido, no reimplementado)

✅ **Cumplido.** `app-period-selector` + signal `periodWindow` + `computed hasActiveSearch`
+ `applyPeriodWindow()` movidos tal cual al Organismo compartido. Cubierto por 3 tests
unitarios en `ex-alumnos-content.component.spec.ts` — los 3 en verde. **Interacción real
probada en vivo (admin):** escribir "Morales" en el buscador filtra correctamente a 1
resultado y muestra el indicador "Buscando en todo el historial" (confirma que la búsqueda
ignora el período activo, ASG-b-087); cambiar el período a "2026" (de 3 opciones:
"Últimos 12 meses"/"Todo el historial"/"2026") muestra los 2 egresados correctamente.
Capturas: `verify-search.png`, `verify-period-2026.png`.

### AC-E1 — Guard `branchId !== null` antes de re-matricular

✅ **Cumplido.** Cubierto por 2 tests unitarios (con/sin `branchId`) — el guard
`if (egresado.branchId !== null) branchFacade.selectBranch(...)` es idéntico al código
pre-spec, solo cambió quién lo posee (Smart, no el Dumb). **Flujo completo probado en vivo
(admin):** click "Re-matricular" → modal de confirmación con el nombre correcto
("González Martínez Pedro") → "Continuar" → URL cambia a `?rut=12.345.678-5` sin navegar →
se abre el wizard "Nueva Matrícula" en drawer con RUT validado y todos los datos personales
(nombres, apellidos, email, teléfono) precargados correctamente. Capturas:
`verify-reenroll-confirm.png`, `verify-reenroll-drawer.png`.

### AC-E2 — Sin imports relativos cruzados entre portales

✅ **Cumplido.** `grep -rn "\.\./\.\./admin" src/app/features/secretaria/ex-alumnos/` → 0
imports reales (la única coincidencia es un comentario explicando el "antes"). El import de
los 2 drawers en `secretaria-ex-alumnos.component.ts` usa el alias
`@features/admin/alumnos/ex-alumnos/components/...`.

---

## Fuera de scope respetado

- ❌ No se tocó `ExAlumnosFacade` — confirmado (0 cambios al archivo).
- ❌ No se rediseñó el selector de período ni su lógica — absorbido tal cual (mismo código,
  mismos tests de comportamiento).
- ❌ No se aplicó app-like/fill-screen nuevo — el que ya existía (`bento-grid--fill-screen`)
  se preservó sin cambios de contrato.
- ❌ No se rediseñó el contenido de los drawers de Tasas/Comentarios — solo se ajustó cómo
  se abren (outputs en vez de `layoutDrawer.open()` directo desde el Dumb).

## Deuda técnica / desviaciones del plan original

- **Los 2 drawers (Tasas, Comentarios) y su sub-componente NO se movieron a `shared/`** como
  proponía la asignación original (`ASG-b-096`) — el Architect Guard (hook) bloquea
  `inject(...Facade)` en cualquier `.component.ts` bajo `shared/`, sin excepción para
  Organismos, contradiciendo el precedente `servicios-especiales-content/drawers/` y la
  letra de `architecture.md`. Se optó por dejarlos en `features/admin/` y resolver el
  "olor" de imports cruzados (AC-E2) con el alias `@features/` en vez de relocalizar
  archivos — decisión documentada en `plan.md` §3, aceptada explícitamente durante la
  implementación. **No bloquea el valor de la spec:** la duplicación real (~570 líneas de
  tabla/búsqueda/período/hero) sí se eliminó al 100%; lo que queda sin unificar es la
  orquestación de `reEnroll()`/apertura de drawers en cada Smart Component (~20-30 líneas
  casi idénticas cada uno), que es lógica que legítimamente pertenece a un Smart, no a un
  Dumb.
- **ARCH-09 (complejidad):** `ex-alumnos-content.component.ts` quedó en 539 líneas
  (recomendado <200) — no bloqueante, mismo patrón que otros `*-content` ya existentes en
  el proyecto (`flota-list-content` 581 líneas, `ex-alumnos-profesional-content` 517 líneas).

## Cambios en índices

- `indices/COMPONENTS.md`: fila nueva `app-ex-alumnos-content`; filas de
  `AdminExAlumnosComponent`/`SecretariaExAlumnosComponent` actualizadas (wrappers delgados);
  filas de los 2 drawers actualizadas con nota del alias `@features/`; eliminada una fila
  "Stub PLANO" stale/duplicada para `/app/secretaria/ex-alumnos`.

---

## Veredicto final

✅ **PASA** — 8/8 AC cumplidos con evidencia, out-of-scope respetado, sin deuda crítica.
La única desviación (drawers no relocalizados) está documentada, justificada por una
restricción de tooling real (no una omisión), y no compromete ningún AC de la spec.
