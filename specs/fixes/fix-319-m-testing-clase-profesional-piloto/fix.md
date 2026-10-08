# Fix: Testing — Clase Profesional en el piloto (Alumnos Profesional, Promociones, Libro de clases)
> id: fix-319-m-testing-clase-profesional-piloto
> refs: ASG-i-025
> status: done
> closed: 2026-10-07
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

**Decisiones tomadas en el bloque 2 (Matías, 2026-10-06):**

| # | Caso | Pregunta | Decisión |
|---|---|---|---|
| D13 | A07 / A11 | Al aceptar "Conmutar Sede", ¿se queda en la pantalla actual? | ✅ **Navega al ítem** que se cliqueó, además de cambiar la sede. |
| D14 | A09 / S22 | Al salir de una pantalla Profesional, ¿en qué sede queda el selector? | ✅ **En la que tenía antes de entrar** ("Todas" si venía de "Todas"), y se guarda igual que se muestra. |
| D15 | H06 | Inasistencias, Reagendamientos, Ficha Técnica y "Generar Carnet" en la ficha Profesional | ✅ **Se ocultan los 4 en modo Profesional**; Clase B no cambia. |
| D17 | (Matías, nuevo) | Ficha del alumno: ¿se puede cambiar la sede del topbar? | ✅ **No: toda ficha (B y Profesional) bloquea el selector en la sede de la matrícula abierta**, sigue a la pestaña elegida y al salir vuelve a la sede previa (`fix-342-m`). |
| D16 | F03 | Tarjetas móviles angostas (patrón compartido) | ✅ **Fix propio que corrige el patrón en todas las pantallas** que lo usan, no solo las bases de alumnos. |

**Pendiente de modelar, para hablar con el dueño (no bloquea este track):** el **desertor** de
Clase Profesional — alumno que abandona, vuelve tiempo después a pedir el certificado y el dueño lo
integra a una promoción posterior. Hoy no existe ni el estado ni el movimiento entre promociones;
cuando se modele, se define dónde se ve (y D2 se revisa).

**Efecto en el alcance:** D3a habilita la vista **Archivo** de Clase Profesional en el piloto, así
que pasa a ser parte del testing (bloque 3). Al revisarla apareció una sospecha nueva:

- **S23** (🟡 Baja-Media) — Archivo lista las promociones finalizadas **sin filtrar por sede**
  (`archivo-profesional.facade.ts:134-138`); solo la lista de alumnos filtra por sede (línea 212).

## Datos de prueba

**Qué trae la BD de desarrollo (2026-10-05, solo lectura):** la Base Profesional (sede 2) lista 60
alumnos del seed, todos con matrícula `active` pero **sin promoción** (`promotion_course_id` NULL,
columna "—"). En promociones vigentes (280/281) no había ninguna matrícula; la única matrícula con
promoción es `completed` (promoción 277, 1 alumno). Promociones: 278–280 en curso, 281–282
planificadas, 275–277 y 100–103 finalizadas.

**Sembrados y DEJADOS a propósito** (autorizado por Matías, 2026-10-05) para `fix-330…333` y los
bloques 2–5. Creados por API como admin; Nº de matrícula = correlativo real de su serie vía
`get_next_enrollment_number()` pedido justo antes de cada INSERT (DG-080). Comprobado después: la
serie Profesional sede 2 sigue en `0096` y la Clase B sede 2 en `0074`.

| Alumno | user / student | RUT | Matrículas (id · Nº · curso) | Sirve para |
|---|---|---|---|---|
| E2E-ProfA2 Prueba Profesional | 7619 / 7333 | 99.776.111-1 | 6981 · 0092 · A2 en 280.2 | columna Promoción (330), datos ocultos (332) |
| E2E-ProfDoble Prueba Profesional | 7620 / 7334 | 99.949.296-7 | 6982 · 0093 · A2 en 280.2; 6983 · 0094 · A4 en 281.4 | 2 matrículas Prof. (331) |
| E2E-ProfConB Prueba Profesional | 7621 / 7335 | 99.563.148-2 | 6984 · 0095 · A3 en 280.3; 6985 · 0073 · Clase B | aviso al archivar con B (333) |

Todas `active`, `pending_balance` 180.000, `payment_status` pending, sin pagos, sin cuenta Auth.
Script: `seed-prof.cjs` (scratchpad de la sesión del 2026-10-05).

## Resultados

### Bloque 1 — Seguridad (S1, S2 residuales, S6)

Ejecutado el 2026-10-05 contra la BD de desarrollo (`skvekggejikzxhzsjmkz`) con scripts de API
(supabase-js). Atacante: `secretaria@test.com` (sede 1, sin Profesional, sin grant multi-sede).
Víctima: sede 2.

| Caso | Res. | Evidencia |
|---|---|---|
| **S6 — lectura** | ❌ | secretariaA lee de la sede 2: 12 `professional_promotions`, 48 `promotion_courses`, 25 `class_book`. Las políticas vigentes son las de `20260301000011_10_rls_policies.sql:489-529,666-676` (+ `select_class_book` de `20260303120000`): solo `auth_user_role() IN ('admin','secretary')`, sin sede; ninguna migración posterior las cambió. |
| **S6 — escritura** | ❌ | Promoción desechable creada por admin en sede 2 (`E2E-S6 prueba RLS`, id 23, `cancelled`, 2099-01-05). secretariaA la **editó** (UPDATE → 1 fila) y la **borró** (DELETE → 1 fila). No quedó nada que limpiar. Con el `status` habría disparado S4 (alumnos a `completed`). **El motivo por el que `0047-b` excluyó estas tablas ("el módulo está bloqueado en el piloto") ya no se cumple:** Promociones y Libro están visibles. → **bug propio.** |
| **S1 — sin sesión** | ✅ regresión | Corregido por `fix-043-i` (`requireStaff(['admin','secretary'])`). |
| **S1 — sede** | ✅ aceptado | secretariaA pidió el PDF del curso 54 (promoción 279, sede 2): **200**, URL firmada, PDF de 367 KB descargado. El storage directo sí la bloquea ("Object not found", `20261001200000_storage_aislamiento_por_sede.sql`); la función lo salta con la clave de servicio. **No es bug:** `0009-i` decidió no validar la sede en el servidor (Ignacio, 2026-10-01), mismo criterio que Matías ratificó para el carnet (`fix-264-m` J08). |
| **S1 — teléfono** | — | El PDF **no** imprime teléfono (corrige el checklist). La función lo consulta igual (`index.ts:107,199`) sin usarlo: campo muerto, conviene dejar de pedirlo. |
| **S1 — reabre el libro** | ✅ sin efecto | El `upsert` pone `status = 'active'` aunque el libro esté `in_review` (lo pone el trigger `trg_class_book_lifecycle` al cambiar el estado de la promoción) — nada en la app pasa un libro a `closed`. **Ni `in_review` ni `closed` se usan en `src/`**: el ciclo de vida del libro hoy no tiene efecto visible. Se anota, no se abre fix. |
| **S2 — sin sesión** | ✅ regresión | Corregido por `fix-043-i` (solo claim `service_role`). |
| **S2 — hasta 10 por llamada** | ❌ por lectura | No se ejecutó (requiere la service key y crearía promociones reales). Confirmado leyendo el código: `reserve_next_promotion_slot` solo corta con `in_progress >= 1 AND planned >= 2` (`20260829110000…sql:68-70`); con 0 en curso nunca se cumple y el loop de la función (`index.ts`, `for i < 10`) reserva 10 planificadas por llamada. Pasa si la única en curso se finaliza o cancela a mano — justo lo que D3b permite. → **bug propio.** |
| **S2 — placeholder** | ❌ por lectura | La reserva (INSERT con `end_date = start_date`) y el armado (UPDATE de nombre/fecha de fin, cursos, libros) no son atómicos: si falla el fetch de feriados o un INSERT, la promoción queda planificada, sin cursos, y cuenta para el colchón. Mismo fix que el anterior. |

**Bug nuevo encontrado (S24):** 🟡 **Generar el PDF le borra la sede al libro.** (Impacto bajo hoy:
solo la sede 2 tiene Clase Profesional y siempre será así — Matías, 2026-10-05 —, por eso no se
había notado. Se corrige igual.) La consulta de la
función pide `branches(name, address)` **sin `id`** (`generate-class-book-pdf/index.ts:92`), así
que `branch?.id` es siempre `undefined` y el `upsert` escribe `branch_id = null` (`:130,267`), aun
si el libro ya tenía sede. En la BD de desarrollo: **13 libros con `branch_id = null`**, los 9
`active` y 4 `in_review` — todos de promociones de la sede 2. Viene desde el commit que creó el
módulo (`d75c2777`). Bloquea S6: un RLS por sede sobre `class_book` dejaría esos libros fuera
(`branch_visible()` con NULL, ver `0047-b`), así que el fix de S6 tiene que corregir la función y
rellenar la sede de esas filas antes.

