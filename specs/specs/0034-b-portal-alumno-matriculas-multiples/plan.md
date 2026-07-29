# Plan 0034-b — Portal alumno no muestra matrículas múltiples

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-07-29
> **Talla:** S

---

## 1. Resumen ejecutivo

Extender a la página "Pagos" del alumno el mismo patrón multi-matrícula que ya usan Dashboard,
"Mis Clases" y "Mi Horario": inyectar `StudentEnrollmentContextFacade` + `<app-tabs>` en
`AlumnoPagosComponent`, y hacer que `StudentPaymentFacade` pida el estado de la matrícula
seleccionada (no la que adivina `pickEnrollmentToShow()`). El Edge Function `student-payment`
necesita un `enrollmentId` opcional en `load-enrollment-status`, con el mismo chequeo de
ownership que ya tiene `initiate-payment`.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno — todo el patrón (facade de contexto, componente de tabs, modelo `EnrollmentTab`) ya existe.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `supabase/functions/student-payment/index.ts` | `handleLoadEnrollmentStatus` acepta `enrollmentId` opcional en `body`; si viene, valida ownership (`.eq('id', enrollmentId).eq('student_id', student.id)`) y trae esa matrícula puntual; si no viene, cae a `pickEnrollmentToShow()` (AC-E3) | AC1, AC2, AC3, AC-E3 |
| `src/app/core/facades/student-payment.facade.ts` | Inyectar `StudentEnrollmentContextFacade`; `fetchStatus()` envía `context.activeEnrollmentId()` en el body; nuevo método (o extensión de `initialize()`) que resetea `_step` a 1 y re-fetchea al cambiar de matrícula (mismo criterio que `backToSummary()`) | AC2, AC4 |
| `src/app/core/facades/student-payment.facade.spec.ts` | Tests nuevos: `fetchStatus()` pasa el `enrollmentId` correcto; cambiar `activeEnrollmentId()` dispara nuevo fetch con el id correcto y resetea el step | AC2 |
| `src/app/features/alumno/pagos/alumno-pagos.component.ts` | Agregar bloque `<app-tabs>` (copiar patrón exacto de `alumno-clases.component.ts`/`alumno-dashboard.component.ts`, gate `context.enrollments().length > 1`) + `selectEnrollment(id)` | AC1, AC-E1 |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

> Cruzado con `indices/FACADES.md`, `indices/COMPONENTS.md`.

### Componentes existentes que reutilizamos
- `<app-tabs variant="pill">` (`shared/components/tabs/tabs.component.ts`) — mismo componente y variante que ya usa `alumno-dashboard.component.ts`. Sin cambios al componente.

### Facades/Services existentes que extendemos
- `StudentPaymentFacade` — hoy solo inyecta `SupabaseService` (confirmado en `indices/FACADES.md:117`); se le agrega `StudentEnrollmentContextFacade`, igual que ya tienen `StudentClasesFacade`/`StudentHomeFacade`/`StudentHorarioFacade` (`indices/FACADES.md:113-116`).
- `StudentEnrollmentContextFacade` — sin cambios, ya expone todo lo necesario (`enrollments()`, `activeEnrollmentId()`, `setActive()`).

### Componentes/Facades que NO existen y debemos crear
- Ninguno. Este plan es 100% replicar un patrón ya implementado 3 veces, no inventar uno nuevo.

---

## 4. Modelo de datos

N/A — sin migración, sin tabla nueva, sin policy RLS nueva. El único cambio de "contrato" es un
campo `enrollmentId` opcional en el body JSON que ya acepta la acción `load-enrollment-status`
del Edge Function `student-payment` (no es una tabla, es un parámetro de request).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Alumno → AlumnoPagosComponent (Smart)
           ├─ inject(StudentPaymentFacade)
           ├─ inject(StudentEnrollmentContextFacade)   ← nuevo aquí (ya existe en Dashboard/Clases/Horario)
           ├─ @if (context.enrollments().length > 1) { <app-tabs> }
           └─ selectEnrollment(id):
                context.setActive(id) → facade.reloadForActiveEnrollment()
                                              │
                                              ▼
                                 StudentPaymentFacade.fetchStatus()
                                   body: { action: 'load-enrollment-status',
                                           enrollmentId: context.activeEnrollmentId() }
                                              │
                                              ▼
                              Edge Function student-payment
                                 si enrollmentId viene → valida ownership,
                                   trae ESA matrícula (AC2, AC3)
                                 si no viene → pickEnrollmentToShow() (AC-E3, compat)
                                              │
                                              ▼
                                    tabla `enrollments` (RLS ya filtra por alumno dueño)
