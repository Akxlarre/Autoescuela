# Plan 0009-i — Edge functions: exigir usuario real con rol de staff

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-10-01
> **Talla:** M (confirmada por Ignacio el 2026-10-01)

---

## 1. Resumen ejecutivo

Crear un helper compartido `supabase/functions/_shared/staff-auth.ts` que, a partir del header
`Authorization`, resuelva el usuario real (`auth.getUser()`) y su rol en `users`/`roles`, y devuelva
"permitido" o una respuesta 401/403 con el formato `{ "error": "..." }`. Reemplazar con él el bloque de
inicio de las 11 funciones de la spec. Dos tandas: (1) helper + `generate-enrollment-sheet`,
`export-students`, `generate-payroll-report`; (2) las 8 restantes. Sin cambios en `src/app`, BD ni UI.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/functions/_shared/staff-auth.ts` | Helper Deno (Functional Core + I/O) | `decideStaffAccess()` pura + `requireStaff()` que hace las consultas + `authErrorResponse()` |
| `supabase/functions/_shared/staff-auth.test.ts` | Test `deno test` | Casos de la decisión pura (AC2, AC3, AC4, AC-E1, AC-E3) |

### Archivos a MODIFICAR (solo el bloque de autenticación al inicio del handler)

| Función | Autenticación hoy | Roles permitidos | Tanda |
|---|---|---|---|
| `generate-enrollment-sheet/index.ts` | **Ninguna** (responde con la anon key) | admin, secretary | 1 |
| `export-students/index.ts` | `getUser()`, cualquier usuario | admin, secretary | 1 |
| `generate-payroll-report/index.ts` | `getUser()`, cualquier usuario | admin, secretary | 1 |
| `export-certificates-zip/index.ts` | `getUser()`, cualquier usuario | admin, secretary | 2 |
| `generate-audit-report/index.ts` | `getUser()`, cualquier usuario | **admin** | 2 |
| `generate-cash-closing-report/index.ts` | `getUser()`, cualquier usuario | admin, secretary | 2 |
| `generate-cash-history-report/index.ts` | `getUser()`, cualquier usuario | admin, secretary | 2 |
| `generate-payment-report/index.ts` | `getUser()`, cualquier usuario | admin, secretary | 2 |
| `generate-financial-report/index.ts` | `getUser()`, cualquier usuario | admin, secretary | 2 |
| `generate-student-license-pdf/index.ts` | **Ninguna** | admin, secretary | 2 |
| `generate-certificate-b-pdf/index.ts` | Sesión **opcional** (solo para el bypass `force` del admin) | admin, secretary; `force` sigue solo para admin | 2 |

Además, al cerrar: `indices/DATABASE.md` (tabla de Edge Functions: nota de autorización) y
`acceptance.md`.

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

- **Patrón existente que se unifica:** 8 funciones ya resuelven el rol a mano con
  `users.select('id, roles ( name )').eq('supabase_uid', user.id)` (`update-secretary`,
  `create-instructor`, `send-announcement`, `generate-certificate-b-pdf`, …). El helper usa exactamente
  esa consulta: no se inventa un criterio nuevo.
- **Formato de error compatible con el cliente:** `src/app/core/utils/edge-function-error.utils.ts`
  (`readEdgeFunctionError`, fix-268-m) lee `{ "error": "..." }` + status. El helper responde así.
- **Convención de tests de `_shared/`:** funciones puras testeadas con `deno test`, como
  `anti-abuse.test.ts` y `reenrollment.test.ts`. Deno está disponible vía `npx deno` (2.9.6).
- **No existe** un helper de autorización compartido (revisado `supabase/functions/_shared/`); crearlo
  evita repetir el bloque 11 veces más.

---

## 4. Modelo de datos

N/A — sin migraciones ni cambios de RLS. Se leen `users` (`supabase_uid`, `role_id`) y `roles` (`name`)
con la clave de servicio, igual que hoy en las funciones citadas. Nombres de rol reales en BD: `admin`,
`secretary`, `instructor`, `student` (confirmado en la confirmación en vivo del 2026-09-30).

---

## 5. Arquitectura del feature

### Contrato del helper

```ts
// supabase/functions/_shared/staff-auth.ts
export type StaffRole = 'admin' | 'secretary';

export type StaffAccess =
  | { ok: true; userId: number; role: StaffRole }
  | { ok: false; status: 401 | 403; error: string };

/** Pura: decide a partir de lo ya resuelto. Testeable sin red. */
export function decideStaffAccess(
  input: { authUserId: string | null; dbUserId: number | null; roleName: string | null },
  allowed: readonly StaffRole[],
): StaffAccess;

/** I/O: lee el header, valida el token con auth.getUser() y busca el rol en users/roles. */
export async function requireStaff(req: Request, allowed: readonly StaffRole[]): Promise<StaffAccess>;

