# Fix: Testing — Base de Alumnos Clase B, ficha del alumno y ex-alumnos
> id: fix-264-m-testing-base-alumnos-b-ficha-ex-alumnos
> refs: ASG-i-024
> status: in_progress
> created: 2026-10-01

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklists que se ejecutan:** `specs/testing-piloto/024a-base-alumnos-b.md` (lista, Papelera,
> exportaciones) y `specs/testing-piloto/024b-ficha-ex-alumnos.md` (ficha y Ex-Alumnos B).

## Root Cause

[Heredado de ASG-i-024, a confirmar]: La Base de Alumnos y la ficha son donde la secretaria opera
a diario sobre un alumno ya matriculado: consulta el progreso, reprograma clases, justifica
inasistencias, archiva, restaura y re-matricula. La ficha agrega datos de clases, pagos,
documentos y asistencia, así que es un buen detector de inconsistencias entre módulos.

**Clasificación:** Integración · dificultad Alta · rutas: `/app/{admin,secretaria}/alumnos`,
`/alumnos/:id`, `/ex-alumnos` (+ papelera).

### Alcance confirmado al reclamar (Matías, 2026-10-01)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0016-b`, `0006-i`, `0007-i`, `0038-b`, `fix-039-i`, `fix-040-i`.
2. **E2E manual** — los casos de `024a` y `024b`, incluidas las sospechas S1…S12 (`024a`) y
   S1…S20 (`024b`), que salen de leer código y hay que confirmar o descartar en navegador.
3. **Playwright** — los casos marcados "Auto ✓" se automatizan en la suite de `0019-m`
   (`e2e/`, `npm run test:e2e`). `ASG-i-021` ya está completada, así que esta capa no está
   bloqueada.

Ajustes sobre el texto de la ASG:

- **Sospechas que ya tienen asignación propia:** acá solo se confirman o descartan y se
  referencian; no se abre un fix duplicado.
  - Edge functions sin control de rol/sede (`024a` S1, S2; `024b` S2) → `ASG-i-041`, `ASG-i-042`.
    Ambas están completadas (`fix-043-i` y la spec `0009-i`): las funciones exigen un usuario real
    con rol de staff. `0009-i` dejó fuera, por decisión, validar la sede en el servidor.
  - Secretaria edita a cualquier usuario (`024b` S1) → `ASG-i-043`.
  - RLS por rol sin sede (`024a` P08; `024b` S03, S04) → `ASG-i-045`.
    Estado al 2026-10-04: `ASG-i-043` (`fix-179-b`) y `ASG-i-045` (`0047-b`) están completadas.
    Siguen pendientes `ASG-i-054` (fechas en UTC) y `ASG-i-056` (tiempo real).
  - Canales Realtime mudos (`024a` S5; `024b` S3) → `ASG-i-056`.
  - Fechas en UTC (`024a` S9; `024b` S17) → `ASG-i-054`.
- **Sospechas ya corregidas, se ejecutan como regresión:** `024b` S4 y S5 (`fix-263-m`) y la parte
  de la nota de `024b` S10 (`fix-262-m`). La decisión B05/O01 de `024b` ya está tomada: el estado
  de la ficha sale de la matrícula seleccionada.
- **Datos de prueba:** los casos que cambian estado (archivar, restaurar, marcar ex-alumno,
  reprogramar, justificar, editar perfil) usan **alumnos sembrados para este track**, con prefijo
  `E2E-`. Los datos del seed de `0008-i` solo se leen.
- **Decisiones de negocio** (§5 de ambos checklists): no se marcan ✅/❌. Se listan abajo como
  pendientes para que las defina el owner.

### Fuera de alcance

- Base de Alumnos Profesional → `ASG-i-025`.
- Inasistencias y penalización en detalle → `ASG-i-027`.

## ACs Afectados

Ninguno propio — track de testing. Se verifican los ACs ya documentados en `0016-b`, `0006-i`,
`0007-i`, `0038-b`, `fix-039-i` y `fix-040-i`.

## Datos de prueba usados

**Qué trae la BD de desarrollo (reconocimiento del 2026-10-01, solo lectura):** 205 alumnos, todos
con `students.status = 'active'`; sede 1 = 72, sede 2 = 133. Matrículas B: 129 activas, 16
`completed`; Profesional: 61. Cursos B: "Clase B", "Clase B SENCE" y "Refuerzo Clase B".
Documentos: solo `id_photo` (204) y una `hoja_vida_conductor`.

**Lo que el seed NO trae** y por eso se siembra: Docs Pendientes, Retirado, 2 matrículas B, solo
borrador, sin matrículas, archivado, nombres con tilde/ñ. No hay ninguna matrícula válida con
`expires_at` (ver S4).

Los alumnos de prueba **no quedan en la BD**: cada test crea el suyo con `createE2eAlumno()`
(`e2e/support/alumnos-seed.ts`, nombre `E2E-<caso>`, RUT en el rango 99.xxx.xxx) y lo borra al
terminar. Verificado después de cada corrida: 0 usuarios y 0 matrículas `E2E-`.

| Checklist | Dato | Alumno usado | Notas |
|---|---|---|---|
| 024a | D2 | seed (`AlumnoNN ApellidoNN` con `payment_status = pending`) + `E2E-PendPago` | |
| 024a | D3, D4, D8, D9, D10, D12, D14 | `E2E-DocsPend`, `E2E-Retirado`, `E2E-DosMatriculas`, `E2E-SoloBorrador`, `E2E-SinMatricula`, `E2E-Archivado`, `E2E-José Núñez… Peña…` | sembrados por el test |
| 024a | D5 | seed (16 matrículas B `completed`) + `E2E-Finalizado` | |
| 024a | D6 | seed (60 alumnos solo Profesional, todos en sede 2) | |
| 024a | D7 | seed: alumno #84 (sede 2) | único con B + Profesional |
| 024a | D15 | `E2E-SedeA` / `E2E-SedeB` | |
| 024a | D11, D13, D16 | — | sin datos: casos B06, C10, C11 pendientes |

## Resultados

Res.: ✅ pasa · ❌ falla (bug) · ⏸ pendiente de decisión o de datos · sin fila = aún no ejecutado.
"Auto" = cubierto por `e2e/alumnos-b-lista.spec.ts`; el resto se verificó a mano o por API.

### 024a — Base de Alumnos B (lista)

Primera pasada (2026-10-01): sospechas + casos automatizables.

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|
| A01 | ✅ | Auto. Admin carga sin errores de consola ni respuestas ≥400 | |
| A02 | ✅ | Auto. Secretaria carga limpio, solo su sede | |
| A03 | ✅ | Auto. La secretaria no llega a `/app/admin/alumnos` | |
| A08 | ❌ → ✅ | Auto. Con la carga fallida se ve "No se encontraron alumnos · Limpiar filtros" y KPIs en 0. **Corregido el 2026-10-01** | B5 → `hotfix-113-m` |
| B01 | ✅ | Auto. Docs Pendientes, Retirado, Pendiente Pago y sin matrícula aparecen | |
| B02 | ✅ | Auto. Matrícula `completed` no aparece | |
| B05 | ✅ | Auto. Solo borrador no aparece | |
| B07 | ✅ | Auto. Archivado no aparece en la lista normal | |
| C05 | ✅ | Auto. Con 2 matrículas B se ven los 2 números | |
| C09 | ✅ | Auto. Estado correcto en los 4 casos sembrados | |
| D01 | ✅ | Auto. Chip "N alumnos" = total del paginador | |
| D02 | ✅ | Auto. KPI Total = total del paginador | |
| D03 | ✅ | Decidido el 2026-10-01: "Activos" incluye Pendiente Pago y Docs Pendientes. **Aplicado el 2026-10-01** | `hotfix-118-m` |
| D04 | ❌ → ✅ | Auto. La deuda de la matrícula B más antigua no contaba en "Con deuda". **Corregido el 2026-10-01** | B8 → `fix-270-m` |
| D05 | ❌ → ✅ | El KPI era 0 por construcción: ninguna matrícula válida puede tener `expires_at`. **Se quitó el KPI el 2026-10-01** (decisión del owner) | B9 → `fix-271-m` |
| E01–E05 | ✅ | Auto. Nombre, apellidos, ambos órdenes, sin tilde/ñ, mayúsculas | |
| E06 | ❌ → ✅ | Auto. Solo encontraba el RUT escrito igual que está guardado (con puntos); fallaban `99123456-7`, `991234567` y `99123456`. **Corregido el 2026-10-01** | B2 → `fix-267-m` |
| E07 | ✅ | Auto. Nº de expediente | |
| E09 | ✅ | Auto. Ignora espacios al inicio y al final | |
| E10 | ✅ | Auto. Estado vacío con "Limpiar filtros" | |
| F03 | ❌ → ✅ | Auto. El filtro Curso solo ofrece "Clase B" y "Clase B SENCE"; existe el curso "Refuerzo Clase B". **Corregido el 2026-10-01** | B3 → `hotfix-114-m` |
| F09 | ✅ | Auto. "Limpiar filtros" vacía la búsqueda y devuelve el total | |
| G01 | ✅ | Auto. 10 filas por página, reporte "Mostrando 1 a 10 de N" | |
| H01 | ✅ | Auto. A 375 px, tarjetas sin scroll horizontal | |
| H04 | ✅ | Auto. "Cargar más" suma de a 6; al filtrar vuelve a 6 | |
| J07 | ⚠ | Por API (2026-10-01): la secretaria de la sede 1 recibe HTTP 200 + PDF de la matrícula 2674 (sede 2). **No es un bug abierto:** la sede no se valida en el servidor por decisión de la spec `0009-i` (Ignacio, 2026-10-01). El rol sí se valida | `ASG-i-042` (completada) |
| K02 | ✅ | Auto. La exportación a Excel responde 200 | |
| K04 | ❌ → ✅ | Auto. Pantalla 64 filas, Excel 72 (los 8 de más son "Finalizado"). **Corregido el 2026-10-02**: el Excel trae las filas de la pantalla | B1 → `fix-281-m` |
| K06 | ✅ | La exportación ya no calcula el estado: copia el de la pantalla, incluido "Docs Pendientes" (test unitario) | B1 → `fix-281-m` |
| K07 | ❌ → ✅ | La columna Expediente del Excel decía "Pendiente" en las 72 filas. **Corregido el 2026-10-02**: sale igual que la pantalla ("Parcial · 1/2") | B1 → `fix-281-m` |
| K09 | ❌ → ✅ | Auto. Desde la Papelera el Excel traía los activos. **Corregido el 2026-10-02** | B1 → `fix-281-m` |
| K11 | ⚠ | Por API (2026-10-01): la secretaria de la sede 1 obtenía 133 filas pidiendo la sede 2. La función `export-students` se eliminó (`hotfix-130-m`): la exportación ahora se arma con las filas de la pantalla. En las demás funciones, la sede no se valida en el servidor por decisión de la spec `0009-i` (Ignacio, 2026-10-01) | `ASG-i-042` (completada) |
| L01 | ✅ | Auto. Modal simple para alumno sin historial | |
| L02 | ✅ | Auto. Modal "con historial" sobre un alumno del seed | |
| L03 | ✅ | Auto. "borrar" no habilita; "borrarlo" sí | |
| L05 | ✅ | Auto. Cancelar cierra sin archivar | |
| L06 | ❌ → ✅ | Auto. Escape cierra el modal mientras dice "Archivando…"; el archivado termina igual. **Corregido el 2026-10-01** | B6 → `hotfix-111-m` |
| L08 | ✅ | Auto. El foco queda en el campo de texto | |
| M01 | ✅ | Auto. Archivar → Papelera → restaurar → vuelve a la lista | |
| M02 | ✅ | Auto. En la Papelera la fila solo tiene Restaurar | |
| M03 | ✅ | Auto. "← Alumnos" vuelve a la lista activa | |
| M04 | ❌ → ✅ | Auto. Papelera → Agenda → volver: se abre la Papelera, no la lista activa. **Corregido el 2026-10-01** | B4 → `hotfix-112-m` |
| M07 | ✅ | Auto. La secretaria no ve archivados de otra sede | |
| P01 | ✅ | Auto. Admin "Todas": columna Sede visible | |
| P02 | ✅ | Auto. Al cambiar de sede recarga sola y oculta la columna | |
| P04 | ✅ | Auto. Sede 1 + sede 2 = "Todas" | |
| P05 | ✅ | Auto. Secretaria sin grant: sin columna ni selector | |
| P06 | ❌ → ✅ | Auto. Secretaria multi-sede: al elegir otra sede la lista no cambia; en "Todas" no hay columna Sede. **Corregido el 2026-10-01** | B7 → `fix-269-m` |
| P08 | ✅ | Por API: la secretaria de la sede 1 lee 72 `students` y 73 `enrollments`, todos de su sede; 0 de la sede 2 | |
| Q01 | ❌ | Auto. Un alumno creado en otra sesión no aparece en 10 s sin recargar | B10 → `ASG-i-056` |

