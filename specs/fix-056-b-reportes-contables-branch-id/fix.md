# Fix: Reportes Contables no cuenta pagos reales de la sede (descuadre financiero)
> id: fix-056-b-reportes-contables-branch-id
> refs: ASG-009 (specs/assignments/ASG-009-fix-h013-reportes-contables-descuadre.md)
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
**Confirmado (refina la hipótesis heredada de ASG-009):** no es un problema de escritura
(`branch_id` sí se graba bien en `enrollments`) ni del pipeline de pago — es un bug de tipos
en `reportes-contables.utils.ts`. `payments.enrollment_id → enrollments.id` es una relación
**many-to-one**, así que Supabase/PostgREST devuelve `enrollments` como **objeto plano**
(igual que lo consumen `pagos.facade.ts` y `dashboard.facade.ts`, vía `row.enrollments?.branch_id`
sin indexar). El código de Reportes asumía (comentario incluido) que "Supabase siempre devuelve
array" y leía `p.enrollments[0]?.branch_id` — en un objeto, `[0]` es siempre `undefined`. Por eso
todo pago cae en la categoría "Otros (Sede 0)" para admin, y se descarta entero para una
secretaria (`undefined === branchId` nunca es `true`).

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgo H-013).

## Cambio
- **Archivo 1:** `src/app/core/utils/reportes-contables.utils.ts`
- **Qué cambia:** `PaymentRow.enrollments` pasa de array a objeto; `incomeCategoryKey`,
  `filterPaymentsByBranch` y `mapSingularSaleToPaymentRow` dejan de indexar `[0]` y acceden
  directo al objeto.
- **Archivo 2 (consecuencia directa del mismo cambio de tipo, detectado al compilar):**
  `src/app/core/facades/reportes-contables.facade.ts:216` — el cast `as PaymentRow[]` dejó de
  compilar porque el tipo que infiere supabase-js para el resultado de la query (sin `Database`
  generado, no conoce la cardinalidad real de la FK) sigue siendo array. Se cambia a
  `as unknown as PaymentRow[]`, confirmado empíricamente correcto (REST directo a Supabase
  muestra `enrollments` como objeto para este pago real). Sin cambios en el pipeline de
  pago/Edge Functions (no era necesario tocarlos).

## Test de Regresión
- `src/app/core/utils/reportes-contables.utils.spec.ts` — fixtures reescritos con la forma
  real (objeto) que devuelve Supabase; verifican que `filterPaymentsByBranch` y
  `computeIngresosCategoria` resuelven la sede correctamente en vez de caer en "Otros (Sede 0)".
- `npm run test:ci` → 1414/1414 verde tras el fix. `npm run lint:arch` → exit 0.

## Verificación Visual (Playwright, en vivo contra Supabase real)
- Confirmado con fetch directo a PostgREST que el pago real (`enrollment_id: 116`,
  matrícula del 2026-07-05) trae `enrollments: { branch_id: 1, license_group: "class_b" }`
  (objeto, no array) — validando la causa raíz antes de aplicar el fix.
- **Admin, "Ambas escuelas"**: `Ingresos por Categoría` pasó de `Otros (Sede 0)` a
  `Clase B (A. Chillán)` — sin cambiar el monto ($180.000).
- **Secretaria (Autoescuela Chillán, su propia sede)**: `Total Ingresos` pasó de $0 a
  $180.000 (1 operación en período) — el síntoma original de H-013 queda resuelto.
- Consola sin errores/warnings en ambas vistas.
- Nota operativa: el `ng serve` que estaba corriendo se quedó con el bundle previo al fix
  porque el cambio de tipo rompió la compilación hasta corregir el Archivo 2 (ver arriba) —
  hubo que reiniciarlo para confirmar visualmente.
