# fix-032-m — Detalle de Alumno: layout se desordena al abrir un drawer

## Contexto

El dueño reportó que al abrir cualquier drawer desde `/app/admin/alumnos/:id`
(reprogramar clase, reagendar clases, editar perfil, etc.), el contenido a
la izquierda (la página de detalle del alumno) se ve roto: texto truncado
de forma extraña ("Erli...", "13.023.893-9" partido en dos líneas,
"$180.0..." cortado), y los botones de acción del hero ("Reagendar Clases",
"Ver Contrato", "Carnet", "Certificado") se salen del contenedor / quedan
cortados, con scroll horizontal visible.

## Causa raíz

`LayoutDrawerComponent` (`app-layout-drawer`) es un hermano flex de `<main>`
que "empuja" el contenido en desktop (layout-shifting, ver
`layout-drawer.component.ts:18-29`). Esto reduce el `container-type:
inline-size` de `<main>` (`app-shell.component.ts:174-177`), y el
`.bento-grid` (que sí usa `@container layoutmain`, ver `_bento-grid.scss`)
reduce columnas correctamente — pero el `app-section-hero` de esta página
**no tiene el mecanismo de compactación** que sí existe en otras páginas
(`admin-pagos`, `admin-contabilidad-cursos`, `alumnos-list-content`,
`cuadratura-content`, `secretaria-pagos`): el patrón
`[class.force-compact]="layoutDrawer.isOpen()"` en el `.bento-grid` raíz.

`app-section-hero` ya tiene todo el CSS de compactación implementado
(`:host-context(.force-compact)` en `section-hero.component.ts:44,122`) —
solo falta la clase en el ancestro para activarlo. Sin ella, la fila de
acciones del hero se queda en una sola línea flex sin wrap y desborda
cuando el contenedor se angosta.

`admin-alumno-detalle.component.ts` ya inyecta `LayoutDrawerFacadeService`
(línea 991) pero como `private`, no accesible desde el template.

## Alcance

En `admin-alumno-detalle.component.ts`:

1. Cambiar `private readonly layoutDrawer` → `protected readonly layoutDrawer`
   (para poder bindearlo en el template).
2. Agregar `[class.force-compact]="layoutDrawer.isOpen()"` al `.bento-grid`
   raíz (línea 58), mismo patrón que `alumnos-list-content.component.ts:96`
   y `admin-pagos.component.ts`.

No se toca `_bento-grid.scss` ni `section-hero.component.ts` — el CSS de
compactación ya existe, solo faltaba activarlo.

### Adenda (post-verificación del dueño)

El dueño confirmó que el hero mejoró, pero el resto de las tarjetas
(Info Personal, Clases Prácticas, Estado Financiero) seguían viéndose mal:
dejar que el `@container` reparta 2-3 columnas angostas entre tarjetas con
contenido de ancho fijo (RUT, email, montos) no es suficiente — el
contenido igual queda apretado/truncado de forma fea.

Precedente ya existente en `cuadratura-content.component.ts:738-752`: al
activar `force-compact`, el `.bento-grid` completo se colapsa a
`display:flex; flex-direction:column` — cada celda pasa a ocupar el 100%
del ancho disponible en una sola columna, evitando que el `@container`
intente repartir columnas angostas entre celdas con contenido de ancho fijo.

Se replica ese mismo patrón (mismo selector `.force-compact.bento-grid`) en
los `styles` de `admin-alumno-detalle.component.ts`.

### Adenda 2 (segunda verificación del dueño)

Con force-compact activo, el dueño reportó 2 problemas más:

1. **Ficha Técnica sigue viéndose mal** (columna "Validación" cortada, requiere
   scroll horizontal). Causa: `admin-ficha-tecnica.component.ts:44,163` usa
   `hidden md:block` / `md:hidden` para alternar entre la tabla desktop y una
   vista de tarjetas mobile ya construida — pero `md:` es un breakpoint de
   **viewport** (Tailwind), no de contenedor. Con el drawer abierto, el
   viewport no cambia, así que la tabla desktop nunca cede paso a la vista
   mobile aunque el contenedor real sea angosto. Mismo patrón de bug que la
   causa raíz original (media query vs. layout-shift).
