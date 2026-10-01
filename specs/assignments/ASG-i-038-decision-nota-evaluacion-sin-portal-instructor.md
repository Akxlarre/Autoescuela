# Asignación ASG-i-038 — Decisión de producto: ¿quién pone la nota de evaluación de las clases B durante el piloto?

> **status:** completada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-10-01
> **resulting_track:** fix-262-m-certificacion-b-sin-requisito-nota

---

## Contexto / Objetivo

En el piloto nadie puede poner la nota de evaluación (`class_b_sessions.evaluation_grade`) de las
clases prácticas Clase B, y sin esa nota **ningún alumno puede certificarse ni egresar**. Hay dos
decisiones anteriores que chocan:

1. **`fix-115-m` (2026-08-05), decisión del dueño:** *"ni admin ni secretaría deben tocar la
   evaluación en absoluto, nunca. Es exclusiva del instructor."* Por eso el drawer de
   Finalizar Clase de admin/secretaria ya no escribe la nota
   (`asistencia-clase-b.facade.ts`, `finishClass`). La nota solo se escribe desde el portal
   Instructor (`instructor-clases.facade.ts` → `saveEvaluation()`, pantalla
   `instructor-evaluacion.component.ts`).
2. **Alcance del piloto (2026-09-15):** el portal Instructor está bloqueado
   (`pilotPhaseGuard('instructor')`, `src/app/core/config/pilot-phase.config.ts`).

**Consecuencia:** la Certificación Clase B cuenta solo las clases con `evaluation_grade` no nulo
(`certificacion-clase-b.facade.ts:459-463`), y el listado de alumnos usa el mismo criterio para
"Curso completo" (`admin-alumnos.facade.ts:496-512`). Con el portal bloqueado ningún alumno llega
a 12/12: no hay certificado, no hay egreso a Ex-Alumnos, y los alumnos quedan activos para siempre.
Hay que decidir cómo se resuelve **antes de entregar el piloto**.

## Opciones a evaluar

| Opción | Qué implica | A favor | En contra |
|---|---|---|---|
| **A. Desbloquear solo la evaluación del portal Instructor** | Sacar del bloqueo la ficha del alumno y la pantalla de evaluación del instructor (el resto del portal sigue oculto). | Respeta la regla de `fix-115-m`. El código ya existe. | Los instructores tienen que tener cuenta activa, capacitación y usar la app, que es justo lo que el piloto quería evitar. `ASG-b-100` advierte que el portal Instructor no tiene QA visual y `instructor@test.com` tiene 0 alumnos. |
| **B. Excepción de piloto: admin registra la nota "en nombre del instructor"** | Volver a mostrar la nota solo para admin (o admin + secretaria) mientras dure la fase, dejando auditado quién la cargó y a nombre de qué instructor. | Sin depender de los instructores. Cambio acotado. | Contradice la regla del dueño; hay que pedirle una excepción explícita y temporal. |
| **C. Cambiar el criterio de certificación durante el piloto** | Contar clases `completed` (cerradas con KM) en vez de clases con nota. | Cambio mínimo, sin tocar quién evalúa. | La certificación dejaría de exigir evaluación: ¿es aceptable legal y pedagógicamente (DS 39 / normativa de escuelas de conductores)? |
| **D. Posponer: en el piloto nadie se certifica** | Aceptar que los alumnos que terminen queden pendientes y certificarlos cuando se levante la fase. | Cero código. | Solo sirve si el piloto es corto y ningún alumno termina las 12 clases antes; hay que avisarlo al cliente. |

## Alcance sugerido

- **Primero, la decisión**, con el dueño y por escrito (actualizar la nota de `fix-115-m` si se
  hace una excepción). Si se elige C, confirmar el aspecto normativo (el skill `compliance-cl`
  tiene el pack `autoescuela-cl`).
- Después, el cambio de código según la opción elegida (spec o fix, según tamaño).
- **Decisión relacionada, conviene tomarla en la misma conversación:** el cron de fin de jornada
  marca `no_show` las clases que nadie "inició" antes de ~22:00 y aplica la penalización. Sin
  instructores marcando en tiempo real, depende 100% de que la secretaria inicie y cierre cada
  clase ese mismo día (ver `specs/testing-piloto/026-agenda-triple-match.md` S1 y
  `027-asistencia-clase-b.md` S1/S2).

## Referencias

- `specs/fixes/fix-115-m-ocultar-evaluacion-secretaria-admin/fix.md` (regla actual)
- `specs/assignments/ASG-b-048-ocultar-evaluacion-a-secretaria.md` (origen de la regla)
- `specs/testing-piloto/027-asistencia-clase-b.md` S5 y `000-resumen.md` grupo 4
- `specs/assignments/ASG-b-100-*` (QA pendiente del portal Instructor)

## Archivos involucrados (opcional, para detectar solapes)

- Según la opción: `src/app/core/config/pilot-phase.config.ts` y `app.routes.ts` (A);
  `src/app/features/admin/asistencia/admin-finalizar-clase-drawer.component.ts` y
  `asistencia-clase-b.facade.ts` (B); `certificacion-clase-b.facade.ts` y
  `admin-alumnos.facade.ts` (C).

## Notas para quien la reclame

- No asumir la opción: es una conversación de producto con el dueño, no un bug.
- Bloquea la parte de certificación y egreso del testing (`ASG-i-024`, `ASG-i-033`): esos casos
  no se pueden cerrar hasta decidir.
