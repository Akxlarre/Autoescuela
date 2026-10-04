# Fix: Reabrir un panel mientras se está cerrando
> id: fix-295-m-reabrir-un-panel-mientras-se-cierra
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
Cerrar un panel (`LayoutDrawerService.close()`) no lo destruye de inmediato: `LayoutDrawerComponent`
corre la animación de salida (~250 ms) y recién al terminar llama a `clear()`, que quita el
contenido. Si en ese lapso se vuelve a abrir un panel:

1. **El contenido no se vuelve a crear.** Si es el mismo componente, `NgComponentOutlet` conserva
   la instancia que se estaba cerrando, con el estado que dejó (en "Editar Perfil", el formulario
   ya vaciado por "Cancelar").
2. **La animación de salida sigue su curso** y al terminar oculta el host y llama a `clear()`: el
   panel recién abierto desaparece.

Es B36 de `fix-264-m`. No es de la ficha: afecta a cualquier panel que se reabra durante el cierre.

## ACs Afectados
- Cancelar "Editar Perfil" y reabrirlo de inmediato muestra el formulario con los datos del alumno
  y el panel sigue abierto.
- Cerrar un panel y esperar a que termine sigue funcionando igual (se destruye al final de la
  animación).
- Navegar dentro de un panel abierto (`push` / `back`) no cambia.

## Cambio
- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts` — recuerda la animación de
  salida en curso y suma `cancelLayoutDrawerLeave()`, que la detiene sin ejecutar su final.
- **Archivo:** `src/app/layout/layout-drawer.component.ts` — al abrirse durante una salida: cancela
  la animación, descarta el `clear()` pendiente (con `createRequestGuard`) y fuerza que el
  contenido se cree de nuevo.

## Test de Regresión
- `gsap-animations.service.spec.ts > cancelLayoutDrawerLeave (fix-295-m)` ✓ (3 tests)
- `e2e/alumnos-b-ficha.spec.ts > M09 · M15 · B36` ✓ — reabre de inmediato y comprueba que el
  panel sigue abierto y con datos pasada la animación. 4 corridas seguidas en verde (con el código
  anterior fallaba 3 de 3).
- Comprobado en navegador (admin, 1600 px, consola limpia):
  - reabrir de inmediato: panel de 720 px, visible, con el nombre del alumno;
  - cierre normal: el host queda oculto y el contenido se destruye;
  - cerrar "Editar Perfil" y abrir "Ficha Técnica" enseguida: se ve la Ficha Técnica, sin restos
    del formulario.

## Alcance y límites
- El cambio está en el host de todos los paneles de la app. Solo actúa cuando se abre un panel
  mientras otro se está cerrando; el resto del ciclo no cambia.
- Al reabrir a mitad del cierre, el panel vuelve a entrar desde ancho 0 (no retoma desde donde
  iba), así que se ve un pequeño salto.
- No se probó en móvil (panel a pantalla completa), donde la salida es otra animación; el
  mecanismo de cancelación es el mismo.
- El host no tiene test unitario propio: en esta infra no se puede renderizar su plantilla (los
  signal inputs de los hijos no se enlazan). Lo cubren el test del servicio y el E2E.
