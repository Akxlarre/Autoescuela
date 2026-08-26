# Fix: Hueco visual entre columnas Estado y Acciones en Asistencia del Día — Prácticas (Clase B)

> id: fix-220-m-hueco-visual-estado-acciones-asistencia-b
> refs: fix-219-m-header-acciones-desalineado-asistencia-b, fix-159-m-anchos-columna-asistencia-b-sin-sede
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

Confirmado con Playwright MCP (`localhost:4200/app/admin/asistencia`, admin, viewport 1920px):
gap medido de **174px** entre el badge "Presente" (columna Estado) y el texto "Finalizada"
(columna Acciones). Causa: la columna `acciones` tiene 18% de ancho (`columnWidths()`,
`asistencia-clase-b-content.component.ts:952-976`) — medido con Playwright que ese ancho SÍ hace
falta para el caso `en_curso` (indicador "En clase" + botón "Finalizar" ≈ 182px de contenido
real), así que no se puede reducir sin romper ese caso. El problema real es que el contenedor
`flex justify-end` (fix-159-m) empuja TODO el contenido de Acciones al borde derecho por igual,
incluyendo el texto plano "Finalizada" del estado `presente` — que no es un botón y no necesita
pegarse al borde. Eso deja ~174px de hueco vacío a la izquierda del texto, justo después del
badge de Estado (que sí está alineado a la izquierda en su propia columna).

## ACs Afectados

Ninguno — fix autónomo (continuación del hallazgo visual de `fix-219-m`, que corrigió la
cabecera pero no el hueco de fondo).

## Cambio

- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  **Qué cambia:** el contenedor flex de la celda Acciones (línea ~550) pasa de `justify-end`
  fijo a condicional: `[class.justify-end]="row.status !== 'presente'"` /
  `[class.justify-start]="row.status === 'presente'"`. Los botones reales (`pendiente`,
  `en_curso`, `ausente` sin justificar, `justificacion` presente) siguen pegados al borde
  derecho — sin cambios para esos casos. Solo el texto "Finalizada" (única salida visual del
  estado `presente`, sin botón) se alinea a la izquierda, quedando inmediatamente después del
  badge de Estado.

## Test de Regresión

Cambio visual — verificado con Playwright MCP: gap badge→texto medido antes (174px) y después
(40px, equivalente al padding normal entre celdas `pr-4`/`pl-4`) en la misma vista real
(`localhost:4200/app/admin/asistencia`). `npx tsc -p tsconfig.app.json --noEmit` limpio. Sin
lógica de decisión nueva (solo binding de clase condicional sobre un campo ya existente) — no
aplica test unitario según `.claude/rules/testing-tdd.md`.
