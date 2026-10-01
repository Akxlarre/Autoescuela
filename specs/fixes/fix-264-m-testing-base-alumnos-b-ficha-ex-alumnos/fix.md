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
  - Secretaria edita a cualquier usuario (`024b` S1) → `ASG-i-043`.
  - RLS por rol sin sede (`024a` P08; `024b` S03, S04) → `ASG-i-045`.
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
| A08 | ❌ | Auto. Con la carga fallida se ve "No se encontraron alumnos · Limpiar filtros" y KPIs en 0 | B5 |
| B01 | ✅ | Auto. Docs Pendientes, Retirado, Pendiente Pago y sin matrícula aparecen | |
| B02 | ✅ | Auto. Matrícula `completed` no aparece | |
| B05 | ✅ | Auto. Solo borrador no aparece | |
| B07 | ✅ | Auto. Archivado no aparece en la lista normal | |
| C05 | ✅ | Auto. Con 2 matrículas B se ven los 2 números | |
| C09 | ✅ | Auto. Estado correcto en los 4 casos sembrados | |
| D01 | ✅ | Auto. Chip "N alumnos" = total del paginador | |
| D02 | ✅ | Auto. KPI Total = total del paginador | |
| D04 | ❌ | Auto. La deuda de la matrícula B más antigua no cuenta en "Con deuda" | B8 |
| D05 | ❌ | El KPI es 0 por construcción: ninguna matrícula válida puede tener `expires_at` | B9 |
| E01–E05 | ✅ | Auto. Nombre, apellidos, ambos órdenes, sin tilde/ñ, mayúsculas | |
| E06 | ❌ → ✅ | Auto. Solo encontraba el RUT escrito igual que está guardado (con puntos); fallaban `99123456-7`, `991234567` y `99123456`. **Corregido el 2026-10-01** | B2 → `fix-267-m` |
| E07 | ✅ | Auto. Nº de expediente | |
| E09 | ✅ | Auto. Ignora espacios al inicio y al final | |
| E10 | ✅ | Auto. Estado vacío con "Limpiar filtros" | |
| F03 | ❌ | Auto. El filtro Curso solo ofrece "Clase B" y "Clase B SENCE"; existe el curso "Refuerzo Clase B" | B3 |
| F09 | ✅ | Auto. "Limpiar filtros" vacía la búsqueda y devuelve el total | |
| G01 | ✅ | Auto. 10 filas por página, reporte "Mostrando 1 a 10 de N" | |
| H01 | ✅ | Auto. A 375 px, tarjetas sin scroll horizontal | |
| H04 | ✅ | Auto. "Cargar más" suma de a 6; al filtrar vuelve a 6 | |
| J07 | ❌ | Por API: la secretaria de la sede 1 recibe HTTP 200 + PDF de la matrícula 2674 (sede 2) | → `ASG-i-042` |
| K02 | ✅ | Auto. La exportación a Excel responde 200 | |
| K04 | ❌ | Auto. Pantalla 64 filas, Excel 72 (los 8 de más son "Finalizado") | B1 |
| K06 | ⏸ | Sin alumnos "Docs Pendientes" en el seed; la función no conoce ese estado (código) | B1 |
| K07 | ❌ | La columna Expediente del Excel dice "Pendiente" en las 72 filas; la pantalla muestra 63 "Parcial 1/2" | B1 |
| K09 | ❌ | Auto. Desde la Papelera (1 archivado) el Excel trae 72 activos | B1 |
| K11 | ❌ | Por API: la secretaria de la sede 1 obtiene 133 filas pidiendo la sede 2 y 205 con `branch_id: null` | → `ASG-i-042` |
| L01 | ✅ | Auto. Modal simple para alumno sin historial | |
| L02 | ✅ | Auto. Modal "con historial" sobre un alumno del seed | |
| L03 | ✅ | Auto. "borrar" no habilita; "borrarlo" sí | |
| L05 | ✅ | Auto. Cancelar cierra sin archivar | |
| L06 | ❌ | Auto. Escape cierra el modal mientras dice "Archivando…"; el archivado termina igual | B6 |
| L08 | ✅ | Auto. El foco queda en el campo de texto | |
| M01 | ✅ | Auto. Archivar → Papelera → restaurar → vuelve a la lista | |
| M02 | ✅ | Auto. En la Papelera la fila solo tiene Restaurar | |
| M03 | ✅ | Auto. "← Alumnos" vuelve a la lista activa | |
| M04 | ❌ | Auto. Papelera → Agenda → volver: se abre la Papelera, no la lista activa | B4 |
| M07 | ✅ | Auto. La secretaria no ve archivados de otra sede | |
| P01 | ✅ | Auto. Admin "Todas": columna Sede visible | |
| P02 | ✅ | Auto. Al cambiar de sede recarga sola y oculta la columna | |
| P04 | ✅ | Auto. Sede 1 + sede 2 = "Todas" | |
| P05 | ✅ | Auto. Secretaria sin grant: sin columna ni selector | |
| P06 | ❌ | Auto. Secretaria multi-sede: al elegir otra sede la lista no cambia; en "Todas" no hay columna Sede | B7 |
| P08 | ✅ | Por API: la secretaria de la sede 1 lee 72 `students` y 73 `enrollments`, todos de su sede; 0 de la sede 2 | |
| Q01 | ❌ | Auto. Un alumno creado en otra sesión no aparece en 10 s sin recargar | B10 → `ASG-i-056` |

