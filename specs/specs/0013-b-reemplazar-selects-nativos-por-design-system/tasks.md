# Tasks 0013-b — Reemplazar selects nativos por componentes del Design System

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-06-12

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [ ] **T1.1** — Crear migración `20260612120000_users_gender_comment.sql`
  - **AC ref:** AC4, AC5
  - **DoD:**
    - [ ] Archivo creado en `supabase/migrations/` con el naming correcto
    - [ ] Contiene `COMMENT ON COLUMN users.gender` con los 3 valores (M/F/X)
    - [ ] Contiene `COMMENT ON COLUMN professional_pre_registrations.gender` ídem
    - [ ] No altera la estructura de la tabla (solo metadatos)
    - [ ] Documentado en `indices/DATABASE.md` (actualizar nota del campo gender)

- [ ] **T1.2** — Verificar y ajustar tipo `gender` en `core/models/ui/cursos-singulares.model.ts`
  - **AC ref:** AC5
  - **DoD:**
    - [ ] `SingularPersonalDataForm.gender` acepta `'M' | 'F' | 'X' | ''` (o importa el tipo `Gender` de `enrollment-personal-data.model.ts`)
    - [ ] No hay errores de TypeScript en `admin-curso-singular-inscribir-drawer.component.ts` al asignar `'X'`
    - [ ] Si se hace un cambio, documentado en `indices/MODELS.md`

---

## Fase 3 — Capa UI

- [ ] **T3.1** — Reemplazar 2 `<select>` en `registrar-anticipo-drawer.component.ts`
  - **AC ref:** AC1, AC2, AC7
  - **DoD:**
    - [ ] Importa `SelectModule` de `primeng/select`
    - [ ] `<select formControlName="instructorId">` → `<p-select formControlName="instructorId" [options]="facade.instructores()" optionLabel="nombre" optionValue="id" styleClass="w-full" placeholder="Seleccionar instructor..." />`
    - [ ] Agrega constante `MOTIVO_OPTIONS` (5 opciones: sin categoría, anticipo sueldo, viático, materiales, otros)
    - [ ] `<select formControlName="reason">` → `<p-select formControlName="reason" [options]="MOTIVO_OPTIONS" optionLabel="label" optionValue="value" styleClass="w-full" />`
    - [ ] Los `data-llm-description` se migran al p-select
    - [ ] Mensaje de error `@if (isInvalid('instructorId'))` se mantiene intacto
    - [ ] `ng build` sin errores

- [ ] **T3.2** — Reemplazar 2 `<select>` en `admin-configuracion-web.component.ts`
  - **AC ref:** AC6, AC7
  - **DoD:**
    - [ ] Importa `SelectModule` de `primeng/select`
    - [ ] Agrega constante `TEMA_OPTIONS = [{ value: 'azul', label: 'Azul (Sky/Indigo)' }, { value: 'roja', label: 'Roja (Red/Orange)' }]`
    - [ ] `<select formControlName="theme">` → `<p-select formControlName="theme" [options]="TEMA_OPTIONS" optionLabel="label" optionValue="value" styleClass="w-full opacity-80 cursor-not-allowed" [disabled]="true" />`
    - [ ] `<select formControlName="course_id">` → `<p-select formControlName="course_id" [options]="coursesFacade.availableCourses()" optionLabel="name" optionValue="id" styleClass="w-full" placeholder="— Seleccionar curso —" />`
    - [ ] `data-llm-action="select-website-course"` y `data-llm-description` se migran al p-select
    - [ ] `ng build` sin errores

- [ ] **T3.3** — Reemplazar `<select>` Vehículo en `admin-iniciar-clase-drawer.component.ts`
  - **AC ref:** AC3, AC7, AC-E1
  - **DoD:**
    - [ ] Importa `FormsModule` en el array de `imports` (coexiste con `ReactiveFormsModule` existente)
    - [ ] Importa `SelectModule` de `primeng/select`
    - [ ] Renombra `onVehicleChange(event: Event)` → `onVehicleSelectChange(id: number)` y adapta el body (elimina el cast `event.target as HTMLSelectElement`)
    - [ ] `<select [value]="..." (change)="...">` → `<p-select [ngModel]="selectedVehicleId()" (ngModelChange)="onVehicleSelectChange($event)" [options]="facade.vehiclesPorSede()" optionValue="id" styleClass="w-full">` con `ng-template pOption` y `pSelectedItem` para formato `plate · brand model`
    - [ ] AC-E1: cuando la lista está vacía, el bloque `@if (facade.vehiclesPorSede().length > 0)` sigue intacto (p-select no rompe el layout si no se renderiza)
    - [ ] `ng build` sin errores

