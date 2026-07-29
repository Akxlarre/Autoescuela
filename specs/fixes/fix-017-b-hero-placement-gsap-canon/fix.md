# Fix: Hero placement + GSAP canon (Tier C + D)
> id: fix-017-b-hero-placement-gsap-canon
> refs: indices/UI-HOMOGENEITY-AUDIT.md (Tier C + D)
> status: done
> closed: 2026-06-14
> created: 2026-06-14

## Root Cause
Dos problemas relacionados que se corrigen juntos porque muchos archivos los tienen simultáneamente:

**Tier C:** ~19 páginas bento envuelven `<app-section-hero>` en un `<div class="bento-banner">` (o similar) en vez de poner `class="bento-hero"` directamente en el elemento. Esto viola la regla canon "el hero es hijo directo del bento-grid", lo que reduce el `min-height` del hero (180px se pierde) y crea desalineamiento vertical respecto a páginas que sí lo hacen bien.

**Tier D:** ~20 páginas bento llaman tanto `animateHero(heroRef)` como `animateBentoGrid(bentoGrid)` en `ngAfterViewInit`. Con el canon 2026-06-14 (solo `animateBentoGrid`), el hero ya entra en el stagger del grid como celda más → la llamada extra a `animateHero` es redundante y puede causar doble animación de entrada.

## ACs Afectados
Ninguno — fix autónomo de consistencia visual/arquitectónica.
- Hero de todas las páginas bento debe aparecer como hijo directo del grid (sin div wrapper).
- `ngAfterViewInit` de páginas bento debe llamar solo `animateBentoGrid`; eliminar `animateHero` + su `viewChild('heroRef')` si no hay otro uso.

## Cambio

### Tier C — mover `bento-hero` al `<app-section-hero>` directamente

| Archivo | Fix |
|---------|-----|
| `features/admin/alumno-detalle/admin-alumno-detalle.component.ts` | quitar `<div class="bento-banner">` wrapper del hero |
| `features/admin/secretarias/admin-secretarias.component.ts` | ídem |
| `features/admin/profesional-relatores/admin-profesional-relatores.component.ts` | ídem |
| `features/admin/profesional-archivo/admin-profesional-archivo.component.ts` | ídem |
| `features/secretaria/instructores/secretaria-instructores.component.ts` | ídem |
| `features/instructor/dashboard/instructor-dashboard.component.ts` | ídem |
| `features/instructor/alumnos/instructor-alumnos.component.ts` | ídem |
| `features/instructor/horario/instructor-horario.component.ts` | ídem |
| `features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts` | ídem |
| `features/instructor/liquidacion/instructor-liquidacion.component.ts` | ídem |
| `features/instructor/notificaciones/instructor-notificaciones.component.ts` | ídem |
| `features/instructor/clase/instructor-clase.component.ts` | ídem |
| `features/instructor/clase-detail/instructor-clase-detail.component.ts` | ídem |
| `features/alumno/dashboard/alumno-dashboard.component.ts` | ídem |
| `features/alumno/clases/alumno-clases.component.ts` | ídem |
| `features/alumno/horario/alumno-horario.component.ts` | ídem |
| `features/alumno/pagos/alumno-pagos.component.ts` | ídem |
| `features/alumno/pagar/alumno-pagar.component.ts` | ídem |
| `features/alumno/pruebas-online/alumno-pruebas-online.component.ts` | quitar div wrapper (variante bento-hero) |

### Tier D — eliminar `animateHero` de páginas bento

Páginas con `animateHero` + `animateBentoGrid` a corregir:
admin/dashboard, admin/pagos, admin/instructores, admin/secretarias, admin/auditoria,
admin/libro-de-clases, admin/contabilidad-cursos, admin/alumno-detalle, admin/profesional-relatores,
admin/profesional-promociones, admin/profesional-asistencia, admin/profesional-evaluaciones,
admin/profesional-archivo, instructor/dashboard, instructor/alumnos, instructor/horario,
instructor/liquidacion, instructor/ensayos-teoricos, instructor/notificaciones, alumno/pruebas-online.

## Test de Regresión
Sin lógica de negocio nueva → no hay `.spec.ts`.
- `ng build` sin errores ✓
- `npm run lint:arch` verde ✓
- `/verify` visual: hero de al menos 3 páginas representativas con altura canónica y sin double-animate. ✓