### Bloque 2 — A–I: acceso, Base Alumnos Profesional, Papelera, ficha, links bloqueados

Ejecutado el 2026-10-06 en navegador (Playwright MCP, `ng serve` local, BD de desarrollo) con
admin, secretariaB (sede 2), secretariaA (sede 1) y secretaria multisede, sobre las pantallas ya
corregidas por `fix-320…333`. Datos: los 3 alumnos E2E-Prof* + los 60 del seed. Al terminar, la BD
queda igual que al empezar (E2E-ProfConB se archivó y se restauró).

**A — Acceso, menú y guards**

| Caso | Res. | Evidencia |
|---|---|---|
| A01 | ✅ | Admin: 4 ítems (Base Alumnos Prof., Promociones, Libro de Clases, **Archivo** — el cuarto por D3a). |
| A02 | ✅ | secretariaB: los mismos 4 ítems. |
| A03 | ✅ | secretariaA: sin grupo "Academia Profesional". |
| A04 | ✅ | secretariaA: las 3 URLs + `/profesional/archivo` → `/app/secretaria/dashboard`. |
| A05 | — | No hay cuenta de secretaria sin sede. No se ejecutó. |
| A06 | ✅ | secretariaB en las 3 URLs de admin → `/app/secretaria/dashboard`. |
| A07 | ⚠️ decisión | Desde "Todas" el clic en un ítem Profesional **navega directo** y cambia sola a Conductores Chillán (sin modal). Desde una sede **sin** Profesional (Autoescuela Chillán) aparece el modal "Conmutar Sede"; al aceptar cambia la sede pero **se queda en la pantalla actual**: hay que volver a hacer clic. |
| A08 | ✅ | Selector fijo en Conductores Chillán; "Todas" y Autoescuela Chillán deshabilitadas con "Solo sedes con Clase Profesional". |
| A09 | ❌ | Multisede: Autoescuela → (conmutar) Conductores → Base Prof. → Base B: el selector muestra **"Todas las sedes"**, pero tras F5 muestra **Conductores Chillán** (`setProfessionalOnly(false)` pone `null` sin persistir). Lo que se ve y lo que queda guardado no coinciden. S22. |
| A10 | ❌ | Al recargar, la pantalla Profesional queda en la sede **guardada**, no en la Profesional: `setProfessionalOnly(true)` corre antes de que carguen las sedes y no se reevalúa (`branch.facade.ts:233-247`). Además, entrar por el menú desde "Todas" cambia la sede **visible** a Conductores sin guardarla. Verificado: (1) desde "Todas" → menú Promociones (se ve Conductores, guardada "Todas") → F5 → **"Todas las sedes"** con "Programar Promoción" habilitado (crearía con `branch_id = null`); (2) entrar por URL/marcador con Autoescuela guardada → queda en **Autoescuela Chillán**, "0 matrículas" (esperado 9 s). Entrar desde otra sede vía "Conmutar Sede" sí guarda Conductores y sobrevive al F5. S22. |
| A11 | ✅ | Multisede con sede sin Profesional → modal "Conmutar Sede" → cambia a Conductores Chillán (mismo "no navega" de A07). |
| A12 | ✅ | Admin y secretaria: relatores, asistencia, evaluaciones, certificados, pre-inscritos y ex-alumnos-profesional → `/modulo-no-disponible`. Archivo abre (D3a). |
| A13 | ✅ | "Volver al inicio" → `/app/admin/dashboard` con la sesión intacta. |

**B–F — Base Alumnos Profesional**

| Caso | Res. | Evidencia |
|---|---|---|
| B01 | ✅ parcial | D1 (E2E-ProfA2) aparece. **No hay datos D2/D3** (ninguna `license_validations` en la BD) ni D4 (`inactive` ya no existe, D2). |
| B03 | ✅ | La única matrícula `completed` (Samuel José Merino, 0031) no aparece. |
| B04 | ✅ | E2E-ProfConB (B + Prof.) sale con Nº 0095, Promoción 280 · A3 y el saldo de la Profesional. |
| B05 / D01 | ✅ | E2E-ProfDoble: 2 filas (0093 y 0094); chip y KPI "64 matrículas" = 64 filas `active` de la BD. |
| B06 | ✅ | Archivado → solo en la Papelera (ver G05). |
| B07, H03 | — | No hay matrículas Profesional `draft` en la BD. No se ejecutó. |
| B08 | ✅ | Orden por matrícula descendente (0095, 0094, 0093, 0092, 0091…). |
| B09 | — | Depende de `ASG-i-023` (wizard). No se ejecutó. |
| C01, C02, C04, C09, C10 | ✅ | Iniciales "EP" en tarjeta; "Apellidos Nombres" + RUT; todos con Nº; "Activo"; saldo 180.000 CLP = ficha. |
| C05 | ✅ | "Promoción 280" con la categoría debajo (D11, `fix-330-m`); sin promoción, "—". |
| C06, E05 (convalida) | — | Sin datos de convalidación. Filtro A4 sí funciona (16 resultados). |
| C07, C08, D04 | ✅ | Columnas Módulos / Asistencia y KPI "En riesgo" ya no están (D12, `fix-332-m`). |
| C03, C11, E02 | — | El seed no tiene nombres con tilde/ñ, sin materno ni muy largos. |
| D02, D03 | ✅ | Activas 64; Con deuda 19 = matrículas activas con `pending_balance > 0` en la BD. |
| D05 | ✅ | Los KPIs no cambian al buscar (64/64/19 con y sin filtro). |
| D06 | ⚠️ observación | En la Papelera los KPIs cuentan al archivado como "Activas 1" (la matrícula sigue `active`); se lee raro. Chip "1 matrículas" sin singular. |
| E01, E03, E04 | ✅ | Nombre, apellido, "nombre apellido", "apellido nombre", mayúsculas, RUT con/sin puntos y guion, Nº de matrícula. |
| E06, E07 | ✅ | El filtro Estado ya no existe (D2, `fix-329-m`). |
| E08, E09, E10, E11 | ✅ | El select ofrece "Todas las clases"; "Limpiar filtros" resetea todo; contador = filas; buscar desde la página 3 muestra los resultados. |
| F01 | ✅ | "Mostrando 61 a 64 de 64" en la última página. Detalle: dice "alumnos" y son matrículas (D10). |
| F02 | ✅ | `scrollHeight` = `clientHeight` (900): el documento no scrollea. |
| F03 | ❌ | A 375 px se ven tarjetas sin scroll horizontal, pero **la tarjeta mide 183 px de 343 disponibles**: se suman el padding de la card (24), el de `.mobile-view` (16) y el del `.bento-grid` interno (16) por lado. El nombre se corta ("Prue…") y las etiquetas "PROMOCIÓN" y "SALDO" se montan. **Compartido:** la Base B mide lo mismo (184 px); el patrón `mobile-view` + `bento-grid` está en ~10 pantallas. |
| F04, F05 | — | No ejecutados (requieren drawer abierto / >20 tarjetas medidas a mano). |
| F06 | ✅ | La tarjeta tiene ver y archivar. |
| F07 | ❌ | Con las consultas a `enrollments` y `professional_promotions` abortadas: la Base muestra "No hay alumnos profesionales · Limpiar filtros" y Promociones "No se encontraron promociones". Ningún mensaje de error. S14. Además la consulta de matrículas sale **dos veces** en el mismo milisegundo (S16). |

**G — Archivar y Papelera**

| Caso | Res. | Evidencia |
|---|---|---|
| G02 | ✅ | E2E-ProfConB (sin pagos): modal simple, sin "borrarlo". |
| G03 | ✅ | Doble clic en el tacho → un solo modal. |
| G04 | ✅ | Modal con el aviso de Clase B (D8, `fix-333-m`); al archivar desaparece de las dos bases; al restaurar vuelve a ambas. |
| G05, G07 | ✅ | Ciclo archivar → Papelera → restaurar (sin confirmación) → vuelve con los mismos datos; "← Alumnos Profesional" vuelve a la lista activa. |
| G06 | ❌ | Papelera → Promociones (menú) → Base Alumnos Prof. (menú): **sigue abierta la Papelera** (estado en el facade singleton). Criterio acordado: los filtros/vistas solo se conservan al volver desde el detalle. Detalle: el estado vacío de la Papelera dice "Ajusta los filtros o registra nuevas matrículas profesionales". |
| G01, G08 | — | Ningún alumno Prof. de prueba tiene pagos; no se simuló falla al archivar. |
| G09 | — | Resuelto por D9; se verifica en el bloque 3/4 (Libro y "Ver promoción"). |

