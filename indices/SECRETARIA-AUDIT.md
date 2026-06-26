# Auditoría — Portal Secretaria

> Fecha: 2026-06-24 · Método: análisis estático de rutas, guards, menú, ~30 componentes
> del portal, facades consumidas y políticas RLS de Supabase. **No** se ejecutó repro en
> runtime con datos multi-sede (ver "Pendiente de verificación en runtime").

## Resumen ejecutivo

La estrategia "admin primero, secretaria al final" funcionó para la **estructura**
(rutas, guards y menú reflejan admin), pero el portal está **a medio terminar** y arrastra
un **problema de aislamiento por sede**. De ~25 ítems del menú: ~9 correctas, **2 con fuga
real de datos**, ~4 con aislamiento frágil (hoy tapado por RLS), **5 stubs "PLANO"** y
~4 re-exports verbatim (verificados sin riesgo de links).

---

## 1. Lo que está BIEN

- **Guards y enrutado correctos.** `hasRoleGuard(['secretaria'])` protege `/app/secretaria/*`;
  `roleRedirectGuard` enruta por rol. El comentario en `app.routes.ts` sobre no usar
  `path:''` como wrapper (evita redirect loops) es arquitectura sólida.
- **Patrón de reúso correcto** donde se aplicó: `alumnos`, `cuadratura`, `documentos` son
  wrappers delgados que reúsan el `*-content` compartido con `basePath="/app/secretaria"`.
- **El patrón de anclaje de sede correcto YA existe** en ~9 facades vía `getActiveBranchId()`:
  ```ts
  if (user?.role === 'admin') return this.branchFacade.selectedBranchId();
  return user?.branchId ?? null;   // ← secretaria anclada a su sede
  ```
  Lo usan: `agenda`, `cuadratura`, `pagos`, `liquidaciones`, `dms`, `dashboard`,
  `servicios-especiales`, `reportes-contables`, `ex-alumnos`, `auditoria`,
  `historial-cuadraturas`. `secretaria-asistencia` lo hace explícito vía `setBranchFilter`.

---

## 2. Lo que está MAL

### 🔴 CRÍTICO — Aislamiento por sede inconsistente (cross-branch leak)

**Diseño declarado** (migración `20260522000001`):
> *"secretary sees ALL users in RLS… Branch scoping for secretary's queries is handled at
> the PostgREST/query layer, NOT in RLS."*

O sea: la RLS **no** es el respaldo; cada facade debe aplicar el filtro. El selector de sede
del topbar es **solo admin** (`@if role === 'admin'`), así que para la secretaria
`branchFacade.selectedBranchId()` es **`null`** salvo que pase por el wizard de matrícula
(único lugar que llama `selectBranch()`, de forma incidental). Las facades "heredadas" de
admin leen `selectedBranchId()` directo, sin el fallback `user.branchId`, y con `null`
hacen `if (branchId !== null)` → **no filtran**.

El que se filtren datos o no depende de **en qué tabla rootea la query** y su RLS:

| Tabla raíz | RLS para secretary | ¿Filtra? |
|---|---|---|
| `enrollments` | `secretary AND branch_visible(branch_id)` | ✅ sí (BD ancla) |
| `students` | `auth_user_role() IN ('admin','secretary')` — **sin branch** | ❌ no |
| `users` | última RLS: secretary ve **todos** — **sin branch** | ❌ no |
| `instructors` | `auth_user_role() IN ('admin','secretary')` — **sin branch** | ❌ no |

**Fugas reales confirmadas (PII de otras sedes):**

| Página | Facade | Raíz | Por qué fuga |
|---|---|---|---|
| **Base Alumnos B** | `AdminAlumnosFacade` | `students` + `users!inner` | RLS no ancla → ve alumnos (nombre, RUT, email, tel.) de todas las sedes. Además `export-students` se invoca con `branch_id: null` → export global |
| **Instructores** | `InstructoresFacade` | `instructors` | RLS no ancla → ve instructores de todas las sedes |

**Aislamiento frágil (hoy tapado por RLS de `enrollments`, pero el frontend no filtra):**

