# Fix: Alineación inconsistente de "Acciones" (header a la derecha, contenido a la izquierda para "Finalizada")

> id: fix-221-m-alineacion-acciones-consistente-asistencia-b
> refs: fix-220-m-hueco-visual-estado-acciones-asistencia-b, fix-219-m-header-acciones-desalineado-asistencia-b, fix-159-m-anchos-columna-asistencia-b-sin-sede
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

`fix-220-m` resolvió el hueco entre Estado y "Finalizada" alineando ese texto a la izquierda
(`justify-start` condicional solo para `status === 'presente'`), pero dejó la cabecera "Acciones"
en `text-right` (de `fix-219-m`). Resultado: la cabecera queda flotando sola en el extremo
derecho de la tabla, sin ninguna relación visual con el contenido de la columna en las filas
`presente` — se ve roto (reportado por el usuario con captura). Cada fix anterior resolvió un
síntoma aislado sin mirar la cabecera + TODOS los estados de contenido juntos.

**Decisión de diseño correcta (verificada con Playwright, misma vista real):** alinear TODO a la
izquierda — cabecera y contenido, para TODOS los estados (botones incluidos) — en vez de perseguir
alineaciones distintas por fila. Con `table-layout: fixed` + colgroup (ya vigente desde
`fix-159-m`), el ancho de la columna Acciones es fijo (18%) independientemente del contenido, así
que alinear a la izquierda ya no reintroduce el problema original de `fix-159-m` (ahí el hueco
aparecía porque `table-layout: auto` volcaba TODO el espacio sobrante en la última columna sin
ancho propio — un problema de ancho no acotado, no de alineación). Con ancho fijo, alinear a la
izquierda deja como máximo ~98px de aire después del contenido y antes del borde derecho de la
card (holgura entre el 18% reservado y el contenido real más ancho, "En Curso"), un espacio
sobrante normal al borde exterior de la tabla — no un hueco entre columnas de datos.

## ACs Afectados

Ninguno — fix autónomo (corrige el efecto secundario de `fix-219-m`/`fix-220-m`, reportado por
el usuario con captura de pantalla).

## Cambio

- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - `<th>` de "Acciones" (~línea 475): `text-right` → `text-left` (revierte `fix-219-m`).
  - Contenedor flex de la celda Acciones (~línea 550): se elimina el binding condicional
    `[class.justify-end]`/`[class.justify-start]` de `fix-220-m` — vuelve a un único
    `class="flex items-center gap-2"` sin `justify-end`, alineado a la izquierda por defecto
    para todos los estados (botones y texto "Finalizada" por igual).

## Test de Regresión

Verificado con Playwright MCP contra `localhost:4200/app/admin/asistencia` (admin, viewport
1920px):
- Estado `presente` (dato real, 25/08/2026): cabecera "Acciones" y "Finalizada" alineados a la
  izquierda, 16px de diferencia (solo padding de celda) — antes 174px de hueco.
- Estado `pendiente` en fecha futura (27/08/2026, dato real): columna Acciones vacía por
  `isFutureDate()` — sin cambios de comportamiento, solo confirma que no rompe el caso "sin
  botones".
- Estados `pendiente` (con botones "Iniciar" + marcar inasistencia) y `en_curso` (indicador "En
  clase" + botón "Finalizar"): sin datos reales disponibles ese día, se inyectó el markup exacto
  del template (mismas clases) vía DOM temporal (no persistido) sobre la vista real — ambos
  casos quedan alineados a la izquierda, pegados a la columna Estado, sin hueco ni desconexión
  del header, igual que el caso `presente`.
- Ningún otro `justify-end` quedó en la tabla (los 2 restantes en el archivo son de pies de
  modales de Justificar/Ver Motivo, no de esta columna).

`npx tsc -p tsconfig.app.json --noEmit` limpio. Cambio puramente visual — no aplica test
automatizado según `.claude/rules/testing-tdd.md`.
