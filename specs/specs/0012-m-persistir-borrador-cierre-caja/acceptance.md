# Acceptance 0012-m — Persistir borrador de Arqueo y Cierre de Caja

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-27
> **Verifier:** Claude (sesión interactiva) · validado por Matías (owner) en vivo con Playwright

---

## Resumen

- AC totales: 8 (AC1–AC5 + AC-E1–AC-E3)
- AC cumplidos: 7
- AC parciales: 1 (AC-E1, cobertura indirecta)
- AC fallidos: 0
- AC con evidencia: 8/8

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Autoguardado con debounce al editar fondo/cantidades/notas

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `cuadratura.facade.spec.ts` — `describe('CuadraturaFacade.guardarBorrador — autoguardado con debounce')`, 3 casos (upsert con status draft, debounce colapsa llamadas sucesivas, error silencioso)
  - QA manual: Matías (vía Claude/Playwright) verificó el 2026-08-27 — editó fondo ($35.000), 3×$10.000 y justificación en `secretaria@test.com`; Network mostró `POST .../cash_closings?on_conflict=date%2Cbranch_id_key` → 201 (primera escritura) y 200 (siguientes), sin 4xx
- **Notas:** ninguna.

### AC2 — Restaurar el borrador al reabrir el mismo día

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `cuadratura.facade.spec.ts` — `describe('CuadraturaFacade — restaurar borrador al cargar el día')`, restaura `fondoInicial`/`realizarArqueo`/`notasArqueo`/`cantidades` desde `status='draft'`
  - QA manual: F5 completo sobre `http://localhost:4200/app/secretaria/contabilidad/cuadratura` — fondo, toggle, cantidad de billetes y justificación se restauraron exactos tras la recarga (capturas en la sesión)
- **Notas:** ninguna.

### AC3 — "Cerrar panel" (antes "Listo") no descarta el borrador

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `arqueo-cierre-drawer.component.ts` — botón renombrado, `data-llm-action="cerrar-drawer-arqueo"` sin cambios, solo llama `layoutDrawer.close()` (no revierte signals)
  - QA manual: el drawer se reabrió con el borrador intacto tras cerrarlo con "Cerrar panel" y volver a abrirlo (mismo flujo que AC2)
- **Notas:** el autoguardado (AC1) es lo que realmente garantiza esto — "Cerrar panel" nunca tuvo lógica de descarte, así que no hay riesgo de regresión futura en ese botón específico.

### AC4 — Cerrar caja actualiza la misma fila, no duplica

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `cuadratura.facade.spec.ts` — `describe('CuadraturaFacade.cerrarCaja — upsert, no duplica fila de borrador')`, confirma `upsert` con `onConflict:'date,branch_id_key'` en vez de `insert`
  - QA manual: fila `id=10` (branch 1, `date=2026-08-27`) creada como `status='draft'` durante el autoguardado, verificada por query directa contra Supabase **antes** de cerrar caja; tras cerrar desde la UI, la misma query devolvió `id=10` con `status='closed'`, `closed=true` — mismo `id`, no una fila nueva
- **Notas:** el AC solo pasó tras corregir el bug de RLS descrito abajo (ver "Deuda técnica" — no, se corrigió, no quedó como deuda).

### AC5 — Un borrador nunca marca la caja como cerrada

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `cuadratura.facade.spec.ts` — caso `'NO marca cajaYaCerrada=true para una fila status="draft" (AC5)'`
  - QA manual: durante todo el ciclo de edición del borrador (fondo, cantidades, notas, F5 incluido) el badge del Hero mostró "Caja Abierta" ininterrumpidamente, hasta el clic explícito en "Cerrar Caja"
- **Notas:** ninguna.

### AC-E1 — No duplicar fila en carrera (dos ediciones simultáneas)

- **Estado:** ⚠️ parcial (cobertura indirecta, no un test de concurrencia real)
- **Evidencia:**
  - El constraint `UNIQUE INDEX ux_cash_closings_date_branch ON cash_closings (date, branch_id_key)` (migración `20260827120000`) blinda esto a nivel de BD — un upsert concurrente con la misma `(date, branch_id)` no puede crear dos filas, sea cual sea el orden de llegada.
  - Validado en T1.3/T4.3: el mismo mecanismo de upsert se probó repetidamente contra la fila existente sin duplicar (secuencial, no en paralelo real).
- **Notas:** no se montó un test con 2 sesiones de navegador simultáneas escribiendo al mismo tiempo — el riesgo real ya lo cierra el constraint de BD (nivel más fuerte que cualquier test de app), así que el gap es de cobertura de test, no de comportamiento. No bloqueante para el cierre.

### AC-E2 — El borrador no arrastra al día siguiente

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `checkCajaStatus()` sigue filtrando `.eq('date', today)` exacto — sin cambio de este comportamiento, solo se quitó el filtro de `closed=true`
  - QA manual: query directa a `cash_closings` para `date=2026-08-28` (día siguiente al probado) devolvió `[]` — no hay fila que pudiera arrastrarse
