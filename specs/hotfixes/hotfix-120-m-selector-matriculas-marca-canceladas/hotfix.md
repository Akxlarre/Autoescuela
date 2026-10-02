# Hotfix: El selector de matrículas de la ficha no distingue las canceladas
> id: hotfix-120-m-selector-matriculas-marca-canceladas
> refs: fix-264-m (caso C06 de `024b`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
El selector de matrículas de la ficha lista todas las matrículas que no son borrador, con el texto "Curso · #número". Una matrícula cancelada se ve igual que una vigente: hay que entrar a ella para saber que está cancelada.

**Decisión del owner (Matías, 2026-10-01):** las matrículas canceladas se muestran en el selector, marcadas.

## Cambios
- **Archivo:** `src/app/core/utils/ficha-enrollment.utils.ts` — función pura `buildEnrollmentTabLabel()`: "Curso · #número", y agrega " · Anulada" si la matrícula está cancelada. Se usa "Anulada" y no "Cancelada" porque es la palabra con la que la ficha ya muestra ese estado ("ESTADO: Anulada").
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — `enrollmentTabs` usa esa función.

No cambia qué matrículas aparecen en el selector ni cuál se abre por defecto.

## Verificación
Verificado el 2026-10-01: `src/app/core/utils/ficha-enrollment.utils.spec.ts > buildEnrollmentTabLabel` (4 casos) en verde y `tsc` de la app sin errores. No se probó en navegador con una matrícula cancelada real: el helper de siembra E2E no las crea todavía (queda para la segunda pasada de `fix-264-m`, caso C06).
