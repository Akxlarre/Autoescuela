# Fix: El aviso de matrícula duplicada nombra el curso elegido en vez del que el alumno ya tiene
> id: fix-066-i-mensaje-duplicado-nombra-curso-equivocado
> refs: fix-058-i-testing-matricula-presencial (B2-4, caso C08)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

`EnrollmentFacade.savePersonalData()` bloquea una matrícula si el alumno ya tiene una en curso de la
**misma clase de licencia** (`evaluateCourseReenrollment(studentId, 'B')`). Clase B, Clase B SENCE
y Refuerzo Clase B son todas licencia B. El mensaje usa el nombre del curso **elegido**
(`courseName`), no el de la matrícula que bloquea: con Clase B activa y Refuerzo elegido dice "ya
tiene una matrícula en curso en Refuerzo Clase B", cuando lo que está en curso es Clase B. La
secretaria no entiende qué bloquea ni dónde buscarlo.

Si el bloqueo en sí debe existir (Refuerzo con Clase B activa, S20) es una decisión de negocio
pendiente; este fix solo corrige el mensaje.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B2-4). Criterios de este fix:

- **AC-F1:** el aviso nombra el curso de la matrícula que está en curso ("ya tiene una matrícula
  en curso en Clase B"), y si es otro curso que el elegido, también el elegido ("No es posible
  matricularlo/a en Refuerzo Clase B mientras esa siga vigente").
- **AC-F2:** si el curso en curso es el mismo que el elegido, el texto queda como antes.
- **AC-F3:** aplica a los dos lugares que bloquean (el aviso modal del RUT ya registrado y la red
  de seguridad antes de crear el borrador).

## Cambio

- **Archivo:** `src/app/core/utils/reenrollment.utils.ts` (+ spec) — `pickBlockingCourseName()` y
  `duplicateEnrollmentMessage()`.
- **Archivo:** `src/app/core/facades/enrollment.facade.ts` (+ spec) — en `block` busca el nombre del
  curso que bloquea y arma el mensaje con la util.

## Test de Regresión

- `src/app/core/utils/reenrollment.utils.spec.ts`.
- `src/app/core/facades/enrollment.facade.spec.ts` (mensaje de la red de seguridad).

## Progreso

- [x] Tests (rojo: util 5/5, facade 1/1) + util y facade (verde).
- [x] Suite completa, `tsc`, `lint:arch` y cierre.

## Verificación

- 2026-10-23, QA Playwright como secretaria (sede 1), caso C08: RUT del alumno de prueba QA-058
  (33.058.001-1, Clase B activa) + Refuerzo Clase B → "Guardar y Continuar" → aviso "QA
  Cincuentaiocho Claseb Prueba ya tiene una matrícula en curso en Clase B. No es posible
  matricularlo/a en Refuerzo Clase B mientras esa siga vigente." ✅ (AC-F1, AC-F3 aviso modal).
  Ninguna escritura en `users`/`students`/`enrollments`.
- AC-F2 y la red de seguridad (AC-F3) cubiertos por `reenrollment.utils.spec.ts` (21/21) y
  `enrollment.facade.spec.ts` (112/112).
- Suite completa 298 archivos, `tsc` limpio, `lint:arch` 0 errores.
- Sigue pendiente la decisión S20 (¿Refuerzo con Clase B activa se permite?); el bloqueo no cambió.
