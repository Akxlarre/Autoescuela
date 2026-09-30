# Testing — Clase Profesional visible en el piloto (Alumnos Profesional, Promociones, Libro de clases)

> **Asignación:** `ASG-i-025` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/clase-profesional/alumnos`, `/app/admin/clase-profesional/promociones`,
> `/app/admin/libro-de-clases`, `/app/secretaria/profesional/alumnos`,
> `/app/secretaria/profesional/promociones`, `/app/secretaria/libro-de-clases` (las 3 de secretaria
> con `professionalBranchGuard`).
> **Incluye:** Base de Alumnos Profesional (lista, KPIs, filtros, Papelera, archivar, botón
> "Pre-inscritos"), la parte **profesional** de la ficha a la que lleva "Ver ficha", Promociones
> (lista, crear, ver, editar, estados, cadencia automática por cron + edge function
> `auto-create-next-promotions`), Libro de clases (6 libros incl. Conv. A-3/A-4, código SENCE,
> PDF `generate-class-book-pdf`), todo link/botón que lleve a un módulo bloqueado por el piloto.
> **No incluye:** la ficha del alumno por dentro en lo común con Clase B (ver `024b`), el wizard de
> matrícula por dentro (ver `023-matricula-presencial.md`; aquí solo el cruce "matricular → aparece"
> y la matrícula tardía), los 7 módulos Profesional bloqueados (solo se prueba que sigan bloqueados
> → `ASG-i-022`).
>
> **Código leído para armar esta lista:**
> `features/admin/alumnos-profesional/`, `features/secretaria/alumnos-profesional/`,
> `shared/components/alumnos-profesional-list-content/`, `shared/components/alumno-profesional-card/`,
> `core/facades/admin-alumnos-profesional.facade.ts`, `features/admin/alumnos/pre-inscritos/admin-pre-inscritos.component.ts`,
> `features/admin/profesional-promociones/` (página + 3 drawers), `features/secretaria/profesional-promociones/`,
> `core/facades/promociones.facade.ts`, `features/libro-de-clases/libro-de-clases.component.ts`,
> `core/facades/libro-de-clases.facade.ts`, `core/utils/{convalidation-book,convalidation,branch-scope,professional-access}.utils.ts`,
> `core/guards/{professional-branch,pilot-phase}.guard.ts`, `core/facades/branch.facade.ts` (`setProfessionalOnly`),
> `core/services/auth/menu-config.service.ts`, `layout/sidebar.component.ts`, `layout/topbar.component.ts`,
> `features/admin/alumno-detalle/admin-alumno-detalle.component.ts` + `core/facades/admin-alumno-detalle.facade.ts` (parte profesional),
> `supabase/functions/auto-create-next-promotions/`, `supabase/functions/generate-class-book-pdf/` (lógica, no la malla),
> `supabase/config.toml`, migraciones `20260301000011_10_rls_policies`, `20260303120000_update_rls_security_fixes`,
> `20260330100000_pg_cron_promotion_status_auto_transition`, `20260415000002_trigger_cascade_promotion_status_to_courses`,
> `20260807090000_auto_create_next_promotions_cron`, `20260820100000_fix196_promotion_finished_completes_enrollments`,
> `20260829110000_promotions_unique_start_date_and_lock_fn`, `20260924120000_class_book_alter_convalidation_license`.
> Specs/fixes: `0002-m`, `0005-i`, `0017-m`, `0018-m`, `fix-098-m`, `fix-256-m`, `fix-257-m`, `fix-260-m`.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-025`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S22)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- ⚠️ Los casos que invocan las edge functions a mano (S1, S2) o que finalizan/cancelan promociones
  **se ejecutan en local o staging**, nunca en producción: finalizar una promoción mueve alumnos a
  "completado" de forma irreversible desde la UI (S4).

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **El PDF del libro de clases se genera sin sesión.** La función tiene `verify_jwt = false`, no lee el header `Authorization`, no verifica rol ni sede y usa la clave de servicio. Cualquiera en internet que mande un `promotion_course_id` (son correlativos) recibe una URL firmada de 1 hora a un PDF con nombre, RUN y teléfono de todos los alumnos del curso. Además el `upsert` pasa el `class_book` a `status = 'active'` aunque estuviera `closed`. | `supabase/config.toml:360-361`; `generate-class-book-pdf/index.ts:40-72,98-106,259-279` |
| S2 | 🔴 Alta | **La creación automática de promociones es invocable por cualquiera y, sin promoción en curso, crea hasta 10 por llamada.** `verify_jwt = false` y la función no valida nada del llamador. El RPC solo corta cuando hay `≥1 in_progress` **y** `≥2 planned`; si no hay ninguna `in_progress` (sede nueva, se canceló/finalizó a mano la única en curso, entorno de pruebas), cada iteración del loop inserta otra planificada, hasta 10 por llamada, y cada llamada suma otras 10. Además, si la llamada falla a mitad (feriados, curso), queda una promoción "placeholder" con `end_date = start_date` y sin cursos, que cuenta para el colchón y nunca se completa. | `config.toml:363-364`; `auto-create-next-promotions/index.ts:100-129,140-177`; `20260829110000…sql:63-74,94-97` |
| S3 | 🟠 Media | **Pre-inscritos (módulo bloqueado) se abre igual desde Base Alumnos Prof.** La ruta tiene `pilotPhaseGuard`, pero el botón "Pre-inscritos" del hero siempre está y embebe el componente completo (lista + drawer con acciones de evaluar/matricular) dentro de la misma URL, saltándose el guard. | `alumnos-profesional-list-content.component.ts:445-451,543-547`; `admin-alumnos-profesional.component.ts:31-32`; `secretaria-alumnos-profesional.component.ts:30-34`; `app.routes.ts:132-133,415-416` |
| S4 | 🟠 Media | **Finalizar una promoción hace "desaparecer" a sus alumnos en el piloto.** Al pasar a `finished` (a mano en "Editar" o por el cron diario) un trigger pasa todas sus matrículas `active` a `completed`; la Base Prof. solo lista `active`/`inactive`, y Ex-Alumnos Prof. está bloqueado. Además la promoción deja de aparecer en Promociones (la query excluye `finished`), aunque el filtro ofrece "Finalizada". Solo queda visible en el Libro de clases. | `20260820100000_fix196…sql:28-36`; `20260330100000…sql:20-25`; `admin-alumnos-profesional.facade.ts:45`; `promociones.facade.ts:116`; `admin-profesional-promociones.component.ts:444-449`; `app.routes.ts:154-155,578-579` |
| S5 | 🟠 Media | **Una promoción manual puede trabar la creación automática para siempre.** El drawer sugiere lunes "cada 2 semanas" contando desde hoy (no desde la cadencia real) y crea la promoción **sin código**. El RPC calcula la próxima fecha solo con promociones de código numérico (`última + 14 días`); si esa fecha ya la ocupa una promoción manual, choca con `UNIQUE (branch_id, start_date)`, el RPC falla y la edge function devuelve 500 **todos los días**. | `admin-promocion-crear-drawer.component.ts:24-48`; `promociones.facade.ts:292-303`; `20260829110000…sql:38-40,76-90`; `auto-create-next-promotions/index.ts:125-128` |
| S6 | 🟠 Media | **RLS de promociones, cursos y libro sin sede.** Cualquier `secretary` (de cualquier sede, con o sin Profesional) puede leer, crear, editar y **borrar** `professional_promotions` y `promotion_courses`, y leer/editar `class_book` de cualquier sede desde la consola. Editar el `status` a `finished` dispara S4. | `20260301000011_10_rls_policies.sql:489-496,522-529,666-676`; `20260303120000…sql:47-55` |
| S7 | 🟠 Media | **"Editar promoción" guarda un código inválido o un nombre vacío** si además cambió otro campo: la validación de "solo números" solo bloquea cuando lo único que cambió es el código. Con nombre o estado cambiados, se envía `code: "abc"` o `""` (el código es la base del ID MTT y de la cadencia automática, S5). | `admin-promocion-editar-drawer.component.ts:319-328,348-356`; `promociones.facade.ts:433-442` |
| S8 | 🟠 Media | **Guardar el código SENCE falla después de exportar el PDF** en un libro que aún no tenía fila en `class_book` (promociones manuales y todos los libros Conv. A-3/A-4 la primera vez): el PDF crea la fila por `upsert`, la pantalla no se entera (`classBookId` sigue `null`) y "Guardar" hace `INSERT` → choca con la unicidad `(promotion_course_id, convalidation_license)`. | `libro-de-clases.facade.ts:613-636,665-729`; `generate-class-book-pdf/index.ts:259-272`; `20260924120000…sql:37-39` |
| S9 | 🟡 Baja-Media | **Libro de clases no recarga al cambiar de sede.** A diferencia de Alumnos Prof. y Promociones, no tiene `effect` sobre la sede; si el admin (o secretaria con grant) cambia de sede en el topbar, sigue viendo las promociones de la sede anterior. | `libro-de-clases.component.ts:920-932` vs `admin-alumnos-profesional.component.ts:72-77` |
| S10 | 🟡 Baja-Media | **Filtro Estado "Retirado" siempre vacío** y los retirados desaparecen: la lista solo trae `active`/`inactive`, y "Retirado" se mapea desde `cancelled` (que nunca llega). Una matrícula Prof. `withdrawn`/`cancelled` no aparece en ninguna pantalla visible del piloto. | `admin-alumnos-profesional.facade.ts:45,256,350-363`; `alumnos-profesional-list-content.component.ts:428-432` |
| S11 | 🟡 Baja | **KPI "En riesgo" mal rotulado:** cuenta semáforo rojo, que la tabla muestra como "Crítico"; el amarillo es el que la tabla llama "En riesgo". | `alumnos-profesional-list-content.component.ts:476-486,507-518` |
| S12 | 🟡 Baja | **Asistencia, módulos, nota y certificado siempre vacíos en el piloto.** El semáforo, "Módulos N/7", las cards de asistencia/nota de la ficha y el botón de certificado dependen de datos que solo se cargan en Asistencia Prof. y Evaluaciones (bloqueados). Todos los alumnos salen "Sin datos", 0/7 y "Certificado (1/3 criterios)" deshabilitado. No es bug de código: confirmar que es aceptable. | `admin-alumnos-profesional.facade.ts:279-289`; `admin-alumno-detalle.component.ts:635-861,1324-1333` |
| S13 | 🟡 Baja | **Tiempo real probablemente muerto** en Alumnos Prof.: el canal escucha solo `enrollments`, que no aparece en ninguna migración que la agregue a `supabase_realtime` (sí `students`, `payments`, `users`…). | `admin-alumnos-profesional.facade.ts:80-90` |
| S14 | 🟡 Baja | **Errores de carga invisibles.** Alumnos Prof. guarda el error pero la lista no lo recibe (se ve "No hay alumnos profesionales · Limpiar filtros"). Promociones ni siquiera lo captura en la primera carga (`initialize` sin `catch` → promesa rechazada en consola, lista vacía). | `admin-alumnos-profesional.facade.ts:133-135,312-318`; `alumnos-profesional-list-content.component.ts:381-392`; `promociones.facade.ts:71-83` |
| S15 | 🟡 Baja | **Archivar desde la lista Profesional archiva a la persona completa** (`students.status`), así que un alumno B + Profesional desaparece también de la Base B. Si falla, la excepción se relanza sin `catch` (error en consola). | `admin-alumnos-profesional.facade.ts:202-218`; `admin-alumnos-profesional.component.ts:99-108,119-121` |
| S16 | 🟡 Baja | **Doble carga inicial sin guard de orden.** `ngOnInit` y el `effect` llaman a `initialize()` a la vez (mismo problema que hotfix-055-b corrigió en Pre-inscritos) y el facade no usa `createRequestGuard()`; un cambio rápido de sede puede pintar datos de la sede anterior. | `admin-alumnos-profesional.component.ts:72-88`; `admin-alumnos-profesional.facade.ts:118-152` |
| S17 | 🟡 Baja | **"Ver ficha" abre la matrícula más reciente, no la profesional**, y cuenta también borradores: la query de la ficha no pide `status`, así que el filtro `status !== 'draft'` nunca filtra. Un alumno Prof. con una matrícula B (o un borrador) posterior abre la ficha en modo Clase B y "Volver" lleva a la Base B. | `admin-alumno-detalle.facade.ts:403-404,419-422,438` |
| S18 | 🟡 Baja | **Libro: promociones sin código se ven como "Promoción 5 de Octubre 2026 ()"** en el selector, y su libro sale con "ID: —". Toda promoción creada a mano nace sin código. | `libro-de-clases.component.ts:876-878`; `promociones.facade.ts:292-303` |
| S19 | 🟡 Baja | **Detalle de promoción: conteos y estados crudos.** Cuenta como inscritos a retirados/completados (solo excluye `cancelled` y `draft`) y muestra `withdrawn` sin traducir. | `promociones.facade.ts:131-135,170-180`; `admin-promocion-ver-drawer.component.ts:460-468` |
| S20 | 🟡 Baja | **Crear promoción no es atómico:** si falla el curso 3 de 4 (o un relator), quedan la promoción y los cursos anteriores creados, sin rollback, y el usuario ve solo un toast de error. | `promociones.facade.ts:283-360` |
| S21 | 🟡 Baja | **Una notificación de pre-inscripción lleva a un módulo bloqueado** (`/…/pre-inscritos` → "Módulo no disponible"). | `layout/topbar.component.ts:51-54` |
| S22 | 🟡 Baja | **Salir de una pantalla Profesional deja el selector de sede en "Todas"** (sin persistir) aunque antes hubiera una sede elegida; y al entrar la auto-selección de sede profesional tampoco se persiste. Si las sedes aún no cargaron (F5 directo), no encuentra sede profesional y la pantalla queda en "Todas": crear una promoción así la guardaría con `branch_id = null`. | `branch.facade.ts:211-225`; `promociones.facade.ts:300` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (idealmente con el seed de spec `0008-i` + ajustes). La sede con Clase
Profesional es "Conductores Chillán" (`branch_id = 2`, el cron está fijado a esa sede). Anotar acá el
nombre/RUT/código real usado para cada uno.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Alumno Prof. A2 `active`, en promoción en curso, con saldo > 0 | Caso base, KPI Con deuda | |
| D2 | Alumno Prof. A5 `active` con `license_validations` = A3 | Badge "Convalida A3", libro Conv. A-3 | |
| D3 | Alumno Prof. A2 `active` con `license_validations` = A4 | Badge "Convalida A4", libro Conv. A-4 | |
| D4 | Alumno Prof. `inactive` | Estado "Inactivo" | |
| D5 | Matrícula Prof. `withdrawn` y otra `cancelled` | S10: ¿dónde aparecen? | |
| D6 | Matrícula Prof. `completed` (promoción finalizada) | No debe estar en la Base | |
| D7 | Alumno con matrícula B **y** Profesional | Aparece en ambas bases; S15, S17 | |
| D8 | Alumno con 2 matrículas Prof. activas | Filas duplicadas | |
| D9 | Alumno Prof. archivado | Papelera | |
| D10 | Matrícula Prof. solo `draft` | No debe aparecer | |
| D11 | Promoción automática `in_progress` con código numérico (ej. 280) | Caso base de Promociones y Libro | |
| D12 | Promoción automática `planned` con inicio futuro | Transiciones, matrícula | |
| D13 | Promoción creada a mano (sin código) | S5, S18 | |
| D14 | Promoción cuyo rango contiene un feriado (L-S) | Extensión de `end_date`, sesiones canceladas | |
| D15 | Promoción `finished` con alumnos | S4, Libro | |
| D16 | Promoción `cancelled` con alumnos | Qué pasa con los alumnos | |
| D17 | Relatores `active` con especializaciones A2..A5 (cargados por BD: Relatores está bloqueado) | Crear promoción con relatores, Libro "Profesores" | |
| D18 | Promoción que comenzó hace > 3 días y otra hace ≤ 3 días | Matrícula tardía (AC4/AC5 de `0002-m`) | |
| D19 | Nombre con tilde y ñ, sin apellido materno, nombre muy largo | Búsqueda, orden y diseño | |
| D20 | > 10 alumnos Prof. (idealmente > 25 en un mismo curso) | Paginación, PDF con > 25 filas | |
| D21 | Curso madre A5/A2 con menos de 16/13 sesiones activas | AC-E3 de `0018-m` | |

