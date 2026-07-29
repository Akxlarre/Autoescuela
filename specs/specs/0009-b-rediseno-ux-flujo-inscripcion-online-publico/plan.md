# Plan 0009-b — Rediseño UX del Flujo de Inscripción Online Público

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-06-01
> **Tamaño:** **L** — ⚠️ revisar este plan antes de implementar. Estimación > 3 días.

---

## 1. Resumen ejecutivo

Se reconstruye la capa de presentación del flujo público `/inscripcion` para que herede la identidad de las landing Astro (Outfit+Inter, paleta de sede azul/roja, hero con gradiente de sede, estilo de cards premium). Se crea un **set de organismos de paso dedicados al público** en `shared/components/public-enrollment-steps/` (reutilizando los átomos del DS y los modelos UI existentes), se introduce **tematización por sede** vía atributo `data-public-theme` + SCSS scoped, y se elimina el **paso de selección de sede** (la sede es tenant del `branchId`). La lógica del `PublicEnrollmentFacade` se conserva, con un refactor acotado autorizado: quitar el step `branch`, resolver la entrada por `branchId`, mover el tipo de licencia a primer paso auto-saltable, y corregir el preview de foto al restaurar draft. El wizard admin/secretaría **no se toca** (AC15).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/styles/themes/_public-enrollment.scss` | Estilos (scoped) | Ramps de sede `[data-public-theme="azul"\|"roja"]` (override de `--ds-brand`, `--color-primary`, `--gradient-hero`, superficies) + override de `--font-display/--font-body` a Outfit/Inter + forzar modo claro. Scope estricto: nunca en `:root`. |
| `src/app/core/utils/sede-theme.utils.ts` | Pure util | `branchIdToTheme(id): 'azul'\|'roja'` + tipo `SedeTheme`. Mapping hardcodeado (1→azul, 2→roja) igual que la web. Testeable sin Angular. |
| `src/app/core/utils/sede-theme.utils.spec.ts` | Test | Cubre el mapping y el fallback. |
| `src/app/core/models/ui/public-enrollment-context.model.ts` | UI model | `PublicEnrollmentContext { courseName, courseType, branchName, branchAddress, theme, priceLabel, price }` para el banner de contexto + tematización. |
| `src/app/shared/components/public-enrollment-steps/public-wizard-shell/public-wizard-shell.component.ts` | Dumb | Shell premium: orbs ambientales, hero con gradiente de sede, **progress bar nombrada** (AC7), card wrapper glass. Inputs: `steps`, `currentStep`, `title`, `subtitle`, `brandName`, `whatsappUrl`. Content projection del paso. Outputs: `helpClick`. |
| `src/app/shared/components/public-enrollment-steps/public-context-banner/public-context-banner.component.ts` | Dumb | Banner curso + escuela + **precio** + "Editar selección" (AC3/AC4/AC5). Input: `context: PublicEnrollmentContext`. Output: `editRequested`. |
| `src/app/shared/components/public-enrollment-steps/public-orientation/public-orientation.component.ts` | Dumb | Pantalla "sin sede" (AC-E1/AC-E3): mensaje + enlaces a las webs. Input: `siteLinks`. |
| `src/app/shared/components/public-enrollment-steps/public-license-type/public-license-type.component.ts` | Dumb | Selección Clase B / Profesional (AC6c). Reemplaza la mitad "flow" de `branch-course-selector`. Inputs: `availableFlows`. Outputs: `flowSelect`, `next`. |
| `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` | Dumb | Form de datos personales premium (fork del `personal-data` compartido). Reusa modelo `EnrollmentPersonalData`. |
| `src/app/shared/components/public-enrollment-steps/public-payment-mode/public-payment-mode.component.ts` | Dumb | Cards de modalidad (total/abono) con precio por opción (AC5). Hoy inline en el padre. |
| `src/app/shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts` | Dumb | Selector de instructor + grilla semanal de slots (fork premium de `assignment`). Reusa `EnrollmentAssignmentData`. **Componente más grande.** |
| `src/app/shared/components/public-enrollment-steps/public-documents/public-documents.component.ts` | Dumb | Foto carnet con **guía visual** de foto válida/inválida (AC12). Reusa `EnrollmentDocumentsData`. |
| `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts` | Dumb | Contrato + aceptación de términos, modo público (fork del `contract` con `isPublic`). Reusa `EnrollmentContractData`. |
| `src/app/shared/components/public-enrollment-steps/public-payment/public-payment.component.ts` | Dumb | Resumen pre-pago con **desglose de clases** (AC10) + trust + CTA Webpay (AC9). Hoy inline. |
| `*.spec.ts` de los componentes con lógica | Test | Para los que tengan `computed()`/decisiones (license-type, context-banner, payment-mode, schedule, documents). Los puramente presentacionales: opcional. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/public-enrollment.facade.ts` | Quitar `'branch'` de `PublicWizardStep`, `buildSteps()`, `goBack()`; nueva resolución de entrada por `branchId` (signal `entryState: 'orientation'\|'ready'`); `'license-type'` como step inicial auto-saltable; fix preview foto en `restoreDraft()` (signed URL si hay `carnetStoragePath`); persistir `branchId` en `PendingPaymentRef`. | Modelo de entrada decidido + AC-E2. Cambio estructural acotado (autorizado en spec §4). |
| `src/app/core/facades/public-enrollment.facade.spec.ts` | Actualizar/añadir tests del nuevo flujo de entrada y auto-skip. | TDD obligatorio para lógica de facade. |
| `src/app/features/public-enrollment/public-enrollment.component.ts` | Reescribir template: usar `public-wizard-shell` + nuevos steps vía `@switch`; bind `[attr.data-public-theme]="theme()"`; render `public-orientation` cuando `entryState='orientation'`; computed `theme()` desde `branchIdToTheme`. | Smart component orquesta el nuevo shell y la tematización. |
| `src/app/features/public-enrollment/retorno/public-enrollment-retorno.component.ts` | Restyle premium + tematización de sede + **CTA principal WhatsApp**, secundario portal (AC11). Leer `branchId`/whatsapp del resultado o `PendingPaymentRef`. | AC11 + coherencia visual. |
| `src/app/shared/components/matricula-steps/psych-test/psych-test.component.ts` | Restyle premium (es **público-only**, no lo usa admin). | Coherencia visual del flujo profesional. |
| `src/app/shared/components/matricula-steps/public-confirmation/public-confirmation.component.ts` | Restyle premium + folio/confirmación clara (AC-E4). Público-only. | Coherencia + cierre del flujo profesional. |
| `src/styles/styles.scss` | `@use`/`@import` del nuevo `_public-enrollment.scss`. | Activar las ramps scoped. |
| `src/index.html` | Añadir `<link>` preconnect + Outfit + Inter (display=swap). | Fuentes de las webs (G1). Solo aplican donde el scope público override `--font-*`. |
| `indices/COMPONENTS.md`, `indices/STYLES.md`, `indices/MODELS.md`, `indices/SERVICES.md` | Registrar componentes/estilos/modelo/util nuevos. | Paso SINCRONIZAR. |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| `src/app/shared/components/matricula-steps/branch-course-selector/` | Público-only; reemplazado por `public-license-type` (la mitad de sede se elimina del flujo). Eliminar **solo** tras verificar que ningún otro componente lo importa. |