**Observación (H02):** a 1280 px de ancho (resolución de portátil común) la lista ya se muestra
como tarjetas: el contenedor de la tabla mide ~900 px y el corte está en `max-width: 900px`. A
1366 px se ve la tabla. No es un bug; queda anotado por si el owner quiere bajar el corte.

Segunda pasada (2026-10-02, admin, navegador con Playwright MCP). Para comprobar los filtros en
todas las páginas se exportó el Excel con cada filtro: desde `fix-281-m` trae las filas de la
pantalla.

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|
| A04 | ✅ | Al volver desde Agenda, Inicio o Pagos las filas aparecen en 0,8–1 s sin skeleton (SWR) | |
| A05 | ✅ | F5 carga normal | |
| A06 | ✅ | Menú → Base Alumnos B llega a `/app/admin/alumnos` | |
| A07 | ✅ | Con las consultas de la lista demoradas 3–5 s: skeleton con la forma de la tabla (KPIs, filtros, 8 columnas, acciones). Si toda la red está lenta, antes de eso la app entera queda gris mientras resuelve la sesión: es el arranque, no esta lista | |
| B03 | ✅ | Alumno solo-Profesional (RUT 25000001-4) no aparece | |
| B04 | ✅ | #84 (B + Profesional) aparece solo con su matrícula B 0008 | |
| B06 | ⏸ | Sin datos: `standalone_course_enrollments` vacía. El código los excluye (`admin-alumnos.facade.ts:451-457`) | |
| B08 | ✅ | Ordena por `students.id` descendente: el más nuevo primero | |
| B09 | ✅ | Cubierto por el E2E de `024b` O01 | |
| C01 | ✅ | Iniciales de nombre + apellido (CR, IS, SM) | |
| C02 | ✅ | "Apellidos Nombres" + email debajo | |
| C03 | ✅ | Por código: `users.maternal_last_name` es NOT NULL y "" se recorta con `trim()` | |
| C04 | ✅ | Con formato chileno en los alumnos reales; los del seed están guardados sin puntos y se muestran así. El RUT se partía en dos líneas a 1366 px (B23): corregido | B23 → `fix-294-m` |
| C06 | ✅ | Por código: sin número muestra "—" (`admin-alumnos.facade.ts:534`) | |
| C07 | ✅ | Badge "Clase B" / "Clase B SENCE" | |
| E11 | ❌ → ✅ | En la página 3, buscar deja la tabla en "Mostrando 21 a 10 de 10", vacía. Igual con filtros | B25 |
| F01 | ✅ | Clase B: 59 filas, todas "Clase B" | |
| F02 | ✅ | Clase B SENCE: 70 filas, todas SENCE | |
| F04 | ✅ (parcial) | Activo 111 y Pendiente Pago 18, todas con su estado; Retirado, Docs Pendientes, Pre-inscrito e Inactivo hoy sin datos (0 filas) | |
| F06 | ✅ (parcial) | Parcial 128, Pendiente 1; Completo sin datos | |
| F07 | ❌ → ✅ | La intersección es correcta (5 filas), pero la tabla queda en la página 3 y se ve vacía | B25 |
| F08 | ✅ | Cada selector tiene su opción "Todos…" (`0022-m`) | |
| G02 | ✅ | Última página "121 a 129 de 129" | |
| K01 | ❌ → ✅ | El menú "Exportar" no se cierra con Escape ni con un clic en el encabezado, la barra superior o el menú lateral; solo con un clic dentro del panel de la lista. **Corregido el 2026-10-04** | B26 → `fix-286-m` |
| K03 | ✅ | PDF de 6 páginas, "Total: 129 alumnos" | |
| K05 | ✅ | Cada Excel filtrado trae solo las filas del filtro (F01–F06) | |
| K08 | ✅ | "munoz camila" → la misma fila en pantalla y en el Excel | |
| K12 | ✅ | Tildes y ñ bien en el PDF de la lista | |
| K14 | ✅ | Deshabilitado con spinner, mismo ancho (138 px) | |
| K15 | ✅ | `export-table-pdf` con 500 → "No se pudo exportar la lista. Inténtalo de nuevo." | |
| J01 | ✅ | Spinner solo en esa fila → `Ficha_Matricula_2877_2026-10-03.pdf` (la fecha del nombre es UTC: a las 23:24 de Chile dice el día siguiente → `ASG-i-054`) | |
| J02 | ❌ → ✅ | El PDF de la ficha no tiene tildes ni ñ ("Reyes Munoz", "Telefono", "practicas"), el concepto del pago sale "enrollment" y la hora del pie "11:24 p.?m.". **Corregido el 2026-10-04** (función desplegada y PDF verificado desde la app) | B27 → `fix-293-m` |
| J05 | ✅ | Se descargan ambas; el spinner solo se ve en la última fila apretada | |
| J06 | ✅ | `generate-enrollment-sheet` con 500 → "No se pudo generar la ficha. Inténtalo de nuevo."; el spinner se apaga | |
| J03 | ✅ | #84 (B + Profesional) → `Ficha_Matricula_90`, su matrícula B | |
| B10 | ✅ | Por código: la lista ordena por `students.id` descendente, así que un alumno nuevo queda primero al recargar. Sin recargar depende del tiempo real (Q01) | |
| C08 | ✅ | Por código: `hotfix-123-m` formatea el día en hora local | |
| C10 | ✅ | Auto. 12/12 prácticas + certificado enviado → "Curso completo" con su tooltip | |
| C11 | ✅ | Auto. CI + foto → "Completo · 2/2"; CI + `foto_carnet` (legacy) también; solo CI → "Parcial · 1/2"; nada → "Pendiente · 0/2" | |
| C12 | ✅ | Auto. Tooltip "CI: Sí \| Foto: No \| Médico: No \| SEMEP: No" | |
| C13 | ✅ | Auto. Un nombre muy largo baja de línea y no invade la columna RUT | |
| D06 · N01–N04 | ✅ | No aplican: el KPI "Por Vencer" y su drawer se quitaron (`fix-271-m`) | |
| D07 | ✅ | Decidido "sin cambio": con el filtro SENCE la tabla tiene 70 filas y el KPI sigue en 129 | |
| D08 | ✅ | En la Papelera los KPIs cuentan archivados (0/0/0 con la Papelera vacía) | |
| F05 | ✅ | Auto. Pre-inscrito e Inactivo filtran bien (también Retirado y Docs Pendientes, que completan F04) | |
| F11 | ✅ | Los filtros son los mismos en la lista y en la Papelera: se arrastran al entrar y siguen al volver | |
| G04 | ✅ | 129 alumnos: filtros, búsqueda y exportación al instante | |
| G05 | ✅ | `bento-grid--fill-screen`: el documento no scrollea | |
| H02 | ✅ | Con "Nueva Matrícula" abierto el panel mide 631 px y la lista pasa a tarjetas | |
| H03 | ✅ | Nombre, email, estado, RUT, expediente, curso e ingreso. La tarjeta no muestra Nº de expediente ni sede (observación) | |
| H05 | ✅ | Ver ficha, ficha PDF y archivar, cada uno con su `data-llm-action` | |
| H06 | ✅ | Nombre y email truncados con tooltip | |
| H07 | ✅ | Botones de 48 × 32 px: usables, aunque menos de los 44 px de alto recomendados (observación) | |
| I03 | ✅ (parcial) | Al volver desde la ficha (enlace o botón atrás) se conservan filtros y orden; la página vuelve a la 1 → decisión pendiente | |
| K10 | ✅ | Admin sede A: 64 filas, todas de esa sede; "Todas": 129 con columna Sede | |
| L07 | ✅ | Al reabrir el modal el campo está vacío | |
| L10 | ✅ | Auto. Archivar deja un `UPDATE` de `students` en `audit_log` con el usuario | |
| L11 | ✅ | Por código: ni los facades contables ni las vistas SQL excluyen alumnos archivados | |
| L12 | ✅ | PATCH con 500 → "No se pudo archivar al alumno. Inténtalo de nuevo."; el alumno sigue en la lista | |
| L13 | ✅ (parcial) | Doble clic: un solo modal, pero la consulta previa se hace 2 veces (observación) | |
| M05 | ✅ | Auto. Búsqueda y filtro de estado dentro de la Papelera | |
| M06 | ❌ → ✅ | La Papelera vacía y sin filtros dice "No se encontraron alumnos · Intenta ajustar los criterios de búsqueda o filtros · Limpiar filtros". **Corregido el 2026-10-04**: dice "No hay alumnos archivados", sin botón | B28 → `fix-285-m` |
| M09 | ✅ | Auto. Si restaurar falla: toast "No se pudo…" y el alumno sigue en la Papelera | |
| O01 | ✅ | Wizard en drawer; la tabla pasa a tarjetas | |
| P03 | ✅ | A → B → A con la red demorada: termina en A, 64 filas, todas de A | |
| Q02–Q04 · Q06 | → | Mismo canal que Q01, que no llega. **Traspasados a `ASG-i-056`** (2026-10-04): se ejecutan allá | → `ASG-i-056` |
| Q05 | ✅ | Al salir se manda `phx_leave` de `alumnos-listado-realtime` | |
| R01 | ✅ | Modo oscuro con el botón de la app: todo legible (con el atributo `data-mode` puesto a mano, sin `ThemeService`, el selector de curso y la cabecera se ven mal; no es un caso real) | |
| R02 | ✅ | Sin scroll horizontal del documento a 375, 768 y 1440 px (la tabla sí, ver B23) | |
| R03 | ✅ | Con Tab se recorren todos los controles en orden; botones con contorno y selectores con borde de foco | |
| R04 | ✅ | Todos los botones de solo ícono tienen tooltip, salvo el paginador, que además está en inglés ("First Page", "Next Page") (observación) | |
| R05 | ✅ | Entrada sin parpadeos | |

