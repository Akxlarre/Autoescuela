# Acceptance 0010-i — Clase 7 bloqueada sin el segundo pago (con habilitación rápida y forzado)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-10-13 — Entrega 1 verificada (front + BD 15/15); Entrega 2: solo AC9
> **Verifier:** tests unitarios + Playwright con rutas interceptadas · pendiente: test SQL en el piloto

---

## Resumen

- Entrega 1: AC1–AC6, AC10, AC-E1–AC-E4, AC-E6.
- Entrega 2 (AC7–AC9, AC-E5): AC7 y AC9 verificados; AC8 y AC-E5 con código y tests, pendientes de desplegar `generate-certificate-b-pdf` y QA en navegador.
- **Entrega 1 cerrada:** migración `20261013120000` aplicada en el piloto y `supabase/tests/rls/0010-i-bloqueo-clase7.sql` en verde (15/15). Pendiente menor: ver AC6 en la app del instructor con una clase 7 real.

| AC | Estado | Evidencia |
|----|--------|-----------|
| AC1 bloqueo en BD | ✅ | Test SQL en el piloto: `scheduled → completed` y `no_show → completed` con deuda → `PAGO_PENDIENTE_CLASE_7` (filas 2–3) |
| AC2 clases 1–6 y agenda libres | ✅ | Clase 1–6 con deuda se completa (fila 4); `estado-pago-clase.utils.spec.ts` |
| AC3 la secretaria lo ve | ✅ | Playwright: banda "Bloqueada: pago pendiente $180.000", sin "Comenzar Clase", con "Registrar pago" y "Habilitar sin pago" (captura `qa-0010-i-bloqueada.png`) |
| AC4 cobrar al tiro | ✅ front | Playwright: "Registrar pago" apila el drawer de pago con la matrícula y su saldo ("Matricula Completa Prueba Wizard — $180.000"); al volver con saldo 0 el drawer se re-crea, relee y muestra "Comenzar Clase" sin recargar. El pago real no se guardó (QA sin escribir en la BD compartida) |
| AC5 forzar | ✅ | Playwright: motivo "abc" deja el botón deshabilitado; motivo válido envía `{enrollment_id, kind: "clases", reason, created_by}` y el drawer pasa a "Habilitada sin pago — debe $180.000" + toast "Se avisó a los administradores". BD: la constancia guarda el saldo real aunque el cliente mande otro (fila 8), un aviso por admin activo (fila 9), la clase habilitada se completa (fila 10), motivo < 5 letras rechazado (fila 11) |
| AC6 instructor | ✅ unit | `instructor-clases.facade.spec.ts` + `error-sanitizer.service.spec.ts`: el token llega como "Pago pendiente: el alumno debe pasar por secretaría." En navegador: pendiente de una clase 7 real tras aplicar la migración |
| AC10 aviso en cada clase forzada | ✅ | Banda "Habilitada sin pago — debe $X" con "Registrar pago" (Playwright). BD: un aviso por cada secretaria activa de la sede, 6/6 (fila 12) |
| AC-E1 pago parcial no desbloquea | ✅ | El criterio es `saldo > 0` (util + trigger); con saldo > 0 la BD bloquea (filas 2–3) |
| AC-E2 pago pending no desbloquea | ✅ | Re-corrida 2026-10-13 sobre una matrícula con deuda real: tras un pago `pending` el saldo sigue igual a base − descuento − pagos `paid` (primera corrida ❌ era error del test: fijaba el saldo a mano y `trg_update_balance` lo recalcula) |
| AC-E3 finalizar / ausente libres | ✅ | `in_progress → completed` con deuda pasa (fila 6) |
| AC-E4 secretaria de otra sede | ✅ | RLS con JWT simulado: otra sede rechazada (fila 13), misma sede permitida (fila 14), nadie borra (fila 15); facade no da por habilitada con 0 filas |
| AC7 aviso tras la clase 6 | ✅ | Test SQL en el piloto (3/3): matrícula con modalidad "total" y deuda completa la clase 6 sin error; 1 aviso al alumno ("antes de tu clase 7") y 1 por cada secretaria activa de la sede + admin activo (7/7). Migración `20261013130000` |
| AC9 texto de la matrícula online | ✅ | "El saldo debe estar pagado antes de tu clase 7" en la opción "Abono inicial" y en la nota del paso de pago (había dos textos con la promesa "cuando quieras") |
| AC-E6 forzado que falla | ✅ | Playwright con POST → 403: sigue "Bloqueada", el motivo queda escrito, toast "No tienes permisos…" (captura `qa-0010-i-forzado-falla.png`) |

## Validación automática

- `npm run test:ci`: 266 archivos, 3935 tests en verde (2026-10-13).
- `npx tsc -p tsconfig.app.json --noEmit`: sin errores.
- `npm run lint:arch`: 0 errores (182 advertencias preexistentes).
- Consola del navegador durante la QA: solo el 403 provocado a propósito para AC-E6.

## Hallazgos durante la verificación

- **Hueco en el trigger (corregido antes de aplicar):** `OLD.status = 'scheduled'` dejaba pasar
  `no_show → in_progress`. Ahora vigila toda entrada a iniciada/completada (DG-110).
- **Token crudo en pantalla (corregido):** `ErrorSanitizerService` pasaba los P0001 tal cual; habría
  mostrado `PAGO_PENDIENTE_CLASE_7` a la secretaria y al instructor.
- Capturas de la QA en el scratchpad de la sesión (no se versionan).
