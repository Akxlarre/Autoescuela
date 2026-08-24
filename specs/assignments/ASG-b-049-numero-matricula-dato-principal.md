# Asignación ASG-b-049 — El número de matrícula debe ser más principal que el nombre del alumno

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** spec ⚠️ *(era `fix` — cambiado, ver D9)*
> **priority:** P2 ⚠️ *(era P3 — subido, ver D9)*
> **created:** 2026-07-28
> **created_by:** b
> **grilled:** 2026-08-23 (`/grill_me`, 11 preguntas — 10 cerradas, 1 bloqueante abierta)

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Número matrícula debe ser más principal que el nombre del alumno."*

El cliente identifica a los alumnos por **número de matrícula**, no por nombre. Hoy la interfaz
jerarquiza al revés.

---

## Evidencia física (2026-08-23)

El dueño aportó fotos de los artefactos reales. **Cambian la lectura de la anotación**: la
premisa "así figura en el libro físico" es media verdad, y la mitad falsa importa.

> ⚠️ Las fotos contienen **datos personales reales** (RUT y nombre de una alumna, y 7 alumnos
> del curso A-2 con sus RUT). **No se versionan en el repo** ni se transcriben: bajo Ley 21.719
> incorporar datos personales identificables a un artefacto versionado, sin base de licitud ni
> control de retención, es exactamente lo que el compliance del proyecto evita. Acá se documenta
> **estructura de columnas**, nunca contenido. Las imágenes quedan en la conversación de origen.

### Artefacto 1 — Carnet del alumno (documento propio de la escuela)

Membrete "CONDUCTORES CHILLÁN" + logo Chillán Capacita, dirección, fono, email. Contenido:

| Zona | Campos |
|---|---|
| Centro-superior | Fotografía del alumno |
| Izquierda, tipografía chica | `Nombres:` · `Apellidos:` · `C. Identidad:` · `INSTRUCTOR:` |
| **Derecha, recuadrado, tipografía grande** | etiqueta **`MATRICULA`** sobre el número, dentro de un **marco** |
| Pie | *"No olvide llevar consigo este carnet durante las clases prácticas"* · `CURSO CLASE B` |

**Aquí el número SÍ es protagonista** — y la forma en que lo es no es "va primero", es
**etiqueta + valor grande dentro de un recuadro, separado espacialmente** del bloque de identidad.

### Artefactos 2 y 3 — Formularios MTT (timbrados SEREMI Región de Ñuble)

Documentos **reglamentados**, con timbre del Ministerio de Transportes y Telecomunicaciones.

| Documento | Columnas del listado |
|---|---|
| **Formulario de Comunicación MTT** — Módulo Curso Conductor Profesional Clase A | `N°` · `APELLIDOS, NOMBRES` · `RUT` · `LICENCIA QUE POSTULA` (15 filas) |
| **Antecedentes de los Alumnos** | `N°` · `APELLIDOS, NOMBRE` · `RUN` · `NIVEL DE ESCOLARIDAD` · `TELÉFONO` · `FIRMA` (25 filas) |

El Formulario de Comunicación además lleva cabecera con: N° Comunicación, fecha, RUT ECP, razón
social, RUT y nombre del representante legal, teléfonos, email, nombre del módulo, horas del
curso, fecha inicio/término, dirección de ejecución (sede, calle, número, ciudad, comuna) y una
grilla de **horario de clases Lunes→Domingo con DESDE/HASTA**.

**En ninguno de los dos aparece el número de matrícula.** El `N°` es un **ordinal de fila del
papel** (1…15, 1…25), no la matrícula. En el mundo reglamentado el identificador es el **RUT** y
el orden es **por apellido**.

### Artefacto 4 — Libro manuscrito histórico (cuaderno cuadriculado, registros desde 2014)

Columnas visibles en la mitad fotografiada: `Edad` · `F. Nac` · `Escolaridad` · `F. Inicio` ·
`F. Término` · `F. Examen` · `Grado`. **La mitad izquierda quedó fuera de cuadro** — falta
confirmar si ahí van N° de matrícula, nombre y RUT.

### Conclusión de la evidencia

El número de matrícula manda en **las pantallas de gestión y en el carnet**, NO en los listados
que replican formularios MTT — ésos van por apellido y se identifican por RUT. La asignación
sigue siendo válida; su alcance se precisa.

---

## Decisiones tomadas (`/grill_me` 2026-08-23)