- **Notas:** ninguna.

### AC-E3 — Fallo de autoguardado no bloquea la UI

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `cuadratura.facade.spec.ts` — caso `'un error en el upsert no lanza excepción no capturada (AC-E3)'`, mockea `upsert` con error y confirma que `guardarBorrador()` no lanza
- **Notas:** no se forzó un fallo de red real en QA manual (bajo valor, ya cubierto por el test unitario con mock de error).

---

## Bug real encontrado y corregido durante T4.3 (no estaba en la spec original)

`cerrarCaja()` (transición `draft`→`closed`) devolvía **403** la primera vez que se probó en el
navegador. Causa: `update_cash_closings` (migración `20260827120000`) declaraba
`FOR UPDATE USING (...)` **sin `WITH CHECK` explícito** — Postgres reutiliza el mismo `USING`
para validar la fila NUEVA post-UPDATE, y ese `USING` exigía `status = 'draft'`, así que la
propia transición a `'closed'` quedaba bloqueada por su propia policy. Corregido con
`supabase/migrations/20260827140000_cash_closings_update_with_check_fix.sql` (un `WITH CHECK`
separado que no repite la condición de `status`). Validado local (Docker) con el flujo completo
draft→closed→intento de reedición bloqueado, y re-verificado en producción vía Playwright tras
que el usuario aplicó la migración. Sin este fix, AC4 no podía cumplirse.

---

## Out-of-scope respetado

- ❌ Sincronización en tiempo real entre dos usuarios editando el mismo borrador — confirmado: no se implementó merge de cambios concurrentes, solo el constraint anti-duplicado (AC-E1).
- ❌ Historial de versiones del borrador — confirmado: no entró, solo se persiste el último estado (upsert, no un log de cambios).
- ❌ Cambios a `saldoTeoricoEfectivo`/`diferenciaArqueo`/`puedeCerrarCaja` — confirmado: sin cambios en esos computed, solo se agregó `guardarBorrador()` y se ajustaron `checkCajaStatus()`/`cerrarCaja()`.
- ❌ Persistir borrador de ingresos/egresos — confirmado: fuera de alcance, ya se guardan de inmediato al registrarse (sin relación con este borrador).

---

## Deuda técnica detectada

- Ninguna deuda crítica. El único gap (AC-E1 sin test de concurrencia real) es de bajo riesgo — el constraint de BD ya lo blinda — y no amerita spec nueva, solo quedaría como candidato a un test E2E de dos sesiones si el equipo decide invertir en eso más adelante.

---

## Cambios en índices

- `indices/DATABASE.md` — `cash_closings`: agregadas columnas `branch_id_key` (generada), `opening_amount`, `arqueo_enabled`; policy `update_cash_closings` documentada con `USING`/`WITH CHECK` explícitos y la nota del bug de RLS encontrado.
- `indices/FACADES.md` — `CuadraturaFacade`: documentado `guardarBorrador()`, la extensión de `checkCajaStatus()` (carga y restaura el borrador) y el cambio de `cerrarCaja()` a `upsert`.

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el diseño de reutilizar la misma fila de `cash_closings` (en vez de una tabla de borradores separada) mantuvo el cambio pequeño y sin modelos UI nuevos.
- **Qué fricciones encontramos:** dos gaps de diseño no detectados en `/spec-plan` que solo aparecieron al implementar/probar: (1) `fondoInicial`/`realizarArqueo` no tenían columna — el plan asumió "sin columnas nuevas" sin verificarlo contra el modelo real; (2) el `WITH CHECK` implícito de Postgres en `FOR UPDATE USING (...)` bloqueaba la propia transición que la policy debía habilitar — un detalle de RLS fácil de pasar por alto sin probar el flujo completo en un navegador real. Ambos se detectaron y corrigieron dentro de la misma sesión gracias a validar contra Supabase local (Docker) antes de pedir aplicación manual en producción, y a la verificación final con Playwright contra la BD real.
- **Qué cambiaríamos en el siguiente ciclo SDD:** cuando un plan toca RLS con `FOR UPDATE`, verificar explícitamente si la transición de estado que el propio feature necesita (draft→closed, en este caso) sobrevive un `WITH CHECK` implícito — antes de darlo por validado con "el plan lo dice", probarlo end-to-end contra una BD real (aunque sea local) antes del QA manual final.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (7 cumplidos + 1 parcial no bloqueante, justificado arriba)
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (2234/2235, 1 falla preexistente no relacionada)
- [x] `lint:arch` limpio (exit 0)
- [x] Sin deuda crítica abierta

**Cerrado por:** Matías (owner, validado en vivo vía Playwright)
**Fecha:** 2026-08-27