**Cuentas:** admin; secretaria de la sede Profesional sin grant; secretaria de una sede **sin**
Profesional sin grant; secretaria con grant multi-sede (`can_access_both_branches = true`);
secretaria sin sede asignada; una terminal **sin sesión** (curl/Postman) para S1 y S2.

---

## 3. Casos

### A. Acceso, menú y guards

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin en sede Profesional → menú "Academia Profesional" | Solo 3 ítems: Base Alumnos Prof., Promociones, Libro de Clases | ✓ | |
| A02 | Secretaria de sede Profesional → mismo menú | Mismos 3 ítems | ✓ | |
| A03 | Secretaria de sede sin Profesional, sin grant | El grupo "Academia Profesional" no aparece | ✓ | |
| A04 | Esa misma secretaria escribe las 3 URLs de secretaria **(§4)** | Redirige a `/app` (nunca renderiza la pantalla) | ✓ | |
| A05 | Secretaria sin sede asignada escribe las 3 URLs | Redirige a `/app` | ✓ | |
| A06 | Secretaria escribe las URLs de admin (`/app/admin/clase-profesional/alumnos`, etc.) | Acceso denegado | ✓ | |
| A07 | Admin con "Todas las escuelas" → clic en un ítem Profesional | Modal "Conmutar Sede"; al aceptar cambia de sede. Hoy **no navega** al ítem: hay que volver a hacer clic — confirmar si es aceptable | — | |
| A08 | Admin entra a cualquiera de las 3 pantallas | El selector de sede queda fijo en la sede Profesional, "Todas" y sedes sin Profesional deshabilitadas con "Solo sedes con Clase Profesional" | ✓ | |
| A09 | Salir de una pantalla Profesional a Base Alumnos B | El selector vuelve a "Todas" aunque antes hubiera una sede elegida (S22) — ¿es lo deseado? | — | |
| A10 | F5 directo sobre cada una de las 3 URLs (admin) **(§4)** | Se autoselecciona la sede Profesional y carga normal (S22) | — | |
| A11 | Secretaria con grant, sede actual sin Profesional → clic en ítem Profesional | Modal de conmutar; al aceptar cambia a la sede Profesional | — | |
| A12 | Las 7 URLs bloqueadas (relatores, asistencia, evaluaciones, certificados, archivo, pre-inscritos, ex-alumnos-profesional), admin y secretaria | `/modulo-no-disponible` (regresión de `fix-256-m`/`fix-260-m`) | ✓ | |
| A13 | "Volver" desde `/modulo-no-disponible` siendo admin/secretaria | Vuelve a la app **sin cerrar la sesión** (regresión del commit 70e3d34e) | ✓ | |

