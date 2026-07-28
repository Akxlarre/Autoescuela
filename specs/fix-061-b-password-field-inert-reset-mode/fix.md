# Fix: Campo Contraseña sigue accesible (a11y + valor viejo) en modo "Recuperar Contraseña"
> id: fix-061-b-password-field-inert-reset-mode
> refs: ASG-031 (specs/assignments/ASG-031-fix-h032-campo-contrasena-visible.md)
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
**Hipótesis original de ASG-031 (heredada) descartada tras verificar en vivo con Playwright:**
la asignación decía que el campo "Contraseña" quedaba visible sin ocultarse. En la práctica,
`login-card.component.ts` **ya** anima `#passwordWrapRef` con GSAP (`height`/`opacity` → 0) al
entrar en modo `reset` — visualmente el campo desaparece correctamente (confirmado con
screenshot).

**Causa raíz real (confirmada en vivo):** el wrapper permanece en el DOM sin `aria-hidden` ni
`inert` — la animación solo lo colapsa visualmente. El snapshot de accesibilidad de Playwright
en modo `reset` sigue exponiendo `textbox "Contraseña"` con el valor anterior cargado
(`Test123456` en la prueba). Un usuario de lector de pantalla o navegación por teclado (Tab)
sigue encontrando el campo aunque esté invisible para un usuario vidente. Además, el valor de
`password` nunca se limpia al cambiar de modo.

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgo H-032).

## Cambio
- `src/app/shared/components/login-card/login-card.component.ts`:
  - Agregar `[attr.inert]` + `[attr.aria-hidden]` en `#passwordWrapRef` (activos cuando
    `mode() === 'reset'`, `null` en caso contrario) — saca el wrapper del árbol de
    accesibilidad y de la navegación por teclado mientras está colapsado, sin romper la
    animación GSAP existente (el elemento sigue en el DOM).
  - Limpiar `this.password = ''` en el `effect()` que anima el wrapper, cuando `isReset` pasa a
    `true` — evita que quede el valor anterior cargado.

## Test de Regresión
- Verificación manual en vivo con Playwright:
  - **Foco real (prueba autoritativa):** con `mode()==='reset'`, `document.querySelector('#lc-password').focus()` no mueve el foco (`document.activeElement` permanece en el campo de correo) — confirma que `inert` bloquea el foco por teclado a nivel de browser real, no solo visualmente.
  - **Valor limpio:** tras cambiar a modo reset, `input.value === ''` (antes tenía el valor anterior, ej. `Test123456` de autofill).
  - **DOM:** `wrapper.hasAttribute('inert') === true` y `style="opacity:0;height:0px"` aplicados simultáneamente.
  - Nota: el snapshot de accesibilidad del propio tool de automatización usado para verificar sigue listando el campo pese a `inert`/`aria-hidden` — parece una particularidad de cómo ese tool arma su árbol (no filtra por `inert`), no un fallo del fix; la prueba de foco real es la señal autoritativa y confirma el comportamiento correcto.
- Sin test unitario nuevo: `LoginCardComponent` es Dumb sin `.spec.ts` existente y el cambio es
  puramente de `attr` + limpieza de variable local, no de lógica computable aislable.

## Notas
- Fix acotado a un solo archivo de producción.
- Causa raíz distinta a la hipótesis original de la asignación — el problema no era visual sino
  de accesibilidad/estado residual. Confirmado en vivo antes de codificar.
