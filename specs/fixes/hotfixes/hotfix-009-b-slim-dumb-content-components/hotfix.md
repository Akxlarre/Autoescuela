# Hotfix: Migrar density="slim" en los 10 Dumb "list-content" components
> id: hotfix-009-b-slim-dumb-content-components
> status: done
> closed: 2026-06-18
> created: 2026-06-18

## Problema
10 Dumb Components en shared/ tienen app-section-hero sin density="slim".
Algunos tienen wrapper <div class="bento-banner"> redundante (el host lo aplica solo).
Tres tienen variant="compact" que ya no existe en SectionHeroComponent (prop muerta).

## Cambios
- flota-list-content — density="slim" + [loading]="isLoading()" + quitar div.bento-banner wrapper
- dms-list-content — density="slim" + [loading]="isLoading()" + quitar div.bento-banner wrapper
- alumnos-list-content — density="slim" + [loading]="isLoading()"
- servicios-especiales-content — density="slim" + [loading]="isLoading()"
- reportes-contables-content — density="slim" + [loading]="isLoading()"
- historial-cuadraturas-content — density="slim" + [loading]="isLoading()"
- cuadratura-content — density="slim" + [loading]="isLoading()"
- certificacion-profesional-content — density="slim" + [loading]="isLoading()" + quitar variant="compact"
- certificacion-clase-b-content — density="slim" + [loading]="isLoading()" + quitar variant="compact"
- asistencia-clase-b-content — density="slim" + [loading]="isLoading()" + quitar variant="compact"
