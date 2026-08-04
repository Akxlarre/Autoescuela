# Fix: El CTA del modal de confirmación ignora `severity` (danger sale en azul de marca)
> id: fix-094-b-confirm-modal-severity-cta
> refs: ASG-b-060
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause

**[Heredado de ASG-b-060, confirmado en código]:** el modal de confirmación vive inline en
`app-shell.component.ts`. El **contenedor del ícono** sí reacciona a `severity` (líneas 86-105),
pero el **botón de confirmación** (líneas 131-138) clava `bg-(--btn-primary-bg)` sin mirarla
nunca. Resultado: una confirmación destructiva ("se cancelarán todas las clases de X") se
confirma con un botón idéntico al de guardar.

El riesgo no es estético: el color es la única señal que distingue confirmar de cancelar
cuando el usuario no lee el texto, y el patrón "azul a la derecha = seguir" se aprende rápido.

### Segundo hallazgo (barrido del Alcance de la asignación)

`ConfirmSeverity` declara 5 valores, pero el template solo contempla `warn`, `danger` y
`secondary`. **`success` e `info` no matchean ningún `[class.*]`** → el contenedor del ícono
queda sin fondo y el ícono sin color. Son 22 llamadas en la app.

### Radio de impacto medido

```
severity: 'danger'     24 llamadas   → hoy confirman en AZUL, pasarán a rojo
severity: 'success'    12 llamadas   → hoy sin tratamiento de ícono
severity: 'info'       10 llamadas   → hoy sin tratamiento de ícono
severity: 'warn'       10 llamadas   → ya funcionaba
severity: 'secondary'   1 llamada    → ya funcionaba
```

Las 24 de `danger` cambian de aspecto de golpe. **Es el efecto buscado**, pero es un cambio
visible en toda la app, no local.

## ACs Afectados

Ninguno — fix autónomo transversal.

## Cambio

- **Archivo:** `src/app/layout/app-shell.component.ts`
- **Qué cambia:** el CTA de confirmación usa `btn-danger-solid` cuando `severity === 'danger'`
  y `btn-primary` en el resto; ambas ya existen en el DS (`tailwind.css:319/352`), no se
  escribe estilo nuevo. De paso, los dos botones dejan de recomponer utilities a mano y pasan
  a las clases canónicas del DS (reduce el sprawl que audita ASG-b-057). Se agregan los casos
  `success` e `info` al contenedor del ícono.

## Test de Regresión

Sin `.spec.ts`: es un cambio de template en un componente de layout, y este proyecto excluye
los component specs de vitest (ver memoria `project_no_angular_component_tests`). La
verificación es **visual con `/verify`** más `ng build`, que es el criterio del proyecto para
componentes.

Resultado (2026-08-01):

- `/verify` — modal `danger` ("Eliminar horario", Asistencia B): CTA en `btn-danger-solid`,
  `rgb(220,38,38)` con texto blanco, **4.83:1** en claro y oscuro (AA para texto normal; el
  token es el mismo en ambos modos, tal como lo documenta el DS). Clase aplicada limpia, sin
  residuo de `btn-primary` ✓
- `/verify` — **control de no-regresión**: modal `info` ("Re-matricular alumno", Ex-Alumnos B)
  mantiene el CTA azul y ahora sí pinta el ícono (`bg-info-subtle`), que antes quedaba sin
  tratamiento. Los 26 usos no-`danger` no cambian de comportamiento ✓
- Consola limpia, 0 errores ✓
- `npx ng build` sin errores ✓
- `npm run lint:arch` exit 0 ✓
- `npm run test:ci` 1683/1683 ✓ (sin regresión en la suite existente)

## Notas

- Originado de ASG-b-060, levantada desde el `/verify` de `fix-093-b`.
- Mismo aprendizaje que `fix-093-b`: la clase ya existía en el DS. Antes de escribir estilos,
  buscar en `tailwind.css`.
- **No tocar el orden de los botones** (Cancelar izquierda / confirmar derecha). Es decisión de
  diseño aparte, explícitamente fuera de alcance en la asignación. **No se tocó.**

## Observación no corregida (para quien pase por acá)

El ícono del modal sigue siendo `alert-triangle` para todo lo que no sea `danger` — incluidos
`info` y `success`. Un triángulo de advertencia sobre un modal informativo ("Re-matricular
alumno") es un desajuste semántico menor. No se corrigió acá para no estirar el alcance:
esta corrección era de **color**, y el ícono es una decisión de vocabulario visual que conviene
tomar junto con el resto del DS. Candidata a sumarse a la fase 5 de
`docs/BACKLOG-DEUDA-TECNICA.md`.
