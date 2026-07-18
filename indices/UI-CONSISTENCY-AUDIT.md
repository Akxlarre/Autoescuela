# Auditoría de Consistencia UI — Barrido Completo

> **Fecha:** 2026-06-12 · **Alcance:** toda la app (`features/`, `shared/`, `layout/`, `styles/`)
> **Método:** detección por patrones (scan de los anti-patrones documentados en `indices/ANTI-PATTERNS.md` + reglas de `visual-system.md`) sobre ~180 componentes, seguido de lectura de los peores ofensores.
> **Tipo:** diagnóstico + plan priorizado. **No se modificó código de producción.**

---

## 1. Veredicto general

**La base de consistencia es ALTA.** Los guardrails (Architect Guard) están haciendo su trabajo: cero `*ngIf`/`*ngFor`, cero inyección de `SupabaseService` en UI, casi cero colores Tailwind hardcodeados, cero `@angular/animations`, adopción casi total de `<app-icon>` y de los organismos compartidos (`*-content`). El patrón secretaria→`*-content` es ejemplar.

**Pero la inconsistencia que percibes es real y está concentrada**, no dispersa. Hay un hallazgo grande e invisible para el tooling (clases de token no canónicas que **no generan CSS**), un módulo entero sin construir (relator), un monolito de 3.370 líneas, y un "clúster de deriva" de ~10 archivos legacy que fallan varias dimensiones a la vez.

> **El tooling tiene un punto ciego clave:** el Architect Guard bloquea `text-red-500` (color hardcodeado) pero **NO** detecta `bg-bg-surface` ni `text-state-success` — clases que *parecen* tokens válidos pero no existen en `@theme`. Por eso esta deriva pasó desapercibida. Ver Hallazgo H1.

---

## 2. Scorecard por dimensión

| Dimensión | Estado | Evidencia |
|-----------|--------|-----------|
| Arquitectura (Facade, sin Supabase en UI) | 🟢 Excelente | 0 leaks en `features/`/`shared/` |
| Control flow (`@if`/`@for`) | 🟢 Excelente | 0 `*ngIf` / `*ngFor` |
| Signal API (`input()`/`output()`) | 🟡 Bueno | 4 componentes legacy con `@Input()`/`@Output()` |
| Colores Tailwind hardcodeados (`text-cyan-400`) | 🟢 Muy bueno | 5 usos en 2 archivos |
| **Clases de token canónicas** | 🔴 **Deficiente** | **263 usos no canónicos en 27 archivos** (H1) |
| Sistema de íconos (`<app-icon>`) | 🟢 Excelente | 1 `<svg>` inline fuera del registro |
| Tipografía KPI (`.kpi-value` / `app-kpi-card`) | 🟡 Medio | ~8 cards "string KPI" hechas a mano |
| Skeletons (`<app-skeleton-block>`) | 🟡 Bueno | 6 archivos con `animate-pulse` ad-hoc |
| Layout root (`.bento-grid`) | 🟢 Muy bueno | 3 páginas con `page-wide` como raíz |
| Animaciones (GSAP, sin `@keyframes`) | 🟢 Muy bueno | 1 `@keyframes` de entrada (config-web) |
| `text-white`/`bg-white` vs tokens | 🟡 Medio | 40 archivos (mayoría estilístico) |
| Emojis como íconos | 🟢 Bueno | Mayoría es *contenido* (web config), no chrome |
| Tamaño de componentes (monolitos) | 🟡 Medio | 1 outlier de 3.370 líneas + varios 900–1.300 |
| Completitud de portales | ⚪ Fuera de scope | Portal **relator** = código muerto a eliminar (H2) |

---

## 3. Hallazgos por severidad

### 🔴 HIGH

#### H1 — Clases de token no canónicas (no renderizan) · ✅ RESUELTO en `fix-015-consistencia-tokens` (2026-06-13)
> **Estado:** corregido. Al ejecutar, el alcance real resultó **mayor** que el detectado por el scan inicial (que solo cubría `bg-bg-*` y `*-state-*`). Total remediado ≈ **400 usos en ~56 archivos**, todos a clases canónicas del `@theme`. Barridos finales confirman **0** clases muertas restantes y 0 formas malformadas. Pendiente: verificación visual `/verify` + cerrar el punto ciego del linter (Fase 2 §6).
>
> Familias corregidas: `bg-bg-*`→`bg-*`; `text/bg/border-state-*` (+ `-bg`→`-subtle`, `-border`)→tokens de estado; `bg-surface-elevated`/`bg-bg-surface-elevated`→`bg-elevated`; `bg-surface-hover`/`bg-surface-base`→`bg-subtle`; familia `divider` (`border-divider`→`border-border-subtle`, `divide-divider`→`divide-border-subtle`, `bg-divider`→`bg-border-subtle`). **Preservado:** `rows-divider` (clase CSS custom legítima en `pagos`, NO Tailwind).

