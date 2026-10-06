# Fix: Las tarjetas de la vista móvil no pierden ancho por márgenes duplicados
> id: fix-340-m-tarjetas-moviles-paddings-anidados
> refs: ASG-i-025 · fix-319-m (F03 · D16)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

Las listas con vista dual (tabla en escritorio, tarjetas en móvil o con un panel abierto) ponen
sus tarjetas en un `<div class="mobile-view show-on-squeeze p-4 …">` **dentro** de un recuadro
`.card`. En 5 de ellas (Base B, Base Profesional, Ex-Alumnos B y Profesional, Alumnos del
instructor) las tarjetas van además en un `.bento-grid` interno. Cada capa suma su margen interno
por lado:

| Capa | Por lado |
|---|---|
| Contenedor de la app | 16 px |
| Grilla de la página | 16 px |
| Recuadro `.card` que envuelve la lista | 24 px |
| `.mobile-view` (`p-4`) | 16 px ← duplica al recuadro |
| `.bento-grid` interno (solo 5 pantallas) | 16 px ← duplica otra vez |

A 375 px la tarjeta de la Base Profesional queda en 183 px (F03, 2026-10-06): el nombre se corta y
"PROMOCIÓN"/"SALDO" se montan. Instructores, Promociones, Flota, Servicios Especiales y Contabilidad
quedan entre 193 y 214 px.

**Fuera de alcance (decisión D16 acotada por Matías, 2026-10-06 — "lo mínimo"):** el recuadro
pide `p-0` y no se respeta porque `.card` está definido fuera de toda capa CSS y le gana a las
utilities de Tailwind (`p-0`, `p-4`… sobre `.card` no aplican en ~92 archivos, también en
escritorio). Arreglarlo cambia el aspecto de escritorio en toda la app: va en un track aparte con
revisión visual.

## ACs Afectados

Ninguno de spec — fix autónomo derivado del testing de `fix-319-m`. Cierra:

- **F03 / D16 (mínimo):** dentro de un recuadro `.card`, la vista móvil no agrega margen lateral
  propio y su grilla interna tampoco; las tarjetas ganan ~32 px (64 px en las 5 con grilla
  interna). Escritorio no cambia (la `.mobile-view` está oculta).

## Cambio

- **`src/styles/layout/_mobile-view.scss`** (nuevo, importado en `src/styles.scss`): regla única
  y **sin capa** (tiene que ganarle a `p-4` de Tailwind) —
  `.card .mobile-view { padding-inline: 0 }` y `.card .mobile-view > .bento-grid { padding: 0 }`.
  Solo bajo `.card`: el recuadro sigue dando el margen, así que las tarjetas no tocan el borde.
- `indices/STYLES.md`: documentar la regla.

## Test de Regresión

Cambio solo de CSS (los tests de Vitest no cargan estilos globales). Se verifica midiendo en
navegador a 375 px el ancho de la primera tarjeta, antes/después, en las pantallas con vista
móvil (Base B, Base Profesional, Instructores, Promociones, Flota, Servicios Especiales,
Anticipos, Cursos Singulares) + captura de la Base Profesional y escritorio sin cambios ✓

### Verificación (2026-10-06)

Ancho de la primera tarjeta a 375 px (antes → después), sin scroll horizontal en ninguna:

| Pantalla | Antes | Después |
|---|---|---|
| Base Alumnos B | 185 | 249 |
| Base Alumnos Profesional | 179 | 240 |
| Instructores | 192 | 229 |
| Promociones | 214 | 245 |
| Flota | 214 | 245 |
| Servicios Especiales | 209 | 241 |
| Anticipos | 209 | 236 |
| Cursos Singulares | 210 | 240 |

- Captura de la Base Profesional (E2E-ProfConB): "PROMOCIÓN" y "SALDO" ya no se montan y el RUT
  se ve completo; el nombre largo de prueba se sigue truncando con "…" (caso C11, se revisa en el
  bloque 5).
- Escritorio sin cambios: la regla solo afecta a `.mobile-view`, que en escritorio está oculta.
- `lint:arch` 0 errores; `ng build` (development) compila.
- Queda pendiente, fuera de este fix: `.card` sin capa le gana a `p-0`/`p-N` (~92 archivos).