```

### Capas tocadas

- **Smart**: `features/alumno/pagos/alumno-pagos.component.ts`
- **Facade**: `core/facades/student-payment.facade.ts` (se extiende, no se crea)
- **Edge Function**: `supabase/functions/student-payment/index.ts`
- **Dumb**: ninguno nuevo — `<app-tabs>` ya existe
- **Migration**: N/A

---

## 6. Restricciones aplicables

Reglas aplicables: `architecture.md` (Facade existente se extiende, no se viola el patrón),
`testing-tdd.md` (tests obligatorios para el nuevo comportamiento de `StudentPaymentFacade`),
`swr-pattern.md` (reutilizar `fetchStatus()`/`refreshSilently()` existentes sin romper el guard
`_initialized`). El resto (models, notifications, visual-system nuevo, ai-readability) no aplica
— no hay modelos nuevos, no hay notificaciones, no hay componentes visuales nuevos.

---

## 7. Plan de testing

- **Tests unitarios** (`student-payment.facade.spec.ts`):
  - `fetchStatus()` envía `enrollmentId: context.activeEnrollmentId()` en el body del invoke.
  - Cambiar el mock de `activeEnrollmentId()` y volver a llamar `initialize()`/el método de recarga dispara un nuevo `functions.invoke` con el `enrollmentId` actualizado.
  - El step del wizard (`step()`) vuelve a `1` al cambiar de matrícula (no arrastra un step 2/3 de la matrícula anterior).
- **Edge Function**: no hay harness de test para `student-payment/index.ts` en este repo (solo `enrollment-selection.test.ts` prueba la función pura `pickEnrollmentToShow`); el chequeo de ownership se verifica por revisión de código (replicando literalmente el de `initiate-payment`) + QA manual en vivo.
- **QA manual (Playwright)**: alumno de prueba con 2 matrículas reales (Clase B + Profesional) — confirmar tabs visibles, cambio de tab actualiza saldo/historial, alumno con 1 sola matrícula no ve tabs (AC-E1), intento de pasar un `enrollmentId` ajeno rechazado (AC3, vía request directo si es necesario).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| IDOR: el alumno pide el status de una matrícula que no es suya vía `enrollmentId` manipulado | Media (nuevo parámetro expuesto al cliente) | Replicar EXACTO el chequeo de ownership que ya usa `initiate-payment` (`.eq('id', enrollmentId).eq('student_id', student.id)`) antes de devolver cualquier dato — no inventar una validación nueva |
| Cambiar de tab deja el wizard de pago en un step inconsistente con la nueva matrícula (ej. alumno ve "confirmar pago" de la matrícula equivocada) | Media | Resetear `_step` a `1` en el mismo punto donde se cambia de matrícula, igual criterio que ya usa `backToSummary()` |
| Regresión para el caso común (alumno con 1 sola matrícula) | Baja | Copiar el mismo gate `context.enrollments().length > 1` que ya usan las otras 3 páginas — no reinventar la condición |

---

## 9. Orden de implementación

1. Edge Function: agregar `enrollmentId` opcional + chequeo de ownership en `handleLoadEnrollmentStatus`
2. `student-payment.facade.spec.ts` — tests primero (TDD) para el nuevo comportamiento
3. `student-payment.facade.ts` — inyectar contexto, pasar `enrollmentId`, resetear step al cambiar
4. `alumno-pagos.component.ts` — bloque de tabs + `selectEnrollment()`
5. QA manual Playwright con alumno de 2 matrículas reales
6. `/spec-verify`

---

## 10. Estimación

S — medio día.

---

## Changelog

- 2026-07-29 — plan inicial (talla S, confirmada por el usuario)
