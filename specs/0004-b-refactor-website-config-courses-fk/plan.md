# Plan 0004-b — refactor-website-config-courses-fk

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-05-22

---

## 1. Resumen ejecutivo

Refactorizar `website_config.config.courses` (hoy JSONB libre con `name/price/licenseClass` duplicados del catálogo operacional) a un JSONB con **FK lógica obligatoria** a `courses.id` + capa editorial libre (`description`, `priceNote`, `duration`, `includes`, `highlighted`, `badge`, `priceOverride`, `displayOrder`). El refactor cubre 3 superficies coordinadas: **(1) BD** (1 migración SQL con triggers validador + bloqueante de DELETE + reset del JSONB legacy + notificación a admins), **(2) Admin Angular** (`CoursesFacade` nuevo + `WebsiteConfigFacade` extendido + componente admin refactor), **(3) Landing Astro externa** (`webs/src/lib/data/getSiteData.ts` hace JOIN con `courses` para resolver `ResolvedCourse[]`, refactor de `Pricing.astro`, actualización de fallbacks JSON estáticos). **Orden grueso:** migración → tipos compartidos → resolver Astro + fallbacks → Angular facades → componente admin → tests → índices.

---

## 2. Inventario de impacto

### Archivos a CREAR

**Repo Angular (`src/`):**

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260523000000_refactor_website_config_courses_fk.sql` | Migration | Trigger validador `course_id ∈ courses AND mismo branch`; trigger bloqueante de DELETE en `courses` referenciados; reset del JSONB legacy a `[]`; notificación in-app a admins |
| `src/app/core/models/ui/resolved-course.model.ts` | UI Model | `ResolvedCourse` — combinación `CourseConfig (DTO)` + datos heredados de `courses` para consumo de la UI |
| `src/app/core/facades/courses.facade.ts` | Facade | Lectura del catálogo operacional. `loadAvailableCourses(branchId)` para alimentar el dropdown del admin. **Branch-scoped**. Cumple regla `facades.md` |
| `src/app/core/facades/courses.facade.spec.ts` | Test | Cobertura: carga por branch, filtra `active=true`, SWR re-entry, error handling |

### Archivos a MODIFICAR

**Repo Angular (`src/`):**

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/dto/website-config.model.ts` | Reescribir `CourseConfig`: eliminar `name/price/licenseClass`; agregar `course_id: number`, `priceOverride: number\|null`, `displayOrder: number` | Nuevo shape post-refactor (AC1, AC2, AC3) |
| `src/app/core/facades/website-config.facade.ts` | Agregar `_availableCourses` signal + `resolvedCourses` computed que hace JOIN en memoria con `CoursesFacade.availableCourses`. Validar `course_id` único en `saveConfig` (AC-E1). Mantener default seed con `courses: []` | Resolución `ResolvedCourse[]` en memoria (decisión sec. 9) |
| `src/app/core/facades/website-config.facade.spec.ts` | Agregar tests: `resolvedCourses` calcula `displayPrice` con/sin override; `displayPrice = 0 → 'Gratis'`; ordenamiento por `displayOrder`; filtrado de cards con `course_id` inválido o curso inactivo | Cobertura AC2, AC3, AC4, AC-E3 |
| `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts` | Reemplazar inputs de `name/price/licenseClass` (líneas 473-495) por `<p-dropdown>` de `availableCourses` + readonly display de `name/basePrice` heredados + checkbox "Personalizar precio para promo" → input `priceOverride`. Agregar campo `displayOrder` (input numérico). Empty state si branch no tiene cursos. Validación de `course_id` único en client + indicador "⚠ Curso inactivo" para cards huérfanas. Inyectar `CoursesFacade`. | AC1, AC3, AC4, AC-E1, AC-E4 |
| `indices/DATABASE.md` | Documentar nueva fila para trigger `trg_validate_website_config_courses_fk` y `trg_prevent_courses_delete_when_in_website_config`. Actualizar fila de `website_config` con shape nuevo del JSONB | Regla `database.md` |
| `indices/FACADES.md` | Agregar `CoursesFacade`. Actualizar descripción de `WebsiteConfigFacade` con `availableCourses` + `resolvedCourses` | Regla `facades.md` |
| `indices/MODELS.md` | Agregar `ResolvedCourse` en sección UI. Actualizar entry de `CourseConfig` con shape nuevo | Regla `models.md` |

