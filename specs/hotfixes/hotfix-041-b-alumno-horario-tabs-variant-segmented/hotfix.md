# Hotfix: Tabs de selector de matrícula en `/alumno/horario` usan variante inconsistente con el canon

> id: hotfix-041-b-alumno-horario-tabs-variant-segmented
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema

Revisión visual del usuario tras fix-127-b: el selector de matrícula (`<app-tabs variant="pill">`)
en `alumno-horario.component.ts` no coincide con el estilo canónico de tabs que ya usa el resto
del proyecto para este tipo de selector — ej. `/admin/asistencia` (Prácticas / Ciclos Teóricos),
que usa el patrón "track gris con pastilla activa flotando" (`rounded-xl bg-subtle` + pastilla
`bg-surface` con sombra). Ese patrón visual **ya existe como variante del propio `TabsComponent`**
(`variant="segmented"`, `tabs.component.ts:141-178`) — `admin-asistencia` lo implementó a mano en
vez de reusar el componente compartido, pero el resultado visual es el mismo que `segmented`.

`alumno-horario` usa `pill` (pastillas individuales con borde propio cada una), visualmente
distinto del canon "track + pastilla activa".

## Cambios

- **Archivo:** `src/app/features/alumno/horario/alumno-horario.component.ts` — el `<app-tabs>`
  del selector de matrícula cambia `variant="pill"` → `variant="segmented"`.
- **Ampliación de scope aprobada por el usuario en el chat:** el grid de 7 días en mobile
  (contenedor angosto, `.horario-days-grid`) muestra ~3 columnas por pantalla con scroll
  horizontal libre para el resto de la semana — las flechas de navegación saltan la semana
  completa (7 días), un patrón estándar (Google Calendar mobile hace lo mismo: swipe = dentro
  de la semana, flecha = entre semanas), pero sin `scroll-snap` el swipe se siente como scroll
  libre en vez de "enganchar" en cada día. Se agrega `scroll-snap-type: x mandatory` al wrapper
  `overflow-x-auto` y `scroll-snap-align: start` a cada columna de día, solo dentro del
  `@container horarioCalendar (max-width: 480px)` ya existente (no afecta desktop/tablet, donde
  las 7 columnas ya caben sin scroll).
