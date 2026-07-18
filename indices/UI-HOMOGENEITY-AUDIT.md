# Auditoría de Homogeneidad de Páginas — Bento / Hero / KPIs

> **Fecha:** 2026-06-14 · **Rama:** `audit/ui-page-homogeneity`
> **Alcance:** todas las páginas enrutables (`features/`, según `app.routes.ts`).
> **Foco:** estructura de página — contenedor raíz bento, posicionamiento del hero y alineación de KPIs. (Complementa a `UI-CONSISTENCY-AUDIT.md`, que cubre tokens/íconos/colores; esto NO repite eso.)
> **Tipo:** diagnóstico + plan por página. **No se modificó código de producción.**

---

## 1. El patrón canónico (referencia: `/app/admin/tareas`)

`admin-tareas.component.ts` es la referencia correcta. **UN** `.bento-grid[appBentoGridLayout]` con hero + KPIs + contenido como **hermanos planos**:

```html
<div class="bento-grid" appBentoGridLayout #bentoGrid>
  <app-section-hero class="bento-hero" icon="..." [actions]="..." />   <!-- hero = celda del grid -->
  <div class="bento-square"><app-kpi-card-variant ... /></div>          <!-- ×4 -->
  <div class="bento-banner card">...</div>
</div>
```
```ts
ngAfterViewInit() { this.gsap.animateBentoGrid(grid); }   // un solo stagger, sin animateHero
```

**Por qué funciona:** hero y KPIs son hijos directos del mismo grid → comparten gap, ancho y bordes izq/der. Un único stagger de entrada.

### Reglas derivadas (el "canon")
1. **Raíz = `.bento-grid[appBentoGridLayout]`.** Nunca `.page-wide`, `.page-content` ni `.p-6` como raíz de una página.
2. **Hero = `<app-section-hero class="bento-hero" icon="...">` como hijo directo del grid.** No envolverlo en `<div class="bento-banner">` ni en ningún div.
3. **KPIs = `<div class="bento-square"><app-kpi-card-variant/></div>`** hermanos directos del mismo grid.
4. **Delegación a `*-content`:** cada `*-content` ya renderiza su propio `.bento-grid` internamente → la página debe delegar **bare** (`<app-x-content/>` como raíz, sin wrapper). Así lo hacen reportes, cuadratura, alumnos, flota, certificación.
5. **GSAP:** **solo `animateBentoGrid`** (decisión 2026-06-14). El hero entra como una celda más del stagger. Se elimina `animateHero` de las páginas bento. (Excepción: páginas de auth sin bento — login, force-password-change, retornos — conservan `animateHero` porque es su única entrada.)

---

## 2. Scorecard

| Dimensión | Estado | Evidencia |
|-----------|--------|-----------|
| Raíz `.bento-grid` | 🟡 | 4 páginas con wrapper (`page-wide`/`p-6`) sobre un `*-content` que ya trae grid |
| Páginas sin bento (stubs `p-6`) | 🔴 | 14 páginas enrutables legacy (+8 relator fuera de scope) |
| Hero como celda directa (`bento-hero`) | 🟡 | ~19 páginas envuelven el hero en `<div class="bento-banner">` |
| Bento plano (no fragmentado) | 🔴 | `liquidaciones-content`: hero suelto + grid de KPIs aparte → KPIs desalineados |
| Entrada GSAP única | 🟡 | ~20 páginas bento con `animateHero` + `animateBentoGrid` (doble) |

---

## 3. Hallazgos por tier (orden de prioridad)

### 🔴 Tier A — Páginas sin bento (stubs legacy `p-6`)
Header artesanal `<div class="p-6"><div class="flex items-center gap-3 mb-6">`, sin `app-section-hero`, sin grid. Totalmente divergentes del DS.

**Fix:** reescribir como `.bento-grid[appBentoGridLayout]` + `app-section-hero` + KPIs/contenido en celdas, o delegar a un `*-content` si existe.