**H — Ficha desde la lista Profesional**

| Caso | Res. | Evidencia |
|---|---|---|
| H01 | ✅ | Admin y secretariaB: E2E-ProfA2 abre `/app/{admin,secretaria}/alumnos/7333` en modo Profesional ("PROFESIONAL A2 · MATRÍCULA #0092"). |
| H02 | ❌ | E2E-ProfConB desde la Base Prof. abre **"CLASE B · MATRÍCULA #0073"** con 12 clases prácticas, y el enlace de vuelta es "Listado de Alumnos" (Base B). Causa: la lista y la tarjeta Profesional no pasan `?enrollment=` (la Base B sí, `alumnos-list-content.component.ts:492`, `fix-272-m`). S17. |
| H04, H05 | ✅ | Tarjeta "Asistencia y evaluaciones aún no habilitadas" en vez de cards vacías y sin botón de certificado (D12). |
| H06 | ⚠️ decisión | "Generar Carnet" deshabilitado. Además la ficha Profesional muestra **Inasistencias** (con "Registrar Nueva"), **Reagendamientos** y **Ficha Técnica** ("Desempeño en clases prácticas"), los tres de Clase B. |
| H07 | ✅ | "Listado de Alumnos Profesionales" → `/app/{admin,secretaria}/profesional…/alumnos`. |
| H08 | ✅ | secretariaA con la ficha 7333 (sede 2) por URL: "Error al cargar la ficha · El alumno no existe o no tienes acceso". |

**I — Links a módulos bloqueados**

| Caso | Res. | Evidencia |
|---|---|---|
| I01, I02 | ✅ | El hero no tiene botón "Pre-inscritos" (admin y secretaria). La URL lleva a `/modulo-no-disponible`. |
| I04 | ✅ por regresión | Cubierto por `fix-328-m` (cerrado 2026-10-05); no se sembró una notificación nueva. |
| I05 | ✅ | `?from=ex-alumnos` vuelve a Ex-Alumnos Prof. (bloqueado), pero ese parámetro solo lo genera esa pantalla: inalcanzable en el piloto. |
| I09 | ✅ | Ningún botón de la Base ni de la ficha Profesional lleva a un módulo bloqueado. |
| I10 | ❌ | El buscador global (Ctrl+K) **no encuentra a E2E-ProfA2** (solo Profesional); a E2E-ProfConB sí, porque busca sobre `AdminAlumnosFacade` (Base B, `global-search.facade.ts:125-138`), y abre su ficha en la matrícula B con "Agendar Clase". |
| I06–I08 | — | Bloques 3 y 4. |

### Bloque 3 — J–N: Promociones

Ejecutado el 2026-10-06 en navegador (Playwright MCP, `ng serve` local, BD de desarrollo) con
admin y secretariaB (sede 2), sobre las pantallas ya corregidas por `fix-320…342`. Las
verificaciones de BD son lecturas por API con la sesión del usuario.

**J — Lista, KPIs y filtros**

| Caso | Res. | Evidencia |
|---|---|---|
| J01 | ✅ | Admin y secretariaB: tabla con 5 promociones, consola sin errores, red sin 4xx/5xx. |
| J02 | ✅ | En curso (280, 279, 278) → cancelada → planificadas (282, 281); fecha descendente dentro de cada grupo. |
| J03 | ✅ | Nombre + número, fechas dd/MM/yyyy, "3 / 100", badges con tooltip "Taxis y colectivos: 2/25 alumnos", estado. Detalle: la tabla usa `05/10/2026` y el detalle/editor `05-10-2026`. |
| J04 | ✅ | Total 5 · En curso 3 · Planificadas 2 · Canceladas 0 = tabla (y 6/3/2/1 tras cancelar la de prueba). |
| J05 | ✅ | Por número ("281") y por nombre ("septiembre", "SEPTIEMBRE"). Detalle: "1 promociones encontradas" sin singular. |
| J06, J08 | ✅ | El filtro ya no ofrece "Finalizada" (D3a): Todos / Planificada / En curso / Cancelada. Las finalizadas se consultan en Archivo (ver abajo). |
| J07 | ✅ | "Limpiar filtros" (barra y estado vacío) resetea búsqueda y estado. El select no tiene "x", pero ofrece "Todos los estados". |
| J09 | ✅ | 280 muestra 3 (E2E-ProfA2, E2E-ProfDoble, E2E-ProfConB) y 281 muestra 1; la consulta cuenta `active` + `completed` y descarta personas archivadas (D9, `fix-327-m`). |
| J10 | ❌ | 375 / 768 / 1024 px y con un drawer abierto: tarjetas, sin scroll horizontal del documento ✅. **A 1280×800 la tabla sí se muestra pero no cabe:** el contenedor mide 888 px y la tabla 947 → scroll horizontal dentro de la card, la columna "Acciones" queda cortada ("ACC") y el botón **Editar no se ve** sin desplazar. Además los 4 badges de curso se apilan en vertical y cada fila mide ~120 px (se ven 2,5 filas). |
| J11 | ✅ por regresión | Cubierto por `fix-338-m` (F07). |

**K — Crear promoción** (admin; promoción de prueba Nº 9001, lunes 30-11-2026)

| Caso | Res. | Evidencia |
|---|---|---|
| K01 | ✅ | 8 lunes desde hoy; los que ya tienen promoción (19-10, 02-11) deshabilitados (D6). Ya no hay "sugeridos". |
| K02 | ✅ por decisión | D6: cualquier lunes libre. ⚠️ El recuadro "Reglas de negocio" del drawer todavía dice "Inicio solo en lunes, **cada 2 semanas**". |
| K03 | ✅ | Nombre automático "Promoción 283 (12 de Octubre 2026)"; término "Calculando…" → fecha. |
| K04 | ❌ | La fecha de término se extiende bien dentro del mismo año (12-10 → 17-11; 26-10 → 30-11; 09-11 → 14-12) y las sesiones de los feriados quedan `cancelled`. **Pero no se consideran los feriados del año siguiente:** la promoción del 30-11-2026 termina el 05-01-2027 (debía ser el 06-01) y su sesión del **01-01-2027 queda `scheduled`**. Causa: `fetchHolidaysForYears` solo pide el año siguiente si la promoción parte en diciembre (`promociones.facade.ts:454`), y la edge function del cron tiene la misma condición (`_shared/holidays.ts:62`) → **le va a pasar a la automática 284 (30-11-2026)**. No se vio el toast "Se marcaron N feriado(s)". |
| K05 | ✅ parcial | En esta máquina `apis.digital.gob.cl` no resuelve (6 errores en consola): entró el respaldo `api.boostr.cl` y las fechas salieron bien. No se probó con las dos caídas. |
| K06 | ✅ | 26-10 → 09-11 → 30-11 seguidos: queda la fecha de término del último. |
| K07 | ✅ | Sin fecha, "Crear promoción" deshabilitado. También con número vacío ("El número es obligatorio"), letras, negativo o decimal ("Debe ser solo números"). ⚠️ Acepta `0`. |
| K08 | ✅ parcial | A2 ofrece solo sus 2 relatores; se asignaron ambos y quedaron guardados. No se probó quitar con la "x". |
| K09 | ✅ | Toast "Promoción creada correctamente"; aparece Planificada con número 9001, 4 cursos `9001.2…9001.5` (25 c/u) y 32 sesiones teóricas + 32 prácticas por curso, sin domingos. Un solo INSERT de promoción (el botón se deshabilita al primer clic → K11 ✅). No crea `class_book` (las automáticas sí) → S8, bloque 4. |
| K10, L08 | ✅ | Número repetido (280) al crear y (281) al editar: toast "El número 280 ya lo usa otra promoción. Elige otro."; no se guarda. El formulario no lo avisa antes de enviar. |
| K12 | — | No ejecutado (S20, requiere cortar la red a mitad). |
| K13 | ✅ | Cancelar cierra el drawer y no crea nada. |
| K14 | ✅ | secretariaB no tiene "Programar Promoción" (D5). |

**L — Ver, editar y cambiar estado**

