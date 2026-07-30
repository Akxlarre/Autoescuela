# Spec 0004-b — refactor-website-config-courses-fk

> **Status:** approved
> **Created:** 2026-05-22
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Iniciativa interna — auditoría arquitectónica del módulo Configuración Web (rama `feat/sdd-integration`).

**Persona afectada:** Admin y Secretaria (editan la landing) + Lead/Alumno (consume precios en la landing pública).

**Problema que resuelve:**
Hoy `website_config.config.courses` es un JSONB con datos editoriales (`name`, `price`, `licenseClass`, `description`, `includes`) **totalmente desconectado** del catálogo operacional `courses` (que es la fuente de verdad para matrículas, pagos, agenda y SENCE). Esta arquitectura presenta dos riesgos críticos: (a) divergencia silenciosa de precios — el admin sube `courses.base_price` y la web sigue mostrando el precio viejo sin alerta; (b) pérdida de trazabilidad — un lead que viene desde una card de la landing no tiene un `course_id` asociado que permita pre-llenar correctamente la matrícula.

**Hipótesis de valor:**
Acoplar la capa de presentación al catálogo operacional vía FK lógica elimina la divergencia de precios y habilita atribución end-to-end (landing → matrícula). Métrica clave: 0 incidentes de "precio web ≠ precio cobrado" reportados post-launch.

---

## 2. User Stories

- **US1**: Como Admin, quiero seleccionar el curso de la landing desde un dropdown de cursos operacionales reales (`courses`) para garantizar que el contenido editorial siempre refleje un servicio que efectivamente vendo.
- **US2**: Como Admin, quiero que el precio mostrado en la landing herede automáticamente de `courses.base_price` para no tener que actualizar dos lugares cuando cambia un precio.
- **US3**: Como Admin, quiero poder declarar un `priceOverride` explícito y temporal cuando lanzo una promoción ("precio web $320.000 con tachado del original $350.000") para que la divergencia sea consciente y trazable.
- **US4**: Como Secretaria, quiero seguir editando libremente `description`, `priceNote`, `duration`, `includes`, `highlighted` y `badge` de cada card para mantener autonomía sobre el contenido editorial sin tocar el catálogo operacional.
- **US5**: Como Lead que visita la landing, quiero ver siempre precios y nombres de cursos consistentes con lo que me cobrarán al matricularme.
- **US6**: Como Admin, quiero que si elimino o desactivo un curso de `courses`, las cards de la web que lo referencian dejen de renderizarse (y me lo notifique en el panel) para evitar vender un servicio que ya no ofrezco.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given un admin abre el tab "Cursos & Precios" en Configuración Web, When agrega una nueva card, Then debe seleccionar obligatoriamente un `course_id` desde un dropdown que lista solo cursos activos del branch seleccionado; el formulario no permite guardar si `course_id` es null.
- **AC2**: Given un admin selecciona un `course_id` en una card, When no declara `priceOverride`, Then la landing pública muestra `courses.base_price` formateado en CLP; si el admin actualiza `courses.base_price` desde el catálogo operacional, la landing refleja el nuevo precio sin tocar `website_config`.
- **AC3**: Given un admin declara `priceOverride: 320000` en una card cuyo `courses.base_price = 350000`, When la landing renderiza esa card, Then muestra "$320.000" como precio activo y opcionalmente "$350.000" tachado como precio original; en el admin se muestra un badge visible "⚠ Precio override activo".
- **AC4**: Given una card existente referencia `course_id = 5`, When un admin marca ese curso como `active = false` en el catálogo operacional, Then la card no se renderiza en la landing pública y aparece marcada con warning "Curso inactivo — no visible públicamente" en el panel admin.
- **AC5**: Given el admin guarda la configuración, When un trigger de BD valida la integridad, Then todo `course_id` en el JSONB debe existir en `courses` y pertenecer al mismo `branch_id` de la `website_config`; si no, el UPDATE/INSERT falla con mensaje explícito.
- **AC6**: Given existe data legacy en `website_config.config.courses` (formato pre-refactor), When se aplica la migración, Then el array `courses` de cada `website_config` se vacía (`[]`) y queda lista para que el admin lo reconfigure desde la UI usando el nuevo flujo basado en `course_id`. La migración registra en `audit_log` un evento `website_config.courses.reset_for_refactor` por cada branch afectado.
- **AC7**: Given un Smart Component consume el Facade, When llama `resolvedCourses()`, Then recibe un array de `ResolvedCourse[]` con `name`, `displayPrice`, `basePrice`, `priceOverride`, `licenseClass` ya resueltos vía JOIN en memoria con el catálogo operacional.

### Edge cases obligatorios