2. **Estado Financiero (`app-admin-historial-pagos`) quedó al final de todo.**
   En el grid original, `grid-auto-flow: dense` reordena visualmente las
   celdas independientemente del orden DOM, así que aunque el componente está
   último en el DOM (línea ~797, comentario "Bento Item 6"), visualmente
   aparecía junto a Info Personal/Clases Prácticas rellenando el hueco. Al
   forzar `display:flex; flex-direction:column` (force-compact), el flex ya
   no reordena — respeta el orden DOM tal cual, y por eso cae al final,
   después de Ficha Técnica.

**Fix:**
- `admin-ficha-tecnica.component.ts`: agregar `:host-context(.force-compact)`
  (mismo mecanismo que `section-hero.component.ts`) para forzar
  `display:none` en la tabla desktop y `display:block` en la vista mobile
  cuando el ancestro tiene `.force-compact`.
- `admin-alumno-detalle.component.ts`: reubicar el bloque
  `<app-admin-historial-pagos>` en el DOM, inmediatamente después de los
  bloques de progreso (Clases Prácticas / variantes profesional) y antes del
  banner de Inasistencias — sin cambios de comportamiento en modo grid
  (dense ya lo posicionaba ahí visualmente), pero ahora también correcto en
  modo flex/force-compact.

### Adenda 3 (tercera verificación del dueño)

Con la vista mobile de Ficha Técnica ahora visible, el dueño reportó que el
texto y los bordes de las tarjetas se ven "grises casi transparentes, no
sólidos". Causa: `[class.opacity-60]="!clase.completada"`
(`admin-ficha-tecnica.component.ts:167`, previo a esta sesión) aplicaba 60%
de opacidad a **toda la tarjeta** (borde + texto + badges + íconos) para
cualquier sesión no completada — que es casi todas (inasistencia, cancelada,
justificada, pendiente). La tabla desktop nunca tuvo este problema porque su
equivalente (`.fila-pendiente td { color: var(--text-muted) }`) solo atenúa
el color de texto con un token sólido, sin tocar `opacity`, dejando badges y
bordes intactos.

**Fix:** se removió `[class.opacity-60]="!clase.completada"` del contenedor
de la tarjeta mobile — mismo criterio que ya usa la tabla desktop (badges,
bordes y textos quedan siempre sólidos; el estado se comunica vía los badges
semánticos ya existentes, no por atenuación de opacidad).

## Acceptance Criteria

- [x] AC0: Al abrir cualquier drawer desde el detalle de alumno, el hero
  compacta su padding/tipografía y las acciones hacen wrap en vez de
  desbordar. **Confirmado visualmente por el dueño.**
- [x] AC1: No aparece scroll horizontal en el contenido de la izquierda con
  un drawer abierto. **Confirmado.**
- [x] AC2: El comportamiento sin drawer abierto no cambia (regresión visual).
  **Confirmado — no reportó regresiones.**
- [x] AC3: Con un drawer abierto, Info Personal / Clases Prácticas / Estado
  Financiero se apilan a ancho completo en una sola columna (sin texto
  truncado/cortado de forma anómala). **Confirmado ("bastante bien").**
- [x] AC4: Con un drawer abierto, Ficha Técnica muestra la vista de tarjetas
  (mobile) en vez de la tabla con scroll horizontal cortado. **Confirmado
  ("quedó bastante bien").**
- [x] AC5: Con un drawer abierto, Estado Financiero aparece inmediatamente
  después de Clases Prácticas/progreso, no al final de la página.
  **Confirmado.**
- [x] AC6 (Adenda 3): Las tarjetas de Ficha Técnica (mobile) muestran texto
  y bordes sólidos, sin atenuación de opacidad — removido `opacity-60`
  de la tarjeta completa.

## Cierre

Todos los ACs confirmados visualmente por el dueño en vivo (Playwright no
disponible en este entorno). `tsc --noEmit` sin errores en los 3 archivos
tocados (`admin-alumno-detalle.component.ts`,
`admin-ficha-tecnica.component.ts`, y los `styles` asociados). Fix cerrado.

## Test de regresión

Cambio puramente visual/CSS (binding de clase) — no hay lógica de decisión
nueva que testear con Vitest. Verificación visual manual confirmada por el
dueño (Playwright no disponible en este entorno).
