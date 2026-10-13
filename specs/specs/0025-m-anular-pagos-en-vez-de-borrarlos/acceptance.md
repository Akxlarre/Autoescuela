# Acceptance 0025-m — Anular pagos en vez de borrarlos

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Estado (2026-10-13):** ✅ PASA, 16/16 AC. Matías aplicó la migración y desplegó las dos edge
> functions el 2026-10-13. Falta su visto bueno visual de las capturas. Dos AC se verificaron con
> test y no en pantalla: AC-E3 (paso de pago del wizard) y AC-E5 (portal del alumno, oculto en el
> piloto).

## Evidencia

### Test SQL — `supabase/tests/rls/spec-0025-m-anular-pagos.sql` (Matías, SQL Editor, 2026-10-13)

20/20 ✅: columnas y triggers instalados; el admin anula y la fila sigue existiendo; motivo sin
espacios; `voided_by` y `voided_at` los fija la BD aunque el cliente mande otros; el monto no
cambia; `total_paid` vuelve al valor previo; un anulado no se modifica ni revive
(`PAGO_YA_ANULADO`); secretaria y sin sesión → `ANULAR_SOLO_ADMIN`; sin motivo →
`ANULAR_SIN_MOTIVO`; datos de anulación en un pago vigente o en un insert → `ANULACION_INVALIDA`;
día cerrado → `CAJA_CERRADA`; un proceso de limpieza puede borrar un pago anulado.

### Tests de la app

`npm run test:ci`: 4064 en verde. `tsc` limpio. `npm run lint:arch`: 0 errores.
`payments-status-filter.guard.spec.ts` estuvo en rojo con 12 lecturas sin estado declarado antes
de corregirlas.

### /verify — localhost:4200 contra la BD de dev, 2026-10-13

Dato de prueba: pago `PRUEBA-0025` de $1.000 en efectivo al alumno del seed Alumno67 (matrícula
2737, sede Autoescuela Chillán), registrado y anulado desde la Caja como `admin@test.com`. Queda
en la BD como pago anulado.

| Caso | Resultado |
|---|---|
| AC1 admin: botón de anular, modal con motivo obligatorio, la fila queda anulada | ✅ |
| AC2 Caja: fila tachada, "Anulado · motivo · quién · 13-10-2026 15:31" (hora de Chile), sin botón; total de ingresos y efectivo en $0; pie "Mostrando 0 ingresos · 1 anulado" | ✅ |
| AC3 saldo del alumno: pagado $0 y saldo $180.000 tras anular (era $179.000 con el pago) | ✅ |
| AC4 ficha del alumno: pago tachado con motivo, quién y cuándo; total pagado $0 | ✅ |
| AC5 Pagos: ingresos de hoy y del mes $0, métodos del mes sin pagos; recientes y estado de cuenta lo muestran "Anulado", tachado, y el total del historial queda en $0 | ✅ |
| AC8 secretaria: ve la fila anulada con el nombre de quien anuló; 0 botones de anular | ✅ |
| Modo oscuro (con el selector de tema real) y móvil 375 px | ✅ |
| Consola | 0 errores; un aviso NG0956 de Angular ajeno a este cambio |

### Edge functions desplegadas — invocadas como secretaria, 2026-10-13 (AC7)

| Función | Cómo | Resultado |
|---|---|---|
| `generate-payment-report` | PDF del 13-10-2026 | 200, PDF de 13,7 KB. La fila de Alumno67 dice "ANULADO" con $1.000; "Total Recaudado" $0 y "Total recaudado en el periodo: $0" |
| `generate-enrollment-sheet` | Matrícula 2737 | 200, PDF. Sin sección "Historial de pagos" (su único pago está anulado); "Total pagado" $0, "Saldo pendiente" $180.000 |

**Hallazgo corregido durante /verify:** la etiqueta "Anulado" iba dentro de la columna de glosa y
se montaba sobre la columna "Medio". El detalle pasó a una línea propia de ancho completo bajo la
fila.

**Observado, fuera de alcance:** a 1280 px de ancho la columna de glosa de la Caja mide 18 px y la
lista de ingresos 50 px de alto (ya era así antes de este cambio).

## Acceptance Criteria

| AC | Estado | Cómo se verificó |
|---|---|---|
| AC1 | ✅ | /verify + test SQL 4–9 + `cuadratura.facade.spec.ts` + spec del smart del admin |
| AC2 | ✅ | /verify + `cuadratura.facade.spec.ts` (totales y cierre ignoran anulados) |
| AC3 | ✅ | test SQL 3 y 10 + /verify |
| AC4 | ✅ | /verify (ficha Clase B). Profesional usa el mismo método `mapHistorialPagos` |
| AC5 | ✅ | /verify |
| AC6 | ✅ | Filtro de estado en las tres lecturas + test guardián; no se abrió Reportes Contables ni el dashboard con el pago anulado |
| AC7 | ✅ | PDF reales de las dos funciones desplegadas (tabla de arriba) |
| AC8 | ✅ | /verify + test SQL 13–14 |
| AC9 | ✅ | test SQL 19 + `cuadratura.facade.spec.ts` (aviso a Historial de Cuadraturas) |
| AC10 | ✅ | `payments-status-filter.guard.spec.ts` |
| AC-E1 | ✅ | test SQL 11–12 |
| AC-E2 | ✅ | test SQL 7, 8, 15, 16, 18 |
| AC-E3 | ✅ | `enrollment-payment.facade.spec.ts` › `rehydrateFromEnrollment` (filtra el anulado y carga el vigente). No se recorrió el wizard en pantalla |
| AC-E4 | ✅ | test SQL 20; el trigger no corre en `DELETE` |
| AC-E5 | ✅ | `alumno-pagos.component.spec.ts` (anulado → "Anulado", nunca "Pendiente"). El portal del alumno está oculto en el piloto y no se abrió |
| AC-E6 | ✅ | `cuadratura.facade.spec.ts` y spec del smart del admin (curso singular sin motivo) |
