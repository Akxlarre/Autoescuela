# Fix: `certificate_enabled` se prende con la clase #12 aunque falten clases, y nunca se apaga
> id: fix-460-m-certificate-enabled-recalculado
> refs: fix-447-m-testing-documentos-certificacion (S14) · fix-459-m · fix-262-m · spec 0006-m
> status: open
> created: 2026-10-18

## Root Cause

`trg_enable_certificate_b` (`AFTER UPDATE OF status ON class_b_sessions WHEN status='completed'
AND class_number=12`) pone `enrollments.certificate_enabled = true` en cuanto se completa la clase
**número 12**, sin contar las demás, y nada lo vuelve a `false` (una clase revertida, o una #12
completada con otras pendientes, lo dejan prendido). Las reglas reales (fix-262-m, spec 0006-m)
son: clases `completed` ≥ las del curso (`round(practical_hours*60/45)`, 12 por defecto).
En dev, por sede, 70 matrículas tienen el flag y solo 8 cumplen (las otras 62 tienen 1–9/12).

Lo leen: la alerta "N alumnos listos para certificar" del dashboard
(`dashboard-alerts.facade.ts`), el dashboard ejecutivo (`executive_dashboard_rpcs`: "en curso" vs
"listos") y el portal del alumno (`student-home.facade.ts`). La lista de certificados de la
secretaria ya no lo usa (`fix-459-m`).

## ACs Afectados

- fix-262-m / spec 0006-m — elegible = clases completadas ≥ las del curso.
- AC propio — `certificate_enabled` refleja siempre esa regla: se recalcula al crear, cambiar de
  estado o borrar una clase práctica de la matrícula (sube y baja), y la migración recalcula todas
  las matrículas Clase B existentes.

## Cambio

- Migración `20261018130000_fix460_certificate_enabled_recalculado.sql`:
  `recalc_class_b_certificate_enabled(enrollment_id)` (SECURITY DEFINER, `search_path=''`, solo
  escribe si el valor cambia); `verify_class_b_certificate_enablement()` la llama;
  `trg_enable_certificate_b` pasa a `AFTER INSERT OR UPDATE OF status OR DELETE` sin el `WHEN`;
  backfill de todas las matrículas `license_group='class_b'`.

## Test de regresión

- `supabase/tests/rls/fix-460-m-certificate-enabled.sql` — tras el backfill, el flag coincide con
  la regla en todas las matrículas Clase B; completar/revertir una clase lo sube/baja (dentro de
  una transacción que aborta).
- Navegador: la alerta del dashboard de la secretaria cuenta lo mismo que la lista de certificados.

## Progreso

- [x] Migración + test SQL. Contra la BD actual el test falla (C1: 124 matrículas con el flag
  distinto de la regla; C2: al revertir una clase el flag sigue en `true`). Ensayo migración + test
  con rollback → C1 y C2 ok; después la BD sigue igual (140 con flag, trigger viejo).
- [ ] Matías aplica `20261018130000_fix460_certificate_enabled_recalculado.sql`.
- [ ] Re-correr el test SQL y verificar la alerta del dashboard en el navegador.
