# Fix: Agregar CRUD de Descuentos Predefinidos en Ajustes del Admin
> id: fix-197-m-descuentos-predefinidos-sin-crud
> refs: —
> status: done
> closed: 2026-08-21
> created: 2026-08-21

## Root Cause
El step de pago de matrícula (`payment.component.html`/`.ts` + `enrollment-payment.facade.ts`)
ya lee y aplica descuentos predefinidos activos desde la tabla `discounts`
(`selectPredefinedDiscount()`, soporta `discount_type: 'percentage' | 'fixed_amount'`,
filtro por `applicable_to` y vigencia). La tabla se creó en
`supabase/migrations/20260301000002_02_enrollments_and_courses.sql` pero nunca se sembró
con datos, y no existe ningún componente/CRUD en Admin que inserte, edite o desactive filas
en `discounts`. Como consecuencia, `availableDiscounts` siempre llega vacío
(`@if (data().availableDiscounts.length > 0)` nunca se cumple) y en la práctica solo el
descuento manual (monto libre) es usable — la mitad de la feature está muerta desde que se
construyó. Detectado durante UAT Paquete 4, ítem "Aplicar un descuento predefinido".

## ACs Afectados
Ninguno — fix autónomo (gap de negocio detectado en UAT, no una regresión de spec existente).

- AC-1: Admin puede crear un descuento predefinido desde Ajustes (nombre, tipo `percentage`
  o `fixed_amount`, valor, `applicable_to` en {`all`, `class_b`, `professional`}, vigencia
  `valid_from`/`valid_until` opcional).
- AC-2: Admin puede editar y desactivar (`status='inactive'`) un descuento existente sin
  borrarlo (preserva histórico de matrículas que ya lo usaron).
- AC-3: Un descuento activo y vigente para el tipo de curso correspondiente aparece en el
  step de pago de matrícula dentro de "Descuentos disponibles", sin cambios en
  `enrollment-payment.facade.ts` (el consumo ya funciona, solo faltaba la fuente de datos).
- AC-4: Secretaria/instructor NO tienen acceso a esta sección — vive solo en Ajustes del
  Admin, junto a "Grilla Horaria Base" y "Conmutar Sede Activa".

## Cambio
- **Archivo:** `core/models/dto/discount.model.ts` (nuevo) — DTO reflejando `discounts`.
- **Archivo:** `core/facades/discounts.facade.ts` (nuevo) — CRUD sobre `discounts`
  (listar todos incl. inactivos, crear, editar, desactivar/reactivar).
- **Archivo:** componente en Ajustes del Admin (sección "Apariencia y Visualización" ya
  tiene el patrón de tarjetas — agregar una nueva tarjeta "Descuentos Predefinidos" con
  tabla + drawer de alta/edición, reutilizando `LayoutDrawerFacadeService`).
- **Archivo:** `indices/FACADES.md` / `indices/COMPONENTS.md` — registrar el nuevo Facade
  y componente.

### Ampliación de scope (mismo track, feedback del dueño en QA)
Durante la verificación visual el dueño pidió que el formulario también permitiera acotar
un descuento por **sede** y por **curso puntual de Clase Profesional (incl. CONV)**, no
solo el balde genérico `applicable_to`. Esto **rompe** el AC-3 original ("sin cambios en
`enrollment-payment.facade.ts`"):
- **Migración:** `supabase/migrations/20260821150000_fix197_discounts_branch_and_course_scope.sql`
  agrega `discounts.branch_id` (FK `branches`, NULL = todas las sedes) y `discounts.course_id`
  (FK `courses`, NULL = usa el balde `applicable_to`).
- **`core/facades/discounts.facade.ts`:** ahora hace join a `branches(name)`/`courses(name)`
  para mostrar el scope en la lista de Admin, y expone `loadProfessionalCourses(branchId)`
  para poblar el picker de curso específico.
- **`core/facades/enrollment-payment.facade.ts`:** `loadAvailableDiscounts()` cambia de firma
  (`courseType` → `courseType, courseId, branchId`) y su query ahora filtra también por
  `branch_id` (server-side) y `course_id` (client-side, ya que depende del curso exacto
  seleccionado en el wizard).
- **`features/secretaria/matricula/secretaria-matricula.component.ts`:** nuevo método privado
  `loadStep4Discounts()` resuelve el `courseId` real (via `courseOptions().find(...)`) y pasa
  `activeBranchId()` en los dos call-sites de `onStep4Next()`.
- **UI del drawer:** input de "Valor" corregido a placeholder (no `0` literal escrito) con
  prefijo `$` solo para `fixed_amount`; validación agregada para que un `percentage` no pueda
  superar 100 (bloquea "Guardar" y muestra error inline).

## Test de Regresión
- `discounts.facade.spec.ts` — crear, editar y desactivar un descuento; verificar que
  `listarActivos()` (o equivalente) excluye los `status='inactive'` y respeta
  `applicable_to`/vigencia igual que la query actual de `enrollment-payment.facade.ts`.
- Verificación manual: crear un descuento `percentage` para `class_b`, abrir matrícula de
  un alumno de Clase B → aparece en "Descuentos disponibles" del step de pago y se aplica
  correctamente al monto.
