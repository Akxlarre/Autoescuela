# Page Shell — Patrones de layout de página

Complementa al Bento Grid: **bento grid = celdas dentro de la página**, **page shell = la página en sí**.

## Quick Start

```html
<!-- Login -->
<main class="page-centered">
  <app-login-form />
</main>

<!-- Settings -->
<main class="page-narrow">
  <div class="page-header">
    <h1 class="page-header__title">Configuración</h1>
    <div class="page-header__actions">
      <button>Guardar</button>
    </div>
  </div>
  <app-settings-form />
</main>

<!-- Dashboard -->
<main class="page-wide">
  <div class="page-header">
    <h1 class="page-header__title">Dashboard</h1>
    <p class="page-header__subtitle">Resumen del mes</p>
  </div>
  <section class="bento-grid">...</section>
</main>
```

## Shells Disponibles

| Clase | Max-width | Uso |
|---|---|---|
| `.page-centered` | 480px + centrado vertical | Login, registro, 404 |
| `.page-narrow` | 640px | Formularios, settings, edición |
| `.page-content` | 860px | Detalle, artículos, documentación |
| `.page-wide` | 100% | Dashboard, tablas, listados |
| `.page-split` | 100% (2 paneles) | Master-detail, inbox, chat |

## Page Split

Layout de dos paneles con stack vertical en mobile:

```html
<main class="page-split">
  <aside class="page-split__aside">
    <!-- Lista, filtros, navegación -->
  </aside>
  <div class="page-split__main">
    <!-- Contenido principal -->
  </div>
</main>
```

| Token | Default | Descripción |
|---|---|---|
| `--split-aside-width` | `320px` | Ancho del panel lateral (≥768px) |
| `--split-gap` | `var(--space-6)` | Espacio entre paneles |

## Componentes Auxiliares

### `.page-header`

```html
<div class="page-header">
  <h1 class="page-header__title">Título</h1>
  <p class="page-header__subtitle">Descripción opcional</p>
  <div class="page-header__actions">
    <button>Acción</button>
  </div>
</div>
```

### `.page-section`

Separador entre bloques. Agrega línea divisora automáticamente entre secciones consecutivas:

```html
<div class="page-section">
  <h2 class="page-section__title">Sección 1</h2>
  <!-- contenido -->
</div>
<div class="page-section">
  <h2 class="page-section__title">Sección 2</h2>
  <!-- contenido — tendrá border-top automático -->
</div>
```

### `.page-empty`

Estado vacío genérico:

```html
<div class="page-empty">
  <span class="page-empty__icon">📭</span>
  <h3 class="page-empty__title">Sin resultados</h3>
  <p class="page-empty__description">
    No se encontraron datos para los filtros actuales.
  </p>
</div>
```

## Combinación con Bento Grid

```html
<main class="page-wide">
  <div class="page-header">
    <h1 class="page-header__title">Mi Dashboard</h1>
  </div>
  
  <section appBentoGridLayout class="bento-grid">
    <div class="bento-wide bento-card">...</div>
    <div class="bento-square bento-card">...</div>
  </section>

  <div class="page-section">
    <h2 class="page-section__title">Actividad reciente</h2>
    <!-- tabla o listado -->
  </div>
</main>
```
