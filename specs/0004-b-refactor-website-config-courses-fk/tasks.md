# Tasks 0004-b — refactor-website-config-courses-fk

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-05-22

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting (~30-90 min máx).
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos, migración y tipos compartidos

- [x] **T1.1** — Crear migración `supabase/migrations/20260523000000_refactor_website_config_courses_fk.sql`
  - **AC ref:** AC1, AC2, AC5, AC6, AC-E1, AC-E2, AC-E5
  - **DoD:**
    - [ ] Archivo creado con naming `YYYYMMDDHHMMSS_dominio_tipo_desc.sql` correcto
    - [ ] Función `validate_website_config_courses_fk()` definida con `SECURITY DEFINER` — valida (a) `course_id` no null, (b) `course_id` existe en `courses`, (c) pertenece al mismo `branch_id` que la `website_config`, (d) `course_id` único en el array
    - [ ] Trigger `trg_validate_website_config_courses_fk` BEFORE INSERT OR UPDATE en `public.website_config`
    - [ ] Función `prevent_courses_delete_when_in_website_config()` definida — cuenta refs en `website_config.config->'courses'`, lanza excepción con mensaje del trigger AC-E2
    - [ ] Trigger `trg_prevent_courses_delete_when_in_website_config` BEFORE DELETE en `public.courses`
    - [ ] `UPDATE website_config SET config = jsonb_set(config, '{courses}', '[]'::jsonb)` aplicado a todos los rows
    - [ ] INSERT a `audit_log` con acción `website_config.courses.reset_for_refactor` por cada branch afectado (verificar nombres de columnas reales de `audit_log` antes de escribir)
    - [ ] INSERT a `notifications` para todos los users con `roles.name='admin'` con guard de idempotencia `NOT EXISTS ... created_at > now() - interval '7 days'` (verificar nombres de columnas reales de `notifications`)
    - [ ] `npx supabase db reset` corre sin error
    - [ ] `SELECT config->'courses' FROM website_config;` retorna `[]` para todos los rows post-migración
    - [ ] Test SQL manual: `INSERT website_config (branch_id, config) VALUES (1, '{"courses":[{"course_id":99999}]}'::jsonb)` falla con mensaje del trigger
    - [ ] Test SQL manual: `INSERT ... config con course_id válido` pasa OK; segundo INSERT con mismo course_id duplicado falla
    - [ ] Test SQL manual: `DELETE FROM courses WHERE id = X` (con X referenciado en website_config tras un INSERT manual previo) falla con mensaje del trigger
    - [ ] Verificado: `jsonb_array_elements(NEW.config->'courses')` con `courses` ausente no falla

- [x] **T1.2** — Reescribir `CourseConfig` en `src/app/core/models/dto/website-config.model.ts`
  - **AC ref:** AC1, AC2, AC3
  - **DoD:**
    - [ ] Campos eliminados: `name`, `price`, `licenseClass`
    - [ ] Campos agregados: `course_id: number`, `priceOverride: number \| null`, `displayOrder: number`
    - [ ] Campos editoriales preservados: `description`, `priceNote`, `duration`, `includes`, `highlighted`, `badge`
    - [ ] Compila sin errores TS (`ng build` o `tsc --noEmit`)
    - [ ] Documentado en `indices/MODELS.md` (entry actualizado)

- [x] **T1.3** — Crear `src/app/core/models/ui/resolved-course.model.ts`
  - **AC ref:** AC7
  - **DoD:**
    - [ ] Interface `ResolvedCourse` exportada con todos los campos del plan sec. 4: `courseId`, `name`, `licenseClass`, `basePrice`, `priceOverride`, `displayPrice`, `displayPriceLabel`, `isOverrideActive`, `isCourseActive`, `description`, `priceNote`, `duration`, `includes`, `highlighted`, `badge`, `displayOrder`
    - [ ] Documentado en `indices/MODELS.md` (sección UI)
    - [ ] Compila sin errores TS

