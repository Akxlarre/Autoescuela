# Hotfix: Tabla de flota queda con scroll horizontal y acciones recortadas en anchos intermedios
> id: hotfix-039-b-flota-tabla-scroll-horizontal-breakpoint
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema

Regresión introducida en fix-126-b-app-like-admin-flota (ya cerrado). Al agregar
`[scrollable]="true"` a la `<p-table>` de `flota-list-content.component.ts`, PrimeNG mide el
ancho natural de las 7 columnas (Patente/Vehículo/Instructor/Sede/KM/Combustible/Estado/Acciones)
sin anchos explícitos: ~974px. El contenedor `dual-viewport-container` cambia de vista tarjetas a
vista tabla cuando supera 850px (`@container flotaContainer (max-width: 850px)`), pero a esos
850-1050px el wrapper de la tabla mide solo ~840-900px — no le entran las 7 columnas, así que
PrimeNG agrega scroll horizontal interno, dejando 2 de los 4 botones de acción fuera de vista sin
ninguna pista visual de que hay más contenido a la derecha (parece un bug de layout, no scroll).

Reproducido en `/app/admin/flota` a 1280px de ancho de VENTANA (el contenedor de la card mide
904px ahí): `p-datatable-table-container.scrollWidth` = 974px vs `.clientWidth` = 840px →
overflow horizontal confirmado. Screenshot del usuario mostró el mismo síntoma en dos anchos.

Ya existe el precedente correcto para esta clase de página (`admin-instructores`, `fix-125-b`):
ahí el propio breakpoint del container-query separa "cabe la tabla" de "no cabe" de forma
consistente porque esa tabla es hecha a mano sin el modo scrollable de PrimeNG. Acá el fix es
subir el breakpoint del container-query de flota para que la vista tarjetas se mantenga hasta que
el contenedor realmente tenga espacio para la tabla completa sin scroll interno.

## Cambios

- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts` —
  en los estilos del componente, el breakpoint `@container flotaContainer (max-width: 850px)`
  (declarado dos veces: `.hide-on-squeeze`/`.show-on-squeeze` y el toolbar responsive) sube de
  `850px` a `1050px`, dejando margen sobre los ~974px que la tabla necesita realmente. Aplica al
  breakpoint espejo `(min-width: 850px)` del toolbar también, para que ambos quiebren juntos.
