# Fix: "Re-matricular" desde Ex-Alumnos no precarga datos (race condition)

> id: fix-040-i-rematricular-prefill-race-condition
> refs: fix-037-i-qa-visual-piloto
> status: draft
> created: 2026-09-22

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

Pendiente.
