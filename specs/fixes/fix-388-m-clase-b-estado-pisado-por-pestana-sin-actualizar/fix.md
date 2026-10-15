# Fix: una pestaña sin actualizar pisa el inicio, la inasistencia o el cierre de una clase práctica
> id: fix-388-m-clase-b-estado-pisado-por-pestana-sin-actualizar
> refs: fix-366-m-testing-asistencia-clase-b (N03) · ASG-i-027 · 0030-b
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 4 de `fix-366-m`, dos personas con Asistencia abierta (no hay tiempo real, cada una ve la
clase como "Pendiente" hasta que actualiza):
- **N03:** A inicia la clase. B, sin actualizar, también la inicia: recibe "Clase iniciada" y pisa
  la hora y el kilometraje de A (22:28:45 / 2.085 → 22:29:49 / 2.090).
- **N03-b:** A marca ausente. B, sin actualizar, la inicia: la clase queda "En curso" con su
  inasistencia vigente y el alumno aparece en las alertas con 1 falta mientras está en clase.
- **N03-c:** con la clase en curso, B la marca ausente: queda "Ausente" con hora y km de inicio.

Lo mismo pasa desde "Clases Actuales" del Dashboard, que usa los mismos drawers.

## Root Cause

`startClass()`, `markAttendance()` y `finishClass()` de `AsistenciaClaseBFacade` escriben el
estado nuevo filtrando solo por `id`. No comprueban que la clase siga en el estado que la persona
tenía en pantalla, así que la última escritura gana aunque parta de un estado que ya no existe.
`cancelStart()` y `undoAbsence()` sí lo hacen (`.eq('status', …)`).

## Fix

- `class-b-session.utils.ts`: `StaleSessionError` y `staleSessionMessage()` — el mensaje según lo
  que se intentó y el estado real de la clase.
- `asistencia-clase-b.facade.ts`:
  - `moveSession()`: cambia el estado solo si la clase sigue en el estado de partida (el `UPDATE`
    lleva `.eq('status', desde)`); si no tocó filas, lee el estado real y lanza `StaleSessionError`.
  - `startClass()` parte de `scheduled`; `finishClass()` de `in_progress`; marcar ausente de
    `scheduled`, y ahora cambia primero la sesión y después registra la asistencia (si esta falla,
    la sesión vuelve a `scheduled`).
  - Marcar ausente una clase que ya está ausente no es un error: avisa que ya estaba registrada.
  - En los tres casos se avisa y se recarga la tabla.
- Drawers de Iniciar y Finalizar: muestran ese mensaje y refrescan "Clases Actuales".

## Acceptance Criteria

- [x] AC1 — Iniciar una clase que ya no está pendiente no escribe nada y dice por qué.
- [x] AC2 — Marcar ausente una clase en curso o finalizada no escribe nada (ni sesión ni asistencia).
- [x] AC3 — Marcar ausente una clase ya ausente no da error y deja una sola inasistencia.
- [x] AC4 — Finalizar una clase que ya no está en curso no escribe nada y dice por qué.
- [x] AC5 — Si la asistencia no se pudo registrar, la clase no queda "Ausente".
- [x] AC6 — Navegador, dos sesiones: N03, N03-b y N03-c ya no pisan lo que hizo la otra persona.

## Regression Test

`class-b-session.utils.spec.ts`, `asistencia-clase-b.facade.spec.ts` y los casos N02/N03 en
navegador con dos contextos.

## Verificación (2026-10-12)

- `class-b-session.utils.spec.ts` 16/16, `asistencia-clase-b.facade.spec.ts` 74/74 (9 nuevos; incluye el aviso cuando la clase no se pudo devolver a pendiente, exigido por `unchecked-writes.guard.spec.ts`) y
  los specs de los dos drawers 13/13.
- Navegador, admin (A) y secretaria (B) con Asistencia abierta (`b4-n2.cjs`):
  - N02: A marca ausente → B recibe "La inasistencia ya estaba registrada"; una sola fila.
  - N03: A inicia (22:49:41 / 7.872 km) → B intenta con 9.999 km: "La clase cambió — Esta clase ya
    fue iniciada…"; la BD queda igual y la fila de B pasa a "En curso".
  - N03-c: B, con la fila vieja "Pendiente", marca ausente la clase en curso: aviso de "Cancelar
    inicio"; sigue en curso y sin asistencia.
  - Finalizar dos veces: B recibe "Esta clase ya fue finalizada"; km de retorno y km del vehículo
    quedan con los de A (7.881).
  - N03-b: A marca ausente → B, con el panel de Iniciar abierto, recibe "…primero deshaz la
    inasistencia"; queda ausente, sin hora de inicio.