| Ruta | Archivo | Nota |
|------|---------|------|
| `/app/admin/usuarios` | `features/admin/usuarios/admin-usuarios.component.ts:7` | |
| `/app/admin/notificaciones` | `features/admin/notificaciones/admin-notificaciones.component.ts:7` | |
| `/app/secretaria/dashboard` | `features/secretaria/dashboard/secretaria-dashboard.component.ts:7` | ⚠️ es un **dashboard** sin construir |
| `/app/secretaria/pagos` | `features/secretaria/pagos/secretaria-pagos.component.ts:7` | ¿delegar a contenido de pagos? |
| `/app/secretaria/notificaciones` | `features/secretaria/notificaciones/secretaria-notificaciones.component.ts:7` | |
| `/app/secretaria/comunicaciones` | `features/secretaria/comunicaciones/secretaria-comunicaciones.component.ts:7` | el equivalente admin (`tareas`) es la referencia |
| `/app/secretaria/ex-alumnos` | `features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts:7` | admin/ex-alumnos ya es bento → mirror |
| `/app/secretaria/libro-de-clases` | `features/secretaria/libro-de-clases/secretaria-libro-de-clases.component.ts:7` | admin/libro-de-clases ya es bento → mirror |
| `/app/secretaria/profesional/notas` | `features/secretaria/profesional-notas/secretaria-profesional-notas.component.ts:7` | |
| `/app/secretaria/asistencia/profesional` | `features/secretaria/asistencia-profesional/secretaria-asistencia-profesional.component.ts` | |
| `/app/secretaria/asistencia/matriz` | `features/secretaria/asistencia-matriz/secretaria-asistencia-matriz.component.ts` | |
| `/app/secretaria/alumnos/pre-inscritos` | `features/secretaria/alumnos-pre-inscritos/secretaria-alumnos-pre-inscritos.component.ts` | admin/pre-inscritos ya usa section-hero → mirror |
| `/app/alumno/notificaciones` | `features/alumno/notificaciones/alumno-notificaciones.component.ts:7` | |
| `/app/alumno/ayuda` | `features/alumno/ayuda/alumno-ayuda.component.ts:7` | |

**Auth/utilitarias (stub `p-6`, prioridad baja, estética propia):** `/recuperar-contrasena`, `/acceso-denegado`.
**Stubs NO enrutados (código muerto, verificar si eliminar):** `alumno/certificado`, `alumno/notas`, `alumno/progreso`, `alumno/asistencia`.
**Portal relator (8 páginas Tier A):** fuera de scope — ya marcado para eliminación en `UI-CONSISTENCY-AUDIT.md` (H2).

---

### ✅ Tier B — Bento roto por wrapper — RESUELTO (fix-015-m, 2026-06-14)
El `*-content` ya trae su propio `.bento-grid`, pero la página lo envuelve en un contenedor no-grid → doble contenedor (ancho/padding no canónico). **Las 4 páginas ahora delegan bare. Verificado con build + Playwright.**

**Fix:** eliminar el wrapper, delegar bare (igual que reportes/cuadratura/flota).

| Ruta | Archivo | Wrapper a quitar |
|------|---------|------------------|
| `/app/admin/contabilidad/liquidaciones` | `features/admin/contabilidad-liquidaciones/admin-contabilidad-liquidaciones.component.ts:14` | `<div class="page-wide">` |
| `/app/secretaria/contabilidad/liquidaciones` | `features/secretaria/contabilidad-liquidaciones/secretaria-contabilidad-liquidaciones.component.ts:13` | `<div class="page-wide">` |
| `/app/admin/servicios-especiales` | `features/admin/servicios-especiales/admin-servicios-especiales.component.ts:16` | `<div class="p-6">` |
| `/app/secretaria/servicios-especiales` | `features/secretaria/servicios-especiales/secretaria-servicios-especiales.component.ts:15` | `<div class="p-6">` |

---

### ✅ Tier B2 — Bento fragmentado dentro del `*-content` (causa del "KPI desalineado") — RESUELTO (fix-015-m, 2026-06-14)
`liquidaciones-content.component.ts` no usa un grid plano. Tiene el hero en un `<div class="bento-banner">` **suelto** (fuera de cualquier grid) y los KPIs en un `<div class="bento-grid">` **separado**. Como hero y KPIs viven en contenedores distintos con padding distinto, **sus bordes no se alinean**.

| Archivo | Líneas | Problema |
|---------|--------|----------|
| `shared/components/liquidaciones-content/liquidaciones-content.component.ts` | `:267` | hero en `<div class="bento-banner">` suelto, sin grid contenedor |
| | `:268` | `<app-section-hero>` **sin `icon`** (sin badge de marca, a diferencia de tareas/reportes) |
| | `:302` | KPIs en un `<div class="bento-grid">` aparte → no comparte ejes con el hero |

**Fix:** unificar en un solo `.bento-grid[appBentoGridLayout]` con `app-section-hero class="bento-hero" icon="..."` + KPIs `bento-square` + tabla `bento-banner` como hermanos. Patrón de `cuadratura-content` / `reportes-contables-content` (que sí son grids planos). Resuelve ambas páginas de liquidaciones de un golpe.

---

### 🟡 Tier C — Hero envuelto en `<div class="bento-banner">`
La raíz es bento correcto, pero el hero se envuelve en un div en vez de aplicar `class="bento-hero"` directo al `<app-section-hero>`. Viola la regla "no envolver el hero" y pierde `min-height: 180px` (hero más bajo / KPIs arrancan a distinta Y).

**Fix:** mover `class="bento-hero"` al `<app-section-hero>` y eliminar el `<div>` wrapper.

