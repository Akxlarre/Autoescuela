# Fix: Corregir el RUT en el paso 1 de un borrador no se guarda
> id: fix-063-i-corregir-rut-borrador-no-se-guarda
> refs: fix-058-i-testing-matricula-presencial (B3-2, sospecha S7)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

`EnrollmentFacade.upsertUser()`, cuando el borrador ya tiene `userId` (se volvió al paso 1 o se
retomó), hace `UPDATE users` con nombres, correo, teléfono y sede, **pero no con `rut`**. La
secretaria corrige un RUT mal tipeado, guarda, la pantalla muestra el nuevo y la BD conserva el
viejo: el contrato, el certificado y los reportes salen con el RUT equivocado. Confirmado en
`fix-058-i` (33.058.002-K → 33.058.003-8, la BD siguió con el primero).

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B3-2). Criterios de este fix:

- **AC-F1:** en un borrador de un alumno **nuevo** (sin otras matrículas ni cuenta), corregir el
  RUT en el paso 1 y guardar lo actualiza en `users.rut` (normalizado).
- **AC-F2:** si el RUT nuevo ya es de otra persona, no se guarda y se ve un mensaje claro que lo
  dice (no el error genérico de duplicado).
- **AC-F3:** si el borrador es de un alumno que ya existía (tiene otras matrículas o cuenta de
  acceso), el RUT no se cambia desde el wizard: mensaje que explica que para otra persona hay que
  descartar el borrador y empezar uno nuevo.
- **AC-F4:** sin cambio de RUT (o el mismo RUT con otro formato), todo sigue como antes.

## Cambio

- **Archivo:** `src/app/core/utils/rut.utils.ts` (+ spec) — `decideRutCorrection()`: decide
  `unchanged` / `apply` / `locked` comparando RUTs normalizados.
- **Archivo:** `src/app/core/facades/enrollment.facade.ts` (+ spec) — `upsertUser()` con `userId`
  conocido: lee el RUT guardado, decide con la util, incluye `rut` en el `UPDATE` cuando
  corresponde y traduce el duplicado del RUT a un mensaje propio.

## Test de Regresión

- `src/app/core/utils/rut.utils.spec.ts` (`decideRutCorrection`).
- `src/app/core/facades/enrollment.facade.spec.ts` (corrección aplicada, bloqueada y duplicada).

## Progreso

- [x] Tests (rojo: util 5/5, facade 5/5) + util y facade (verde).
- [x] QA en navegador.
- [x] Suite completa, `tsc`, `lint:arch` y cierre.

## Verificación

- 2026-10-23, QA Playwright como secretaria (sede 1), alumno nuevo `QA Rut Sesentaitres`:
  - Borrador creado con 21.345.063-8 → volver al paso 1, corregir a 21.345.064-6 y guardar → el
    `PATCH users` lleva `rut: "21.345.064-6"` y la BD (user 9144) quedó con ese RUT ✅ (AC-F1).
  - Corregir a 21.345.061-1 (RUT del alumno de prueba QA-061) → la BD responde 409, el banner dice
    "El RUT 21.345.061-1 ya está registrado para otra persona. Revisa el RUT; si es otro alumno,
    descarta este borrador y empieza una matrícula nueva.", el wizard queda en el paso 1 y la BD
    conserva 21.345.064-6 ✅ (AC-F2). El único error de consola es ese 409 esperado.
  - Borrador descartado al terminar.
- AC-F3 (otras matrículas o cuenta → no se cambia) y AC-F4 (mismo RUT con otro formato) cubiertos
  por `rut.utils.spec.ts` (22/22) y `enrollment.facade.spec.ts` (107/107).
- Suite completa 298 archivos, `tsc` limpio, `lint:arch` 0 errores (aviso ARCH-10 previo:
  `upsertUser()` ya superaba 50 líneas; ahora 95).
