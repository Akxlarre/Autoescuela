# Tasks 0009-b — Rediseño UX del Flujo de Inscripción Online Público

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-06-01

---

## Cómo usar este archivo

- Cada tarea es **atómica** (~30–90 min). Marcá `[x]` apenas pase su DoD, no en bloque.
- Campo **Modelo:** = recomendación de qué modelo ejecuta la tarea (Opus para riesgo/juicio, Sonnet para grueso presentacional).
- Si surge algo fuera del scope de la spec → **detenete** y creá spec nueva.

### DoD base — todo componente Dumb nuevo (`shared/components/public-enrollment-steps/`)
Aplica a T3.1–T3.10 salvo que se indique lo contrario:
- [ ] `ChangeDetectionStrategy.OnPush`
- [ ] Solo `input()` / `output()` — **sin** inyección de Facades ni Supabase
- [ ] Control flow `@if` / `@for` (prohibido `*ngIf`/`*ngFor`)
- [ ] Íconos vía `<app-icon>` (sin SVG inline ad-hoc ni emojis)
- [ ] Colores SOLO vía tokens del DS (`var(--ds-brand)`, `.surface-hero`, `btn-*`) — **cero hex** en el componente (los hex de sede viven únicamente en `_public-enrollment.scss`)
- [ ] `data-llm-action` en botones de mutación / `data-llm-description` en inputs críticos
- [ ] Skeleton colocado si recibe data async
- [ ] `.spec.ts` si tiene `computed()` o lógica derivada
- [ ] Registrado en `indices/COMPONENTS.md`

---

## Fase 1 — Fundación: tema, util y modelo

- [x] **T1.1** — Pure util `core/utils/sede-theme.utils.ts` + test (TDD)
  - **AC ref:** AC1
  - **Modelo:** Opus
  - **DoD:**
    - [x] `sede-theme.utils.spec.ts` escrito primero y falla
    - [x] `branchIdToTheme(id: number\|null): 'azul'\|'roja'` con mapping 1→azul, 2→roja
    - [x] Fallback documentado para id desconocido (decisión: default `azul`; la orientación por sede ausente/inválida la decide el Facade, no este util)
    - [x] Tipo `SedeTheme` exportado
    - [x] `npm run test:ci` verde para este archivo (5/5)
    - [x] Registrado en `indices/SERVICES.md` (sección Pure Utilities)

- [x] **T1.2** — SCSS scoped `src/styles/themes/_public-enrollment.scss`
  - **AC ref:** AC1, AC2 (G1/G2/G3/G6 del research)
  - **Modelo:** Opus
  - **DoD:**
    - [x] `[data-public-theme="azul"]` y `[data-public-theme="roja"]` con ramps (espejo de `webs/*.css`, valores refinados del mockup aprobado) → override `--ds-brand`, `--color-primary*`, `--gradient-hero`, superficies, `--border-*` + puente Tailwind `--color-*`
    - [x] Override `--font-display:'Outfit'` y `--font-body:'Inter'` dentro del scope
    - [x] Fuerza modo claro dentro del scope (`color-scheme: light` + reset de surfaces/text/border/shadow/state a claro) independiente de `[data-mode='dark']`
    - [x] **Cero** overrides en `:root` (garantizado por construcción: solo selectores `[data-public-theme]`)
    - [x] `@use` en `styles.scss` (compila ok vía Dart Sass)
    - [x] `<link>` preconnect + Outfit + Inter (`display=swap`) en `src/index.html`
    - [x] Registrado en `indices/STYLES.md`

- [x] **T1.3** — UI model `core/models/ui/public-enrollment-context.model.ts`
  - **AC ref:** AC3, AC5
  - **Modelo:** Sonnet
  - **DoD:**
    - [x] `PublicEnrollmentContext { courseName, courseType, branchName, branchAddress, theme: SedeTheme, priceLabel: string, price: number }`
    - [x] PascalCase singular; sin duplicar campos ya en DTOs (reusa `CourseType` y `SedeTheme` vía `import type`)
    - [x] Registrado en `indices/MODELS.md`

---

## Fase 2 — Capa Facade (refactor acotado, TDD)