### B. Base Alumnos Prof. — qué alumnos aparecen

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | D1, D2, D3, D4 | Aparecen | ✓ | |
| B02 | D5 (`withdrawn` / `cancelled`) | Hoy no aparecen en ninguna pantalla visible (S10) — **decisión** | ✓ | |
| B03 | D6 (`completed`) | No aparece (estaría en Ex-Alumnos Prof., bloqueado) | ✓ | |
| B04 | D7 (B + Prof.) | Aparece con Nº, promoción y saldo de la matrícula **Profesional** | ✓ | |
| B05 | D8 (2 matrículas Prof.) | ¿Una fila o dos? Hoy dos filas con el mismo alumno; revisar consola por error de claves duplicadas en vista tarjetas | — | |
| B06 | D9 (archivado) | Solo en la Papelera | ✓ | |
| B07 | D10 (solo borrador) | No aparece | ✓ | |
| B08 | Orden | De la matrícula más nueva a la más antigua (por id) | — | |
| B09 | Matricular un alumno Profesional nuevo **(§4)** | Aparece primero en la Base y en el detalle de su promoción | ✓ | |
| B10 | Alumno Clase B puro | No aparece | ✓ | |

### C. Datos de cada fila / tarjeta

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Avatar | Iniciales nombre + apellido | — | |
| C02 | Columna Alumno | "Apellidos Nombres" + RUT debajo | ✓ | |
| C03 | Sin apellido materno (D19) | Sin espacios sobrantes ni "undefined" | — | |
| C04 | Nº Mat. sin número | "—" | — | |
| C05 | Columna "Promoción" | Hoy muestra el **nombre del curso** (ej. "Clase A2 …"), no el nombre ni el código de la promoción — confirmar qué debe mostrar | — | |
| C06 | D2 / D3 | Badge "Convalida A3" / "Convalida A4" con tooltip | ✓ | |
| C07 | Columna Módulos | Hoy siempre 0/7 (S12) | ✓ | |
| C08 | Columna Asistencia | Hoy siempre "Sin datos" (S12) | ✓ | |
| C09 | Estado de D1 / D4 | Activo (verde) / Inactivo (gris) | ✓ | |
| C10 | Saldo | En CLP sin decimales; coincide con la ficha | ✓ | |
| C11 | Nombre muy largo (D19) | No rompe la fila ni la tarjeta (truncado con tooltip en tarjeta) | — | |

### D. Encabezado y KPIs

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Chip "N alumnos" y KPI Total | Igual al total de filas (con D8 cuenta matrículas, no personas) | ✓ | |
| D02 | KPI Activos | Solo estado Activo | ✓ | |
| D03 | KPI Con deuda | Alumnos con saldo > 0 | ✓ | |
| D04 | KPI "En riesgo" | Hoy siempre 0; cuenta rojos que la tabla llama "Crítico" (S11) | ✓ | |
| D05 | Aplicar filtros | Los KPIs no cambian — confirmar si es lo deseado | — | |
| D06 | KPIs dentro de la Papelera | Cuentan archivados — ¿tiene sentido? | — | |

