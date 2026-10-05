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
| 3 | J–N | Promociones: lista, crear, editar, estados, cadencia automática, matrícula tardía |
| 4 | O–R | Libro de clases: selectores, secciones, código SENCE, PDF |
| 5 | T–U | Sedes, roles, RLS, tiempo real, visual |

Ajustes sobre el texto de la ASG, tras cruzar las sospechas con tracks ya existentes:

- **S1 y S2 (edge functions sin sesión) ya están corregidas en su parte de autorización** por
  `fix-043-i` (`ASG-i-041`): `generate-class-book-pdf` exige `requireStaff(['admin','secretary'])`
  y `auto-create-next-promotions` exige el claim `service_role`. Acá se ejecutan **como
  regresión** (R11, M06). Quedan abiertas, y se prueban acá, las partes que `fix-043-i` no tocó:
  - S1: el `upsert` del PDF vuelve a poner `class_book.status = 'active'` aunque estuviera `closed`.
  - S1: `requireStaff` valida rol pero no sede (`0009-i` dejó fuera, por decisión, validar la sede
    en el servidor) → una secretaria de otra sede puede generar el PDF de un curso ajeno.
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

- Los 7 módulos Profesional bloqueados por el recorte: solo se prueba que sigan bloqueados
  (`ASG-i-022`).
- La ficha del alumno en lo común con Clase B (`fix-264-m`, checklist `024b`).
- El wizard de matrícula por dentro (`ASG-i-023`).

## ACs Afectados

Ninguno propio — track de testing. Se verifican los ACs ya documentados en `0002-m`, `0005-i`,
`0017-m`, `0018-m` y `fix-098-m`.

## Decisiones de negocio pendientes

Salen de §5 del checklist. Bloquean el veredicto de los casos indicados (no el resto del testing).

| # | Caso | Pregunta | Decisión |
|---|---|---|---|
| D1 | I01 / I03 | ¿El botón "Pre-inscritos" de la Base Profesional se oculta en el piloto (como el resto del módulo)? | ⏳ |
| D2 | B02 / E07 | ¿Dónde se ven en el piloto los alumnos Profesional retirados o cancelados? | ⏳ |
| D3 | L11 / J08 | ¿Dónde se consultan las promociones finalizadas y sus alumnos (Ex-Alumnos Prof. está bloqueado)? ¿Se debe poder finalizar a mano? | ⏳ |
| D4 | L12 | ¿Qué pasa con los alumnos de una promoción cancelada? ¿Dónde se reasignan? ¿Hace falta un modal de confirmación? | ⏳ |
| D5 | K14 | ¿La secretaria puede crear, finalizar y cancelar promociones? | ⏳ |
| D6 | K02 / M08 | ¿Las promociones manuales siguen la cadencia de 14 días o pueden ir en cualquier lunes? ¿Deben nacer con código? | ⏳ |
| D7 | L08 | ¿Se permite repetir un código MTT? | ⏳ |
| D8 | G04 | ¿Archivar desde la Base Profesional debe archivar también a la persona en Clase B? | ⏳ |
| D9 | G09 / P04 | ¿Retirados, completados y archivados deben aparecer en el Libro de clases y en los conteos de la promoción? | ⏳ |
| D10 | B05 / D01 | Un alumno con 2 matrículas Profesional: ¿una fila o dos? ¿El total cuenta personas o matrículas? | ⏳ |
| D11 | C05 | ¿La columna "Promoción" muestra la promoción (nombre/código) o el curso? | ⏳ |
| D12 | S12 | Asistencia, módulos, nota y certificado salen siempre vacíos en el piloto (sus módulos están bloqueados). ¿Es aceptable? | ⏳ |

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
