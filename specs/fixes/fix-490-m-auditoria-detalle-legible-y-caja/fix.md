# Fix: Auditoría — detalle legible de Configuración web, montos con miles, y caja/precios auditados
> id: fix-490-m-auditoria-detalle-legible-y-caja
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

Todo vive en `log_change()`, el trigger que escribe `audit_log`:

1. **S9.** `website_config` guarda la configuración en una sola columna JSONB `config`. El diff
   compara columna por columna, así que editar el slogan dejaba "Configuración: {JSON completo}
   -> {JSON completo}" (13.214 caracteres medidos en `fix-485-m`). No se sabía qué cambió.
2. **N6.** Los montos del detalle se concatenaban crudos: "Clase B ($180000)".
3. **D1 (decisión de `fix-485-m`).** Cambiar el precio de un curso, aplicar un descuento, cerrar
   la caja o registrar un gasto no dejaba registro: esas tablas no tenían trigger.

Va en un solo fix porque las tres cosas son la misma función: separarlas obligaba a repetir sus
~400 líneas en dos migraciones.

## ACs Afectados

- Ninguno de spec — hallazgos S9/N6 y decisión D1 del testing `fix-485-m`.

## Cambio

- **Migración `20261107120000_fix490m_audit_log_detalle_legible_y_caja.sql`:**
  - `audit_format_clp(text)`: "$180.000".
  - `audit_website_config_diff(old, new)`: lista las secciones y campos que cambiaron
    ("Marca · Eslogan: A -> B; Cursos modificado (3 ítems)").
  - `log_change()`: usa los dos helpers, y arma la etiqueta y la sede de `courses`, `discounts`,
    `discount_applications`, `cash_closings`, `cuadratura_adjustments`, `expenses` y
    `fixed_expenses`.
  - Triggers `trg_audit_*` en esas 7 tablas.
- **`core/models/ui/audit-log-row.model.ts` + `supabase/functions/_shared/audit-modules.ts`:**
  módulos "Precios y Descuentos" y "Caja y Gastos" en el mapa y el filtro.

## Test de Regresión

- Ensayo de la migración contra la BD de dev en una transacción que se revierte (`BEGIN … RAISE
  EXCEPTION`): helpers con vectores conocidos y un UPDATE de `website_config` que produce un
  detalle corto. Resultado en "Verificación".
- `core/models/ui/audit-modules.parity.spec.ts` (los módulos nuevos están en las dos copias) ✓

## Verificación

- Ensayo en dev (transacción revertida, 2026-11-07): `audit_format_clp('180000')` = `$180.000`;
  diff de ejemplo "Marca · Eslogan: A -> B; Preguntas frecuentes modificado (3 ítems); Promoción ·
  Activa: No -> Sí"; UPDATE real de `website_config` → detalle de 124 caracteres.
- Migración aplicada por Matías (2026-11-07): 7 triggers nuevos, helpers y `log_change()` vigentes.
  Prueba real con admin (revertida al tiro): "[Configuración web - Autoescuela Chillán] Marca ·
  Eslogan: … -> … (QA 490)" y "[Curso Clase B ($180.001)] Precio base: 180000 -> 180001", ambos con
  sede 1 y autor admin.
