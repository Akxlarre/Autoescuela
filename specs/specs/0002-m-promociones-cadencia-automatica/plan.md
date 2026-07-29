# Plan 0002-m — Promociones automáticas: cadencia, matrícula tardía y convalidaciones

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-07-28

---

## 1. Resumen ejecutivo

Se agrega una función SQL + `pg_cron` que garantiza que siempre exista la `professional_promotion`
del próximo lunes según la cadencia de 14 días (con sus `promotion_courses` y, explícitamente, su
`class_book` — hoy ese registro se crea de forma perezosa y puede no existir nunca). En paralelo, se
agrega una validación de matrícula tardía en `EnrollmentFacade.saveAssignment()`: si la promoción
elegida lleva más de 3 días iniciada, se muestra un modal de confirmación (reutilizando
`ConfirmModalService`, ya inyectado en el facade) antes de persistir. AC3 (listar varias promociones
activas) **ya está implementado** — solo requiere test de regresión, no código nuevo.

Orden: (1) migración SQL, (2) exponer `start_date` de la promoción en `PromotionOption`, (3)
validación + modal en el facade, (4) tests, (5) sync de índices.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260728HHMMSS_auto_create_next_promotion.sql` | Migration | Función `auto_create_next_promotion()` + job `pg_cron` cada 14 días (o chequeo diario idempotente, ver §4) que crea la promoción del próximo lunes, sus `promotion_courses` (uno por curso profesional activo, `is_convalidation=false`) y el `class_book` de cada uno. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/enrollment-assignment.model.ts` | Agregar `promotionStartDate: string` a `PromotionOption` | El facade necesita la fecha de inicio de la promoción padre para calcular días transcurridos, no solo el `promotion_course.id`. |
| `src/app/core/facades/enrollment.facade.ts` | (a) `loadPromotions()`: incluir `start_date` en el `select()` de `professional_promotions` y mapearlo a `PromotionOption.promotionStartDate`. (b) `saveAssignment()`: antes del branch Profesional, calcular días desde `promotionStartDate` de la opción seleccionada; si > 3, llamar `this.confirm({...})` (ya existe el wrapper) y abortar si el usuario cancela. | Implementa AC4/AC5. Reutiliza el wrapper `confirm()` ya presente en el facade — no se toca `ConfirmModalService`. |
| `src/app/core/facades/enrollment.facade.spec.ts` | Tests nuevos para el punto (b) | TDD obligatorio en facades (`testing-tdd.md`). |
| `indices/DATABASE.md` | Actualizar filas de `professional_promotions` / `class_book` con el nuevo job automático | Sync obligatorio de índices tras tocar BD. |
| `indices/FACADES.md` | Documentar el nuevo comportamiento de `saveAssignment()` (matrícula tardía) | Sync obligatorio. |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-assignment-step` (`shared/components/matricula-steps/assignment/assignment.component.ts`)
  ya itera `promotionGroups[]` y ya muestra varias promociones activas simultáneamente (AC3) — no
  se toca.

### Facades/Services existentes que extendemos
- `EnrollmentFacade.loadPromotions()` — agregar `start_date` al select.
- `EnrollmentFacade.saveAssignment()` — agregar el gate de matrícula tardía.
- `EnrollmentFacade.confirm()` (ya delega a `ConfirmModalService.confirm()`) — se reutiliza tal
  cual, sin modificar su firma.
- `auto_transition_promotion_status()` y `cascade_promotion_status_to_courses()` (SQL existentes)
  — el trigger/función nueva convive con ellos, no los reemplaza ni duplica su lógica de status.

### Componentes/Facades que NO existen y debemos crear
- Ninguno. Todo el patrón de confirmación y de listado de promociones ya existe; el único
  artefacto nuevo real es la migración SQL.

---

## 4. Modelo de datos

### Migración requerida

**Nota de alcance (owner, 2026-07-28):** Clase Profesional solo opera en `branch_id = 2`
(Conductores Chillán) y eso no va a cambiar — la función NO recorre sedes, hardcodea el branch
igual que `crearPromocion()` hoy. La numeración de `code` es una secuencia global (no por sede).
El botón manual "Programar Promoción" (`crearPromocion()`) se mantiene intacto como fallback
para lunes fuera del cron — esta función no lo reemplaza ni lo deprecia.

```sql
-- supabase/migrations/20260728HHMMSS_auto_create_next_promotion.sql

