# Referencia — Identidad Visual: Webs Astro vs Wizard Angular

> **Estado:** ✅ Lectura completa de ambos sistemas (2026-06-01)
> **Para usar en:** dirección visual del rediseño (spec 0009, decisión #1 y #2)
> **Norte:** el wizard público debe sentirse como una continuación de la landing de cada sede.

---

## 1. Comparación de tokens (lado a lado)

| Token | Webs Astro (`webs/`) | Wizard Angular (`src/`) | ¿Coincide? |
|-------|----------------------|--------------------------|------------|
| **Tipografía display** | `Outfit` (700/800) | `Bricolage Grotesque` | ❌ Distinta |
| **Tipografía body** | `Inter` (300–700) | `Bricolage Grotesque` | ❌ Distinta |
| **Marca (color)** | Por sede: azul `#0ea5e9` / roja `#fd2018` | Única: sky `#0ea5e9` (+ `#38bdf8` dark) | ⚠️ Parcial |
| **Acento** | azul→indigo `#6366f1` / roja→orange `#f97316` | indigo/violet en gradiente | ⚠️ Parcial |
| **Theming** | `:root[data-theme="azul"\|"roja"]` | `[data-mode='dark']` (claro/oscuro) | ❌ Eje distinto |
| **Radio card** | `--radius-xl: 1rem` (16px) | `--radius-lg: 14px` / `xl: 20px` | ⚠️ Cercano |
| **Sombra card** | `--shadow-md` suave | `--shadow-md` suave | ✅ |
| **bg-base** | `#ffffff` | `#f4f4f5` | ⚠️ Cercano |
| **bg-surface** | `#f8fafc` (azul) / `#fafaf9` (roja) | `#ffffff` | ⚠️ Invertido |
| **Container** | `max-width: 1280px` | (varía por layout) | — |
| **Iconos** | Lucide (CDN + `Icon.astro`) | Lucide (`app-icon`) | ✅ Mismo set |
| **Animación entrada** | CSS `@keyframes fadeIn` / `pulse` | GSAP (`GsapAnimationsService`) | ❌ Distinto motor |

---

## 2. Las dos paletas de sede (lo que el wizard debe adoptar)

### Sede azul (branchId 1) — `data-theme="azul"`
```
--brand-500: #0ea5e9   (primario)
--brand-600: #0284c7   (hover)
--accent-400: #6366f1  (indigo)
--gradient-hero: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)
--bg-surface: #f8fafc  (slate-50)
--border-color: #e2e8f0
```

### Sede roja (branchId 2) — `data-theme="roja"`
```
--brand-500: #fd2018   (primario)
--brand-600: #e0120b   (hover)
--accent-400: #f97316  (orange)
--gradient-hero: linear-gradient(160deg, #bc0b05 0%, #fd2018 55%, #fd2018 100%)
--bg-surface: #fafaf9  (stone-50)
--border-color: #e7e5e4
```

> Mapping confirmado en `getSiteData.ts`: `branchId 1 → azul`, `branchId 2 → roja`.
> Además, `website_config.brand.theme` expone el tema autoritativo por sede.

---

## 3. Vocabulario de componentes (qué existe en ambos)

Buena noticia: el **lenguaje semántico ya está alineado**. Ambos sistemas tienen las mismas clases conceptuales, solo con valores distintos:

| Concepto | Webs Astro | Wizard Angular |
|----------|-----------|----------------|
| Tarjeta base | `.card` | `.card` |
| Tarjeta con acento | `.card-accent` (2px borde + glow) | `.card-accent` (borde-top 3px) |
| Tarjeta tintada | `.card-tinted` (gradient-card) | `.card-tinted` (gradient-subtle) |
| Hero/banner | `.surface-hero` (gradient + white) | `.surface-hero` (gradient + white) |
| Glass overlay | `.surface-glass` (blur 12px) | `.surface-glass` (blur 12px) |
| Badge pill | `.badge` + `.badge-primary/accent` | `.badge-pulse`, badges PrimeNG |
| Botón primario | `Button variant="primary"` | `@utility btn-primary` |
| Botón secundario | `Button variant="secondary"` | `@utility btn-secondary` |
| Header de sección | `SectionHeader` (eyebrow + h2 + desc) | `app-section-hero` |

**Implicación:** no hay que inventar un vocabulario nuevo. Hay que **alinear los valores** (fuente, color de sede, radios) en el contexto del wizard público.

---

## 4. La brecha a cerrar (gaps)

| # | Gap | Decisión recomendada |
|---|-----|----------------------|
| G1 | **Fuente distinta** (Outfit/Inter vs Bricolage) | El shell del wizard público debe cargar **Outfit + Inter** y aplicarlas SOLO en el contexto público (no afecta la app interna). Es lo que más "rompe" la continuidad hoy. |
| G2 | **Sin theming por sede en Angular** | Inyectar variables de sede (`--brand-*`, gradient-hero, surfaces) al cargar el wizard según `branchId`. Replicar los ramps azul/roja de arriba. Resuelve AC1. |
| G3 | **Eje claro/oscuro** | El wizard público debe forzar **modo claro** y la paleta de sede, ignorando el dark mode del OS (las webs son light-only). Coherencia > preferencia de sistema aquí. |
| G4 | **Radio de cards** | Adoptar el radio de las webs (`xl: 1rem` ≈ 16px) en las cards del wizard público para igualar el "redondeo" de la landing. |
| G5 | **Motor de animación** | Mantener GSAP en Angular (regla del proyecto), pero replicar el *carácter* de las webs: entradas suaves tipo fadeIn + cubic-bezier(0.16,1,0.3,1). No copiar `@keyframes`. |
| G6 | **bg-surface invertido** | Alinear superficies: fondo de página muy claro, cards en blanco puro (como las webs). Ajuste menor de tokens en el contexto público. |

---

## 5. Dirección visual recomendada

> **"El wizard es la siguiente habitación de la misma casa."**

1. **Tematización por sede** desde `branchId` (G2) → el wizard hereda azul o roja. La sede es tenant, ya decidido en la spec.
2. **Outfit + Inter** en el shell público (G1) → match tipográfico inmediato con la landing.
3. **Modo claro fijo + paleta de sede** (G3) → no seguir dark mode.
4. **Cards estilo landing**: `.card` blanco, radio 16px, sombra suave, hover lift sutil (G4/G6).
5. **Hero del wizard = `surface-hero` con el gradient de la sede** → el header del wizard usa el mismo gradiente que el hero de la web.
6. **Eyebrow + título** estilo `SectionHeader` de la web (badge uppercase + título Outfit grande).
7. **Reusar el vocabulario semántico** (`.card`, `.badge`, `.surface-hero`, `app-icon`) con los valores de sede.

---

## 6. Decisión #2 (fuente de tematización) — propuesta

Dado que `getSiteData.ts` ya mapea `branchId → theme` y `website_config.brand.theme` existe:

- **Opción A (recomendada, simple):** hardcodear el mapping `branchId → 'azul'|'roja'` en el wizard (igual que la web hace `branchId = brand==='roja'?2:1`) e inyectar las variables CSS de sede. Cero queries extra, determinista.
- **Opción B (robusta):** leer `website_config.brand.theme` por `branchId` vía query anónima (igual que la landing) y aplicar el tema. Una query más, pero fuente única de verdad si en el futuro hay más sedes.

> Pendiente de confirmar con el usuario en el plan.

---

## 7. Archivos fuente leídos

- `webs/src/styles/global.css` — tokens compartidos, `.card`, `.badge`, `.surface-hero/glass`, animaciones
- `webs/src/styles/themes/azul.css` + `roja.css` — ramps de marca por sede
- `webs/src/layouts/LandingLayout.astro` — fuentes (Outfit/Inter), hidratación, theming `data-theme`
- `webs/src/components/ui/Button.astro` + `SectionHeader.astro` — átomos
- `webs/src/components/Hero.astro` + `Services.astro` — composición de hero y cards
- `webs/src/content/site/azul.json` — valores reales de marca/contenido
- `src/styles/tokens/_variables.scss` — design system Angular (4 capas, claro/oscuro)