**K13 (2026-10-04):** ✅ Auto + revisión del archivo. El PDF de la lista se genera con un nombre de unos 90 caracteres: se recorta con "…" dentro de su columna y no invade el RUT.

**Aún sin ejecutar de `024a`:** O02–O04 (necesitan completar el
wizard de matrícula) · P07 (no hay una cuenta de secretaria sin sede).

**Observaciones de la 2ª pasada (no son bugs, para que el owner decida):**

- **I03:** al volver desde la ficha se conservan filtros y orden, pero no la página. → Decidido
  (Matías, 2026-10-03): conservarla también. ✅ `fix-282-m`.
- **H03:** la tarjeta no muestra Nº de expediente ni sede. → Decidido: debe mostrarlos, en especial
  el Nº de matrícula. ✅ `hotfix-132-m` (también en la tarjeta de Alumnos Profesional).
- **L13:** doble clic en el tacho hace dos veces la consulta previa (un solo modal).
- **J05:** con dos fichas PDF pedidas seguidas, el spinner solo se ve en la última.
- **R04:** el paginador de PrimeNG está en inglés (las etiquetas para lectores de pantalla:
  "First Page", "Next Page"…). → Decidido: todo en español. ✅ `hotfix-131-m` (todos los textos
  `aria` de PrimeNG, en todas las tablas).
- **Tabla:** el botón de ficha PDF no tiene `data-llm-action` (sí lo tiene en la tarjeta).
- **Drawer de Nueva Matrícula:** si se achica la ventana con el drawer abierto se queda en 720 px
  y la X queda fuera de la pantalla; abierto ya en 375 px se ve bien.

### 024b — Ficha del alumno y Ex-Alumnos B

Primera pasada (2026-10-01). "Auto" = `e2e/alumnos-b-ficha.spec.ts`.

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|
| A01 | ✅ | Auto. Admin abre la ficha desde la lista; consola y red limpias | |
| A02 | ✅ | Auto. Igual para secretaria, en `/app/secretaria/alumnos/:id` | |
| A03 | ✅ | Auto. Secretaria sede 1 con la URL de un alumno de la sede 2: tarjeta de error, sin nombre ni RUT. Ya no aparece "(PGRST116)" | |
| A04 | ❌ → ✅ | Auto. Id inexistente: el detalle dice "Error al cargar la ficha del alumno" (repite el título, no dice que no existe). **Corregido el 2026-10-01** | B11 → `hotfix-116-m` |
| A05 | ❌ → ✅ | Auto. Tras una ficha con error, volver a abrir la ficha anterior sigue mostrando el error. Solo se reproduce con navegación interna (sin recargar). **Corregido el 2026-10-01** | B12 → `hotfix-116-m` |
| A06 | ❌ → ✅ | Auto. `/alumnos/abc` queda en "Cargando…" para siempre. **Corregido el 2026-10-01** | B13 → `hotfix-116-m` |
| A09 | ✅ | Auto. La secretaria no entra por la ruta del portal admin | |
| A13 | ✅ | Auto. "Volver" regresa a la lista de origen (Base y Ex-Alumnos) | |
| B01 | ✅ | Auto. Título y "Curso · Matrícula #N" | |
| B05 | ✅ | Auto. "Activo" / "Egresado" en español (regresión de `fix-263-m`) | |
| B08 | ❌ | Auto. Fecha de ingreso en formato `2026-10-01`; se espera `dd-mm-aaaa` | B14 |
| B10 | ✅ | Auto. Carnet, Certificado, Inasistencias, Ficha Técnica, Consentimientos y Reagendamientos, cada una con `data-llm-action` | |
| B11 | ✅ | Auto. Cabecera con "Editar Perfil" y "Eliminar Alumno" | |
| C01 | ✅ | Auto. Con 1 matrícula no hay selector | |
| C02 | ❌ → ✅ | Auto. El borrador ya no aparece en el selector (✅ `fix-263-m`), pero si era el más reciente la ficha lo mostraba como matrícula principal. **Corregido el 2026-10-01** | B15 → `fix-265-m` |
| C03 | ✅ | Auto. Cambiar de matrícula cambia número, estado y cantidad de clases | |
| C04 | ❌ → ✅ | Auto. Tras guardar un cambio, la ficha volvía a la matrícula más reciente. **Corregido el 2026-10-01** | B21 → `fix-265-m` |
| D06 | ✅ | Auto. Refuerzo: "N de 6"; Clase B: "N de 12" | |
| M01 | ✅ | Auto. Formulario precargado | |
| M02 | ❌ → ✅ | Auto. Email de otro usuario: "Ha ocurrido un error inesperado. Por favor, intenta de nuevo." El email no cambia. **Corregido el 2026-10-01** | B17 → `fix-268-m` |
| M03 | ✅ | Auto. Nombre y teléfono se guardan y la ficha los refleja | |
| M04 | ❌ → ✅ | Auto. El 2026-10-01 la secretaria de la sede 1 cambió por API el nombre de un alumno `E2E-` de la sede 2. **Corregido el mismo día en `fix-179-b`** (`ASG-i-043`, completada): la función valida a quién se edita. El test M04 pasa desde entonces. No se probó acá contra un admin o instructor reales; `fix-179-b` lo cubre en su propio alcance | `ASG-i-043` → `fix-179-b` |
| M06 | ✅ | Auto. Nombre vacío deshabilita "Guardar Cambios" | |
| M07 | ✅ | Auto. "Ingresa un email válido" | |
| O01 | ✅ | Auto. Tras marcar, la ficha dice "Egresado", el botón desaparece, sale de la Base y entra a Ex-Alumnos (regresión de `fix-263-m`) | |
| O02 | ✅ | Auto. Sin certificado enviado, el botón no aparece | |
| O03 | ✅ | Auto. Cancelar la confirmación no cambia nada | |
| O04 | ❌ → ✅ | Auto. Matrícula con último cambio en 2024, marcada hoy: Ex-Alumnos mostraba el año 2024. **Corregido el 2026-10-01** | B16 → `fix-266-m` |
| P01 | ✅ | Auto. "Eliminar Alumno" abre el mismo modal de archivar | |
| P02 | ✅ | Auto. Archiva, muestra el toast y vuelve a la lista, sin errores en consola | |
| S04 | ✅ | Por API: la secretaria de la sede 1 no puede cambiar el estado de una matrícula de la sede 2, ni archivar a un alumno de la sede 2 (0 filas) | |
| T01 | ✅ | Auto. Admin y secretaria cargan Ex-Alumnos sin errores | |
| T06 | ✅ | Auto (parcial). Egresado con saldo 0 → "Al día". Falta el caso "Debe $X" | |
| T10 | ✅ | Auto. "Ver ficha" desde la tabla y "Volver" regresan a Ex-Alumnos B | |
| U03 | ✅ | Auto. La búsqueda encuentra a un egresado fuera del período | |
| U04 | ✅ | Auto. Nombre + apellido, sin tilde, Nº de expediente y RUT con y sin puntos (este último desde `fix-267-m`) | |
| V01 | ✅ | Auto. A 375 px, tarjetas sin scroll horizontal | |
| V02 | ❌ → ✅ | Auto. "Ver ficha" desde una tarjeta y "Volver" lleva a la Base de Alumnos. **Corregido el 2026-10-01** | B20 → `hotfix-115-m` |
| W01 | ✅ | Auto (parcial). Continuar abre "Nueva Matrícula" con `?rut=`. Falta verificar los campos precargados | |
| W02 | ✅ | Auto. Cancelar no abre nada ni cambia la URL | |