/** Respuesta JSON `{ error }` con el status y los headers CORS de la función que llama. */
export function authErrorResponse(access: { status: number; error: string }, corsHeaders: Record<string, string>): Response;
```

Reglas de `decideStaffAccess`:
- sin usuario de Auth (sin header, anon key, token vencido o inválido) → **401** (AC2, AC-E2)
- usuario de Auth sin fila en `users` o con rol fuera de `allowed` → **403** (AC3, AC4, AC-E1)
- el rol **solo** sale de la BD; el helper no lee el body (AC-E3)

### Flujo en cada función

```
Request → OPTIONS? → CORS ok (sin cambios)
        → const access = await requireStaff(req, ['admin', 'secretary'])
        → !access.ok ? return authErrorResponse(access, corsHeaders)
        → (resto de la función, sin cambios; usa access.userId / access.role donde antes
           usaba su propia consulta, p. ej. el bypass `force` del certificado B)
```

### Capas tocadas

- **Edge Functions** (Deno): 1 helper nuevo + 11 funciones.
- **Smart/Dumb/Facade/Migration:** ninguna.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [ ] `architecture.md` — Patrón Facade, OnPush, Signals (no aplica: no hay cambios en Angular)
- [ ] `facades.md` — Branch-scoped si aplica (decisión: sin validación de sede en el servidor)
- [ ] `models.md` — DTO vs UI separados
- [ ] `visual-system.md` — Tokens, bento grid, sin colores hardcodeados
- [ ] `swr-pattern.md` — Si el Facade cachea entre navegaciones
- [ ] `notifications.md` — Si dispara toasts o notificaciones
- [x] `testing-tdd.md` — test primero del Functional Core (`decideStaffAccess`) con `deno test`
- [ ] `ai-readability.md` — data-llm-* en botones de mutación

Otras: `indices/DOMAIN-GOTCHAS.md` DG-085 (formato de error de edge functions) — se respeta con
`{ "error": "..." }`.

---

## 7. Plan de testing

- **Unitario (`deno test`):** `staff-auth.test.ts` cubre `decideStaffAccess`: sin usuario → 401;
  usuario sin fila → 403; rol `student`/`instructor` → 403; `secretary` con `allowed=['admin']` → 403;
  `admin`/`secretary` permitidos → ok con su rol; rol desconocido → 403.
- **Tipos:** `npx deno check` de cada función modificada (las funciones no tienen tests propios).
- **En vivo, antes y después** (scripts de confirmación del 2026-09-30/10-01, solo lectura), por cada
  función de la tanda: admin y secretaria → mismo resultado que antes (AC1); sin header y anon key →
  401 (AC2, AC5); alumno e instructor → 403 (AC3); secretaria en auditoría → 403 (AC4); token
  inválido → 401 (AC-E2). Requiere que las funciones estén **desplegadas** en el proyecto de pruebas
  (ver riesgos). `generate-student-license-pdf` y `generate-certificate-b-pdf` escriben datos: para
  ellas solo se prueban los casos de rechazo (401/403), que no llegan a escribir, y el caso permitido
  se verifica desde la pantalla con datos de prueba.
- **Regresión de UI:** desde la app, como admin y como secretaria, una exportación por pantalla
  afectada (Base de Alumnos, ficha, liquidaciones, caja, historial, pagos, reportes, auditoría,
  certificación).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Los cambios no surten efecto hasta desplegar las funciones (`supabase functions deploy`); sin Docker no se pueden correr localmente | Alta (es un hecho) | Desplegar cada tanda al proyecto de pruebas (lo hace Ignacio o quien tenga acceso) y verificar en vivo después de cada despliegue |
| La respuesta 401/403 sin headers CORS se ve en el navegador como "error de CORS" y no como el mensaje real | Media | `authErrorResponse` recibe los `corsHeaders` de cada función; verificar en DevTools |
| Romper algo al editar el inicio de funciones grandes (hasta 1.000 líneas) | Media | Cambio mínimo y localizado; `deno check` por función; verificación antes/después con admin y secretaria |
| Nombres de rol: en BD es `secretary`, no `secretaria` | Media | `StaffRole` usa los nombres reales; test con `secretary` |
| `generate-certificate-b-pdf` lo usa también la vista previa del editor de plantillas | Baja | Esa pantalla es de staff; verificar la vista previa después del despliegue |
| Usuario desactivado (`users.active = false`) sigue pasando | Media | Fuera de alcance: es `ASG-i-044`. Dejar el helper listo para sumar ese chequeo en un solo lugar |
| Una llamada extra a Auth por petición | Baja | Las funciones que ya hacían `getUser()` no cambian; solo suma en las 3 que no autenticaban |

---

## 9. Orden de implementación

1. `staff-auth.test.ts` (rojo) → `staff-auth.ts` (verde) — `deno test`.
2. Tanda 1: `generate-enrollment-sheet`, `export-students`, `generate-payroll-report` + `deno check`.
3. Despliegue de la tanda 1 al proyecto de pruebas + verificación en vivo (antes/después) + UI.
4. Tanda 2: las 8 restantes + `deno check`.
5. Despliegue de la tanda 2 + verificación en vivo + UI.
6. `indices/DATABASE.md`, `acceptance.md`, cierre.

---

## 10. Estimación

M — 1 a 2 días, en dos tandas. La mayor parte del tiempo es verificación, no código.

---

## Changelog

- 2026-10-01 — plan inicial (talla M)
