# Tasks 0060-b — Una lectura que falla se ve como error, no como ceros o "sin datos"

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-11-10

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y se termina en una sentada.
- Se marca `[x]` apenas pasa su DoD (no antes, no en bloque).
- Las fases son las etapas del plan: **cada fase es un PR** (la fase 2 son dos).
- Si aparece un facade que no está listado, se agrega a la fase que le corresponda antes de tocarlo.
- Algo fuera del alcance de la spec (Caja, Agenda, un wrapper, cálculo del cierre en el servidor)
  → **detenerse** y abrir asignación aparte.

## DoD común de las tareas de facade ("DoD-F")

Las tareas T1.x a T4.x migran un facade y sus pantallas. Todas cumplen esto, además de lo propio:

- [ ] Tests en rojo antes del cambio, en verde después: primera carga con `{ error }`, cambio de
  filtro o sede con `{ error }`, refresco con `{ error }`, reintento que sale bien, y una de
  varias consultas con `{ error }` (los que apliquen al facade)
- [ ] Toda lectura lanza: `assertReadOk(...)` o `if (error) throw error` antes de usar `data`
- [ ] Caso A: el facade deja `error()` con mensaje propio de la pantalla y los datos en estado
  inicial; la pantalla muestra `app-empty-state` con "Reintentar" en vez de lista y KPIs
- [ ] Caso B: un refresco que falla no borra lo visible; si la pantalla tiene una acción que guarda
  un valor calculado con esos datos, queda bloqueada y se muestra `app-alert-card`
- [ ] El chequeo `isCurrent()` del request guard sigue después del `throw`
- [ ] Botón "Reintentar" con `data-llm-action`
- [ ] Facade fuera de `PENDING` en `unchecked-reads.guard.spec.ts`
- [ ] Sus pantallas sin `knownBug` en el bloque X01 de `e2e/transversal-shell.spec.ts`
- [ ] Recorrido con red normal y cada rol que usa la pantalla: no aparece ningún error nuevo

---

## Fase 0 — Base (PR 1)

- [x] **T0.1** — `assertReadOk` en `core/utils/db-error.utils.ts`
  - **AC ref:** AC1
  - **DoD:**
    - [x] `db-error.utils.spec.ts` primero: con `error` lanza ese error; sin `error` devuelve `data`
      (8 casos nuevos en rojo antes del código, en verde después)
    - [x] Tipado: devuelve el tipo de `data` sin `null` solo donde la consulta lo garantiza (lista
      sin `null`, `maybeSingle()` con `null`, `any` sigue `any`; probado que el test de tipos
      falla con un tipo incorrecto)
    - [x] Documentado en `indices/UTILS.md`
  - **Resultado (2026-11-10):** `npm run test:ci` 4791 ✅, `lint:arch` 0 errores, `tsc` de specs
    sin errores nuevos (los 120 que reporta ya estaban en `main`).

- [x] **T0.2** — Detector de lecturas sin chequeo (`unchecked-reads.guard.spec.ts`)
  - **AC ref:** AC1
  - **DoD:**
    - [x] Tests del detector: F1 en una línea, F1 en varias líneas, F2 (`Promise.all` con `.data`
      sin `.error`), lectura con `error` capturado, lectura con `assertReadOk`, y no marca una
      escritura. Además: `await q` de un builder armado antes, renombres (`data: rows`,
      `error: e`), `throwOnError()`, patrones `{ data }` dentro de la tupla de un `Promise.all`,
      y que el chequeo de `.error` se busque solo dentro del mismo método (13 casos)
    - [x] Misma estructura que `unchecked-writes.guard.spec.ts`
  - **Límite conocido:** no ve una desestructuración anidada (`{ data: { session } }`, solo la
    usa `auth.getSession()`), ni que la pantalla muestre un error que el facade sí captura (F3).

- [x] **T0.3** — Lista `PENDING` con dueño por etapa
  - **AC ref:** AC1, AC9
  - **DoD:**
    - [x] Cada facade que el detector marca está en `PENDING` con la etapa que lo cubre (31)
    - [x] Test que falla si un facade en `PENDING` ya no tiene lecturas sin chequeo, y otro que
      falla si una entrada nombra un facade que no existe
    - [x] `cuadratura.facade.ts` y `agenda.facade.ts` pasan sin estar en la lista
    - [x] Si la lista difiere de §2 del plan, se actualiza el plan: se sumó `student-home`
      (etapa 3a); `reportes-contables` y `servicios-especiales` pasan el guard (son F3)
  - **Resultado (2026-11-10):** guard 78/78, `npm run test:ci` 4869 ✅, `lint:arch` 0 errores.

- [x] **T0.4** — Bloque "X01. Pantallas sin red" en `e2e/transversal-shell.spec.ts`
  - **AC ref:** AC8
  - **DoD:**
    - [x] Corta `rest/v1` y `functions/v1` con `page.route(... abort)` y navega por el menú (SPA).
      La red se corta recién cuando el ítem del menú ya está visible: los de Clase Profesional
      aparecen después de una consulta y, cortando antes, nunca aparecían
    - [x] Una fila por pantalla de la tabla X01 de `fix-190-b` (secretaria sede 2), más Clase
      Profesional y Anticipos (admin): 22 pantallas.
      **Quedan fuera:** los portales de instructor y alumno (no hay cuentas E2E de esos roles) y
      Relatores y Asistencia Prof. (ocultos en el menú por el recorte del piloto). Sus facades
      siguen cubiertos por el guard; su pantalla se verifica a mano en su etapa
    - [x] Agenda y Caja Diaria pasan; las no migradas quedan como `knownBug`
    - [x] Corre contra el build de producción (`ng serve -c production`)
  - **Resultado (2026-11-10):** 48/48 con `--repeat-each=2`. Sin marcas
    (`E2E_SHOW_KNOWN_BUGS=1`) las 12 marcadas fallan por no mostrar "Reintentar".
    **10 pantallas ya cumplen**, varias por tracks posteriores a X01: Agenda, Caja Diaria,
    Dashboard, Servicios especiales, Alumnos, Ex-Alumnos, Documentos (`fix-473-m`), Flota,
    Promociones y Base Alumnos Prof.
    **12 quedan marcadas:** Pagos, Reportes, Liquidaciones, Anticipos (etapa 1); Cursos
    singulares, Certificados (etapa 2); Asistencia, Instructores, Comunicación (etapa 3a);
    Certificados Prof., Archivo, Libro de Clases (etapa 3b).
  - **Para correrlo:** contra el build de producción en un puerto libre; si el 4200 lo ocupa otro
    checkout, Playwright lo reutiliza y prueba otro código.