Segunda pasada (2026-10-02). Ficha de referencia: alumno 2815 del seed (matrícula 0018: 5 clases
completadas, 2 inasistencias, 5 canceladas, saldo $90.000), solo lectura. Lo que cambia estado, con
alumnos `E2E-` ("Auto" = `e2e/alumnos-b-ficha.spec.ts`, bloque "segunda pasada").

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|
| A07 | ✅ | Alumno solo-Profesional por `/app/admin/alumnos/2746`: vista Profesional y "Volver" a Alumnos Profesional | |
| A08 | ✅ | Decidido en `fix-276-m` (un archivado solo se ve en la Papelera) | |
| A10 | ✅ | F5 recarga la misma ficha | |
| A11 | ✅ | Ficha A → lista → ficha B: skeleton y luego B, nunca datos de A | |
| A12 | ✅ | Volver a la misma ficha: sin skeleton | |
| A14 | ✅ | Con las consultas demoradas 3 s: skeleton de 3 columnas con la forma final | |
| B02 | ✅ | Por código: `maternal_last_name` es NOT NULL | |
| B03 | ✅ | Nombre truncado ("Alumno70 Apellido70 Ma…") con tooltip completo | |
| B04 | ✅ | RUT tal como está guardado | |
| B09 | ✅ | Decidido y hecho en `fix-273-m` | |
| C05 · C06 | ✅ | Decididos y hechos en `fix-272-m` / `hotfix-120-m` | |
| D01 · D02 · D04 · D10 | ✅ | Completadas en verde, inasistencias en rojo, canceladas en ámbar; "5 de 12", 42 %, "5 OK" + "7 pendientes" = 12 | |
| D07 | ✅ | La clase #8 de las 08:30 muestra 08:30 | |
| D08 | ✅ | `dd-mm` sin año; el curso de ejemplo no cruza de año (observación para cursos de diciembre a enero) | |
| E01 | ✅ | Drawer con 12 filas: tema, fecha y hora, instructor, km, observaciones, validación, acción | |
| E04 | ✅ | Lápiz solo en las 7 clases no completadas | |
| E05 | ❌ → ✅ | Abre el PDF en otra pestaña con los mismos datos, pero las 5 clases completadas dicen "Pendiente de sesión" en Observaciones y la columna "Val." queda cortada en el borde. **Corregido el 2026-10-04** (función desplegada y PDF verificado desde la app). La columna "Val." no estaba cortada en el PDF: era el visor | B30 → `fix-292-m` |
| E06 | ❌ → ✅ | Dos clics rápidos → 2 llamadas a `generate-ficha-tecnica-pdf` y 2 pestañas (el botón se deshabilita recién después del primero). **Corregido el 2026-10-04** | B30 → `fix-292-m` |
| E07 | ✅ | Con 500 → "No se pudo generar la Ficha Técnica. Inténtalo de nuevo." y el botón vuelve | |
| E08 | ❌ → ✅ | A 1600 px el drawer mide 720 px y la tabla 904: Validación y Acción (el lápiz de reprogramar) solo se ven con scroll horizontal. **Corregido el 2026-10-04**: en el drawer se ven las tarjetas | B29 → `fix-290-m` |
| F04 · F11 · F13 | ✅ | Auto, ya cubiertos por `fix-279-m` | |
| G01 | ✅ | "Reagendar Clases (7)" = 2 inasistencias + 5 canceladas | |
| H01 | ✅ | El drawer lista las 2 inasistencias con "Justificar" | |
| H02 · H03 · H04 · H09 | ✅ | Auto. Motivo vacío o solo espacios deshabilita Guardar; X y Cancelar no guardan; doble clic → un solo PATCH; "Ver motivo" y "Inasistencia — Justificada" siguen tras F5 | |
| H06 | ✅ | Auto, `hotfix-128-m` | |
| H07 | ✅ | Auto. Si el PATCH falla: toast y sigue con "Justificar" | |
| I01 · I02 | ✅ | $90.000 pagado y $90.000 de saldo; pago con fecha, método, monto y estado. Muestra "Pago #1" en vez del concepto (observación) | |
| I06 · I08 | ✅ | Auto, `fix-278-m` | |
| J01 | ✅ | Menú Carnet: "Generar" 6/12 habilitados, "Ver" deshabilitados | |
| L01 | ✅ | Por código: la secretaria con < 12 clases tiene el botón deshabilitado | |
| L03 | ❌ → ✅ | Por código: el admin confirma "generar de todas formas" pero se llama a `generarCertificado(enrollmentId)` sin `force` (`admin-alumno-detalle.component.ts:1815`) y la función lo rechaza (S10). **Corregido el 2026-10-04** | B34 → `fix-289-m` |
| M09 · M15 | ✅ | Auto. El email en mayúsculas queda en minúsculas; cancelar y reabrir muestra los datos originales | |
| N02 | ✅ | "Sin consentimientos registrados" con explicación | |
| N03 | ✅ | Con la consulta en 500: "No se pudieron cargar los consentimientos… Reintenta" | |
| N06 | ✅ | "Sin reagendamientos registrados" | |
| O05 | ✅ | Auto, `hotfix-125-m` | |
| O06 · O07 | ✅ | Auto. Doble clic al confirmar → un solo PATCH y un solo toast; si falla, toast y sigue "Activo" | |
| P03 | ✅ | Auto. Si archivar falla: "No se pudo archivar al alumno…" y sigue en la ficha | |
| P04 · P05 | ✅ | Decididos (`fix-276-m` / sin cambio) | |
| Q01–Q03 | ✅ | Decididos: no se agregan | |
| R01–R03 | → | Mismo problema de canal que `024b` S3. **Traspasados a `ASG-i-056`** (2026-10-04): se ejecutan allá | → `ASG-i-056` |
| R04 | ✅ | Al salir se manda `phx_leave` de `alumno-detalle-<id>` | |
| S03 | ✅ | Auto. Por API, la secretaria A actualiza 0 filas de una inasistencia de la sede B | |
| T02 | ✅ | Solo matrículas B `completed` (16); el egresado Profesional #84 no aparece | |
| T03 · T04 · T07 · T11 · T14 | ✅ | Decididos y aplicados (ver tabla de decisiones) | |
| T05 | ✅ | Alumno, RUT, Nº Exp., Licencia, Año / Sede, Estado cuenta, Acciones | |
| T08 | ✅ | Del egreso más reciente al más antiguo (todos de 2026 en los datos) | |
| T09 | ✅ | "Mostrando 1 a 10 de 16" | |
| T12 | ✅ | Al volver: sin skeleton | |
| T13 | ❌ → ✅ | Con la carga en 500: "0 Egresados", KPIs en 0 y "No se encontraron egresados · Intenta ajustar los criterios…". **Corregido el 2026-10-04** | B32 → `fix-287-m` |
| U01 · U02 · U05 | ✅ | "Últimos 12 meses" por defecto; opciones "Todo el historial" y los años de los datos; "Limpiar filtros" vuelve a ese estado | |
| U06 | ✅ | Auto, O04 (`fix-266-m`) | |
| V03 | ✅ | "Cargar más (10 restantes)": 6 → 12 | |
| V04 | ❌ → ✅ | Buscar después de "Cargar más" deja 12 tarjetas (la Base B vuelve a 6) | B25 |
| V05 | ✅ | La tarjeta tiene "Ver ficha" y "Re-matricular" | |
| W05 | ✅ | Auto, `fix-274-m` | |
| X01–X05 | ✅ | Decidido no ejecutarlos (sin datos que los alimenten) | |
| Y01 · Y02 | ✅ | A → B → A con la red demorada: 8 egresados, todos de la sede A | |
| Y04 | ❌ → ✅ | Auto. La secretaria multi-sede elige la sede B y la lista no se recarga (sigue el egresado de A). La pantalla de secretaria no tiene el `effect()` de sede (el mismo B7 de la Base). **Corregido el 2026-10-04** | B33 → `fix-288-m` |
| Z01 | ✅ | Modo oscuro (botón de la app): tarjetas, badges y drawers legibles | |
| Z02 | ✅ | 3 columnas a 1600 px | |
| Z03 | ✅ | Con un drawer abierto las columnas se apilan sin solaparse | |
| Z04 | ✅ | 375 y 768 px: scroll nativo, sin scroll horizontal. A 768 px el nombre de la cabecera quedaba "Alum Ap…". **Corregido el 2026-10-04**: las acciones bajan de línea y el nombre se lee entero | B31 → `fix-291-m` |
| Z06 | ❌ → ✅ | Auto. El modal de re-matricular interpreta el nombre como HTML: `<i>cursiva</i>` se ve en cursiva y sin las etiquetas. Angular quita scripts, así que es inyección de HTML, no de código. Mismo patrón en los 4 componentes de re-matricular (B y Profesional, admin y secretaria). **Corregido el 2026-10-04** | B35 → `fix-284-m` |

Tercera pasada (2026-10-04), primer lote. "Auto" = bloque "tercera pasada" de
`e2e/alumnos-b-ficha.spec.ts`, con alumnos `E2E-`.

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|
| B06 | ✅ | Auto. Un correo de unos 45 caracteres no se sale de su tarjeta | |
| B07 | ✅ | Auto. Sin teléfono se muestra "—" | |
| D03 | ✅ | Auto. Con 1 de 12 clases (8 %) la barra no lleva texto dentro ni se desborda | |
| D05 | ✅ | Cubierto por H09 de la 2ª pasada ("Inasistencia — Justificada" tras recargar) | |
| E02 | ✅ | Auto. La tarjeta de la clase muestra "125.430 km · Fin: 125.462 km" y la observación registrada | |
| E03 | ❌ → ✅ | Auto. Punto de color solo donde hay firma, pero en las tarjetas no tenía texto al pasar el mouse (la tabla sí). **Corregido el 2026-10-04** | B38 → `hotfix-136-m` |
| G02 | ✅ | Auto. Sin clases pendientes de reagendar no hay botón "Reagendar Clases" | |
| I03 | ✅ | Auto. Sin pagos: "No hay pagos registrados" | |
| K02 | ✅ | Auto. Matrícula presencial sin contrato: no hay botón de contrato | |
| L03 | ✅ | Por test unitario (`fix-289-m`): el admin confirma y el pedido va con `force`. No se generó un certificado real | |
| M05 | ✅ | Auto (`fix-296-m`): con el correo sin guardar el botón de invitación queda deshabilitado, con aviso | |
| U07 | ❌ → ✅ | Auto. Un egreso del 31-12-2025 a las 23:30 mostraba el año 2025 pero el filtro de período lo trataba como 2026. **Corregido el 2026-10-04** | B37 → `fix-297-m` |
| J09 | ❌ → ✅ | Auto. El menú de Carnet se cerraba con un clic fuera, pero no con Escape. **Corregido el 2026-10-04** | B40 → `hotfix-138-m` |
| M14 | ❌ → ✅ | Auto. Doble clic en "Guardar Cambios" enviaba dos guardados. **Corregido el 2026-10-04** | B39 → `hotfix-137-m` |
| M16 | ✅ | Auto. El cambio de perfil deja un `UPDATE` de `users` en `audit_log`, con el usuario | |
| S01 | ✅ | Auto. El admin abre fichas de alumnos de las dos sedes | |
| S02 | ✅ | Auto. La secretaria con las dos sedes abre una ficha de la otra sede | |
| C07 | ✅ | Auto. Con un panel abierto, el selector de matrículas sigue a la vista y no queda debajo del panel | |
| D09 | ✅ | Auto. Una clase cerrada mientras se está en otra pantalla aparece completada al volver a la ficha (sin recargar la app) | |
| H05 | ✅ | Auto. Un motivo de 40 líneas se lee con scroll dentro del modal; "Cerrar" queda a la vista | |
| I04 | ✅ | Auto. Un pago pendiente dice "Pendiente" y uno anulado "Cancelado"; ninguno sale como "Pagado" | |
| I05 | ✅ | Auto. Con 14 pagos la lista scrollea por dentro y la página no crece | |
| I07 | ✅ | Auto. Un pago registrado mientras se está en otra pantalla aparece al volver a la ficha | |
| N01 | ✅ | Auto, solo lectura sobre un alumno real con consentimientos: tipo, estado, fecha, origen, versión e IP | |
| N05 | ✅ | Auto. La secretaria no ve "Registrar revocación"; el admin sí, en cada consentimiento otorgado | |
| N07 | ❌ → ✅ | Auto. Con dos matrículas, el panel de reagendamientos seguía mostrando el de la matrícula con la que se abrió la ficha. **Corregido el 2026-10-04** | B41 → `fix-298-m` |
| N08 | ✅ | Auto. Tras ver un alumno con reagendamientos, la ficha de otro sin ninguno muestra el panel vacío | |
| E09 | ✅ | Auto. Tras reprogramar una clase con inasistencia, la Ficha Técnica ya no la muestra como inasistencia y se puede volver a mover | |
| F07 | ❌ → ✅ | Auto. Con la clase #2 del alumno a las 08:30 con un instructor, las 08:30 de otro instructor se ofrecían para la clase #1 (S20). **Corregido el 2026-10-04** | B42 → `fix-299-m` |
| F08 | ✅ | Por test unitario (`fix-300-m`): un día con 2 clases agendadas, o una agendada y una inasistencia, queda bloqueado; una cancelada no ocupa cupo | `fix-300-m` |
| W03 | ✅ | Auto. Con un borrador vigente en la sede aparece la lista de borradores; "Nueva matrícula" llega con el egresado precargado | |
| W04 | ✅ | Auto. Con el RUT guardado sin puntos el paso 1 se precarga igual | |
| W06 | ✅ | Auto. Re-matricular a A, cerrar y re-matricular a B precarga a B | |
| W07 | ✅ | Auto. "Reiniciar" borra lo escrito y vuelve a precargar al mismo egresado | |
| Z05 | ✅ | Auto. Con Tab se llega a todas las acciones de la ficha y el foco se ve en cada una; Enter abre el menú de Carnet y el modal de archivar, y Escape los cierra. Los paneles laterales se cierran con su botón, no con Escape (observación) | |

