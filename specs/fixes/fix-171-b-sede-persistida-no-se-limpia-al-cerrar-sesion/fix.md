# Fix: La sede activa no se limpia al cerrar sesión y el siguiente usuario la hereda

> **id:** fix-171-b-sede-persistida-no-se-limpia-al-cerrar-sesion
> **refs:** fix-168-b (ahí se detectó el hazard y se dejó fuera de alcance)
> **status:** done
> **owner:** b
> **created:** 2026-09-23
> **closed:** 2026-09-24

## Root Cause

`BranchFacade` persiste la sede activa en `localStorage` bajo `autoescuela:selectedBranchId`.
La clave **no está namespaceada por usuario** y **nadie la limpia al cerrar sesión**:
`AuthFacade.logout()` dispone el realtime y borra el usuario, pero deja la sede escrita.

En una PC compartida —el mostrador de la escuela es exactamente ese caso— el siguiente usuario
que entra hereda la sede que eligió el anterior. `BranchFacade` la re-lee en el inicializador del
signal, antes de que se sepa quién se autenticó.

`AuthFacade` ya llama a `branchFacade.reset()`, pero **solo** cuando se revoca el grant multi-sede
(`refreshProfile()`). El caso mucho más común —cerrar sesión— no estaba cubierto.

**Alcance real:** `selectedBranchId()` se lee en **72 archivos** de `src/app` (sin contar specs).
Cualquiera de ellos que filtre por esa sede queda expuesto al mismo error de fondo.

> Corrección: durante `fix-168-b` dije "la leen ~6 facades", citando de memoria la tabla de
> `facades.md`. El número real es 72 archivos. La deuda era bastante más grande de lo que reporté.

## Ya causó un bug real

`fix-168-b` (2026-09-21): una secretaria veía **el historial de comunicados vacío**, sin error y
sin selector con el que darse cuenta, porque había heredado la sede de otro usuario en ese
navegador. Se corrigió *ahí* usando el helper de scope por rol, pero la causa de fondo —la clave
que sobrevive al cierre de sesión— quedó explícitamente fuera de alcance. Este fix la cierra.

## ACs Afectados

- Ninguno de una spec concreta: es una fuga transversal de estado entre sesiones de usuario.
- Complementa `fix-168-b`, que blindó un consumidor; esto arregla la fuente.

## Cambio

- **Archivo:** `src/app/core/facades/auth.facade.ts`
- **Qué cambia:** `logout()` llama a `branchFacade.reset()`, que ya existe y hace exactamente
  esto (pone la selección en `null` y borra la clave de `localStorage`). Se hace en `logout()` y
  no en cada llamador porque los 3 puntos de salida (topbar, guard de redirección por rol,
  pantalla de módulo no disponible) pasan todos por ahí.

**Por qué limpiar y no namespacear por usuario:** namespacear preservaría la comodidad de que cada
usuario recuerde su sede entre sesiones, pero `BranchFacade` lee `localStorage` en el
inicializador del signal —antes de que la autenticación haya resuelto quién es el usuario—, así
que habría que reestructurar su ciclo de vida. Limpiar en el cierre de sesión resuelve la fuga
por completo con el método que la clase ya expone. Si más adelante se quiere la comodidad, eso es
una mejora aparte y no un bug.

## Test de Regresión

- `auth.facade.spec.ts > logout() limpia la sede activa para que no la herede el próximo
  usuario` ✓ — espía `reset()` sobre el `BranchFacade` **real**, no un mock.
- `auth.facade.spec.ts > logout() deja la sede en null, no solo llama al reset` ✓ — el primero
  se contentaría con que se llame al método; este comprueba el **efecto**. Fallaba con
  `expected 2 to be null`.

Escritos primero; ambos fallaban antes del cambio.

## Verificación en el navegador

El escenario completo, que es donde vivía el bug:

1. Entrar como admin y elegir "Conductores Chillán" en el selector de sede.
2. Comprobar que la clave quedó escrita: `{"id":2,"name":"Conductores Chillán"}`.
3. Cerrar sesión desde el menú de perfil.

| | `autoescuela:selectedBranchId` |
|---|---|
| Antes del logout | `{"id":2,"name":"Conductores Chillán"}` |
| Después del logout | **`null`** |

**Semáforos:** 2621 tests exit 0, `lint:arch` exit 0, `ng build` exit 0.