| Ruta | Archivo:línea |
|------|---------------|
| `/app/admin/alumnos/:id` | `features/admin/alumno-detalle/admin-alumno-detalle.component.ts:96` |
| `/app/admin/secretarias` | `features/admin/secretarias/admin-secretarias.component.ts:47` |
| `/app/admin/clase-profesional/relatores` | `features/admin/profesional-relatores/admin-profesional-relatores.component.ts:46` |
| `/app/admin/clase-profesional/archivo` | `features/admin/profesional-archivo/admin-profesional-archivo.component.ts:43` |
| `/app/secretaria/instructores` | `features/secretaria/instructores/secretaria-instructores.component.ts:30` |
| `/app/instructor/dashboard` | `features/instructor/dashboard/instructor-dashboard.component.ts:51` |
| `/app/instructor/alumnos` | `features/instructor/alumnos/instructor-alumnos.component.ts:67` |
| `/app/instructor/horario` | `features/instructor/horario/instructor-horario.component.ts:37` |
| `/app/instructor/ensayos-teoricos` | `features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts:39` |
| `/app/instructor/liquidacion` | `features/instructor/liquidacion/instructor-liquidacion.component.ts:42` |
| `/app/instructor/notificaciones` | `features/instructor/notificaciones/instructor-notificaciones.component.ts:27` |
| `/app/instructor/clase/iniciar` | `features/instructor/clase/instructor-clase.component.ts:30` |
| `/app/instructor/clase/:id` | `features/instructor/clase-detail/instructor-clase-detail.component.ts:47` |
| `/app/alumno/dashboard` | `features/alumno/dashboard/alumno-dashboard.component.ts:45` |
| `/app/alumno/clases` | `features/alumno/clases/alumno-clases.component.ts:42` |
| `/app/alumno/horario` | `features/alumno/horario/alumno-horario.component.ts:37` |
| `/app/alumno/pagos` | `features/alumno/pagos/alumno-pagos.component.ts:48` |
| `/app/alumno/pagar` | `features/alumno/pagar/alumno-pagar.component.ts:59` |

**Variante menor:** `/app/alumno/pruebas-online` (`alumno-pruebas-online.component.ts:43`) envuelve en `<div class="bento-hero">` (mejor que banner, pero sigue siendo un div wrapper innecesario).
**Verificar:** `/app/instructor/alumnos/:id/ficha` (`instructor-ficha.component.ts`) — raíz bento ok, confirmar placement del hero.

---

### 🟡 Tier D — Doble animación de entrada (GSAP)
Páginas bento que llaman `animateHero(hero)` **y** `animateBentoGrid(grid)`. Con el canon fijado (**solo `animateBentoGrid`**), el hero ya entra en el stagger del grid → la llamada extra a `animateHero` es redundante y puede causar doble animación.

**Fix:** eliminar la llamada a `animateHero` y el `viewChild('heroRef')` asociado; conservar solo `animateBentoGrid`.

Páginas afectadas (bento + `animateHero`): admin/dashboard, admin/pagos, admin/instructores, admin/secretarias, admin/auditoria, admin/libro-de-clases, admin/contabilidad-cursos, admin/alumno-detalle, admin/profesional-relatores, admin/profesional-promociones, admin/profesional-asistencia, admin/profesional-evaluaciones, admin/profesional-archivo, instructor/dashboard, instructor/alumnos, instructor/horario, instructor/liquidacion, instructor/ensayos-teoricos, instructor/notificaciones, alumno/pruebas-online.

> Nota: `animateHero` se mantiene en login, force-password-change y los retornos de pago (no son páginas bento).

---

## 4. Resumen de remediación sugerida

| Tier | Páginas | Esfuerzo | Impacto visual |
|------|---------|----------|----------------|
| A | 14 enrutables | Alto (reescritura) | 🔴 Máximo |
| B | 4 | Bajo (quitar wrapper) | 🔴 Alto |
| B2 | 1 componente (afecta 2 páginas) | Medio (reestructurar content) | 🔴 Alto |
| C | ~19 | Bajo-medio (mover clase, quitar div) | 🟡 Medio |
| D | ~20 | Bajo (borrar llamada GSAP) | 🟡 Sutil |

**Quick wins de mayor impacto/menor esfuerzo:** Tier B (4 páginas) + Tier B2 (liquidaciones-content). Resuelven exactamente los ejemplos reportados (`liquidaciones`).

**Páginas que ya cumplen el canon (no tocar):** admin/tareas, secretaria/observaciones, instructor/tareas, admin/clase-profesional/promociones · asistencia · evaluaciones, y todos los delegadores bare (reportes, cuadratura, historial-cuadraturas, alumnos, flota, certificación, documentos, asistencia).