---

## 3. Reutilización (Discovery)

### Componentes / átomos del DS que reutilizamos (sin cambios)
- `app-icon` (Lucide), `app-skeleton-block`, `app-async-btn`, `app-email-input`, `app-media-upload-control` — átomos base.
- Utilidades CSS: `btn-primary`, `btn-secondary`, `.surface-hero`, `.surface-glass`, `.card`, `.card-tinted`, badges, tokens de `_variables.scss`.
- Directivas: `[appAnimateIn]`, `[appCardHover]`, `[appScrollReveal]`, `[appClickOutside]` (para el banner/editar).
- `.stepper-premium` (en `_primeng-overrides.scss`) — referencia para la progress bar nombrada.

### Facade / modelos existentes que reutilizamos
- `PublicEnrollmentFacade` — fuente única de estado y orquestación (refactor acotado, no reescritura).
- Modelos UI: `EnrollmentPersonalData`, `EnrollmentAssignmentData`, `EnrollmentDocumentsData`, `EnrollmentContractData`, `BranchOption`, `BranchCoursePrice`, `CourseOption`, `CourseCategory`, `PublicFlowType`, `PaymentMode`, `StudentSummaryBanner`. **Los nuevos componentes consumen los mismos modelos** — solo cambia la presentación.

### Lo que NO existe y debemos crear (justificación)
- **Organismos de paso públicos dedicados**: los actuales (`personal-data`, `assignment`, `documents`, `contract`) están **compartidos con admin/secretaría** (`SecretariaMatriculaComponent`). Restilizarlos rompería admin (viola AC15). → fork dedicado, decisión aprobada en spec §5.
- **Tematización por sede**: el DS Angular tiene una sola marca + dark mode; no existe el eje azul/roja. → SCSS scoped + util de mapping.
- **Pantalla de orientación "sin sede"**: no existe; nace de la eliminación del paso de sede.

