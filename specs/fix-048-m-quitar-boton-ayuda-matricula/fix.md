# fix-048-m — Quitar botón "Ayuda" del wizard de Nueva Matrícula

## Contexto

El botón "Ayuda" en el header del drawer de "Nueva Matrícula"
(`SecretariaMatriculaComponent.setupDrawerActions()`) era un no-op
(`console.log('Ayuda')`). El dueño confirmó que no tenía un destino real
pensado (no es un canal de soporte) — la idea original era una ayuda con
texto e imágenes paso a paso, pero decidió que no vale la pena mantenerla
para un equipo pequeño ya entrenado, y prefiere eliminarlo. Si en el
futuro se detecta un paso puntual que genera confusión recurrente, se
puede agregar un tip contextual específico para ese paso en vez de una
guía completa.

## Alcance

Único archivo: `secretaria-matricula.component.ts` —
`setupDrawerActions()`: eliminar la entrada `{ label: 'Ayuda', ... }` del
arreglo de `actions`, dejando solo "Reiniciar".

## Acceptance Criteria

- AC1: El header del drawer de "Nueva Matrícula" ya no muestra el botón
  "Ayuda".
- AC2: "Reiniciar" sigue funcionando igual que antes.
- AC3: `npm run test:ci` sigue en verde.