| Caso | Res. | Evidencia |
|---|---|---|
| L01 | ✅ | 280: datos, "Día de clase 2 de 30", alumnos por categoría (A2 2/25, A3 1/25), cursos con "Sin relator asignado". |
| L02 | ✅ | Alumnos de A2: nombre, RUT y "Activo"; curso vacío: "Sin alumnos inscritos en este curso". |
| L03 | ✅ | "Editar promoción" abre el editor apilado con nombre y número precargados. |
| L04 | ✅ con observaciones | 9001 → 9002: se guarda y los cursos pasan a `9002.2…9002.5`. ⚠️ **El nombre no sigue al número:** queda "Promoción 9001 (30 de Noviembre 2026)" con número 9002. ⚠️ **Doble clic en "Guardar cambios" guarda dos veces** (2 toasts "Promoción actualizada correctamente"); crear sí está protegido. |
| L05, L06, L07 | ✅ | Número con letras: mensaje + botón deshabilitado, también si además cambió el nombre (S7 corregido). Nombre vacío o solo espacios: botón deshabilitado (sin mensaje). |
| L09 | ✅ | Planificada futura: solo Planificada / Cancelada + "Podrás cambiarla a En curso a partir del 30-11-2026". |
| L10 | — | No hay una planificada con inicio hoy o pasado. |
| L11 | ✅ | En curso → Finalizada (admin): modal "3 alumnos con matrícula activa pasarán a completado… no se puede deshacer desde la app" (D3b, `fix-324-m`). Se canceló; 280 sigue `in_progress`. Probado con las escrituras bloqueadas en el navegador. |
| L12 | ✅ | 280 con alumnos: "Cancelada (tiene 3 alumnos activos)" deshabilitada (D4, `fix-325-m`). Sin alumnos (la de prueba): se cancela con el aviso "acción irreversible", **sin modal**; los 4 cursos pasan a `cancelled`. |
| L13 | ✅ | Cancelada: el select solo ofrece "Cancelada". |
| L14 | ✅ | Fechas no editables. |
| D5 | ✅ | secretariaB edita nombre y número; su select de estado solo ofrece el estado actual (no finaliza ni cancela). |

**M — Cadencia automática** (la función solo corre con `service_role`: M05–M09 no se ejecutan, se leen)

| Caso | Res. | Evidencia |
|---|---|---|
| M01 | ✅ | 3 en curso (278–280) y 2 planificadas (281, 282). |
| M02, M04 | ✅ | 281 = 19-10, 282 = 02-11 (14 días, lunes), números consecutivos, cursos `N.2…N.5`, un `class_book` por curso con sede 2. Nombre "Promoción N (D de Mes AAAA)", igual que las manuales desde `fix-323-m`. |
| M03, M05, M07, M09 | — | Cubiertos por `fix-322-m` (test SQL); no se re-ejecutan. |
| M06 | ✅ regresión | `fix-043-i` (bloque 1). |
| M08 | ❌ por lectura | El cron ya no falla con un lunes ocupado, pero **una manual puesta en un lunes de la cadencia más adelante hace que se salte los intermedios:** la próxima fecha es "la última de la cadencia + 14" (`20261005150000_fix323…sql:57-62`). Con una manual en el 30-11, la siguiente automática sería el 14-12 y el 16-11 no se crea nunca. Contradice D6 ("la cadencia no debe correrse por una manual"). |
| M08 (número) | ⚠️ decisión | El número de la próxima automática es "el mayor existente + 1" (`:71-74`), y el drawer sugiere lo mismo: tras la 9002 de prueba sugiere **9003**. Un número mal tipeado en una manual corre toda la numeración siguiente. |

**N — Matrícula tardía y convalidaciones**

| Caso | Res. | Evidencia |
|---|---|---|
| N01, N06 | ✅ | Paso 2 del wizard (secretariaB con A5 y admin con A2): ofrece 278, 279, 280, 281 y 282 con su cupo ("280.2 · 2 / 25"); la cancelada de prueba y las finalizadas no salen. Detalle: las promociones salen **sin orden** (280, 282, 281, 278, 279). |
| N02 | ✅ | Admin, A2 en la 280 (empezó hace 1 día): pasa a Documentos sin aviso. |
| N03 | ✅ | secretariaB con la 279: modal "Matrícula tardía · Esta promoción comenzó hace 15 días…"; "Cancelar" deja en el paso 2 sin asignar; "Sí, matricular" continúa. Admin con la 278: mismo modal ("hace 29 días"). Al volver atrás y avanzar de nuevo, el aviso se repite. |
| N04, B09 | ✅ | secretariaB matriculó a E2E-ProfConv en A5 + convalidación A3 (279.5), pago pendiente: Nº **0096** (el correlativo que tocaba), `license_validations` con `convalidated_license = A3`. Aparece primero en la Base ("Promoción 279 · A5", badge "Convalida A3" con tooltip, 65 matrículas) y en "Ver promoción" 279 → A5 1/25 "Activo". El Libro (A5 y Conv. A-3) se revisa en el bloque 4. |
| B07 | ✅ | E2E-ProfBorrador (admin, wizard dejado en el paso 3): matrícula `draft` sin número, no aparece en la Base ni suma al cupo de 280.2. |
| N05 | — | No hay un curso con 25 alumnos. Observación: el cupo del wizard cuenta toda matrícula no cancelada ni borrador, también de personas archivadas (`enrollment.facade.ts:937-941`), distinto de "Ver promoción" (D9). |

**Archivo (D3a)**

| Caso | Res. | Evidencia |
|---|---|---|
| Lista | ✅ | Admin y secretariaB: selector con buscador y las 7 finalizadas (275–277, 100–103); "No se encontraron resultados" si no hay coincidencias. |
| Detalle | ✅ | 277: mismo contenido que "Ver promoción" (información general, alumnos por categoría, cursos, relatores) + aviso "Promoción completada"; el alumno sale "Completado". Sin botón de editar ni enlaces a módulos bloqueados. Sin sección académica (oculta). |
| Visual | ✅ | 1440 / 1280 / 375 px sin scroll horizontal; el documento no scrollea en escritorio. Detalles: "1 alumnos inscritos" sin singular; placeholder "Buscar promoción (ej. Clase 123...)". |
| S23 | — | Solo la sede 2 tiene promociones; el filtro por sede lo cubre `fix-326-m`. |

**Datos de prueba que quedaron en la BD:**

- **Promoción de prueba (id 36, número 9002, cancelada, 30-11-2026): ELIMINADA** el 2026-10-06
  desde la app con "Eliminar promoción" (`fix-348-m`). El lunes 30-11 y la numeración volvieron a
  la normalidad (próximo número 283). Ya no hay ninguna cancelada en la BD: O02 (una cancelada no
  sale en el Libro) queda sin dato y sin sentido, porque el estado dejó de usarse.
- **E2E-ProfConv Prueba Profesional** — user 7639 / student 7353, RUT 99.412.301-7, matrícula 7003
  · Nº 0096 · A5 + conv. A3 en 279.5, `active`, saldo 180.000, con foto, hoja de vida y contrato de
  prueba. Sirve para los libros A5 y Conv. A-3 del bloque 4.
- **E2E-ProfBorrador Prueba Profesional** — user 7640 / student 7354, RUT 99.412.302-5, matrícula
  7004 `draft` sin número, A2 en 280.2.

### Bloque 4 — O–R: Libro de clases

Ejecutado el 2026-10-06 en navegador (Playwright MCP, `ng serve` local, BD de desarrollo) con
admin y secretariaB. Datos: 280 (A2 con E2E-ProfA2 y E2E-ProfDoble; A3 con E2E-ProfConB), 279
(A5 + Conv. A-3 con E2E-ProfConv, que ya tenía un código SENCE guardado en Conv. A-3) y 277
(finalizada, 1 alumno completado). Se exportaron 3 PDF (280 Conv. A-4, 279 Conv. A-3, 280 A2).
Al terminar el código SENCE de 280 A2 quedó vacío, como estaba.

**O — Carga y selectores**

