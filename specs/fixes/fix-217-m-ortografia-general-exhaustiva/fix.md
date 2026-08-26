# Fix: Ortografía general exhaustiva (más allá de tildes) en texto visible

> id: fix-217-m-ortografia-general-exhaustiva
> refs: ASG-i-001
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

[Heredado de ASG-i-001]: `fix-216-m-ortografia-general-app` solo cubrió tildes faltantes contra
una lista fija de ~90 palabras conocidas — no detecta errores ortográficos reales (letras mal
escritas, confusiones b/v, s/c/z, dobles letras, palabras mal formadas). El dueño de negocio pidió
explícitamente ampliar la cobertura. Se extrae todo el texto visible al usuario (nodos de texto en
templates, `placeholder`, `aria-label` legible, mensajes de toast/confirmación, labels) a un
archivo de trabajo y se revisa manualmente palabra por palabra.

## ACs Afectados

Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio

Se extrajo con grep todo texto visible al usuario de `src/app` (~1217 nodos de texto entre
`>...<` + ~596 valores de `placeholder`/`aria-label`/`title` + mensajes `message:`/`title:` de
confirm/toast) y se revisó manualmente. Hallazgos corregidos (3 archivos, ya cubiertos por
`fix-216-m` no cuentan aquí):

- `src/app/shared/components/pre-inscritos-content/pre-inscritos-content.component.ts:175` —
  `subtitle` de `app-empty-state`: "Ajusta la busqueda o los filtros para ver mas resultados." →
  "Ajusta la búsqueda o los filtros para ver más resultados." (tildes faltantes que el barrido de
  `fix-216-m`, acotado a una lista fija de palabras, no cubría).
- `src/app/features/admin/contabilidad-cursos/admin-curso-singular-cobro-drawer.component.ts:132`
  y `admin-curso-singular-detalle-drawer.component.ts:278` — "Sin inscriptos registrados." → "Sin
  inscritos registrados." ("inscriptos" es forma rioplatense/regional, inconsistente con
  "inscritos" usado en el resto de la app — mismo patrón que el problema de voseo, pero de una
  sola palabra).

**Límite de alcance deliberado:** `inscriptos` también existe como identificador de código
(`_inscriptos` signal, `loadInscriptos()` método, `InscriptoCursoSingular` tipo) en
`cursos-singulares.facade.ts` y sus consumidores. Renombrar esos identificadores es un refactor de
alcance distinto (toca facade + tests + 2 componentes, no es "texto visible") — se deja fuera de
este fix; solo se corrigió el texto que el usuario efectivamente lee.

Barrido de placeholders/aria-label/title (~596 líneas) y de mensajes de confirm/toast no encontró
errores adicionales.

## Test de Regresión

Copy puro sin lógica de decisión — no aplica test automatizado según `.claude/rules/testing-tdd.md`.
Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio en los 3 archivos tocados.
