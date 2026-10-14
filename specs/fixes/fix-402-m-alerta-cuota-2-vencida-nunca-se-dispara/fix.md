# Fix: la alerta "cuota 2 vencida" nunca se dispara
> id: fix-402-m-alerta-cuota-2-vencida-nunca-se-dispara
> refs: fix-395-m-testing-dashboards (caso Q13, sospecha S6) · DG-004 · spec 0010-i (AC1, AC5, AC7)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

La alerta "N matrículas con cuota 2 vencida" no aparece nunca en ningún dashboard, aunque haya
alumnos tomando clases de la segunda mitad del curso con saldo pendiente.

## Root Cause

`DashboardAlertsFacade.checkOverdueSecondInstallment()` filtra
`enrollments.payment_mode = 'deposit'`, un valor que no existe: el dominio real es
`'total' | 'partial'` (DG-004). La consulta siempre devuelve 0 filas.

Corregir solo el valor no basta, por dos razones leídas en el código y en los datos de dev:

- La consulta toma sesiones con `class_number > 6` **en cualquier estado**. Como las 12 clases se
  agendan al matricular, toda matrícula con saldo tendría "clases posteriores a la 6" aunque fueran
  futuras o canceladas (la única matrícula `partial` con saldo de dev solo tiene canceladas).
- Desde `0010-i` (2026-10-13) la segunda cuota ya no depende de la modalidad: la clase 7 se bloquea
  con **cualquier** deuda y solo se toma con "Habilitar sin pago". En dev, 42 de 131 matrículas
  activas con modalidad `total` tienen saldo.

## Fix

La alerta cuenta las matrículas activas con saldo pendiente que ya **tomaron** una clase 7 o
posterior (`in_progress` o `completed`), con cualquier modalidad de pago: son las habilitadas sin
pago que siguen debiendo. El texto de la alerta lo dice así.

## Acceptance Criteria

- [x] AC1 — Una matrícula activa con saldo y una clase 7+ en curso o completada dispara la alerta,
      con modalidad `total` o `partial`.
- [x] AC2 — Una matrícula con saldo cuyas clases 7+ están solo agendadas o canceladas no la dispara.
- [x] AC3 — Cada matrícula cuenta una vez aunque tenga varias clases 7+.
- [x] AC4 — La consulta no filtra por `payment_mode`.

## Regression Test

- `dashboard-alerts.facade.spec.ts` → `F-2: checkOverdueSecondInstallment`

## Verificación (2026-10-13)

- Unit: `dashboard-alerts.facade.spec.ts` 53/53. El test de filtros comprueba que la consulta pide
  clases `in_progress`/`completed` con número mayor que 6, de matrículas activas con saldo, y que
  no filtra por `payment_mode`. `tsc` sin errores.
- Navegador, secretaria de la sede 1: aparece "9 matrículas con cuota 2 vencida — Ya tomaron una
  clase 7 o posterior y siguen con saldo pendiente" (antes la alerta no existía en pantalla).