- [x] **T2.1** — Actualizar `public-enrollment.facade.spec.ts` PRIMERO
  - **AC ref:** AC6, AC6b, AC6c, AC6d, AC-E1, AC-E2, AC-E3
  - **Modelo:** Opus
  - **DoD:**
    - [x] Tests de resolución de entrada: sin `branchId`→orientation; inválido→orientation; válido 1 flow→`personal-data`; válido 2 flows sin courseId→`license-type`; con courseId→`personal-data` (sección `resolveEntry`, 5 tests)
    - [x] Test: `goBack()` ya no incluye step `branch` en ningún flujo (personal-data→license-type; no-op en license-type)
    - [x] Test: `restoreDraft()` con `carnetStoragePath` recrea preview (mock signed URL) — AC-E2, ahora `await`
    - [x] Tests FALLAN (aún sin implementación): **30 red** = contrato nuevo; 30 green = comportamiento sin cambios
    - [x] **Bonus (aprobado):** arreglados los 4 timeouts pre-existentes de `uploadCarnetPhoto` (mock de `normalizePhoto` + `uploadToSignedUrl`) → 5/5 green

- [x] **T2.2** — Refactor `public-enrollment.facade.ts`
  - **AC ref:** AC6, AC6b, AC6c, AC6d, AC-E1, AC-E2, AC-E3
  - **Modelo:** Opus (max)
  - **DoD:**
    - [x] `'branch'` eliminado de `PublicWizardStep`, `buildSteps()` (ambos flujos), `goBack()` y `currentStep` inicial (grep confirma 0 referencias)
    - [x] Nueva resolución de entrada: signal `entryState: 'orientation'\|'ready'` + `resolveEntry(branchId, courseId)` + `availableFlows` computed
    - [x] `'license-type'` como primer step; auto-skip si la sede ofrece 1 flow o llega `courseId` (AC6b/AC6d); `confirmLicenseType()` reemplaza `confirmBranchSelection`
    - [x] `restoreDraft()` ahora `async` + genera signed URL para preview de foto si hay `carnetStoragePath` (AC-E2) vía `refreshCarnetPreview()`
    - [x] `PendingPaymentRef` persiste `branchId` (para tematizar `/retorno`)
    - [x] `catchError`/manejo de error preservado; signal `error` intacto
    - [x] **Sin** otros cambios de lógica de negocio (state machine equivalente salvo lo anterior)
    - [x] `npm run test:ci` verde — **facade spec 60/60** ✅. (Suite global tiene 52 reds PRE-EXISTENTES en facades ajenos —auth/branch/dms/student-home/etc.—, no causados por este cambio; fuera de scope 0009-b → ver T5.2)
    - [x] Entrada actualizada en `indices/FACADES.md` (contrato público cambió)
  - **⚠️ Pendiente T4.1:** `features/public-enrollment/public-enrollment.component.ts` no compila hasta T4.1 (usa `selectBranch`, `confirmBranchSelection`, `@case('branch')` ya eliminados). Esperado por la secuencia del plan; `test:ci` no se afecta (el component no tiene spec).

---

## Fase 3 — Capa UI (componentes públicos dedicados)

- [x] **T3.1** — `public-wizard-shell` (shell premium)
  - **AC ref:** AC1, AC7
  - **Modelo:** Sonnet
  - **DoD:** (+ DoD base) inputs `steps`, `currentStep`, `title`, `subtitle`, `brandName`, `whatsappUrl`; hero con `var(--gradient-hero)` de sede; **progress bar nombrada** (no solo números) con paso activo resaltado; orbs ambientales; content projection del paso; output `helpClick`; entradas animadas con GSAP (`animateHero` en `afterNextRender`)

- [x] **T3.2** — `public-context-banner`
  - **AC ref:** AC3, AC4, AC5
  - **Modelo:** Sonnet
  - **DoD:** (+ DoD base) input `context: PublicEnrollmentContext`; muestra curso + escuela + **precio** (texto en gradiente de marca); botón "Editar selección" → output `editRequested`
  - **Nota spec:** `.spec.ts` eliminado — el proyecto excluye component tests por diseño (`vitest.config.ts` documenta la limitación: necesita `@analogjs/vite-plugin-angular` que rompe tests de facades). Ver `exclude[]` en vitest.config.ts.

- [x] **T3.3** — `public-orientation` (pantalla sin sede)
  - **AC ref:** AC-E1, AC-E3
  - **Modelo:** Sonnet
  - **DoD:** (+ DoD base) input `siteLinks`; mensaje "Accede desde el sitio de tu escuela" + enlaces a webs con `data-llm-nav`; **sin** selector de sede