### E. Búsqueda y filtros

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Buscar por nombre, apellido, "nombre apellido" y "apellido nombre" | Encuentra | ✓ | |
| E02 | Sin tilde y en mayúsculas (D19) | Encuentra | ✓ | |
| E03 | RUT con y sin puntos/guion | Encuentra en todos los formatos | ✓ | |
| E04 | Nº de matrícula | Encuentra | ✓ | |
| E05 | Filtro Clase A2 / A3 / A4 / A5 | Solo esa clase. **Ojo:** D2 (A5 que convalida A3) sale en A5, no en A3 — confirmar | ✓ | |
| E06 | Filtro Estado Activo / Inactivo | Solo ese estado | ✓ | |
| E07 | Filtro Estado Retirado | Hoy siempre vacío (S10) | ✓ | |
| E08 | Volver un filtro a "Todas" | ¿Se puede sin recargar? (el select no tiene botón de limpiar) | — | |
| E09 | Texto sin resultados → "Limpiar filtros" | Resetea búsqueda y los 2 filtros | ✓ | |
| E10 | Contador "N resultados" | Igual a las filas filtradas | ✓ | |
| E11 | Buscar estando en la página 2 | Vuelve a la página 1 sin quedar en una página vacía | — | |

### F. Tabla, tarjetas y responsive

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | > 10 alumnos (D20) | Paginado de a 10, "Mostrando 1 a 10 de N" correcto | ✓ | |
| F02 | Desktop | La tabla scrollea por dentro; el documento no (app-like) | ✓ | |
| F03 | 375 px | Tarjetas en vez de tabla; sin scroll horizontal | ✓ | |
| F04 | Desktop con un drawer abierto (contenedor < 900 px) | Cambia a tarjetas | — | |
| F05 | Tarjetas con > 20 alumnos | Hoy no hay "Cargar más": se renderizan todas — ¿rendimiento aceptable? | — | |
| F06 | Botones de la tarjeta (ver, archivar, restaurar) | Hacen lo mismo que en la tabla | ✓ | |
| F07 | Carga con red cortada **(§4)** | Mensaje de error claro (S14) | — | |

### G. Archivar y Papelera

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Archivar D1 (con pagos) | Modal "con historial" que exige "borrarlo" | ✓ | |
| G02 | Archivar un alumno sin pagos ni asistencia | Modal simple (en la práctica casi inalcanzable: toda matrícula tiene pago) | — | |
| G03 | Clic en el tacho: el modal tarda en abrir (4 consultas) | ¿Hay feedback? Doble clic no abre 2 modales | — | |
| G04 | Archivar D7 (B + Prof.) **(§4)** | Hoy desaparece también de la Base B (S15) — **decisión** | — | |
| G05 | Ciclo archivar → Papelera → restaurar | Vuelve con los mismos datos | ✓ | |
| G06 | Papelera → otra pantalla → volver | ¿Se abre la lista activa o sigue en la Papelera? (estado en facade singleton) | — | |
| G07 | "← Alumnos Profesional" en el hero de la Papelera | Vuelve a la lista activa | ✓ | |
| G08 | Falla de red al archivar/restaurar | Toast de error; sin error rojo en consola (S15) | — | |
| G09 | Archivar con clases futuras en la promoción | ¿Sigue en el Libro de clases y en el conteo de la promoción? (hoy sí) — **decisión** | — | |

### H. Ficha desde la lista Profesional

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Ojo en D1 (admin / secretaria) | Abre `/app/{admin,secretaria}/alumnos/:id` en modo Profesional (cards Asistencia Teórica / Práctica / Nota) | ✓ | |
| H02 | Ojo en D7 cuya matrícula más reciente es la B **(§4)** | Debería abrir la matrícula Profesional; hoy abre la B (S17) | — | |
| H03 | Alumno Prof. con un borrador B posterior | La ficha no debería abrir el borrador (S17) | — | |
| H04 | Cards de asistencia y nota | Hoy "—"/0 % porque los datos se cargan en módulos bloqueados (S12) | — | |
| H05 | Botón de certificado | "Certificado (N/3 criterios)" deshabilitado; nunca llega a "Generar" en el piloto | — | |
| H06 | Botón "Generar Carnet" | Deshabilitado para Profesional | — | |
| H07 | "Volver" desde la ficha de D1 | Vuelve a Base Alumnos Prof. (no a la B) | ✓ | |
| H08 | Ficha de un alumno de otra sede por URL (secretaria) | No muestra datos (ver `024b`) | ✓ | |

### I. Links y botones que llevan a módulos bloqueados

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Botón "Pre-inscritos" del hero (admin) **(§4)** | Hoy abre el módulo bloqueado embebido con todas sus acciones (S3) — **decisión:** ocultar el botón o bloquearlo | ✓ | |
| I02 | Mismo botón como secretaria | Igual (S3) | ✓ | |
| I03 | Dentro de Pre-inscritos embebido: abrir un pre-inscrito y usar sus acciones | Si se decide ocultar, no debe ser alcanzable; si se mantiene, pasa a ser alcance de testing | — | |
| I04 | Clic en una notificación de pre-inscripción (campana) **(§4)** | Hoy lleva a "Módulo no disponible" (S21) | — | |
| I05 | Ficha de un alumno finalizado con `?from=ex-alumnos` → "Volver" | Lleva a Ex-Alumnos Prof. → "Módulo no disponible" | — | |
| I06 | Crear promoción sin relatores cargados (Relatores bloqueado) | El select "Seleccionar relator…" queda vacío; la promoción se puede crear igual | ✓ | |
| I07 | Detalle de promoción → curso sin relator | "Sin relator asignado"; no hay link a Relatores | — | |
| I08 | Libro de clases → secciones Firma Diaria, Evaluaciones, Resumen | Vacías por diseño (`fix-250-m`: plantilla para llenar a mano), no rotas | ✓ | |
| I09 | Revisar todo botón/link de las 3 pantallas y de la ficha Profesional | Ninguno lleva a Relatores, Asistencia Prof., Evaluaciones, Certificados, Archivo ni Ex-Alumnos Prof. (salvo I04/I05) | — | |
| I10 | Buscador global: buscar un alumno Profesional | Lleva a su ficha, no a un módulo bloqueado | — | |

### J. Promociones — lista, KPIs y filtros

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Admin y secretaria entran a Promociones | Skeleton → tabla; consola sin errores; red sin 4xx/5xx | ✓ | |
| J02 | Orden | En curso primero, luego canceladas, planificadas al final; dentro de cada grupo por fecha de inicio descendente | ✓ | |
| J03 | Columnas | Nombre + código, fechas dd/MM/yyyy, "inscritos / máximo", badges de cursos con tooltip "Curso: n/25 alumnos", estado | ✓ | |
| J04 | KPIs Total / En curso / Planificadas / Canceladas | Coinciden con la tabla | ✓ | |
| J05 | Buscar por nombre y por código | Encuentra | ✓ | |
| J06 | Filtro Estado = Finalizada | Hoy siempre vacío (S4) | ✓ | |
| J07 | Filtro con "x" de limpiar y "Limpiar Filtros" en el estado vacío | Resetean | ✓ | |
| J08 | D15 (finalizada) | No aparece en la lista — ¿dónde se consulta una promoción terminada? **decisión** | — | |
| J09 | Columna Alumnos de D16 / con retirados | Cuenta también retirados y completados (S19) | — | |
| J10 | 375 px / drawer abierto | Tarjetas; sin scroll horizontal | ✓ | |
| J11 | Primera carga con la red cortada | Mensaje de error (hoy lista vacía, S14) | — | |