- [x] **T1.4** — Reescribir `CourseConfig` y agregar `ResolvedCourse` en `webs/src/lib/types.ts`
  - **AC ref:** AC1, AC2, AC3, AC7
  - **DoD:**
    - [ ] `CourseConfig` mirror exacto del DTO Angular (mismo shape)
    - [ ] `ResolvedCourse` mirror exacto del UI model Angular
    - [ ] `SiteData.courses` cambia tipo: `CourseConfig[]` → `ResolvedCourse[]` (porque el consumidor recibe datos ya resueltos por `getSiteData`)
    - [ ] Compila sin errores (`npx tsc --noEmit` en `webs/`)

---

## Fase 2 — Refactor Astro (landing)

- [x] **T2.1** — Refactorizar `webs/src/lib/data/getSiteData.ts` para hacer JOIN con `courses`
  - **AC ref:** AC2, AC3, AC4, AC-E3
  - **DoD:**
    - [ ] Después del fetch a `website_config`, hace segundo fetch a `/rest/v1/courses?branch_id=eq.X&active=eq.true&select=id,name,license_class,base_price,active`
    - [ ] Función pura `resolveCourses(rawCourses: CourseConfig[], catalog: Course[]): ResolvedCourse[]` — mapea cada `CourseConfig` a `ResolvedCourse` haciendo lookup por `course_id`
    - [ ] `displayPrice = priceOverride ?? basePrice`
    - [ ] `displayPriceLabel`: `'Gratis'` si `displayPrice === 0`, sino formato CLP (`new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })`)
    - [ ] `isOverrideActive = priceOverride !== null`
    - [ ] `isCourseActive`: true si encuentra match en catalog, false si no
    - [ ] Filtra cards huérfanas (sin match en catalog) — `.filter(rc => rc.isCourseActive)`
    - [ ] Ordenado por `displayOrder` ASC, desempate por `courseId` ASC
    - [ ] Fallback estático sigue funcionando (retorna `getEntry('site', brand).data` ya como `ResolvedCourse[]`)
    - [ ] Logging: `console.log('[Astro SSR] Resolvió N courses para branch X')`

- [x] **T2.2** — Actualizar `webs/src/components/Pricing.astro` para consumir `ResolvedCourse`
  - **AC ref:** AC3, AC-E3
  - **DoD:**
    - [ ] Cambio de prop: `data: CourseConfig[]` → `data: ResolvedCourse[]`
    - [ ] `formatPrice(course.price)` reemplazado por `course.displayPriceLabel` (ya viene formateado)
    - [ ] Si `course.isOverrideActive` → renderizar `<span class="price-original-strike">{formatPrice(course.basePrice)}</span>` antes/después del precio activo (con estilo `text-decoration: line-through`)
    - [ ] Si `course.displayPrice === 0` → mostrar badge "Curso gratuito" (clase nueva `.badge-free`)
    - [ ] Estilo CSS agregado: `.price-original-strike { text-decoration: line-through; color: var(--text-muted); font-size: 0.875em; }` y `.badge-free` con tema brand
    - [ ] Build `npm run build` corre sin errores

- [x] **T2.3** — Verificar y actualizar `webs/src/components/Services.astro` si consume courses
  - **AC ref:** AC4
  - **DoD:**
    - [ ] Inspeccionar el archivo: si consume `courses[]`, mismo tratamiento que `Pricing.astro` (usar `ResolvedCourse`)
    - [ ] Si NO consume courses → marcar como N/A en el commit message
    - [ ] Si hay otros componentes (`grep` `data.courses` en `webs/src`), incluirlos también

- [x] **T2.4** — Actualizar fallbacks estáticos `webs/src/content/site/azul.json` y `roja.json`
  - **AC ref:** AC2, AC3
  - **DoD:**
    - [ ] `azul.json`: `courses[]` con shape `ResolvedCourse` pre-resuelto (incluir `courseId`, `name`, `licenseClass`, `basePrice`, `displayPrice`, `displayPriceLabel`, `isOverrideActive: false`, `isCourseActive: true`, `priceOverride: null`, `displayOrder`)
    - [ ] Para `courseId`: usar IDs reales de `courses` para branch 1 (verificar con `SELECT id, name FROM courses WHERE branch_id=1 AND active=true`)
    - [ ] `roja.json`: idem para branch 2
    - [ ] Schema en `webs/src/content.config.ts` actualizado (si usa Zod) — verificar primero si tiene schema definido para `courses`
    - [ ] `npm run dev` levanta SSR consumiendo el fallback sin errores (apagar Supabase local para forzar fallback y verificar)