- **AC-E1**: Given un admin intenta seleccionar un `course_id` que ya está en uso en otra card del mismo branch, When intenta guardar, Then el formulario muestra error "Este curso ya está publicado en otra card; cada curso solo puede aparecer una vez en la landing".
- **AC-E2**: Given un admin elimina (DELETE) un curso de `courses` que está referenciado en `website_config`, When se ejecuta el DELETE, Then la operación es bloqueada por trigger de BD con mensaje "No se puede eliminar: N cards de website_config referencian este curso. Quitá esas cards desde Configuración Web antes de eliminar el curso del catálogo."
- **AC-E3**: Given `priceOverride = 0`, When la landing renderiza, Then debe mostrar "Gratis" (no "$0") y badge "Curso gratuito" — distinguir override de cero vs ausencia de override.
- **AC-E4**: Given un branch nuevo sin cursos operacionales todavía, When el admin abre Configuración Web > Cursos, Then debe ver empty state con CTA "Primero creá cursos en Catálogo Operacional" (no permite agregar cards huérfanas).
- **AC-E5**: Given la migración se aplica en producción, When termina, Then cada admin del sistema recibe una notificación in-app (vía `NotificationsFacade`) con título "Reconfigurá las cards de tu landing" y deep-link a `/app/admin/configuracion-web` para que sepa que debe reconstruir el contenido editorial de los cursos desde cero usando el nuevo flujo.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Refactor de `standalone_courses` (cursos singulares SENCE/Grúa/Retroexcavadora) — esa tabla ya tiene su propio flujo (`CursosSingularesFacade`) y no se publica en la landing pública por ahora.
- ❌ Conversión automática lead → matrícula (que la landing redirija a `/matricula-online` con `course_id` pre-cargado en query string). Eso es spec separada.
- ❌ Histórico de cambios de precio en `courses.base_price` con timeline visible en la web ("antes $X, ahora $Y" dinámico desde audit log). Eso es feature de marketing avanzada.
- ❌ A/B testing de precios por audiencia. Si surge, crear spec dedicada.
- ❌ Internacionalización de nombres de curso (multi-idioma).
- ❌ Cambios al schema de `hero`, `whyUs`, `faqs`, `contact`, `hours`, `promo`, `testimonials`, `social` en `website_config`. Esta spec toca SOLO el array `courses`.

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante. (Spec 0003 — landing-pages-panel-control creó la infraestructura inicial de `website_config`; esta spec refactoriza esa misma infra.)

### Capacidades del proyecto que se asumen existentes
- Tabla `courses` con columnas `id, code, name, type, base_price, license_class, branch_id, active` (migración `20260301000001_01_users_and_branches.sql`).
- Tabla `website_config` con `id, branch_id, config JSONB, created_at, updated_at` y RLS configurada (migración `20260522000000_create_website_config.sql`).
- `WebsiteConfigFacade` con métodos `loadConfig(branchId)` y `saveConfig(branchId, configData)`.
- `BranchFacade` con `selectedBranchId()` signal.
- `AuthFacade` con `currentUser()` y roles `admin` / `secretary`.
- Función SQL `auth_user_role()` y `branch_visible(branch_id)` usadas en RLS.
- Trigger `set_updated_at()` y `log_change()` para auditoría.

### Capacidades nuevas requeridas
- `CoursesFacade` (si no existe) o método nuevo en facade existente para listar cursos activos de un branch (alimentar el dropdown del admin).
- Trigger SQL `trg_validate_website_config_courses_fk` que valida integridad de `course_id` en JSONB.
- Trigger SQL `trg_prevent_courses_delete_when_in_website_config` o equivalente cascade lógico (a decidir en plan).
- Nuevo modelo UI `ResolvedCourse` que combina `CourseConfig` (JSONB) + datos heredados de `courses`.
- Migración SQL que vacíe `website_config.config.courses` a `[]` y notifique a admins para reconfigurar.

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

**Tablas nuevas / modificadas:**
- `website_config` — sin cambio de esquema relacional, pero el shape del campo `config.courses[]` cambia (ver abajo).
- `courses` — sin cambio de esquema; solo se agrega trigger preventivo de DELETE.

**Cambio de shape en `website_config.config.courses[]`:**

ANTES:
```json
{ "name": "...", "price": 350000, "licenseClass": "B", "description": "...", "includes": [...], "highlighted": true, "badge": "...", "duration": "...", "priceNote": "..." }
```

DESPUÉS:
```json
{
  "course_id": 5,
  "description": "...",
  "priceNote": "...",
  "duration": "4 a 6 semanas",
  "includes": ["..."],
  "highlighted": true,
  "badge": "...",
  "priceOverride": null,
  "displayOrder": 1
}
```