**Traspasados a otras asignaciones (decisión de Matías, 2026-10-04):** no se ejecutan en este
track. Las equivalencias caso a caso y lo que ya quedó corregido acá están en la sección 0 de cada
checklist de destino.

| Casos de `024b` | Asignación de destino |
|---|---|
| F01–F03, F05, F06, F09, F10, F12, F14 (agenda de reprogramar) | `ASG-i-026` → `026-agenda-triple-match.md`, casos I01–I03, I12, I15–I20 |
| G03, G05, G06, G08, G10, G11 (reagendamiento masivo, parte de agenda) | `ASG-i-026` → casos J02–J06, J09, J10 |
| `024a` Q01–Q04 y Q06 · `024b` R01–R03 (tiempo real de la lista y de la ficha) · bug B10 | `ASG-i-056` → sección "Traspasado desde ASG-i-024" de la asignación. El test `Q01 (S5)` sigue en la suite con su marca `knownBug` |
| G03–G12 y H08 (reagendamiento masivo y penalización) | `ASG-i-027` → `027-asistencia-clase-b.md`, casos J04–J08, J11, J12, F04, G05 |

Cuarta pasada (2026-10-04): PDF reales. "Auto" = bloque "cuarta pasada: PDF reales" de
`e2e/alumnos-b-ficha.spec.ts`. Las funciones se llamaron de verdad contra la base de desarrollo,
con alumnos `E2E-`; al terminar cada test se borran el archivo de Storage, el certificado, su
registro de emisión y los avisos. El carnet y el certificado generados se revisaron a ojo.

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|
| J02 | ✅ | Auto. "Generar Carnet 6 clases" abre el visor con el PDF; tras recargar, "Ver" queda habilitado y "Generar" pasa a "Volver a generar" | |
| J03 | ✅ | Revisado el PDF: nombres, apellidos, RUT, Nº de matrícula, instructor y 6 filas con día y hora (en hora de Chile). Con el Nº de prueba, de 12 caracteres, el texto se sale de su recuadro; los reales tienen 4 dígitos | |
| J04 | ✅ | Auto. En "Refuerzo Clase B" el menú no ofrece el carnet de 12 clases | |
| J05 | ✅ | No aplica: el carnet sale a nombre de Conductores Chillán por decisión de Matías (S11, cerrada sin cambio) | |
| J06 | ✅ | Auto. Sin foto, el carnet se genera con el recuadro vacío y sin error | |
| J07 | ✅ | Auto. "Volver a generar" reemplaza el archivo: queda uno solo en Storage | |
| J08 | ✅ | Auto, por API. Sin una sesión real (solo la anon key) la función del carnet responde 401 y no genera nada: exige admin o secretaria (spec `0009-i`, que verificó además 403 para alumno e instructor). Una secretaria sí puede generar por API el carnet de una matrícula de otra sede: la sede no se valida en el servidor por decisión de la spec `0009-i` (Ignacio, 2026-10-01). El 2026-10-04 se anotó acá por error como "la función no revisa quién llama" | `ASG-i-042` (completada) |
| K01 | ✅ | Auto. Matrícula presencial con contrato: "Ver Contrato" abre el PDF | |
| K03 | ✅ | Auto. Matrícula online con contrato sin firmar: menú con "Descargar Contrato" (baja `Contrato.pdf`) y "Subir Firmado" | |
| K04 | ❌ → ✅ | Auto. Un `.txt` elegido en "Subir Firmado" se guardaba como contrato firmado. **Corregido el 2026-10-04**: se rechaza con "El contrato firmado debe ser un archivo PDF." | B43 → `fix-304-m` |
| K05 | ✅ | Auto. Al subir el PDF firmado aparece el aviso de éxito y el botón pasa a "Ver Contrato", que lo abre | |
| L02 | ✅ | Auto. Con el certificado ya generado el botón dice "Ver Certificado" y abre el PDF | |
| L04 | ✅ | Auto. Con las 12 clases cerradas sin nota, el botón está habilitado y la función lo genera (`fix-262-m`) | |
| L05 | ✅ | Auto. "Generar Certificado" abre el visor y deja la ruta en la matrícula. Revisado el PDF: nombre, RUT, fechas del curso y datos de la sede | |
| L06 | ❌ → ✅ | Auto. Ante un rechazo de la función se veía "No se pudo generar el certificado" en vez del motivo. **Corregido el 2026-10-04** | B44 → `fix-305-m` |
| L07 | ❌ → ✅ | Auto. Generar el certificado desde la ficha no avisaba al alumno (desde Certificaciones B sí). **Corregido el 2026-10-04** | B45 → `fix-306-m` |
| M10 | ✅ | A mano (2026-10-04). Matías activó la cuenta del alumno de prueba desde el enlace del correo y le puso contraseña. Como secretaria se le cambió el correo desde "Editar Perfil": la función responde 200, la ficha y la base muestran el correo nuevo y sigue vinculado a la misma cuenta de Auth. Matías comprobó en `/login` que con el correo nuevo entra y con el viejo dice "Correo o contraseña incorrectos."; no llegó correo de confirmación al nuevo. Tras entrar, el portal del alumno muestra "Módulo no habilitado todavía" (bloqueado en esta fase del piloto). Con la cuenta real activada, "Editar Perfil" no ofrece la invitación (M13) | |
| M11 | ✅ | A mano, con un correo real de temp-mail (2026-10-04, secretaria de la sede A). A un alumno sin cuenta se le cambió el correo desde "Editar Perfil" y se guardó; la invitación enviada después llegó al correo nuevo | |
| M12 | ✅ | Mismo recorrido. Con el correo sin guardar el botón está deshabilitado; ya guardado, "Enviar invitación" muestra "Invitación enviada correctamente." (la función responde 201, `invited`) y el alumno queda vinculado a una cuenta de Auth con el primer ingreso pendiente. Matías confirmó con captura que el correo llegó: "Activa tu cuenta - AutoEscuela Chillán", de `no-reply@autoescuelachillan.cl`, con el botón "Activar mi cuenta" y enlace válido por 1 día. No quedó como test de la suite porque envía un correo real en cada corrida | |
| M13 | ✅ | Auto (bloque "cierre de la asignación"). El aviso de invitación de "Editar Perfil" se ve mientras el alumno no tiene cuenta o no ha entrado nunca, y desaparece cuando la cuenta ya está activada. La cuenta se simuló en la base (identificador de Auth y primer ingreso), sin crear un usuario real | |

**Aún sin ejecutar de `024b`:** N04 (revocar un consentimiento no se puede deshacer ni sembrar: `consents` no admite borrado) · S05 · W08.

**Observaciones de la 3ª pasada (no son bugs de este track, para decidir):**

- **Choque de horario del alumno, en la base:** `fix-299-m` lo impide en la grilla de la ficha,
  pero la base solo valida el choque del instructor. Dos personas agendando a la vez, o la
  matrícula (que usa otra grilla, `EnrollmentFacade`), todavía pueden dejar a un alumno con dos
  clases a la misma hora. Cerrarlo del todo pide un trigger; se cruza con `ASG-i-026`.
- **Tope de 2 clases por día:** `computeBlockedDates()` cuenta también las clases canceladas y las
  inasistencias de ese día, así que un día con una clase cancelada y una agendada ya aparece
  bloqueado para reprogramar. → Decidido (Matías, 2026-10-04): máximo 2 clases por día contando
  solo las que debían ocurrir; las canceladas no cuentan, las inasistencias sí. ✅ `fix-300-m`.

- **Los paneles laterales no se cierran con Escape** (Z05). Es del host global de paneles y vale
  para todos los de la app; los menús y los modales sí se cierran. Queda para decidir.
- **Choque de horario en la base:** → Decidido (Matías, 2026-10-04): se agrega el trigger.
  ✅ `fix-301-m`, migración `20261004120000`, aplicada por Matías el 2026-10-04; el test por API
  pasa.
- **Otras listas a 1366 px:** medidas el 2026-10-04. Sin scroll horizontal, pero Ex-Alumnos B
  partía el RUT y el nombre (filas de 80 px) y Alumnos Profesional dejaba el nombre en 3 líneas
  (98 px). ✅ `fix-302-m`: la tabla compacta de `fix-294-m` pasa a ser un estilo compartido y la
  usan las cuatro listas (filas de 60 a 63 px). Ex-Alumnos Profesional no tiene datos para medir.
- **`text-base` (color, no tamaño):** revisados los 27 usos el 2026-10-04. 22 se leen bien; 5
  quedaban con el color del fondo. ✅ `fix-303-m`.
- **Tailwind escaneaba `e2e/`** y generaba CSS inválido con un selector de test. ✅ `hotfix-139-m`.

## Sospechas: confirmadas / descartadas

| Checklist | # | Resultado | Evidencia | Track |
|---|---|---|---|---|
| 024a | S1 🔴 | **Cerrada** | El 2026-10-01 la secretaria de la sede 1 exportaba 133 alumnos de la sede 2. `export-students` ya no existe (`hotfix-130-m`) | `ASG-i-042` (completada, `0009-i`) |
| 024a | S2 🔴 | **Cerrada por decisión** | La ficha PDF exige rol de admin o secretaria; la sede no se valida en el servidor por decisión de la spec `0009-i` (Ignacio, 2026-10-01) | `ASG-i-042` (completada, `0009-i`) |
| 024a | S3 🟠 | **Confirmada** | Excel 72 filas vs 64 en pantalla; expediente siempre "Pendiente"; la Papelera exporta activos | B1 |
| 024a | S4 🟠 | **Confirmada** | `chk_expires_at_draft_only` + la lista excluye borradores → KPI siempre 0; "Contactar" no tiene `(click)` | B9 |
| 024a | S5 🟠 | **Confirmada** | `enrollments` no está en `supabase_realtime`; un alumno nuevo no aparece sin recargar | `ASG-i-056` |
| 024a | S6 🟡 | **Confirmada** | La pantalla de secretaria no tiene el `effect()` de sede ni pasa `showSedeColumn` | B7 |
| 024a | S7 🟡 | **Confirmada** | `_trashView` vive en el facade singleton y no se resetea al salir | B4 |
| 024a | S8 🟡 | **Confirmada** | El `error` del facade no se muestra; se ve el estado vacío | B5 |
| 024a | S9 🟡 | Confirmada en código | `created_at.slice(0, 10)` (UTC), en pantalla y en la exportación. **En pantalla corregido el 2026-10-01** (`hotfix-123-m`: `dd-mm-aaaa`, día en hora local) | `hotfix-123-m` (pantalla) · `ASG-i-054` (exportación y resto) |
| 024a | S10 🟡 | **Confirmada** (mitad) | Escape cierra el modal mientras archiva. La otra mitad se descarta: un alumno con matrícula pero sin pagos ni clases cae en el modal simple | B6 |
| 024a | S11 🟡 | **Confirmada** | "Con deuda" usa solo la matrícula B más reciente | B8 |
| 024a | S12 🟡 | **Confirmada** | Opciones fijas; falta "Refuerzo Clase B" | B3 |

