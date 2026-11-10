# Spec 0059-b — Las firmas de una clase práctica se guardan (no solo "se firmó")

> **Status:** draft
> **Created:** 2026-11-10
> **Owner:** Akxlarre
> **Priority:** P3 (las firmas son opcionales y hoy nadie las exige; es respaldo a futuro)
> **refs:** ASG-i-026 (caso K14 de `specs/testing-piloto/026-agenda-triple-match.md`, decidido en
> `fix-186-b` el 2026-11-10) · S15 del checklist 027 (`fix-366-m`, D05)

---

## 1. Contexto de negocio

Al cerrar una clase práctica (drawer "Finalizar" de Asistencia o del Dashboard, y el portal del
instructor), el alumno y el instructor pueden firmar en pantalla. Hoy la firma se dibuja pero **se
descarta**: en `class_b_sessions` solo queda `student_signature` / `instructor_signature` (`true` o
`false`) y `signature_timestamp`. Si mañana hay un reclamo ("esa clase no la hice"), la escuela no
tiene el trazo que muestre que el alumno sí firmó.

El owner decidió **guardar la imagen**, como respaldo. Las firmas siguen siendo **opcionales**.

## 2. Datos personales (Ley 21.719)

La imagen de una firma manuscrita es un **dato personal**. Guardarla obliga a:

- tener una finalidad declarada (respaldo de que la clase se realizó) y no usarla para otra cosa;
- guardarla **privada**, con acceso solo de quien la necesita;
- fijar **cuánto tiempo** se conserva y borrarla después;
- incluirla en el registro de actividades de tratamiento (skill `compliance-cl`).

## 3. User Stories

- Como **secretaria**, al cerrar una clase con firmas, quiero que queden guardadas para poder
  mostrarlas si el alumno reclama.
- Como **admin**, quiero ver las firmas en el detalle de una clase completada.

## 4. Acceptance Criteria (borrador)

- **AC1:** al cerrar una clase con una o dos firmas, cada imagen se guarda en un bucket **privado**
  de Storage y la clase guarda su ruta; `student_signature` / `instructor_signature` siguen en `true`.
- **AC2:** cerrar sin firmar funciona igual que hoy (sin imagen, booleanos en `false`).
- **AC3:** si subir la imagen falla, la clase **igual se cierra** y se avisa que la firma no quedó
  guardada (la firma no puede impedir cerrar una clase).
- **AC4:** el detalle de una clase completada (Agenda / Asistencia) muestra las firmas a admin y
  secretaria de la sede, con un enlace firmado de corta duración. Nadie más las lee (RLS de Storage).
- **AC5:** aplica igual al cierre desde el portal del instructor (hoy bloqueado en el piloto).
- **AC6:** las firmas se borran pasado el plazo de conservación (pregunta 2).

## 5. Out of scope

- Hacer obligatoria la firma.
- Firmas de clases ya cerradas (se descartaron; no se pueden recuperar).
- Firma electrónica avanzada o con validez legal certificada.

## 6. Preguntas abiertas (owner)

1. ¿Quién puede ver las firmas: admin y secretaria de la sede, o también el alumno las suyas?
2. ¿Cuánto tiempo se guardan? Propuesta: lo mismo que el resto del expediente del alumno.
3. ¿Bucket nuevo (`class-signatures`) o el privado `documents` que ya existe? Propuesta: uno nuevo,
   para que sus permisos y su borrado no se mezclen con los documentos del alumno.
