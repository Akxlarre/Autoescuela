# RBAC — Modelo de Roles y Autorización

> Documento canónico de **quién puede ver/hacer qué** en Autoescuela.
> Fuente de verdad del detalle por tabla: `indices/DATABASE.md` (columna "Restricciones RLS").
> Origen: auditoría RBAC (2026-07-05, hotfix-019-m).

## 1. Modelo de roles

El sistema usa **4 roles fijos**, definidos en la tabla `roles` y asignados vía `users.role_id`.
No existen roles dinámicos ni permisos configurables por el admin — y es una decisión deliberada (ver §6).

## 2. Nomenclatura dual (BD ↔ Frontend) — ⚠️ leer antes de escribir policies o guards

Los nombres de rol **difieren** entre la base de datos y el frontend:

| BD (`roles.name`) | Frontend (`UserRole`) | Portal | Persona |
|---|---|---|---|
| `admin` | `admin` | `/app/admin` | Dueño / administrador de la escuela |
| `secretary` | `secretaria` | `/app/secretaria` | Secretaria de sede |
| `instructor` | `instructor` | `/app/instructor` | Instructor de conducción |
| `student` | `alumno` | `/app/alumno` | Alumno matriculado |

- **El mapeo ocurre en un único punto:** `AuthFacade.loadUserFromSession()` (`src/app/core/facades/auth.facade.ts`).
- **Reglas de oro:**
  - En SQL (policies, funciones, seeds) usar SIEMPRE los nombres de BD: `secretary`, `student`.
  - En TypeScript (guards, menú, `UserRole`) usar SIEMPRE los nombres frontend: `secretaria`, `alumno`.
  - Una policy con `auth_user_role() = 'secretaria'` **nunca matchea** — falla en silencio (deniega todo).

## 3. Capas de enforcement (de más a menos crítica)

| Capa | Mecanismo | Archivo(s) | Qué garantiza |
|---|---|---|---|
| **1. RLS (Postgres)** | 274 policies sobre 76 tablas + helpers `SECURITY DEFINER`: `auth_user_role()`, `auth_user_id()`, `auth_student_id()`, `auth_instructor_id()`, `branch_visible()` | `supabase/migrations/20260301000011_10_rls_policies.sql` (+ fixes posteriores) | **La seguridad real.** Aunque el cliente se salte todo el frontend, la BD no entrega filas fuera del rol/sede |
| **2. Route guards** | `hasRoleGuard([...])` por portal, `roleRedirectGuard`, `firstLoginGuard`, `professionalBranchGuard` | `src/app/app.routes.ts`, `src/app/core/guards/` | Navegación: cada rol solo entra a su portal |
| **3. Menú por rol** | `MenuConfigService` — 4 arrays estáticos (`ADMIN_NAV`, `SECRETARIA_NAV`, `INSTRUCTOR_NAV`, `ALUMNO_NAV`) | `src/app/core/services/auth/menu-config.service.ts` | UX: cada rol solo ve sus entradas de navegación |
| **4. Edge Functions** | `SERVICE_ROLE_KEY` + validación explícita del caller (ej: `create-secretary` valida admin/secretary) | `supabase/functions/` | Operaciones privilegiadas (crear usuarios Auth, pagos) fuera del alcance del cliente |

Las capas 2–4 son conveniencia/UX. **Nunca confiar en ellas para seguridad: toda tabla nueva DEBE tener RLS.**

## 4. Atributos que modulan el rol (ABAC ligero)

Casos donde el rol no basta; se resuelven con **flags auditables**, no con roles nuevos:

| Atributo | Dónde vive | Efecto |
|---|---|---|
| `users.can_access_both_branches` | BD + RLS (`branch_visible()`) | Secretaria con grant ve todas las sedes como un admin (spec 0017). Otorga/revoca el admin; queda en `audit_log`; aplica en caliente vía Realtime |
| `branches.has_professional` | BD + `professionalBranchGuard` + `requiresProfessional` en menú | Sedes sin Clase Profesional no ven ni acceden a las rutas profesionales |
| `users.first_login` | BD + `firstLoginGuard` | Fuerza cambio de contraseña antes de usar cualquier portal |
| `users.branch_id` | BD + RLS | Ancla de sede. **`NULL` + sin grant = NO ve datos** (jamás se interpreta como "todas") |

