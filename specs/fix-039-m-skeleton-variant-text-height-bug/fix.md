# fix-039-m — `app-skeleton-block` ignora `height` cuando `variant="text"`

## Contexto

El dueño comparó visualmente los skeletons de "Nueva Secretaria" (preciso)
contra "Nuevo Relator" (impreciso), a pesar de ser drawers casi idénticos en
estructura (banner + N campos label/input + sección de chips). Al investigar
la causa raíz se encontró un bug real en
`src/app/shared/components/skeleton-block/skeleton-block.component.ts`:

```html
[style.height]="variant() === 'text' ? '1em' : height()"
```

Cuando `variant="text"`, el atributo `height` recibido se **ignora
silenciosamente** y se fuerza a `1em` (~13-16px). Esto es correcto para
placeholders de una línea de texto (labels, subtítulos), pero varios
drawers usaban `variant="text"` con `height="40px"`, `"44px"`, `"52px"`,
`"80px"`, etc. para representar **inputs, banners y dropzones** — esos
bloques colapsaban a una línea delgada, dando el efecto de "pared de barras
finas" que se ve en "Nuevo Relator" comparado con la altura correcta de
"Nueva Secretaria" (que usa `variant="rect"` en esos mismos lugares).

## Alcance

No se modifica `skeleton-block.component.ts` (el comportamiento de
`variant="text"` forzando `1em` es intencional para placeholders de texto
real) — el fix es corregir el **uso incorrecto** de `variant="text"` en los
drawers, cambiándolo a `variant="rect"` donde el bloque representa un
input/banner/dropzone (`height >= 30px`), dejando `variant="text"` intacto
donde sí representa una línea de texto (labels, subtítulos, headers,
`height < 30px`).

Se auditó `variant="text"` combinado con `height >= 30px` en todo
`src/app/**/*.component.ts`, incluyendo tags `<app-skeleton-block>` con
atributos repartidos en múltiples líneas (una primera pasada con regex de
una sola línea dejó pasar 2 casos multi-línea en
`admin-promocion-ver-drawer.component.ts`, corregidos en una segunda pasada
con un script consciente de tags multilínea). Total: 30 ocurrencias en los
8 drawers listados — el resto de coincidencias detectadas (páginas como
`admin-alumno-detalle`, `instructor-dashboard`, `weekly-schedule-grid`,
etc.) están fuera del alcance de este fix (solo drawers), pendientes como
follow-up si el dueño lo pide.

## Archivos corregidos (8 drawers)

- `admin-editar-perfil-drawer.component.ts` (5 inputs)
- `admin-inasistencia-drawer.component.ts` (4: 2 inputs + textarea + dropzone)
- `admin-promocion-crear-drawer.component.ts` (banner + 1 input)
- `admin-promocion-editar-drawer.component.ts` (5 inputs)
- `admin-promocion-ver-drawer.component.ts` (3: 4 stat-boxes en `@for` +
  2 stat-boxes `col-span-2` multi-línea)
- `admin-relator-crear-drawer.component.ts` (banner + 1 input-loop + chips-loop = 3)
- `admin-relator-editar-drawer.component.ts` (3 inputs)
- `admin-relator-ver-drawer.component.ts` (3 stat-boxes + 2 chips-loop = 5)

## Acceptance Criteria

- [x] AC0: Los 30 bloques `variant="text"` con `height >= 30px` en los 8
  drawers listados pasan a `variant="rect"` (manteniendo el mismo `width`/
  `height`/`class`).
- [x] AC1: Los bloques `variant="text"` con `height < 30px` (labels,
  subtítulos, headers) quedan intactos.
- [x] AC2: No se modificó `skeleton-block.component.ts` ni ningún `#content`
  real, Facade, ni lógica de negocio.
- [x] AC3: `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Cierre

Se reemplazó `variant="text"` → `variant="rect"` en las 30 ocurrencias con
`height >= 30px` de los 8 drawers listados. Primera pasada con regex
de una sola línea (28 ocurrencias); una segunda pasada con un script
Python que parsea el tag completo `<app-skeleton-block ... />` sin importar
saltos de línea confirmó y corrigió los 2 casos restantes
(multi-línea, `admin-promocion-ver-drawer.component.ts`). Verificación
final con el mismo script: **0 ocurrencias restantes** de
`variant="text"` + `height >= 30px` en los drawers. `tsc --noEmit`
limpio.

**Follow-up pendiente (fuera de alcance, no se tocó):** el mismo patrón
(`variant="text"` + `height >= 30px`) existe en ~14 archivos que no son
drawers (páginas completas como `admin-alumno-detalle.component.ts`,
`instructor-dashboard.component.ts`, `alumno-dashboard.component.ts`,
componentes de lista como `weekly-schedule-grid`, `daily-schedule-timeline`,
`liquidaciones-content`, `certificacion-*-content`, etc.). Si el dueño quiere
la misma corrección ahí, es un fix de seguimiento con el mismo patrón.
