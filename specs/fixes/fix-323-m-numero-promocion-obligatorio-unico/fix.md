# Fix: El número de promoción no es obligatorio ni único, y una manual rompe la cadencia automática
> id: fix-323-m-numero-promocion-obligatorio-unico
> refs: fix-319-m-testing-clase-profesional-piloto (S5, S7, D6, D7) · 0002-m · ASG-i-025
> status: done
> closed: 2026-10-05
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

## Corrección al implementar (2026-10-05)
- **El número ya es único** — en todo el sistema, no solo por sede: `code TEXT UNIQUE` desde
  `20260301000004_04_academy_professional.sql:48` (`professional_promotions_code_key`). Como solo
  la sede 2 tiene Clase Profesional (y siempre será así), eso cumple D7; no se agrega otra
  restricción. "No hay unicidad en BD" del Root Cause era incorrecto.
- **La cadencia es aritmética:** lunes 2026-07-27 + múltiplos de 14 días (279 = 21-09, 280 = 05-10
  calzan). Una promoción está "en la cadencia" si su `start_date` cae en esa serie; no hace falta
  columna `is_auto` ni backfill.

## Cambio
- **Migración nueva** — `reserve_next_promotion_slot` (reemplaza la de `fix-322-m`, conservando su
  colchón `planned >= 2` y los permisos): cuenta para el colchón y ancla la próxima fecha **solo
  con promociones en la cadencia** (una manual fuera de ella no la corre ni la frena); la próxima
  fecha es el siguiente lunes de la cadencia libre (si una manual ocupa ese lunes, la salta); el
  número es el mayor número existente + 1 (no "el de la última por fecha + 1", que chocaba con el
  número de una manual).
- **`src/app/core/utils/promotion-code.utils.ts`** (nuevo, puro) — validar número, sugerir el
  siguiente, reconocer la cadencia, traducir los errores de unicidad.
- **`src/app/features/admin/profesional-promociones/admin-promocion-crear-drawer.component.ts`** —
  número obligatorio (precargado con el siguiente), solo dígitos; cualquier lunes libre (los ya
  ocupados por otra promoción, deshabilitados); nombre con el número, igual que las automáticas.
- **`src/app/core/models/ui/promocion-table.model.ts`** — `CrearPromocionPayload.code`.
- **`…/admin-promocion-editar-drawer.component.ts`** — la validación del número aplica siempre.
- **`src/app/core/facades/promociones.facade.ts`** — crear guarda el número y lo propaga a los
  cursos; sugerencia del siguiente número; mensaje claro ante número o lunes repetido.
- Coordinar con `fix-322-m` (mismo RPC). La migración la aplica Matías.

## Test de Regresión
- `promotion-code.utils.spec.ts`: validación, sugerencia, cadencia y mensajes de error.
- Spec del drawer de crear y de editar: número vacío o con letras → no guarda (S7).
- Spec del facade: crear envía el número; número repetido → toast claro.
- `auto-create-next-promotions/index.test.ts` (Supabase local): una manual en el lunes que toca y
  otra fuera de la cadencia no hacen fallar la reserva ni corren la cadencia.

## Progreso
- [x] Datos de desarrollo revisados (solo lectura): las automáticas 275–282 calzan con la cadencia;
  solo 100 y 101 (anteriores al ancla, de prueba) no. Con la función nueva hoy no se reserva nada
  (ya hay 2 planificadas: 281 y 282) y la próxima sería 283 el 2026-11-16.
- [x] Migración `20261005150000_fix323_reserve_promotion_slot_cadencia_y_numero.sql`.
- [x] Utilidad + facade + drawers de crear y editar. Vitest: 49/49 en verde en los 5 archivos
  tocados (10 utilidad, 21 facade, 7 editar, 6 crear, 5 página). `tsc` y `lint:arch` sin errores
  (los avisos ARCH-10 de `promociones.facade.ts` ya existían).
- [x] Test Deno nuevo + ajuste de fechas del test de `fix-228-m` (sus fechas no eran de la
  cadencia). `deno check` OK; **no ejecutado** (Docker apagado).
- [x] Matías aplicó las migraciones de `fix-322-m` y `fix-323-m` y desplegó
  `auto-create-next-promotions` (2026-10-05). Por API: la RPC rechaza anon y authenticated (42501).
- [x] Matías corre `supabase/tests/promotions/fix-322-323-reserve-promotion-slot.sql` en el SQL
  Editor (aborta siempre a propósito) y el mensaje empieza con `RESULTADO fix-322/323: TODO OK`.
  Resultado (Matías, SQL Editor, 2026-10-05): `RESULTADO fix-322/323: TODO OK` — A reservas {1,1,0,0,0} (2026-01-26, 2026-02-09); B código 9501 fecha 2026-02-09; D sede 2 real 0 reservas.
- [x] Revisión visual (Playwright, admin, `/app/admin/clase-profesional/promociones`, sin guardar):
  el drawer de crear precarga **283**; los lunes 5-oct, 19-oct y 2-nov (promociones 280, 281,
  282) salen deshabilitados; al elegir 12-oct queda seleccionado y el nombre automático es
  "Promoción 283 (12 de Octubre 2026)". Consola: solo el `ERR_NAME_NOT_RESOLVED` conocido de
  `apis.digital.gob.cl` (respaldo de fix-139).
