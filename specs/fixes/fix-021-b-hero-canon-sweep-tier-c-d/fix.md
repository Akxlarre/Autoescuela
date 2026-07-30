# Fix: Hero canon sweep — Tier C + Tier D
> id: fix-021-b-hero-canon-sweep-tier-c-d
> refs: fix-018-refactor-animaciones-entrada-bento-premium, fix-020-homogeneizar-alumno-detalle-canon-ds, indices/UI-HOMOGENEITY-AUDIT.md
> status: done
> created: 2026-06-15

## Root Cause

Tras los fixes 018-020, la única desviación pendiente real es **Tier D (16 páginas):**
bento pages que llaman `animateBentoGrid()` sin `[animateOnInit]="false"` en el hero →
doble tween de entrada (hero's own ngAfterViewInit + stagger del grid).

**Hallazgo durante implementación:** el Tier C del audit era ya correcto — todas las páginas
tenían `class="bento-hero"` directo en `<app-section-hero>`, no en un div wrapper. El audit
describía la estructura incorrectamente. Solo se aplicó el cambio Tier D.

**Páginas descartadas del fix:** `instructor-clase`, `instructor-clase-detail`, `alumno/pagos`,
`alumno/pagar`, `secretaria-instructores` — verificado que NO llaman `animateBentoGrid`;
su hero anima solo (sin doble tween). `alumno/dashboard`, `alumno/clases`, `alumno/horario`
ya tenían `[animateOnInit]="false"` desde antes.

## ACs Afectados

Ninguno — homogeneización visual autónoma (continuación de UI-HOMOGENEITY-AUDIT Tier C/D).

## Cambio por página

Para cada página afectada:
1. `class="bento-hero"` pasa de un `<div>` wrapper al `<app-section-hero>` directamente (Tier C).
2. `[animateOnInit]="false"` se agrega al `<app-section-hero>` (Tier D).

### Páginas afectadas

**Admin:**
- `admin-secretarias.component.ts`
- `admin-profesional-relatores.component.ts`
- `admin-profesional-archivo.component.ts`
- `admin-profesional-asistencia.component.ts`
- `admin-profesional-promociones.component.ts`
- `admin-pagos.component.ts`
- `admin-instructores.component.ts`
- `admin-libro-de-clases.component.ts`
- `admin-contabilidad-cursos.component.ts`

**Instructor:**
- `instructor-alumnos.component.ts`
- `instructor-horario.component.ts`
- `instructor-ensayos-teoricos.component.ts`
- `instructor-notificaciones.component.ts`
- `instructor-clase.component.ts`
- `instructor-clase-detail.component.ts`
- `instructor-liquidacion.component.ts`

**Alumno:**
- `alumno-dashboard.component.ts`
- `alumno-clases.component.ts`
- `alumno-horario.component.ts`
- `alumno-pagos.component.ts`
- `alumno-pagar.component.ts`
- `alumno-pruebas-online.component.ts`

**Secretaria:**
- `secretaria-instructores.component.ts`

## Test de Regresión

- ✅ `npm run build` verde (todos los chunks compilan sin error).
- ✅ Verificación visual spot-check en Playwright: al menos 3 páginas representativas — una admin, una instructor, una alumno — muestran hero con altura correcta y entrada única.