| # | Decisión | Fundamento |
|---|---|---|
| **D1** | **El número NO es único** → se muestra pelado y se desambigua por contexto; con sede "Todas", la sede acompaña como dato secundario. **No** se renumera la BD ni se inventa un prefijo. | `UNIQUE (number, branch_id, license_group)` en `20260312100001_*.sql`. Renumerar rompería la correspondencia con contratos ya emitidos. ✅ **Confirmada por D11 (2026-08-23):** la serie es por sede, no única → el número sí se repite entre sedes y el constraint modela algo real. |
| **D2** | En **listados de alumnos manda el nombre**. El número asciende a primario solo donde el contexto **ya es una matrícula** (ficha de matrícula, drawers, pagos, carnet). | El número identifica una *matrícula*, no una *persona*. `nroExpedientes` es un array por diseño: la spec `0006-m` decidió que el refuerzo Clase B **consuma número del mismo correlativo**, así que un alumno con refuerzo tiene 2 números indistinguibles entre sí. Ver `DG-029`. Fallback si el cliente insiste: encabezar con el más reciente (`sorted[0]`). |
| **D3** | **Rename de dominio a "Matrícula"**. El estado documental pasa a llamarse **"Documentos"**. | El carnet impreso por la escuela dice literal `MATRICULA`. Hoy el mismo dato se llama de 4 formas (`Expediente`, `Folio`, `Matrícula N°`, `#0042`) y **"Expediente" nombra dos cosas distintas en la misma tabla**: la columna del número (`alumnos-list-content:377,401-404`) y el estado documental (`:447,601`), con un filtro rotulado "Expediente" (`:173`) que filtra el estado, no la columna. |
| **D4** | "Más principal" = **orden + peso en listados** (`.item-title`, sin agrandar) **+ etiqueta/valor recuadrado en detalle** (`.micro-label` + `.kpi-value` en contenedor con borde). Orden por número por defecto en tablas **de matrículas** — nunca en las que replican formularios MTT, que van por apellido. | Es literalmente lo que hacen los dos artefactos físicos, cada uno en su contexto. ⚠️ *Corrección post-evidencia: el grill había descartado `.kpi-value`; el carnet muestra que en detalle es justamente el tratamiento correcto.* `.kpi-label` está **deprecada** (`fix-078-b`) → usar `.micro-label`. |
| **D5** | Alcance: **solo Admin + Secretaría**. Instructor y portal alumno quedan como están. Público entra solo por el rename ("Folio" → "Matrícula"). | El pedido es del dueño/secretaría sobre *su* forma de trabajar. El instructor identifica por cara y nombre dentro del auto; al alumno el número no lo identifica a él. |
| **D6** | **Excluir `/admin/alumnos/:id` y `/secretaria/alumnos/:id`** de este track. El requisito se escribe **dentro de `ASG-b-085`**. | `ASG-b-085` (pendiente, de `i`) reescribe esas 1654 líneas al patrón de tabs; el hero se reconstruye de cero. Tocarlo acá es churn garantizado + conflicto en el archivo más grande del repo. |
| **D7** | **Copiar solo en contextos de detalle** (ficha, drawer). No en filas de tabla. | "Seleccionable" ya funciona — no hay `select-none` en ningún render del número: es un no-requisito. Un ícono de copiar por fila choca de frente con `ASG-b-093` (áreas táctiles <44×44). Precedente único de clipboard: `media-upload-control.component.ts:205`. Condiciones: `data-llm-action`, feedback vía `ToastService` (nunca `MessageService`), área ≥44×44 desde el día uno. |
| **D8** | **El buscador global entra en este track**: matching por número + normalización de padding + sede visible cuando hay ambigüedad. | Sin esto el track es decoración: el flujo real es *leer el número → encontrar al alumno*. `fix-075-b` indexó alumnos/instructores pero `matches()` (`global-search.facade.ts:102-105`) solo compara nombre y RUT. Es barato: el branch admin filtra sobre `adminAlumnos.alumnos()`, que **ya trae `nroExpedientes`**; instructor ya trae `enrollmentNumber`. Cero queries nuevas. Padding: comparar sin ceros a la izquierda y exigir **match completo**, no `includes` — sobre 4 dígitos `includes` da falsos positivos constantes (`42` matchea `0420`, `142`, `4200`). |
| **D9** | Track = **`spec`**, no `fix`. Prioridad **P2**, no Baja. El rename va **primero y en commit propio**. | No hay AC previo violado: hay comportamiento nuevo. Forzar `fix` produce un track que miente (el AC Verifier y `/fix-close` esperan un test de regresión sobre un bug inexistente). El rename toca ~12 archivos de forma mecánica y es lo que más conflictúa con el trabajo en vuelo de `m` e `i` — aislado, el rebase de cualquiera es trivial. |
| **D10** | Se escribe el spec ahora; la foto era bloqueante para **implementar**, no para planificar. | Resuelto: la foto llegó el 2026-08-23. Ver "Evidencia física". |

