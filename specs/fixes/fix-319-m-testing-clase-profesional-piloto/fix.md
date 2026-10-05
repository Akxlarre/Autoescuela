# Fix: Testing — Clase Profesional en el piloto (Alumnos Profesional, Promociones, Libro de clases)
> id: fix-319-m-testing-clase-profesional-piloto
> refs: ASG-i-025
> status: in_progress
> created: 2026-10-05

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/025-clase-profesional-piloto.md`.

## Root Cause

[Heredado de ASG-i-025, a confirmar]: De Clase Profesional solo quedan visibles en el piloto
**Base de Alumnos Profesional**, **Promociones** (`fix-257-m`) y **Libro de clases** (`fix-260-m`);
el resto está bloqueado por `pilotPhaseGuard('clase-profesional-recorte')`. Hay que probar a fondo
lo visible y confirmar que no depende de pantallas ocultas para funcionar (por ejemplo, un botón
que navegue a un módulo bloqueado).

**Clasificación:** Integración · dificultad Alta · rutas:
`/app/admin/clase-profesional/{alumnos,promociones}`, `/app/admin/libro-de-clases`,
`/app/secretaria/profesional/{alumnos,promociones}`, `/app/secretaria/libro-de-clases`.

### Alcance confirmado al reclamar (Matías, 2026-10-05)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0002-m`, `0005-i`, `0017-m`, `0018-m` y `fix-098-m`.
2. **E2E manual** — los casos A…U del checklist (~250), incluidas las sospechas S1…S22, que salen
   de leer código y hay que confirmar o descartar en navegador.
3. **Playwright** — los casos "Auto ✓" van a la suite de `0019-m` (`e2e/`, `npm run test:e2e`).
   `ASG-i-021` ya está completada, así que esta capa no está bloqueada.

**Orden de ejecución por bloques** (el checklist es grande):

| Bloque | Secciones | Contenido |
|---|---|---|
| 1 | S1, S2 residuales | Seguridad de edge functions (ver abajo) — primero, por gravedad |
| 2 | A–I | Acceso y guards, Base Alumnos Profesional, Papelera, ficha, links a módulos bloqueados |
| 3 | J–N + Archivo | Promociones: lista, crear, editar, estados, cadencia automática, matrícula tardía; vista Archivo (D3a) |
| 4 | O–R | Libro de clases: selectores, secciones, código SENCE, PDF |
| 5 | T–U | Sedes, roles, RLS, tiempo real, visual |

Ajustes sobre el texto de la ASG, tras cruzar las sospechas con tracks ya existentes:

- **S1 y S2 (edge functions sin sesión) ya están corregidas en su parte de autorización** por
  `fix-043-i` (`ASG-i-041`): `generate-class-book-pdf` exige `requireStaff(['admin','secretary'])`
  y `auto-create-next-promotions` exige el claim `service_role`. Acá se ejecutan **como
  regresión** (R11, M06). Quedan abiertas, y se prueban acá, las partes que `fix-043-i` no tocó:
  - S1: el `upsert` del PDF vuelve a poner `class_book.status = 'active'` aunque estuviera `closed`.
  - S1: `requireStaff` valida rol pero no sede (`0009-i` dejó fuera, por decisión, validar la sede
    en el servidor) → una secretaria de otra sede puede generar el PDF de un curso ajeno (nombre y
    RUN de sus alumnos). **Corrección al checklist:** el PDF **no** incluye teléfono — la función
    lo consulta (`generate-class-book-pdf/index.ts:107,199`) pero nunca lo imprime; es un campo
    muerto que conviene dejar de pedir (minimización de datos).
  - S2: sin promoción `in_progress`, una sola llamada del cron crea hasta 10 planificadas, y una
    falla a mitad deja una promoción "placeholder" sin cursos.
- **S6 (RLS de promociones/cursos/libro sin sede) sigue abierta:** `0047-b` (`ASG-i-045`) dejó
  explícitamente fuera las tablas de Clase Profesional.