| Caso | Res. | Evidencia |
|---|---|---|
| O01 | ✅ | Admin y secretariaB: abre en la 280 (la en curso más nueva), curso A2, pestaña Cabecera. Consola sin errores. |
| O02 | ✅ | 12 promociones: planificadas (282, 281), en curso (280–278) y finalizadas (277–275, 103–100). No hay canceladas en la BD (`fix-348-m`). |
| O03, R09 | — | Ya no existen promociones sin número (`fix-323-m`). Detalle: el selector muestra el número dos veces, "Promoción 280 (5 de Octubre 2026) (280)". |
| O04 | ✅ | A2, A3, A4, A5, Conv. A-3 y Conv. A-4. |
| O05 | ✅ | Cambiar de promoción vuelve al primer curso (A2). Al cambiar de curso la pestaña activa se conserva. |
| O06 | ✅ | A3 → A4 → A5 seguidos: queda A5 con su ID `279.5` y sus datos. |
| O07 | — | No aplica: una sola sede con Clase Profesional (S9 queda teórica). |
| O08 | ✅ | Salir y volver: carga desde cero (280 · A2 · Cabecera). |
| O09 | — | No hay promociones sin cursos ni sin sesiones. |

**P — Secciones en pantalla**

| Caso | Res. | Evidencia |
|---|---|---|
| P01 | ✅ | Autoescuela, curso, ID (`279.5`), promoción, fechas, dirección y horario. |
| P02 | ✅ | 7 módulos con "—" (sin relatores); Conv. A-3: módulos 3, 4, 5, 6, 7; Conv. A-4: 2, 4, 5, 6, 7. |
| P03 | ✅ | 280 A2: E2E-ProfA2 y E2E-ProfDoble en orden, con N°, RUN, teléfono y licencia. Detalle: "Lista de Clase (1 alumnos)" sin singular (también en Resumen). |
| P04, G09 | ✅ | D9: el completado de la 277 sigue en su libro. E2E-ProfConB **archivado** sigue en el libro de 280 A3, y "Ver promoción" 280 baja a 2/100 (A3 0/25). Se restauró. |
| P05 | ✅ | 279 A5: 6 semanas lun–sáb, "Semana 1 de 6", celdas "—". |
| P06, R04 | ⚠️ decisión | Pantalla: 30 filas "Clase Teórica · 5 · —" (salta el feriado 12-10). PDF: la malla real, con asignatura, materias y horas por bloque. Además el PDF trae **nombres de profesor fijos de la malla** (Alberto Ormeño, Jorge Pérez, Pablo Vargas, Horacio Labbé) aunque la promoción no tiene relatores asignados y la pantalla muestra "—". |
| P07 | ✅ | Mód. 1–7 (Conv. A-3: 3–7; Conv. A-4: 2, 4–7) y notas "—". |
| P08 | ✅ | Un alumno por fila, "—". |
| P09, N04 | ✅ | 279 Conv. A-3: solo E2E-ProfConv, licencia A3, ID `279.6`, 16 clases (07-10 → 26-10). Conv. A-4: 13 clases. En la 280 la pantalla y el PDF coinciden (26-10 → 10-11). |
| P10 | ✅ | Conv. A-4 sin alumnos: "Sin alumnos inscritos" / "Sin datos de asistencia", sin errores. |
| P11 | — | No hay dos alumnos con el mismo nombre. |
| P12 | ✅ | 1440 y 1280: el documento no scrollea. 768 y 375: sin scroll horizontal; las pestañas pasan a un desplegable. |

**Q — Código SENCE**

| Caso | Res. | Evidencia |
|---|---|---|
| Q01, Q02, Q03 | ✅ | 280 A2: al escribir se habilita "Guardar"; toast "Datos del libro guardados" y "Última modificación: PEPITO ADMI · 06-10-2026, 11:45 p. m."; persiste tras recargar. |
| Q04 | ✅ | 279: Conv. A-3 tiene `17466347457` y A5 está vacío. |
| Q05 | ❌ | 280 Conv. A-4 (libro sin fila): exportar el PDF y, sin recargar, guardar un código → toast **"Error al guardar"**; `POST class_book` responde 409 `class_book_promotion_course_conv_key`. S8 confirmada. En un libro que ya tenía fila (280 A2) no pasa. |
| Q06 | ⚠️ decisión | Se puede guardar vacío (queda auditado quién y cuándo). |
| Q07 | — | secretariaB guarda sin problema ("Última modificación: Maria Torres…"). El caso del libro `closed` no aplica: ningún flujo cierra un libro (bloque 1). |
| Q08 | ❌ | Doble clic en "Guardar": 2 `PATCH class_book`. |

**R — PDF**

| Caso | Res. | Evidencia |
|---|---|---|
| R01 | ✅ | "Generando PDF..." → descarga en ~6 s, toast "PDF generado correctamente"; `LibroDeClases_Promoción 280 5 de Octubre 2026_Curso Convalidación Clase A-4.pdf` (52 KB). También como secretaria. |
| R02 | ✅ parcial | Estructura revisada en los 3 PDF: portada, reglamento (30 artículos), antecedentes, firma diaria por semana (7 días, domingos y feriados marcados), recuperación de feriados, calendario con la malla. **No se comparó contra el libro físico página por página.** |
| R03 | ✅ | Portada "CURSO CONVALIDACIÓN CLASE A-3 / A-4", ID `279.6` / `280.7`. |
| R07 | ✅ | Tildes y ñ correctas. |
| R08 | ✅ | El código SENCE guardado sale en la portada (279 Conv. A-3); sin código, "—". |
| R10 | ✅ | Con la función abortada: toast "Error al generar PDF: Ha ocurrido un error inesperado…" y el botón vuelve a "Exportar PDF". |
| R05, R06, R12 | — | Sin datos (curso con más de 25 alumnos, curso con pocas sesiones, libro cerrado). |
| R11 | ✅ regresión | Bloque 1 (`fix-043-i`). |

**Segunda pasada del bloque 4 (2026-10-06/07), con datos temporales creados y borrados en la misma
sesión** (autorizado por Matías): 27 alumnos en 282 A2 —dos con el mismo nombre, apellidos con ñ y
tilde—, y una promoción 283 primero sin cursos y después con un curso A2 de solo 5 sesiones activas.
Al terminar no queda nada: los 27 alumnos se borraron por API (la serie Profesional vuelve a dar el
`0097`) y la 283 se eliminó desde la app.

| Caso | Res. | Evidencia |
|---|---|---|
| R02 | ✅ | PDF de 280 A2 contra `libroclases.pdf` (el libro físico A-2 que entregó el dueño, 28 páginas), comparando el texto extraído de cada página. **Calendario idéntico:** 65 bloques, 150 horas, la misma secuencia de horas bloque a bloque y los mismos conteos de asignatura y de profesor (Ormeño 30, Pérez 17, Labbé 10, Vargas 8) → los nombres de profesor fijos vienen del libro real. Mismas secciones y encabezados en portada, antecedentes, firma diaria, recuperación de feriados, evaluaciones (mismo orden de módulos) y resumen. Diferencias, todas ya previstas en `0017-m`: el libro real lista además los días libres en el calendario (71 filas) y pone fechas sobre las columnas de evaluaciones. Única diferencia no prevista: la portada dice "CURSO PROFESIONAL CLASE **A2**" y el libro real "CLASE **A-2**" (las convalidaciones sí llevan guion). No se comparó la geometría (anchos de columna). |
| R05 | ✅ | 27 alumnos: las tablas del PDF crecen y caben en una página cada una, sin cortar filas. |
| R07 | ✅ | "Ñandú", "Zúñiga" se imprimen bien. |
| P03 (orden) | ❌ | **La pantalla y el PDF ordenan distinto.** Pantalla: por apellido (Ñandú… antes que Zúñiga…). PDF: en el orden en que se matricularon (Zúñiga Tmp01, Ñandú Tmp02, Zúñiga Tmp03…). Por D21 manda el PDF, pero falta saber cuál de los dos órdenes es el del libro real. |
| P11 | ✅ | Dos alumnos con el mismo nombre: sin errores en consola en Lista, Firma, Evaluaciones ni Resumen. |
| O09 | ✅ | Promoción sin cursos: el selector de curso queda en "Seleccionar curso" y la pantalla pide elegir uno; sin errores. |
| R06 | ✅ | Conv. A-4 con 5 sesiones activas (necesita 13): el PDF pone "—" en los bloques sin fecha y cierra con "Aviso: la malla tiene 13 bloques de clase pero el curso solo tiene 5 sesiones activas programadas…". No inventa fechas. La app solo dice "PDF generado correctamente". |
| N05 | ❌ | **Un curso lleno se puede seguir eligiendo.** Con 27 alumnos en 282.2 (cupo 25), el paso 2 de la matrícula lo muestra "27 / 25 cupos · DISPONIBLE" y deja continuar. Promociones muestra "27 / 25" en el tooltip y en "Ver promoción", sin destacarlo. |