**Observación (H02):** a 1280 px de ancho (resolución de portátil común) la lista ya se muestra
como tarjetas: el contenedor de la tabla mide ~900 px y el corte está en `max-width: 900px`. A
1366 px se ve la tabla. No es un bug; queda anotado por si el owner quiere bajar el corte.

**Aún sin ejecutar de `024a`** (segunda pasada): A04–A07 · B03, B04, B06, B08–B10 · C01–C04,
C06–C08, C10–C13 · D03, D06–D08 · E08, E11 · F01, F02, F04–F08, F10, F11 · G02–G05 · H02, H03,
H05–H07 · I03 · J01–J06 · K01, K03, K05, K08, K10, K12–K15 · L04, L07, L09–L13 · M05, M06, M08,
M09 · N01–N04 · O01–O05 · P03, P07 · Q02–Q06 · R01–R05.

### 024b — Ficha del alumno y Ex-Alumnos B

Primera pasada (2026-10-01). "Auto" = `e2e/alumnos-b-ficha.spec.ts`.

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|
| A01 | ✅ | Auto. Admin abre la ficha desde la lista; consola y red limpias | |
| A02 | ✅ | Auto. Igual para secretaria, en `/app/secretaria/alumnos/:id` | |
| A03 | ✅ | Auto. Secretaria sede 1 con la URL de un alumno de la sede 2: tarjeta de error, sin nombre ni RUT. Ya no aparece "(PGRST116)" | |
| A04 | ❌ | Auto. Id inexistente: el detalle dice "Error al cargar la ficha del alumno" (repite el título, no dice que no existe) | B11 |
| A05 | ❌ | Auto. Tras una ficha con error, volver a abrir la ficha anterior sigue mostrando el error. Solo se reproduce con navegación interna (sin recargar) | B12 |
| A06 | ❌ | Auto. `/alumnos/abc` queda en "Cargando…" para siempre | B13 |
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
| M02 | ❌ | Auto. Email de otro usuario: "Ha ocurrido un error inesperado. Por favor, intenta de nuevo." El email no cambia | B17 |
| M03 | ✅ | Auto. Nombre y teléfono se guardan y la ficha los refleja | |
| M04 | ❌ | Por API: la secretaria de la sede 1 cambió el nombre de un alumno `E2E-` de la sede 2. **No se probó contra un admin real** | → `ASG-i-043` |
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
| V02 | ❌ | Auto. "Ver ficha" desde una tarjeta y "Volver" lleva a la Base de Alumnos | B20 |
| W01 | ✅ | Auto (parcial). Continuar abre "Nueva Matrícula" con `?rut=`. Falta verificar los campos precargados | |
| W02 | ✅ | Auto. Cancelar no abre nada ni cambia la URL | |

