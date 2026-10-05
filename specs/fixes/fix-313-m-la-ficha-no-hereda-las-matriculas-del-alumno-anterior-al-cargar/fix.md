# Fix: La ficha no hereda las matrículas del alumno anterior al cargar
> id: fix-313-m-la-ficha-no-hereda-las-matriculas-del-alumno-anterior-al-cargar
> refs: ASG-i-024
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
Al abrir la ficha de un alumno distinto, `AdminAlumnoDetalleFacade.initialize()` limpia el estado
del alumno anterior (datos, clases, pagos, historial…) antes de pedir el nuevo, pero no limpia
`_enrollmentSummaries`, la lista de matrículas que alimenta el selector. Si el alumno anterior tenía
dos o más matrículas, durante la carga la pantalla sigue creyendo que hay selector: aplica la
grilla de tres filas (cabecera, selector, cuerpo) cuando en carga solo hay cabecera y skeleton. El
skeleton del cuerpo cae en la fila del selector, que mide lo que su contenido, y no se ve; quedan
la cabecera y poco más. Reportado por Matías tras visitar al alumno de prueba con dos matrículas
(0083 y 0082) y abrir después otro alumno.

## ACs Afectados
- Al abrir otro alumno, el skeleton de la ficha se ve completo (cabecera + cuerpo de 3 columnas)
  sin importar cuántas matrículas tenía el alumno visitado antes.
- Reabrir el mismo alumno sigue sin skeleton (refresco en segundo plano) y conserva su selector.

## Cambio
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — `initialize()` vacía
  `_enrollmentSummaries` junto con el resto del estado del alumno anterior.

## Test de Regresión
- `admin-alumno-detalle.facade.spec.ts > … (fix-313-m)` (2 tests) ✓ — el primero falla sin el
  arreglo; el segundo protege la reapertura del mismo alumno.
- `e2e/alumnos-b-ficha.spec.ts > skeleton de la ficha (fix-313-m)` ✓ — siembra un alumno con dos
  matrículas, abre su ficha, vuelve a la lista y abre otro con la carga demorada. Sin el arreglo
  falla: el cuerpo del skeleton no es visible.

## Verificación
2026-10-05, medido en navegador a 1600 px, abriendo otro alumno después del de las matrículas 0083
y 0082:

| | Filas de la pantalla durante la carga | Alto del cuerpo del skeleton |
|---|---|---|
| Sin el arreglo | 54 px · 0 px · 622 px (con fila de selector) | 0 px |
| Con el arreglo | 54 px · 642 px | 578 px |

87 tests del facade en verde. En navegador pasan también C06, C07, N07 y W05 (selector de
matrículas y re-matrícula). Ojo al repetir la comprobación "sin el arreglo": la primera corrida
tras editar usó el código anterior de `ng serve` y pasó igual; hubo que repetirla.