**I06–I08 (pendientes del bloque 2):** ✅ — una promoción se crea con o sin relatores; "Ver
promoción" muestra "Sin relator asignado" sin enlace a Relatores; Firma Diaria, Evaluaciones y
Resumen del Libro salen vacías por diseño.

### Bloque 5 — T–U: sedes, roles, tiempo real, visual

Ejecutado el 2026-10-07 contra la BD de desarrollo: seguridad por API (supabase-js, las 4 cuentas
+ anónimo) y el resto en navegador (Playwright MCP, `ng serve` local) con admin, secretariaB y
secretaria multisede, sobre las pantallas ya corregidas por `fix-320…352`. La BD queda igual que
al empezar (el único cambio, el saldo de la matrícula 6981, se devolvió a 180.000).

**T — Sedes, roles y seguridad**

| Caso | Res. | Evidencia |
|---|---|---|
| T01 | ✅ | Admin: Base Prof. y Promociones abren en Conductores Chillán, la única sede seleccionable (A08). No hay otra sede Profesional a la que cambiar. |
| T02 | — | No aplica: una sola sede con Clase Profesional. |
| T03 | ✅ | secretariaB, sin selector de sede: Promociones 5 (3 en curso, 2 planificadas), Base 65 matrículas, Libro abre en 280 · A2. Mismos datos que el admin en la sede 2. |
| T04 | ✅ | Secretaria multisede en "Todas las sedes" entra por URL a Promociones, Base y Libro: el selector pasa a Conductores Chillán y carga los datos; al volver a la Base B queda otra vez en "Todas las sedes" (D14). El caso con una sede sin Profesional guardada lo cubre `fix-334-m`. |
| T05 | ✅ | secretariaA (sede 1) y anónimo: 0 promociones, 0 cursos, 0 libros; el `PATCH` a la promoción 282 afecta 0 filas. secretariaB, multisede y admin: 12 / 48 / 39 (`fix-321-m`). |
| T06 | ✅ | secretariaA y anónimo: 0 de las 7 matrículas Profesional con promoción, 0 matrículas de la sede 2, 0 de sus 6 alumnos. secretariaB y multisede: 7/7, 140 y 6/6. secretariaA sí lee la fila `users` (nombre, RUT) de esos 6 alumnos: es la decisión de DG-014, no se toca. |
| T05 (resto de tablas) | ❌ | **Las tablas Profesional que `fix-321-m` no cubrió siguen sin sede.** secretariaA (sede 1, sin Profesional) lee lo mismo que el admin: 1.480 `professional_theory_sessions`, 1.480 `professional_practice_sessions`, 7 `lecturers` (con RUT), 26 `promotion_course_lecturers`, 5 `professional_pre_registrations`, 1 `license_validations`, 1 `professional_weekly_signatures`. **Y puede escribir:** un `UPDATE` que reescribe el mismo valor afectó 1 fila en las dos tablas de sesiones, en `lecturers` y en `license_validations` (0 filas en `promotion_course_lecturers`). Las sesiones son el calendario del Libro de Clases y de su PDF: cancelarlas o moverlas desde otra sede cambia un libro ajeno. Asistencia, notas y actas están vacías (módulos bloqueados): no se pudo medir, se asume el mismo patrón. |

**U — Tiempo real, 2 sesiones y visual**

| Caso | Res. | Evidencia |
|---|---|---|
| U01 | ❌ | S13 confirmada. Al entrar a la Base Prof. el canal `alumnos-profesional-realtime` se une y el servidor responde `"Unable to subscribe to changes with given parameters… table: enrollments"`: la tabla no está publicada. Con la Base abierta se cambió por API el saldo de la matrícula 6981 (0092): pasados 8 s la fila seguía en 180.000 y no llegó ningún evento. → `ASG-i-056` (pendiente), no se abre fix acá. |
| U02 | ❌ por lectura | El único canal de la pantalla escucha `enrollments`; archivar cambia `students`. Aunque `ASG-i-056` publique `enrollments`, archivar en A no se verá en B. Se le agrega a esa asignación. |
| U03, U04 | ⚠️ decisión | Promociones, Libro de Clases y Archivo no tienen canal de tiempo real (el único de Clase Profesional es el de la Base). Una promoción creada o un código SENCE guardado en otra sesión se ven al volver a entrar; en el código SENCE el último guardado pisa al anterior sin aviso. |
| U05 | ✅ | Al salir de la Base por el menú se envía `phx_leave` del canal y el servidor lo cierra (`phx_close`). |
| U06 | ✅ | Modo oscuro y claro en Base, Promociones, Libro y Archivo, y en los paneles "Ver promoción" y "Editar promoción": todo legible, sin fondos claros sueltos. Detalle: en oscuro los badges "Activo" y "Convalida A3" de la Base conservan fondo claro (se leen bien), a diferencia de "En curso" de Promociones, que sí se adapta. El PDF es blanco y negro por diseño (bloque 4). |
| U07 | ✅ con una ❌ | 375 / 768 / 1440 px en las 4 pantallas: sin scroll horizontal ni elementos fuera del viewport; en 1440 el documento no scrollea. **❌ Base Prof. a 375 px:** la lista entra desplazada ~800 px y luego se monta ~100 px sobre los KPIs del hero, hasta que termina la animación de entrada (≈15 s en el navegador de prueba). Causa: en móvil la lista pinta las 65 tarjetas sin paginar (22.000 px de alto) y la animación de entrada escala la celda completa desde su centro; un 1 % de escala son ~110 px arriba. Al terminar queda bien (separación de 12 px). La Base B (2.900 px) y Promociones (1.700 px) casi no lo notan. Es el caso F05 que quedó sin ejecutar en el bloque 2. |
| U08 | ✅ con observaciones | Con Tab se llega a todo en Promociones y en el panel de crear; los 8 lunes son botones nativos, los ocupados se saltan y el foco se ve (anillo de 3 px). ⚠️ Al abrir un panel el foco **no entra** en él: hay que recorrer antes toda la pantalla de atrás (buscador, filtro y los 2 botones de cada promoción). ⚠️ El buscador de Promociones no muestra anillo de foco. |
| U09 | ✅ | Todos los botones de solo ícono tienen tooltip y nombre accesible: "Ver ficha", "Archivar alumno", "Ver detalle", "Editar promoción" (tabla y tarjetas). Libro y Archivo no tienen botones de solo ícono. |

Consola del navegador sin errores en todo el bloque.

**Hallazgos previos que se habían dejado para este bloque:**

| Hallazgo | Res. | Evidencia |
|---|---|---|
| Base Prof. 375 px: la lista tapa los KPIs | ❌ transitorio | Confirmado y explicado en U07. |
| Comunicación 375 px: pestañas sin texto | ❌ | `/app/secretaria/observaciones` a 375 px: las dos barras de pestañas se ven como rayas, sin texto ni ícono, y los botones no tienen nombre accesible (solo se lee el contador "1"). Fuera de Clase Profesional. |

**Decisiones tomadas en el bloque 5 (Matías, 2026-10-07):**

| # | Caso | Pregunta | Decisión |
|---|---|---|---|
| D24 | U03 / U04 | ¿Es aceptable que Promociones y Libro de Clases no se actualicen solos entre dos sesiones? | ✅ **Se acepta como está** (Matías lo dejó a criterio; no se agrega tiempo real): solo la sede 2 los usa y casi siempre una persona a la vez. U03 y U04 quedan ✅ por decisión. |
| D25 | T05 (resto) | `lecturers` no tiene sede propia: ¿quién ve a los relatores? | ✅ **Solo quien tiene acceso a una sede con Clase Profesional.** "Los relatores son siempre profesionales y hay una sola sede profesional." → `fix-353-m`. |

## Bugs derivados

| Sospecha / caso | Track | Estado |
|---|---|---|
Abiertos el 2026-10-05, uno por causa raíz, numerados en el orden sugerido de implementación
(`fix-320` antes que `fix-321`; `fix-322` y `fix-323` tocan el mismo RPC).