| 024b | S1 🔴 | **Corregida** el 2026-10-01 | Confirmada ese día: la secretaria de la sede 1 editaba por `update-student-profile` a un alumno `E2E-` de la sede 2. La cerró `fix-179-b`; el test M04 pasa | `ASG-i-043` (completada) → `fix-179-b` |
| 024b | S2 🔴 | **Corregida** en `0009-i` (rol); la sede queda **aceptada por decisión** | La sospecha decía que la función no tenía ningún control de acceso. Desde `0009-i` exige un usuario real con rol de admin o secretaria (401 sin sesión, comprobado el 2026-10-04; 403 para alumno e instructor, comprobado en `0009-i`). El 2026-10-04, por API, la secretaria de la sede A generó el carnet de una matrícula `E2E-` de la sede B (archivo borrado): la sede no se valida en el servidor por decisión de la spec `0009-i` (Ignacio, 2026-10-01) | `ASG-i-042` (completada) |
| 024b | S3 🟠 | Confirmada en código | 5 de las 7 tablas del canal no están en `supabase_realtime` | `ASG-i-056` |
| 024b | S4 🟠 | **Mitad corregida, mitad vigente** | `fix-263-m` sacó el borrador del selector; la matrícula principal sigue siendo `sorted[0]` sin filtrar | B15 |
| 024b | S5 🟠 | **Corregida** por `fix-263-m` | El botón desaparece y el estado pasa a "Egresado" | |
| 024b | S6 🟠 | **Confirmada** | Ex-Alumnos usa `enrollments.updated_at`; marcar ex-alumno no lo actualiza | B16 |
| 024b | S7 🟠 | **Corregida** el 2026-10-02 | `reprogramarClase()` dejaba la sesión en `scheduled` sin archivar la asistencia (`archived_at` solo se escribía en el flujo masivo). Ahora archiva y escribe el historial; verificado en la base con un alumno de prueba | `fix-279-m` · re-ejecutar en `ASG-i-027` |
| 024b | S8 🟠 | **Confirmada** | Mensaje genérico con email duplicado | B17 |
| 024b | S9 🟠 | Confirmada en código | La ficha no tiene ninguna acción de Documentos. Requiere decisión (Q01) | ⏸ decisión |
| 024b | S10 🟠 | **Corregida** el 2026-10-04 | `fix-262-m` quitó el requisito de nota. La ficha llamaba `generarCertificado()` sin `force`, y la función solo acepta el bypass de admin con `force: true`; ahora lo manda cuando el admin confirma | B34 → `fix-289-m` |
| 024b | S11 🟡 | Confirmada en código, **cerrada sin cambio** | Nombre, dirección, email y logo de "Conductores Chillán" fijos en la función | Decisión de Matías (2026-10-04): el carnet se deja como está |
| 024b | S12 🟡 | **Confirmada** | Solo con navegación interna de la SPA | B12 |
| 024b | S13 🟡 | **Confirmada** | "Cargando…" para siempre | B13 |
| 024b | S14 🟡 | **Confirmada** | Cualquier refresco vuelve a la matrícula más reciente. La otra mitad (el historial de reagendamientos no se recarga al cambiar de matrícula) se confirmó el 2026-10-04 | B21 · B41 → `fix-298-m` |
| 024b | S15 🟡 | **Confirmada** | La tarjeta no pasa `?from=ex-alumnos` | B20 |
| 024b | S16 🟡 | Confirmada en código | Tasas y opiniones sin filtro de sede; municipal y psicotécnico son el mismo número | ⏸ decisión (X02/X04) |
| 024b | S17 🟡 | **Confirmada** | `students.created_at.slice(0, 10)` | B14 (formato) · `ASG-i-054` (UTC) |
| 024b | S18 🟡 | **Corregida** el 2026-10-04 (el cierre diferido) | El `setTimeout` de 1,2 s cierra el drawer que esté abierto; la invitación usa el email del formulario | `hotfix-134-m`. La otra mitad (la invitación usa el correo del formulario): `fix-296-m`, el botón se deshabilita con el correo sin guardar (y `hotfix-135-m`: el aviso no parpadea al cancelar ni al guardar) |
| 024b | S19 🟡 | **Corregida** el 2026-10-02 | Decisión tomada (I06 / I08); la ficha registra pagos y muestra el historial del alumno | `fix-278-m` |
| 024b | S20 🟡 | **Confirmada y corregida** el 2026-10-04 | La grilla solo bloqueaba los días con 2 clases del alumno; la base solo impide el choque del instructor (`trg_prevent_double_booking`) | B42 → `fix-299-m` |

Descartado: **P08** (RLS de `students`/`enrollments` por sede) funciona bien para lectura, y por
escritura la secretaria tampoco puede archivar alumnos ni cambiar matrículas de otra sede.

## Bugs encontrados

Cada uno va a su propio fix/hotfix; acá solo se listan. Los tests de `e2e/` marcados con
`knownBug('Bn')` describen el comportamiento correcto y hoy fallan a propósito.

