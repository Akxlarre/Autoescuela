# Tasks 0010-i — Clase 7 bloqueada sin el segundo pago (con habilitación rápida y forzado)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-10-13

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Entrega 1 — Bloqueo, cobrar y forzar (AC1–AC6, AC10, AC-E1–E4, AC-E6)

### T1 — Migración (BD)
- [x] T1.1 SQL revisado en el chat (Ignacio delegó la revisión; 2 ajustes: saldo fijado por la BD, columnas calificadas en RLS)
- [x] T1.2 Archivo `supabase/migrations/20261013120000_spec0010i_bloqueo_clase7_pago_pendiente.sql`
- [x] T1.3 Aplicada en el piloto (SQL Editor, `lock_timeout`) — DoD: Ignacio confirma sin error — aplicada 2026-10-13 (fila 1 del test: los 5 triggers instalados)

### T2 — Test SQL
- [x] T2.1 `supabase/tests/rls/0010-i-bloqueo-clase7.sql` (sub-bloques que abortan) — 15/15 ✅ en el piloto (2026-10-13; fila 7 re-corrida tras corregir el test)

### T3 — Núcleo funcional (TDD)
- [x] T3.1 `core/utils/estado-pago-clase.utils.ts` + spec
- [x] T3.2 Token `PAGO_PENDIENTE_CLASE_7` en `db-error.utils.ts` + spec

### T4 — Modelos
- [x] T4.1 `core/models/dto/enrollment-payment-override.model.ts`
- [x] T4.2 `core/models/ui/estado-pago-clase.model.ts`

### T5 — Facades
- [x] T5.1 `AsistenciaClaseBFacade.cargarEstadoPagoClase()` + `habilitarSinPago()` + spec
- [x] T5.2 Mensaje del token para el instructor: resuelto en `ErrorSanitizerService` (lo usan ambos `startClass`) + specs

### T6 — UI
- [x] T6.1 `AdminIniciarClaseDrawerComponent`: banda, "Registrar pago", "Habilitar sin pago" (motivo inline), "Iniciar" oculto si bloqueada + spec
- [x] T6.2 Auditoría: `enrollment_payment_overrides` con nombre de módulo legible (`ENTITY_MODULE_MAP` de `AuditoriaFacade`)

### T7 — Validación y cierre de la entrega
- [x] T7.1 `npm run test:ci` + `npm run lint:arch` verdes — 3935 tests, tsc limpio, lint:arch 0 errores (2026-10-13)
- [x] T7.2 QA Playwright (rutas interceptadas): AC3, AC4, AC5, AC6 — AC3, AC4, AC5, AC-E6 ✅ (2026-10-13). AC6 en navegador queda para después de aplicar la migración (hoy cubierto por tests)
- [x] T7.3 Índices (`DATABASE.md`, `SERVICES.md`/`FACADES.md`, `COMPONENTS.md`, `DOMAIN-GOTCHAS.md`) — a mano: `npm run indices:sync` falla por los espacios en la ruta (bug previo del script); + DG-110
- [x] T7.4 `acceptance.md` con la evidencia de la Entrega 1 (2026-10-13)

---

## Entrega 2 — Aviso, certificado y texto (AC7–AC9, AC-E5)

> Se detalla al cerrar la Entrega 1 (plan §11).

- [x] T8 Aviso tras la clase 6 para toda matrícula con deuda + personal (AC7) — migración `20261013130000` aplicada en el piloto; test `supabase/tests/rls/0010-i-aviso-clase6.sql` 3/3 ✅ (2026-10-13)
- [ ] T9 Certificado con deuda: edge function + UI + lote (AC8, AC-E5) — código y tests listos (2026-10-13): gate 409 `DEUDA_PENDIENTE` en `generate-certificate-b-pdf`, `ConfirmModalService.confirmWithReason`, facade (generar, descargar, lote). Falta: desplegar la edge function DESPUÉS de que el front esté en main/publicado, con `npx supabase functions deploy generate-certificate-b-pdf --no-verify-jwt` (hoy verify_jwt=false y no está en config.toml: sin el flag se activaría) y QA
- [x] T10 Texto de la matrícula online (AC9) — dos lugares: opción "Abono inicial" (`public-enrollment.component.ts`) y nota del paso de pago (`public-payment-mode.component.ts`); 29 tests del flujo en verde
- [x] T11 (reserva de /verify, baja) Con el motivo abierto quedan dos "Cancelar" (banda + pie del drawer): unificar — el de la banda pasó a "Volver" (vuelve a las dos opciones); el del pie sigue cerrando el drawer