**Modelos UI nuevos:**
- `CourseConfig` (DTO) — actualizado, refleja el shape nuevo del JSONB.
- `ResolvedCourse` (UI) — `{ courseId, name, licenseClass, basePrice, priceOverride, displayPrice, description, priceNote, duration, includes, highlighted, badge, displayOrder, isOverrideActive, isCourseActive }`.

**RLS requerida:**
- No cambian las policies de `website_config` (ya soportan admin + secretaria branch-scoped).
- El nuevo trigger de validación corre en BD, no requiere RLS adicional.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

**Pantalla(s) afectada(s):**
- `admin-configuracion-web.component.ts` — tab "Cursos & Precios" (líneas 444-535 aprox).
- Landing pública que renderiza los courses (a identificar exactamente en plan.md).

**Flujo principal (happy path):**
1. Admin abre Configuración Web > tab "Cursos & Precios".
2. Click "Agregar Curso" → modal/sección con dropdown de cursos disponibles del branch.
3. Admin selecciona "Curso Clase B Particular" del dropdown → automáticamente se muestran `name: "Curso Clase B Particular"` (heredado, readonly) y `precio base heredado: $350.000` (readonly).
4. Admin completa `description`, `duration`, `includes`, opcionalmente `badge` y `highlighted`.
5. Admin decide si activa override → checkbox "Personalizar precio para promo" → si lo activa, aparece input `priceOverride` con preview "Mostrar $320.000 (precio original $350.000 tachado)".
6. Admin guarda → trigger de BD valida que `course_id` existe y pertenece al branch → success.
7. Landing pública se actualiza inmediatamente (lectura directa del JSONB con resolución on-the-fly).

**Estados especiales:**
- **Loading**: skeleton del dropdown mientras carga `availableCourses` del branch.
- **Empty branch**: si el branch no tiene cursos activos, empty state con CTA "Crear primero un curso en el catálogo operacional".
- **Course referenciado pero inactivo**: badge warning rojo en la card del admin "Curso inactivo — no visible en web", checkbox deshabilitado, no permite override.
- **Course eliminado (huérfano)**: no debería ocurrir gracias al trigger de bloqueo de DELETE (AC-E2), pero si por algún motivo sucede, la card no se renderiza en la landing y aparece con error rojo en admin "Curso referenciado no existe — eliminá esta card".
- **Migración legacy**: post-deploy todos los `website_config.config.courses` quedan vacíos; notificación in-app a admins con deep-link a Configuración Web para que reconstruyan las cards usando el nuevo dropdown de `course_id`.

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- **0 incidentes** reportados de "precio web ≠ precio cobrado al matricular" en los 90 días post-deploy.
- **100% de las cards activas** en `website_config.config.courses` tienen un `course_id` válido (verificable por query SQL).
- **Tiempo medio de actualización de precio** en la web baja de ~5 min (editar JSONB completo en admin) a ~10 segundos (cambiar `courses.base_price` desde catálogo operacional).
- **Reducción a 0** de duplicación de definiciones de cursos (hoy: cada curso vive en `courses` Y en `website_config.config.courses`).

---

## 9. Notas / decisiones abiertas

Todas las decisiones quedaron resueltas en sesión de spec (2026-05-22):

- [x] **Política de DELETE en `courses`** → **Bloquear con trigger** (`trg_prevent_courses_delete_when_in_website_config`). El admin debe quitar la card desde Configuración Web antes de poder eliminar el curso operacional. Es la política más estricta y evita pérdida silenciosa de contenido editorial.
- [x] **Override de precio en `0`** → **Renderizar como "Gratis" + badge 'Curso gratuito'**. Tratamos `priceOverride = 0` como valor válido para promos especiales. Formalizado en AC-E3.
- [x] **Ordenamiento de cards** → **Campo `displayOrder` numérico explícito**. Cada card tiene `displayOrder: 1, 2, 3, ...`. Desempate por `course_id ASC`. Habilita drag-and-drop futuro sin migración adicional.
- [x] **Migración de data legacy** → **Vaciar `website_config.config.courses` a `[]`** + notificación in-app al admin para reconfigurar. No hay match heurístico (el proyecto aún no está en producción estable; los seeds son fácilmente reconstruibles desde la UI con el nuevo flujo). Mucho más simple, sin heurísticas frágiles.
- [x] **Resolución `ResolvedCourse`** → **JOIN en memoria dentro del Facade** (no función SQL). Más simple, testeable, suficiente para el volumen actual. Si hay problema de performance se migra a función SQL `get_website_courses_resolved(branch_id)` en spec separada.

---

## Changelog

- 2026-05-22 — draft inicial por Akxlarre (sesión de descubrimiento + 4 decisiones arquitectónicas).
- 2026-05-22 — decisiones abiertas resueltas (DELETE bloqueado, override=0→Gratis, displayOrder numérico, migración limpia el JSONB sin heurística). Status: draft → approved.
