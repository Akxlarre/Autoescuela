# Patrón Section Hero

Cabecera de sección reutilizable para vistas principales (Dashboard, Base de Alumnos, etc.). Garantiza **coherencia visual** y **una sola fuente de verdad** para el hero en toda la app.

## Cuándo usarlo

- **Una vista principal = un Section Hero** por página.
- Páginas con título de sección + contexto (fecha, descripción) + chips opcionales (métricas/estado) + acciones principales (CTAs).
- No usar para páginas secundarias o modales.

## Componente

- **Selector:** `app-section-hero`
- **Ubicación:** `shared/components/section-hero/section-hero.component.ts`
- **Modelos:** `core/models/ui/section-hero.model.ts` (`SectionHeroChip`, `SectionHeroAction`)

## API

| Input        | Tipo                 | Requerido | Descripción                                                                 |
|-------------|----------------------|-----------|-----------------------------------------------------------------------------|
| `title`     | `string`             | Sí        | H1 de la vista (ej. "¡Bienvenido, Pepito!" o "Alumnos").                    |
| `contextLine` | `string`           | No        | Línea encima del título, texto pequeño muted (ej. fecha).                    |
| `subtitle`  | `string`             | No        | Texto debajo del título.                                                     |
| `chips`     | `SectionHeroChip[]`  | No        | Badges de contexto (icono opcional, label, style: default\|warning\|error\|success). |
| `actions`   | `SectionHeroAction[]`| Sí        | Botones: id, label, icon?, primary (solo uno true), route? (si no hay route se emite actionClick). |

| Output       | Tipo     | Descripción                          |
|-------------|----------|--------------------------------------|
| `actionClick` | `string` | Emitido al pulsar una acción sin `route` (id de la acción). |

## Tipografía (design system)

- **Context line** (ej. fecha): clase `.kpi-label` — `text-xs`, `font-medium`, `uppercase`, `letter-spacing`, `text-muted` (tokens en `_variables.scss`).
- **Título (H1):** `font-display`, `text-2xl` / `md:text-3xl`, `font-bold`, `leading-tight`, `tracking-tight`, `text-text-primary`.
- **Subtítulo:** `text-sm`, `text-text-secondary`, `leading-relaxed` (alineado con `.page-header__subtitle`).
- Ritmo vertical: `gap-2` / `gap-3` y `mt-2` entre contexto, título y subtítulo. Sin colores arbitrarios; solo tokens semánticos (BRAND_GUIDELINES.md).

## Reglas de diseño

1. **Una sola acción primaria** por hero (el resto deben ser secundarias/outline).
2. **Botones siempre custom** (tokens); no usar `pButton` dentro del Section Hero.
3. **H1 único** por vista; el título del hero es el H1 de la página.
4. **Mismo componente** en todas las vistas que sigan este patrón; no duplicar markup de hero.

## Uso

### Dashboard

```html
<app-section-hero
  [title]="heroSectionTitle()"
  [contextLine]="heroContextLine()"
  [chips]="heroChips()"
  [actions]="heroActions()"
  (actionClick)="handleQuickAction($event)"
/>
```

### Base de Alumnos

```html
<app-section-hero
  title="Alumnos"
  subtitle="Listado de alumnos de la escuela"
  [chips]="heroChips()"
  [actions]="heroActions()"
  (actionClick)="handleHeroAction($event)"
/>
```

## Referencias

- Jerarquía visual y UX: reconocimiento sobre recall, F-pattern, affordances (Nielsen, Jakob).
- Estilos: `bento-hero`, `bento-card`, tokens en `styles/tokens/_variables.scss`.
- Documentación de componentes: `indices/COMPONENTS.md`.
