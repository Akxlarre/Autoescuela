# Fix: Cabecera "Acciones" desalineada del contenido en Asistencia del Día — Prácticas (Clase B)

> id: fix-219-m-header-acciones-desalineado-asistencia-b
> refs: fix-159-m-anchos-columna-asistencia-b-sin-sede
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

`fix-159-m` alineó el contenido de la columna "Acciones" a la derecha (`justify-end`) para que
los botones queden pegados al borde derecho de la tabla, pero no actualizó la cabecera `<th>`
correspondiente, que quedó en `text-left`. Es la única tabla "Acciones" del proyecto con esta
inconsistencia — el resto usa `text-right`/`text-center` en la cabecera cuando el contenido
también está alineado ahí (confirmado por grep en `alumnos-list-content`,
`certificacion-profesional-content`, `flota-list-content`, etc., todas con `text-right` en el
`<th>` de Acciones). El desalineamiento es más visible cuando la celda solo tiene el texto
"Finalizada" (sin botones), como reportó el usuario.

## ACs Afectados

Ninguno — fix autónomo (hallazgo visual reportado por el usuario).

## Cambio

- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  **Qué cambia:** `<th>` de "Acciones" (línea ~475) pasa de `text-left` a `text-right`, para
  alinearse con el `justify-end` del contenido de cada fila — mismo patrón que el resto de tablas
  del proyecto.

## Test de Regresión

Cambio puramente visual (clase CSS de alineación) sin lógica de decisión — no aplica test
automatizado según `.claude/rules/testing-tdd.md`. Verificación: `npx tsc -p tsconfig.app.json --noEmit`
limpio.