El `@theme` de `src/tailwind.css` define **solo** estas familias: superficies `bg-surface`/`bg-elevated`/`bg-subtle`/`bg-base`, estados `text-success`/`bg-warning`/`text-error`/`bg-info` (+ `-subtle`/`-border`). **No existen** `--color-bg-surface` ni `--color-state-*`.

Sin embargo, 27 archivos usan formas dobladas/inválidas que **Tailwind v4 ignora silenciosamente** (no se genera CSS → el elemento hereda el color del padre en vez del esperado):

| Clase usada (❌) | Canónica (✅) |
|---|---|
| `bg-bg-surface`, `bg-bg-elevated`, `bg-bg-subtle` | `bg-surface`, `bg-elevated`, `bg-subtle` |
| `text-state-success`, `text-state-error`, `text-state-warning` | `text-success`, `text-error`, `text-warning` |
| `bg-state-success`, `bg-state-warning` | `bg-success`, `bg-warning` |
| `border-state-error`, `border-state-success` | `border-error-border`, `border-success-border` |

> ⚠️ `text-text-primary`, `text-text-muted`, `bg-text-muted`, `bg-brand-dark`, `bg-brand-muted` **sí son canónicas** (su token es `--color-text-*` / `--color-brand-*`). No confundir.

**Peores ofensores** (usos): `admin-alumno-detalle` (18), `cuadratura-content` (17), `historial-cuadraturas-content` (13), `detalle-cuadratura-modal` (22), `libro-de-clases` (12), `secretaria-matricula.html` (10) y todo el wizard de matrícula (`assignment.html` 25, `documents.html` 24, `personal-data.html` 24, `contract.html` 23, `payment.html` 13, `confirmation.html` 6), `servicios-especiales-content` (8), `ficha-tecnica` (6), `email-input.html` (5), `ex-alumnos-stats` (5), `historial-pagos` (4), `curso-singular-*-drawer` (4 c/u), `app-shell` (4).

**Por qué es HIGH:** es la causa más probable del "se ve un poco distinto" — texto que debería ser verde/rojo sale en color por defecto, fondos que no aplican. Es ancho (27 archivos), invisible al lint, y trivial de arreglar (find-replace).

#### H2 — Portal Relator: código muerto fuera de scope · eliminar
**El portal relator ya NO es parte del scope de la app.** Las 8 páginas de `/app/relator/*` (`dashboard`, `alumnos`, `asistencia`, `notas`, `maquinaria`, `acta-final`, `notificaciones`, `alumno-detail`) son stubs `PLANO` ("Pendiente calcar desde mockup") y deben **eliminarse**, no construirse:
- Borrar `src/app/features/relator/` (8 componentes).
- Quitar el bloque de rutas `path: 'relator'` de `src/app/app.routes.ts` (líneas ~758–819) y el `hasRoleGuard(['relator'])`.
- Revisar referencias residuales al rol `relator` en menú/sidebar, `roleRedirectGuard` y modelos de rol.
- **NO confundir** con el *dominio* "relatores" (gestión de relatores de clase profesional: `admin/profesional-relatores`, `relatores.facade`) — eso **sí** sigue en scope. Lo que se elimina es el **portal con login de rol relator**.

> Nota: esto es limpieza de código muerto, no un arreglo de consistencia. Mejora el inventario y elimina 8 páginas off-pattern del conteo de un plumazo.

