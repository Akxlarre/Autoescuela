# Fix: el ejecutivo descuenta dos veces el costo de instructores del mes en curso
> id: fix-396-m-ejecutivo-costo-instructores-mes-en-curso
> refs: fix-395-m-testing-dashboards (caso C06, sospecha S2) · spec 0044-b (AC4, AC5)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

En el Dashboard ejecutivo, con "Este mes", la tarjeta "Gastos" muestra una fracción del costo real
de instructores, y "Resultado" queda inflado. El error es mayor a principio de mes.

## Root Cause

`exec_instructor_accrued_cost()` valoriza un mes sin liquidar con
`instructor_monthly_hours.total_equivalent`, que son las horas **acumuladas a la fecha**, y además
lo multiplica por (días del rango / días del mes completo). Con "Este mes" (1 → hoy) el avance del
mes se descuenta dos veces.

Evidencia (BD de dev, transacción revertida, 2026-10-13): un instructor de la sede 1 con 10 horas
en `2026-10` y tarifa $5.000. Rango 1–13 oct: esperado $50.000, obtenido $20.968 (= 50.000 × 13/31).
Rango 1–31 oct: $50.000.

## Fix

Migración `20261013160000_fix396_exec_costo_instructores_mes_en_curso.sql` (**la aplica Matías**).
Para un mes **sin liquidar**, las horas a la fecha se reparten sobre los días transcurridos del mes
(1 → hoy, o el mes entero si ya terminó) y el rango toma la parte que le corresponde hasta hoy. Un
mes pasado y un mes liquidado se calculan igual que antes.

## Acceptance Criteria

- [x] AC1 — Mes en curso sin liquidar, rango "Este mes" (1 → hoy): costo = horas a la fecha × tarifa.
- [x] AC2 — Mes en curso, rango parcial (p. ej. 5 → 10 con hoy = 13): costo = horas × tarifa × 6/13.
- [x] AC3 — Mes pasado sin liquidar, mes completo: horas × tarifa; medio mes: la mitad (sin cambio).
- [x] AC4 — Mes liquidado: `base_salary` × días del rango / días del mes (sin cambio).
- [x] AC5 — La función conserva firma, `search_path`, permisos y el rechazo `42501` a no-admin.

## Regression Test

- Ensayo de la migración en una transacción con `ROLLBACK` contra la BD de dev (AC1–AC5).

## Verificación (2026-10-13)

Migración ensayada contra la BD de dev en una transacción deshecha (no quedó aplicada), con hoy =
13 oct, tarifa $5.000 y 10 horas sembradas:

| Caso | Esperado | Obtenido |
|---|---|---|
| AC1 — 1–13 oct (mes en curso) | $50.000 | $50.000 (antes $20.968) |
| AC2 — 5–10 oct | $23.077 | $23.077 |
| 1–31 oct | $50.000 | $50.000 |
| Noviembre (mes que no empieza) | $0 | $0 |
| AC3 — marzo 2025 completo / 1–15 | $50.000 / $24.194 | $50.000 / $24.194 |
| AC4 — abril 2025 liquidado en $300.000, 1–15 / completo | $150.000 / $300.000 | $150.000 / $300.000 |
| AC5 — secretaria | `42501` | `42501`; `search_path` y permisos intactos |

**Ajuste posterior (mismo día):** `npm run lint:arch` marcó dos conversiones a `timestamp` heredadas
de la función original (ARCH-28). Los meses del rango se arman ahora solo con fechas puras
(`make_date` + `make_interval`). Ensayo repetido: mismos resultados de la tabla, y el año a la fecha
(1 ene – 13 oct, todas las sedes) da $2.998.500 antes y después.

Migración aplicada por Matías el 2026-10-14 y verificada en la BD de dev.