- **S13 (tiempo real muerto en Alumnos Profesional)** → `ASG-i-056` (canales que escuchan tablas
  no publicadas; incluye `enrollments`). Acá solo se confirma y se referencia.
- **Pendientes heredados de otros tracks que remiten a esta ASG:**
  - `fix-272-m` — la ficha abre la matrícula cliqueada; la Base Profesional no se cambió (relación
    directa con S17).
  - `fix-276-m` — la Papelera de la Base Profesional no se revisó.
  - `fix-277-m` — no archivar con clases futuras: las clases Profesional quedaron fuera.
  - `fix-287-m` — `app-ex-alumnos-profesional-content` tampoco distingue error de lista vacía
    (relación con S14; Ex-Alumnos Profesional está bloqueado en el piloto).
- **Casos solo en local/staging:** L11, L12, M06–M08 y R11. Finalizar una promoción pasa sus
  matrículas `active` a `completed` (S4) y desde la UI no se deshace.
- **Dependencia:** B09, N03 y N04 requieren matricular un alumno Profesional (`ASG-i-023`).
- **Decisiones de negocio** (§5 del checklist): no se marcan ✅/❌. Se listan abajo como
  pendientes.

### Fuera de alcance

- Los módulos Profesional bloqueados por el recorte: solo se prueba que sigan bloqueados
  (`ASG-i-022`). Excepción: Archivo, que se habilita por D3a.
- La ficha del alumno en lo común con Clase B (`fix-264-m`, checklist `024b`).
- El wizard de matrícula por dentro (`ASG-i-023`).

## ACs Afectados

Ninguno propio — track de testing. Se verifican los ACs ya documentados en `0002-m`, `0005-i`,
`0017-m`, `0018-m` y `fix-098-m`.

## Decisiones de negocio pendientes

Salen de §5 del checklist (+ D12, desde S12). **Todas resueltas por Matías el 2026-10-05.** Los
casos afectados se evalúan contra la decisión, no contra el comportamiento actual: si la app hace
otra cosa, es ❌ y va a su propio fix.