> ⚠️ Nota: `psych-test`, `public-confirmation` y `branch-course-selector` viven en `matricula-steps/` pero son **público-only** (admin NO los importa). Por eso `psych-test` y `public-confirmation` se restilizan in-place (ya son de-facto dedicados) y `branch-course-selector` se reemplaza. El fork dedicado aplica solo a los 4 organismos realmente compartidos.

---

## 4. Modelo de datos

**N/A** — esta spec es de UI. No crea ni altera tablas, RLS ni migraciones. El precio sale de `courses.base_price` (ya expuesto vía `courseOptions()` del facade). Único modelo nuevo: UI model `PublicEnrollmentContext` (no persiste).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Usuario (desde landing Astro, misma pestaña, ?branchId&courseId?)
  │
  ▼
PublicEnrollmentComponent (Smart, features/public-enrollment/)
  ├─ inject(PublicEnrollmentFacade)
  ├─ on init: loadBranches() → resolver entrada por branchId
  │     ├─ sin/​inválido branchId → entryState='orientation'
  │     └─ válido → theme = branchIdToTheme(branchId); resolver flow
  ├─ [attr.data-public-theme]="theme()"   ← inyecta ramp azul/roja (SCSS scoped)
  │
  ├─ @if (entryState==='orientation')
  │     └─ <app-public-orientation [siteLinks]>      (Dumb)
  │
  └─ <app-public-wizard-shell [steps] [currentStep] [title] ...>   (Dumb)
        └─ @switch (facade.currentStep())
             ├─ 'license-type'  → <app-public-license-type>   (Dumb)
             ├─ 'personal-data' → <app-public-personal-data>  + <app-public-context-banner>
             ├─ 'payment-mode'  → <app-public-payment-mode>
             ├─ 'schedule'      → <app-public-schedule>
             ├─ 'documents'     → <app-public-documents>
             ├─ 'contract'      → <app-public-contract>
             ├─ 'payment'       → <app-public-payment>
             ├─ 'psych-test*'   → <app-psych-test>            (restyle in-place)
             └─ 'confirmation*' → <app-public-confirmation>   (restyle in-place)

