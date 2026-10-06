# Fix: `.card` respeta las utilities de Tailwind (`p-0`, `p-4`, `bg-*`…)
> id: fix-341-m-card-respeta-utilities-de-tailwind
> refs: fix-340-m · fix-319-m (F03) · ASG-i-025
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

`.card` (`src/styles/tokens/_variables.scss`) está definido **fuera de toda capa CSS**. En la
cascada, una regla sin capa le gana a cualquier regla dentro de un `@layer`, y las utilities de
Tailwind v4 viven en `@layer utilities`. Resultado: ninguna utility que toque las mismas
propiedades que `.card` tiene efecto sobre una card —
`padding` (`p-0`, `p-4`, `px-6`…), `background` (`bg-*`), `border` (`border-*`),
`border-radius` (`rounded-*`) y `box-shadow` (`shadow-*`). Todas las cards tienen siempre
24 px de padding, fondo, borde, radio y sombra del token, aunque el template pida otra cosa.

Hay ~93 archivos que combinan `card` con alguna de esas utilities (85 usos de `p-0`). La app "se
ve bien" porque se diseñó mirando el resultado, no lo escrito. Se descubrió en `fix-340-m`: la
lista de la Base Profesional pide `card p-0` y aun así suma 24 px por lado, y en móvil la tarjeta
quedaba en ~180 px de 375.

## ACs Afectados

Ninguno de spec. Cierra la causa de fondo de F03 (`fix-319-m`), que `fix-340-m` mitigó solo en la
vista móvil (decisión de Matías, 2026-10-06: primero lo mínimo, después este fix).

- Una utility escrita junto a `card` se aplica (p. ej. `card p-0` → sin padding).
- Las pantallas afectadas se revisan visualmente (escritorio y móvil); lo que quede mal por
  depender del comportamiento viejo se corrige en el template, no volviendo a sacar `.card` de la
  capa.

## Cambio

- **`src/styles/tokens/_variables.scss`**: `.card` dentro de `@layer components` (capa de
  Tailwind v4, por debajo de `utilities`). `.card-tinted` y `.card-accent` no cambian.
- **`src/styles/layout/_mobile-view.scss`** (`fix-340-m`): se revisa — su regla suponía que la
  card siempre tenía 24 px; con `card p-0` respetado, quitarle el padding a `.mobile-view` dejaría
  las tarjetas pegadas al borde.
- Templates que la revisión visual muestre rotos: ajuste puntual (se listan abajo).
- `indices/STYLES.md` / `ANTI-PATTERNS.md` si corresponde.

## Test de Regresión

Cambio de CSS global: Vitest no carga estilos. Se verifica en navegador:

1. **Diff de estilos calculados** — antes y después del cambio, en todas las rutas de admin,
   secretaria, instructor y alumno (1440 px y 375 px): por cada `.card` visible se registra
   padding, fondo, borde, radio y sombra. El diff lista exactamente qué cards cambiaron.
2. **Capturas** de cada pantalla con cambios, revisadas a ojo; lo roto se corrige y se vuelve a
   medir.
3. Base Profesional a 375 px: la tarjeta ocupa más ancho que con `fix-340-m` y no toca el borde.

## Revisión visual (2026-10-06)

**Diff de estilos calculados** (scripts en `.playwright-mcp/`, gitignored): 94 combinaciones
ruta × ancho (admin y secretaria de sede 2, 1440 y 375 px), 342 cards medidas antes y después.
70 cambian, **todas** en propiedades que el template ya pedía: `p-0` → 0 px (listas, tablas,
agenda, pagos, reportes, auditoría, libro, tareas, configuración web…), `p-3` → 12, `p-4` → 16,
`p-5` → 20, `p-8` → 32, `pb-10`, `px-4 py-2.5`, `border-dashed` (estados vacíos) y `shadow-sm`.
Flota a 1440 px pasa de tarjetas a tabla (con el ancho recuperado supera el umbral del modo
escritorio).

**Capturas revisadas a ojo** — 1440 px: Base B, Base Profesional, Agenda, Asistencia, Pagos,
Reportes, Flota, Instructores, Historial de cuadraturas, Cursos Singulares, Comunicación,
Libro de clases, Usuarios, Auditoría. 375 px: Base Profesional, Instructores, Promociones,
Anticipos, Asistencia, Pagos, Comunicación, Libro de clases, Reportes, Agenda. Resultado: igual o
mejor (tablas a todo el ancho de su recuadro, más filas visibles, nombres sin truncar en la
Base B).

**Corregido durante la revisión:**
- `_mobile-view.scss` (fix-340-m): la regla que le quitaba el margen lateral a `.mobile-view`
  dejaba las tarjetas pegadas al borde ahora que `card p-0` se respeta → se elimina; queda solo
  el padding 0 del `.bento-grid` interno (el duplicado real).
- Cursos Singulares: su recuadro no es `p-0` (`card pb-10`), así que la vista móvil sumaba 24 +
  16 px → `.mobile-view` pasa de `p-4` a `py-4`.

Ancho de la primera tarjeta a 375 px (original → fix-340-m → este fix): Base B 185 → 249 → 264;
Base Profesional 179 → 240 → 256; Instructores 192 → 229 → 244; Promociones 214 → 245 → 260;
Flota 214 → 245 → 260; Servicios Especiales 209 → 241 → 255; Anticipos 209 → 236 → 252; Cursos
Singulares 210 → 240 → 239. Margen dentro del recuadro: 16–26 px; sin scroll horizontal.

**No verificado en navegador:** portales de alumno (12 archivos) e instructor (9), bloqueados
en el piloto. Revisión estática: sus cards piden `p-4…p-12`, `p-0` (8), `border-dashed` (estados
vacíos), `bg-error-subtle`, `border-brand`, `rounded-*` — todo intención escrita que ahora sí se
aplica. **Revisarlos visualmente cuando se habiliten.**

**Hallazgos previos a este cambio (no causados por él, se ven igual con el estilo viejo):**
- Base Profesional a 375 px: la card de la lista se monta sobre la fila de KPIs del hero.
- Comunicación (Tareas) a 375 px: las pestañas no muestran su texto y queda un hueco grande.

`lint:arch` 0 errores; suite 3337 ✓.
