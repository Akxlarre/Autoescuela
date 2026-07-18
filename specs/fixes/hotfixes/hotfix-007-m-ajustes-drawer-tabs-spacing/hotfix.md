# hotfix-007-m — Ajustes Drawer: contenido pegado a las tabs y nombre ilegible

## Problema
En el drawer "Ajustes del Sistema", el contenido de cada tab (Mi Perfil,
Ajustes, Seguridad) aparece pegado visualmente a la barra de tabs, sin
separación. Además, en la tab "Mi Perfil", el nombre del usuario
(`<h2>{{ currentUser()?.name }}`) no tiene clase de color y hereda un gris
casi invisible sobre el fondo blanco de la card.

## Cambio
`ajustes-drawer.component.ts`:
1. Agregar `mb-4` a la barra de tabs (`div.flex.border-b...`) para separar
   visualmente el selector de tabs del contenido de `app-drawer-form`.
2. Agregar `text-text-primary` al `<h2>` del nombre del usuario en la tab
   Mi Perfil.

## Acceptance Criteria
- [x] Existe separación visual entre la barra de tabs y el contenido de
      cada tab.
- [x] El nombre del usuario se ve en color de texto normal (no gris apagado).