| Página | Facade | Nota |
|---|---|---|
| Base Alumnos Prof. | `AdminAlumnosProfesionalFacade` | rootea en `enrollments` → RLS la salva hoy |
| Archivo Prof. | `archivo-profesional` | idem |
| Certificaciones B | `certificacion-clase-b` | `isAdmin` controla *visibilidad* de cert., no la sede; rootea en `enrollments` |
| Certificados Prof. | `certificacion-profesional` | idem |
| Libro de Clases / Pre-inscritos | `libro-de-clases`, `admin-pre-inscritos` | latente (páginas stub hoy) |

> **Causa raíz:** estas facades nunca recibieron el refactor `getActiveBranchId()`.
> **Fix mecánico:** añadirles ese helper (patrón ya probado en 11 facades) + tests de
> regresión por facade ("secretaria → su branchId"). Cierra fugas y elimina la fragilidad.

### 🟠 Páginas-stub "PLANO" enlazadas en el menú

Renderizan *"Pendiente calcar desde mockup"* con badge PLANO:

| Menú | Ruta | Nota |
|---|---|---|
| **Inicio (dashboard)** | `/secretaria/dashboard` | **Landing tras login.** Máxima prioridad UX |
| Pagos | `/secretaria/pagos` | Admin ya tiene `AdminPagosComponent` real |
| Calificaciones | `/secretaria/profesional/notas` | |
| Libro de Clases | `/secretaria/libro-de-clases` | Admin tiene la real |
| Comunicaciones | `/secretaria/comunicaciones` | **Redundante** con "Comunicación"→`observaciones` (real) |

### 🟡 Otros

- **`/secretaria/configuracion-web`** reúsa `AdminConfiguracionWebComponent`, **no está en el
  menú** pero es alcanzable por URL. ¿Debe una secretaria editar la web pública? Revisar
  menor privilegio.
- **Rutas huérfanas/duplicadas** (stubs no enlazadas): `asistencia/matriz`,
  `asistencia/profesional` (colisiona conceptualmente con `profesional/asistencia`, real),
  `profesional/pre-inscritos`.
- **String de rol `secretary` (BD/edge) vs `secretaria` (frontend).** El topbar tiene un
  defensivo `role === 'secretary' || role === 'secretaria'` (línea ~272) que delata la
  fricción. Unificar el mapeo en `AuthFacade`.

### ✅ Re-exports verbatim — verificado SIN riesgo

`profesional/relatores`, `promociones`, `asistencia`, `archivo` hacen
`template: <app-admin-… />`. Verificado: esos componentes admin **no** tienen `routerLink`
ni `navigate()` internos a `/app/admin`, así que no hay rebote de links para la secretaria.

---

## 3. Lo que NO se ha considerado (gaps)

1. **Tests de scope para secretaria.** Las specs prueban el caso *admin*; no hay
   "secretaria solo ve su sede". Por eso la fuga pasó inadvertida.
2. **Dashboard de secretaria como producto** (no solo "calcar mock"): KPIs/alertas de UNA
   sede ≠ dashboard multi-sede del admin.
3. **Defensa en profundidad.** Hoy la sede depende solo del frontend. Decidir si la RLS de
   `students`/`users`/`instructors` debería también anclar por sede.
4. **Notificaciones page** stub aunque la campana global del shell sí funciona.

---

## 4. Pendiente de verificación en runtime

El análisis es estático (código + RLS). Antes de cerrar el fix, **reproducir con datos
multi-sede**: loguear como secretaria de la Sede A y confirmar que Base Alumnos B e
Instructores muestran registros de la Sede B (`/verify` con Playwright o test e2e).

---

## 5. Recomendación de prioridad

1. **🔴 Fuga de sede (seguridad).** `getActiveBranchId()` en `AdminAlumnosFacade` e
   `InstructoresFacade` (fugas reales) + las 4 frágiles por consistencia/defensa. Spec de
   regresión por facade. Track: ver `specs/`.
2. **🟠 Decisión de producto sobre los 5 stubs** (calcar admin vs. quitar del menú;
   dashboard con diseño propio).
3. **🟡 Limpieza**: gate de `configuracion-web`, rutas huérfanas, unificar string de rol.
