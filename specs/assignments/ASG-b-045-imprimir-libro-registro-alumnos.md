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

## ⚠️ Actualización 2026-08-23 — llegaron las fotos, y esto NO es diseño: es cumplimiento

La foto que pedía la pregunta 1 llegó (vía el grill de `ASG-b-049`). Resultado: **la sospecha de
esta asignación estaba bien fundada — el formato está reglamentado.** Los documentos reales están
**timbrados por SEREMI Región de Ñuble, Ministerio de Transportes y Telecomunicaciones**. El
layout no lo elegimos: **se reproduce**.

> ⚠️ Las fotos contienen datos personales reales (nombres y RUT de alumnos). **No se versionan ni
> se transcriben** — Ley 21.719. Acá va solo la estructura de columnas.

### Pregunta 1 — RESUELTA. Son dos formularios distintos, no un "libro"

| Documento | Columnas del listado | Filas |
|---|---|---|
| **Formulario de Comunicación MTT** — Módulo Curso Conductor Profesional Clase A | `N°` · `APELLIDOS, NOMBRES` · `RUT` · `LICENCIA QUE POSTULA` | 15 |
| **Antecedentes de los Alumnos** (membrete de la escuela) | `N°` · `APELLIDOS, NOMBRE` · `RUN` · `NIVEL DE ESCOLARIDAD` · `TELÉFONO` · `FIRMA` | 25 |

El Formulario de Comunicación lleva además una cabecera obligatoria: N° Comunicación, fecha, RUT
ECP, razón social, RUT y nombre del representante legal, teléfonos, email, nombre del módulo,
horas del curso, fechas inicio/término, dirección de ejecución (sede, calle, número, ciudad,
comuna) y una grilla de **horario de clases Lunes→Domingo con DESDE/HASTA**.

**Hallazgos que cambian el alcance:**

- **El `N°` es un ordinal de fila del papel (1…15, 1…25), NO el número de matrícula.**
- **El número de matrícula no aparece en ninguno de los dos formularios.** El identificador
  reglamentado es el **RUT/RUN**, y el orden es **por apellido**.
- Existe además un **libro manuscrito histórico** (cuaderno cuadriculado, registros desde 2014)
  con columnas `Edad` · `F. Nac` · `Escolaridad` · `F. Inicio` · `F. Término` · `F. Examen` ·
  `Grado`. **📷 Falta la mitad izquierda de esa foto** — no sabemos si ahí van N° de matrícula,
  nombre y RUT. Pedirla.

### Pregunta 3 — sigue abierta, y es la misma que la D11 de ASG-b-049

*"¿Necesita numeración correlativa que coincida con la del libro físico?"* → El carnet real de la
escuela muestra un correlativo de 4 dígitos, serie alta, continua, sin prefijo ni marca de sede.
Nuestro `get_next_enrollment_number()` arranca en `0001` **y se reinicia por (sede × grupo)**.
Las dos series divergen desde la primera matrícula.

**Es la misma pregunta en dos asignaciones.** Resolverla **una sola vez**, en un solo lugar — ver
D11 en `specs/assignments/ASG-b-049-numero-matricula-dato-principal.md`. No preguntarle al cliente
lo mismo dos veces.

## Preguntas abiertas restantes

1. ~~¿Qué columnas exactas tiene el libro físico?~~ **RESUELTA** — ver arriba.
2. ¿Se imprime todo el padrón o por período / por sede / por curso?
3. ¿Numeración correlativa que coincida con el libro? → **unificada en D11 de `ASG-b-049`**.
4. 🆕 ¿El entregable es **reproducir los formularios MTT** (que ya vienen timbrados en papel) o
   **pre-llenarlos** para imprimir y llevar a timbrar? No es lo mismo.
5. 🆕 ¿Hay una versión oficial vigente de esos formularios publicada por el MTT contra la que
   validar el layout, en vez de copiar la foto?

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
- ~~Antes de definir el formato, confirmar si hay un formato **exigido por normativa**~~ →
  **CONFIRMADO (2026-08-23): sí lo hay.** Documentos timbrados por SEREMI Ñuble. La normativa
  manda sobre cualquier criterio de diseño. **Pasar por el skill `compliance-cl`** (DS 39 /
  normativa de escuelas de conductores) antes de diseñar nada.
- ⚠️ **El tipo sugerido `fix` y la prioridad P3 quedaron cortos.** Con formato reglamentado de por
  medio esto es una `spec`, no un fix cosmético. Reevaluar al reclamar.