- [ ] **T3.4** — Segmented control Género en `admin-curso-singular-inscribir-drawer.component.ts`
  - **AC ref:** AC5, AC7
  - **DoD:**
    - [ ] Agrega constante `GENDER_OPTIONS = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'X', label: 'Prefiero no especificar' }]`
    - [ ] `<select [(ngModel)]="form().gender">` reemplazado por 3 botones `type="button"` en un `div` contenedor con `role="radiogroup"`
    - [ ] Fondo activo: `color-mix(in srgb, var(--ds-brand) 10%, transparent)` · Color activo: `var(--ds-brand)` · Fuente activa: `font-weight: 600`
    - [ ] Borde del contenedor: `1.5px solid var(--border-default)` · Divisor entre botones: `border-right: 1px solid var(--border-default)` en todos menos el último
    - [ ] Click en cada botón llama `patchForm('gender', opt.value)`
    - [ ] `data-llm-action="select-gender-{value}"` en cada botón
    - [ ] `aria-pressed` activo en el botón seleccionado
    - [ ] Valor inicial `'M'` (de `EMPTY_PERSONAL`) se visualiza activo al abrir el drawer
    - [ ] `ng build` sin errores

- [ ] **T3.5** — Segmented control Género en `public-personal-data.component.ts`
  - **AC ref:** AC4, AC7, AC-E2
  - **DoD:**
    - [ ] Agrega constante `GENDER_OPTIONS` (igual que T3.4)
    - [ ] `<select id="pub-gender" [ngModel]="..." (ngModelChange)="patch('gender', $event)" (blur)="markDirty('gender')">` reemplazado por 3 botones en `div` contenedor
    - [ ] Click en botón llama `patch('gender', opt.value)` Y `markDirty('gender')` (mantiene el dirty-state tracking del componente)
    - [ ] Mismo diseño visual que T3.4 (tokens DS, borde, divisores)
    - [ ] `for="pub-gender"` en el `<label>` se reemplaza por `id="pub-gender-label"` en el `<label>` y `aria-labelledby="pub-gender-label"` en el contenedor
    - [ ] AC-E2: con `gender = ''` (valor inicial sin selección), ningún botón aparece con estado activo y el `canAdvanceFn` bloquea el CTA (ya validado por `data.gender.length > 0`)
    - [ ] `ng build` sin errores

---

## Fase 5 — Validación

- [ ] **T5.1** — Build limpio
  - **DoD:**
    - [ ] `ng build` termina sin errores de TypeScript ni de compilación
    - [ ] Sin warnings de imports no utilizados en los 5 archivos

- [ ] **T5.2** — QA visual con Playwright (`/verify`)
  - **AC ref:** AC1–AC7, AC-E1, AC-E2
  - **DoD:**
    - [ ] `registrar-anticipo-drawer`: p-select Instructor abre panel con overrides DS (bordes redondeados, hover brand) — AC1
    - [ ] `registrar-anticipo-drawer`: p-select Motivo idem — AC2
    - [ ] `admin-iniciar-clase-drawer`: p-select Vehículo abre, al seleccionar se pre-rellena odómetro — AC3
    - [ ] `public-personal-data`: clic en cada opción M/F/X activa estado visual correcto — AC4
    - [ ] `admin-curso-singular-inscribir-drawer`: ídem — AC5
    - [ ] `admin-configuracion-web`: Tema Visual deshabilitado; course_id dinámico funciona — AC6
    - [ ] Dark mode toggle: todos los controles respetan tokens `[data-mode='dark']` — AC7
    - [ ] AC-E1: drawer de vehículo sin lista → no rompe layout
    - [ ] AC-E2: abrir public-personal-data con gender vacío → CTA bloqueado; al clicar opción → CTA habilitado
    - [ ] `grep -r "<select" src/app/` devuelve 0 resultados

- [ ] **T5.3** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier reporta todos los ACs cubiertos o tickets resueltos

---

## Fase 6 — Cierre

- [ ] **T6.1** — Actualizar `indices/` si se modificaron tokens/estilos
  - **DoD:**
    - [ ] `indices/DATABASE.md` — nota de `gender CHAR(1)` actualizada con valores M/F/X
    - [ ] `indices/MODELS.md` — actualizar entry de `cursos-singulares.model.ts` si se modificó el tipo
    - [ ] `indices/STYLES.md` — agregar nota de segmented control inline si se formalizó algún token

- [ ] **T6.2** — Marcar spec como `done` en `specs/ROADMAP.md`
  - **DoD:**
    - [ ] Fila de 0013-b movida de "Backlog" a "Done" con fecha de cierre `2026-06-12`

- [ ] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)
  - **DoD:**
    - [ ] `specs/.active` vacío
    - [ ] Spec Gate vuelve a bloquear escrituras en `src/`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