- [x] **T0.5** — Corregir `swr-pattern.md` y `facades.md`
  - **AC ref:** AC2
  - **DoD:**
    - [x] El ejemplo de `refreshSilently()` no es un `catch` vacío y el de `fetchData()` revisa
      `error` (con `assertReadOk`). `initialize()` además marca `_initialized` solo si la carga
      salió bien, para que una primera carga fallida se reintente con skeleton
    - [x] Los casos A y B quedan enunciados como regla, con su criterio de aplicabilidad: "¿lo que
      está en pantalla responde a la misma pregunta que la consulta que falló?"
    - [x] Corrige además el typo del ejemplo (`refreshSilently(): {Promise<void>`)
    - [x] Pasa el Harness Gate (sin citar tracks: la regla se sostiene sola)
  - **Resultado (2026-11-10):** `swr-pattern.md` gana la sección "Errores de carga" (3 reglas,
    pantalla, cuándo agregar `_refreshFailed`) y dos prohibiciones; `facades.md` §4 muestra la
    lectura con su error y remite a `swr-pattern.md`.

- [x] **T0.6** — Gotcha e índices
  - **DoD:**
    - [x] Gotcha nuevo en `indices/DOMAIN-GOTCHAS.md`, par de DG-103: una lectura que falla no
      lanza (DG-123, con las dos formas: el Facade descarta el error / la pantalla no lo muestra)
    - [x] `npm run lint:arch` (0 errores) y `npm run test:ci` en verde (4869). Una primera corrida
      dio 1 falla que no se repitió en dos corridas más: test intermitente ajeno a esta etapa
  - **Etapa 0 cerrada (2026-11-10).**

---

## Fase 1 — Dinero (PR 2)

> Antes de empezar: avisar a Ignacio por `fix-073-i` y partir de `main` con sus PR mergeados.

