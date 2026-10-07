# Asignación ASG-b-101 — Facades por sede que todavía aplican respuestas de una sede anterior (residuo de 0005-m)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-10-07
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

La spec `0005-m` (de `ASG-b-064`) introdujo `createRequestGuard()` y lo hizo **obligatorio** en
todo Facade branch-scoped (`facades.md` §7), pero cubrió una primera pasada. En el testing
transversal (`fix-190-b`, caso D06) se forzó la carrera A → B → A con las respuestas de B
demoradas y **tres pantallas sin guard terminaron mostrando datos de la otra sede** con el selector
en "A": Ex-Alumnos, Pagos y Certificación B → corregidas en `fix-195-b`. Dashboard, que sí tiene
guard, pasó.

Un grep (2026-10-07) encuentra **19 facades más** que leen la sede activa y no usan el guard. No
están reproducidos uno por uno: el objetivo es confirmarlos con el mismo test y corregir los que
fallen, con el patrón ya probado en `fix-195-b`.

## Alcance sugerido

- **Paso 1, confirmar:** agregar cada pantalla a `D06_SCREENS` en `e2e/transversal-shell.spec.ts`
  (rama `fix/190-b-testing-transversal`) con un indicador que difiera entre sedes, y correr
  `npx playwright test e2e/transversal-shell.spec.ts -g D06 --workers=1 --repeat-each=2` contra
  el build de producción. El test espera a que no quede consulta en vuelo (`esperarRedQuieta`):
  no usar tiempos fijos, dan falsos ✅/❌ con la BD cargada.
- **Paso 2, corregir** los que fallen: un guard por facade, compartido por la carga completa,
  `reload()` y el refresco SWR (`refreshSilently` también apaga `isLoading` si es la llamada
  vigente; si no, A → B → A deja el skeleton de B colgado). Test de la carrera en Vitest que
  falle sin el cambio. Ver `fix-195-b` (`ex-alumnos`, `pagos`, `certificacion-clase-b`).
- Descartar con motivo los que no apliquen: `courses` (catálogo), `secretarias`, `tasks`
  probablemente no recargan por cambio de sede — confirmarlo antes de tocarlos.
- Pantallas Profesional (`admin-alumnos-profesional`, `archivo-profesional`,
  `asistencia-profesional`, `certificacion-profesional`) están **bloqueadas en el piloto**:
  hacerlas al final o anotarlas para cuando se levante la fase.

## Referencias

- `.claude/rules/facades.md` §7 ("Guard contra respuestas fuera de orden")
- `specs/specs/0005-m-facades-respuestas-stale/` · `specs/fixes/fix-195-b-ex-alumnos-respuestas-fuera-de-orden/`
- `specs/fixes/fix-190-b-testing-transversal/fix.md` §D06 (resultados y método)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/`: `admin-alumnos-profesional`, `admin-pre-inscritos`, `anticipos`,
  `archivo-profesional`, `asistencia-profesional`, `auditoria`, `certificacion-profesional`,
  `courses`, `cuadratura`, `cursos-singulares`, `dashboard-alerts`, `historial-cuadraturas`,
  `instructores`, `libro-de-clases`, `liquidaciones`, `promociones`, `secretarias`,
  `servicios-especiales`, `tasks` (`*.facade.ts` + spec)
- `e2e/transversal-shell.spec.ts`

## Notas para quien la reclame

- Priorizar las pantallas del piloto con dinero: `cuadratura`, `historial-cuadraturas`,
  `anticipos`, `liquidaciones`, `cursos-singulares`, `servicios-especiales`.
- Una pantalla donde A y B dan el mismo número no discrimina: elegir otro indicador (o un nombre
  de la lista) para el test.