| # | Descripción | Gravedad | Track |
|---|---|---|---|
| B1 | **La exportación de la lista no coincide con la pantalla** (`export-students`): incluye "Finalizado" y solo-Profesional, no conoce "Docs Pendientes", calcula el expediente con 4 documentos y el nombre viejo `foto_carnet` (siempre "Pendiente"), busca sin ignorar tildes ni tokenizar, y desde la Papelera exporta los activos. Toca el mismo archivo que `0009-i` (Ignacio), que ya está cerrada (2026-10-01, `d8116bcb`): se puede tomar sin coordinar | 🟠 Media | ✅ `fix-281-m` (2026-10-02): el archivo se arma con las filas de la pantalla; Excel en el navegador y PDF con `export-table-pdf`. También resuelve la fecha `aaaa-mm-dd` del Excel/PDF que quedaba de B14 |
| B2 | **Buscar por RUT solo funciona con el formato guardado.** Sin puntos, sin guion o parcial no encuentra. Agravante: los 200 alumnos del seed están guardados sin puntos y los reales con puntos | 🟠 Media | ✅ `fix-267-m` |
| B3 | **Filtro Curso con opciones fijas**: no se puede filtrar "Refuerzo Clase B" | 🟡 Baja | ✅ `hotfix-114-m` |
| B4 | **La Papelera queda "pegada"** al salir de la pantalla y volver | 🟡 Baja | ✅ `hotfix-112-m` |
| B5 | **Un error de carga se ve como lista vacía** ("No se encontraron alumnos"), con KPIs en 0 | 🟡 Baja | ✅ `hotfix-113-m` |
| B6 | **El modal de archivar se cierra con Escape/clic afuera mientras archiva**; la operación termina igual y el usuario no ve el resultado en el modal | 🟡 Baja | ✅ `hotfix-111-m` |
| B7 | **Secretaria con grant multi-sede**: la lista no recarga al cambiar de sede y nunca muestra la columna Sede | 🟡 Baja-Media | ✅ `fix-269-m` |
| B8 | **"Con deuda" y el saldo ignoran matrículas B anteriores** con deuda | 🟡 Baja | ✅ `fix-270-m` |
| B9 | **KPI "Por Vencer" siempre 0 y drawer siempre vacío**; el drawer habla de "cuotas" y "Contactar" no hace nada. Decisión: se quita | 🟠 Media | ✅ `fix-271-m` |
| B10 | Tiempo real de la lista muerto | 🟠 Media | `ASG-i-056` |
| B11 | El error de la ficha no dice qué pasó: "Error al cargar la ficha del alumno" tanto si el id no existe como si es de otra sede | 🟡 Baja | ✅ `hotfix-116-m` |
| B12 | **El error de la ficha queda "pegado"**: tras una ficha con error, la del alumno anterior se sigue viendo con error hasta recargar | 🟡 Baja | ✅ `hotfix-116-m` |
| B13 | **Id no numérico en la URL** deja la ficha en "Cargando…" para siempre | 🟡 Baja | ✅ `hotfix-116-m` |
| B14 | Fecha de ingreso en formato `aaaa-mm-dd` | 🟡 Baja | ✅ `fix-273-m` (ficha) y `hotfix-123-m` (columna de la lista). El Excel/PDF exportado sigue en `aaaa-mm-dd` (va con B1) |
| B15 | **Un borrador más reciente se muestra como matrícula principal de la ficha** (número, curso, 0 clases), aunque exista una matrícula activa. Resto de S4 que `fix-263-m` no cubrió | 🟠 Media | ✅ `fix-265-m` |
| B16 | **La "fecha de egreso" de Ex-Alumnos es `updated_at`**: un alumno marcado hoy aparece con el año del último cambio de su matrícula y puede quedar fuera de "Últimos 12 meses" | 🟠 Media | ✅ `fix-266-m` |
| B17 | **Email duplicado en "Editar Perfil" muestra un error genérico** | 🟠 Media | ✅ `fix-268-m` |
| B19 | Secretaria edita usuarios de otra sede | 🔴 Alta | ✅ `fix-179-b` (`ASG-i-043`, completada el 2026-10-01). El test M04 pasó a verde esa noche y se le quitó la marca `knownBug`. En su momento se anotó acá que "coincidía con el merge de `0047-b`"; el arreglo fue `fix-179-b` |
| B20 | "Ver ficha" desde una **tarjeta** de Ex-Alumnos: "Volver" lleva a la Base de Alumnos | 🟡 Baja | ✅ `hotfix-115-m` |
| B21 | **El selector de matrícula "salta"** a la más reciente después de cualquier refresco | 🟡 Baja | ✅ `fix-265-m` |
| B22 | **La lista de Alumnos del admin consulta dos veces al abrir y muestra "0 alumnos" un instante.** No estaba en el checklist: apareció al corregir B7 | 🟡 Baja | ✅ `hotfix-117-m` |
| B23 | **A 1366 px la tabla de la Base B no cabe**: RUT, badge de curso, fecha y expediente se parten en dos líneas y la columna Acciones queda cortada (el botón de archivar solo se alcanza con scroll horizontal dentro de la tabla). A 1600 px el RUT y la fecha se siguen partiendo; a 1920 no. Pasa con y sin la columna Sede | 🟠 Media | ✅ `fix-294-m` (2026-10-04). Decisión de Matías: apretar la tabla para que quepa. Menos relleno entre columnas, botones de 32 px, datos cortos en una línea y el nombre recortado cuando no cabe; a 1366 px cabe con y sin la columna Sede |
| B24 | **"Exportar" de la Base B no se deshabilita con la lista vacía** (descarga un Excel sin filas). Ex-Alumnos B y las listas profesionales sí lo deshabilitan | 🟡 Baja | ✅ `hotfix-133-m` (2026-10-04) |
| B25 | **Buscar o filtrar no vuelve la tabla a la página 1**: desde la página 3 queda "Mostrando 21 a 10 de 10" y la tabla vacía. Lo introdujo el `[first]` agregado para el orden por columna (`0020-m`); `0023-m` lo replicó en Ex-Alumnos B y las dos listas profesionales. `updateFilter()` no resetea `tableFirst`. En Ex-Alumnos B, además, buscar no vuelve las tarjetas a 6 (V04) | 🟠 Media | ✅ `fix-283-m` (2026-10-03): buscar, filtrar o cambiar el período vuelve a la página 1 (y a 6 tarjetas) en las 4 listas |
| B26 | **El menú "Exportar" no se cierra con Escape ni con un clic fuera del panel de la lista** (encabezado, barra superior, menú lateral). El telón de cierre queda dentro del contexto de apilamiento del panel. Afecta a las 5 listas que usan `app-export-menu` | 🟡 Baja | ✅ `fix-286-m` (2026-10-04): el menú escucha el clic y Escape en el documento |
| B27 | **El PDF de la ficha de matrícula pierde tildes y ñ** ("Reyes Munoz", "Telefono", "practicas"), muestra el concepto del pago en crudo ("enrollment") y la hora del pie rota ("11:24 p.?m.") — `generate-enrollment-sheet` | 🟠 Media | ✅ `fix-293-m` (2026-10-04): además separa la cabecera, que salía montada, y corrige la fecha de los pagos, que salía un día antes. Función desplegada por Matías y PDF verificado desde la app el 2026-10-04 |
| B28 | **La Papelera vacía dice "No se encontraron alumnos · Intenta ajustar los criterios…"** aunque no haya ningún filtro: debería decir que no hay alumnos archivados | 🟡 Baja | ✅ `fix-285-m` (2026-10-04) |
| B29 | **La tabla de la Ficha Técnica no cabe en su drawer**: a 1600 px el drawer mide 720 px y la tabla 904; "Validación" y "Acción" (el lápiz de reprogramar) solo se ven con scroll horizontal | 🟠 Media | ✅ `fix-290-m` (2026-10-04): tabla o tarjetas según el ancho del contenedor; en el drawer se ven las tarjetas, con el kilometraje |
| B30 | **El PDF de la Ficha Técnica** dice "Pendiente de sesión" en las clases completadas sin observaciones y corta la columna "Val."; además dos clics rápidos generan y abren dos PDF — `generate-ficha-tecnica-pdf` y su botón | 🟡 Baja | ✅ `fix-292-m` (2026-10-04): clases completadas en blanco, fecha `dd-mm` y hora de 24 h, un solo PDF con doble clic. La columna "Val." no estaba cortada (era el visor). Función desplegada por Matías y PDF verificado desde la app el 2026-10-04 |
| B31 | A 768 px la cabecera de la ficha deja el nombre del alumno en "Alum Ap…" porque los botones ocupan la misma fila | 🟡 Baja | ✅ `fix-291-m` (2026-10-04): cambio en `app-section-hero`, afecta a todas las cabeceras slim angostas |
| B32 | **Un error de carga en Ex-Alumnos B se ve como lista vacía** ("0 Egresados", "No se encontraron egresados · Intenta ajustar…"). Es el mismo problema que B5 tenía en la Base | 🟡 Baja | ✅ `fix-287-m` (2026-10-04) |
| B33 | **Secretaria con grant multi-sede en Ex-Alumnos B**: al cambiar de sede la lista no se recarga. Es el mismo problema que B7 tenía en la Base | 🟡 Baja-Media | ✅ `fix-288-m` (2026-10-04) |
| B34 | **El admin no puede generar el certificado sin las 12 clases**: la ficha pregunta "¿generar de todas formas?" pero llama sin `force` y la función lo rechaza (S10, vigente) | 🟠 Media | ✅ `fix-289-m` (2026-10-04) |
| B35 | **Inyección de HTML en la confirmación de re-matricular**: el nombre del egresado se interpola en un mensaje HTML (`<strong>${nombre}</strong>`). Angular quita scripts y eventos, pero las etiquetas se aplican. 4 componentes (Ex-Alumnos B y Profesional, admin y secretaria) | 🟠 Media | ✅ `fix-284-m` (2026-10-04): `escapeHtml()` en los 4 componentes |
| B36 | **Reabrir un drawer mientras se está cerrando lo deja vacío y luego lo cierra.** Al cancelar "Editar Perfil" y volver a abrirlo dentro de los ~300 ms que dura la animación de salida, se reutiliza el mismo formulario ya vaciado y, al terminar la animación, el host de drawers limpia el panel recién abierto. Es del host global (`layout-drawer`), no de la ficha: afecta a cualquier drawer que se reabra con el mismo componente. Apareció el 2026-10-04 porque el test M09 · M15 reabría sin esperar (ahora espera el cierre) | 🟡 Baja | ✅ `fix-295-m` (2026-10-04): al reabrir durante el cierre, el host cancela la animación de salida y vuelve a crear el contenido. El test M09 · M15 volvió a reabrir sin esperar |
| B37 | **Un egresado de noche queda con un año en la columna y otro en el filtro.** El año salía en hora local y el día de egreso en UTC: quien egresó el 31-12 a las 23:30 mostraba 2025 y desaparecía al elegir el período 2025 | 🟡 Baja | ✅ `fix-297-m` (2026-10-04) |
| B38 | **Los puntos de firma de las tarjetas de la Ficha Técnica no decían qué significan** (sin texto al pasar el mouse). Visible desde que el panel muestra tarjetas (`fix-290-m`) | 🟡 Baja | ✅ `hotfix-136-m` (2026-10-04) |
| B39 | **Doble clic en "Guardar Cambios" de Editar Perfil guarda dos veces** (dos llamadas a `update-student-profile`) | 🟡 Baja | ✅ `hotfix-137-m` (2026-10-04) |
| B40 | **El menú de Carnet de la ficha no se cierra con Escape** (con un clic fuera sí) | 🟡 Baja | ✅ `hotfix-138-m` (2026-10-04) |
| B45 | **Generar el certificado desde la ficha no avisa al alumno.** El aviso buscaba al alumno en la lista de la pantalla de Certificaciones B, que desde la ficha no está cargada (último punto de S10) | 🟡 Baja | ✅ `fix-306-m` (2026-10-04) |
| B44 | **El rechazo del certificado muestra un mensaje genérico**: el motivo real viene en el cuerpo de la respuesta y se buscaba en otro lado. El test de `fix-011-i` simulaba una respuesta que la función real no produce | 🟡 Baja | ✅ `fix-305-m` (2026-10-04) |
| B43 | **"Subir Firmado" acepta cualquier archivo** y lo guarda como contrato firmado en PDF | 🟠 Media | ✅ `fix-304-m` (2026-10-04) |
| B42 | **Al reprogramar se podía elegir un horario que choca con otra clase del alumno** (misma hora, otro instructor): el alumno quedaba con dos clases a la vez. La misma grilla se usa en el reagendamiento masivo | 🟠 Media | ✅ `fix-299-m` (2026-10-04): la grilla marca ocupado lo que choca con una clase vigente del alumno. La base sigue sin impedirlo (ver observaciones de la 3ª pasada) |
| B41 | **El historial de reagendamientos no sigue a la matrícula elegida**: se carga una vez al entrar a la ficha; al cambiar de matrícula en el selector el panel sigue mostrando el de la primera. Es la mitad de S14 que quedaba | 🟡 Baja | ✅ `fix-298-m` (2026-10-04) |

B18 no se usa: la sospecha (una secretaria archiva alumnos de otra sede) se descartó al probarla.

Las sospechas que quedaban sin número ya están resueltas: S7 en `fix-279-m`, S10 es B34
(`fix-289-m`), S18 en `hotfix-134-m` y `fix-296-m`, y S11 se cerró sin cambio por decisión de Matías (el carnet
sale siempre a nombre de Conductores Chillán).

## Decisiones de negocio

### Tomadas por el owner (Matías, 2026-10-01)

"Hoy" = lo que hace el código al momento de decidir. Las que dicen "cambio" todavía no tienen
track; cada una va a su propio fix/hotfix.

| Caso | Decisión | Efecto |
|---|---|---|
| `024a` D05 / N02 | **Quitar el KPI "Por Vencer"** y su drawer | ✅ hecho en `fix-271-m` (B9) |
| `024a` D04 | **"Con deuda" y el saldo suman todas las matrículas B** del alumno | ✅ hecho en `fix-270-m` (B8) |
| `024a` D03 | **"Activos" incluye "Pendiente Pago" y "Docs Pendientes"**: si están teniendo clases, están activos | ✅ hecho en `hotfix-118-m` |
| `024a` L09 | **No se puede archivar a un alumno con clases futuras**; primero hay que cancelarlas o reagendarlas | ✅ hecho en `fix-277-m` (aviso por toast; solo clases prácticas Clase B) |
| `024a` M08 | Un restaurado **vuelve a donde estaba**: a Ex-Alumnos si ya estaba marcado como ex-alumno, a la Base si no | ✅ verificado en navegador con `fix-276-m` |
| `024b` F04 / F13 | **Se permite reprogramar individualmente** una clase con inasistencia o cancelada; la inasistencia anterior se archiva y la reprogramación **queda en el historial de reagendamientos** | ✅ hecho en `fix-279-m` (S7): el formulario pide la razón; verificado en la base con un alumno de prueba |
| `024b` H06 | Una inasistencia **ya reagendada no se puede justificar** (quedó archivada) | ✅ hecho en `hotfix-128-m` (el botón "Justificar" seguía apareciendo) |
| `024b` Q01 | **No se repone el botón "Documentos"** en la ficha | S9 cerrada sin cambio |
| `024b` I06 / I08 | "Ver todo el historial" abre Pagos **filtrado por el alumno**, y se agrega un botón **"Registrar pago"** en "Estado Financiero" | ✅ hecho en `fix-278-m` (S19): "Ver todo el historial" abre el panel "Estado de Cuenta" de la matrícula sobre la ficha — el módulo Pagos no tiene listado filtrable por alumno — y "Registrar pago" aparece solo con saldo pendiente. De paso, `hotfix-127-m`: el badge del panel mostraba `paid_full` crudo |
| `024b` Q02 | Email y teléfono **quedan como texto** | sin cambio |
| `024b` Q03 | El PDF de la ficha **solo se descarga desde la lista** | sin cambio |
| `024b` X02 / X04 | **Tasas y opiniones se dejan como están.** No hay nada que las alimente: ninguna pantalla crea filas en `student_surveys` ni registra `class_b_exam_scores` (que además son ensayos, no el examen municipal). Filtrarlas por sede no aporta mientras no tengan datos | S16 cerrada sin cambio; X01–X05 no se ejecutan |
| `024b` C05 / T11 | La ficha abre **la matrícula que se cliqueó**: desde Ex-Alumnos la terminada, desde la Base la vigente | ✅ hecho en `fix-272-m` |
| `024b` O05 | Egresar con deuda: **la confirmación avisa el monto, pero permite** | ✅ hecho en `hotfix-125-m` |
| `024b` A08 / P04 / T04 | Un ex-alumno archivado **sale de Ex-Alumnos**; solo se ve en la Papelera | ✅ hecho en `fix-276-m` (antes tampoco aparecía en la Papelera) |
| `024b` T03 | Un egresado re-matriculado aparece **en ambas listas** | sin cambio |
| `024b` C06 | Las matrículas **canceladas se muestran en el selector, marcadas** | ✅ hecho en `hotfix-120-m` (marca "Anulada"); falta verlo en navegador con una cancelada real |
| `024b` P05 | El botón sigue diciendo **"Eliminar Alumno"** | sin cambio |
| `024a` D07 · `024b` T07 | Los KPIs muestran **siempre el total de la sede**; no siguen filtros, búsqueda ni período | sin cambio |
| `024a` E08 | El buscador **no busca por email** | sin cambio |
| `024b` B09 | "Fecha de ingreso" es **la de la matrícula elegida** (cambia con el selector) | ✅ hecho en `fix-273-m`, junto con B14 |
| `024a` F10 | Los filtros y la búsqueda **se conservan** al salir de la lista y volver | ✅ hecho en `fix-275-m` + `hotfix-126-m`. El owner precisó la regla: **solo al devolverse desde la ficha de un alumno** ("Volver" o el botón atrás del navegador); por cualquier otro camino la lista aparece sin filtros |
| `024a` G03 | **Agregar ordenamiento por columna** en la tabla de alumnos | ✅ implementado en la spec `0020-m` (2026-10-02): los 8 títulos ordenan la lista completa (clic 1 ascendente, clic 2 descendente, clic 3 vuelve al orden por defecto), y el orden se conserva solo al volver de la ficha. La vista de tarjetas tiene un control "Ordenar por". Con visto bueno visual del owner; spec cerrada |
| `024a` O05 | **"Nueva Matrícula" se oculta dentro de la Papelera** | ✅ hecho en `hotfix-119-m` |
| `024a` J04 | **No aplica**: en el uso real un alumno siempre nace del wizard con una matrícula; el caso "sin matrícula" solo existe con datos sembrados a mano | sin cambio; J04 no se ejecuta |
| `024a` L04 | "borrarlo" debe escribirse **exactamente como lo pide el modal**; no se aceptan mayúsculas | ✅ hecho en `hotfix-124-m` (el modal aceptaba mayúsculas) |
| `024b` F11 | "Cancelar" al reprogramar **vuelve al panel de Ficha Técnica**, no cierra todo | ✅ hecho en `fix-279-m` |
| `024b` M08 | El teléfono de "Editar Perfil" usa **la misma regla que Nueva Matrícula**: obligatorio y con al menos 8 caracteres (`personal-data.component.ts:202`). No se agrega validación de formato | ✅ hecho en `hotfix-121-m` |
| `024b` W05 | Al terminar o cancelar una re-matrícula, el selector de sede del admin **vuelve a la sede que tenía elegida** (p. ej. "Todas") | ✅ hecho en `fix-274-m` (solo Ex-Alumnos B) |
| `024b` T14 | Ex-Alumnos debe **exportar la lista con las mismas opciones que la Base de Alumnos (Excel y PDF)**. No hace falta descargar el certificado desde la lista | implementado en la spec `0021-m` (2026-10-02): botón "Exportar" con Excel y PDF que traen las filas de la pantalla. Función `export-table-pdf` desplegada, PDF probado de punta a punta y visto bueno visual del owner; spec cerrada |