---

## 🟡 D11 — RESPONDIDA PARCIALMENTE por el dueño (2026-08-23)

> Respuesta textual: *"es una serie por sede, son distintos y es como está en el código (…) eso
> se realizará después, en la sincronización cuando el software empiece la marcha blanca y
> empecemos desde el último que tienen"*.

| Pregunta del grill | Estado | Respuesta |
|---|---|---|
| 1. ¿Serie única para toda la escuela o una por sede? | ✅ **Respondida** | **Una por sede.** Son series distintas. |
| 2. ¿Distingue Clase B de Profesional? | 🟡 **A confirmar** | El dueño dijo "es como está en el código" pero con un *"no lo sé"* explícito. El código separa por (sede × grupo); **no tomarlo como confirmado por el cliente**. |
| 3. ¿Último número vigente de cada serie? | ⏸️ **Diferida a propósito** | Se resuelve **en la marcha blanca**, arrancando desde el último que tenga la escuela. |

**Consecuencias:**

- **D1 NO se cae, queda confirmada.** La serie no es única a nivel escuela, así que el número
  efectivamente se repite entre sedes: mostrarlo pelado y desambiguar por sede sigue siendo lo
  correcto, y `UNIQUE (number, branch_id, license_group)` **sí modela algo que existe** (con la
  reserva de la pregunta 2).
- **Queda elegida la opción (A)** — seed de continuidad: la app continúa la serie real desde el
  último número por sede. No se declara serie nueva.
- **D11 deja de ser bloqueante de D1.** El track puede avanzar completo.

⚠️ **Lo que sigue pendiente y NO es de este track:** la ejecución del empalme (opción A) en la
sincronización de marcha blanca. El mecanismo de `get_next_enrollment_number()` tiene dos trampas
que muerden exactamente en esa carga de datos —deriva el siguiente número de la **última fila
insertada** (`ORDER BY e.id DESC`), no del número más alto, y castea `::INT`, así que un número
heredado no numérico la hace fallar. Documentado en **`indices/DOMAIN-GOTCHAS.md` → DG-080**.

<details>
<summary>Enunciado original de D11 (se conserva por trazabilidad)</summary>

### Pregunta bloqueante — el correlativo real no es el nuestro

**El hallazgo más grande del grill, y no se ve sin la foto.**

`get_next_enrollment_number()` genera un correlativo que **arranca en `0001` y se reinicia por
cada (sede × grupo B/Profesional)**. El carnet real muestra un número de **4 dígitos, serie alta,
sin prefijo y sin marca de sede** — una serie histórica larga y continua.

Divergencia inmediata: matriculamos a alguien, la app dice `0042`, la secretaria escribe el
carnet… ¿pone `0042` o el siguiente de su serie real?

**Hay que investigar primero (no decidir a ciegas):**

1. ¿La serie es **una sola para toda la escuela**, o cada sede lleva la suya?
2. ¿Distingue Clase B de Profesional, o es continua entre ambos?
3. ¿Cuál es el último número vigente de cada serie?

**De eso depende si `UNIQUE (number, branch_id, license_group)` modela algo que existe.** Si la
serie real es única, ese constraint está modelando una realidad inventada y **D1 se cae entera**:
el número *sería* único y el problema de ambigüedad desaparece.

Opciones una vez respondido: **(A)** seed de continuidad — la app continúa la serie real desde el
último número por sede (migración + confirmación del último vigente); **(B)** serie nueva
declarada, el histórico vive solo en papel.

> **Recomendación: investigar (1-3), apuntar a (A), y sacarlo como asignación propia.** Es un
> asunto de **modelo de datos** con impacto en contratos y carnets ya emitidos — excede a
> ASG-b-049, que es de jerarquía visual. Queda como **bloqueante de D1**, no del resto del track.