CREATE OR REPLACE FUNCTION public.auto_create_next_promotion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_last_start   DATE;
  v_next_start   DATE;
  v_last_code    INT;
  v_next_code    TEXT;
  v_promo_id     INT;
  v_pc_id        INT;
  v_course       RECORD;
  v_suffix       TEXT;
BEGIN
  -- 1. v_last_start := MAX(start_date) de professional_promotions (branch_id=2)
  --    v_next_start := v_last_start + 14 (si no hay ninguna, ancla al próximo lunes de hoy)
  -- 2. Idempotencia: si ya existe una promoción con start_date = v_next_start → salir (AC-E1)
  -- 3. v_last_code := MAX(code::int) de professional_promotions con code numérico
  --    v_next_code := (v_last_code + 1)::text   -- AC1b, secuencia global simple
  --    (si no hay ninguna con code numérico, requiere semilla manual — no hay "code 0" válido;
  --     documentar en tasks.md cómo se resuelve el primer caso si aplica)
  -- 4. INSERT professional_promotions (code=v_next_code, status='planned', start_date,
  --    end_date = start_date+29, branch_id=2)
  -- 5. Por cada curso profesional relevante (is_convalidation=false, branch_id=2):
  --      INSERT promotion_courses (promotion_id, course_id, status='planned',
  --        code = v_next_code || '.' || v_suffix)
  --        v_suffix = dígito 2-5 de courses.license_class (verificado en
  --        core/utils/license-suffix.utils.ts: `licenseClass.match(/[2-5]/)` — trivial de
  --        replicar en SQL, ej. `substring(course.license_class from '[2-5]')`)
  --      INSERT class_book (branch_id=2, promotion_course_id, period=v_next_code, status='draft')
  --        ← EXPLÍCITO: no depender de saveClassBookFields()/generate-class-book-pdf,
  --          que son los 2 únicos puntos de creación hoy (ver spec.md §6).
  -- (pseudo-código — el detalle exacto de cursos se resuelve en tasks.md)
END;
$$;

COMMENT ON FUNCTION public.auto_create_next_promotion()
  IS 'Invocada por pg_cron diariamente. Garantiza que exista la próxima professional_promotion
      (branch_id=2, único con Profesional) según cadencia de 14 días (lunes), con code
      secuencial global, sus promotion_courses y class_book ya creados,
      aunque queden sin alumnos matriculados.';

SELECT cron.unschedule('auto-create-next-promotion')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-next-promotion');

SELECT cron.schedule(
  'auto-create-next-promotion',
  '0 6 * * *',   -- diario, mismo horario que auto_transition_promotion_status — chequeo
                 -- idempotente, no crea si ya existe la promoción del próximo lunes.
  $$ SELECT public.auto_create_next_promotion(); $$
);
```

**Nota de duración:** `end_date = start_date + 29` (30 días de punta a punta) para mantener el
solapamiento de ~2 promociones vivas simultáneamente con cadencia de 14 días, según lo confirmado
por el owner. Confirmar el valor exacto de `end_date` contra `crearPromocion()` actual
(`promociones.facade.ts`) al escribir la tarea — hoy `end_date` lo calcula el formulario manual, no
hay una constante única en BD que citar.

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `professional_promotions` | service_role (`SECURITY DEFINER`) | INSERT | Sin cambios — la función corre con privilegios de servicio, igual que `auto_transition_promotion_status()`. Policies de usuario (`admin`/`secretary` INSERT) no se tocan. |
| `promotion_courses` | service_role | INSERT | Igual. |
| `class_book` | service_role | INSERT | Igual. |

### Modelos UI/DTO

- `core/models/ui/enrollment-assignment.model.ts` → `PromotionOption` gana el campo
  `promotionStartDate: string` (fecha ISO de `professional_promotions.start_date`). No es DTO
  nuevo, es una extensión del UI model existente (`models.md` §3 — extender, no duplicar).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
[pg_cron 06:00 UTC diario]
        │
        ▼
auto_create_next_promotion()  (SQL, SECURITY DEFINER)
        │  crea professional_promotions + promotion_courses + class_book
        ▼
   (sin UI directa — visible en AdminProfesionalPromocionesComponent
    y en el selector del wizard, ambos ya leen la tabla normalmente)

Usuario (Secretaria/Admin) → app-assignment-step (Smart: EnrollmentFacade)
        │  selecciona promoción (ya ve varias activas, sin cambios — AC3)
        ▼
EnrollmentFacade.saveAssignment()
        │  calcula días desde promotionStartDate de la opción elegida
        ├─ ≤ 3 días  → continúa normal
        └─ > 3 días  → this.confirm({...}) → ConfirmModalService (modal global)
                            ├─ cancela → aborta saveAssignment(), no persiste
                            └─ confirma → continúa el flujo normal de INSERT
```