| # | Caso | Pregunta | Decisión |
|---|---|---|---|
| D1 | I01 / I03 / I04 | ¿El botón "Pre-inscritos" de la Base Profesional se oculta en el piloto? | ✅ **Se oculta** mientras Pre-inscritos esté bloqueado; la notificación de pre-inscripción (S21) tampoco debe llevar al módulo. I03 queda fuera de alcance. |
| D2 | B02 / E07 | ¿Dónde se ven los alumnos Profesional retirados o cancelados? | ✅ **En ningún lado, porque hoy no existen: se eliminan los filtros y estados imposibles.** Ningún flujo deja una matrícula Profesional en `inactive`, `withdrawn` ni `cancelled`: el único cambio de estado posterior a `active` es `active → completed` al finalizar la promoción (`20260820100000_fix196…sql`); la deserción por inasistencias y el vencimiento de pago online que escriben `cancelled` son de Clase B. Se quitan de la Base Profesional el filtro "Retirado", la etiqueta "Inactivo" y `'inactive'` de `ENROLLED_STATUSES`. *(Corregido el 2026-10-05: la primera versión de esta decisión pedía mostrar retirados, partiendo de que el estado existía.)* |
| D3a | J08 | ¿Dónde se consultan las promociones finalizadas y sus alumnos? | ✅ **En la vista Archivo, que se habilita en el piloto** (hoy bloqueada). Promociones queda para planificadas y en curso: su filtro **deja de ofrecer "Finalizada"**. **Archivo muestra de una promoción finalizada lo mismo que "Ver promoción"** (información general, alumnos por categoría, cursos con relatores y sus alumnos), **reutilizando el mismo componente** para que no diverjan. Lo académico que hoy tiene Archivo (asistencia teoría/práctica, notas M1–M7, promedio, KPIs de aprobación) queda como una sección adicional, **oculta mientras Asistencia y Evaluaciones sigan bloqueados**; la escala de notas se mantiene (no se migra a "concepto"). |
| D3b | L11 | ¿Se puede finalizar una promoción a mano? | ✅ **Sí, solo admin y con modal de confirmación** que avise cuántos alumnos pasan a completados. |
| D4 | L12 | ¿Qué pasa al cancelar una promoción con alumnos? | ✅ **Se bloquea** si tiene matrículas vigentes; solo se cancela una promoción sin alumnos. |
| D5 | K14 | ¿Qué puede hacer la secretaria con las promociones? | ✅ **Ver y editar datos operativos** (número, nombre…). Crear, finalizar y cancelar: **solo admin**. |
| D6 | K02 / M08 | ¿Las manuales siguen la cadencia de 14 días? ¿Nacen con número? | ✅ **Cualquier lunes, con número obligatorio al crear.** El cron debe saltar fechas ocupadas en vez de fallar, y su cadencia no debe correrse por una manual (hoy calcula fecha y número desde la última promoción con número). |
| D7 | L08 | ¿Se puede repetir el número de promoción ("código MTT")? | ✅ **No: único por sede**, validado en el formulario y con restricción de unicidad en BD. |
| D8 | G04 | ¿Archivar desde la Base Profesional archiva también en Clase B? | ✅ **Sí, se archiva la persona completa**, pero la confirmación debe avisar que tiene Clase B y saldrá también de esa base. |
| D9 | G09 / P04 | ¿Quiénes aparecen en el Libro y en los conteos de la promoción? | ✅ Solo hay dos casos reales (ver D2). **Completados: siguen en el Libro y cuentan** (el libro de una promoción terminada muestra a sus alumnos). **Archivados** (estado de la persona, `students.status = 'archived'`, con la matrícula aún `active`): **siguen en el Libro, sin columna de estado** (estuvieron en el curso: registro oficial; el PDF es réplica del libro físico, `0017-m`), pero **no cuentan como inscritos** en "Ver promoción". *(Corregido el 2026-10-05: la primera versión decía "con su estado visible"; el libro no muestra estados y no se agrega.)* |
| D10 | B05 / D01 | 2 matrículas Profesional: ¿una fila o dos? | ✅ **Una fila por matrícula** (como hoy). El KPI se rotula como matrículas. Revisar claves duplicadas en la vista tarjetas. |
| D11 | C05 | ¿Qué muestra la columna "Promoción"? | ✅ **Número/fecha de la promoción, con la categoría (A2/A3/A4/A5) debajo.** |
| D12 | S12 / C07 / C08 | Asistencia, módulos, nota y certificado vacíos en el piloto, ¿aceptable? | ✅ **Se ocultan en el piloto** (columnas de la Base y tarjetas/botón de la ficha) mientras sus módulos sigan bloqueados. |

**Pendiente de modelar, para hablar con el dueño (no bloquea este track):** el **desertor** de
Clase Profesional — alumno que abandona, vuelve tiempo después a pedir el certificado y el dueño lo
integra a una promoción posterior. Hoy no existe ni el estado ni el movimiento entre promociones;
cuando se modele, se define dónde se ve (y D2 se revisa).

**Efecto en el alcance:** D3a habilita la vista **Archivo** de Clase Profesional en el piloto, así
que pasa a ser parte del testing (bloque 3). Al revisarla apareció una sospecha nueva:

- **S23** (🟡 Baja-Media) — Archivo lista las promociones finalizadas **sin filtrar por sede**
  (`archivo-profesional.facade.ts:134-138`); solo la lista de alumnos filtra por sede (línea 212).

## Resultados

### Bloque 1 — Seguridad de edge functions (S1, S2 residuales)

_Pendiente._

### Bloque 2 — A–I: acceso, Base Alumnos Profesional, Papelera, ficha, links bloqueados

_Pendiente._

### Bloque 3 — J–N: Promociones

_Pendiente._

### Bloque 4 — O–R: Libro de clases

_Pendiente._

### Bloque 5 — T–U: sedes, roles, tiempo real, visual

_Pendiente._

## Bugs derivados

| Sospecha / caso | Track | Estado |
|---|---|---|
| — | — | — |

## Test de regresión

Los casos "Auto ✓" del checklist, automatizados en `e2e/` (suite de `0019-m`).