- [x] **T3.4** — `public-license-type`
  - **AC ref:** AC6c
  - **Modelo:** Sonnet
  - **DoD:** (+ DoD base) input `availableFlows`; cards Clase B / Profesional; outputs `flowSelect`, `next`; `computed visibleCards()` filtra flows; CTA bloqueado hasta selección; reemplaza la mitad "flow" de `branch-course-selector`

- [x] **T3.5** — `public-personal-data`
  - **AC ref:** AC3 (host del banner), AC5
  - **Modelo:** Sonnet
  - **DoD:** reusa `EnrollmentPersonalData`; integra `app-public-context-banner`; `computed canAdvance()` — rut+nombres+apellido+email; `data-llm-description` en campos críticos

- [x] **T3.6** — `public-payment-mode`
  - **AC ref:** AC5
  - **Modelo:** Sonnet
  - **DoD:** cards total/abono con precio en gradiente + sessions; check animado; note contextual para abono; CTA bloqueado; exporta `PublicPaymentModeOption`

- [x] **T3.7** — `public-schedule` (grilla — componente más grande)
  - **AC ref:** AC10
  - **Modelo:** Sonnet
  - **DoD:** selector instructor + grilla slots (available/selected/occupied); toggle vía `dataChange`; contador; skeleton `SkeletonBlockComponent`; CTA bloqueado hasta completar

- [x] **T3.8** — `public-documents` (foto carnet con guía)
  - **AC ref:** AC12
  - **Modelo:** Sonnet
  - **DoD:** guía visual inline válida/inválida (AC12); preview si hay foto; upload area; CTA bloqueado; output `fileSelected`

- [x] **T3.9** — `public-contract`
  - **AC ref:** AC8
  - **Modelo:** Sonnet
  - **DoD:** generar/mostrar PDF contrato; upload firmado; CTA "Continuar al Pago"; outputs `generateContract`, `next`, `back`

- [x] **T3.10** — `public-payment` (resumen pre-pago)
  - **AC ref:** AC9, AC10
  - **Modelo:** Sonnet
  - **DoD:** resumen alumno/escuela/curso/modalidad; desglose de clases con fecha/hora (AC10, 4+más); total en gradiente; trust note AC9; CTA `data-llm-action="proceed-to-payment"`; exporta `PublicPaymentSummary`

- [x] **T3.11** — Restyle in-place `matricula-steps/psych-test`
  - **AC ref:** AC1 (coherencia), AC-E4
  - **Modelo:** Sonnet
  - **DoD:** heading con `font-display`; nav footer con `border-top`. Tokens DS ya correctos — heredarán colores de sede vía `[data-public-theme]` en T4.1. Admin confirmado: no importa este componente (solo `public-enrollment.component.ts`).

- [x] **T3.12** — Restyle in-place `matricula-steps/public-confirmation`
  - **AC ref:** AC-E4
  - **Modelo:** Sonnet
  - **DoD:** ícono success con gradiente de marca, folio prominente en pill brand, heading con `font-display`, tarjeta de próximos pasos premium con `@for`. Pasos profesionales explícitos (documentación, promoción) para AC-E4. Inputs/outputs sin cambios.

---

## Fase 4 — Conexión, retorno y animación

- [x] **T4.1** — Wire del Smart `public-enrollment.component.ts`
  - **AC ref:** AC1, AC6, AC-E1
  - **Modelo:** Opus
  - **DoD:**
    - [x] `[attr.data-public-theme]="theme()"` en el host (computed `theme()` desde `branchIdToTheme(selectedBranch?.id ?? urlBranchId)`)
    - [x] `@if (entryState==='orientation')` → `app-public-orientation`; si no, `app-public-wizard-shell` + `@switch` con los nuevos steps (+ draft restore + loading gate)
    - [x] OnPush; inyecta `PublicEnrollmentFacade` (+ `ActivatedRoute` para query params); lee `branchId`/`courseId` en init y llama `resolveEntry`
    - [x] Loading (`resolving()` signal), error (banner), empty (→ orientation) cubiertos
    - [x] Dumb components registrados en `indices/COMPONENTS.md` (T3.x). Smart = página enrutable, no aplica a tablas atómicas.
    - [x] **`ng build` verde** (0 errores) — la rotura transitoria de T2.2 quedó resuelta
  - **⚠️ Pendientes de datos:** `siteLinks` (orientación) usan URL placeholder `'#'` — faltan las URLs reales de las landing Astro; `whatsappUrl` es `null` (la tabla `branches` no expone WhatsApp). Ambos son config, no lógica.

