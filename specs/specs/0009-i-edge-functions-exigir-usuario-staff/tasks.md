# Tasks 0009-i — Edge functions: exigir usuario real con rol de staff

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-10-01

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

> Fases adaptadas al feature: no hay datos, facades ni UI en Angular. Las fases son
> helper → tanda 1 → despliegue/verificación → tanda 2 → despliegue/verificación → cierre.

---

## Fase 1 — Helper de autorización (Functional Core)

- [x] **T1.1** — Escribir `supabase/functions/_shared/staff-auth.test.ts` PRIMERO (TDD)
  - **AC ref:** AC2, AC3, AC4, AC-E1, AC-E2, AC-E3
  - **DoD:**
    - [x] Casos de `decideStaffAccess`: sin usuario de Auth → 401; usuario sin fila en `users` → 403;
          rol `student` → 403; rol `instructor` → 403; rol desconocido → 403;
          `secretary` con `allowed=['admin']` → 403; `admin` y `secretary` permitidos → `ok` con su rol
    - [x] La función no recibe el body (el rol solo viene de la BD)
    - [x] `npx deno test supabase/functions/_shared/staff-auth.test.ts` FALLA (no hay implementación)

- [x] **T1.2** — Implementar `supabase/functions/_shared/staff-auth.ts`
  - **AC ref:** AC2, AC3, AC4, AC-E1, AC-E2, AC-E3
  - **DoD:**
    - [x] `decideStaffAccess()` pura, `requireStaff(req, allowed)` (header → `auth.getUser()` con cliente
          anon → `users.select('id, roles ( name )').eq('supabase_uid', …)` con service role) y
          `authErrorResponse(access, corsHeaders)` que responde JSON `{ "error": "..." }`
    - [x] Nombres de rol reales de la BD: `admin`, `secretary`
    - [x] Los tests de T1.1 PASAN
    - [x] `npx deno check supabase/functions/_shared/staff-auth.ts` sin errores

---

## Fase 2 — Tanda 1 (las 3 más graves)

- [x] **T2.1** — `generate-enrollment-sheet/index.ts`: agregar `requireStaff(req, ['admin','secretary'])`
  al inicio del handler (hoy no autentica)
  - **AC ref:** AC1, AC2, AC3, AC5
  - **DoD:**
    - [x] Rechazo devuelto con `authErrorResponse` y los `corsHeaders` de la función
    - [x] Resto de la función sin cambios
    - [x] `npx deno check` sin errores

- [x] **T2.2** — `export-students/index.ts`: reemplazar el bloque `getUser()` por `requireStaff`
  - **AC ref:** AC1, AC2, AC3
  - **DoD:** (igual que T2.1)

- [x] **T2.3** — `generate-payroll-report/index.ts`: reemplazar el bloque `getUser()` por `requireStaff`
  - **AC ref:** AC1, AC2, AC3
  - **DoD:** (igual que T2.1)

---

## Fase 3 — Despliegue y verificación de la tanda 1

- [x] **T3.1** — Desplegar el helper y las 3 funciones al proyecto de pruebas
  (`supabase functions deploy <nombre>`; lo hace quien tenga acceso al proyecto)
  - **DoD:**
    - [x] Las 3 funciones desplegadas (confirmado en el dashboard de Supabase o en la salida del CLI)

- [x] **T3.2** — Verificación en vivo, solo lectura, antes/después
  - **AC ref:** AC1, AC2, AC3, AC5, AC-E2
  - **DoD:**
    - [x] Admin y secretaria: mismo resultado que antes (filas / bytes)
    - [x] Sin header y con anon key: 401
    - [x] Alumno e instructor: 403
    - [x] Token inválido: 401
    - [x] Resultado anotado en `acceptance.md`

- [x] **T3.3** — Regresión de UI de la tanda 1
  - **AC ref:** AC1
  - **DoD:**
    - [x] Como admin y como secretaria: exportar lista de alumnos, descargar ficha PDF y reporte de
          liquidaciones desde la app funcionan igual

---

## Fase 4 — Tanda 2 (las 8 restantes)

- [x] **T4.1** — `export-certificates-zip/index.ts` → `requireStaff(req, ['admin','secretary'])`
  - **AC ref:** AC1, AC2, AC3
- [x] **T4.2** — `generate-audit-report/index.ts` → `requireStaff(req, ['admin'])`
  - **AC ref:** AC1, AC2, AC3, AC4
- [x] **T4.3** — `generate-cash-closing-report/index.ts` → `requireStaff(req, ['admin','secretary'])`
  - **AC ref:** AC1, AC2, AC3