Cada Dumb: input(data del facade) / output(eventos) → el Smart llama métodos del facade.
```

### Capas tocadas
- **Smart**: `features/public-enrollment/public-enrollment.component.ts` (+ retorno).
- **Dumb (nuevos)**: `shared/components/public-enrollment-steps/*`.
- **Dumb (restyle)**: `matricula-steps/psych-test`, `matricula-steps/public-confirmation`.
- **Facade**: `core/facades/public-enrollment.facade.ts` (refactor acotado).
- **Util**: `core/utils/sede-theme.utils.ts`.
- **Estilos**: `styles/themes/_public-enrollment.scss` + `styles.scss` + `index.html`.
- **Migration**: ninguna.

### Tematización — mecanismo
- El root del wizard recibe `data-public-theme="azul|roja"`.
- `_public-enrollment.scss` define `[data-public-theme="azul"]{ --ds-brand:#0ea5e9; --color-primary:…; --gradient-hero:…; --font-display:'Outfit'; … }` y el equivalente roja. Fuerza tokens de modo claro dentro del scope (independiente de `[data-mode='dark']` del app).
- Los componentes nuevos usan tokens estándar del DS (`var(--ds-brand)`, `.surface-hero`) → heredan la sede automáticamente (mismo patrón cascade que `.surface-hero` ya usa).

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush en todos; Smart inyecta facade, Dumb solo input/output; control flow `@if/@for`; `input()`/`output()`.
- [x] `facades.md` — la UI no inyecta Supabase; todo vía `PublicEnrollmentFacade`. (No es branch-scoped vía `BranchFacade`: el público no usa el selector de sede admin.)
- [x] `models.md` — nuevo modelo en `core/models/ui/`; reusar DTOs/UI existentes, no duplicar.
- [x] `visual-system.md` — tokens del DS, sin colores hardcodeados en componentes (los hex de sede viven SOLO en el SCSS de tema scoped); GSAP para entradas (no `@keyframes` ni `@angular/animations`); íconos vía `app-icon`.
- [ ] `swr-pattern.md` — no aplica: el público persiste con draft localStorage, no SWR entre navegaciones.
- [ ] `notifications.md` — no aplica (sin toasts/notificaciones de dominio en el flujo público).
- [x] `testing-tdd.md` — `.spec.ts` para el util de tema, los cambios del facade y los Dumb con `computed()`/lógica.
- [x] `ai-readability.md` — mantener `data-llm-action` en botones de mutación (continuar, seleccionar modalidad, proceder al pago) y `data-llm-nav` en enlaces de orientación.

---

## 7. Plan de testing

- **Unitarios (pure):** `sede-theme.utils.spec.ts` — mapping branchId→tema + fallback.
- **Unitarios (facade):** `public-enrollment.facade.spec.ts` — resolución de entrada (sin branchId → orientation; inválido → orientation; válido 1 flow → personal-data; válido 2 flows sin courseId → license-type; con courseId → personal-data); `goBack()` sin step branch; restore con foto recrea preview.
- **Unitarios (componentes con lógica):** license-type (flows disponibles/auto-skip), context-banner (label de precio), payment-mode (selección + sessions), schedule (semanas/slots), documents (estado de upload).
- **QA manual (golden path + edge):**
  - Azul Clase B con `?branchId=1` (sin license-type, directo a datos) → pago.
  - Roja con `?branchId=2` genérico → license-type → ambos flujos.
  - Con `?courseId` → license-type auto-resuelto.
  - Sin branchId / branchId inválido → orientación.
  - Draft restore con foto → preview visible.
  - Toggle visual azul vs roja coherente con la landing.
  - **Regresión admin**: abrir `SecretariaMatriculaComponent`/`AdminMatriculaComponent` → sin cambios (AC15).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Refactor del state machine (quitar `branch`) regresiona el flujo | Media | Tests de facade primero (TDD); QA manual de ambos flujos antes de cerrar. |
| Las ramps de sede "filtran" al resto de la app | Media | Todo override SOLO bajo `[data-public-theme]`; nada en `:root`; revisar con DevTools que el app interno no cambia. |
| Conflicto con el dark mode del app (público debe ser claro) | Media | El scope público fuerza tokens claros + `color-scheme: light` independiente de `[data-mode='dark']`. |
| `public-schedule` (grilla) es el componente más complejo de reconstruir | Alta | Aislarlo como tarea grande propia; reutilizar la lógica de semanas/slots del modelo `EnrollmentAssignmentData` que ya provee el facade; no rehacer lógica, solo presentación. |
| Retorno necesita sede/whatsapp para tematizar y CTA | Media | Persistir `branchId` en `PendingPaymentRef` (sessionStorage) + exponer `branchWhatsapp` en el resultado de `confirm-payment` o lookup por branchId. |
| FOUT al cargar Outfit/Inter | Baja | `preconnect` + `display=swap`; el fallback `system-ui` ya está en la cadena. |
| Duplicación de markup entre steps públicos y compartidos diverge con el tiempo | Baja | Modelos UI compartidos (contrato estable); la divergencia es intencional (contextos distintos). |
| Eliminar `branch-course-selector` rompe un import olvidado | Baja | Grep de usos antes de borrar; borrar solo cuando 0 referencias. |

---

## 9. Orden de implementación

1. **Fundación de tema**: `sede-theme.utils.ts` (+ test) → `_public-enrollment.scss` (ramps azul/roja + fonts scoped) → import en `styles.scss` → fonts en `index.html`.
2. **Refactor del facade** (TDD): quitar step `branch`, resolución de entrada, license-type step, fix preview foto, persistir branchId. Tests verdes.
3. **Shell + piezas transversales**: `public-wizard-shell` (hero + progress nombrada + card + orbs), `public-context-banner`, `public-orientation`.
4. **Steps públicos** (en orden de flujo): `public-license-type` → `public-personal-data` → `public-payment-mode` → `public-schedule` → `public-documents` → `public-contract` → `public-payment`.
5. **Wire del Smart**: reescribir `public-enrollment.component.ts` (@switch + theme attribute + estado orientation).
6. **Retorno**: restyle premium + tematización + CTA WhatsApp + branchId persistido.
7. **Restyle in-place**: `psych-test` + `public-confirmation`.
8. **Webs**: verificar `target="_self"` en CTAs (probable no-op) — AC14.
9. **Limpieza**: eliminar `branch-course-selector` (tras grep 0 refs).
10. **QA + AC verification** (ambos flujos, azul/roja, edge cases, regresión admin) → `/spec-verify`.

---

## 10. Estimación

**L — > 3 días.** ~13 archivos nuevos (11 componentes + util + SCSS + modelo) + 8 modificados. El grueso del esfuerzo: `public-schedule` (grilla) y la reescritura del shell/smart. La fundación de tema y el refactor del facade son acotados pero de alto riesgo (gate de regresión).

---

## Changelog

- 2026-06-01 — plan inicial (talla L) desde spec 0009-b + índices del proyecto + referencia de identidad visual.
