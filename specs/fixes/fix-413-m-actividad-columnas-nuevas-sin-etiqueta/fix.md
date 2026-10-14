# Fix: la actividad muestra en inglés las columnas agregadas en los últimos tracks
> id: fix-413-m-actividad-columnas-nuevas-sin-etiqueta
> refs: fix-395-m-testing-dashboards (caso P03) · fix-218-b (mismo defecto, misma corrección) · fix-391-m · spec 0025-m · spec 0010-i
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard de secretaria → "Actividad reciente" (2026-10-13): "Matrícula actualizada — Lola
SECRETARIA modificó: **Absence Penalty Applied At**: Sin asignar -> 13-10-2026 23:08". Lo mismo se
ve en Auditoría.

## Root Cause

`audit_humanize_column()` traduce el nombre de cada columna con un diccionario fijo y, si la
columna no está, muestra el nombre técnico con mayúsculas. Las columnas creadas después de
`fix-218-b` (2026-10-09) no se agregaron al diccionario:

| Tabla | Columna | Track que la creó |
|---|---|---|
| `enrollments` | `absence_penalty_applied_at` | `fix-384-m` / `fix-391-m` |
| `payments` | `voided_at`, `voided_by`, `void_reason` | spec `0025-m` |
| `enrollment_payment_overrides` | `kind`, `pending_at_override` | spec `0010-i` |

(Consulta usada: columnas de tablas con trigger `log_change` cuya etiqueta es igual al nombre
técnico capitalizado. También salen `certificates.folio` y `class_book.horario`, que ya son
palabras en español.)

## Fix

Migración `20261013163000_fix413_audit_humanize_columnas_nuevas.sql` (**la aplica Matías**): la
definición vigente de la función (idéntica a la de `fix-218-b`, verificado contra la BD) más las 6
etiquetas. Solo cambia etiquetas, no valores.

## Acceptance Criteria

- [x] AC1 — Las 6 columnas devuelven su etiqueta en español.
- [x] AC2 — Ninguna de las 255 etiquetas existentes cambia.
- [x] AC3 — No queda ninguna columna auditada con nombre técnico en inglés.

## Regression Test

- Ensayo de la migración en una transacción con `ROLLBACK`: etiquetas nuevas, comparación de las
  existentes antes/después y la consulta de columnas sin etiqueta.

## Verificación (2026-10-13)

Migración ensayada contra la BD de dev en una transacción deshecha (no quedó aplicada). Se comparó
la etiqueta de las 395 columnas distintas del esquema antes y después:

| Columna | Antes | Después |
|---|---|---|
| `absence_penalty_applied_at` | Absence Penalty Applied At | Penalización por inasistencias aplicada |
| `voided_at` | Voided At | Fecha de anulación |
| `voided_by` | Voided By | Anulado por |
| `void_reason` | Void Reason | Motivo de anulación |
| `kind` | Kind | Tipo |
| `pending_at_override` | Pending At Override | Saldo al habilitar |

- Ninguna otra etiqueta cambió.
- Columnas auditadas que siguen sin entrada propia: `class_book.horario` y `certificates.folio`,
  que ya se leen bien ("Horario", "Folio").
- La función desplegada hoy es idéntica a la de `fix-218-b` (255 entradas, comparadas una a una).

**Falta que Matías aplique la migración.**
