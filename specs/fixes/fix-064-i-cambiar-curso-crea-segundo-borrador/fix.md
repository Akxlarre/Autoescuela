# Fix: Cambiar el curso en el paso 1 de un borrador crea un segundo borrador
> id: fix-064-i-cambiar-curso-crea-segundo-borrador
> refs: fix-058-i-testing-matricula-presencial (B3-3, sospecha S6)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

`EnrollmentFacade.savePersonalData()` busca el borrador a actualizar con
`findExistingDraft(studentId, courseId)`, es decir por **(alumno, curso)**. Si la secretaria vuelve
al paso 1 de un borrador y cambia el curso (Clase B → Clase B SENCE), no encuentra ninguno con el
curso nuevo e **inserta otro**. El borrador original queda vivo con sus horarios reservados, que
bloquean la agenda hasta que vence. Confirmado en `fix-058-i` (8496 Clase B + 8497 Clase B SENCE
del mismo alumno).

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B3-3). Criterios de este fix:

- **AC-F1:** si el wizard ya tiene un borrador y en el paso 1 se cambia el curso, se actualiza
  **ese** borrador (curso y precio nuevos), no se crea otro.
- **AC-F2:** al cambiar el curso se liberan los horarios reservados del borrador y se limpian la
  promoción y los descuentos aplicados (dependían del curso anterior).
- **AC-F3:** si el borrador ya tiene un pago registrado, el curso no se cambia y se explica que hay
  que descartar el borrador y empezar uno nuevo.
- **AC-F4:** sin cambio de curso, guardar el paso 1 sigue como antes (no libera horarios).

## Cambio

- **Archivo:** `src/app/core/facades/enrollment.facade.ts` (+ spec) — `savePersonalData()` usa el
  borrador actual del wizard (`_draft().enrollmentId`) cuando existe; si el curso cambió, libera
  lo que dependía del curso anterior antes de actualizar `course_id`.

## Test de Regresión

- `src/app/core/facades/enrollment.facade.spec.ts` (cambio de curso: mismo borrador, liberación,
  bloqueo con pago, sin cambio).

## Progreso

- [x] Tests (rojo 3/4) + facade (verde): `enrollment.facade.spec.ts` 111/111.
- [x] QA en navegador.
- [x] Suite completa, `tsc`, `lint:arch` y cierre.

## Verificación

- 2026-10-23, QA Playwright como secretaria (sede 1), alumno nuevo `QA Curso Sesentaicuatro`:
  - Borrador 8574 Clase B; paso 2 con el instructor de prueba Zzprueba (237): 12 horarios
    `reserved` guardados.
  - Volver al paso 1, cambiar a Clase B SENCE (código 9990640001) y guardar → **ningún POST** a
    `enrollments`; el alumno tiene un solo borrador (8574) con curso Clase B SENCE y el código; los
    12 horarios reservados quedaron liberados (0 sesiones) ✅ (AC-F1, AC-F2).
  - Borrador descartado al terminar. Consola sin errores.
- AC-F3 (con pago no se cambia) y AC-F4 (sin cambio no libera) cubiertos por
  `enrollment.facade.spec.ts`.
- La primera corrida de la suite falló en `payments-status-filter.guard.spec.ts` (spec 0025-m): la
  lectura nueva de `payments` no filtraba por estado. Ahora excluye los anulados
  (`.neq('status', PAYMENT_STATUS_ANULADO)`): un pago anulado no impide cambiar el curso; uno
  cobrado o pendiente sí. Test ajustado.
- Suite completa 298 archivos, `tsc` limpio, `lint:arch` 0 errores.