### K. Crear promoción

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | "Programar Promoción" | Drawer con 8 lunes desde hoy, con punto en los "sugeridos" | ✓ | |
| K02 | Lunes sugeridos vs cadencia real **(§4)** | Los puntos coinciden con la cadencia de 14 días de las promociones automáticas (S5) | — | |
| K03 | Elegir un lunes | Nombre "Promoción D de Mes AAAA" y fecha de término "Calculando…" → fecha | ✓ | |
| K04 | Lunes con un feriado en el rango (D14) | La fecha de término se extiende; al crear, toast "Se marcaron N feriado(s)…" | — | |
| K05 | API de feriados caída (bloquear `apis.digital.gob.cl` y `api.boostr.cl` en DevTools) | Aviso amarillo "No se pudo verificar feriados…"; se puede crear igual | — | |
| K06 | Cambiar rápido entre 3 lunes | La fecha de término final corresponde al último lunes elegido | — | |
| K07 | "Crear promoción" sin elegir fecha | Botón deshabilitado | ✓ | |
| K08 | Crear con relatores asignados (D17) | Solo se ofrecen relatores con esa especialización; se puede quitar con la "x" | — | |
| K09 | Crear **(§4)** | Aparece en la lista como Planificada, **sin código**, con 4 cursos y sesiones generadas | ✓ | |
| K10 | Crear en un lunes que ya tiene promoción | Error claro (hoy mensaje técnico de unicidad) | — | |
| K11 | Doble clic en "Crear promoción" | Se crea una sola | — | |
| K12 | Falla a mitad (cortar red tras el primer curso) | ¿Queda una promoción a medias? (S20) | — | |
| K13 | Cancelar / cerrar el drawer | No crea nada | ✓ | |
| K14 | Secretaria crea una promoción | ¿Debe poder? Hoy sí — **decisión** | — | |

### L. Ver, editar y cambiar estado

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Ojo → detalle | Datos, KPIs por curso, relatores, "Día de clase N de 30" si está en curso | ✓ | |
| L02 | Desplegar alumnos de un curso | Lista con nombre, RUT y estado traducido (hoy `withdrawn` sin traducir, S19) | — | |
| L03 | "Editar promoción" desde el detalle | Abre el editor apilado con los datos precargados | ✓ | |
| L04 | Asignar código numérico (ej. 290) **(§4)** | Se guarda y se propaga a los cursos como 290.2 / 290.3 / 290.4 / 290.5 | ✓ | |
| L05 | Código con letras solo | Mensaje "Debe ser solo números" y botón deshabilitado | ✓ | |
| L06 | Código con letras **y** nombre cambiado **(§4)** | No debería guardar (S7) | — | |
| L07 | Vaciar el nombre | No debería guardar (S7) | — | |
| L08 | Código repetido (el de otra promoción) | ¿Se permite? — **decisión** | — | |
| L09 | Planificada con inicio futuro | Solo "Planificada/Cancelada" + aviso "Podrás cambiarla a En curso a partir del…" | ✓ | |
| L10 | Planificada con inicio hoy o pasado | Aparece "En curso" | — | |
| L11 | En curso → Finalizada **(§4)** | Qué pasa con sus alumnos (S4) — solo en local/staging | — | |
| L12 | Cancelar una promoción con alumnos (D16) **(§4)** | Aviso "irreversible… reasignar manualmente"; ¿hay confirmación? ¿dónde se reasignan? | — | |
| L13 | Finalizada / Cancelada | Sin más transiciones posibles | ✓ | |
| L14 | Fechas | No editables | ✓ | |

### M. Cadencia automática (cron + edge function)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Estado del colchón hoy | Existe ≥ 1 promoción En curso y 2 Planificadas en la sede Profesional (AC1 de `0002-m`) | — | |
| M02 | Próxima automática | Inicio = última automática + 14 días, lunes; código = último + 1; cursos con código `N.2…N.5`; `class_book` creado | — | |
| M03 | Transición diaria | Planificada pasa a En curso el día de inicio y a Finalizada el día después de término | — | |
| M04 | Nombre de la automática | "Promoción N (D de Mes AAAA)" (distinto formato que la manual — ¿aceptable?) | — | |
| M05 | Invocar la función dos veces seguidas con el colchón completo | No crea nada (AC-E1) | — | |
| M06 | **Seguridad (S2)** **(§4)** | Invocarla sin sesión debe dar 401 | — | |
| M07 | Sin promociones En curso (entorno local) **(§4)** | No debería crear 10 promociones (S2) | — | |
| M08 | Promoción manual en la fecha que toca a la automática **(§4)** | La automática no debe quedar trabada (S5) | — | |
| M09 | Cancelar la única En curso | ¿Qué hace el cron al día siguiente? (S2) | — | |

### N. Matrícula tardía y convalidaciones (cruce con matrícula)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Wizard de matrícula Profesional → selector de promoción | Lista las Planificadas y En curso vigentes, no solo la última (AC3 `0002-m`) | ✓ | |
| N02 | Matricular en una promoción que empezó hace ≤ 3 días (D18) | Sin advertencia (AC4) | — | |
| N03 | Matricular en una que empezó hace > 3 días (D18) **(§4)** | Modal de confirmación; solo continúa si confirma; igual para admin y secretaria (AC5) | — | |
| N04 | Matricular un A5 que convalida A3 **(§4)** | Queda `license_validations`; badge en la Base; aparece en el libro A5 y en Conv. A-3 | — | |
| N05 | Curso lleno (25) | ¿El wizard lo impide? ¿El detalle lo muestra en rojo? | — | |
| N06 | Promoción cancelada o finalizada | No se ofrece en el wizard | — | |

### O. Libro de clases — carga y selectores

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Entrar (admin y secretaria) | Autoselecciona la promoción En curso y su primer curso; se ve la Cabecera | ✓ | |
| O02 | Selector de promoción | Planificadas, En curso y Finalizadas; sin Canceladas | ✓ | |
| O03 | Promoción sin código (D13) | Hoy "Nombre ()" (S18) | — | |
| O04 | Selector de curso | 4 cursos + "Conv. A-3" (si hay A5) + "Conv. A-4" (si hay A2) — AC1 `0018-m` | ✓ | |
| O05 | Cambiar de promoción | Se resetea el curso y la semana; carga el primer curso | ✓ | |
| O06 | Cambiar rápido de curso 3 veces | Termina mostrando el último elegido, sin mezclar alumnos | — | |
| O07 | Admin cambia de sede con el Libro abierto **(§4)** | Recarga la lista de promociones (S9) | — | |
| O08 | Salir y volver | Carga desde cero (el facade se resetea); sin datos viejos | — | |
| O09 | Promoción sin cursos o sin sesiones | Empty state o "Sin sesiones registradas"; sin errores | — | |

