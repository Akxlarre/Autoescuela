# Fix: El número de promoción no es obligatorio ni único, y una manual rompe la cadencia automática
> id: fix-323-m-numero-promocion-obligatorio-unico
> refs: fix-319-m-testing-clase-profesional-piloto (S5, S7, D6, D7) · 0002-m · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
El número de promoción (`professional_promotions.code`, el "ID numérico MTT": arma el código de
los cursos, p. ej. `276.2`, y el ID del libro) no tiene ninguna regla:
- Crear promoción manual no lo pide (`promociones.facade.ts:292-303`; nace sin número, S18).
- Editar valida "solo números" únicamente si lo único que cambió es el código; con otro campo
  cambiado guarda `"abc"` o `""` (S7, `admin-promocion-editar-drawer.component.ts:319-328,348-356`).
- No hay unicidad en BD.
- El RPC de la cadencia calcula fecha y número desde la última promoción con número
  (`20260829110000…sql:76-90`): una manual en la fecha que le toca a la automática choca con
  `UNIQUE (branch_id, start_date)` y el cron falla todos los días (S5); una manual con número en
  otra fecha correría la cadencia.

Decisiones (Matías, 2026-10-05):
- **D6:** las manuales pueden ir en **cualquier lunes**, con **número obligatorio al crear**. El
  cron salta fechas ocupadas en vez de fallar, y la cadencia no se corre por una manual.
- **D7:** el número es **único por sede**.

## ACs Afectados
- `0002-m` — cadencia automática de 14 días: deja de trabarse o correrse por promociones manuales.

## Cambio
- **Migración nueva** — `UNIQUE (branch_id, code)` (revisar duplicados existentes antes); marca
  para distinguir manuales de automáticas (p. ej. columna `is_auto`) y RPC que calcula la cadencia
  solo con las automáticas y salta fechas ocupadas.
- **`src/app/features/admin/profesional-promociones/admin-promocion-crear-drawer.component.ts`** —
  número obligatorio, solo dígitos, cualquier lunes.
- **`…/admin-promocion-editar-drawer.component.ts`** — la validación del número aplica siempre.
- **`src/app/core/facades/promociones.facade.ts`** — mensaje claro ante número repetido.
- Coordinar con `fix-322-m` (mismo RPC). La migración la aplica Matías.

## Test de Regresión
- Spec del drawer de crear y de editar: número vacío, con letras o repetido → no guarda.
- Test SQL del RPC: una manual en la fecha que toca no hace fallar la reserva ni corre la cadencia.