### Aún pendientes

Ninguna: todas las de §5 de ambos checklists quedaron decididas el 2026-10-01.

## Cambio

Ninguno en código de producción. Este track agrega solo los tests E2E de la capa 3:

- **`e2e/alumnos-b-lista.spec.ts`** — 20 tests de la Base de Alumnos B (`024a`).
- **`e2e/alumnos-b-ficha.spec.ts`** — 24 tests de la ficha y Ex-Alumnos B (`024b`).
- **`e2e/support/alumnos-seed.ts`** — `createE2eAlumno()` y `markCertificateSent()`: siembran
  por API un alumno `E2E-` con las matrículas que el caso necesite y lo registran en `cleanup`.
- **`e2e/support/supabase-admin.ts`** — `getClientFor()`: cliente con la sesión de cualquier
  cuenta de prueba, para comprobar la RLS por fuera de la UI.
- **`e2e/support/fixtures.ts`** — `knownBug()`, compartido para toda la tanda de testing.
- **`playwright.config.ts`** — tope de 4 workers y 10 s por aserción. Con 6 workers y el default
  de 5 s, al sumar estos 44 tests empezaron a fallar al azar tests que ya existían (`smoke`,
  `infra` AC6) porque la primera pantalla no alcanzaba a pintarse.
- **`docs/E2E-PLAYWRIGHT.md`** — secciones "Alumnos de prueba" y "Tests de bugs conocidos".

Los tests que describen un bug confirmado llevan `knownBug('Bn (fix-264-m)')` (`test.fail`): la
suite queda verde, y cuando el bug se corrija Playwright avisa que el test "pasó inesperadamente"
para que se quite la marca. `E2E_SHOW_KNOWN_BUGS=1 npx playwright test …` ignora las marcas y
muestra el error real de cada uno.

## Test de Regresión

- `npm run test:e2e` — 57 tests: los 13 que ya existían + 44 de este track (20 en
  `alumnos-b-lista`, 24 en `alumnos-b-ficha`). De los 44, 24 pasaban y 20 fallaban a propósito
  por bug conocido (10 en cada archivo). Tras `fix-265-m`, `fix-266-m` y
  `fix-267-m` quedaban 16 marcados, y la ficha suma un test del trigger de `completed_at`. Tras
  los hotfixes `111-m` … `116-m` quedaban 8, y tras `fix-268-m` y `fix-269-m` quedan 6: 4 en la
  lista (B1 ×2, B8, B10) y 2 en la ficha (B14, B19). La suite completa tiene 58 tests. Tras
  `fix-270-m` (B8) quedan 5: 3 en la lista (B1 ×2, B10) y 2 en la ficha. Tras `fix-273-m` (B14)
  y con B19 en verde quedan 3, todos en la lista (B1 ×2, B10); la ficha no tiene ninguno. Los
  dos archivos de Alumnos B suman 46 tests (se agregó C05 · T11). Con F10, L09, O05, T04 · P04 ·
  M08 y W05 (tanda de la noche del 2026-10-01) suman 51; la siembra E2E ahora puede agendar una
  clase futura (`addFutureClass()`).
- **Segunda pasada (2026-10-02/03):** se suman 10 tests en `alumnos-b-lista` y 10 en
  `alumnos-b-ficha` (bloques "segunda pasada"); 7 llevan `knownBug` (B23, B24, B25, B26, B32, B33,
  B35) y se verificó con `E2E_SHOW_KNOWN_BUGS=1` que fallan por el bug. Helpers nuevos:
  `addStudentDocuments()` y `addCompletedPractices()`; `addMissedClass()` ahora varía el día (con
  tres tests en paralelo el mismo instructor quedaba con clases solapadas y la BD lo rechazaba).
  De paso se arreglaron dos tests rotos por cambios recientes: F10 (desde `0022-m` hay dos botones
  "Limpiar filtros") y G03 · H (`0023-m` cambió el `data-llm-description` del control "Ordenar
  por"). Corrida completa de los dos archivos: 83/83 esperados, sin datos `E2E-` sobrantes.
- **Tanda de correcciones del 2026-10-04** (B24, B26–B35): los 5 tests que llevaban `knownBug` por
  estos bugs (B24, B26, B32, B33, B35) pasan sin la marca, y B23 también tras `fix-294-m`. Queda 1
  marcado: B10 (`ASG-i-056`). Tests E2E nuevos: E08 a 1600 y 1366 px (`fix-290-m`) y Z04
  (`fix-291-m`). M09 · M15 ahora espera a que el drawer termine de cerrarse antes de reabrirlo
  (ver B36). Unitarios nuevos: `html.utils`, `export-menu`, estado vacío de la lista,
  `showLoadError` y error de carga de Ex-Alumnos, `resolveCertificadoBAction`. Tests de Deno
  nuevos para los dos PDF (17 tests). `npm run test:ci`: 3.111 pasan, 5 omitidos, 0 fallan.
  `npm run lint:arch`: 0 errores.
- **B36 y S18 (2026-10-04):** `fix-295-m`, `hotfix-134-m` y `fix-296-m` (invitación, con su test E2E). M09 · M15 pasa a llamarse
  M09 · M15 · B36 y reabre el panel de inmediato; se suma el test S18, comprobado contra el
  código sin el arreglo (falla) y con él (pasa). Corrida final de los dos archivos: 88 de 88
  esperados, con un solo `knownBug` (B10, `ASG-i-056`). `smoke` e `infra`: 13 de 13.
  `npm run test:ci`: 3.114 pasan, 5 omitidos. `npm run lint:arch`: 0 errores.
- **Tercera pasada, tercer lote (2026-10-04):** 5 tests nuevos en `alumnos-b-ficha` (C07, D09, H05,
  I04, I05, I07, N01, N05, N06 · N07, N08) y `fix-298-m` (B41), con 2 unitarios nuevos. N07 falló
  antes del arreglo y pasa después. Corrida completa de los dos archivos: 100 de 100 esperados, con
  un solo `knownBug` (B10). `npm run test:ci`: 3.121 pasan, 5 omitidos. `npm run lint:arch`: 0
  errores.
- **Tercera pasada, cuarto lote (2026-10-04):** 3 tests nuevos (F07 · S20, W03 · W04, W06 · W07) y E09
  sumado al test de reprogramar; `fix-299-m` (B42) con 7 unitarios nuevos. F07 falló antes del
  arreglo y pasa después. Corrida completa de los dos archivos: 103 de 103 esperados, con un solo
  `knownBug` (B10). `npm run test:ci`: 3.128 pasan, 5 omitidos. `npm run lint:arch`: 0 errores.
- **Tanda del 2026-10-04 (tarde):** `hotfix-139-m`, `fix-300-m`, `fix-301-m`, `fix-302-m`, `fix-303-m`; tests nuevos Z05, K13, `fix-302-m` y el de `fix-301-m` por
  API. Corrida completa de los dos archivos más `smoke`: 108 de 108 esperados, con un `knownBug`
  (B10; el de `fix-301-m` se quitó al aplicarse la migración). `npm run test:ci`: 3.129 pasan, 5 omitidos. `npm run lint:arch`: 0
  errores.
- **Cuarta pasada, PDF reales (2026-10-04):** 7 tests nuevos (J02–J08, K01, K03–K05, L02, L04–L07) y
  `fix-304-m`, `fix-305-m`, `fix-306-m` con 8 unitarios nuevos. `addCompletedPractices()` ahora
  parte de un día al azar: dos tests en paralelo chocaban con el instructor de muestra. Un
  J08 se corrigió después: ver su fila (no es un `knownBug`). `npm run test:ci`: 3.137 pasan, 5 omitidos.
  `npm run lint:arch`: 0 errores.
- Última verificación (2026-10-01): 4 corridas completas con 57/57 esperados y 0 inesperados, y
  sin datos `E2E-` sobrantes en la BD. Una quinta corrida, hecha justo después de unas 25
  seguidas, falló en el login de 2 roles (30 s sin llegar al dashboard) y la siguiente volvió a
  pasar completa: no se investigó la causa (posible límite de inicios de sesión de Supabase).