#### H3 — Monolito `admin-configuracion-web.component.ts` · 3.370 líneas
Outlier extremo (el #2 tiene 1.278). Componente único con template inline de 6 tabs que además concentra: `@keyframes fadeIn` (animación de entrada prohibida — debe ser GSAP), `animate-pulse` ad-hoc (×3), `text-4xl` ad-hoc, emojis. Candidato #1 a descomposición en sub-componentes por tab.

---

### 🟡 MEDIUM

#### M1 — Componentes legacy sin migrar a Signal API (AP-002) · 4 archivos
`@Input()`/`@Output()` en vez de `input()`/`output()`:
- `shared/components/signature-pad` (2 `@Input` + 1 `@Output`)
- `shared/components/evaluation-checklist` (1 `@Input` + 1 `@Output`)
- `shared/components/badge` (1 `@Input`)
- `features/admin/alumnos/ex-alumnos/components/stats` → `AdminStatsPanelComponent` (6 `@Input`)

#### M2 — `admin-ex-alumnos-stats` (`AdminStatsPanelComponent`) — ofensor multi-dimensión
Un solo archivo viola **5 reglas**: (1) `@Input()` ×6; (2) colores hardcodeados `text-cyan-400`/`bg-cyan-400`/`text-amber-500`/`bg-amber-500`; (3) KPI ad-hoc `text-3xl`/`text-4xl font-black` en vez de `app-kpi-card`; (4) clases no canónicas `bg-bg-surface`/`text-state-success` (×5); (5) **nombre de archivo ≠ selector ≠ clase** (`admin-ex-alumnos-stats.ts` → `app-admin-stats-panel` → `AdminStatsPanelComponent`). Es el peor archivo individual de la app.

#### M3 — Cards "string KPI" hechas a mano · ~8 archivos (gap del DS)
`app-kpi-card`/`app-kpi-card-variant` solo aceptan `value: number`. Cuando hay que mostrar una hora ("08:30"), texto o moneda, se hace una card manual con `text-3xl/4xl font-bold text-brand`. Visto en `instructor-dashboard` (KPI "Próxima"), `instructor-clase`, `instructor-clase-detail`, `admin-iniciar/finalizar-clase-drawer`, `payment`, `ex-alumnos-stats`. **Causa raíz: falta una variante de KPI no numérico** en el DS, no descuido del dev.

#### M4 — Colores Tailwind hardcodeados (AP-004) · 2 archivos
`admin-ex-alumnos-stats` (×4, ver M2) y `admin-profesional-evaluaciones` (×1). Únicos casos en toda la app.

#### M5 — Skeletons ad-hoc con `animate-pulse` · 6 archivos
En vez de `<app-skeleton-block>`: `daily-schedule-timeline`, `matricula-steps/documents`, `matricula-steps/confirmation`, `secretaria-matricula`, `instructor-dashboard`, `admin-configuracion-web`.

---

### 🟢 LOW

- **L1 — `[ngClass]` (AP-001) · 3 archivos:** `stat-box`, `evaluation-checklist` (×2), `vehicle-agenda-drawer`. Migrar a `[class.x]`.
- **L2 — `page-wide` como raíz en vez de `.bento-grid` · 3 archivos:** `admin-contabilidad-anticipos`, `admin-contabilidad-liquidaciones`, `secretaria-contabilidad-liquidaciones`.
- **L3 — `text-white`/`bg-white` · 40 archivos:** mayoría dentro de `.surface-hero` (funciona visualmente, pero el DS pide `var(--color-primary-text)`); algunos modales (`eliminar-alumno-modal`) usan `background:white` **intencionalmente** para romper el cascade (documentado). Revisar caso a caso; baja prioridad.
- **L4 — `@keyframes fadeIn` de entrada:** solo en `admin-configuracion-web` (ver H3). El `@keyframes pulse` está permitido (loop de estado).
- **L5 — Emojis:** 38 usos, pero la mayoría son **contenido de la web pública** (`website-config.facade` defaults, `configuracion-web` editor) → es data, no chrome → aceptable. Revisar solo `sidebar` (2) y `alumno-dashboard` (2) por si son íconos de UI.
- **L6 — `MessageService` directo en `theme.service`:** debería pasar por `ToastService` (AP-010). `toast.service` sí es el wrapper legítimo.
- **L7 — Hex arbitrario:** 1 en `dms-viewer-modal` (chrome de visor PDF, probablemente intencional).

---

## 4. Clúster de deriva (archivos que fallan varias dimensiones)

Estos archivos aparecen en **3+ hallazgos** — son los que más "rompen" la sensación de consistencia y dan el mayor ROI al refactorizar:

| Archivo | Falla en |
|---------|----------|
| `admin-ex-alumnos-stats` (AdminStatsPanelComponent) | H1, M1, M2, M3, M4 + naming |
| `admin-configuracion-web` | H1(implícito), H3, M5, L4, emojis |
| `cuadratura-content` / `historial-cuadraturas-content` / `detalle-cuadratura-modal` | H1 (17/13/22 usos), L3 |
| `admin-alumno-detalle` (+ sub-componentes `ficha-tecnica`, `historial-pagos`) | H1 (18+6+4), monolito 1.214 ln |
| Wizard matrícula (`assignment/documents/personal-data/contract/payment` .html) | H1 (111 usos combinados), L3 |
| `libro-de-clases` (admin) | H1 (12), monolito 937 ln |
| `servicios-especiales-content` (+ drawers) | H1 (8+7+4), L3 |

---

## 5. Mapa de consistencia por portal

| Portal | Patrón dominante | Consistencia |
|--------|------------------|--------------|
| **Secretaria** | Wrappers finos → `*-content` + facade compartido | 🟢 Ejemplar (gold standard) |
| **Admin** | `bento-grid` + `section-hero` + `*-content`; bolsones legacy (config-web, ex-alumnos, contabilidad) | 🟢/🟡 Bueno con focos |
| **Instructor** | `bento-grid` + `section-hero` + `kpi-card-variant` correctos | 🟢 Bueno (solo "string KPI" ad-hoc M3) |
| **Alumno** | `bento-grid` + `section-hero` en la mayoría | 🟢 Bueno (revisar páginas sin hero: ayuda/notas/certificado/progreso) |
| **Público (inscripción)** | Wizard propio temático (`public-wizard-shell`, theme azul/roja) | 🟢 Intencional (sistema separado) — pero usa mucho H1 |
| **Relator** | Stubs `PLANO` | ⚪ Fuera de scope → eliminar (H2) |

---

## 6. Plan de remediación priorizado

### Fase 1 — Quick wins de alto impacto (find-replace, bajo riesgo) — ~½ día
1. **H1:** reemplazo global de clases no canónicas en los 27 archivos. Es mecánico:
   - `bg-bg-surface`→`bg-surface`, `bg-bg-elevated`→`bg-elevated`, `bg-bg-subtle`→`bg-subtle`, `bg-bg-base`→`bg-base`
   - `text-state-success`→`text-success` (ídem warning/error/info)
   - `bg-state-success`→`bg-success` (ídem)
   - `border-state-error`→`border-error-border` (ídem; verificar el sufijo correcto contra `STYLES.md`)
   - **Verificar con `/verify` (Playwright)** tras el cambio: algunos elementos cambiarán de color al renderizar por fin → confirmar que el resultado es el deseado, no solo "compila".
2. **M4 + L1:** quitar `text-cyan-400`/`text-amber-500` (→ tokens de estado) y migrar `[ngClass]`→`[class.x]` en 3 archivos.
3. **L6:** `theme.service` → usar `ToastService`.

### Fase 2 — Cerrar el gap del DS y frenar la recurrencia — ~1 día
4. **M3:** agregar variante **`app-kpi-card` para valores no numéricos** (`value: string | number`, o un `app-stat-kpi`) y migrar las ~8 cards "string KPI" hechas a mano. Esto elimina la causa raíz, no solo los síntomas.
5. **Cerrar el punto ciego del tooling:** añadir al `architect.js` (o a `lint:arch`) una regla que **bloquee** `bg-bg-*`, `text-state-*`, `bg-state-*`, `border-state-*`. Sin esto, H1 reaparecerá. (Regex de detección en §7.)

### Fase 3 — Componentes legacy y monolitos — ~2–3 días
6. **M2:** reescribir `AdminStatsPanelComponent` (renombrar archivo/selector/clase a coherentes, `input()`, tokens, `app-kpi-card`).
7. **M1:** migrar `signature-pad`, `evaluation-checklist`, `badge` a Signal API.
8. **M5:** reemplazar `animate-pulse` por `<app-skeleton-block>` (6 archivos).
9. **H3:** descomponer `admin-configuracion-web` (3.370 ln) en un sub-componente por tab; eliminar `@keyframes fadeIn`.
10. **L2:** migrar las 3 páginas `page-wide` a `.bento-grid` raíz.

### Fase 4 — Limpieza de código muerto
11. **H2:** eliminar el portal relator (fuera de scope): borrar `features/relator/`, su bloque de rutas y `hasRoleGuard(['relator'])`, y limpiar referencias residuales al rol en menú/guards/modelos. Conservar el dominio "relatores" de clase profesional.

---

## 7. Regex de detección para enforcement continuo

Para el hook `architect.js` / un check de CI (esto es lo que faltaba detectar):

```
# Clases de token no canónicas (H1) — deben fallar el build:
# (cubre TODAS las familias muertas encontradas en fix-015-m; NO matchea `rows-divider` que es CSS custom)
\b(bg-bg-(base|surface|elevated|subtle|overlay)|(text|bg|border)-state-(success|warning|error|info)|bg-surface-(elevated|hover|base)|(border|bg|divide)-divider)\b

# Colores Tailwind hardcodeados (AP-004) — ya cubierto, reconfirmar:
\b(text|bg|border)-(red|blue|green|gray|amber|cyan|sky|indigo|violet|...)-(50|100|...|900)\b

# KPI ad-hoc (señal de M3, warning no bloqueante):
\b(text-4xl|text-3xl)\b.*font-(bold|black)
```

---

## 8. Resumen ejecutivo (1 línea)

La app es **muy consistente en lo estructural** (arquitectura, control flow, íconos, reuso de organismos); la inconsistencia visible viene de **un punto ciego del linter** (263 clases de token muertas en 27 archivos, H1) + **un gap del DS** (KPIs de texto, M3) + **un clúster legacy** acotado. Aparte, el **portal relator** quedó fuera de scope → es código muerto a eliminar (H2). Todo es remediable; la Fase 1 sola elimina la mayor parte de lo que percibes.
