# Fix: Asistencia B muestra los datos y la fecha del usuario anterior
> id: fix-386-m-asistencia-datos-y-fecha-del-usuario-anterior
> refs: fix-366-m-testing-asistencia-clase-b (M07, S18) · ASG-i-027
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 4 de `fix-366-m`, M07: el admin mira Asistencia en "Todas las sedes", cierra sesión y entra
una secretaria en la misma pestaña (sin recargar). Al abrir Asistencia ve las 9 clases del admin,
incluida la de la otra sede, hasta que llega su propia respuesta. La RLS le impide tocarlas, pero
ve nombres de alumnos que no son de su sede. Además la pantalla abre en la fecha que dejó elegida
el usuario anterior (S18), no en hoy.

## Root Cause

`AsistenciaClaseBFacade` es un singleton y su `initialize()` solo mira `_initialized`: si ya cargó
una vez, muestra lo que tiene en memoria y refresca en segundo plano, aunque lo cargado sea de
otra sede. Nada lo limpia al cerrar sesión. La fecha elegida vive en el mismo singleton y nadie la
devuelve a hoy. Tampoco descarta una respuesta vieja que llega después de una más nueva.

## Fix

En `asistencia-clase-b.facade.ts`:
- `initialize()` recuerda con qué sede cargó. Si la sede pedida es otra, no reutiliza lo que hay en
  memoria: vacía la tabla y las alertas y carga con skeleton.
- `enterToday()`: vuelve la fecha a hoy (hora de Chile); si estaba en otro día, lo cargado deja de
  valer. Las dos pantallas (admin y secretaria) lo llaman al abrirse, antes de cargar.
- `fetchData()` usa `createRequestGuard()`: una respuesta vieja no pisa a una más nueva
  (`facades.md` §7).

## Acceptance Criteria

- [x] AC1 — Tras cargar con una sede, `initialize()` con otra sede no deja visibles las clases ni
  las alertas anteriores mientras espera la respuesta.
- [x] AC2 — Con la misma sede, la re-entrada sigue sin skeleton (SWR).
- [x] AC3 — Al abrir Asistencia la fecha es hoy, aunque antes se haya dejado otro día.
- [x] AC4 — Una respuesta vieja que llega tarde no reemplaza a la más nueva.
- [x] AC5 — Navegador: admin "Todas" → cerrar sesión → secretaria, sin recargar: nunca aparece una
  clase de la otra sede.

## Regression Test

`asistencia-clase-b.facade.spec.ts` (AC1–AC4) y verificación en navegador con la respuesta de
`class_b_sessions` demorada (AC5).

## Verificación (2026-10-12)

- `asistencia-clase-b.facade.spec.ts` 65/65 (5 nuevos).
- Navegador, con la respuesta de `class_b_sessions` demorada 4 s: admin en "Todas" (9 clases) →
  cerrar sesión → secretaria de sede 1 → Asistencia: 0 filas y skeleton mientras espera; después sus
  8 clases, ninguna de la otra sede.
