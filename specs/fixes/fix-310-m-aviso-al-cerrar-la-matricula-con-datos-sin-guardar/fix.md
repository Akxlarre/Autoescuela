# Fix: Aviso al cerrar la matrícula con datos sin guardar
> id: fix-310-m-aviso-al-cerrar-la-matricula-con-datos-sin-guardar
> refs: ASG-i-024
> status: done
> closed: 2026-10-05
> created: 2026-10-04

## Root Cause
El wizard de matrícula no guarda nada hasta "Guardar y Continuar" del Paso 1: lo escrito vive solo
en memoria (`_step1Form`). El panel donde se abre (`LayoutDrawerService`) se cierra de inmediato con
la X o con un clic fuera, sin preguntarle nada al componente que muestra, y "Cancelar" del Paso 1
tampoco pregunta. Quien llena el formulario y cierra por error pierde todo lo escrito sin ningún
aviso. Desde el Paso 2 no pasa: la matrícula ya es un borrador que se puede retomar. Comprobado en
navegador en `fix-264-m` (`024a` O02).

**Decisión del owner (Matías, 2026-10-04):** falta un aviso, y con eso basta; solo si se escribió
algo.

## ACs Afectados
- AC-1: con algo escrito y sin guardar en el Paso 1, cerrar el panel (X o clic fuera) o apretar
  "Cancelar" pide confirmación. Si se confirma, se cierra; si no, el formulario sigue como estaba.
- AC-2: sin nada escrito, o con el Paso 1 ya guardado y sin cambios, se cierra sin preguntar.
- AC-3: los demás paneles de la app se cierran igual que antes.

## Cambio
- **Archivo:** `src/app/core/utils/enrollment-unsaved.utils.ts` (nuevo) — función pura que dice si
  el formulario del Paso 1 tiene texto distinto del último guardado.
- **Archivos:** `src/app/core/services/ui/layout-drawer.service.ts` y su facade —
  `setCloseGuard()` y `requestClose()`: el componente abierto puede registrar una pregunta previa
  al cierre que pide el usuario. `close()` sigue cerrando sin preguntar.
- **Archivo:** `src/app/layout/layout-drawer.component.ts` — la X y el fondo usan `requestClose()`.
- **Archivos:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` y su
  plantilla — registra la pregunta y la usa también en "Cancelar".

## Test de Regresión
- `enrollment-unsaved.utils.spec.ts` (15 tests) ✓
- `layout-drawer.service.spec.ts > cierre con confirmación (fix-310-m)` (6 tests) ✓
- `secretaria-matricula.component.spec.ts > aviso de datos sin guardar (fix-310-m)` (6 tests) ✓
- `e2e/alumnos-b-lista.spec.ts > O02 · fix-310-m` ✓ — con un nombre escrito, la X y "Cancelar"
  muestran "¿Cerrar sin guardar?"; "Seguir editando" conserva lo escrito y "Sí, cerrar" cierra.
  Con el Paso 1 guardado cierra sin preguntar.

## Alcance
- Solo cuenta lo que se escribe (RUT, nombres, correo, teléfono, fechas, dirección, código
  SENCE). Elegir sexo, tipo de licencia o curso no dispara el aviso.
- Los datos que el wizard precarga de un alumno existente no cuentan como escritos.
- No pregunta al usar "Reiniciar", al navegar a otra pantalla por el menú ni al abrir otro panel
  encima: no se pidió y quedan como estaban.

## Verificación
2026-10-05: 55 tests unitarios de los archivos tocados en verde. En navegador pasan O02, O03
(parcial), O04, W01 · W02, W05 y M09 · M15 · B36 (este último cierra y reabre otro panel, que no
registra pregunta). `indices/SERVICES.md` y `indices/UTILS.md` actualizados.
