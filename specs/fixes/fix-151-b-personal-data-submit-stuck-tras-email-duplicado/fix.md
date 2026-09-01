# Fix: Botón "Continuar" queda atascado en "Procesando..." tras error de email duplicado

> id: fix-151-b-personal-data-submit-stuck-tras-email-duplicado
> refs: — (encontrado en barrido UAT, Paquete 1 — docs/UAT-PLAN.md)
> status: done
> closed: 2026-08-31
> created: 2026-08-31

## Root Cause

`public-personal-data.component.ts` (`onNext()`, línea ~726) setea `_submitting.set(true)` antes
de emitir `next.emit()` hacia el padre (`public-enrollment.component.ts` → `onPersonalDataNext()`
→ `facade.savePersonalData()`). `_isLoading = computed(() => loading() || _submitting())` controla
el estado disabled/"Procesando..." del botón, y `onNext()` tiene guard `if (this._isLoading())
return;`.

**El bug:** `_submitting` nunca se resetea a `false` en ningún lugar del componente. El padre sí
resetea correctamente su propio `facade.isLoading()` (input `[loading]`) cuando el submit termina
—éxito o error (ej. email ya registrado)— pero el signal local `_submitting` del hijo queda en
`true` para siempre, porque nada lo escucha. Como `_isLoading` es un OR de ambos, el botón queda
permanentemente disabled en "Procesando..." incluso después de que el usuario corrija el dato que
causó el error (ej. cambiar el email duplicado por uno válido) — no hay forma de reintentar sin
recargar la página completa.

Reproducido 2 veces limpio: Clase B → llenar formulario con un email ya usado → Continuar → error
"Este correo ya está registrado por otra persona" (correcto) → corregir el email a uno único → el
botón pasa a "Procesando..." (por el blur que reevalúa) y **queda ahí indefinidamente**, `disabled:
true` confirmado vía DOM.

## ACs Afectados

Ninguno — fix autónomo, bug de UX bloqueante encontrado en QA manual (paquete 1 de
`docs/UAT-PLAN.md`, owner B).

## Cambio

- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`
- **Qué cambia:** se agrega un `effect()` en el constructor que resetea `_submitting` a `false`
  cada vez que el `loading()` (input del padre) pasa a `false` — cubre tanto el camino de éxito
  (el padre avanza de paso y este componente se destruye, el effect es inofensivo) como el de
  error (el padre setea `facade.isLoading()` en `false` tras `catch`/fin del try, liberando el
  botón para reintentar). No se toca el guard de `onNext()` ni el timing del `setTimeout(10)`
  existente (Silver Bullet de autofill) — la única falla era la ausencia de reset.

## Test de Regresión

- Verificado en vivo (`ng serve`, 2026-08-31): reproducido el stuck-state 2 veces antes del fix
  (RUT `18.222.333-6` / `19.333.444-K`, email `alumno@test.com` / `secretaria@test.com` como
  duplicados reales del seed). Tras el fix: mismo flujo, corregir el email después del error de
  duplicado deja el botón "Continuar" habilitado de nuevo, sin recargar la página.
- `public-personal-data.component.ts` usa `templateUrl` inline (no external resources), pero el
  proyecto excluye specs de componentes Angular de Vitest (memoria
  `project_no_angular_component_tests` — mismo patrón documentado en `fix-064-b-rut-dv-automatico`).
  Verificación por navegador real, no unit test.