## 5. Matriz rol × módulo (resumen de las RLS)

Leyenda: **CRUD** completo · **CRU** sin delete · **CR** crear+leer · **R** solo lectura · **R(self)** solo registros propios · **—** sin acceso.
Esta matriz es un resumen orientativo; el detalle exacto por tabla vive en `indices/DATABASE.md`.

| Módulo | Admin | Secretaria | Instructor | Alumno |
|---|---|---|---|---|
| **M1 Usuarios / Roles / Sedes** | CRUD | R — `users` sin ver admins; `students`/`instructors` acotados por sede (`branch_visible`) | R(self) | R(self) |
| **M2 Notificaciones / Alertas** | CRUD | CRUD — `notification_templates`/`alert_config` solo R | R(propias) | R(propias) |
| **M3 Finanzas** (pagos, gastos, cuadratura, cursos singulares) | CRUD | CRUD — excepto `fixed_expenses` (sin acceso) y catálogos (`service_catalog`, `discounts`: R) | R(self) — anticipos y pagos mensuales propios | R(self) — sus pagos |
| **M4 Academia Clase B** (sesiones, asistencia, exámenes, ciclos teóricos) | CRUD | CRUD (por sede) | CRU — sesiones/asistencia que registra; exámenes solo R | R(propias) — intentos de examen: CR propios |
| **M5 Academia Profesional** (promociones, relatores, módulos, firmas) | CRUD | CRUD | R — firmas semanales | R(propias) — evidencia de ausencia: CR |
| **M6 Matrícula / Documentos** (enrollments, contratos, DMS, web pública) | CRUD | CRUD (por sede vía `branch_visible`) | R — enrollments; docs solo de alumnos con sesiones asignadas | R/CR(self) — sus docs y contratos |
| **M7 Flota** (vehículos, mantenciones) | CRUD | CRUD | R — vehículos; incidentes de ruta: CR | — |
| **M8 Tareas / Comunicación** | CRUD (por sede) | CR/U — según participación (from/to) | R/U — solo asignadas a él | — |
| **M9–M10 Calidad / Reglas** (libro de clases, certificados, notas disciplinarias, temporadas de precio) | CRUD | CRUD — catálogos (`pricing_seasons`, `certificate_batches`): R | — | R(self) — sus notas y certificados |
| **M15 Encuestas** | R | R | — | — (se insertan vía flujo público) |
| **Flujo público de matrícula** (`slot_holds`, `payment_attempts`, throttle) | — | — | — | — (solo `service_role` vía Edge Function `public-enrollment`) |

**Vistas** (`v_*`, `security_invoker=true`): heredan las policies de sus tablas base — no abren accesos nuevos.

## 6. Decisión arquitectónica: sin RBAC granular (tablas `permissions`)

Evaluado y **descartado** (2026-07-05) mientras se mantengan estas condiciones:

- Los 4 roles son estáticos y mapean a portales completamente separados (no hay vistas compartidas entre roles).
- Las excepciones reales del negocio se resuelven con flags auditables (§4), no con roles nuevos.
- Un sistema `permissions`/`role_permissions` obligaría a reescribir las 274 policies, con riesgo de recursión RLS y desincronización frontend/backend, sin resolver ningún problema actual.

**Señales para reabrir la decisión** (cualquiera de estas):
1. El negocio pide roles configurables por el admin ("secretaria senior que además puede X").
2. Aparecen sub-permisos dentro de un portal (ej: ver pagos pero no anularlos).
3. Se acumulan más de ~3 flags booleanos de permiso en `users` (los flags se están volviendo un sistema de permisos ad-hoc).

**Nota histórica:** existió una `HasRoleDirective` (`*appHasRole`) para ocultar elementos por rol dentro de una vista. Se eliminó en hotfix-019-m por tener 0 usos (los portales son exclusivos por rol). Si aparecen vistas compartidas entre roles, recuperarla de git (`src/app/core/directives/has-role.directive.ts`, eliminada tras el commit `6f2ca16`).