---

## Fase 3 — Capa Facade Angular

- [x] **T3.1** — Escribir `src/app/core/facades/courses.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC1, AC-E4
  - **DoD:**
    - [ ] Test: `loadAvailableCourses(branchId)` llama `.from('courses').select(...).eq('branch_id', X).eq('active', true)`
    - [ ] Test: `availableCourses()` retorna array de cursos activos del branch
    - [ ] Test: SWR — segunda llamada con mismo branchId no re-fetchea con skeleton (`_isLoading` no se setea true)
    - [ ] Test: cambio de branchId invalida cache (`_lastBranchId !== branchId` fuerza fetch)
    - [ ] Test: error de Supabase setea `_error` y dispara `toast.error`
    - [ ] Test: branch sin cursos activos retorna `[]` (AC-E4)
    - [ ] Vitest + `vi.fn()` (NO Jasmine)
    - [ ] Tests FALLAN (no hay implementación aún)

- [x] **T3.2** — Implementar `src/app/core/facades/courses.facade.ts`
  - **AC ref:** AC1, AC-E4
  - **DoD:**
    - [ ] Tests de T3.1 PASAN (`npm run test:ci`)
    - [ ] Estructura: estado privado (`_availableCourses`, `_isLoading`, `_error`, `_initialized`, `_lastBranchId`) → readonly público → métodos
    - [ ] Inyecta `SupabaseService`, `BranchFacade`, `AuthFacade`, `ToastService`
    - [ ] Branch-scoped según `facades.md` sec. 7: admin lee `BranchFacade.selectedBranchId()`, secretaria usa `authFacade.currentUser().branchId`
    - [ ] `loadAvailableCourses(branchId: number)` con guard SWR
    - [ ] `catchError` en cada llamada async; toast.error en branch error
    - [ ] Documentado en `indices/FACADES.md`

- [x] **T3.3** — Extender `src/app/core/facades/website-config.facade.spec.ts` con nuevos tests
  - **AC ref:** AC2, AC3, AC4, AC7, AC-E1, AC-E3
  - **DoD:**
    - [ ] Test: `resolvedCourses()` combina `_config.courses` + `_availableCourses` correctamente (JOIN en memoria)
    - [ ] Test: `displayPrice = priceOverride` cuando no es null
    - [ ] Test: `displayPrice = basePrice` cuando `priceOverride === null`
    - [ ] Test: `displayPriceLabel === 'Gratis'` cuando `displayPrice === 0` (AC-E3)
    - [ ] Test: `displayPriceLabel` formatea CLP en otros casos (`'$350.000'`)
    - [ ] Test: ordenamiento por `displayOrder` ASC, desempate por `courseId` ASC
    - [ ] Test: cards con `course_id` ausente en availableCourses se marcan `isCourseActive=false` (AC4)
    - [ ] Test: `saveConfig` rechaza configs con `course_id` duplicado y dispara `toast.error` (AC-E1 client-side)
    - [ ] Tests FALLAN (sin implementación aún)

- [x] **T3.4** — Extender `src/app/core/facades/website-config.facade.ts`
  - **AC ref:** AC2, AC3, AC4, AC7, AC-E1, AC-E3
  - **DoD:**
    - [ ] Tests de T3.3 PASAN
    - [ ] Signal privado `_availableCourses = signal<CoursesCatalogItem[]>([])` + readonly público (alternativa: inyectar `CoursesFacade` y consumir su signal — preferida si funciona con OnPush)
    - [ ] `computed resolvedCourses` que hace el JOIN en memoria
    - [ ] Validación pre-save: en `saveConfig`, antes del UPSERT, verificar `course_id` único en el array; si no, return false + toast.error
    - [ ] Default seed (`getDefaultConfig`) mantiene `courses: []`
    - [ ] Documentado en `indices/FACADES.md` (actualizar descripción)

---

## Fase 4 — Refactor Componente Admin

- [x] **T4.1** — Refactor del tab "Cursos & Precios" en `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts`
  - **AC ref:** AC1, AC3, AC4, AC-E1, AC-E4
  - **DoD:**
    - [ ] Inyecta `CoursesFacade`
    - [ ] `effect()` para reactividad branch: cuando `BranchFacade.selectedBranchId()` cambia, llamar `coursesFacade.loadAvailableCourses(branchId)` + `websiteConfigFacade.loadConfig(branchId)` en paralelo
    - [ ] FormArray cambia shape: campos `course_id` (required), `description`, `priceNote`, `duration`, `includes`, `highlighted`, `badge`, `priceOverride`, `displayOrder`. Eliminar `name`, `price`, `licenseClass`
    - [ ] Template tab cursos (líneas 444-535) reemplazado:
      - Dropdown `<p-dropdown>` o `<select>` con `availableCourses` (optionLabel=`name`, optionValue=`id`)
      - Readonly display del `name` y `basePrice` heredados (computed en TS)
      - Checkbox "Personalizar precio para promo" → toggle del input `priceOverride`
      - Input numérico `displayOrder`
      - Empty state si `availableCourses().length === 0` (AC-E4) — CTA al catálogo operacional
      - Badge warning "⚠ Curso inactivo" si la card tiene `course_id` no presente en availableCourses (AC4)
      - Validación visual de `course_id` único (resaltar duplicados en rojo)
    - [ ] Lógica de `addCourse()` / `removeCourse()` actualizada al nuevo shape
    - [ ] Lógica de `populateFormFromConfig()` (líneas ~1163-1189) actualizada
    - [ ] OnPush respetado
    - [ ] `<app-icon>` para todos los íconos (no emojis)
    - [ ] Atributos `data-llm-action="select-website-course"` en el dropdown, `data-llm-action="save-website-config"` en el botón guardar, `data-llm-description` en inputs editoriales
    - [ ] Tokens semánticos para colores (badges usan `var(--state-warning)`, `var(--state-danger)`)
    - [ ] `npm run lint:arch` corre limpio

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio sin warnings nuevos
- [x] **T5.2** — `npm run test:ci` corre verde (incluye nuevos tests de CoursesFacade y WebsiteConfigFacade extendidos)
- [x] **T5.3** — Build Astro `cd webs && npm run build` corre sin errores
- [x] **T5.4** — QA manual end-to-end (10 casos del plan sec. 7)
  - **DoD:** cada AC marcado con evidencia (screenshot o paso reproducible) en `acceptance.md`:
    - [ ] Golden path: agregar card → guardar → reload → persiste
    - [ ] AC1: card sin course_id bloqueada client-side
    - [ ] AC2: cambio de `courses.base_price` se refleja sin tocar Config Web
    - [ ] AC3: override activo → "$320.000" + tachado "$350.000"
    - [ ] AC-E1: dos cards con mismo course_id → error
    - [ ] AC-E2: DELETE de curso referenciado bloqueado por trigger
    - [ ] AC-E3: `priceOverride = 0` → "Gratis" + badge
    - [ ] AC-E4: branch sin cursos → empty state
    - [ ] AC4: curso operacional `active=false` → card oculta en landing + warning en admin
    - [ ] AC-E5: post-migración, notificación in-app aparece para admins en `/app/admin/configuracion-web`
    - [ ] End-to-end: admin edita en Angular → landing Astro la refleja correctamente al recargar

- [x] **T5.5** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos antes de cerrar

---

## Fase 6 — Cierre

- [x] **T6.1** — Sincronizar índices (`/sync-indices` o manual)
  - **DoD:**
    - [ ] `indices/DATABASE.md` actualizado: nuevas funciones `validate_website_config_courses_fk()` y `prevent_courses_delete_when_in_website_config()`, triggers correspondientes, nueva descripción del shape JSONB de `website_config.config.courses`
    - [ ] `indices/FACADES.md` actualizado: nueva entrada `CoursesFacade`, descripción actualizada de `WebsiteConfigFacade`
    - [ ] `indices/MODELS.md` actualizado: nueva entrada `ResolvedCourse`, entrada `CourseConfig` actualizada
    - [ ] Auto-Index AST regenerado si tiene script

- [x] **T6.2** — Marcar spec como `done` en `specs/ROADMAP.md`
  - **DoD:**
    - [ ] Mover fila de "Backlog" a "Done"
    - [ ] Agregar fecha de cierre y notas (% AC verificados)

- [x] **T6.3** — Limpiar `specs/.active` con `/spec-activate --clear`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
