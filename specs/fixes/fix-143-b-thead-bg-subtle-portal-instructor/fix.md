# Fix: Quitar `bg-subtle` de encabezados de tabla en el portal instructor
> id: fix-143-b-thead-bg-subtle-portal-instructor
> refs: fix-142-b-header-card-bg-subtle-no-canon
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Continuación de fix-142-b. Ahí se identificó que el `bg-subtle` del `<tr class="micro-label
... bg-subtle">` (fila de encabezado DENTRO de la tabla, distinta del título de la card ya
corregido) es el patrón repetido en 10+ archivos del proyecto (`alumnos-list-content`,
`flota-list-content`, etc.) y se dejó intacto por ser "canon". El owner, consultado
explícitamente, confirmó que igual le molesta esa franja gris — preferencia visual explícita
para las páginas que se están tocando en esta sesión (portal instructor), no una corrección
de un bug.

**Alcance:** limitado al portal instructor (Mis Alumnos, Mis Horas, Ensayos Teóricos) — las 3
páginas activamente tocadas en esta sesión. NO se propaga a Base Alumnos / Flota / Ex-Alumnos
ni al resto de la app en este track — eso es una decisión de Design System más amplia,
pendiente de confirmar aparte con el equipo antes de tocar 10+ archivos compartidos con
otros portales.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
Ninguno — fix autónomo (preferencia visual explícita del owner, no cambia contrato de
negocio).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/instructor/liquidacion/instructor-liquidacion.component.ts`
  — quitar `bg-subtle` de `<tr class="micro-label border-b border-border-subtle bg-subtle">`
  (encabezado Fecha/Tipo de Actividad/Sesiones/Horas).
- **Archivo:** `src/app/features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts`
  — quitar `bg-subtle` de los 2 `<tr class="micro-label ... bg-subtle">` (skeleton + real,
  encabezado Alumno/RUT/Puntaje/Fecha/Estado).
- **Archivo:** `src/app/features/instructor/alumnos/instructor-alumnos.component.ts`
  — quitar `bg-subtle` de `<tr class="micro-label bg-subtle text-left">` (header del
  `p-table`, encabezado Alumno/Curso/Progreso/Próxima Clase/Estado).

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Verificación visual en navegador: encabezados de las 3 tablas sin fondo gris.
- Sin lógica nueva → sin `.spec.ts` obligatorio.