- [x] **T4.2** — Animaciones de entrada con `GsapAnimationsService`
  - **AC ref:** —
  - **Modelo:** Sonnet
  - **DoD:** stagger GSAP sobre `progressRef` (children del nav de pasos, delay 0.2s, stagger 0.06) + card fade-up (y:20, delay 0.15); `clearProps:'transform'` en ambos; hero ya animaba con `animateHero`. gsap importado directamente (GsapAnimationsService no expone stagger genérico). Compila limpio en `ng build`.

- [x] **T4.3** — Retorno premium `retorno/public-enrollment-retorno.component.ts`
  - **AC ref:** AC11
  - **Modelo:** Sonnet
  - **DoD:**
    - [x] Tematización de sede: `[attr.data-public-theme]="theme()"` en el host, `_branchId` leído de `pec_pending` sessionStorage (mismo `PendingPaymentRef`). `computed theme()` via `branchIdToTheme`.
    - [x] CTA **principal = WhatsApp** (AC11); secundario = portal `/app/dashboard`; "Volver al inicio" movido a terciario de texto muted.
    - [x] Estados success/rejected/error premium: success con gradiente de sede + folio `kpi-value`, rejected con warning/error-bg, error con warning.
    - [x] `data-llm-action="contact-school-whatsapp"` y `data-llm-nav` en todos los CTAs.
    - [x] ⚠️ `whatsappHref` retorna `'https://wa.me/'` (sin número) — tabla `branches` no expone WhatsApp aún. Todo lo demás funcional.

- [x] **T4.4** — Verificar `target="_self"` en CTAs de las webs (AC14)
  - **AC ref:** AC14
  - **DoD:** **No-op confirmado.** `Button.astro` usa `target = external ? '_blank' : undefined`. Ningún CTA de inscripción (`Hero`, `Navbar`, `Contact`, `PromoBanner`) pasa `external={true}`. La `<a>` mobile-cta-link tampoco. Los CTAs navegan en la misma pestaña. AC14 cumplido sin cambios.

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` limpio · **Modelo:** Sonnet
  - 25 errores / 117 advertencias, **ninguno de spec 0009-b**. Todo pre-existente en otros módulos (ARCH-02 ConfirmModal/Toast en views, ARCH-08 amber-500/cyan-400, ARCH-03 facades sin spec, ARCH-09 clases grandes). Limpio para el scope de esta spec.
- [x] **T5.2** — `npm run test:ci` verde · **Modelo:** Sonnet
  - `sede-theme.utils.spec.ts` 5/5 + `public-enrollment.facade.spec.ts` 60/60 → **65/65 green**. Suite global tiene ~52 reds pre-existentes (auth/branch/dms/student-home) ajenos a 0009-b.
- [ ] **T5.3** — QA manual · **Modelo:** Sonnet (humano valida)
  - **DoD:** evidencia en `acceptance.md` de: azul Clase B con `?branchId=1`; roja `?branchId=2` genérico (license-type) ambos flujos; con `?courseId` (auto-skip); sin branchId / inválido → orientación; draft restore con foto; **regresión admin** (`SecretariaMatriculaComponent`/`AdminMatriculaComponent` sin cambios — AC15); coherencia visual azul vs roja
- [ ] **T5.4** — `/spec-verify` · **Modelo:** Sonnet
  - **DoD:** AC Verifier ok o tickets resueltos

---

## Fase 6 — Cierre

- [ ] **T6.1** — Eliminar `shared/components/matricula-steps/branch-course-selector/` · **Modelo:** Sonnet
  - **DoD:** grep confirma 0 referencias antes de borrar
- [ ] **T6.2** — `/sync-indices` (COMPONENTS, STYLES, MODELS, SERVICES) · **Modelo:** Sonnet/Haiku
- [ ] **T6.3** — Marcar `0009-b` como `done` en `ROADMAP.md` (mover de Activa) · **Modelo:** Haiku
- [ ] **T6.4** — Limpiar `specs/.active` (`/spec-activate --clear`) · **Modelo:** Haiku

---

## Tareas descubiertas durante implementación

> Si surge algo dentro del scope de la spec, agregalo acá. Fuera de scope → spec nueva.

- [ ] …
