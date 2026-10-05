# Fix: La fila del selector de matrícula solo se reserva cuando el selector se dibuja
> id: fix-314-m-la-fila-del-selector-de-matricula-solo-se-reserva-cuando-el-selector-se-dibuja
> refs: ASG-i-024, fix-313-m
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
En la ficha del alumno, dos cosas deciden por separado si hay selector de matrícula. La grilla de
la pantalla pasa a tres filas (cabecera, selector, cuerpo) con la clase `has-enrollment-selector`,
que solo mira cuántas matrículas hay. El selector, en cambio, se dibuja solo cuando la carga
terminó sin error. Al cargar un alumno con dos o más matrículas, la lista de matrículas llega a
mitad de la carga: durante ese instante la grilla ya tiene tres filas pero lo que hay en pantalla
sigue siendo cabecera + skeleton. El skeleton cae en la fila del selector, que mide 0 px, y
desaparece hasta que la carga termina. `fix-313-m` tapó la variante "matrículas heredadas del
alumno anterior", pero la causa de fondo es esta doble condición. Reportado por Matías con tres
capturas (skeleton completo → skeleton vacío → ficha), con el alumno de las matrículas 0083 y 0082.

## ACs Afectados
- Mientras la ficha carga, el skeleton se ve completo de principio a fin, también cuando el alumno
  tiene dos o más matrículas.
- Con la ficha cargada, un alumno con dos o más matrículas muestra su selector y el cuerpo ocupa
  el resto de la pantalla, igual que antes.

## Cambio
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — una sola
  condición (`showEnrollmentSelector`) decide tanto la clase de la grilla como el dibujo del
  selector.

## Test de Regresión
- `admin-alumno-detalle.component.spec.ts > shouldShowEnrollmentSelector (fix-314-m)` (4 tests) ✓
- `e2e/alumnos-b-ficha.spec.ts > skeleton de la ficha > fix-314-m` ✓ — abre la ficha de un alumno
  con dos matrículas demorando todo lo que se pide después de la consulta del alumno, y mide el
  alto del skeleton varias veces mientras dura. Sin el arreglo falla (dos corridas seguidas, para
  descartar el código en caché de `ng serve`): el mínimo medido es 0 px.

## Verificación
2026-10-05: con el arreglo, el test de navegador pasa y la ficha cargada sigue mostrando el
selector con sus dos matrículas. Suite de navegador de la ficha completa: 79 de 79.
`npm run test:ci`: 3.185 pasan, 5 omitidos. `npm run lint:arch`: 0 errores.

`fix-313-m` se conserva: vaciar las matrículas del alumno anterior sigue siendo correcto (el
selector no debe conocer matrículas de otro alumno), aunque con este cambio ya no es lo que
protege al skeleton.
