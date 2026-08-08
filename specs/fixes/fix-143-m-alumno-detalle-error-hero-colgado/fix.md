# Fix: Alumno Detalle — hero "Cargando..." colgado en estado de error + botón redundante
> id: fix-143-m-alumno-detalle-error-hero-colgado
> refs: fix-142-m-actividad-reciente-entity-id-no-es-student-id
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause
En `admin-alumno-detalle.component.ts`, el `title`/`contextLine` del `app-section-hero`
están enlazados a `facade.alumno()?.nombre ?? 'Cargando...'` /
`facade.alumno() ? ... : 'Obteniendo información...'`. Esas expresiones solo distinguen
"hay alumno" vs "no hay alumno" — no contemplan el estado de error. Cuando
`facade.error()` está seteado (fetch fallido), `facade.alumno()` sigue siendo `null` pero
`facade.isLoading()` ya es `false`, así que el hero queda mostrando "Cargando..." /
"Obteniendo información..." indefinidamente aunque el bloque `@else if (facade.error())`
ya está renderizando la card de error debajo. Además, esa card de error trae un botón
"Volver al Listado" redundante: el hero ya expone `[backRoute]="listadoRoute()"` con el
mismo destino.

## ACs Afectados
- Ninguno — fix autónomo (no hay spec activa; corrección de bug reportado por el owner).

## Cambio
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`
  **Qué cambia:** `title`/`contextLine` del hero pasan a considerar `facade.error()`
  (muestran "Error al cargar" / "No se pudo obtener la información" en vez de quedarse en
  "Cargando..."); se elimina el `p-button` "Volver al Listado" de la card de error (queda
  solo el back button del hero).

## Test de Regresión
- Verificación manual: forzar `facade.error()` (ej. navegando a un `students.id`
  inexistente) y confirmar que el hero deja de mostrar "Cargando..."/"Obteniendo
  información..." y que la card de error ya no tiene el botón "Volver al Listado".
- **Verificado en sesión (2026-08-08) con Playwright:** navegando a
  `/app/admin/alumnos/999999` (id inexistente, provoca 406 real de Supabase → dispara
  `facade.error()`), el hero muestra "Error al cargar" / "No se pudo obtener la
  información" (ya no "Cargando..."/"Obteniendo información..."), y la card de error
  debajo solo tiene el mensaje — sin botón "Volver al Listado". El back button del hero
  ("Volver a Listado de Alumnos") sigue disponible. Consola solo con el 406 esperado.
