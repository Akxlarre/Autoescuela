# Fix: La ficha del alumno muestra la matrícula equivocada (un borrador como principal, y "salta" al refrescar)
> id: fix-265-m-ficha-matricula-principal-y-seleccion
> refs: fix-264-m (bugs B15 y B21), fix-263-m
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

`AdminAlumnoDetalleFacade.fetchDetalleData()` decide qué matrícula muestra la ficha con
`sorted[0]`: la más reciente por `created_at`, **sin mirar su estado ni cuál tenía elegida el
usuario**. Dos síntomas de esa misma línea, confirmados en navegador por `fix-264-m`:

1. **B15 — un borrador más reciente se muestra como matrícula principal.** Si el alumno tiene una
   matrícula activa y después un borrador (p. ej. una re-matrícula abandonada), la ficha muestra
   el número, el curso y las 0 clases del borrador. `fix-263-m` sacó los borradores del selector
   (`summaries`), pero la matrícula principal se sigue tomando de la lista sin filtrar.
2. **B21 — el selector "salta".** Cada refresco (`refreshSilently()`: guardar el perfil,
   justificar, reprogramar, generar un certificado, un evento Realtime) vuelve a ejecutar
   `fetchDetalleData()`, que pisa la matrícula elegida con la más reciente.

## ACs Afectados

Ninguno de una spec previa. Fix autónomo.

- AC-1: la matrícula que muestra la ficha al cargar es la más reciente que **no** esté en
  `draft`, `cancelled` ni `pending_payment` (mismo criterio que la Base de Alumnos,
  `AdminAlumnosFacade`). Si todas las que hay están en esos estados, la más reciente que no sea
  `draft`. Un borrador nunca es la matrícula mostrada.
- AC-2: tras un refresco de la misma ficha, sigue mostrada la matrícula que el usuario eligió en
  el selector, con sus datos (número, curso, estado, saldo, carnet, certificado, contrato y
  progreso).
- AC-3: al abrir la ficha de **otro** alumno, la elección anterior no se arrastra: se aplica AC-1.
- AC-4: si la matrícula elegida deja de existir en la respuesta, se vuelve a AC-1.

No cambia qué matrículas aparecen en el selector (decisión C06 de `024b`, sigue abierta).

## Cambio

- **Archivo:** `src/app/core/utils/ficha-enrollment.utils.ts` (nuevo)
- **Qué cambia:** función pura `pickFichaEnrollment()` con la regla de AC-1…AC-4.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
- **Qué cambia:** `fetchDetalleData()` usa `pickFichaEnrollment()` en vez de `sorted[0]`, pasando
  la matrícula elegida cuando es un refresco del mismo alumno.

## Test de Regresión

- `src/app/core/utils/ficha-enrollment.utils.spec.ts` ✓ (10 tests)
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > matrícula mostrada — fix-265-m` ✓
  (3 tests)
- `e2e/alumnos-b-ficha.spec.ts > C02 (S4)` y `> C04 (S14)` ✓ — se les quitó la marca `knownBug`
  y pasan en navegador.

Verificado el 2026-10-01: `npx vitest run` 2809 tests en verde, `npm run lint:arch` 0 errores,
`e2e/alumnos-b-ficha.spec.ts` 28/28 esperados.

## Fuera de alcance

- El historial de reagendamientos no se recarga al cambiar de matrícula en el selector (segunda
  mitad de la sospecha S14 de `024b`): es otra causa (el componente lo carga una sola vez al
  abrir la ficha) y no se probó todavía.
