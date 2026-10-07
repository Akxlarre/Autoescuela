# Asignación ASG-b-102 — Sin red, 11 pantallas muestran ceros o "sin datos" en vez de un error

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-10-07
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Confirmado en vivo** (`fix-190-b`, caso X01 de ASG-i-037, build de producción): con el shell ya
cargado se cortó la red hacia Supabase y se navegó a cada pantalla de la secretaria. Solo Agenda
(`fix-189-b`), Libro de Clases, Alumnos y Ex-Alumnos muestran un error. **Las otras 11 muestran
$0, 0 o "sin datos" sin ningún aviso**: el usuario no puede distinguir "no hay nada" de "no cargó".
Causa típica: el facade lee `const { data } = await q` sin revisar `error` y aplica `data ?? []`.

**La más grave es la Caja Diaria**: sin red muestra ingresos y egresos del día en $0 y "Caja
Abierta"; `cerrarCaja()` guarda los totales en pantalla, así que se puede **cerrar el día con $0**
habiendo cobrado. Las escrituras de Cuadratura ya están en `ASG-i-048` (de i): coordinar con esa
asignación (o resolver la Caja ahí).

## Alcance sugerido

- Patrón ya probado en `fix-189-b` (Agenda): el facade lanza en `{ error }` de cada lectura, deja
  el motivo en `error()` y el estado previo en `null`; la pantalla muestra un empty-state de error
  con **Reintentar** en vez de la lista vacía, y los KPIs no muestran 0 si la carga falló.
- Pantallas (facade): Caja Diaria (`cuadratura`), Pagos (`pagos`), Reportes contables
  (`reportes-contables`), Liquidaciones (`liquidaciones`), Cursos singulares
  (`cursos-singulares`), Servicios especiales (`servicios-especiales`), Certificados
  (`certificacion-clase-b`), Documentos (`dms`), Instructores (`instructores`), Asistencia
  (`asistencia-clase-b`), Comunicación (`tasks`).
- Menor: en Alumnos y Ex-Alumnos el error se ve, pero los KPIs del hero siguen diciendo 0.
- Caja: además, **no permitir cerrar caja** si la carga del día falló.
- Test: el método de X01 (cortar `rest/v1` con `page.route(... abort)` y navegar por SPA) sirve
  de regresión en Playwright; agregarlo a `e2e/transversal-shell.spec.ts`.

## Referencias

- `specs/fixes/fix-190-b-testing-transversal/fix.md` §X01 (tabla de resultados)
- `specs/fixes/fix-189-b-*` (patrón de error + Reintentar en Agenda)
- `ASG-i-048` (Cuadratura: escrituras que fallan en silencio) · `ASG-i-055` (escrituras con éxito falso)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/`: `cuadratura`, `pagos`, `reportes-contables`, `liquidaciones`,
  `cursos-singulares`, `servicios-especiales`, `certificacion-clase-b`, `dms`, `instructores`,
  `asistencia-clase-b`, `tasks` (`*.facade.ts` + spec) y sus componentes de contenido.

## Notas para quien la reclame

- Empezar por la Caja (riesgo de cierre con $0), después Pagos y Reportes.
- `fix-195-b` también toca `pagos` y `certificacion-clase-b` (guard de orden): partir desde main
  con ese PR mergeado para evitar conflictos.