**Repo Astro Landing (`C:\Users\Akxlarre\Autoescuela\webs\`):**

| Path | Cambio | Motivo |
|------|--------|--------|
| `webs/src/lib/types.ts` | Reescribir `CourseConfig` con nuevo shape (mirror del DTO Angular: `course_id`, `priceOverride`, `displayOrder`, sin `name/price/licenseClass`). Agregar `ResolvedCourse` interface idéntica al UI model Angular. Cambiar `SiteData.courses: CourseConfig[]` → `SiteData.courses: ResolvedCourse[]` (lo que ve el componente ya viene resuelto) | Consistencia de tipos cross-repo |
| `webs/src/lib/data/getSiteData.ts` | Agregar segundo fetch a `/rest/v1/courses?branch_id=eq.X&active=eq.true` después de obtener `config`. Hacer JOIN en memoria: por cada `CourseConfig` mapear a `ResolvedCourse` con `name/basePrice/licenseClass` del courses + `displayPrice = priceOverride ?? basePrice` + `displayPriceLabel` formateado. Ordenar por `displayOrder` ASC. Filtrar cards con `course_id` huérfano (curso eliminado/inactivo) | AC2, AC3, AC4 (landing consume datos resueltos, no raw) |
| `webs/src/components/Pricing.astro` | Cambiar `course.price` → `course.displayPrice` (renderizar `displayPriceLabel` que ya viene formateado, "Gratis" si 0). Renderizar tachado `basePrice` cuando `isOverrideActive` (AC3) | AC3, AC-E3 |
| `webs/src/components/Services.astro` | Revisar si renderiza courses; si sí, mismo cambio que Pricing | Verificación de consumo |
| `webs/src/content/site/azul.json` | Actualizar fallback estático: `courses[]` con nuevo shape (`course_id`, `priceOverride`, `displayOrder`, sin `name/price/licenseClass`). El SSR usa este JSON solo si Supabase falla, pero debe ser válido como `ResolvedCourse[]` pre-resuelto (incluir `name`, `basePrice`, `licenseClass` directamente porque no hay BD para hacer JOIN) | Fallback de SSR consistente |
| `webs/src/content/site/roja.json` | Idem para branch 2 | Fallback de SSR consistente |
| `webs/src/content.config.ts` | Si usa Zod schema, actualizar al shape de `ResolvedCourse[]` para fallbacks | Type-safety del fallback |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos

- `<p-dropdown>` de PrimeNG — para seleccionar `course_id` (regla `angular-primeng`: con `optionLabel`/`optionValue`, dark mode automático)
- `<app-icon>` (Lucide) — íconos de la tab cursos (`book-open`, `plus`, `trash-2`, `alert-triangle` para warnings de curso inactivo)
- `<app-skeleton-block>` — loading del dropdown mientras carga `availableCourses`
- `<app-empty-state>` — empty state cuando el branch no tiene cursos operacionales (AC-E4)
- `app-section-hero` — ya está en el componente, sin cambios
- `app-kpi-card-variant` — ya está, sin cambios
- `[appBentoGridLayout]`, `[appCardHover]` — ya están, sin cambios
- `LayoutDrawerService` — N/A (no se introduce drawer nuevo; la edición sigue siendo inline)

### Facades/Services existentes que extendemos

- `WebsiteConfigFacade.loadConfig()` / `saveConfig()` — mantener firma, extender `_config` para nuevo shape. Agregar `availableCourses` + `resolvedCourses`. Agregar guard `course_id` único en `saveConfig`
- `BranchFacade.selectedBranchId()` — usar como dependencia en `CoursesFacade.loadAvailableCourses()` para scope (rol admin) y `currentUser().branchId` para secretaria
- `AuthFacade.currentUser()` — leer `role` y `branchId` (secretaria) en `CoursesFacade` siguiendo patrón regla `facades.md` sec. 7
- `NotificationsFacade.createNotification()` — invocado **desde el SQL de migración** (no desde Angular) vía INSERT directo a `notifications` para AC-E5 (un row por cada admin del sistema)
- `ToastService.success/error` — feedback en `saveConfig`

### Componentes/Facades que NO existen y debemos crear

- **`CoursesFacade`** — no existe un Facade dedicado a leer del catálogo operacional `courses` para fines UI. `CursosSingularesFacade` cubre `standalone_courses` (cursos sueltos SENCE/Grúa) — dominio distinto. `EnrollmentFacade` lee `courses` indirectamente en el wizard pero no expone una lista navegable. Crear `CoursesFacade` es la decisión correcta arquitectónicamente: cumple `facades.md` (1 dominio = 1 facade), branch-scoped según patrón sec. 7, reutilizable por futuras specs que necesiten el catálogo operacional como dropdown.
- **`ResolvedCourse` (UI model)** — no existe; es la combinación específica `CourseConfig (DTO) + Course (DTO)` que necesita la UI del admin y la landing. No se puede reutilizar `Course` directo porque pierde los campos editoriales del JSONB.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260523000000_refactor_website_config_courses_fk.sql
-- Spec 0004-b: Refactor website_config.courses → FK al catálogo operacional

-- 1. Función validadora de integridad referencial JSONB ↔ courses
CREATE OR REPLACE FUNCTION public.validate_website_config_courses_fk()
RETURNS TRIGGER AS $$
DECLARE
  card jsonb;
  card_course_id int;
  card_branch_id int;
  course_branch_id int;
  course_exists boolean;
  seen_course_ids int[] := '{}';
BEGIN
  card_branch_id := NEW.branch_id;
  -- Iterar cada card del array config->courses
  FOR card IN SELECT * FROM jsonb_array_elements(NEW.config->'courses') LOOP
    card_course_id := (card->>'course_id')::int;
    -- (a) course_id obligatorio
    IF card_course_id IS NULL THEN
      RAISE EXCEPTION 'website_config.courses: cada card requiere course_id (branch %)', card_branch_id;
    END IF;
    -- (b) course_id existe y pertenece al mismo branch
    SELECT branch_id INTO course_branch_id FROM courses WHERE id = card_course_id;
    IF course_branch_id IS NULL THEN
      RAISE EXCEPTION 'website_config.courses: course_id % no existe', card_course_id;
    END IF;
    IF course_branch_id <> card_branch_id THEN
      RAISE EXCEPTION 'website_config.courses: course_id % pertenece a branch % pero website_config es de branch %',
        card_course_id, course_branch_id, card_branch_id;
    END IF;
    -- (c) course_id único en el array (AC-E1)
    IF card_course_id = ANY(seen_course_ids) THEN
      RAISE EXCEPTION 'website_config.courses: course_id % aparece duplicado en la misma config', card_course_id;
    END IF;
    seen_course_ids := array_append(seen_course_ids, card_course_id);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_validate_website_config_courses_fk
  BEFORE INSERT OR UPDATE ON public.website_config
  FOR EACH ROW EXECUTE FUNCTION public.validate_website_config_courses_fk();

-- 2. Trigger bloqueante de DELETE en courses referenciados (AC-E2)
CREATE OR REPLACE FUNCTION public.prevent_courses_delete_when_in_website_config()
RETURNS TRIGGER AS $$
DECLARE
  ref_count int;
BEGIN
  SELECT COUNT(*) INTO ref_count
  FROM public.website_config wc,
       jsonb_array_elements(wc.config->'courses') AS card
  WHERE (card->>'course_id')::int = OLD.id;

  IF ref_count > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar: % card(s) de website_config referencian este curso. Quitá esas cards desde Configuración Web antes de eliminar el curso del catálogo.', ref_count;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_prevent_courses_delete_when_in_website_config
  BEFORE DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_courses_delete_when_in_website_config();

-- 3. Reset del JSONB legacy a [] (decisión sec. 9 de la spec)
UPDATE public.website_config
SET config = jsonb_set(config, '{courses}', '[]'::jsonb),
    updated_at = now();

-- 4. Audit log de la operación de reset
INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details, created_at)
SELECT NULL, 'website_config.courses.reset_for_refactor', 'website_config', wc.id,
       jsonb_build_object('branch_id', wc.branch_id, 'reason', 'Spec 0004-b: refactor a FK al catálogo operacional'),
       now()
FROM public.website_config wc;

--- 5. Notificación in-app a todos los admins (AC-E5)
-- Guard idempotencia: no duplicar si la migración corre dos veces
INSERT INTO public.notifications (recipient_id, type, title, body, link, is_read, created_at)
SELECT u.id, 'system',
       'Reconfigurá las cards de tu landing',
       'El módulo Configuración Web fue actualizado: ahora cada card de curso debe referenciar un curso del catálogo operacional. Tus cards fueron vaciadas para evitar inconsistencias. Reconstrúilas desde el panel.',
       '/app/admin/configuracion-web', false, now()
FROM public.users u
JOIN public.roles r ON r.id = u.role_id
WHERE r.name = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.recipient_id = u.id
      AND n.title = 'Reconfigurá las cards de tu landing'
      AND n.created_at > now() - interval '7 days'
  );
```

> **Nota:** las columnas exactas de `notifications` y `audit_log` deben verificarse en `tasks.md` (los nombres `type/title/body/link` y `action/entity_type/entity_id/details` son tentativos según convención observada en el proyecto). **Snapshot del JSONB legacy: descartado** por decisión del usuario — se confía en git history de los seeds (`20260522000000`).

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `website_config` | public | SELECT | Sin cambio (ya pública) |
| `website_config` | admin | INSERT/UPDATE/DELETE | Sin cambio (ya admin global) |
| `website_config` | secretary | INSERT/UPDATE/DELETE | Sin cambio (ya `branch_visible`) |
| `courses` | admin | DELETE | **NUEVO:** bloqueado por trigger si está referenciado en `website_config` |
| `notifications` | system | INSERT | Insertado por la migración con `SECURITY DEFINER` |
| `audit_log` | system | INSERT | Insertado por la migración |

### Modelos UI/DTO

**`src/app/core/models/dto/website-config.model.ts` — `CourseConfig` reescrito:**

```typescript
export interface CourseConfig {
  course_id: number;                     // FK obligatoria a courses(id)
  description: string;                   // editorial libre
  priceNote?: string | null;             // editorial libre
  duration: string;                      // editorial libre (humanizado, ej "4 a 6 semanas")
  includes: string[];                    // editorial libre
  highlighted: boolean;
  badge?: string | null;
  priceOverride: number | null;          // null = hereda courses.base_price
  displayOrder: number;                  // numérico explícito (drag-and-drop futuro)
}
```

**`src/app/core/models/ui/resolved-course.model.ts` (nuevo):**

```typescript
export interface ResolvedCourse {
  courseId: number;                      // courses.id heredado
  name: string;                          // courses.name heredado
  licenseClass: string;                  // courses.license_class heredado
  basePrice: number;                     // courses.base_price heredado
  priceOverride: number | null;          // del CourseConfig
  displayPrice: number;                  // computed: override ?? basePrice
  displayPriceLabel: string;             // computed: '$320.000' o 'Gratis' (si 0)
  isOverrideActive: boolean;             // priceOverride !== null
  isCourseActive: boolean;               // courses.active
  description: string;                   // editorial
  priceNote: string | null;              // editorial
  duration: string;                      // editorial
  includes: string[];                    // editorial
  highlighted: boolean;
  badge: string | null;
  displayOrder: number;
}
```

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
ADMIN PANEL (Angular — este repo)
─────────────────────────────────
Admin
  │
  ▼
<AdminConfiguracionWebComponent> (Smart, features/admin/configuracion-web/)
  │  inject: WebsiteConfigFacade, CoursesFacade, BranchFacade, AuthFacade, ToastService
  │  effect: observa BranchFacade.selectedBranchId() → carga config + availableCourses
  │
  ├─► CoursesFacade.loadAvailableCourses(branchId)
  │     ▼
  │   .from('courses').select('id, name, license_class, base_price, active')
  │     .eq('branch_id', branchId).eq('active', true)
  │     ▼ retorna availableCourses signal
  │
  ├─► WebsiteConfigFacade.loadConfig(branchId)
  │     ▼ retorna config con courses[] (puede ser [] post-migración)
  │     ▼
  │   computed resolvedCourses = JOIN(config.courses, availableCourses)
  │
  └─► Template tab "Cursos & Precios":
        FormArray con cards: dropdown(availableCourses) + description/duration/includes/etc.
        Al guardar → WebsiteConfigFacade.saveConfig(branchId, newConfig)
                       │
                       ▼
                     trg_validate_website_config_courses_fk (BD)
                       │
                       ├─ OK → UPDATE + toast.success
                       └─ FAIL → exception → toast.error con mensaje del trigger

LANDING PUBLICA (Astro — repo webs/)
────────────────────────────────────
Visitante (SSR)
  │
  ▼
src/pages/index.astro → getSiteData(brand)
  │
  ▼
src/lib/data/getSiteData.ts
  │
  ├─► GET /rest/v1/website_config?branch_id=eq.X&select=config
  │     ▼ obtiene { courses: CourseConfig[] (con course_id, priceOverride, displayOrder, editorial) }
  │
  ├─► GET /rest/v1/courses?branch_id=eq.X&active=eq.true
  │     ▼ obtiene Course[] (id, name, license_class, base_price, active)
  │
  └─► JOIN en memoria → SiteData.courses: ResolvedCourse[] (ordenado por displayOrder)
        │
        ▼
      <Pricing.astro data={data.courses} brand={data.brand} />
      Renderiza course.displayPriceLabel ("$320.000" o "Gratis")
      Si course.isOverrideActive → tachado course.basePrice
```

### Capas tocadas

**Angular:**
- **Smart**: `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts`
- **Dumb**: ninguno nuevo (se reutilizan PrimeNG y shared existentes)
- **Facade**: `src/app/core/facades/courses.facade.ts` (nuevo) + `src/app/core/facades/website-config.facade.ts` (modificado)
- **Service**: ninguno
- **Migration**: `supabase/migrations/20260523000000_refactor_website_config_courses_fk.sql`

**Astro (`webs/`):**
- **Data layer**: `webs/src/lib/data/getSiteData.ts` (extender con JOIN)
- **Types**: `webs/src/lib/types.ts` (mirror del DTO + UI model)
- **Components**: `webs/src/components/Pricing.astro` (+ posiblemente `Services.astro`)
- **Fallbacks**: `webs/src/content/site/{azul,roja}.json` (pre-resueltos como `ResolvedCourse[]`)

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Patrón Facade estricto (UI no toca Supabase directo), OnPush en componente admin, Signals para estado
- [x] `facades.md` — `CoursesFacade` branch-scoped según sec. 7 (admin = `BranchFacade.selectedBranchId()`, secretaria = `user.branchId`); `effect()` de reactividad va en el Smart component, no en el Facade
- [x] `models.md` — `CourseConfig` queda en `dto/` (mapea JSONB de tabla), `ResolvedCourse` queda en `ui/` (combinación derivada); nomenclatura PascalCase singular
- [x] `visual-system.md` — tokens semánticos (no hardcodear); el badge "⚠ Precio override activo" usa `var(--state-warning)`; el badge "Curso inactivo" usa `var(--state-danger)`; íconos vía `<app-icon>` (no emojis)
- [ ] `swr-pattern.md` — `WebsiteConfigFacade` ya tiene SWR (`_initialized` + `_lastBranchId`); `CoursesFacade` también debe implementarlo. No Realtime (no es recurso de alta contención multi-usuario)
- [x] `notifications.md` — `ToastService` para feedback (capa 1); insert directo en `notifications` desde la migración para AC-E5 (capa 2); sin uso de `DashboardAlertsFacade`
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para `CoursesFacade` y para nuevos métodos de `WebsiteConfigFacade` (test de `resolvedCourses` computed, validación de duplicados); Vitest, no Jasmine
- [x] `ai-readability.md` — agregar `data-llm-action="select-website-course"` al dropdown, `data-llm-action="save-website-config"` al botón guardar, `data-llm-description` a los inputs editoriales
- [x] `form-ux` (skill) — el formulario del tab cursos sigue el patrón canónico de secciones + footer de acción ya existente en el componente
- [x] `database.md` — migración idempotente (`CREATE OR REPLACE FUNCTION`, `IF NOT EXISTS` donde aplica), RLS de `website_config` ya existente sin cambio, documentar trigger en `DATABASE.md`

---

## 7. Plan de testing

### Tests unitarios (Vitest)

**`courses.facade.spec.ts` (nuevo):**
- `loadAvailableCourses(branchId)` filtra correctamente por branch
- Solo retorna cursos `active=true`
- SWR: segunda llamada con mismo branchId no re-fetchea con skeleton
- SWR: cambio de branchId invalida cache
- Manejo de error: `_error` se setea, toast disparado

**`website-config.facade.spec.ts` (extendido):**
- `resolvedCourses` computed: combina `_config.courses` + `_availableCourses` correctamente
- `displayPrice` = `priceOverride` cuando no es null
- `displayPrice` = `basePrice` cuando `priceOverride` es null
- `displayPriceLabel` = "Gratis" cuando `displayPrice === 0` (AC-E3)
- `displayPriceLabel` formatea CLP en otros casos ("$350.000")
- Ordenamiento por `displayOrder` ASC, desempate por `courseId` ASC
- Cards con `course_id` no presente en `availableCourses` se marcan `isCourseActive=false` (no se filtran — la UI decide qué hacer)
- `saveConfig` rechaza si hay `course_id` duplicado (client-side guard AC-E1)

### Tests de integración

- N/A (no hay tests E2E configurados en el proyecto actualmente; los triggers SQL se validan con `npx supabase start` en QA manual)

### QA manual (golden path + edge cases)

1. **Golden path:** abrir tab Cursos, agregar card, seleccionar curso del dropdown, completar editorial, guardar → toast success → reload → datos persistidos.
2. **AC1:** intentar guardar card sin `course_id` → bloqueado client-side; si se bypasea (DevTools) → trigger SQL bloquea.
3. **AC2:** cambiar `courses.base_price` desde catálogo operacional (otro componente) → la card refleja el nuevo precio sin tocar Config Web.
4. **AC3:** activar `priceOverride`, ingresar `320000`, guardar → landing muestra "$320.000" + tachado "$350.000"; admin muestra badge "⚠ Precio override activo".
5. **AC-E1:** agregar dos cards con el mismo `course_id` → error client-side antes de guardar.
6. **AC-E2:** intentar DELETE en `courses` desde Supabase Dashboard de un curso referenciado → operación bloqueada con mensaje del trigger.
7. **AC-E3:** setear `priceOverride = 0` → landing/admin muestran "Gratis" + badge "Curso gratuito".
8. **AC-E4:** crear nuevo branch sin cursos operacionales → tab Cursos muestra empty state con CTA al catálogo operacional.
9. **AC4:** marcar un curso operacional como `active=false` → la card referenciada se oculta de la landing y muestra warning "Curso inactivo" en admin.
10. **Migración:** correr `npx supabase db reset` localmente → verificar que las cards quedan en `[]` y que se insertaron notificaciones para todos los admins.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| **Desincronización Astro ↔ Angular ↔ BD si los 3 deploys no van juntos** | Media | Los 3 cambios viven en este plan: misma rama, mismo commit-set. Build local de `webs/` (`npm run build`) antes de mergear para verificar que el SSR resuelve OK contra Supabase local (`npx supabase start`). |
| **El trigger validador es costoso si el JSONB crece** | Baja | Hoy máximo ~5 cards por branch. Si crece a >50, refactorizar a tabla normalizada `website_config_courses` (out-of-scope esta spec). |
| **Trigger de DELETE bloquea operaciones legítimas si el admin olvida limpiar la card primero** | Media | El mensaje del trigger es explícito y contiene la cantidad de cards. Adicional: en el componente de catálogo operacional, mostrar warning visual "Este curso está publicado en N cards de la web" antes de permitir DELETE (out-of-scope esta spec, anotar para fix-track futuro). |
| **`CoursesFacade` se vuelve sobre-cargado si otros features lo extienden sin coordinación** | Baja | Mantener scope estricto: solo lectura de catálogo activo por branch. CRUD de courses (si se construye en futuro) va en otro Facade (`CoursesCatalogFacade` o similar). |
| **Las notificaciones in-app del INSERT en la migración pueden duplicarse si la migración se corre dos veces** | Baja | Idempotencia ya incluida en el SQL: `NOT EXISTS` guard de 7 días. |
| **El trigger de validación falla si `config.courses` no existe (config legacy malformado)** | Baja | `jsonb_array_elements(NEW.config->'courses')` con `NEW.config->'courses' IS NULL` retorna conjunto vacío → no falla. Verificar empíricamente en tasks.md con test SQL dedicado. |
| **El fallback estático de `webs/src/content/site/*.json` queda obsoleto y oculta bugs del SSR** | Media | Actualizar ambos JSONs (`azul.json`, `roja.json`) con datos `ResolvedCourse[]` pre-resueltos válidos. Documentar en el commit que el fallback debe regenerarse cada vez que cambia el shape. |
| **La landing Astro consume CORS de Supabase incorrectamente para `courses`** | Baja | `courses` ya tiene policy SELECT pública para anon (migración `20260314100000_public_enrollment_anon_rls.sql`). Verificar empíricamente en QA. |

---

## 9. Orden de implementación

1. **Migración SQL** (`20260523000000_refactor_website_config_courses_fk.sql`) — incluye triggers, reset, audit, notificaciones. Probar local con `npx supabase db reset`.
2. **Tipos compartidos** — actualizar `CourseConfig` en Angular (`src/app/core/models/dto/website-config.model.ts`) Y en Astro (`webs/src/lib/types.ts`). Crear `ResolvedCourse` en ambos repos.
3. **Astro: data layer + componentes + fallbacks** — refactor `getSiteData.ts` con JOIN, `Pricing.astro` con displayPrice, fallbacks JSON pre-resueltos. Validar SSR local con `npm run dev` apuntando a Supabase local.
4. **`CoursesFacade` + `.spec.ts`** — TDD: escribir tests primero, implementar después. Validar branch-scoped según `facades.md` sec. 7.
5. **`WebsiteConfigFacade` extendido + `.spec.ts` actualizado** — agregar `_availableCourses`, `resolvedCourses` computed, guard `course_id` único en `saveConfig`.
6. **Refactor de `AdminConfiguracionWebComponent`** — solo tab "Cursos & Precios" (líneas 444-535 + lógica del FormArray líneas 1039-1189 aprox). Inyectar `CoursesFacade`. Reemplazar inputs por dropdown. Agregar `effect()` de reactividad branch.
7. **Sincronización de índices** — DATABASE.md, FACADES.md, MODELS.md.
8. **QA manual end-to-end** — admin edita card → guarda → landing Astro la renderiza correctamente con precio heredado y/o override.
9. **`/spec-verify`** → generar `acceptance.md` con evidencia.

---

## 10. Estimación

**M-L (Medium-Large)** — ~10-12 horas totales (Angular + Astro + QA end-to-end).

Desglose:
- Migración SQL + pruebas locales: 1.5h
- Tipos compartidos (Angular DTO + Astro types + ResolvedCourse en ambos): 0.5h
- Astro: getSiteData refactor + Pricing + fallbacks JSON: 2h
- CoursesFacade + spec (TDD): 1.5h
- WebsiteConfigFacade refactor + spec extendido: 2h
- Componente admin refactor: 2h
- Índices Angular: 0.5h
- QA manual end-to-end (admin → BD → SSR landing): 2h

---

## Changelog

- 2026-05-22 — plan inicial generado por `/spec-plan` con decisiones de spec aprobadas.
- 2026-05-22 — ampliado para incluir refactor coordinado del repo Astro `webs/` (data layer + Pricing.astro + fallbacks); riesgo #1 (landing externa) eliminado al confirmar acceso al repo; snapshot del JSONB legacy descartado por decisión del usuario; idempotencia de notificaciones movida al SQL.