### P. Libro de clases — secciones en pantalla

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Cabecera | Autoescuela, curso, ID (código del curso), promoción (código), fechas, dirección, horario fijo | ✓ | |
| P02 | Profesores por módulo | 7 módulos (5 en convalidación) con relator o "—" | ✓ | |
| P03 | Lista de clase | Ordenada por apellido; N°, RUN, teléfono, licencia | ✓ | |
| P04 | ¿Quiénes salen en la lista? | Excluye cancelados y borradores; hoy **incluye** retirados, completados, inactivos y archivados — **decisión** | — | |
| P05 | Firma diaria | Semanas lun-sáb paginadas "Semana N de M", celdas vacías "—" | ✓ | |
| P06 | Calendario | Una fila por sesión no cancelada, todas "Clase Teórica · 5 h · primer relator" — distinto a la malla del PDF (ver R04) | — | |
| P07 | Evaluaciones | Columnas "Mód. 1…7" (Conv. A-3: 3,4,5,6,7 · Conv. A-4: 2,4,5,6,7) y notas vacías | ✓ | |
| P08 | Resumen asistencia | Un alumno por fila, "—" | ✓ | |
| P09 | Conv. A-3 / A-4 (D2, D3) | Solo alumnos que convalidan esa licencia; fechas = últimas 16 / 13 sesiones activas del curso madre | ✓ | |
| P10 | Conv. sin alumnos que convaliden | Se ve igual, sin error (AC-E1) | — | |
| P11 | Dos alumnos con el mismo nombre en Resumen | Sin errores de claves duplicadas en consola | — | |
| P12 | Desktop | App-like: subnav + card que scrollea por dentro; el documento no scrollea | ✓ | |

### Q. Libro de clases — código SENCE

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Escribir un código | "Guardar" se habilita; "Sin cambios" desaparece | ✓ | |
| Q02 | Guardar | Toast; "Última modificación: nombre · fecha hora" (fix-098-m) | ✓ | |
| Q03 | Recargar | Persiste, con el mismo registro de quién y cuándo | ✓ | |
| Q04 | Códigos distintos en el libro A2 y en Conv. A-4 | Independientes (AC10 `0018-m`) | ✓ | |
| Q05 | Exportar PDF y después guardar el código **(§4)** | Se guarda sin error (S8) | — | |
| Q06 | Borrar el código y guardar | ¿Se permite vacío? — **decisión**; queda auditado | — | |
| Q07 | Secretaria edita el código de un libro `closed` | Owner dijo "sin restricción" (fix-098-m), pero la RLS lo impide para secretaria — anotar | — | |
| Q08 | Doble clic en Guardar | Una sola escritura | — | |

### R. Libro de clases — PDF

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | "Exportar PDF" | Spinner "Generando PDF…" → descarga `LibroDeClases_<promo>_<curso>.pdf` no vacío | ✓ | |
| R02 | Comparar con el libro físico **(§4)** | Portada, reglamento, antecedentes, asistencia, calendario (malla verbatim), evaluaciones y resumen como el real (spec `0017-m`) | — | |
| R03 | PDF Conv. A-3 y Conv. A-4 | Portada "CURSO CONVALIDACIÓN CLASE A-3/A-4", ID `código.6`/`código.7`, sin hoja de feriados (AC4/AC6 `0018-m`) | — | |
| R04 | Calendario del PDF vs pantalla | El PDF usa la malla real; la pantalla muestra filas genéricas — ¿aceptable? | — | |
| R05 | Curso con > 25 alumnos (D20) | Tablas paginadas sin cortar filas | — | |
| R06 | D21 (pocas sesiones) | Aviso de "bloques sin fecha"; no inventa fechas (AC-E3) | — | |
| R07 | Tildes y ñ | Se ven bien | — | |
| R08 | El código SENCE guardado sale en la portada | Sí | — | |
| R09 | Promoción sin código | ¿Qué ID sale? ¿Cómo se llama el archivo? | — | |
| R10 | Falla / timeout | Toast de error claro; el botón vuelve a la normalidad | — | |
| R11 | **Seguridad (S1)** **(§4)** | Sin sesión no se obtiene el PDF | — | |
| R12 | Generar el PDF de un libro `closed` | Hoy lo reabre a `active` (S1) — confirmar | — | |

### T. Sedes, roles y seguridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| T01 | Admin cambia de sede en Alumnos Prof. y Promociones | Recarga sola (solo hay sedes Profesional seleccionables) | ✓ | |
| T02 | Cambio rápido de sede con Slow 3G (si hay 2 sedes Profesional) | Termina con los datos de la última sede (S16) | — | |
| T03 | Secretaria de sede Profesional | Ve solo su sede en las 3 pantallas | ✓ | |
| T04 | Secretaria con grant en sede sin Profesional → entra por URL | Se autoselecciona la sede Profesional | — | |
| T05 | **RLS promociones (S6)** **(§4)** | Una secretaria de sede sin Profesional no puede modificar promociones | ✓ | |
| T06 | RLS enrollments desde la Base Prof. | Una secretaria no lee alumnos Prof. de otra sede desde la consola | ✓ | |

### U. Tiempo real, 2 sesiones y visual

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| U01 | 2 sesiones: matricular Prof. en A **(§4)** | Aparece en la Base Prof. de B sin recargar (S13) | ✓ | |
| U02 | 2 sesiones: archivar en A | ¿Se actualiza en B? (el canal no escucha `students`) | — | |
| U03 | 2 sesiones: crear promoción en A | Promociones en B no escucha cambios: solo al volver a entrar — confirmar si es aceptable | — | |
| U04 | 2 sesiones: guardar código SENCE en A y en B | El último pisa al primero; ¿B se entera? | — | |
| U05 | Salir de la Base Prof. | Se cierra el canal (DevTools → WS) | — | |
| U06 | Modo oscuro y claro en las 3 pantallas, drawers y PDF | Todo legible | ✓ | |
| U07 | 375 / 768 / 1440 px | Sin scroll horizontal | ✓ | |
| U08 | Solo teclado | Se llega a todo; el foco se ve; los lunes del drawer se pueden elegir con teclado | — | |
| U09 | Tooltips | Presentes en todos los botones de solo ícono | — | |

---

## 4. Casos con pasos numerados

### A04 — Secretaria de sede sin Profesional

**Precondición:** sesión de secretaria de una sede sin Profesional, sin grant.
1. Verificar que el menú lateral no tiene el grupo "Academia Profesional".
2. Escribir en la barra `/app/secretaria/profesional/alumnos`.
3. Repetir con `/app/secretaria/profesional/promociones` y `/app/secretaria/libro-de-clases`.

**Esperado:** en los pasos 2 y 3 redirige a `/app` (su dashboard), sin mostrar la pantalla ni por
un instante. **Evidencia:** URL final de cada paso.

### A10 — F5 directo en una pantalla Profesional

**Precondición:** sesión admin; selector en una sede **sin** Profesional.
1. Escribir en la barra `/app/admin/clase-profesional/promociones` y presionar Enter (carga completa).
2. Mirar el selector de sede del topbar cuando termina la carga.
3. Repetir con `/app/admin/libro-de-clases` y `/app/admin/clase-profesional/alumnos`.

**Esperado:** el selector queda en la sede Profesional y las pantallas muestran sus datos. Si queda
en "Todas" o en la sede sin Profesional, anotarlo (S22) y **no** crear promociones en ese estado
(quedarían con sede vacía).

### B09 — Matricular un alumno Profesional y encontrarlo

**Precondición:** promoción En curso D11; datos de un alumno nuevo ≥ 20 años.
1. Anotar el total de la Base Prof. y el "inscritos / máximo" del curso A2 de D11 en Promociones.
2. Matricular por el wizard (ver `023`) en A2 de D11.
3. Volver a la Base Prof.
4. Abrir Promociones → ojo en D11 → desplegar alumnos de A2.
5. Abrir el Libro de clases → D11 → A2 → "Lista de clase".

