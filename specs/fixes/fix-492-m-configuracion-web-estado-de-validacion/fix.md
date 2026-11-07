# Fix: Configuración web — el estado de validación no es reactivo ni dice dónde está el error
> id: fix-492-m-configuracion-web-estado-de-validacion
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

El estado de validación del formulario se leía con `form.invalid` directo, que no es un signal:

- El botón "Publicar Cambios" del hero vive en un `computed()` que leía `form.invalid`; el
  `computed` no se entera de los cambios del formulario y el botón seguía habilitado con errores
  (S21 / P04 de `fix-485-m`, visto en navegador).
- El pie solo decía "⚠️ Existen errores de validación", sin decir en qué pestaña: con un campo
  vacío en Contacto y la pestaña General abierta no había cómo encontrarlo (P02). Y usaba un
  emoji como ícono (P09, regla visual).

## ACs Afectados

- `0003-b` AC8 (no se publica con datos inválidos): el botón del hero ahora respeta la validación.

## Cambio

- **`core/utils/website-config.utils.ts`:** `configTabsWithErrors(form)` — qué pestañas tienen
  campos inválidos, en el orden de la pantalla.
- **`features/admin/configuracion-web/admin-configuracion-web.component.ts`:** el estado del
  formulario se guarda en un signal (`statusChanges` + al cargar la sede). Con él: el botón del
  hero se deshabilita como el del pie, las pestañas con error muestran el ícono `circle-alert`, y
  el pie dice "Hay campos por corregir en: Contacto & Horas" con ícono Lucide.

## Test de Regresión

- `core/utils/website-config.utils.spec.ts > configTabsWithErrors` ✓
- Navegador: borrar la dirección en Contacto → la pestaña Contacto se marca, el pie la nombra y
  los dos botones "Publicar" quedan deshabilitados. ✓ (2026-11-07, captura `c485-13-error-pestana.png`; al restaurar el campo se habilitan los dos)
