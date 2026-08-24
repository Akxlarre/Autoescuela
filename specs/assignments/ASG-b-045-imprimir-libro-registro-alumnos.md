# Asignación ASG-b-045 — Imprimir lista de alumnos (réplica del libro de Registro de Alumnos)

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Poder imprimir lista de todos los alumnos para replicar libro de Registro de Alumnos."*

La autoescuela mantiene un **libro físico de Registro de Alumnos**. El cliente quiere poder
imprimir desde el sistema algo que lo replique, en vez de transcribir a mano.

## Preguntas abiertas (no bloqueante, pero define el formato)

1. **¿Qué columnas exactas tiene el libro físico, y en qué orden?** Pedir una foto o fotocopia
   de una página. Es un formato reglamentado o heredado — no inventarlo ni "mejorarlo".
2. ¿Se imprime todo el padrón o por período / por sede / por curso?
3. ¿Necesita numeración correlativa que coincida con la del libro físico?

## Alcance sugerido

- Vista imprimible (o export a PDF) del padrón de alumnos con las columnas del libro real.
- Filtro por sede — obligatorio, no opcional: un libro por sede.
- Respetar el orden y la numeración que use el libro físico.

## Referencias

- `indices/DATABASE.md` → `students`, `enrollments`, `users`
- El número de matrícula se genera con `get_next_enrollment_number(course_id)` — verificar si
  esa es la numeración que el libro físico usa, o si el libro lleva su propio correlativo.
- Ya hay generación de PDF en el proyecto (Edge Functions de certificado y contrato) — mirar
  esos antes de meter una librería nueva.

## Archivos involucrados (opcional, para detectar solapes)

- Sin declarar

## Notas para quien la reclame

- ⚠️ **Se solapa con ASG-b-049** (número de matrícula como dato principal): las dos giran en
  torno a que el número de matrícula, no el nombre, es el identificador que el cliente usa.
  Vale la pena mirarlas juntas.
- Este requerimiento existe porque hay una obligación de llevar el libro. Antes de definir el
  formato, confirmar si hay un formato **exigido por normativa** — si lo hay, ese manda sobre
  cualquier criterio de diseño.
