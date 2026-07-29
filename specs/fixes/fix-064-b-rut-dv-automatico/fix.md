# Fix: Dígito verificador del RUT automático en todos los formularios
> id: fix-064-b-rut-dv-automatico
> refs: ASG-b-047 (specs/assignments/ASG-b-047-rut-digito-verificador-automatico.md)
> status: done
> closed: 2026-07-29
> created: 2026-07-28

## Root Cause
**[Heredado de ASG-b-047]:** hoy quien completa cualquier formulario con RUT debe teclear también
el dígito verificador (DV) a mano — es 100% calculable (módulo 11), cero decisión de negocio.
`rut.utils.ts` ya tiene `validateRut()` con el algoritmo módulo 11 completo, pero **inline**, sin
exponer una función que calcule/autocomplete el DV — solo valida un RUT ya completo.

**Mapeo de los 7 puntos de entrada reales de RUT editable en la app** (auditado archivo por
archivo antes de codificar; el resto de archivos que aparecen en `grep formatRut` son facades
sin UI, solo leen/normalizan un rut ya guardado):

| Archivo | Patrón | Blur hoy |
|---|---|---|
| `shared/components/matricula-steps/personal-data/personal-data.component.ts` | signals + `dataChange`/`rutBlur` outputs | Sí (`onRutBlur()`), pero sin auto-DV. Cubre matrícula admin **y** secretaría (`admin-matricula.component.ts` es un wrapper de `SecretariaMatriculaComponent`) |
| `shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` | signals + `patch()` | Sí pero inline sin método dedicado |
| `features/admin/contabilidad-cursos/admin-curso-singular-inscribir-drawer.component.ts` | signals + `patchForm()` | No — flujo es botón "Buscar" |
| `features/admin/instructores/admin-instructor-crear-drawer.component.ts` | signals sueltos | No (`rutTouched` existe, solo se marca en submit) |
| `features/admin/profesional-relatores/admin-relator-crear-drawer.component.ts` | signals sueltos | No (ni `rutTouched` existe) |
| `features/admin/secretarias/admin-secretarias-crear-drawer.component.ts` | signals sueltos | No (mismo patrón que instructor) |
| `shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts` | **Reactive Forms** (`FormControl`) | No — y ni siquiera aplica `formatRut()` hoy (campo `client_rut`, de no-alumnos, mencionado explícito en la asignación) |

## ACs Afectados
Ninguno — fix autónomo (mejora de UX solicitada directamente por el cliente en la reunión del
2026-07-28).

## Cambio
- `core/utils/rut.utils.ts`:
  - **Nuevo** `calculateRutDv(body: string): string` — extrae el cálculo módulo 11 que hoy vive
    inline en `validateRut()` (Núcleo Funcional, reutilizable).
  - `validateRut()` se refactoriza para usar `calculateRutDv()` internamente (DRY, mismo
    comportamiento).
  - **Nuevo** `autocompleteRutDv(rut: string): string` — dado un RUT ya tecleado (formateado o
    no), recalcula el DV a partir del cuerpo (todo excepto el último carácter, mismo criterio que
    `validateRut`) y devuelve el RUT formateado con el DV correcto. Si `cleanRut(rut).length < 2`
    o el cuerpo no es numérico, devuelve el input sin tocar (no hay nada que calcular todavía).
- Se cablea `autocompleteRutDv()` en el blur de los 7 puntos de entrada de la tabla de arriba —
  en los que no tenían `(blur)`, se agrega; en los que ya lo tenían, se inserta la corrección del
  DV antes de emitir/validar. `registrar-venta-drawer.component.ts` además gana `formatRut()` en
  `(input)` (hoy no tenía ningún formateo), para que `client_rut` se comporte igual que el resto
  de los campos de RUT del sistema.
- Fuera de alcance (confirmado, sin cambios): los 7 facades que solo leen/normalizan un `rut` ya
  guardado en BD (no tienen input editable) — no hay nada que autocompletar ahí.

## Test de Regresión
- **Nuevo** en `rut.utils.spec.ts`: casos de `calculateRutDv()` cubriendo DV `K` y DV `0`
  explícitamente (pedido en la asignación), más varios cuerpos reales. Casos de
  `autocompleteRutDv()`: cuerpo válido → DV correcto pegado; RUT con DV equivocado tecleado → se
  sobreescribe con el correcto; input insuficiente (`length < 2`) → se devuelve intacto.
- **Descartado:** intenté un spec para `personal-data.component.ts` (`onRutBlur()`) pero el
  componente usa `templateUrl`/`styleUrl` externos — el setup de vitest del proyecto no resuelve
  recursos externos (`resolveComponentResources()`), limitación ya documentada para componentes
  Angular en este repo. La lógica de cálculo en sí ya está 100% cubierta por
  `rut.utils.spec.ts`; el wiring del componente (llamar a `autocompleteRutDv` y emitir) se
  verifica con `ng build` + Playwright en vivo, no con test unitario.
- **Verificación en vivo (Playwright), confirmada en los 3 patrones arquitectónicos distintos:**
  - Matrícula (`personal-data.component.ts`, patrón `dataChange`/`rutBlur` outputs): tecleé
    `12.345.678-1` (DV incorrecto) → al perder el foco quedó `12.345.678-5` con "RUT válido" —
    y disparó el prefill de un alumno existente con ese RUT real (confirma la integración
    completa con `rutBlur.emit()`).
  - Instructores (`admin-instructor-crear-drawer.component.ts`, patrón signals sueltos):
    tecleé `7654321-1` → quedó `7.654.321-6` con "RUT válido" (coincide con el cálculo manual
    módulo 11 para ese cuerpo).
  - Servicios Especiales (`registrar-venta-drawer.component.ts`, **Reactive Forms**, sin
    formateo previo): tecleé `99999999` (sin puntos/guión) → quedó `9.999.999-3`, confirmando
    tanto el `formatRut()` nuevo en `(input)` como la corrección de DV en `(blur)`.
  - 0 errores de consola en los 3 casos. `ng build` sin errores de tipos en los 7 archivos.

## Notas
- Fix multi-archivo pero de una sola causa raíz (falta una función de autocompletado de DV,
  reutilizada de forma idéntica en 7 puntos de entrada) — no son 7 fixes distintos.
- No se rediseña ningún formulario a "cuerpo + DV como 2 campos separados" (la asignación lo
  sugería como alternativa) — se mantiene el campo único de texto libre ya existente en toda la
  app, corrigiendo el DV en el blur. Más simple, cero cambio de UX estructural, mismo resultado
  ("cero decisión de negocio, cero ambigüedad").