**Aún sin ejecutar de `024b`** (segunda pasada): A07, A08, A10–A12, A14 · B02–B04, B06, B07, B09 ·
C05–C07 · D01–D05, D07–D10 · E, F, G, H, I, J, K, L, N completas (necesitan clases, asistencia,
pagos y documentos sembrados; F, G y H se cruzan con `ASG-i-027`) · M05, M08–M16 · O05–O07 ·
P03–P05 · Q, R completas · S01–S03, S05 · T02–T05, T07–T09, T11–T14 · U01, U02, U05–U07 · V03–V05 ·
W03–W08 · X, Y, Z completas.

## Sospechas: confirmadas / descartadas

| Checklist | # | Resultado | Evidencia | Track |
|---|---|---|---|---|
| 024a | S1 🔴 | **Confirmada** | Secretaria sede 1 exporta 133 alumnos de la sede 2 y 205 con `branch_id: null` (RUT, email, teléfono) | `ASG-i-042` → `0009-i` (en curso) |
| 024a | S2 🔴 | **Confirmada** | Secretaria sede 1 baja la ficha PDF de una matrícula de la sede 2 (HTTP 200) | `ASG-i-042` → `0009-i` (en curso) |
| 024a | S3 🟠 | **Confirmada** | Excel 72 filas vs 64 en pantalla; expediente siempre "Pendiente"; la Papelera exporta activos | B1 |
| 024a | S4 🟠 | **Confirmada** | `chk_expires_at_draft_only` + la lista excluye borradores → KPI siempre 0; "Contactar" no tiene `(click)` | B9 |
| 024a | S5 🟠 | **Confirmada** | `enrollments` no está en `supabase_realtime`; un alumno nuevo no aparece sin recargar | `ASG-i-056` |
| 024a | S6 🟡 | **Confirmada** | La pantalla de secretaria no tiene el `effect()` de sede ni pasa `showSedeColumn` | B7 |
| 024a | S7 🟡 | **Confirmada** | `_trashView` vive en el facade singleton y no se resetea al salir | B4 |
| 024a | S8 🟡 | **Confirmada** | El `error` del facade no se muestra; se ve el estado vacío | B5 |
| 024a | S9 🟡 | Confirmada en código | `created_at.slice(0, 10)` (UTC), en pantalla y en la exportación | `ASG-i-054` |
| 024a | S10 🟡 | **Confirmada** (mitad) | Escape cierra el modal mientras archiva. La otra mitad se descarta: un alumno con matrícula pero sin pagos ni clases cae en el modal simple | B6 |
| 024a | S11 🟡 | **Confirmada** | "Con deuda" usa solo la matrícula B más reciente | B8 |
| 024a | S12 🟡 | **Confirmada** | Opciones fijas; falta "Refuerzo Clase B" | B3 |