- [x] **T1.1** — `pagos.facade.ts` + `admin-pagos` y sus drawers
  - **AC ref:** AC3–AC7
  - **DoD:** DoD-F, más:
    - [x] Las 8 lecturas (KPIs, deudores, recientes, desglose) lanzan; una que falle hace fallar la carga
    - [x] `refreshSilently()` deja de tragar el error
  - **Cerrada (2026-11-18):** mergeada en el PR #422 con CI en verde. Sobre `main` con T1.1, T1.2 y
    T1.4 juntas: `lint:arch:strict` 0 errores y `test:ci` 5324 en verde. Las pruebas de navegador y
    las mutaciones son las de la nota de abajo; no se repitieron al cerrar.
  - **Avance (2026-11-17):**
    - **Facade.** Las 7 lecturas de la pantalla (4 KPIs, deudores, recientes, métodos) y las 2 del
      Estado de Cuenta lanzan (`assertReadOk`; el conteo de boletas con `if (error) throw error`).
      Antes cada lectura aplicaba su signal por separado, así que una que fallaba dejaba los demás
      KPIs puestos; ahora `fetchAll()` las aplica juntas y solo si todas salieron bien, con el
      `isCurrent()` después del `throw`. KPIs en `null` (no `0`) sin carga vigente.
      `cargarCompleta()` (primera carga, cambio de sede, reintento del caso A) retira los datos y
      no marca `_initialized` si falla. `refreshSilently()` marca `refreshFailed` (caso B); si no
      hay datos vigentes de esa sede (un Realtime que reemplazó una carga completa, o tras un caso
      A) sigue siendo caso A. `reintentar()` elige B o A. Estado de Cuenta: `errorDetalle` (otra
      matrícula, caso A), `detalleRefreshFailed` (misma matrícula, p. ej. después de registrar un
      pago, caso B) y `reintentarEstadoCuenta()`.
    - **Pantallas** (`admin-pagos`, `secretaria-pagos`): aviso del caso B dentro de la celda
      `.bento-fill` (`p-4 pb-0 shrink-0`); caso A con `app-empty-state` "Reintentar" en la lista,
      hero sin KPIs ni chips y sin el contador "0 de 0 alumnos". Se quitó el banner de error que
      era un hijo directo de la grilla.
    - **Drawers.** Pagos Recientes: caso A en métodos y lista (antes "Sin pagos registrados este
      mes"), aviso del caso B arriba. Estado de Cuenta: caso A distinto de "No se encontró la
      matrícula" (que sigue para una fila inexistente), aviso del caso B. Registrar Pago: guardado
      bloqueado en modo global con la lista caída (antes decía "No hay alumnos con saldo
      pendiente" y el pago se guardaba sin matrícula) y en modo contextual sin Estado de Cuenta ni
      fila en la lista (no se conoce el saldo para el tope); "Reintentar" en ambos, y si la lista
      llega con el drawer abierto el alumno pasa a ser obligatorio.
    - **Bloqueo en caso B: ninguno.** Ninguna acción de la pantalla guarda un valor calculado con
      estos datos: el monto lo escribe el usuario, el saldo lo recalcula el trigger
      `trg_update_balance`, y el reporte PDF lo arma la edge function.
    - **Guardrails.** Fuera de `PENDING`; `S('pagos')` sin `knownBug` en X01. No figuraba en la
      línea base de ARCH-39/40. Mocks viejos del spec del facade sin `.in()` completados: antes
      el `TypeError` se perdía y las lecturas de `enrollments` igual pintaban.
    - **Validación.** TDD: 20 tests del facade en rojo y 8 de pantalla y 8 de drawers en rojo antes
      del cambio. `lint:arch:strict` 0 errores, `ngc --noEmit` limpio, `test:ci` 5211 en verde,
      `test-tz.mjs` 206/206 en las tres zonas (7 specs). Mutaciones: cada uno de los 6 archivos
      vuelto a `main` hace fallar sus tests (2 a 21), y 6 mutaciones dirigidas del facade
      (refresco que traga el error, caso A que no retira, reintento siempre con skeleton, Estado
      de Cuenta siempre caso A, boletas sin revisar `error`, refresco sin datos vigentes como B)
      también.
    - **Navegador (secretaria, 1440x900, claro y oscuro).** Con la red cortada parcheando
      `rest.fetch`: caso A con el estado de error y "Reintentar" dentro de `.bento-fill`, el hero
      sin KPIs ni chips, la grilla con 2 hijos y sin scroll de página; Pagos Recientes y Registrar
      Pago con su error ("Guardar Pago" deshabilitado). Caso B con el aviso dentro de la celda,
      10 filas y KPIs intactos, sin scroll de página; "Reintentar" sin red no muestra skeleton y
      con red lo limpia. Recorrido con red normal (Pagos Recientes, Ver detalle, Registrar Pago
      cancelado, sin escrituras) sin errores nuevos en consola.
    - **Navegador (admin, 1440x900, claro y oscuro).** Caso A en la primera carga y también al
      cambiar de "Todas las sedes" a una sede con la red cortada (se retiran los datos de la
      consulta anterior, sin KPIs, "Reintentar" dentro de `.bento-fill`, sin scroll de página).
      Caso B con el aviso dentro de la celda, 10 filas y KPIs intactos: la tabla pasa de 310 a
      168 px, exactamente el alto del aviso con su padding (no la aplasta la grilla). Recorrido
      con red normal (sede puntual y "Todas", Pagos Recientes, Ver detalle, Registrar Pago
      cancelado, sin escrituras) sin errores nuevos; el único error de consola es el timeout de
      View Transition de la recarga forzada.
    - **X01 contra el build de producción** (`ng serve -c production` en el 4200): `X01:
      /app/secretaria/pagos` en verde con `--repeat-each=2`, y el bloque X01 completo 26/26 (las
      marcadas de etapas posteriores fallan como `knownBug`, como se espera).

- [x] **T1.2** — `reportes-contables.facade.ts` + reportes de admin y secretaria
  - **AC ref:** AC3, AC4, AC6
  - **DoD:** DoD-F, más:
    - [x] Encontrada la causa F3 (por qué mostró "Sin ingresos en este período" en X01)
    - [x] Cambio de período que falla no deja el reporte del período anterior
  - **Cierre (2026-11-18, revisada por el autor):**
    - **Causa F3:** el facade sí guardaba el error en `error()`, pero ninguna pantalla lo leía:
      `admin-contabilidad-reportes` y `secretaria-contabilidad-reportes` no lo pasaban y
      `reportes-contables-content` no tenía input de error. Con `kpis = null` e `isLoading = false`
      el panel se dibujaba con listas vacías: "Sin ingresos en este período".
    - **Fallas que había detrás:** `fetchReporte()` se tragaba el error, así que un período o una
      sede que fallaban dejaban el reporte anterior bajo la etiqueta nueva. `queryClassCounts` no
      miraba `error`: con Clase B caída y Profesional bien, todo el gasto de vehículos se cargaba a
      Profesional en Rentabilidad. La serie de Evolución también ocultaba sus fallas.
    - **Cambio:** el facade recuerda qué consulta responden los datos visibles (período y sede; en
      Evolución, ventana y sede). Si falla esa misma es caso B (`refreshFailed`); si falla otra es
      caso A (`error` o `evolucionError`, y se retiran los datos). Registrar un gasto cuya relectura
      falla sigue informando éxito, porque el gasto quedó guardado.
    - **Exportar no se bloquea con `refreshFailed`:** `generate-financial-report` recibe período y
      sede y recalcula en el servidor (con los gastos fijos de `fix-077-i`); no usa lo que hay en
      pantalla.
    - **Verificado:** 32 tests en rojo antes del cambio, mutaciones detectadas, `lint:arch:strict`
      0 errores, `test:ci` y `test-tz.mjs` en verde. El facade no figura en la línea base de
      ARCH-39/ARCH-40.
    - **Navegador, admin (1440×900, claro y oscuro, BD real, lecturas de `payments` cortadas en la
      pestaña):** caso B con datos y aviso dentro de `.bento-fill`; caso A al cambiar de período sin
      KPIs ni datos anteriores; "Reintentar" recupera el período. La prueba encontró que en el caso
      A seguía el aviso de refresco de la serie: corregido, con test. Con red normal, KPIs y las
      cuatro pestañas de noviembre iguales a `main` ($1.470.000 / $155.000 / $1.315.000).
    - **Navegador, secretaria (mismas condiciones, sede Conductores Chillán):** casos A y B correctos
      en claro y oscuro; "Reintentar" recupera octubre ($180.000). Con red normal, KPIs y las tres
      pestañas de noviembre iguales a `main` ($280.000 / $0 / $280.000).
    - **Bucle encontrado en esa prueba y corregido:** `fetchReporte()` leía `_reporte` de forma
      síncrona dentro del `effect` de la pantalla, y cada reporte nuevo disparaba otra carga. Ahora
      lo lee con `untracked`; el test con `effect` exige 2 lecturas de `payments` (daba 16).
    - **Validación tras esa corrección:** 31/31 mutaciones detectadas, `lint:arch:strict` 0 errores,
      5210 tests en verde y 5 omitidos, `test-tz.mjs` 68/68 en las tres zonas, `ngc` sin errores.
    - **Admin repetido tras esa corrección:** 2 lecturas de `payments`, estables; casos A y B
      correctos en claro y oscuro; "Reintentar" recupera octubre ($200.000). KPIs de noviembre sin
      cambios ($1.470.000 / $155.000 / $1.315.000).
    - **X01 en Playwright:** `X01: /app/secretaria/contabilidad/reportes` pasa sin `knownBug`, contra
      el build de producción de este worktree en un puerto libre, como pide T0.4 (5 passed,
      incluidos los 4 inicios de sesión del setup).

- [ ] **T1.3** — `liquidaciones.facade.ts` + liquidaciones de admin y secretaria
  - **AC ref:** AC3, AC4, AC7
  - **DoD:** DoD-F, más:
    - [ ] `hoursRes`, `advancesRes` y `paymentsRes` se revisan (hoy solo `instrRes`)
    - [ ] "Registrar pago" queda bloqueado si las horas o los anticipos no cargaron
  - **Avance (2026-11-18), pendiente de revisión.** La tarea sigue abierta.
    - **Facade.** Instructores, horas, anticipos, pagos y tarifa forman una sola carga: si una falla
      no se aplica nada. La tarifa se lee con `PayrollConfigFacade.readRates()`, que lanza; el valor
      de respaldo queda solo para una sede sin fila. `createRequestGuard` descarta respuestas viejas.
    - **Casos A y B.** Primera carga y cambio de mes o sede retiran filas, selección y KPIs. Re-entrada,
      Realtime y refresco tras guardar conservan los datos y prenden `refreshFailed`.
    - **Pago.** `puedeRegistrarPago` bloquea facade, botones de escritorio y móvil, y confirmación del
      drawer. La fila debe pertenecer a la carga vigente. `deshacerPago` sigue disponible en el caso
      B: no guarda montos calculados. Los errores de escritura ya no se ven como errores de carga.
    - **Hallazgos corregidos.** Con el drawer abierto, cambiar de mes guardaba la fila antigua en el
      período nuevo; el aviso de pago leía el mes después de los `await`; la secretaria con acceso a
      ambas sedes no recargaba al cambiar de sede.
    - **Validación.** `lint:arch:strict` sin errores, `ngc` limpio, `test:ci` 5465 en verde,
      `test-tz` en 3 zonas sobre los 6 specs tocados y 21 mutaciones detectadas y revertidas.
    - **Navegador, secretaria.** Con escrituras bloqueadas en la pestaña y fallas simuladas en
      `rest.fetch`: caso A con cada una de las 5 lecturas, cambio de mes, reintento, caso B con drawer
      abierto y sin él, a 1440x900 en claro; casos A y B en oscuro y en móvil (375x812).
    - **Navegador, admin.** Con las mismas protecciones: caso A con cada una de las 5 lecturas, cambio
      de mes y de sede con falla, reintento, caso B con drawer abierto y sin él, y una respuesta vieja
      con error que llega tarde y se descarta, a 1440x900 en claro; casos A y B en oscuro y en móvil
      (375x812). Ninguna escritura intentada.
    - **Sin probar en navegador.** El cambio de sede de una secretaria con acceso a ambas sedes (solo
      tests de componente) y el bloque X01 de Playwright.

- [x] **T1.4** — `dashboard.facade.ts` + `secretaria-dashboard`
  - **AC ref:** AC3, AC5
  - **DoD:** DoD-F
  - **Cierre (2026-11-18), aprobado tras revisión:**
    - **Alcance.** El dashboard de admin usa `ExecutiveDashboardFacade`, no este facade: no se tocó.
      Sí se migraron los dos drawers que leen de `DashboardFacade` (Agenda de Hoy y Actividad
      Reciente).
    - **Facade.** Las lecturas de actividad y de resolución de alumno lanzan con `assertReadOk`; las
      12 consultas de la carga fallan juntas. Caso A (primera carga, cambio de sede o refresco sin
      datos vigentes): `data` en null, `error` y sin `_initialized`. Caso B: `refreshFailed`, con los
      datos intactos. `reintentar()` elige B o A y `refreshing` bloquea el botón. Un refresco
      reemplazado por una carga con skeleton no avisa ni limpia nada, y un evento llegado durante un
      refresco fallido se atiende. `refreshLiveClassesOnly()` avisa si falla y descarta la respuesta
      si cambió la sede.
    - **`refreshFailed` no bloquea acciones.** Se usa solo para el aviso: ninguna acción guarda un
      valor calculado con estos datos, y `moveSession` valida en la BD el estado de la clase.
    - **Pantallas.** Caso A con `app-empty-state` en una celda de dos filas; caso B con
      `app-alert-card` proyectado en la celda de "Clases Actuales" (`[liveClassesNotice]`). Actividad
      Reciente distingue "no cargó" de "sin actividad"; si falla resolver un alumno solo se pierde
      ese enlace.
    - **Guardrails.** Fuera de `PENDING`. `S('dashboard')` ya no tenía `knownBug` y el facade no
      figuraba en la línea base de ARCH-39/40.
    - **Validación.** TDD: 45 tests en rojo antes del cambio. `lint:arch:strict` 0 errores, `ngc
      --noEmit` limpio, `test:ci` 5289 en verde, `test-tz.mjs` 254 en verde en las tres zonas (6
      specs). Mutaciones: los 5 archivos vueltos a `main` y 21 mutaciones dirigidas hacen fallar
      tests.
    - **Navegador como secretaria (1440x900, claro y oscuro, lecturas cortadas solo en la
      pestaña).** Caso A: sin KPIs, estado de error en la celda de dos filas, "Reintentar" recupera.
      Caso B: KPIs intactos, aviso dentro de la celda `.bento-fill`, sin scroll de página. También
      probados los drawers de Agenda de Hoy y Actividad Reciente, y el aviso parcial de alertas de
      T3.3, que desaparece al volver a entrar. Con red normal: 126 alumnos, 0 clases, $280.000 y 9
      vehículos.
    - **Navegador como admin.** En "Operación de hoy", una falla parcial muestra "Puede faltar
      alguna" en claro y oscuro, sin afectar los KPIs ni el layout, y desaparece al volver a entrar.
    - **Límites de la prueba.** Los KPIs no se compararon contra un `main` corriendo: el diff no
      cambia sus consultas ni sus cálculos. El cambio de sede con error se cubre solo con tests,
      porque secretaria no cambia de sede y admin no usa este facade.

- [ ] **T1.5** — `enrollment-payment.facade.ts` y `anticipos.facade.ts`
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F
  - **Avance (2026-11-18), solo `enrollment-payment.facade.ts`, pendiente de revisión.** La tarea
    sigue abierta: falta `anticipos.facade.ts`, que no se tocó porque choca con la spec 0012-i.
    - **Rehidratación.** Las 3 lecturas lanzan y se aplican juntas, solo si las 3 salieron bien. Si
      una falla, el estado queda vacío y `canConfirmPayment` (y por él `recordPayment`) sigue en
      false hasta que `reintentarDatosPago()` salga bien. También bloquea mientras carga. Un
      `maybeSingle()` sin fila es válido. Guard de orden, y `reset()` invalida lo que esté en curso.
      `enrollment.facade.ts` no cambió: `rehydrateFromEnrollment` no lanza y reanudar sigue.
    - **Cuánto daño hacía (revisado sin ejecutar nada).** El `effect` del wizard llama a
      `computePricing()` al entrar al paso 4 si hay precio de lista, y pisa el precio rehidratado.
      Por eso una falla de `enrollments` no dejaba `pricing` en null: el pago quedaba habilitado, y
      como esa falla cortaba antes de leer pago y descuento, se perdían los dos. Según las
      migraciones (última definición en `20261016180000_fix057i`; no contrastada con producción),
      `record_enrollment_payment` fija `enrollments.discount` con lo recibido y borra
      `discount_applications` y el pago de matrícula antes de insertar. Confirmar sin el descuento
      leído lo eliminaba y registraba el monto mayor. Ahora el `effect` no recalcula con el pago
      bloqueado, y recalcula cuando un reintento lo levanta.
    - **Descuentos.** Error propio, lista retirada al empezar cada carga, guard de orden y
      `reintentarDescuentos()`. **Bloqueo:** sin descuento o con uno manual no bloquea (no dependen
      de la lista). Con uno predefinido aplicado sí, hasta reintentar o quitarlo: sin la lista no se
      puede saber si corresponde al curso y sede actuales. Al reanudar en Pago o después ahora se
      piden; antes la lista quedaba vacía sin haberse pedido.
    - **Errores.** `error()` queda solo para el guardado; `rehydrationError()` y `discountsError()`
      son aparte. Reintentar no borra el error del guardado; abrir otra matrícula o volver a entrar
      desde Documentos sí. Fuera del paso Pago, `rehydrationError()` sale en el banner del wizard.
    - **Alumno a notificar.** Su falla sigue sin afectar el pago ya guardado; el criterio quedó en
      un comentario.
    - **Pantalla.** Sin datos del pago, `app-empty-state` con "Reintentar" en vez de montos. Sin
      lista de descuentos, `app-alert-card` con "Reintentar" (`reintentar-descuentos`).
    - **Guardrails.** Fuera de `PENDING`; no figuraba en la línea base de ARCH-39/40.
    - **Validación.** TDD con 40 tests en rojo antes del cambio. `lint:arch:strict` 0 errores, `ngc
      --noEmit` limpio, `test:ci` 5380 en verde y 5 omitidos, `test-tz.mjs` 209 en verde en las tres
      zonas (4 specs), ya con `fix-253-b` integrado. Mutaciones, corridas antes de integrarlo: 41 de
      42 detectadas; la restante (no revisar `error` de `enrollments`) es equivalente, porque sin
      `data` la lectura igual termina en el `catch`.
    - **Navegador (simulado, 1440x900).** Sesión de secretaria iniciada por el usuario, en una sede
      sin borradores. El paso Pago se montó en memoria con una matrícula ficticia, respuestas
      simuladas y toda escritura bloqueada en la pestaña: 0 escrituras intentadas, consola sin
      errores. Con falla de `enrollments`, `payments` o `discount_applications`: estado de error sin
      montos, "Registrar Pago" deshabilitado y sin desborde; "Reintentar" sigue bloqueado si la falla
      persiste y recupera el total si no. Con `discounts` caído: el predefinido bloquea, quitarlo
      desbloquea, sin descuento y con uno manual se puede continuar, y "Reintentar" limpia el aviso.
      Fuera del paso Pago sale el banner, y desaparece al volver. Los dos estados de error se
      miraron en claro y oscuro. El precio ficticio de la matrícula fue reemplazado por el de lista
      al entrar al paso, lo que confirma en vivo lo revisado en el código.
    - **No probado.** Reanudar un borrador real de punta a punta: `resumeDraft` escribe `expires_at`
      y la sede no tiene borradores; queda cubierto por tests. Ninguna lectura falló contra
      producción de verdad: las fallas son simuladas. "Registrar Pago" no se pulsó. E2E:
      `matricula-paso2.spec.ts` siembra y borra datos con cliente admin contra la BD real, no se
      corrió.
    - **Integrado en esta rama: `fix-253-b`.** Un descuento manual no crea fila en
      `discount_applications`; al rehidratar ahora se recupera desde `enrollments.discount`, con el
      motivo genérico "Descuento Manual" porque la BD no guarda el original. Solo se aplica si las
      tres lecturas salieron bien: una falla de `discount_applications` bloquea y no convierte un
      predefinido en manual. Cubierto por tests; la simulación en navegador fue anterior a este
      cambio y no lo incluye.
    - **Visto y fuera de alcance.** (1) Con dos pagos vivos de matrícula en un borrador (duplicados
      previos a `fix-050-i`), `maybeSingle()` da error: antes se ignoraba y ahora bloquea, y
      reintentar no lo resuelve. No se consultó producción para saber si existen. (2) El `DELETE` de
      la RPC no filtra `status`, así que también borraría un pago anulado del borrador.

- [ ] **T1.6** — Validación de la etapa
  - **DoD:**
    - [ ] `/verify`: casos A y B en claro y oscuro; la página sigue app-like con el aviso visible
    - [ ] X01 de las pantallas de la etapa en verde contra el build de producción
    - [ ] `npm run lint:arch`, `npm run test:ci`, `node scripts/test-tz.mjs` de los specs tocados

---

## Fase 2 — Lecturas que alimentan una escritura o decisión (PR 3 y PR 4)

- [ ] **T2.1** — `enrollment.facade.ts` (PR 3, solo)
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F, más:
    - [ ] Las 22 lecturas clasificadas en `tasks.md` antes de tocarlas: bloquea el paso / aviso
    - [ ] Una lectura que decide un precio, un cupo o un horario detiene el paso con error
    - [ ] Suite E2E de matrícula presencial completa en verde

- [ ] **T2.2** — `enrollment-documents`, `public-enrollment`, `student-enrollment-context`, `admin-pre-inscritos`
  - **AC ref:** AC3
  - **DoD:** DoD-F, más:
    - [ ] Matrícula pública: el error se ve sin sesión iniciada

- [ ] **T2.3** — `admin-alumno-detalle.facade.ts` + ficha del alumno
  - **AC ref:** AC3, AC5, AC7
  - **DoD:** DoD-F, más:
    - [ ] La grilla de "Reprogramar" no dice "Sin disponibilidad" ante un error (pendiente de `fix-189-b`)

- [ ] **T2.4** — `cursos-singulares.facade.ts` y `servicios-especiales.facade.ts`
  - **AC ref:** AC3, AC4
  - **DoD:** DoD-F, más:
    - [ ] Encontrada la causa F3 de Servicios especiales (sus lecturas ya lanzan)

- [ ] **T2.5** — `certificacion-clase-b.facade.ts` + Certificados
  - **AC ref:** AC3
  - **DoD:** DoD-F

- [ ] **T2.6** — Validación de la etapa
  - **DoD:** igual que T1.6

---

## Fase 3 — Gestión Clase B (PR 5)

- [x] **T3.1** — `asistencia-clase-b.facade.ts` + Asistencia
  - **AC ref:** AC3, AC5
  - **DoD:** DoD-F
  - **Avance (2026-11-11):** Migrado `asistencia-clase-b.facade.ts` junto con `asistencia-clase-b-content.component.ts`, `admin-asistencia.component.ts`, `secretaria-asistencia.component.ts` y el selector de vehículos de `admin-iniciar-clase-drawer.component.ts`. Caso A en carga inicial, `setDate`, `reload` y cambio de sede (retira prácticas, alertas y KPIs a `null`, sin mostrar ceros ni marcar `_initialized` en fallo), `fetchAlertas()` y `fetchEnrollmentsWithRemovedSchedule()` lanzando en error, y guard de concurrencia (`dataGuard` + `alertasGuard`) contra respuestas tardías. Caso B en `refreshSilently()` y `refreshAlertasSilently()` conservando datos y exponiendo `refreshFailed()` + `reintentar()` sin skeleton. Lecturas dentro de mutaciones verificando `.error` (`resolvePractica` dentro de `try` en `undoAbsence`/`cancelStart`, `enrollments`, `moveSession`, `countCancelledSince`), aislando `countCancelledSince` en `justifyAbsence` con `toast.warning` sin revertir el guardado. En el drawer de inicio, error explícito + "Reintentar" para `vehicles` (sin marcar `vehiclesLoaded`) y aviso sutil `vehicleDocsUnknown()` cuando falla `vehicle_documents`. Conectado `ciclos.error()` en el tab Ciclos Teóricos sin modificar `CiclosTeoricosFacade`. Sacado `asistencia-clase-b.facade.ts` de `PENDING` en `unchecked-reads.guard.spec.ts` y quitada la marca `knownBug` de `S('asistencia', '0060-b etapa 3a')` en `e2e/transversal-shell.spec.ts`. Verificado con TDD RED previo (17 fallos), `lint:arch` (0 errores), `ngc --noEmit`, `test-tz.mjs` (158/158 en UTC, Asia/Tokyo y America/Santiago), `test:ci -- --maxWorkers=4` (5054 passed / 5 skipped) y Playwright `X01: /app/secretaria/asistencia` (5 passed); pendiente prueba manual en navegador contra BD real para cerrar `[x]`.
    - Ajustes de revisión PR #406 (2026-11-11): (1) en Caso A (`asistencia-clase-b-content`) se mantiene visible la cabecera con título, `<app-date-input>` y botón `Actualizar`, reemplazando solo filtros, tabla y rail de alertas; (2) `refreshAlertasSilently()` al resolver bien ya no limpia `_refreshFailed` ni `_error` (solo `fetchData()` los limpia); (3) agregado `refrescar()` en `AsistenciaClaseBFacade` (Caso B si ya está inicializado en misma sede/fecha, `reload()` si no) conectado a `onRefresh()` en `admin-asistencia` y `secretaria-asistencia`.
  - **Cerrada (2026-11-11):** prueba manual en navegador contra la BD real como secretaria, con
    las lecturas cortadas en la pestaña. Carga real de hoy (sin clases, 64 alertas) y de un día con
    clases (3 clases y sus KPIs). Caso B (refresco y botón "Actualizar"): la tabla se queda con el
    aviso, y "Reintentar" no muestra skeleton ni borra datos; un refresco de alertas que sale bien
    no borra el aviso. Caso A al cambiar de día: se retiran tabla, rail y KPIs sin ceros, quedan el
    selector de fecha y "Actualizar", y elegir otro día con la red de vuelta sale del error. Drawer
    de inicio: vehículos caídos muestran error con "Reintentar"; documentos caídos listan los
    vehículos con el aviso de documentación no revisada. Ciclos teóricos carga normal. Las
    mutaciones dirigidas (alertas que tragan el error, refresco que no marca `refreshFailed`, conteo
    de canceladas que hace fallar la justificación, refresco de alertas que borra el aviso,
    `refrescar()` que recarga con skeleton) hacen fallar los tests.
- [x] **T3.2** — `admin-alumnos.facade.ts` y `ex-alumnos.facade.ts`
  - **AC ref:** AC3
  - **DoD:** DoD-F, más:
    - [x] Los KPIs del hero no dicen 0 cuando la lista muestra error
  - **Avance (2026-11-11):** Migrados `admin-alumnos.facade.ts`, `ex-alumnos.facade.ts` y `convalidation.utils.ts` junto con `alumnos-list-content`, `admin-alumnos`, `secretaria-alumnos`, `ex-alumnos-content`, `admin-ex-alumnos`, `secretaria-ex-alumnos`, `ex-alumnos-profesional-content`, `admin-ex-alumnos-profesional`, `secretaria-ex-alumnos-profesional` y los drawers `tasas` y `comentarios`. Hero KPIs y chips se ocultan en Caso A; Caso B preserva datos y reintenta silenciosamente. `admin-alumnos.facade.ts` fuera de PENDING en `unchecked-reads.guard.spec.ts`. Verde en `test:ci` (4994 passed / 5 skipped), `test-tz.mjs` (UTC, Asia/Tokyo, America/Santiago), `lint:arch`, `ngc --noEmit` y Playwright X01 en `/app/secretaria/alumnos` y `/app/secretaria/ex-alumnos` (drawers y `/ex-alumnos-profesional` sin X01 directo; validados en Vitest).
  - **Cerrada (2026-11-11):** prueba manual en navegador contra la BD real como secretaria
    (alumnos, ex-alumnos, opiniones): carga real, caso B con datos y aviso, "Reintentar" del aviso
    sin pérdida de datos y recuperación. La prueba mostró que en prod la columna es
    `student_surveys.comments`: el cambio a `comment` de la segunda pasada se basó en las
    migraciones (dos crean la tabla con `CREATE TABLE IF NOT EXISTS` y columnas distintas) y dejaba
    las opiniones en error; se volvió a `comments` y el mock del test ahora rechaza `comment`.
- [x] **T3.3** — `dms.facade.ts` y `dashboard-alerts.facade.ts`
  - **AC ref:** AC3, AC5
  - **DoD:** DoD-F, más:
    - [x] Una alerta que no cargó no se muestra como "sin alertas"
  - **Avance (2026-11-11):** Migrados `dashboard-alerts.facade.ts` y `dms.facade.ts` junto con sus pantallas y drawers (`dashboard`, `secretaria-dashboard`, `alerts-drawer`, `admin-documentos`, `secretaria-documentos`, `dms-list-content`, `dms-student-docs-drawer`, `dms-instructor-docs-drawer`, `dms-doc-preview-drawer`, `dms-upload-drawer`). Lecturas con `assertReadOk` / `if (error) throw error`, guards de solicitud concurrente/cambio de sede (`createRequestGuard`) en todos los subflujos, Caso A limpiando datos previos y Caso B en refresco silencioso y post-mutaciones con aviso `app-alert-card` y `reintentar()` sin skeleton ni pérdida de datos. Fuera de `PENDING` en `unchecked-reads.guard.spec.ts`. Sin discrepancias de columnas respecto a las migraciones SQL. Verificado con tests unitarios, `test-tz.mjs`, `test:ci`, `ngc --noEmit`, `lint:arch` y Playwright X01 (`/app/secretaria/dashboard`, `/app/secretaria/documentos`).
  - **Cerrada (2026-11-11):** las alertas conservan la carga parcial de fix-405-m
    (`Promise.allSettled`): si una revisión falla se muestran las demás con el aviso
    `loadProblem()` ("No se pudieron revisar todas las alertas."), y solo falla la carga entera si
    fallan todas. Prueba manual en navegador contra la BD real como secretaria: alertas con una
    revisión cortada, caso B en documentos con datos y aviso, y el drawer de documentos del alumno
    como caso A (retira los datos y muestra el error). La revisión mutante (facade de alertas
    anterior) hace fallar 4 tests.
- [x] **T3.4** — `instructores.facade.ts`, `flota.facade.ts`, `tasks.facade.ts`
  - **AC ref:** AC3
  - **DoD:** DoD-F
  - **Resultado (2026-11-10):** Migrados `instructores.facade.ts`, `flota.facade.ts` y `tasks.facade.ts` junto con sus pantallas (`admin-instructores`, `flota-list-content`, `admin-flota`, `secretaria-observaciones`, `admin-tareas`, `instructor-tareas`). Lecturas con `assertReadOk` o `if (error) throw error`. Manejo de Caso A (empty state con botón Reintentar y sin ceros en KPIs) y Caso B (alert card de datos desactualizados con Reintentar). Fuera de PENDING en `unchecked-reads.guard.spec.ts` y sin knownBug en X01 de `e2e/transversal-shell.spec.ts`. Verde en tests de unidad, test-tz (UTC, Asia/Tokyo, America/Santiago) y E2E X01.
- [x] **T3.5** — Portales: `instructor-alumnos`, `instructor-clases`, `student-clases`, `student-home`
  - **AC ref:** AC3
  - **DoD:** DoD-F
  - **Avance (2026-11-10):** Migrados `instructor-alumnos.facade.ts`, `instructor-clases.facade.ts`, `student-clases.facade.ts` y `student-home.facade.ts` junto con sus pantallas y drawers (`instructor-alumnos`, `instructor-ficha`, `instructor-dashboard`, `instructor-clase`, `instructor-clase-detail`, `instructor-evaluacion`, `alumno-clases`, `alumno-dashboard`, `alumno-pruebas-online`). Fuera de PENDING en `unchecked-reads.guard.spec.ts`. Verde en tests de unidad, componentes y `test-tz.mjs`; sin cuenta E2E de instructor/alumno; prueba manual pendiente.
  - **Cerrada (2026-11-11):** prueba manual en navegador contra la BD real, con los portales
    desbloqueados solo en local (están bloqueados en `pilot-phase.config.ts`) y las lecturas
    cortadas en la pestaña. Instructor (dashboard, Mis Alumnos, ficha, iniciar/clase en curso) y
    alumno con dos matrículas (dashboard, Mis Clases, Pruebas online): caso A sin KPIs en 0, caso B
    con datos y aviso, cambio de matrícula como caso A, y "Reintentar" del aviso sin skeleton ni
    pérdida de datos. La prueba destapó una lectura rota desde abril
    (`v_professional_attendance.semaphore`, columna inexistente) que con `assertReadOk` dejaba en
    error permanente el resumen de todo alumno Profesional; se corrigió leyendo `attendance_flag`.
    X01 no cubre los portales (sin cuentas E2E de esos roles).
- [x] **T3.6** — Validación de la etapa
  - **DoD:** igual que T1.6
  - **Cerrada (2026-11-11):** sobre main con T3.1–T3.5 integradas: `lint:arch` 0 errores,
    `test:ci` 5056 en verde, `test-tz.mjs` con los 44 specs tocados por la etapa en verde en las tres
    zonas, y X01 contra el build de producción (`ng serve --configuration production`) en verde en
    las 8 pantallas de la etapa (dashboard, alumnos, ex-alumnos, documentos, flota, instructores,
    observaciones, asistencia). La revisión visual en escritorio (1440×900, claro y oscuro) encontró
    lo que ningún test veía: en 8 componentes el aviso del caso B era una celda más de la grilla
    `--fill-screen*` y se quedaba con la fila que crece, dejando la lista en 120px (en Observaciones,
    2px). Las pruebas manuales de T3.2 y T3.4 se habían hecho con el panel angosto (tier móvil, donde
    la página scrollea) y no lo mostraron. Corregido en el PR #407 (nota de avance abajo) y medido
    de nuevo con el aviso visible, en claro y oscuro: alumnos 574px, ex-alumnos 530px, flota 576px,
    instructores 627px y observaciones 502px de lista, con el aviso dentro de la celda, sin scroll de
    página y consola limpia. Asistencia y Documentos ya estaban bien. Los portales de instructor y
    alumno ponen el aviso dentro de la celda (revisado en el código; no se pueden abrir sin cuentas
    E2E de esos roles).
  - **Avance (2026-11-11):** Corregido el layout de Caso B en los 8 componentes con grilla `--fill-screen*` (`alumnos-list-content`, `ex-alumnos-content`, `ex-alumnos-profesional-content`, `flota-list-content`, `admin-instructores`, `admin-tareas`, `secretaria-observaciones`, `instructor-tareas`): `app-alert-card` pasa dentro de `.bento-fill` con `p-4 pb-0 shrink-0` (y contenedor `flex flex-col min-h-0` con `class="flex-1 min-h-0 h-auto!"` sobre `<app-task-list-content>` en tareas/observaciones) en lugar de competir por la fila `1fr` del grid. Documentado en `.claude/rules/swr-pattern.md` (§"En la pantalla") y espejado en `.agents/rules/swr-pattern.md`. Verificado con 8 tests nuevos (86/86 en sus specs), `test-tz.mjs` (`UTC`, `Asia/Tokyo`, `America/Santiago`), `lint:arch` (0 errores, `ARCH-30` al día), `ngc --noEmit`, `test:ci -- --maxWorkers=2` (`331 passed | 1 skipped`, `5064 passed | 5 skipped`) y Playwright X01 en `--workers=1` (`9 passed`: `/app/secretaria/{alumnos,ex-alumnos,flota,instructores,observaciones}` + 4 setups de auth).

---

## Fase 4 — Clase Profesional (PR 6)

- [ ] **T4.1** — `asistencia-profesional.facade.ts` (12 lecturas, casi todas F2)
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F
- [ ] **T4.2** — `certificacion-profesional.facade.ts` y `archivo-profesional.facade.ts`
  - **AC ref:** AC3, AC7
  - **DoD:** DoD-F
- [ ] **T4.3** — `admin-alumnos-profesional`, `libro-de-clases`, `promociones`, `relatores`
  - **AC ref:** AC3
  - **DoD:** DoD-F
- [ ] **T4.4** — Validación de la etapa
  - **DoD:** igual que T1.6

---

## Fase 5 — Cierre

- [ ] **T5.1** — `PENDING` vacío y X01 sin `knownBug`
  - **AC ref:** AC8, AC9
  - **DoD:**
    - [ ] Un facade que no se migró tiene su excepción escrita con motivo
    - [ ] Revisados los `catch` vacíos que queden en los facades: cada uno es un refresco en
      segundo plano que deja el aviso, o tiene un comentario que explica por qué no avisa
- [ ] **T5.2** — `/spec-verify` y `acceptance.md` con evidencia por AC
- [ ] **T5.3** — Índices (`FACADES.md`, `SERVICES.md`, `COMPONENTS.md`), `ROADMAP.md` a Done,
  ASG-b-102 completada (`npm run assignments:sync`) y `specs/.active` limpio
- [ ] **T5.4** — Asignaciones aparte para lo que quedó fuera: cierre de caja calculado en el
  servidor, y las 2 lecturas de `core/services/ui/` (impresión)
