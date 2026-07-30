# Fix: Sin buscador en listas de alumnos de Ciclos Teóricos
> id: fix-052-b-ciclos-buscador-alumnos
> refs: 0001 (spec original de Ciclos Teóricos)
> status: done
> closed: 2026-07-17
> created: 2026-07-17

## Root Cause
Edge case no cubierto por la implementación original: tanto el modal "Incorporar
alumno de otro ciclo" (`addableStudents()`) como el roster "Alumnos del ciclo"
(`roster()`) se renderizan como lista plana sin filtro, dentro de un contenedor
`overflow-y-auto` de alto fijo. Confirmado en vivo: con solo 19 alumnos de prueba la
lista ya requiere scroll incómodo; en una sede real con docenas/cientos de alumnos
activos repartidos en varios ciclos, encontrar a un alumno específico se vuelve
lento. El dato `cicloActualLabel` ya existe por alumno en `addableStudents()` pero no
se usa para agrupar/filtrar.

## ACs Afectados
Ninguno funcional nuevo — mejora de usabilidad sobre el listado existente (RF-12 /
override de Spec 0001). No cambia qué alumnos son candidatos, solo cómo se
encuentran.

## Cambio
- **Archivo:** `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`
  - Agregar un `signal` de texto de búsqueda + `computed` que filtra `addableStudents()`
    por `nombre`/`email` (case-insensitive, sin acentos) antes de listarlos en el modal.
    Input de búsqueda arriba de la lista, con `<app-icon name="search">`.
  - Mismo patrón para `roster()` en el rail "Alumnos del ciclo" (input de búsqueda
    encima de la lista, filtra por `nombre`/`email`).
  - Función pura de filtrado en `core/utils/` (Functional Core) con su `.spec.ts`,
    reutilizable entre ambas listas si el shape lo permite.

## Test de Regresión
- `core/utils/<nombre>.utils.spec.ts` — filtra por nombre parcial, email parcial,
  ignora mayúsculas/acentos, string vacío devuelve todo, sin resultados muestra el
  estado vacío existente.
- `npm run test:ci` verde.
- `/verify` (Playwright): tipear en el buscador de "Incorporar" y del roster reduce
  la lista visible correctamente.