| 024b | S1 🔴 | **Confirmada** (parcial) | Secretaria sede 1 edita por `update-student-profile` a un alumno `E2E-` de la sede 2. No se probó contra admin/instructor reales | `ASG-i-043` |
| 024b | S2 🔴 | Confirmada en código, **no ejecutada** | La función no lee `Authorization` ni llama `getUser()`. No se llamó porque escribe en Storage | `ASG-i-042` |
| 024b | S3 🟠 | Confirmada en código | 5 de las 7 tablas del canal no están en `supabase_realtime` | `ASG-i-056` |
| 024b | S4 🟠 | **Mitad corregida, mitad vigente** | `fix-263-m` sacó el borrador del selector; la matrícula principal sigue siendo `sorted[0]` sin filtrar | B15 |
| 024b | S5 🟠 | **Corregida** por `fix-263-m` | El botón desaparece y el estado pasa a "Egresado" | |
| 024b | S6 🟠 | **Confirmada** | Ex-Alumnos usa `enrollments.updated_at`; marcar ex-alumno no lo actualiza | B16 |
| 024b | S7 🟠 | Confirmada en código, **no ejecutada** | `reprogramarClase()` deja la sesión en `scheduled` sin archivar la asistencia (`archived_at` solo se escribe en el flujo masivo) | por crear, coordinar con `ASG-i-027` |
| 024b | S8 🟠 | **Confirmada** | Mensaje genérico con email duplicado | B17 |
| 024b | S9 🟠 | Confirmada en código | La ficha no tiene ninguna acción de Documentos. Requiere decisión (Q01) | ⏸ decisión |
| 024b | S10 🟠 | **Parte corregida, parte vigente** (código) | `fix-262-m` quitó el requisito de nota. La ficha sigue llamando `generarCertificado()` sin `force`, y la función solo acepta el bypass de admin con `force: true` | por crear |
| 024b | S11 🟡 | Confirmada en código | Nombre, dirección, email y logo de "Conductores Chillán" fijos en la función | por crear |
| 024b | S12 🟡 | **Confirmada** | Solo con navegación interna de la SPA | B12 |
| 024b | S13 🟡 | **Confirmada** | "Cargando…" para siempre | B13 |
| 024b | S14 🟡 | **Confirmada** | Cualquier refresco vuelve a la matrícula más reciente | B21 |
| 024b | S15 🟡 | **Confirmada** | La tarjeta no pasa `?from=ex-alumnos` | B20 |
| 024b | S16 🟡 | Confirmada en código | Tasas y opiniones sin filtro de sede; municipal y psicotécnico son el mismo número | ⏸ decisión (X02/X04) |
| 024b | S17 🟡 | **Confirmada** | `students.created_at.slice(0, 10)` | B14 (formato) · `ASG-i-054` (UTC) |
| 024b | S18 🟡 | Confirmada en código | El `setTimeout` de 1,2 s cierra el drawer que esté abierto; la invitación usa el email del formulario | por crear |
| 024b | S19 🟡 | Sin ejecutar | Requiere decisión (I08) | ⏸ decisión |
| 024b | S20 🟡 | Sin ejecutar | Necesita clases sembradas | pendiente |

Descartado: **P08** (RLS de `students`/`enrollments` por sede) funciona bien para lectura, y por
escritura la secretaria tampoco puede archivar alumnos ni cambiar matrículas de otra sede.

## Bugs encontrados

Cada uno va a su propio fix/hotfix; acá solo se listan. Los tests de `e2e/` marcados con
`knownBug('Bn')` describen el comportamiento correcto y hoy fallan a propósito.

