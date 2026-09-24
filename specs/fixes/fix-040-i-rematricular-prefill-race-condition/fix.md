# Fix: "Re-matricular" desde Ex-Alumnos no precarga datos (race condition)

> id: fix-040-i-rematricular-prefill-race-condition
> refs: fix-037-i-qa-visual-piloto, fix-042-i-rematricula-rut-formato-inconsistente
> status: done
> created: 2026-09-22
> closed: 2026-09-23

## Root Cause

El flujo "Re-matricular" de Ex-Alumnos promete al usuario (vía `ConfirmModalService`):
*"Se abrirá el formulario de nueva matrícula con los datos personales de \<nombre\>
precargados"*. En la práctica el wizard abre completamente vacío.

Causa: `reEnroll()` (duplicado en 4 componentes, ver Alcance) hace:

```ts
void this.router.navigate([], {
  relativeTo: this.route,
  queryParams: { rut: egresado.rut },
  queryParamsHandling: 'merge',
});
this.layoutDrawer.open(SecretariaMatriculaComponent, 'Nueva Matrícula', 'plus');
```

`router.navigate()` se dispara con `void` (fire-and-forget, sin `await`) y la siguiente línea
abre el drawer **inmediatamente**, sin esperar a que la navegación (que agrega `?rut=...` a la
URL) termine. `SecretariaMatriculaComponent.startFreshWizard()` lee el RUT desde
`this.route.snapshot.queryParamMap.get('rut')` — un snapshot tomado en el momento en que el
wizard arranca. Como el drawer se abre antes de que `router.navigate()` resuelva, ese snapshot
todavía no tiene el query param `rut`, así que `prefillStep1()` nunca se llama.

Encontrado durante `fix-037-i-qa-visual-piloto` (QA del piloto), recorrido "Ex-Alumnos:
revisar filtros y re-matricular a alguien desde ahí": confirmado en vivo con
`admin/ex-alumnos`, alumno "Apellido61 Materno61 Alumno61" (RUT 25000061-8) — el wizard abrió
con Paso 1 completamente vacío (RUT, Nombres, Apellidos, Email, Teléfono en placeholder).

## ACs Afectados

Ninguno — fix autónomo, hallazgo de QA sin spec previa.

- AC-1: en `admin/ex-alumnos`, "Re-matricular" sobre un egresado abre el wizard con Paso 1
  precargado (RUT, Nombres, Apellidos, Email, Teléfono) desde los datos del alumno.
- AC-2: mismo comportamiento en `secretaria/ex-alumnos`, `admin/clase-profesional/...` y
  `secretaria/profesional/...` (los 4 componentes con el patrón duplicado).
- AC-3: el flujo normal de matrícula nueva (sin query param `rut`) sigue arrancando con el
  Paso 1 vacío, sin regresión.

## Cambio

- **`admin-ex-alumnos.component.ts`**, **`secretaria-ex-alumnos.component.ts`**,
  **`admin-ex-alumnos-profesional.component.ts`**,
  **`secretaria-ex-alumnos-profesional.component.ts`** — en `reEnroll()`, esperar
  (`await`) el resultado de `router.navigate()` antes de llamar a `layoutDrawer.open()`, para
  garantizar que el query param `rut` ya esté en la URL cuando `SecretariaMatriculaComponent`
  lea el snapshot.
- Fuera de alcance: no se toca la lógica de `prefillStep1()`/`startFreshWizard()` en
  `secretaria-matricula.component.ts` — el problema es puramente de orden de ejecución en el
  caller, no en el prefill en sí.

## Test de Regresión

- Spec de cada uno de los 4 componentes: mockear `Router.navigate()` para que resuelva
  asíncronamente (ej. con un `Promise` controlado) y verificar que `layoutDrawer.open()` se
  llama **después** de que el mock resuelve, no antes.
- `npm run test:ci` completo debe quedar verde.
- Manual: `/verify` — Re-matricular desde `admin/ex-alumnos` y confirmar visualmente que el
  Paso 1 llega precargado con los datos del egresado.

## Evidencia de Verificación

- **Cambio aplicado** (2026-09-23): agregado `await` a `router.navigate()` antes de
  `layoutDrawer.open()` en los 4 archivos (`admin-ex-alumnos.component.ts`,
  `secretaria-ex-alumnos.component.ts`, `admin-ex-alumnos-profesional.component.ts`,
  `secretaria-ex-alumnos-profesional.component.ts`).
- **`npx tsc --noEmit`**: sin errores.
- **`npm run test:ci`**: 200 archivos / 2617 tests en verde (5 skipped pre-existentes), 0
  regresiones.
- **Verificación manual en navegador** (admin, `admin/ex-alumnos`, alumno "Apellido61
  Materno61 Alumno61" RUT 25000061-8 — mismo repro original): confirmado con Playwright MCP
  que **la condición de carrera está resuelta** — la URL ya muestra `?rut=25000061-8` antes
  de que el drawer del wizard termine de renderizarse (antes: el drawer se abría con la URL
  todavía sin el query param).
- **Hallazgo adicional durante la verificación:** con la carrera resuelta, el Paso 1 seguía
  abriendo vacío — pero por una causa **distinta y ya fuera del alcance de este fix**: la
  búsqueda `findUserByRut()` no encuentra al usuario porque compara el RUT normalizado (con
  puntos) contra `users.rut`, que para estos alumnos de seed está guardado sin puntos.
  Confirmado inspeccionando la respuesta de red (`GET .../users?...&rut=eq.25.000.061-8` →
  `[]`, mientras que la propia query de Ex-Alumnos sí trae `"rut": "25000061-8"` para ese
  mismo alumno) y reproduciendo el mismo resultado tecleando el RUT a mano en el Paso 1 (sin
  pasar por Ex-Alumnos en absoluto) — descarta que sea un problema de timing. **Track nuevo
  creado:** `fix-042-i-rematricula-rut-formato-inconsistente`. AC-1/AC-2 de este fix (Paso 1
  "precargado" de punta a punta, visible en pantalla) quedan completos recién cuando
  `fix-042` también se cierre — el `Cambio` declarado en este fix (la corrección del orden de
  ejecución) está correcto y verificado de forma aislada.