</details>
>
> `ASG-b-045` ya tenía esta misma pregunta abierta ("¿Necesita numeración correlativa que coincida
> con la del libro físico?" + "verificar si esa es la numeración que el libro físico usa, o si el
> libro lleva su propio correlativo"). **Es la misma pregunta en dos asignaciones** → resolverla
> una vez, en un solo lugar.

---

## Alcance resultante

**Entra:**

- Rename de dominio `Expediente` → `Matrícula`; estado documental → `Documentos`. Incluye modelo
  `AlumnoExpediente` y signal `selectedExpediente`. Unifica también `Folio` (público) y
  `Matrícula N°` (portal alumno). **Commit propio, primero.**
- Inversión de jerarquía (orden + peso) en listados de matrículas de Admin/Secretaría.
- Tratamiento etiqueta/valor recuadrado en contextos de detalle (Admin/Secretaría).
- Orden por número por defecto en tablas de matrículas.
- Afordancia de copiar en contextos de detalle.
- Buscador global: matching por número, normalización de padding, desambiguación por sede.

**No entra:**

- `/admin/alumnos/:id` y `/secretaria/alumnos/:id` → van en `ASG-b-085` (D6).
- Portal instructor y portal alumno (D5).
- Listados que replican formularios MTT → por apellido, identificados por RUT (evidencia).
- El modelo de numeración → asignación propia (D11).

---

## Hallazgos derivados — candidatos a asignación nueva

1. ~~**Modelo de numeración de matrícula vs. serie real de la escuela** (D11). Bloqueante de D1.~~ ✅ **Respondida el 2026-08-23** (serie por sede; empalme por opción A en la marcha blanca). Ya no bloquea. Queda solo confirmar si distingue Clase B de Profesional.
   Resuelve también la pregunta 3 de `ASG-b-045`.
2. **🆕 Carnet del alumno imprimible.** Es un artefacto real que la escuela ya emite y **ningún
   track cubre**. Todos sus datos ya están en el sistema: foto, nombres, apellidos, RUT,
   **instructor**, matrícula, curso. Precedente de generación de PDF: Edge Functions de
   certificado y contrato.
3. **⚠️ `ASG-b-045` no es diseño, es cumplimiento.** Los formularios están **timbrados por SEREMI
   Región de Ñuble**: el layout no lo elegimos nosotros, se reproduce. Su nota original ("puede
   estar reglamentado") queda **confirmada**. Debería revisarse contra el skill `compliance-cl`
   (DS 39 / normativa de escuelas de conductores) antes de diseñar nada.
4. **📷 Falta la mitad izquierda del libro manuscrito** — no sabemos si ahí van N° de matrícula,
   nombre y RUT. (D11 ya respondida; esta sigue pendiente por su cuenta.)

---

## Archivos involucrados

- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` (rename + jerarquía + orden)
- `src/app/core/facades/global-search.facade.ts` (matching por número — D8)
- `src/app/core/facades/admin-alumnos.facade.ts` (modelo `AlumnoExpediente` → rename)
- `src/app/shared/components/matricula-steps/public-confirmation/` y `confirmation/` (rename `Folio`)
- `src/app/features/alumno/pagar/alumno-pagar-retorno.component.ts` (rename `Matrícula N°`)
- ⚠️ **NO**: `features/admin/alumnos/` ficha de detalle ni `features/secretaria/alumnos/` ficha → `ASG-b-085`

---

## Notas para quien la reclame

- **Leer la sección "Evidencia física" antes que nada.** Cambia la lectura de la anotación
  original: el número manda en gestión y carnet, no en los listados reglamentados.
- ~~**D11 bloquea D1, no el resto.**~~ ✅ **D11 respondida el 2026-08-23 — ya no bloquea nada.** Se puede avanzar rename, jerarquía, copiar y buscador sin
  esperar la respuesta del cliente.
- Se solapa con `ASG-b-024` (cerrada como `fix-075-b`): el buscador global quedó sin indexar el
  número — ese gap se cierra acá (D8).
- Se solapa con `ASG-b-045`: comparten la pregunta de numeración (D11) y el pedido de la foto.
  **No pedirle al cliente dos veces lo mismo.**
- Cierre: `/verify` en claro y oscuro **ya no alcanza solo** — D8 exige tests unitarios del
  matching (padding, match completo, desambiguación por sede).
