# fix-042-m — Unificar header de los drawers "Ver" (Secretaria, Instructor, Relator)

## Contexto

El dueño reportó, viendo capturas de "Detalle de Secretaria" y "Detalle de
Relator", que el nombre aparece **casi transparente e ilegible** en ambos
drawers. Además, el diseño del header (avatar + nombre) de
`AdminRelatorVerDrawerComponent` está desalineado a la izquierda mientras
que `AdminSecretariasVerDrawerComponent` y `AdminInstructorVerDrawerComponent`
lo muestran centrado, y hay pequeñas diferencias de espaciado entre estos
dos últimos.

### Causa raíz (nombre ilegible)

- `admin-secretarias-ver-drawer.component.ts`: el `<p>` del nombre
  (`sec.nombre`) no tiene ninguna clase de color de texto → hereda un color
  heredado casi invisible sobre el fondo de la card.
- `admin-relator-ver-drawer.component.ts`: mismo problema, el `<h2>` del
  nombre (`rel.nombre`) tampoco tiene clase de color.
- `admin-instructor-ver-drawer.component.ts` sí tiene `text-text-primary`
  en el nombre → es la referencia correcta (no requiere cambios).

## Alcance

1. Agregar `text-text-primary` al nombre en `admin-secretarias-ver-drawer.component.ts`.
2. Reestructurar el header de `admin-relator-ver-drawer.component.ts`
   (avatar + nombre + rut + badges) para que siga el mismo patrón centrado
   de `admin-instructor-ver-drawer.component.ts` /
   `admin-secretarias-ver-drawer.component.ts`: avatar `w-16 h-16`
   centrado, nombre centrado con `text-text-primary`, borde inferior
   `border-bottom: 1px solid var(--border-subtle)`, `pb-6 mb-6`, `gap-3`.
   Actualizar el skeleton del header en el mismo componente para que
   coincida con la nueva estructura centrada (igual que el skeleton de
   instructor).
3. No se tocan `app-stat-box`, `app-badge`, tabla de cursos asignados, ni
   ninguna otra sección/lógica de negocio — solo el bloque de header.

## Acceptance Criteria

- AC1: En `admin-secretarias-ver-drawer.component.ts`, el nombre del
  header tiene una clase de color de texto (`text-text-primary`) y es
  legible sobre `bg-surface`.
- AC2: En `admin-relator-ver-drawer.component.ts`, el nombre del header
  tiene `text-text-primary` y es legible.
- AC3: El header de `admin-relator-ver-drawer.component.ts` usa layout
  centrado (`flex flex-col items-center`) con avatar `w-16 h-16`, igual
  dimensión/espaciado (`gap-3 pb-6 mb-6` + borde inferior) que
  `admin-secretarias-ver-drawer.component.ts` y
  `admin-instructor-ver-drawer.component.ts`.
- AC4: El skeleton del header en `admin-relator-ver-drawer.component.ts`
  refleja la nueva estructura centrada.
- AC5: No se modifica lógica de negocio, facades, ni tests existentes se
  rompen (`npm run test:ci` sigue en verde para los archivos tocados).
- AC6: El offset vertical del bloque avatar+nombre+email del header de
  `admin-secretarias-ver-drawer.component.ts` coincide con el de
  `admin-instructor-ver-drawer.component.ts` y
  `admin-relator-ver-drawer.component.ts` — sin padding extra duplicado
  sobre el que ya aplica `DrawerFormComponent` (`px-6 py-6`).

### Offset horizontal — revertido

Se probó una hipótesis (`scrollbar-gutter: stable` en
`DrawerFormComponent`) para el leve desplazamiento horizontal reportado
entre "Ver Secretaria" y "Ver Instructor"/"Ver Relator", pero el dueño pidió
revertir ese cambio. `DrawerFormComponent` queda sin modificar; el offset
horizontal queda pendiente de una nueva investigación si se retoma.