| Sospecha / decisión | Track | Estado |
|---|---|---|
| S24 — el PDF borra la sede del libro | `fix-320-m-libro-pdf-borra-sede` | ✅ cerrado 2026-10-05 |
| S6 + D5 — RLS sin sede; secretaria con CRUD completo | `fix-321-m-rls-promociones-profesional-sede-y-rol` | ✅ cerrado 2026-10-05 |
| S2 — cron sin promoción en curso; reserva no atómica | `fix-322-m-cron-promociones-sin-en-curso` | ✅ cerrado 2026-10-05 |
| S5 + S7 + D6 + D7 — número de promoción y cadencia | `fix-323-m-numero-promocion-obligatorio-unico` | ✅ cerrado 2026-10-05 |
| S4 + D3b — finalizar sin confirmación | `fix-324-m-finalizar-promocion-solo-admin-con-confirmacion` | ✅ cerrado 2026-10-05 |
| L12 + D4 — cancelar con alumnos | `fix-325-m-no-cancelar-promocion-con-alumnos` | ✅ cerrado 2026-10-05 |
| S4 + S23 + D3a — Archivo en el piloto | `fix-326-m-archivo-profesional-en-piloto` | ✅ cerrado 2026-10-05 |
| S19 + D9 — conteo con archivados | `fix-327-m-conteo-inscritos-sin-archivados` | ✅ cerrado 2026-10-05 |
| S3 + S21 + D1 — Pre-inscritos alcanzable | `fix-328-m-pre-inscritos-oculto-en-piloto` | ✅ cerrado 2026-10-05 |
| S10 + D2 — estados imposibles | `fix-329-m-base-profesional-sin-estados-imposibles` | ✅ cerrado 2026-10-05 |
| C05 + D11 — columna Promoción | `fix-330-m-columna-promocion-muestra-curso` | ✅ cerrado 2026-10-05 |
| B05 + D10 — total cuenta matrículas | `fix-331-m-kpi-total-cuenta-matriculas` | ✅ cerrado 2026-10-05 |
| S12 + D12 — datos de módulos bloqueados | `fix-332-m-ocultar-datos-de-modulos-bloqueados` | ✅ cerrado 2026-10-05 |
| S15 + D8 — archivar sin aviso de Clase B | `fix-333-m-aviso-archivar-persona-con-clase-b` | ✅ cerrado 2026-10-05 |

Del bloque 2 (2026-10-06), uno por causa raíz. **Por abrir** (aún sin carpeta):

| Caso / decisión | Track propuesto | Estado |
|---|---|---|
| A09 + A10 + A07/A11 + S22 + D13 + D14 — sede al entrar/salir de Profesional | `fix-334-m-sede-al-entrar-y-salir-de-profesional` | ✅ cerrado 2026-10-06 (`29fc21e5`) |
| H02 + S17 — la Base Profesional no pasa la matrícula a la ficha | `fix-335-m-ficha-desde-base-profesional-abre-su-matricula` | ✅ cerrado 2026-10-06 |
| H06 + D15 — acciones de Clase B en la ficha Profesional | `fix-336-m-ficha-profesional-sin-acciones-de-clase-b` | ✅ cerrado 2026-10-06 |
| I10 — buscador global sin alumnos Profesional | `fix-337-m-buscador-global-incluye-profesional` | ✅ cerrado 2026-10-06 |
| F07 + S14 (+ S16) — error de carga como lista vacía en Base Prof. y Promociones | `fix-338-m-error-de-carga-profesional-no-es-lista-vacia` | ✅ cerrado 2026-10-06 |
| G06 — la Papelera persiste al volver por el menú | `fix-339-m-papelera-profesional-no-persiste` | ✅ cerrado 2026-10-06 |
| F03 + D16 — tarjetas móviles angostas por paddings anidados | `fix-340-m-tarjetas-moviles-paddings-anidados` | ✅ cerrado 2026-10-06 (mínimo, D16) |
| `.card` sin capa le gana a `p-0`/`p-N` (~92 archivos, también escritorio) — causa de fondo de F03 | `fix-341-m-card-respeta-utilities-de-tailwind` | ✅ cerrado 2026-10-06 (portales alumno/instructor sin verificar visualmente: bloqueados) |
| Base Profesional 375 px: la lista tapa los KPIs del hero (previo) | sin track — bloque 5 | ⏳ |
| Comunicación 375 px: pestañas sin texto (previo) | sin track — bloque 5 | ⏳ |
| D17 — la ficha deja cambiar la sede del topbar (reportado por Matías) | `fix-342-m-ficha-bloquea-sede-del-alumno` | ✅ cerrado 2026-10-06 |

Del bloque 3 (2026-10-06), uno por causa raíz:

| Caso | Track | Estado |
|---|---|---|
| K04 — feriados del año siguiente ignorados (drawer y cron; afecta a la 284). Segunda causa: el respaldo `boostr` ignora el año pedido | `fix-343-m-feriados-del-ano-siguiente-en-promociones` | ✅ cerrado 2026-10-06 (función desplegada por Matías) |
| M08 — una manual en un lunes futuro de la cadencia hace que el cron se salte los intermedios | `fix-344-m-el-cron-no-salta-lunes-de-la-cadencia` | ✅ cerrado 2026-10-06 (migración aplicada por Matías; test SQL TODO OK) |
| J10 — a 1280 px la tabla de Promociones no cabe y el botón Editar queda fuera de la vista | `fix-345-m-tabla-de-promociones-cabe-en-notebook` | ✅ cerrado 2026-10-06 |
| L04 + D18 — doble guardado al editar; el nombre no sigue al número | `fix-346-m-editar-promocion-guarda-una-vez-y-el-nombre-sigue-al-numero` | ✅ cerrado 2026-10-06 |
| M08 (número) + K07 + D19 — número de una manual sin tope; acepta `0` | `fix-347-m-numero-de-promocion-acotado` | ✅ cerrado 2026-10-06 (tope: último usado + 10) |
| L12 + D20 — cancelar deja ocupados el lunes y el número | `fix-348-m-eliminar-promocion-en-vez-de-cancelar` | ✅ cerrado 2026-10-06 (migración aplicada por Matías; test SQL TODO OK; borrado real probado) |
| Textos menores y orden de promociones en la matrícula | `hotfix-145-m-textos-menores-de-promociones-y-archivo` | ✅ cerrado 2026-10-06 (el formato de fecha `/` vs `-` quedó fuera: es de toda la app) |

**Decisiones tomadas en el bloque 3 (Matías, 2026-10-06):**

| # | Caso | Pregunta | Decisión |
|---|---|---|---|
| D18 | L04 | Al cambiar el número, ¿el nombre "Promoción N (fecha)" se actualiza solo? | ✅ **Sí.** Va junto con el doble guardado en `fix-346-m`. |
| D19 | M08 (número) | ¿Se limita el número de una manual para que un error de tipeo no corra la numeración automática? | ✅ **Sí, buena idea** (y no aceptar `0`). Track propio: `fix-347-m`. Falta definir el rango exacto al abrirlo. |
| D20 | L12 | Una cancelada sigue ocupando su lunes y su número: ¿se liberan? | ✅ **"Cancelada" se reemplaza por "Eliminar"** (`fix-348-m`): solo admin, solo promociones planificadas (o canceladas históricas) sin alumnos; se borra de verdad, con confirmación, y libera lunes y número. Desaparecen la opción, el KPI y el filtro "Cancelada". La secretaria ve un aviso para pedírselo al administrador. D5 se reconfirma: la secretaria no crea promociones (se crean solas con el cron). |
| — | Textos menores | "cada 2 semanas" en las reglas del drawer (K02), singulares ("1 promociones", "1 alumnos"), fecha `/` vs `-`, placeholder de Archivo, promociones sin orden en el paso 2 del wizard (N01) | ✅ **Un hotfix.** |

Del bloque 4 (2026-10-06). Todos cerrados el 2026-10-07, con la función
`generate-class-book-pdf` desplegada por Matías y revisados en navegador:

| Caso | Track | Estado |
|---|---|---|
| Q05 + S8 — guardar el código SENCE falla después de exportar el PDF de un libro sin fila | `fix-349-m` | ✅ cerrado, revisado en navegador |
| Q08 — doble clic en "Guardar" del código SENCE guarda dos veces | `hotfix-146-m` | ✅ revisado en navegador |
| Textos: "1 alumnos" en Lista y Resumen; el selector repite el número de la promoción | `hotfix-146-m` | ✅ revisado en navegador |
| Texto: portada "CLASE A2" en vez de "A-2" | `hotfix-146-m` | ✅ cerrado, revisado en navegador (pantalla = PDF) |
| P06 + R04 + D21 — el calendario en pantalla no muestra lo mismo que el PDF | `fix-350-m` | ✅ cerrado, revisado en navegador (pantalla = PDF) |
| N05 — un curso lleno se puede seguir eligiendo en la matrícula | `fix-351-m` | ✅ cerrado, revisado en navegador |
| P03 + D23 — la lista de alumnos se ordena distinto en pantalla y en el PDF | `fix-352-m` | ✅ cerrado, revisado en navegador (pantalla = PDF) |