| # | Descripción | Gravedad | Track |
|---|---|---|---|
| B1 | **La exportación de la lista no coincide con la pantalla** (`export-students`): incluye "Finalizado" y solo-Profesional, no conoce "Docs Pendientes", calcula el expediente con 4 documentos y el nombre viejo `foto_carnet` (siempre "Pendiente"), busca sin ignorar tildes ni tokenizar, y desde la Papelera exporta los activos. Toca el mismo archivo que `0009-i` (Ignacio): coordinar | 🟠 Media | por crear |
| B2 | **Buscar por RUT solo funciona con el formato guardado.** Sin puntos, sin guion o parcial no encuentra. Agravante: los 200 alumnos del seed están guardados sin puntos y los reales con puntos | 🟠 Media | ✅ `fix-267-m` |
| B3 | **Filtro Curso con opciones fijas**: no se puede filtrar "Refuerzo Clase B" | 🟡 Baja | por crear |
| B4 | **La Papelera queda "pegada"** al salir de la pantalla y volver | 🟡 Baja | por crear |
| B5 | **Un error de carga se ve como lista vacía** ("No se encontraron alumnos"), con KPIs en 0 | 🟡 Baja | por crear (relacionado con `ASG-i-055`) |
| B6 | **El modal de archivar se cierra con Escape/clic afuera mientras archiva**; la operación termina igual y el usuario no ve el resultado en el modal | 🟡 Baja | por crear |
| B7 | **Secretaria con grant multi-sede**: la lista no recarga al cambiar de sede y nunca muestra la columna Sede | 🟡 Baja-Media | por crear |
| B8 | **"Con deuda" y el saldo ignoran matrículas B anteriores** con deuda | 🟡 Baja | por crear |
| B9 | **KPI "Por Vencer" siempre 0 y drawer siempre vacío**; el drawer habla de "cuotas" y "Contactar" no hace nada. Requiere decisión: qué debe medir (D05/N02) | 🟠 Media | por crear, tras decisión |
| B10 | Tiempo real de la lista muerto | 🟠 Media | `ASG-i-056` |
| B11 | El error de la ficha no dice qué pasó: "Error al cargar la ficha del alumno" tanto si el id no existe como si es de otra sede | 🟡 Baja | por crear |
| B12 | **El error de la ficha queda "pegado"**: tras una ficha con error, la del alumno anterior se sigue viendo con error hasta recargar | 🟡 Baja | por crear |
| B13 | **Id no numérico en la URL** deja la ficha en "Cargando…" para siempre | 🟡 Baja | por crear |
| B14 | Fecha de ingreso en formato `aaaa-mm-dd` | 🟡 Baja | por crear (junto con `ASG-i-054`) |
| B15 | **Un borrador más reciente se muestra como matrícula principal de la ficha** (número, curso, 0 clases), aunque exista una matrícula activa. Resto de S4 que `fix-263-m` no cubrió | 🟠 Media | ✅ `fix-265-m` |
| B16 | **La "fecha de egreso" de Ex-Alumnos es `updated_at`**: un alumno marcado hoy aparece con el año del último cambio de su matrícula y puede quedar fuera de "Últimos 12 meses" | 🟠 Media | ✅ `fix-266-m` |
| B17 | **Email duplicado en "Editar Perfil" muestra un error genérico** | 🟠 Media | por crear (mismo patrón que `fix-029-i`) |
| B19 | Secretaria edita usuarios de otra sede | 🔴 Alta | `ASG-i-043` |
| B20 | "Ver ficha" desde una **tarjeta** de Ex-Alumnos: "Volver" lleva a la Base de Alumnos | 🟡 Baja | por crear |
| B21 | **El selector de matrícula "salta"** a la más reciente después de cualquier refresco | 🟡 Baja | ✅ `fix-265-m` |

B18 no se usa: la sospecha (una secretaria archiva alumnos de otra sede) se descartó al probarla.

Sin número todavía, confirmados solo en código (ver tabla de sospechas): S7 (reprogramar una clase
con inasistencia no archiva la asistencia), S10 (bypass de admin sin `force`), S11 (carnet con la
marca de una sola sede), S18 (cierre diferido de Editar Perfil).

## Decisiones de negocio pendientes

Siguen abiertas todas las de §5 de ambos checklists, salvo **B05/O01 de `024b`** (resuelta en
`fix-263-m`: el estado de la ficha es el de la matrícula elegida). Las que bloquean un bug ya
confirmado:

| Caso | Pregunta | Bloquea |
|---|---|---|
| `024a` D05 / N02 | ¿Qué debe medir "Por Vencer"? | B9 |
| `024b` Q01 | ¿La ficha debe abrir los documentos del alumno? (el botón existía en `0006-i` AC3) | S9 |
| `024b` F04 / F13 | ¿Se permite reprogramar individualmente una clase con inasistencia, y queda en el historial? | S7 |
| `024b` X02 / X04 | ¿Qué miden las tasas y opiniones, y por sede? | S16 |
| `024b` C05 / T11 | ¿Qué matrícula abre por defecto la ficha de un alumno con varias? | — (`fix-265-m` dejó "la más reciente que no sea borrador, cancelada ni pago pendiente", igual que la Base; revisar si se quiere otra regla) |

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
  `fix-267-m` quedan 16 marcados (9 en la lista, 7 en la ficha), y la ficha suma un test del
  trigger de `completed_at`.
- Última verificación (2026-10-01): 4 corridas completas con 57/57 esperados y 0 inesperados, y
  sin datos `E2E-` sobrantes en la BD. Una quinta corrida, hecha justo después de unas 25
  seguidas, falló en el login de 2 roles (30 s sin llegar al dashboard) y la siguiente volvió a
  pasar completa: no se investigó la causa (posible límite de inicios de sesión de Supabase).
