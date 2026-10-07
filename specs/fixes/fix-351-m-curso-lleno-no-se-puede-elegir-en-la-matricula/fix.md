# Fix: Un curso de promoción lleno se puede seguir eligiendo en la matrícula
> id: fix-351-m-curso-lleno-no-se-puede-elegir-en-la-matricula
> refs: ASG-i-025 · fix-319-m (N05) · 0002-m
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
El paso 2 de la matrícula Profesional muestra el cupo de cada curso ("27 / 25 cupos") pero no lo
usa: el estado de la opción sale solo del estado del curso (`planned`/`in_progress` → "DISPONIBLE",
`enrollment.facade.ts:976`) y el botón solo se deshabilita si está cerrada
(`assignment.component.html:318`). Con el cupo completo —o excedido— se puede elegir y continuar.
Visto en el testing con 27 alumnos en un curso de 25 (N05).

## ACs Afectados
- `0002-m` — selección de promoción en la matrícula.

## Cambio
- `src/app/core/models/ui/enrollment-assignment.model.ts` — `PromotionStatus` suma `'full'`.
- `src/app/core/utils/promotion-code.utils.ts` — función pura `promotionOptionStatus()`: cerrada si
  el curso no está planificado ni en curso; llena si los inscritos alcanzan el cupo; si no, abierta.
- `src/app/core/facades/enrollment.facade.ts` — usa esa función al armar las opciones y rechaza
  guardar una promoción que no esté abierta (por si se llenó mientras el wizard estaba abierto).
- `src/app/shared/components/matricula-steps/assignment/` — un curso lleno sale "SIN CUPO",
  deshabilitado.

El conteo de inscritos no cambia (toda matrícula no cancelada ni borrador).

## Test de Regresión
- `promotion-code.utils.spec.ts`: abierta, llena (igual y sobre el cupo) y cerrada.
- `enrollment.facade.spec.ts`: guardar con una promoción llena elegida → error y no escribe.

## Progreso
- [x] Tests primero: 3 casos de `promotionOptionStatus` y 2 del facade (curso sin cupo y curso
  cerrado → error, no escribe la matrícula).
- [x] Modelo + utilidad + facade + plantilla.
- [x] Vitest 117/117 en los dos specs; `tsc` limpio; `lint:arch` sin errores.
- [x] Revisión en navegador (admin, sede Conductores Chillán, 2026-10-07): con el cupo del curso
  280.2 bajado a 2 de forma temporal (tiene 2 matrículas activas), el paso 2 lo muestra "2 / 2
  cupos · SIN CUPO" y deshabilitado; los otros cuatro siguen "DISPONIBLE". Retomando el borrador
  de prueba que ya tenía elegido ese curso, "Continuar a Documentos" no avanza y avisa "El curso
  de esa promoción ya no tiene cupo. Elige otra promoción.". El cupo quedó de vuelta en 25.