**Decisiones tomadas en el bloque 4 (Matías, 2026-10-06):**

| # | Caso | Pregunta | Decisión |
|---|---|---|---|
| D21 | P06 / R04 | ¿El calendario en pantalla debe mostrar la malla, como el PDF? | ✅ **Sí: la pantalla muestra lo mismo que el PDF, que es el que manda.** Los nombres de profesor fijos del PDF vienen del libro real (R02). |
| D22 | Q06 | ¿Se permite dejar vacío el código SENCE? | ✅ **Sí, por el momento.** |
| D23 | P03 | ¿En qué orden va la lista de alumnos: por apellido (pantalla) o por orden de matrícula (PDF)? | ✅ **Por apellido paterno, en pantalla y en el PDF** (Matías, 2026-10-07). En el libro real van por orden de llegada porque se anotan a mano; siendo un software, se aprovecha para ordenarlos. → `fix-352-m`. |

Del bloque 5 (2026-10-07), uno por causa raíz. **Propuestos, aún sin carpeta:**

| Caso | Track propuesto | Estado |
|---|---|---|
| T05 (resto) — sesiones, relatores, convalidaciones, pre-inscripciones y firmas Profesional se leen y editan desde otra sede | `fix-353-m-rls-resto-de-tablas-profesional-por-sede` | ✅ cerrado 2026-10-07 (migración aplicada por Matías; regresión por API 21/21 y revisión en navegador) |
| U07 + F05 — Base Prof. en móvil pinta las 65 tarjetas y la animación de entrada monta la lista sobre el hero | `fix-354-m-base-profesional-movil-lista-acotada` | ✅ cerrado 2026-10-07 (tarjetas de a 6 con "Cargar más", revisado en navegador) |
| Comunicación 375 px — pestañas sin texto ni nombre accesible. Causa: `app-tabs` elegía el modo "solo ícono" aunque las pestañas no tuvieran ícono | `fix-355-m-pestanas-sin-icono-no-quedan-vacias` | ✅ cerrado 2026-10-07 (revisado en navegador) |
| F01 + D06 + G06 — textos de la Base: paginador "alumnos", chip sin singular, estado vacío de la Papelera | `hotfix-147-m-textos-menores-de-la-base-profesional` | ✅ cerrado 2026-10-07 (revisado en navegador) |
| U08 — al abrir un panel el foco no entra en él (host de todos los paneles) | `fix-357-m-el-foco-entra-al-panel-lateral-al-abrirlo` | ✅ cerrado 2026-10-07 (test E2E + revisión manual) |
| U08 — los buscadores de las listas no muestran el foco (10 pantallas) | `fix-358-m-los-buscadores-de-las-listas-muestran-el-foco` | ✅ cerrado 2026-10-07 (revisado en navegador) |
| U06 — los badges `p-tag` conservan fondo claro en modo oscuro (toda la app) | `fix-356-m-etiquetas-de-estado-en-modo-oscuro` | ✅ cerrado 2026-10-07 (revisado en navegador) |
| Comunicación y Anticipos en móvil/tablet — ~80 px vacíos bajo la barra de pestañas (observación de `fix-355-m`) | `fix-359-m-hueco-bajo-la-barra-de-pestanas-en-movil` | ✅ cerrado 2026-10-07 (medido antes y después; barrido de rutas 56/56) |
| Comunicación en móvil — el desplegable de pestañas de la lista quedaba pegado a los bordes de la tarjeta | `hotfix-148-m-desplegable-de-pestanas-con-margen-dentro-de-la-tarjeta` | ✅ cerrado 2026-10-07 (revisado en navegador) |
| U01 + U02 — tiempo real muerto en la Base Prof. | `ASG-i-056` (traspasado el 2026-10-07 con sus casos y el dato de que archivar cambia `students`) | ➡️ fuera de este track |

Descartado al revisar: "Crear promoción" sí tiene `data-llm-action` (`submit-crear-promocion`, en
el componente del botón); la revisión del bloque 5 miró el `<button>` interno.

## Test de regresión

Los casos "Auto ✓" del checklist, automatizados en `e2e/` (suite de `0019-m`).

**`e2e/clase-profesional.spec.ts`** (2026-10-07): 42 tests, 41 en verde y 1 marcado como bug
conocido (U01, tiempo real → `ASG-i-056`; comprobado que falla por eso con
`E2E_SHOW_KNOWN_BUGS=1`). Corrida dos veces seguidas sin fallos; no deja datos (0 matrículas con
Nº `E2E-` al terminar). Los tests siembran su propio alumno `E2E-` con matrícula Profesional A2
en la promoción en curso más nueva (`createE2eAlumno` ahora acepta `promotionCourseId`).

Suite E2E completa (362 tests, 16,6 min, 2026-10-07): 348 pasaron y 14 fallaron en la corrida
con todo en paralelo; al reintentar solo los fallidos pasaron 14 más y quedaron 4, ninguno de
esta spec ni de los cambios de este track:

- `barrido-rutas` B10 (`/matricula`, admin y secretaria): 14 px de "scroll horizontal" del shell a
  1440 px. Fallaba siempre y ya estaba anotado como observación en `fix-190-b`. **No es un defecto
  visual:** el asistente ocupa a propósito el canal reservado para la barra de scroll del shell,
  para que su barra quede alineada con la de las demás páginas (medido: sin ese margen la barra
  se corre 14 px y el formulario se angosta). Se corrigió el test: B10 tolera exactamente el ancho
  de ese canal (`fillsScrollbarGutter`). *(La primera versión de esta nota culpaba al aviso de
  "retomar borrador"; era un error.)*
- `auth-sesion` A03: el panel "Credenciales de prueba" en el build de producción (se corre
  contra `ng serve`).
- `alumnos-b-ficha` F04: compara una fecha de reprogramación contra la hora actual.

Las fallas que sí tocaron a esta spec en la corrida completa (5 tests de la Base, junto con el
barrido de esa misma ruta) fueron por tiempo de carga con todo en paralelo; la espera de carga de
la spec se subió a 30 s y junto al barrido de rutas pasa completa.

| Bloque | Casos cubiertos |
|---|---|
| Acceso | A01, A02, A04, A06, A08, T01 |
| Base | B01, B03, B06, B07, B10, C02, C05, C07, C08, C10, D01, D04, E01, E03, E04, E05, E06, E09, E10, F01, F02, F03, F06, I01, I02 |
| Papelera y ficha | G02, G05, G07, H01, H02, H07, H08 |
| Promociones | J01, J04, J05, J06, J10, K01, K07, K13, K14, L01, L03, L05, T03 |
| Libro | O01, O04, P01, P02, P03, P05, P07, P08, P12, I08, Q01, Q02, Q03, R01 |
| Seguridad (por API) | T05, T06 y las tablas de `fix-353-m` |
| Tiempo real y visual | U01 (bug conocido), U07 |

Casos "Auto ✓" que **no** se automatizaron, y por qué:

- **K09, L04, L09, L13** (crear, editar y transiciones de una promoción): una promoción de prueba
  ocupa un lunes y un número reales de la cadencia automática mientras existe; la BD es compartida.
- **B09, N01** (matricular por el asistente): corresponden al testing de matrícula (`ASG-i-023`).
- **A03, A12, A13**: ya están en `e2e/auth-sesion.spec.ts` (H01, J01) y `e2e/barrido-rutas.spec.ts`.
- **A05, B02, C06, C09 (inactivo), D02, D03, E02, E07, G01, J02, J03, J07, K03, L14, O02, O05,
  P09, Q04**: sin dato estable en una BD compartida (cuenta sin sede, convalidación, alumno con
  pagos, promoción finalizada concreta) o el caso dejó de existir por una decisión (D2, D20).
  Quedan cubiertos por la ejecución manual de los bloques 2–4.
- **U06** (modo oscuro legible): es un juicio visual; se revisó a mano en el bloque 5.

## Cierre (2026-10-07)

Los 5 bloques del checklist están ejecutados, los tracks que salieron de ellos (`fix-320-m` …
`fix-359-m`, `hotfix-145-m` … `hotfix-148-m`) están cerrados y la capa Playwright está en
`e2e/clase-profesional.spec.ts`. Lo único que no se resolvió acá es el tiempo real de la Base
Profesional (U01, U02), que pertenece a `ASG-i-056` y quedó traspasado ahí con sus casos.

Pendiente de modelar con el dueño, fuera de este track: el desertor de Clase Profesional (ver
"Decisiones de negocio").
