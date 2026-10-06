# Fix: La ficha del alumno bloquea el selector de sede en la sede de su matrícula
> id: fix-342-m-ficha-bloquea-sede-del-alumno
> refs: ASG-i-025 · fix-319-m · fix-334-m (D14)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

La ficha (`/app/{admin,secretaria}/alumnos/:id`, `AdminAlumnoDetalleComponent`) carga al alumno
por su id y **no usa la sede del topbar para nada**, pero tampoco la bloquea. Reportado por
Matías (2026-10-06): desde la Base Profesional (selector bloqueado en Conductores Chillán) se abre
la ficha de un alumno Profesional y el selector queda libre: se puede cambiar a otra sede y la
ficha sigue mostrando al mismo alumno. El topbar dice una sede y la pantalla muestra datos de otra.
Lo que muestra al entrar depende de la sede previa a la Base Profesional (D14 de fix-334-m):
Conductores si se llegó conmutando, "Todas" si se venía de "Todas".

Pasa igual con cualquier ficha de Clase B (Base B, buscador global): se puede elegir una sede que
no es la del alumno.

Revisadas todas las navegaciones que salen de pantallas Profesional: la ficha es la única subvista
con ruta propia (desde Base Profesional, Ex-Alumnos Profesional —bloqueado— y el buscador global).
Promociones, Libro de clases y Archivo abren su detalle en paneles sin cambiar de ruta, así que
conservan el bloqueo. No estaba cubierto por el checklist (sección T solo mira las 3 pantallas).

## Decisión (Matías, 2026-10-06)

**D17 — Toda ficha (Clase B y Profesional) bloquea el selector en la sede de la matrícula
abierta**, con aviso; sigue a la pestaña de matrícula elegida; al salir vuelve a la sede que había.
No se guarda (F5 dentro de la ficha vuelve a aplicar el bloqueo).

## ACs Afectados

Ninguno de spec. Cierra:

- Con una ficha abierta, el selector muestra la sede de la matrícula abierta y no deja elegir
  otra ni "Todas"; el panel explica por qué.
- Cambiar de pestaña de matrícula a una de otra sede mueve el bloqueo a esa sede.
- Al salir de la ficha el selector vuelve a lo que había antes (y a lo guardado).

## Cambio

- **`core/facades/branch.facade.ts`**: `lockToBranch(id, reason)` / `releaseBranchLock()` —
  fija la sede en memoria (sin guardar), recuerda la previa solo al primer bloqueo, deshabilita
  "Todas" y las demás sedes (`requiresSpecificBranch`, `disabledBranchIds`) y expone el motivo
  en `lockReason`.
- **`features/admin/alumno-detalle/admin-alumno-detalle.component.ts`**: un `effect` bloquea en
  `facade.alumno().branchId` (sigue a la matrícula mostrada) y se libera al destruirse.

## Test de Regresión

- `branch.facade.spec.ts > bloqueo de sede (fix-342-m)` ✓
- Navegador: (1) Base Profesional → ficha Profesional: 🔒 Conductores, "Todas" y Autoescuela
  deshabilitadas, con aviso; Volver → Base Profesional normal. (2) Base B con "Todas" → ficha de
  un alumno de Autoescuela: 🔒 Autoescuela; Volver → "Todas". (3) Buscador global con
  Conductores → alumno de Autoescuela: 🔒 Autoescuela; al salir, Conductores. (4) F5 en la ficha:
  bloqueo aplicado y lo guardado intacto ✓

### Verificación (2026-10-06)

- `branch.facade.spec.ts`: 5 tests nuevos en rojo antes del cambio, en verde después (incluye
  mover el bloqueo entre sedes al cambiar de matrícula y volver a la sede ORIGINAL al salir).
  Suite 3342 ✓; `tsc` y `lint:arch` sin errores.
- Navegador (admin):
  1. "Todas" → Base Profesional (🔒 Conductores, "Solo sedes con Clase Profesional") → ficha de
     E2E-ProfA2: 🔒 Conductores, aviso "Sede de la matrícula del alumno", "Todas" y Autoescuela
     deshabilitadas → Volver: Base Profesional con su bloqueo.
  2. Base B con "Todas" → ficha de Reyes Muñoz (Autoescuela): 🔒 Autoescuela, "Todas" y
     Conductores deshabilitadas → Volver: "Todas".
  3. El buscador global filtra por la sede elegida: con Conductores no ofrece alumnos de
     Autoescuela, así que ese escenario no ocurre.
  4. F5 dentro de la ficha: 🔒 Autoescuela; lo guardado sigue en "Todas".
  5. **B + Profesional** (E2E-ProfConB desde la Base B con "Todas"): pestaña Clase B #0073 →
     🔒 Conductores; pestaña Profesional A3 #0095 → 🔒 Conductores; de vuelta a la B → igual;
     Volver → "Todas". (Sus dos matrículas son de Conductores; el caso con sedes distintas por
     matrícula no existe en los datos de prueba y lo cubre el test unitario.)
