# Fix: La certificación Clase B exige nota de evaluación en vez de clases completadas
> id: fix-262-m-certificacion-b-sin-requisito-nota
> refs: ASG-i-038, fix-115-m, fix-012-i
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

[Heredado de ASG-i-038, a confirmar]: en el piloto nadie puede poner la nota de evaluación
(`class_b_sessions.evaluation_grade`) porque el portal Instructor está bloqueado
(`pilot-phase.config.ts`), y `fix-115-m` prohíbe que admin/secretaría la escriban. Como la
certificación cuenta solo clases con nota, ningún alumno llega a 12/12: no hay certificado ni
egreso a Ex-Alumnos.

**Confirmado al reclamar (2026-10-01):** el requisito de nota **nunca fue una regla de negocio**,
fue un proxy de "clase cerrada":

1. `6bf63c8b` (2026-04-25) introdujo en `certificacion-clase-b.facade.ts` el conteo
   `evaluation_grade IS NOT NULL`. En ese momento el drawer de Finalizar Clase **exigía nota
   para cerrar** (`canFinalize()` pedía `selectedGrade() !== null`), así que "con nota" ≡ "cerrada".
2. `a95b53e0` (2026-08-01, gate H-025 en `generate-certificate-b-pdf`) y `fix-012-i`
   (2026-08-01, badge "Curso completo" en `admin-alumnos.facade.ts`) copiaron ese criterio
   "por coherencia con el facade".
3. `fix-115-m` (2026-08-05) hizo la nota opcional para cerrar una clase. Desde ahí el proxy dejó
   de ser válido, pero nadie revisó los tres lugares que lo usaban.

**Decisión del dueño (comunicada por Matías, 2026-10-01):** la nota de las clases prácticas B
**nunca** afecta la posibilidad de generar el certificado; lo único que cuenta es haber
completado las clases. Por eso este track es un fix y no una spec: no hace falta decidir entre
las opciones A–D de la ASG.

Sobre el cron de `no_show` (decisión relacionada que proponía la ASG): no hay nada que decidir.
La secretaria es siempre la responsable de iniciar y cerrar la clase; si no lo hace, queda
`no_show`. Fuera de alcance.

## ACs Afectados

Ninguno de una spec previa: el criterio de conteo lo introdujeron `fix-012-i` y el gate H-025.

- AC-1: `CertificacionClaseBFacade` cuenta como práctica completada toda clase con
  `status = 'completed'`, tenga o no `evaluation_grade`.
- AC-2: `AdminAlumnosFacade` (badge "Curso completo" / candidatos a egreso, `fix-012-i`) usa el
  mismo criterio que AC-1.
- AC-3: la Edge Function `generate-certificate-b-pdf` (gate H-025) cuenta clases
  `status = 'completed'`; un alumno con todas las prácticas cerradas sin nota puede certificarse
  sin `force`.
- AC-4: no queda ningún lugar del código que use `evaluation_grade` como condición para
  certificar o egresar.
- AC-5 (agregado 2026-10-01, hallazgo de Matías en la ficha): `AdminAlumnoDetalleFacade`
  (`progresoPractico`, que alimenta el botón "Generar Certificado (X/12)" y el % de progreso de la
  ficha) cuenta clases `status = 'completed'`, no asistencias "presente". Hoy un alumno con 12
  clases cerradas sin filas en `class_b_practice_attendance` muestra 0/12. Pasa con el seed
  `0008-i` y también en flujos reales: `markAttendance('presente')` escribe asistencia sin cerrar
  la clase, y el upsert de asistencia de `finishClass` no revisa si falló.

## Archivos involucrados

- `src/app/core/facades/certificacion-clase-b.facade.ts`
- `src/app/core/facades/admin-alumnos.facade.ts`
- `supabase/functions/generate-certificate-b-pdf/index.ts`
- `src/app/core/facades/admin-alumno-detalle.facade.ts` (AC-5)

## Cambios

- **`certificacion-clase-b.facade.ts`** (`fetchAlumnos`, step 3): el conteo de prácticas por
  matrícula pasa de `.not('evaluation_grade', 'is', null)` a `.eq('status', 'completed')`. (AC-1)
