# fix-049-m — Certificaciones B: layout app-like + drawers

## Contexto

La vista `AdminCertificacionComponent` (`/app/admin/certificacion`,
contenido en `CertificacionClaseBContentComponent`) tiene tres problemas
de UX detectados por el dueño en la captura actual:

1. La tabla de alumnos no está pensada para pantalla completa (no es
   "app-like"): no aprovecha el alto disponible ni scrollea
   internamente.
2. La tabla "Historial de Emisiones (Log)" vive apilada debajo de la
   tabla principal, empujando todo el contenido y obligando a scroll
   largo.
3. Los paneles de confirmación "Generar Pendientes" y "Enviar Emails
   Masivo" se abren inline dentro de la misma tabla (empujando filas),
   en vez de usar el patrón de drawer ya estandarizado en el resto de
   la app (fix-024/025/026 — shell `app-drawer-form` + skeletons).

## Alcance

- `certificacion-clase-b-content.component.ts`:
  - Convertir el shell a layout app-like (`.bento-grid--fill-screen-kpi`
    + `.bento-fill` en la celda de la tabla), con scroll interno en la
    tabla principal en vez de scroll de página (Desktop lg+; Mobile
    conserva scroll nativo).
  - Quitar la tabla "Historial de Emisiones (Log)" del body y agregar
    una acción en el hero (`SectionHeroAction`) "Historial de
    emisiones" que abre el drawer nuevo.
  - Quitar los paneles inline "Generar Pendientes" y "Enviar Emails
    Masivo" (y su estado local `pendientesPanelVisible`/
    `masivoPanelVisible`) — los botones de la toolbar pasan a abrir
    drawers en vez de expandir un panel inline.
- Nuevos drawers en `features/admin/certificacion/drawers/` (Smart/Drawer:
  inyectan `CertificacionClaseBFacade` directamente, igual que
  `vehicle-agenda-drawer` o los drawers de promociones — no pueden vivir
  en `shared/` porque el Architect Guard prohíbe inyectar Facades ahí),
  todos usando el shell `app-drawer-form` y `app-skeleton-block` para
  el estado de carga, consistente con fix-024/025/026:
  - `historial-emisiones-drawer.component.ts` — lista de solo lectura
    (`hasFooter=false`), lee `CertificacionClaseBFacade.log()` /
    `isLoading()`.
  - `generar-pendientes-drawer.component.ts` — lista de alumnos
    pendientes + footer con Cancelar/Confirmar, dispara
    `facade.generarPendientes()` y cierra el drawer al terminar.
  - `enviar-masivo-drawer.component.ts` — lista de destinatarios +
    footer con Cancelar/Confirmar, dispara
    `facade.enviarEmailsMasivo()` y cierra el drawer al terminar.
- `admin-certificacion.component.ts`: inyectar `LayoutDrawerFacadeService`
  y abrir los drawers nuevos desde los outputs del content component.
- `indices/COMPONENTS.md`: registrar los 3 drawers nuevos.

## Fuera de alcance

- No se toca la lógica de negocio de `CertificacionClaseBFacade`
  (`generarPendientes()`, `enviarEmailsMasivo()`, fetch de log) — solo
  se re-cablean sus outputs desde los drawers nuevos en vez del panel
  inline.
- No se toca `secretaria-certificados.component.ts` (Clase B ya
  redirige a `AdminCertificacionComponent`) salvo que el lint
  arquitectónico lo requiera para mantener paridad.

## Acceptance Criteria

- AC1: En viewport Desktop (lg+), la página de Certificaciones B ocupa
  el alto de pantalla sin scroll de documento; la tabla de alumnos
  scrollea internamente.
- AC2: El hero de la página muestra una acción "Historial de
  emisiones" que abre un drawer con el log paginado/scrolleable; la
  tabla de historial ya no aparece en el body de la página.
- AC3: El botón "Generar Pendientes (N)" abre un drawer (no un panel
  inline) con la lista de alumnos a certificar y confirma/cancela
  desde el footer del drawer.
- AC4: El botón "Enviar Emails Masivo (N)" abre un drawer (no un panel
  inline) con la lista de destinatarios y confirma/cancela desde el
  footer del drawer.
- AC5: Los 3 drawers nuevos usan `app-drawer-form` y muestran
  skeletons mientras `isLoading()`/acción en curso, igual que el resto
  de drawers de la app.
- AC6: `npm run test:ci` sigue en verde (o solo con los fallos
  preexistentes ya documentados en memoria).