**Esperado:** paso 3 el alumno aparece primero y el total subió en 1; paso 4 el contador subió en 1
y el alumno está en la lista con estado "Activo"; paso 5 aparece ordenado por apellido.

### F07 — Error de carga visible

**Precondición:** sesión admin.
1. DevTools → Network → "Offline".
2. Navegar a Base Alumnos Prof. (o recargar).
3. Ver qué se muestra al terminar el skeleton.
4. Repetir con Promociones.
5. Volver a "No throttling" y recargar.

**Esperado:** en 3 y 4 un mensaje de error claro (no "No hay alumnos profesionales · Limpiar
filtros" ni "No se encontraron promociones"). Revisar la consola por "Uncaught (in promise)" (S14).

### G04 — Archivar un alumno B + Profesional

**Precondición:** D7 visible en la Base Prof. y en la Base B.
1. En la Base Prof., archivar D7 (escribir "borrarlo").
2. Ir a la Base B y buscar D7.
3. Volver a la Base Prof. → Papelera → restaurar D7.
4. Buscar D7 en ambas bases.

**Esperado:** anotar si en el paso 2 D7 desapareció también de la Base B (S15). Paso 4: vuelve a
ambas. La regla de negocio (¿archivar desde Prof. debe afectar a B?) va a §5.

### H02 — Ficha de un alumno cuya matrícula más reciente no es la Profesional

**Precondición:** D7 con la matrícula B creada **después** de la Profesional.
1. En la Base Prof., clic en el ojo de D7.
2. Ver qué columna de progreso muestra la ficha (12 clases prácticas = B; Asistencia Teórica/Práctica/Nota = Prof.).
3. Ver las pestañas de matrícula arriba y cambiar a la Profesional.
4. Clic en "Volver".

**Esperado:** en el paso 2 la ficha debería mostrar la matrícula Profesional (vienes de esa lista);
en el paso 4 volver a la Base Prof. Anotar lo que pasa (S17).

### I01 — Botón "Pre-inscritos" con el módulo bloqueado

**Precondición:** sesión admin en la Base Prof.
1. Verificar si el hero muestra el botón "Pre-inscritos".
2. Clic en el botón.
3. Verificar la URL y el contenido.
4. Abrir un pre-inscrito de la lista (si hay) y revisar qué acciones ofrece el drawer.
5. Escribir `/app/admin/clase-profesional/pre-inscritos` en la barra.
6. Repetir 1-3 como secretaria.

**Esperado según la decisión del piloto:** el botón no debería existir (o llevar a "Módulo no
disponible", como el paso 5). Si en el paso 3 aparece la lista completa con la URL de la Base Prof.,
S3 confirmada → reportar.

### I04 — Notificación de pre-inscripción

**Precondición:** existe una notificación `referenceType = 'preinscription'` para el usuario (crearla
en local por seed si no hay ninguna).
1. Abrir la campana.
2. Clic en la notificación de pre-inscripción.

**Esperado:** no deja al usuario en un callejón: o no navega, o explica que el módulo no está
disponible y permite volver sin perder la sesión (S21).

### K02 — Lunes sugeridos vs cadencia automática

**Precondición:** D11 y D12 creadas por el cron (anotar sus fechas de inicio).
1. "Programar Promoción".
2. Anotar los lunes con punto.
3. Comparar con la próxima fecha que tocaría al cron: la fecha de inicio más nueva con código numérico + 14 días, y así sucesivamente.

**Esperado:** los lunes sugeridos coinciden con la cadencia. Si están desfasados una semana, S5
(mitad 1) confirmada.

### K09 — Crear una promoción manual

**Precondición:** local/staging; sesión admin en la sede Profesional; D17 cargado.
1. "Programar Promoción" → elegir un lunes **que no** coincida con la cadencia (ver K02).
2. Asignar un relator a A2.
3. "Crear promoción".
4. Verificar el toast, que la promoción aparece como Planificada y que el código está vacío.
5. Abrirla con el ojo: 4 cursos, relator en A2, capacidad 25 por curso.
6. Libro de clases → elegir la promoción → verificar el selector (S18), "ID: —" y que el calendario tiene sesiones.

**Evidencia:** captura de los pasos 4 y 6.

### L04 — Código MTT y propagación a los cursos

**Precondición:** la promoción de K09.
1. Editar → código `290` → Guardar.
2. Abrir el detalle: código 290.
3. Libro de clases → esa promoción → cada curso: ID `290.2`, `290.3`, `290.4`, `290.5`; Conv. A-3 `290.6`, Conv. A-4 `290.7`.

**Esperado:** como arriba. Si la promoción es la más nueva con código numérico, anotar que el cron
calculará desde ella la próxima fecha y el próximo código (cruce con M08).

### L06 — Código inválido que se guarda igual

1. Editar una promoción de prueba.
2. Escribir el código `abc` → verificar el mensaje "Debe ser solo números" y el botón deshabilitado.
3. Sin tocar el código, agregar una letra al nombre.
4. Ver si "Guardar cambios" se habilita y, si se habilita, guardar.
5. Reabrir el detalle.

**Esperado:** en el paso 4 el botón sigue deshabilitado. Si guarda y el detalle muestra `abc`, S7
confirmada.

### L11 — Finalizar una promoción a mano (local/staging)

**Precondición:** promoción En curso de prueba con al menos 1 alumno `active` (anotar su nombre).
1. En la Base Prof. verificar que el alumno está.
2. Promociones → Editar → estado "Finalizada" → Guardar.
3. Verificar si la promoción sigue en la lista de Promociones.
4. Volver a la Base Prof. y buscar al alumno.
5. Libro de clases → buscar la promoción en el selector.
6. Buscar al alumno en la Base B, en Ex-Alumnos B y en el buscador global.

**Esperado / anotar:** ¿hubo confirmación antes de finalizar? En 3 y 4 hoy ambos desaparecen (S4);
en 5 la promoción sigue. Anotar en qué pantalla visible del piloto queda el alumno.

### L12 — Cancelar una promoción con alumnos (local/staging)

**Precondición:** D16 aún En curso o Planificada, con alumnos.
1. Editar → "Cancelada" → leer el aviso → Guardar.
2. Verificar si hubo un modal de confirmación.
3. Buscar a sus alumnos en la Base Prof. (¿qué promoción muestran?).
4. Libro de clases: ¿aparece la promoción?
5. Buscar en la app dónde se "reasignan manualmente".

**Esperado / anotar:** comportamiento de cada paso; la regla (¿qué pasa con los alumnos?) va a §5.

### M06 — Seguridad: invocar la creación automática sin sesión (S2)

**Precondición:** local o staging, con el colchón **completo** (M01 ✅), para que una llamada exitosa
no cree nada.
1. Desde una terminal sin sesión: `POST <SUPABASE_URL>/functions/v1/auto-create-next-promotions` sin header `Authorization`, body `{}`.
2. Anotar el código HTTP y el cuerpo.

**Esperado:** 401. Si responde `200 {"created":0}`, S2 (mitad 1) confirmada: cualquiera puede
dispararla.

### M07 — Sin promociones En curso (solo local)

**Precondición:** base local; dejar la sede 2 sin promociones `in_progress` (por ejemplo, marcar la
En curso como Cancelada desde la UI).
1. Contar las promociones Planificadas.
2. Invocar la función una vez (como en M06).
3. Volver a contar.

**Esperado:** crea como máximo lo necesario (o nada). Si crea 10, S2 (mitad 2) confirmada.

### M08 — Promoción manual en la fecha del cron (solo local)

**Precondición:** calcular la próxima fecha que tocaría al cron (K02).
1. Crear a mano una promoción en exactamente esa fecha (queda sin código).
2. Hacer que falte una Planificada (cancelar una de prueba).
3. Invocar la función.

**Esperado:** la función completa el colchón sin error. Si responde 500 con un error de unicidad
(`professional_promotions_branch_start_date_key`), S5 confirmada: el cron quedaría fallando cada día.

### N03 — Matrícula tardía

**Precondición:** D18 (promoción que empezó hace > 3 días).
1. Admin: wizard de matrícula Profesional → elegir D18.
2. Verificar el modal que avisa que pasaron más de 3 días.
3. "Cancelar" → no avanza.
4. Repetir y confirmar → la matrícula continúa.
5. Repetir 1-3 como secretaria.

**Esperado:** AC5 de `0002-m` para ambos roles; con la promoción de ≤ 3 días no hay modal (N02).

### N04 — Convalidación de punta a punta

**Precondición:** promoción En curso con curso A5.
1. Matricular un alumno A5 marcando convalidación A3 (ver `023`).
2. Base Prof.: badge "Convalida A3" en su fila y tarjeta.
3. Libro → A5 → Lista de clase: aparece.
4. Libro → Conv. A-3: aparece solo él (y otros que convaliden A3).
5. Exportar el PDF de Conv. A-3 y verificar su nombre y RUN.

**Esperado:** como arriba (AC2/AC3 de `0018-m`).

### O07 — Libro de clases al cambiar de sede

**Precondición:** admin; al menos 2 sedes con `has_professional = true` (si hay una sola, marcar este
caso como "no aplica" y anotar S9 como teórica).
1. Abrir el Libro en la sede A → anotar la lista de promociones.
2. Cambiar a la sede B en el topbar.
3. Abrir el selector de promociones.

**Esperado:** muestra las promociones de B. Si siguen las de A, S9 confirmada.

### Q05 — Guardar el código SENCE después de exportar el PDF

**Precondición:** un libro que nunca se exportó ni guardó: Conv. A-4 de la promoción de K09 (o de
cualquier promoción creada a mano).
1. Abrir ese libro; verificar que el código SENCE está vacío.
2. "Exportar PDF" y esperar la descarga.
3. Sin recargar, escribir un código y "Guardar".
4. Recargar la página y volver al mismo libro.

**Esperado:** en el paso 3 toast "Datos del libro guardados" y en el 4 el código persiste. Si el
paso 3 da un error de clave duplicada, S8 confirmada.

### R02 — PDF contra el libro físico

**Precondición:** D11 con alumnos, código MTT y código SENCE; el libro físico (o `libroclases.pdf`).
1. Exportar el PDF del curso A2.
2. Comparar página por página: portada (ID, fechas, sede, horario, código SENCE), reglamento,
   antecedentes (N°, nombre, RUN, teléfono), asistencia semanal (7 días, domingos), calendario
   (malla verbatim con las fechas reales de la promoción, sin feriados), evaluaciones (7 columnas,
   sin fechas), resumen de asistencia.
3. Repetir con A5, Conv. A-3 y Conv. A-4.

**Esperado:** sin diferencias de estructura con el real. Anotar cada diferencia con número de
página.

### R11 — Seguridad: PDF sin sesión (S1)

**Precondición:** conocer un `promotion_course_id` de prueba (Network, al exportar desde la app).
1. Desde una terminal sin sesión: `POST <SUPABASE_URL>/functions/v1/generate-class-book-pdf` sin header `Authorization`, body `{"promotion_course_id": <id>}`.
2. Si responde con `pdfUrl`, abrirla en una ventana privada.
3. Repetir con la sesión de una secretaria de una sede **sin** Profesional (copiar su token).

**Esperado:** 401/403 en 1 y en 3, **nunca** un PDF. Si en el paso 2 se descarga el PDF con RUN y
teléfonos, S1 confirmada → **P0 inmediato**.

### T05 — RLS de promociones (S6)

**Precondición:** local/staging; sesión de secretaria de una sede **sin** Profesional; id de una
promoción de prueba de la sede Profesional.
1. Con la sesión de esa secretaria, abrir cualquier pantalla y copiar desde Network una petición a `/rest/v1/…` ("Copy as fetch") para reusar su token.
2. En Console, hacer un `GET /rest/v1/professional_promotions?select=id,name,status`.
3. Hacer un `PATCH /rest/v1/professional_promotions?id=eq.<id>` con `{"name":"prueba rls"}`.

**Esperado:** 0 filas en el paso 2 y rechazo en el 3. Si puede leer o modificar, S6 confirmada
(con `status: "finished"` además dispararía S4).

### U01 — Tiempo real: alumno Profesional nuevo

**Precondición:** 2 navegadores o perfiles distintos, ambos con la Base Prof. abierta.
1. En A, matricular un alumno Profesional.
2. Sin tocar B, esperar 5 segundos.
3. Si no apareció, recargar B.

**Esperado:** aparece en B sin recargar. Si solo aparece al recargar, S13 confirmada (el dato
existe, el evento no llega).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| I01 / I03 | ¿El botón "Pre-inscritos" de la Base Prof. se oculta en el piloto (como el resto del módulo)? |
| B02 / E07 | ¿Dónde se ven en el piloto los alumnos Profesional retirados o cancelados? |
| L11 / J08 | ¿Dónde se consultan en el piloto las promociones finalizadas y sus alumnos (Ex-Alumnos Prof. está bloqueado)? ¿Se debe poder finalizar a mano? |
| L12 | ¿Qué pasa con los alumnos de una promoción cancelada? ¿Dónde se reasignan? ¿Hace falta un modal de confirmación? |
| K14 | ¿La secretaria puede crear, finalizar y cancelar promociones? |
| K02 / M08 | ¿Las promociones manuales deben seguir la cadencia de 14 días o pueden ir en cualquier lunes? ¿Deben nacer con código? |
| L08 | ¿Se permite repetir un código MTT? |
| G04 | ¿Archivar desde la Base Prof. debe archivar también a la persona en Clase B? |
| G09 / P04 | ¿Retirados, completados y archivados deben aparecer en el Libro de clases y en los conteos de la promoción? |
| B05 / D01 | Un alumno con 2 matrículas Profesional: ¿una fila o dos? ¿El total cuenta personas o matrículas? |
| C05 | ¿La columna "Promoción" debe mostrar la promoción (nombre/código) o el curso? |
| E05 | Un A5 que convalida A3: ¿debe salir también con el filtro "A3"? |
| S12 / H04 | ¿Es aceptable que semáforo, módulos, nota y certificado salgan vacíos durante todo el piloto? |
| D05 / D06 | ¿Los KPIs deben seguir a los filtros y a la Papelera? |
| P06 / R04 | ¿El calendario en pantalla debe coincidir con la malla del PDF? |
| Q06 / Q07 | ¿Se permite dejar vacío el código SENCE? ¿La secretaria puede editarlo en un libro cerrado? |
| A07 / A09 | Tras "Conmutar Sede", ¿debe navegar al ítem? ¿Al salir se conserva la sede que tenía el usuario? |