- **`admin-alumnos.facade.ts`** (`fetchCursoCompletoPendienteEgresoSet`, `fix-012-i`): mismo
  cambio de criterio y JSDoc actualizado. (AC-2)
- **`supabase/functions/generate-certificate-b-pdf/index.ts`** (gate H-025): mismo cambio. El
  comentario que decía "NO usar status='completed'" queda invertido y explica por qué. El
  bypass `force` de admin no cambia. (AC-3)
- **AC-4:** búsqueda de `evaluation_grade` en `src/` y `supabase/functions/` sin specs. Lo que
  queda son los flujos de evaluación del portal Instructor (`instructor-clases`,
  `instructor-alumnos`), el DTO y comentarios. Ninguno condiciona certificar o egresar. Las
  migraciones solo lo nombran en la tabla base y en el audit log.
- **`admin-alumno-detalle.facade.ts`** (`loadClaseBData`): `progresoPractico.completadas` ahora
  cuenta `class_b_sessions` con `status='completed'` (ya venían en `sessionResult`, sin query
  nueva) en vez de asistencias `present`. La rama Profesional (`STATUS_PRESENTE` sobre
  `professional_*_attendance`) no se toca: ahí la asistencia por alumno en una clase grupal sí
  es el criterio correcto. (AC-5)
- **`indices/DOMAIN-GOTCHAS.md`**: nueva entrada DG-095 (nota ≠ clase cerrada).
- Edge Function `generate-certificate-b-pdf` desplegada por Matías (2026-10-01).

## Test de Regresión

- `certificacion-clase-b.facade.spec.ts`: nuevo caso *"fix-262-m: cuenta clases cerradas
  (status=completed), nunca la nota de evaluación"*. Verifica `.eq('status','completed')`, que
  no se llama `.not()` y que 12 clases cerradas dan `clasesCompletadas = 12`.
- `admin-alumnos.facade.spec.ts`: el mock de `class_b_sessions` termina en `.eq()`. Nuevo caso
  equivalente al anterior, y el caso existente pasa a *"12 clases cerradas + certificado + email
  enviado"*.
- Ambos tests fallaron antes del cambio (3 rojos) y pasaron después: 50/50.
  `npx tsc --noEmit -p tsconfig.app.json` sin errores. `npm run lint:arch` sin errores nuevos
  (solo los warnings ARCH-11 que ya existían).
- `admin-alumno-detalle.facade.spec.ts`: nuevo caso *"fix-262-m: progresoPractico.completadas
  cuenta clases cerradas (status=completed), no asistencias"*. Usa 3 clases cerradas sin asistencia
  más 1 agendada con "presente" y espera 3. Falló con 1 antes del cambio y pasa después. Suite de
  los 3 facades: 100/100. tsc limpio. (AC-5)
- La Edge Function no tiene tests (runtime Deno). AC-3 se verifica a mano después del deploy:
  generar el certificado de un alumno con 12 clases `completed` sin nota, sin `force`.

## Progreso

- [x] AC-1, AC-2: facades + tests de regresión en verde (50/50)
- [x] AC-4: auditoría de usos de `evaluation_grade`
- [x] AC-5: `progresoPractico` de la ficha cuenta clases cerradas (100/100)
- [x] Desplegar la Edge Function `generate-certificate-b-pdf` (desplegada por Matías, 2026-10-01)
- [x] AC-5 visual: la ficha de `alumno.seed132@test-data.local` muestra "Generar Certificado" sin contador (verificado por Matías, 2026-10-01)
- [x] AC-3: certificado generado en la app para ese alumno (12 clases `completed` sin nota, sin `force`), verificado por Matías, 2026-10-01
- [x] `/fix-close`

## Notas

- Originado de Asignación ASG-i-038
  (specs/assignments/ASG-i-038-decision-nota-evaluacion-sin-portal-instructor.md).
- Desbloquea los casos de certificación y egreso de `ASG-i-024` y `ASG-i-033`.
- La regla de `fix-115-m` (solo el instructor evalúa) no cambia; este fix solo desacopla la
  nota de la certificación.
