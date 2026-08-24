# Fix: Instructores — secretaria duplica la página de admin y acumuló 3 divergencias
> id: fix-208-m-instructores-secretaria-reutiliza-admin
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
`secretaria/instructores` (599 líneas) es una copia de `admin/instructores` (650 líneas). Es uno
de los dos únicos pares grandes del proyecto que **duplican el template** en vez de compartirlo,
y por eso acumuló tres divergencias independientes:

1. **Botón muerto.** Los dos declaran el mismo `heroActions` con la acción `hours`, pero el
   `handleHeroAction` de secretaria solo atiende `'new'`. El botón "Horas trabajadas" se dibuja,
   se puede clickear y no hace nada; secretaria tampoco importa
   `AdminInstructorHorasDrawerComponent`.
2. **Dos mecanismos de animación.** Secretaria usa la directiva `appBentoReveal`; admin quedó
   con `GsapAnimationsService` + `viewChild` + `ngAfterViewInit` + un `effect` extra.
3. **Columna divergente.** Secretaria muestra una columna "Tipo" (`inst.tipoLabel`) que admin no
   tiene; admin muestra "Sede" condicionada a `showSedeColumn()`.

## Decisión del dueño (2026-08-24)
La columna "Tipo" **no debe estar en ninguno de los dos** roles.

## Solución elegida: reutilizar, no extraer
En vez de mover 650 líneas a un `*-content` compartido, secretaria **re-exporta el componente de
admin** en 10 líneas — el patrón que el proyecto ya usa para las 4 páginas profesionales de
secretaria, para la ficha de alumno (`AdminAlumnoDetalleComponent`) y para
`configuracion-web`. Cuesta 160 veces menos diff, elimina las 3 divergencias de una vez y hace
imposible el drift futuro en esta página.

El único obstáculo era la columna "Sede": las secretarias **no usan `BranchFacade`**
(`branch.facade.ts:23`), así que su `selectedBranchId()` no es confiable (default `null`) y la
columna aparecería indebidamente. Se resuelve con el mismo patrón que ya usa `admin/documentos`:
`showSedeColumn = isAdmin() && selectedBranchId() === null`.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/features/admin/instructores/admin-instructores.component.ts`
  **Qué cambia:** `showSedeColumn` pasa a ser role-aware (`isAdmin() && selectedBranchId() === null`)
  vía `AuthFacade`, para que la página sirva a ambos roles.
- **Archivo:** `src/app/features/secretaria/instructores/secretaria-instructores.component.ts`
  **Qué cambia:** pasa de 599 líneas a un re-export de `AdminInstructoresComponent`. Con esto
  desaparecen el botón muerto, la columna "Tipo" y el segundo mecanismo de animación.
- **Archivo:** `src/app/features/secretaria/instructores/secretaria-instructores.component.spec.ts`
  **Qué cambia:** se **elimina**. Era un duplicado exacto (mismos test names) del spec de admin,
  que sigue cubriendo la lógica; el wrapper ya no tiene lógica que testear.
- **Archivos:** `indices/COMPONENTS.md`, `indices/USAGE-MAP.md`
  **Qué cambia:** se actualiza la fila de la página de instructores de secretaria.

## Test de Regresión
- `npm run test:ci` — el spec de admin (`AdminInstructoresComponent`, 9 tests de densidad
  app-like) queda verde y ahora cubre a ambos roles.
- `npx ng build` sin errores.
- Verificación manual en secretaria: "Horas trabajadas" abre el drawer, no hay columna "Tipo",
  no hay columna "Sede", y la entrada de la grilla anima una sola vez.

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**
