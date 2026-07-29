# fix-050-m — Certificados Clase Profesional: mismo tratamiento app-like + drawers de fix-049

## Contexto

fix-049 aplicó a Certificaciones Clase B: layout app-like con dual-viewport
(tabla ↔ tarjetas según ancho real de la card), Historial de Emisiones movido
a un botón del hero + drawer, y los paneles inline "Generar Pendientes" /
"Enviar Emails Masivo" convertidos a drawers con el shell `app-drawer-form`.

El dueño pide el mismo tratamiento para `CertificacionProfesionalContentComponent`
(`/app/admin/clase-profesional/certificados` y
`/app/secretaria/profesional/certificados`), que hoy tiene:
1. Card separada solo para los selectores de Promoción/Curso, con un estado
   vacío alto (`p-8` + empty-state) que dejaba una franja de espacio muerto
   entre el hero y el contenido real.
2. Historial de Emisiones apilado al final de la página.
3. Paneles "Generar Pendientes"/"Enviar Emails Masivo" inline en la tabla.
4. La tabla de alumnos (9 columnas) no soporta bien el angostamiento cuando
   se abre un drawer al lado — provoca scroll horizontal.

## Alcance

- `certificacion-profesional-content.component.ts`:
  - Fusionar la card de selectores (Promoción/Curso) dentro de la misma card
    que la lista de alumnos (una sola card: selectores arriba + estado vacío
    o tabla/tarjetas abajo), en vez de dos `bento-banner card` separadas.
  - Mover los 4 KPIs al `heroKpis` del `app-section-hero` (density="slim"),
    igual que en Clase B — reemplaza la fila `app-kpi-card-variant` separada
    y reduce el espacio muerto entre el hero y la card unificada (espaciado
    canónico del `.bento-grid`, sin cards intermedias vacías).
  - Shell app-like: `.bento-grid--fill-screen` + `.bento-fill` en la card
    unificada, con dual-viewport (`.dual-viewport-container` +
    `@container (max-width: 900px)`: tabla `.desktop-view` ↔ tarjetas
    `.mobile-view`) igual que en Clase B (fix-049), para que abrir un
    drawer al lado no rompa el layout con scroll horizontal.
  - Quitar la tabla "Historial de Emisiones (Log)" del body; agregar acción
    "Historial de emisiones" en el hero que abre el drawer nuevo.
  - Quitar los paneles inline "Generar Pendientes"/"Enviar Emails Masivo" —
    los botones de la toolbar pasan a abrir drawers.
- Nuevos drawers en `features/admin/profesional-certificados/drawers/`
  (Smart/Drawer: inyectan `CertificacionProfesionalFacade` directamente,
  mismo patrón que fix-049):
  - `historial-emisiones-prof-drawer.component.ts` — solo lectura,
    paginada (10/página), lee `facade.log()`/`isLoading()`.
  - `generar-pendientes-prof-drawer.component.ts` — lista elegibles/no
    elegibles + footer Cancelar/Confirmar → `facade.generarPendientes()`.
  - `enviar-masivo-prof-drawer.component.ts` — lista destinatarios +
    footer Cancelar/Confirmar → `facade.enviarEmailsMasivo()`.
- `admin-profesional-certificados.component.ts` y
  `secretaria-profesional-certificados.component.ts`: inyectar
  `LayoutDrawerFacadeService` y abrir los drawers nuevos desde los outputs
  del content component (mismo cableado que `AdminCertificacionComponent`).
- `indices/COMPONENTS.md`: registrar los 3 drawers nuevos y actualizar la
  entrada de `app-certificacion-profesional-content`.

## Fuera de alcance

- No se toca la lógica de negocio de `CertificacionProfesionalFacade`
  (`generarPendientes()`, `enviarEmailsMasivo()`, fetch de log/promociones/
  cursos) — solo se re-cablean sus outputs desde los drawers nuevos.
- No se tocan los criterios de elegibilidad (teoría/nota/pago/práctica).

## Acceptance Criteria

- AC1: Los selectores de Promoción y Curso viven dentro de la misma card
  que la lista de alumnos (una sola card visible, no dos apiladas).
- AC2: El espacio entre el hero y la card unificada es el gap canónico del
  `.bento-grid` (sin cards vacías intermedias); los 4 KPIs viven en el hero
  cuando hay curso seleccionado.
- AC3: En Desktop (lg+) la página ocupa el alto de pantalla sin scroll de
  documento; al abrir cualquier drawer, la card angostada muestra tarjetas
  compactas en vez de forzar scroll horizontal en la tabla.
- AC4: El hero tiene una acción "Historial de emisiones" que abre un drawer
  paginado; la tabla de historial ya no aparece en el body.
- AC5: "Generar Pendientes (N)" y "Enviar Emails Masivo (N)" abren drawers
  (no paneles inline) con confirmación en el footer.
- AC6: `npm run test:ci` sigue en verde.