### Capas tocadas

- **Facade**: `core/facades/enrollment.facade.ts` (único cambio de lógica de negocio).
- **Migration**: `supabase/migrations/20260728HHMMSS_auto_create_next_promotion.sql`.
- **Modelo UI**: `core/models/ui/enrollment-assignment.model.ts` (campo nuevo, sin lógica).
- Ningún Smart/Dumb Component nuevo ni modificado — `app-assignment-step` sigue recibiendo
  `EnrollmentAssignmentData` igual que hoy, el modal lo dispara el facade antes de que el
  componente reciba confirmación de guardado exitoso.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — sin componentes nuevos; el cambio de facade mantiene Signals/estado
  existente, no se introduce RxJS nuevo.
- [ ] `facades.md` — N/A, `EnrollmentFacade` no es branch-scoped en el sentido de la tabla de
  `facades.md` (usa `branchId` como parámetro explícito de `loadPromotions()`, no
  `BranchFacade.selectedBranchId()` — sin cambios a ese patrón).
- [x] `models.md` — extensión de `PromotionOption` vía campo nuevo, no se duplica interfaz.
- [ ] `visual-system.md` — N/A, no hay UI nueva (el modal reutiliza `ConfirmModalService`, ya
  themeado).
- [ ] `swr-pattern.md` — N/A, `loadPromotions()` no cachea entre navegaciones (spec dice "Solo
  fetch" para wizards de matrícula).
- [ ] `notifications.md` — N/A, no se crean notificaciones persistentes ni toasts nuevos (el
  modal de confirmación no es un toast).
- [x] `testing-tdd.md` — spec nueva en `enrollment.facade.spec.ts` para el gate de matrícula
  tardía, obligatoria antes de implementar (TDD).
- [ ] `ai-readability.md` — N/A, no hay botón de mutación nuevo (el modal de confirmación ya
  usa el patrón estándar de `ConfirmModalService`, que ya tiene su propia cobertura).

---

## 7. Plan de testing

- **Unitarios (`enrollment.facade.spec.ts`)**:
  - `saveAssignment()` con promoción seleccionada de ≤3 días desde `start_date` → no llama
    `confirm()`, persiste directo.
  - `saveAssignment()` con promoción de >3 días, usuario confirma → llama `confirm()`, luego
    persiste.
  - `saveAssignment()` con promoción de >3 días, usuario cancela → llama `confirm()`, NO
    persiste, retorna `false`.
  - Edge case: exactamente 3 días (límite inclusive, según AC4 "3 días o menos").
- **SQL (manual, vía `npx supabase start` + `psql` o Studio local)**:
  - Ejecutar `auto_create_next_promotion()` 2 veces seguidas sin avanzar el reloj → confirmar
    que la segunda ejecución NO crea una promoción duplicada (idempotencia, AC-E1).
  - Verificar que cada `promotion_courses` insertado tiene su `class_book` correspondiente
    (join `promotion_courses` ⟕ `class_book`, cero filas huérfanas).
- **QA manual**: matricular un alumno Profesional en una promoción con `start_date` hace 4-5
  días (dato de seed o ajustado a mano en local) y confirmar que aparece el modal con el texto
  correcto, para admin y para secretaria.
- No aplica `/verify` (Playwright) — no hay componente visual nuevo, el modal es
  `ConfirmModalService` ya visualmente auditado en otros flujos.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Duplicar promociones si el cron corre más de una vez el mismo día (reinicio, retry) | Baja | Chequeo idempotente por `start_date` antes de insertar (ya contemplado en el pseudo-código, AC-E1). |
| `end_date` mal calculado rompe el solapamiento esperado de 2 promociones vivas | Media | Confirmar el valor exacto usado hoy en `crearPromocion()` (formulario manual) antes de fijarlo en la función automática — no asumir 29 días sin verificar. |
| Carrera entre el cron automático y alguien usando el botón manual "Programar Promoción" el mismo día, generando 2 promociones para el mismo lunes | Baja | El chequeo de idempotencia (AC-E1) se basa en `start_date` existente, no en el origen (manual vs cron) — cubre este caso igual. Si el manual corre primero, el cron ve que ya existe y no duplica; si el cron corre primero, el form manual debería advertir (fuera de scope de esta spec, ver §4) o simplemente fallar por duplicado si hay constraint — confirmar en tasks.md si hace falta un UNIQUE(branch_id, start_date). |
| `code` calculado mal si la última promoción tiene `code` no numérico o `NULL` (hoy `crearPromocion()` deja `code=NULL` hasta que se edita manualmente) | Media | `MAX(code::int)` debe filtrar `code ~ '^\d+$'` (mismo regex que usa `editarPromocion()` en TS) antes de castear, para no reventar con un `code` no numérico o vacío. Definir en tasks.md qué pasa si NINGUNA promoción histórica tiene `code` numérico todavía (semilla manual una vez). |
| El cálculo de "días desde inicio" en el facade usa timezone del cliente en vez de Chile | Baja | Reutilizar el mismo patrón de comparación de fechas que ya usa el proyecto para `expiry_date`/`license_expiry` (`CURRENT_DATE`-based en SQL; en TS, comparar solo la parte de fecha, no `Date.now()` con horas). |

---

## 9. Orden de implementación

1. Migración SQL (`auto_create_next_promotion()` + `pg_cron`) — incluye `class_book` explícito.
2. `enrollment-assignment.model.ts`: agregar `promotionStartDate` a `PromotionOption`.
3. `enrollment.facade.spec.ts`: escribir tests del gate de matrícula tardía (TDD, antes del punto 4).
4. `enrollment.facade.ts`: `loadPromotions()` (select `start_date`) + `saveAssignment()` (gate).
5. `npm run test:ci` — confirmar verde.
6. QA manual del modal (AC5) + verificación SQL de idempotencia (AC-E1).
7. Sync `indices/DATABASE.md` + `indices/FACADES.md`.
8. `npm run lint:arch`.

---

## 10. Estimación

M — medio día de implementación + testing, dado que reutiliza patrones existentes (cron
siguiendo `auto_transition_promotion_status()`, modal vía `ConfirmModalService` ya inyectado,
sufijo de licencia ya verificado en `license-suffix.utils.ts`). Sin filtrado de sedes que
resolver (branch_id=2 fijo, confirmado por el owner). El mayor riesgo de tiempo es §8
(`end_date` exacto y el cálculo seguro de `code` cuando la última promoción histórica no tiene
`code` numérico), no la lógica en sí.

---

## Changelog

- 2026-07-28 — plan inicial, a partir de spec.md aprobada (incluye hallazgo de `class_book`
  perezoso detectado por el owner).
- 2026-07-28 — agregada auto-asignación de `code` secuencial global (AC1b) y confirmado
  branch_id=2 fijo (sin filtrado de sedes). Aclarado que el botón manual "Programar Promoción"
  se mantiene sin cambios. Verificado `licenseClassToSuffix()` — sufijo es solo el dígito 2-5,
  trivial de replicar en SQL.
