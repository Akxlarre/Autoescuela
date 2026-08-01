# Fix: Acción manual "Marcar como Ex-Alumno" + indicador de curso completo en lista de Alumnos
> id: fix-012-i-marcar-ex-alumno-manual
> refs: — (pedido directo del usuario, no ligado a una Asignación existente — se investigó y confirmó que no existía ningún mecanismo, automático ni manual, para esta transición)
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
No existe ningún mecanismo (trigger, Edge Function, ni acción de UI) que convierta a un alumno activo en ex-alumno. La única señal que distingue "Alumnos" de "Ex-Alumnos" es `enrollments.status = 'completed'` (`ExAlumnosFacade`/`AdminAlumnosFacade`), y ese valor nunca se escribe en ningún flujo de producción — ni al generar el certificado, ni al enviarlo por email. Un alumno con las 12 prácticas completas y el certificado ya enviado queda `active` para siempre, salvo edición manual directa en la BD.

Decisión del usuario tras discutir el alcance: **no automático**. En vez de eso:
- Botón manual "Marcar como Ex-Alumno" en la ficha del alumno, habilitado solo cuando el certificado de Clase B ya fue enviado por email.
- Indicador visual (badge) en la lista de "Alumnos" (Base) para los alumnos que ya tienen el curso completo (certificado enviado) pero todavía no fueron pasados a ex-alumno — para que el admin/secretaría sepa a quién le falta hacer clic en ese botón.

## ACs Afectados
Ninguno — fix autónomo (pedido directo del usuario).

## Cambio
- **`src/app/core/facades/admin-alumno-detalle.facade.ts`**: nueva carga de `certificateEmailSent` (join `certificates` → `certificate_issuance_log` con `action='email_sent'`, mismo patrón que `certificacion-clase-b.facade.ts`). Nuevo método `marcarComoExAlumno(enrollmentId: number)`: `UPDATE enrollments SET status='completed'` + refresh + toast.
- **`src/app/core/models/ui/alumno-detalle.model.ts`**: nuevo campo `certificateEmailSent: boolean` en `AlumnoDetalleUI`/`EnrollmentSummary`.
- **`src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`**: nuevo botón "Marcar como Ex-Alumno" (fila completa, mismo patrón que "Reagendamientos" de fix-009-i), `[disabled]` cuando `!certificateEmailSent`, con confirmación antes de ejecutar (acción difícil de revertir).
- **`src/app/core/facades/admin-alumnos.facade.ts`**: nueva query (join `class_b_sessions` por `evaluation_grade IS NOT NULL` count + `certificates`/`certificate_issuance_log`) para derivar "curso completo, certificado enviado, aún activo" por fila.
- **`src/app/core/models/ui/alumno-table-row.model.ts`**: nuevo campo booleano para ese estado.
- **`src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`**: nuevo `p-tag` (severity `warn`, ej. "Curso completo") junto al badge de estado existente, en vista desktop y mobile.

## Ajuste de UX (mismo día): botón movido al header, junto al nombre
El botón se había puesto originalmente como fila completa en la tarjeta de perfil (mismo patrón que "Reagendamientos"). El usuario pidió que estuviera arriba, junto al nombre del alumno, y resaltado para que sea obvio que hay que pasarlo a ex-alumno.
- Se movió de `secondaryActions()` (grid de botones en la tarjeta de perfil) a `heroActions()` con `primary: true` — así aparece en `headerActions()`, que ya filtra `primary || danger` para mostrarse en el `<app-section-hero>` junto al nombre/matrícula.
- Ahora solo aparece cuando ya es elegible (`certificateEmailSent === true`) — antes se mostraba siempre pero deshabilitado con tooltip; el nuevo comportamiento es "aparece cuando corresponde actuar", más intuitivo que un botón deshabilitado permanente en medio de la grilla.
- `onMarcarExAlumno()` se conectó al mismo flujo de `handleHeroAction()` (nuevo `case 'marcar-ex-alumno'`) que ya usan "Editar Perfil"/"Eliminar Alumno".

## Test de Regresión
- `admin-alumno-detalle.facade.spec.ts` — nuevo `describe('fetchCertificateEmailSentMap — fix-012-i', ...)`: mapa vacío sin enrollmentIds; marca `true` solo para el enrollment con evento `email_sent`, `false` para el que no lo tiene. Nuevo `describe('marcarComoExAlumno — fix-012-i', ...)`: confirma `UPDATE enrollments SET status='completed' WHERE id=X` + toast de éxito; toast de error si la query falla.
- `admin-alumnos.facade.spec.ts` — nuevo `describe('cursoCompletoPendienteEgreso — fix-012-i', ...)`: `true` con 12 `evaluation_grade` + certificado + email enviado; `false` si el certificado no fue enviado; `false` si aún no completa las 12 prácticas. Se extendió el mock compartido `mockStudents()` (agregado `.in()`/`.not()`) para no romper los 7 tests preexistentes de esa describe, que ahora también disparan la nueva query (con datos vacíos por defecto).
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores, `npx vitest run` sobre los 4 archivos relacionados (`admin-alumno-detalle.facade`, `admin-alumnos.facade`, `admin-alumno-detalle.component`, drawer de reagendar) → **76/76 verde**.
- Verificación visual pendiente: (a) en la ficha de un alumno Clase B con certificado ya enviado, confirmar que el botón "Marcar como Ex-Alumno" está habilitado, pide confirmación, y al aceptar el alumno desaparece de "Alumnos" y aparece en "Ex-Alumnos"; (b) confirmar que el botón está deshabilitado (con tooltip) si el certificado no fue enviado; (c) en la lista de "Alumnos", confirmar que aparece el badge "Curso completo" (desktop y mobile) para alumnos con 12/12 + certificado enviado que aún no fueron marcados.
