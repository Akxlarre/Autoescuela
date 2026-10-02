# Fix: Reprogramar una sola clase no archiva la inasistencia ni queda en el historial
> id: fix-279-m-reprogramar-clase-archiva-inasistencia-e-historial
> refs: fix-264-m (casos F04 / F11 / F13, sospecha S7 de `024b`), fix-191-m, fix-008-i, ASG-i-024, ASG-i-027
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Root Cause

Hay dos caminos para mover una clase práctica con inasistencia o cancelada, y solo uno está
completo:

- **Reagendar Clases** (`reagendarClasesPenalizadas()`, por lote): recicla la fila de la sesión,
  marca `archived_at` en su asistencia (`fix-191-m`) y guarda una fila en
  `class_b_reschedule_history` con la razón (`fix-008-i`).
- **Reprogramar** una clase desde la Ficha Técnica (`reprogramarClase()`): recicla la fila igual,
  pero **no** archiva la asistencia ni escribe el historial.

Consecuencia del segundo camino (sospecha S7, confirmada en código): la inasistencia vieja sigue
vigente sobre una clase que volvió a estar agendada. Asistencia B y las vistas del alumno la ven
"Ausente", y `apply_class_b_absence_penalty()` puede volver a contar esa falta y cancelar clases.
Tampoco queda rastro de quién la movió ni por qué.

Además, "Cancelar" en ese formulario cierra todo el panel en vez de volver a la Ficha Técnica
desde donde se abrió.

**Decisiones del owner (Matías, 2026-10-01):** se permite reprogramar individualmente una clase
con inasistencia o cancelada; la inasistencia anterior se archiva y la reprogramación queda en el
historial de reagendamientos con su motivo. "Cancelar" vuelve a la Ficha Técnica.

## ACs Afectados

- AC-1: al reprogramar una clase que ya tenía sesión, su asistencia vigente queda archivada
  (`archived_at`), igual que en el reagendamiento por lote.
- AC-2: esa reprogramación deja una fila en el historial de reagendamientos con fecha e
  instructor anteriores y nuevos, la razón y quién la registró.
- AC-3: el formulario pide la razón (mismas opciones que "Reagendar Clases"; "Otro" exige el
  detalle) y no deja confirmar sin ella. Agendar una clase que nunca tuvo sesión no la pide ni
  escribe historial.
- AC-4: "Cancelar" vuelve al panel de Ficha Técnica.

Para `ASG-i-027` (testing de asistencia): los casos de reprogramación individual deben
re-ejecutarse contra este comportamiento.

## Cambio

- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — `reprogramarClase()`
  archiva la asistencia y escribe el historial cuando recicla una sesión existente;
  `ReprogramarClasePayload` lleva `razon` y `razonOtro`.
- **Archivo:** `src/app/features/admin/alumno-detalle/reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component.ts`
  — campo "Razón del reagendamiento" y "Cancelar" con `back()`.
- **Archivo:** `src/app/core/utils/reagendamiento.utils.ts` — `isRazonReagendamientoCompleta()`.
- **Archivo:** `e2e/support/alumnos-seed.ts` — `addMissedClass()`: siembra una clase con
  inasistencia para un alumno de prueba.

## Test de Regresión

- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > reprogramarClase — asistencia e historial (fix-279-m)` ✓
  (5 tests)
- `src/app/core/utils/reagendamiento.utils.spec.ts` ✓ (4 tests)
- `e2e/alumnos-b-ficha.spec.ts > F04 · F11 · F13` ✓ — alumno de prueba con la clase #1 en
  inasistencia: se reprograma desde la Ficha Técnica y se comprueba **en la base** que la
  asistencia quedó con `archived_at`, la sesión volvió a `scheduled` con fecha futura y hay una
  fila en `class_b_reschedule_history` con la razón; en pantalla, el historial de
  reagendamientos muestra "Médica".

## Verificación
Verificado el 2026-10-02: `npx vitest run` (2966 tests), `npm run lint:arch` (0 errores, 178
advertencias: las mismas que antes) y los dos archivos E2E de Alumnos B (57/57 esperados) en
verde; sin datos `E2E-` sobrantes (0 usuarios, matrículas, pagos ni filas de historial).

## Nota de implementación
- El archivado de la asistencia se extrajo a `archivarAsistenciaDeSesion()`, que usan los dos
  caminos (individual y por lote): la regla queda escrita una sola vez.
- La reprogramación individual exige la razón también en el facade, no solo en el formulario.
- Al verificar en navegador, el servidor de desarrollo siguió sirviendo el formulario viejo:
  `ng serve` no recompila si un archivo importa un módulo que todavía no existe y el módulo se
  crea después. Se resolvió volviendo a guardar el archivo que lo importa.
