# hotfix-008-m — Configurador de Horarios: header pegado y highlight en nombre de turno

## Problema
En "Configuración de Grilla Horaria" (`configurador-horarios-drawer.component.ts`):
1. El header (título + subtítulo con `border-b`) queda pegado directamente
   contra la card grande de `app-drawer-form` que sigue debajo, sin espacio
   de separación visual.
2. El input de nombre de turno (`Turno Mañana` / `Turno Tarde`) usa
   `bg-transparent`, pero la regla global unlayered `input, textarea { background-color: var(--bg-surface); }`
   (en `styles.scss`, agregada para forzar color de texto en dark mode) gana
   por especificidad sobre la utility de Tailwind y pinta un fondo blanco
   sólido detrás del texto.

## Causa raíz
1. Falta margen/espaciado entre el header y `app-drawer-form`.
2. La regla global `input, textarea { background-color: ... }` en
   `styles.scss` no usa `@layer`, por lo que cualquier clase Tailwind
   (`bg-transparent`) aplicada a un `<input>` queda sin efecto.

## Cambio
`configurador-horarios-drawer.component.ts`:
1. Agregar `mb-4` (o equivalente) al header para separarlo de la card de
   `app-drawer-form`.
2. Agregar una clase local `.turno-name-input { background: transparent; }`
   en el bloque `styles` del componente (gana por especificidad al ser
   scoped) y aplicarla al input de nombre de turno en vez de depender de
   `bg-transparent`.

## Acceptance Criteria
- [x] Existe separación visual entre el header y el contenido del drawer.
- [x] El input de nombre de turno ya no muestra un fondo blanco/superficie
      detrás del texto; se ve transparente sobre la card del turno.
