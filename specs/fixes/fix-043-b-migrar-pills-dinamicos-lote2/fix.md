# Fix: Migrar pills dinámicos a app-badge — lote 2 (varios archivos)
> id: fix-043-b-migrar-pills-dinamicos-lote2
> refs: fix-036-app-badge-fuente-unica, fix-038-app-badge-variant-brand, fix-042-migrar-pills-estaticos-lote1
> status: done
> created: 2026-07-09
> closed: 2026-07-09

## Root Cause
Sexto lote de la migración de pills ad-hoc del baseline ARCH-15 (fase 4,
`docs/BACKLOG-DEUDA-TECNICA.md`). Tras fix-042 (30 pills estáticos, semi-automatizado)
quedan 77 pills en 49 archivos, de dos tipos:

1. **11 estáticos que un segundo análisis reveló como NO migrables mecánicamente** — al
   inspeccionarlos individualmente aparecieron 3 falsos positivos del heurístico ARCH-15
   (dos son `<button>` con `(click)`, no badges: "Limpiar" en `signature-pad`, "Volver a
   Hoy" en `admin-profesional-asistencia`; uno es el contador de notificaciones del
   topbar, decorativo/`aria-hidden`, no un indicador de estado) y varios con lenguaje
   visual distinto al de `badge-*` (fondo sólido+texto blanco vs. fondo diluido, o
   `bg-brand-tint` vs `bg-brand-muted`) que cambiarían el aspecto visual si se forzaran.
   **Quedan fuera de este fix**, documentados en el backlog para revisión de diseño o
   ajuste del heurístico ARCH-15 (no marcar botones como pills).
2. **~66 dinámicos** (helpers `getXColor()/getXBg()` o `[class]="metodo()"`) — este fix
   ataca un lote de ellos, archivo por archivo, agrupados en un solo track (no 1 fix por
   archivo, para mantener el ritmo).

Hallazgo adicional en `admin-contabilidad-cursos.component.ts`: el pill "tipo" (SENCE vs
Particular) usa `var(--color-purple)` para "particular" — **token que no existe en el
design system** (verificado: 0 matches en `_variables.scss`/`tailwind.css`). Sin fallback,
por lo que `color-mix()` es inválido y el color no se aplica. Este pill queda **fuera de
scope** (no hay variant de `app-badge` para "purple" y el bug de fondo es un problema
aparte, no de esta migración) — solo se migra el pill "estado" del mismo archivo.

## ACs Afectados
Ninguno — fix autónomo (fase 4 del roadmap, lote de migración de pills dinámicos).

- AC-1: Los pills dinámicos abordados en este lote migran a `<app-badge [variant]="...">`
  preservando la lógica de mapeo color→condición (ahora expresada como variant).
- AC-2: Los helpers `getXBg()`/`getXColor()` reemplazados se eliminan; los helpers de solo
  label (`getXLabel()`) se mantienen.
- AC-3: `npm run lint:arch` sin regresión; baseline ARCH-15 baja en la cantidad de pills
  efectivamente migrados (no necesariamente el total del archivo, si hay casos fuera de
  scope como el pill "tipo" de contabilidad-cursos).
- AC-4: `ng build` verde.
- AC-5: Verificación proporcional al riesgo: para cada archivo, confirmar que el mapeo
  condición→variant coincide exactamente con el original (lectura de código) + al menos
  una verificación visual real o harness por lote de variants nuevos introducidos.

## Cambio
13 archivos migrados (22 pills), 5 archivos revisados y excluidos (0 pills migrados,
documentados abajo):

**Migrados:**
- `admin-contabilidad-cursos.component.ts` — pill "estado" (getEstadoVariant); pill "tipo"
  fuera de scope (`--color-purple` no existe, ver Root Cause)
- `admin-profesional-evaluaciones.component.ts` — `promoStatusVariant` + `estadoBadgeVariant`;
  `getPromedioClasses` excluido (estilo sólido bg+texto blanco)
- `alumno-clases.component.ts` — `statusVariant` + `attVariant` (4 spans), helpers Bg/Color
  originales se mantienen para los círculos de ícono/número (otro patrón visual, fuera de scope)
- `secretaria-profesional-notas.component.ts` — `promoStatusVariant` + `estadoBadgeVariant`;
  `getPromedioClasses` excluido (mismo patrón sólido)
- `servicios-especiales-content.component.ts` — pill "activo" + pill "estado venta"; pill
  uppercase/text-2xs excluido (badge-* fuerza font-size/weight propios, regresión visual)
- `admin-curso-singular-detalle-drawer.component.ts` — `getPaymentVariant`; pill "tipo"
  excluido (mismo bug `--color-purple`)
- `admin-pagos.component.ts` / `secretaria-pagos.component.ts` — `estadoVariant` (2 spans
  responsive c/u, idéntico entre ambos portales)
- `admin-promocion-ver-drawer.component.ts` — `statusBadgeVariant` (corrige de paso un bug
  latente: `variant: 'brand'` caía a `var(--state-brand)` inexistente) + `enrollStatusVariant`
- `instructor-ficha.component.ts` — `getStatusVariant` (2 spans responsive)
- `asistencia-clase-b-content.component.ts` — `statusBadgeVariant`; pill de filtro (`<button>`
  con `(click)`) excluido, falso positivo del heurístico ARCH-15
- `section-hero.component.ts` — chip modo slim → `getChipVariant` (verificado visualmente en
  producción, dashboard admin); chip modo full (hero) excluido — usa fondo fijo semi-transparente
  para contraste sobre `.surface-hero`, no semántico por diseño
- `task-card.component.ts` — 2 badges de alerta estáticos (`error`/`neutral`)
- `matricula-steps/assignment/assignment.component.html` — pill "FLEXIBLE" → `neutral`; pill
  "RECOMENDADO" excluido (gradiente sólido + texto blanco, tratamiento de énfasis intencional)

**Revisados y excluidos (0 pills migrados):**
- `public-context-banner.component.ts` — ambos matches son `<button>` con `(click)`, falsos
  positivos del heurístico (no son badges)
- `tabs.component.ts` — 2 contadores numéricos estáticos de conteo en tabs; no representan
  estado, y sus dos variantes usan fondos distintos entre sí (`--border-subtle` vs
  `--bg-surface`+borde), ninguno coincide con `badge-neutral`. Requiere decisión de diseño
  (¿crear `.tab-count` propio?) antes de migrar — documentado en backlog.
- `alumnos-list-content.component.ts` — con cambios sin commitear de la sesión paralela activa
  en este working tree; NO tocado para evitar colisión. Pendiente para un lote futuro.

## Test de Regresión
- `npm run lint:arch` → 0 errores, backlog ARCH-15/16/17 bajó 263→237, baseline consolidado
  vía `--update-ds-baseline` ✓
- `ng build` → exit 0, sin errores nuevos (los 2 warnings preexistentes —
  `CardHoverDirective` sin uso en `asistencia-clase-b-content` y presupuesto de bundle— no
  están relacionados con este fix) ✓
- Verificación por archivo (lectura de mapeo condición→variant) en los 13 archivos migrados ✓
- Verificación visual real en `section-hero.component.ts` (componente de mayor blast radius,
  usado en ~50 páginas): harness de los 5 variants (`getComputedStyle` en Chrome real) +
  captura de pantalla del dashboard admin confirmando `badge-neutral`/`badge-error` renderizados
  correctamente en los chips del hero slim, consola sin errores ✓