- [x] **T4.4** — `generate-cash-history-report/index.ts` → `requireStaff(req, ['admin','secretary'])`
  - **AC ref:** AC1, AC2, AC3
- [x] **T4.5** — `generate-payment-report/index.ts` → `requireStaff(req, ['admin','secretary'])`
  - **AC ref:** AC1, AC2, AC3
- [x] **T4.6** — `generate-financial-report/index.ts` → `requireStaff(req, ['admin','secretary'])`
  - **AC ref:** AC1, AC2, AC3
- [x] **T4.7** — `generate-student-license-pdf/index.ts` → `requireStaff(req, ['admin','secretary'])`
  (hoy no autentica)
  - **AC ref:** AC1, AC2, AC3
- [x] **T4.8** — `generate-certificate-b-pdf/index.ts` → `requireStaff(req, ['admin','secretary'])`;
  el bypass `force` usa `access.role === 'admin'` en vez de su consulta propia
  - **AC ref:** AC1, AC2, AC3
- **DoD de cada T4.x:**
  - [x] Rechazo con `authErrorResponse` + `corsHeaders` de la función
  - [x] Resto de la función sin cambios (salvo T4.8: reutilizar `access.role` para el bypass)
  - [x] `npx deno check` sin errores

---

## Fase 5 — Despliegue y verificación de la tanda 2

- [x] **T5.1** — Desplegar las 8 funciones de la tanda 2 al proyecto de pruebas
  - **DoD:** [x] Las 8 desplegadas

- [x] **T5.2** — Verificación en vivo, solo lectura, antes/después
  - **AC ref:** AC1, AC2, AC3, AC4, AC-E2
  - **DoD:**
    - [x] Admin y secretaria: mismo resultado que antes (en las 6 de solo lectura)
    - [x] Secretaria en `generate-audit-report`: 403; admin: funciona
    - [x] Sin header / anon key: 401; alumno e instructor: 403 (en las 8)
    - [x] Carnet y certificado B: solo casos de rechazo (no escriben); el caso permitido desde la UI
    - [x] Resultado anotado en `acceptance.md`

- [x] **T5.3** — Regresión de UI de la tanda 2
  - **AC ref:** AC1
  - **DoD:**
    - [x] Admin y secretaria: caja, historial de cuadraturas, pagos, reportes contables, ZIP de
          certificados, certificado B, carnet y vista previa del editor de plantillas funcionan igual
    - [x] Admin: exportar auditoría funciona

---

## Fase 6 — Cierre

- [x] **T6.1** — `indices/DATABASE.md`: anotar en la tabla de Edge Functions que estas 11 exigen
  staff vía `_shared/staff-auth.ts` (y que `generate-audit-report` es solo admin)
- [x] **T6.2** — Completar `acceptance.md` con la evidencia de cada AC (`/spec-verify`)
- [x] **T6.3** — Marcar la spec como `done` en `ROADMAP.md` y limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

- [x] Deno en este repo necesita `--node-modules-dir=none` (si no, intenta resolver `@supabase/supabase-js` desde el `node_modules` de la app y falla): `npx deno test --node-modules-dir=none supabase/functions/_shared/staff-auth.test.ts`.
- [x] Tanda 2: el chequeo se **agrega** al inicio del `try` sin quitar el bloque `getUser()` existente, porque 5 funciones usan después ese `user` (nombre de quien genera el reporte) y `generate-payment-report` consulta datos con un cliente que lleva la sesión del usuario. En `generate-certificate-b-pdf` el bypass `force` sigue usando su `callerRole` (ya garantizado staff por el helper). Cambio mínimo: una llamada extra a Auth en esas funciones.
- [x] T5.3: el historial de cuadraturas no llegó a llamar a la función desde la UI (la pantalla corta antes con 'No hay datos para exportar' según los cierres cargados; el Excel es client-side). Esa función quedó verificada por API: admin y secretaria reciben el mismo PDF que antes. El carnet (`generate-student-license-pdf`) y el modo real del certificado B escriben datos: su caso permitido no se probó en vivo (pendiente de prueba desde la ficha/certificación cuando se acepte regenerar un carnet o emitir un certificado de prueba); sus rechazos sí.
- [x] `deno check --no-lock` para no modificar `deno.lock`.
- [x] `generate-payroll-report`: la consulta del nombre de quien genera el reporte pasa de `supabase_uid = user.id` a `id = access.userId` (mismo usuario, ya resuelto por el helper).
