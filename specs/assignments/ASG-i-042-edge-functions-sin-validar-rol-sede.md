# Asignación ASG-i-042 — Edge functions con sesión pero sin validar rol ni sede

> **status:** reclamada
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-10-01
> **resulting_track:** 0009-i-edge-functions-exigir-usuario-staff

---

> **Confirmación (2026-09-30), en vivo contra la BD del piloto, solo lectura, con la sesión de
> `secretaria@test.com` (sede 1) pidiendo datos de la sede 2:**
>
> | Función | Resultado |
> |---|---|
> | `export-students` | ✅ CONFIRMADA: su sede 72 filas · sede 2: 133 · `branch_id: null`: 205 (todas) |
> | `generate-enrollment-sheet` | ✅ CONFIRMADA, **más grave**: devuelve la ficha real de una matrícula de la sede 2 incluso **con la anon key** (sin usuario) |
> | `export-certificates-zip` | ✅ CONFIRMADA: entrega el mismo ZIP que obtiene la secretaria de la sede 2 |
> | `generate-audit-report` | ✅ CONFIRMADA: 267 filas a una secretaria (por RLS solo ve 130, todas de su sede) |
> | `generate-payroll-report`, `generate-cash-closing-report`, `generate-cash-history-report`, `generate-payment-report`, `generate-financial-report` | ✅ CONFIRMADAS: las 5 responden 200 con `branch_id` de la sede 2 |
> | `generate-student-license-pdf`, `generate-certificate-b-pdf` | ⏳ Probables: no se llamaron porque escriben en BD/Storage |
>
> Nota de diseño: la anon key pasa `verify_jwt`; el helper debe usar `auth.getUser()` y rechazar
> si no hay usuario real.

## Contexto / Objetivo

Detectada leyendo el código (tanda de testing 2026-09-29; ver la confirmación de arriba). Varias edge functions verifican
que haya un usuario logueado, pero después usan la clave de servicio y confían en el
`branch_id` o el id que manda el navegador. Una secretaria (o cualquier usuario logueado,
incluido un alumno) podría pedir `branch_id: null`, el id de otra sede o el id de cualquier
matrícula, y recibir datos que no le corresponden.

| Función | Qué expone | Evidencia |
|---|---|---|
| `export-students` | RUT/email/teléfono de alumnos de todas las sedes | `index.ts:300-344` (verificada en código) |
| `generate-enrollment-sheet` | Ficha de cualquier matrícula | `index.ts:34-59` (verificada en código) |
| `generate-student-license-pdf` | Carnet con nombre, RUT y foto; sobrescribe un campo | `index.ts:38-61` (verificada en código) |
| `generate-certificate-b-pdf` | Certificado Clase B de cualquier matrícula | `index.ts:74-111` |
| `export-certificates-zip` | Certificados de todas las sedes, incl. Profesional (bloqueado) | `index.ts:53-106` |
| 4 funciones de reportes contables (incl. `generate-payroll-report`, `generate-cash-closing-report`) | Caja, historial, reporte contable y nómina de otras sedes | `generate-payroll-report/index.ts:134-156`; resto en `029` S5 |
| `generate-audit-report` | Log de auditoría completo | `index.ts:141-155,166` |

## Alcance sugerido

- **Paso 1, confirmar** cada función con la sesión de una secretaria (DevTools → Network →
  "Copy as fetch" → cambiar `branch_id`/id). Pasos en §4 de los checklists. Descartar las que no
  se reproduzcan.
- Crear un helper compartido en `supabase/functions/_shared/` que, a partir del JWT, resuelva
  usuario, rol, sede y grant multi-sede (mismo criterio que `resolveBranchScope()` del cliente),
  y que cada función lo use para: rechazar roles no permitidos, ignorar el `branch_id` del body
  cuando el usuario está anclado a su sede, y verificar que el id pedido pertenezca a una sede
  visible.
- Test de regresión por función (secretaria de A pidiendo datos de B → 403).

## Referencias

- `specs/testing-piloto/024a-base-alumnos-b.md` S1, S2 · `024b-ficha-ex-alumnos.md` S2
- `specs/testing-piloto/033-documentos-certificacion.md` S3, S4 · `029-contabilidad.md` S5
- `specs/testing-piloto/036-auditoria-configuracion-web.md` S1 · `037` §1 (inventario completo de edge functions)
- `src/app/core/utils/branch-scope.utils.ts` (regla de sede del cliente)

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/_shared/` (nuevo helper) y las funciones de la tabla.

## Notas para quien la reclame

- Tamaño: spec (≈11 funciones + helper). Se puede partir en tandas por función.
- Coordinar con `ASG-i-041` (mismo helper).
