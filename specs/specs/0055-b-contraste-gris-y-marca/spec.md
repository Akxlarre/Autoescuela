# Spec 0055-b — Contraste del gris "muted" y del color de marca

> **Status:** done
> **Created:** 2026-10-20
> **Owner:** Benjamín
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** spec 0054-b (axe en el barrido). axe encontró `color-contrast` en las 49 pantallas del
piloto. Análisis por par de colores (8 pantallas, claro y oscuro, 2026-10-20):

| Causa | Nodos | Contraste hoy (mínimo 4,5) |
|---|---|---|
| Gris `--text-muted` (micro-labels, títulos de grupo del menú, horas de la Agenda) | ~410 (≈85 %) | claro `#a1a1aa`/blanco 2,56 · oscuro `#71717a`/`#18181b` 3,66 |
| Celeste de marca como texto o fondo de botón | ~52 | `#0ea5e9`/blanco 2,77 · oscuro blanco sobre `#38bdf8` 2,14 |
| Paginador de PrimeNG en oscuro | 2 | `#64748b`/`#18181b` 3,72 |

Decisiones del owner (2026-10-20):
- Gris muted: claro `#6b6b74`, oscuro `#929299`.
- Marca: celeste más profundo (`#0369a1`) para textos de marca y fondos sólidos de botón en modo
  claro; el celeste brillante queda para bordes, íconos decorativos y detalles. En oscuro el botón
  principal lleva texto azul marino (`#082f49`).

## 2. User Stories

- Como **persona que usa el sistema**, quiero leer los micro-labels, los textos de marca y los botones
  principales sin esfuerzo, en claro y en oscuro.

## 3. Acceptance Criteria

- **AC1:** `--text-muted` = `#6b6b74` (claro) y `#929299` (oscuro); cumple 4,5:1 sobre los fondos donde
  aparece (blanco, `#f4f4f5`, `#ecf8fd` en claro; `#18181b`, `#09090b`, `#191f24` en oscuro).
- **AC2:** token `--brand-strong` (`#0369a1` claro / `#38bdf8` oscuro). Lo usan: el puente Tailwind
  `--color-brand` (`text-brand`, `bg-brand`…), `--btn-primary-bg`, y los `color:` / `background:` de
  SCSS y estilos de componentes que hoy usan `var(--ds-brand)` o `var(--color-primary)`.
- **AC3:** `--ds-brand` y `--color-primary` mantienen su valor: bordes, degradados, foco e indicadores
  siguen en el celeste brillante.
- **AC4:** el botón principal cumple 4,5:1 en claro (blanco sobre `#0369a1`, hover `#075985`) y en
  oscuro (`#082f49` sobre `#38bdf8`).
- **AC5:** el texto del paginador de PrimeNG usa `--text-secondary`.
- **AC6:** el barrido con axe baja las violaciones `color-contrast`; la línea base se regenera.
- **AC-E1:** el tema de la matrícula pública (`[data-public-theme]`, con paleta propia) no cambia.
- **AC-E2:** el texto del hero (`.surface-hero`, `--color-primary-text`) sigue blanco.

## 4. Fuera de alcance

- Otras reglas de axe (`aria-prohibited-attr`, `button-name`, etc.): cada una a su fix.
- Encender el modo estricto del barrido.

## 5. Notas / decisiones

- Elementos con `border-brand`/`ring-brand` de Tailwind también pasan a `#0369a1` en claro (comparten
  `--color-brand`); los bordes y detalles definidos en SCSS con `--ds-brand` quedan brillantes.
