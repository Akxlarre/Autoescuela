# Testing — Transversal: multi-sede, shell, tiempo real, responsive, modo oscuro y app-like

> **Asignación:** `ASG-i-037` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** todas las del piloto (`/app/admin/**` y `/app/secretaria/**` sin `pilotPhaseGuard`, ver §3.B)
> **Incluye:** los **inventarios completos** del sistema (edge functions, canales Realtime, RLS por
> tabla, RPC/funciones `SECURITY DEFINER`, buckets de Storage), el shell (`src/app/layout/`),
> selector de sede, buscador global, drawers globales, barrido de rutas × rol × ancho × tema,
> hora de Chile, errores tragados, sesión en 2 pestañas, accesibilidad y rendimiento.
> **No incluye:** la funcionalidad propia de cada módulo (ver `022` … `036`). Cuando un hallazgo
> ya está reportado en otro checklist, acá solo se referencia (`archivo · S#`) para que el
> inventario quede completo sin duplicar el caso.
>
> **Código leído para armar esta lista:**
> `supabase/config.toml`, `supabase/functions/*/index.ts` (las 32),
> `supabase/migrations/*` (última definición de cada policy, cada `SECURITY DEFINER`, cada
> `ALTER PUBLICATION supabase_realtime`, cada `cron.schedule`, `20260513000002_grant_data_api_access.sql`),
> `src/app/layout/{app-shell,topbar,sidebar,layout-drawer}.component.ts`,
> `core/services/ui/{layout-drawer,theme}.service.ts`, `core/services/auth/menu-config.service.ts`,
> `core/facades/{branch,global-search,notifications}.facade.ts`, `core/utils/{branch-scope,date}.utils.ts`,
> los 15 canales `.channel(` de `core/facades/`, `core/config/pilot-phase.config.ts`,
> `indices/{ROUTES,APP-LIKE-ROLLOUT,DOMAIN-GOTCHAS}.md`, `docs/UAT-PLAN.md` (Paquete 7).

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-037`, y **cada bug va a su
  propio fix/hotfix**. Una fuga de datos entre sedes es **P0 inmediato**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`). El más rentable de toda la
  tanda es el **barrido de rutas (§3.B)**: hazlo primero.
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S15)** son **nuevas** (no aparecen en `022`–`036`), salen de leer el código y
  **no están confirmadas** en navegador. Los inventarios (§1.1–§1.8) marcan cada fila como
  **NUEVA**, **ya reportada** (con archivo y S#) u **OK**.
- Las policies se leyeron siguiendo la **última** `CREATE POLICY` de cada tabla en las migraciones.
  Antes de ejecutar la sección P, confírmalo contra la BD real del piloto con
  `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname in ('public','storage') order by 1,2;`
  (solo lectura). Si difiere de lo que dice acá, manda la BD.

### Cómo invocar cosas "a mano" desde la consola (válido para toda la sección P)

El cliente de Supabase no es global. La forma más simple, sin tocar código:
1. Haz en la app una acción que dispare la petición parecida (listar, exportar, guardar).
2. DevTools → Network → clic derecho en la petición → **Copy as fetch**.
3. Pégala en Console, cambia el id / `branch_id` / body y ejecútala. Mira el status y la respuesta.

La cabecera `apikey` (la anon key) es pública: viene en el bundle de la app. Para probar "sin
sesión", quita la cabecera `Authorization` o pon `Authorization: Bearer <anon key>`.

---

## 1. Sospechas nuevas e inventarios

### 1.0 Sospechas nuevas (no reportadas en `022`–`036`)

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Cualquier usuario logueado puede confirmar cualquier borrador de matrícula, de cualquier sede, con el monto que quiera.** La RPC `confirm_enrollment_with_payment` es `SECURITY DEFINER`, no mira `auth.uid()`, rol ni sede, y recibe del navegador `p_total_amount`, `p_discount_amount`, `p_payment_method` y `p_registered_by`. No hay `REVOKE`, y una migración da `EXECUTE` sobre todas las funciones a `authenticated`. Deja la matrícula `active`, genera número y registra el pago, con lo que descuadra la caja. | `supabase/migrations/20260618130000_rpc_confirm_enrollment_with_payment.sql:20-31,43-47,59-61,90-92`; `20260513000002_grant_data_api_access.sql:56,69-70`; llamada en `enrollment.facade.ts:1498` |
| S2 | 🔴 Alta | **La secretaria de la sede A puede modificar, archivar o borrar alumnos de la sede B desde la consola.** En `students` solo el `SELECT` filtra por sede. `INSERT`, `UPDATE` y `DELETE` exigen solo rol admin/secretaria, así que se puede hacer `update students set status='archived'` sobre un alumno de la otra sede. | `20260301000011_10_rls_policies.sql:152-156` vs `20260723030000_fix_students_rls…sql:22` |
| S3 | 🔴 Alta | **`generate-certificate-professional-pdf` funciona sin sesión.** La autenticación es opcional (si no hay `Authorization`, igual sigue). Usa la clave de servicio y, en modo `real`, **sube el PDF, actualiza la matrícula e inserta el certificado** para cualquier `enrollment_id`. Como `verify_jwt` queda en su valor por defecto, basta la anon key pública. El módulo está bloqueado, pero la función sigue desplegada, y el DMS del piloto la llama en modo `preview`/`sample`. | `supabase/functions/generate-certificate-professional-pdf/index.ts:86-89,96-121,181-240`; `core/facades/document-content-templates.facade.ts:23` |
| S4 | 🟠 Media-Alta | **La bitácora de auditoría de todas las sedes, al alcance de cualquier usuario logueado.** `generate-audit-report` solo verifica que haya sesión, usa la clave de servicio y filtra por el `branch_id`/`secretaria_id` del body. La pantalla es solo de admin, pero una secretaria que copie la petición obtiene el Excel/PDF de todas las sedes. *(Revisar solape con `036` cuando exista.)* | `supabase/functions/generate-audit-report/index.ts:141-162,189-196` |
| S5 | 🟠 Media | **Se pueden fabricar entradas de auditoría.** El `INSERT` en `audit_log` solo exige `auth.uid() IS NOT NULL`: cualquier usuario logueado (incluido un alumno o instructor) inserta filas con cualquier `user_id`, `action`, `entity` o `branch_id`. Una bitácora que se puede falsificar no sirve como evidencia. | `20260306120000_audit_log_insert…sql:15`; tabla `20260301000001…sql:141-152` ("Historial inmutable") |
| S6 | 🟠 Media | **Bucket público `website-public`: subida anónima "temporal" sigue activa.** La policy `website_public_seed_insert` es `TO public`: sin sesión se suben imágenes, incluido SVG, de hasta 50 MB bajo `seeds/`, y quedan servidas públicamente. Además, `website_public_update` deja a una secretaria de cualquier sede sobrescribir los logos de la otra, porque no mira la ruta. | `20260522010000_create_website_public_bucket.sql:9-24,53-62,66-80` |
| S7 | 🟠 Media | **La matrícula pública está bloqueada en la UI, pero su API sigue viva.** `public-enrollment` acepta la anon key y responde `reserve-slots` (retiene horarios reales de la agenda), `submit-pre-inscription` (crea pre-inscritos y notifica a secretarias) y `check-duplicate` (dice si un RUT ya tiene matrícula). `student-payment` conserva `reserve-slots` y `release-slots` legacy, que solo piden un JWT con `sub`. | `supabase/functions/public-enrollment/index.ts:424-447,1880-1923`; `student-payment/index.ts:112-165`; `pilot-phase.config.ts:9-14` (solo bloquea rutas) |
| S8 | 🟠 Media | **Otras tablas con RLS solo por rol** (sin sede; no reportadas en ningún módulo): `standalone_courses` y `standalone_course_enrollments` (la secretaria puede **borrar** inscripciones de cursos singulares de la otra sede, lo que afecta la caja), `instructor_advances` (lee y crea anticipos de cualquier sede), `discounts`/`discount_applications`, `certificates`/`certificate_issuance_log`, `instructor_replacements`, `absence_evidence`, `class_b_theory_sessions`, `school_documents` (SELECT), `secretary_observations` (SELECT) y el `UPDATE` de `digital_contracts`. Detalle en §1.3. | `20260301000011_10_rls_policies.sql:254-271,321-327,368-374,563-581,764-771,817-834,881-883,968-988,199`; `20260313130000_fix_digital_co…sql:8` |
| S9 | 🟡 Baja-Media | **El drawer global no se cierra al navegar ni con Escape.** No hay ningún listener de navegación: si abres "Nueva Matrícula" en Alumnos y vas a Agenda por el menú, el drawer sigue abierto sobre otra página. Tampoco responde a Escape, no atrapa el foco, no tiene `role="dialog"`, y el fondo móvil usa un color fijo (`bg-black/50`). | `layout/layout-drawer.component.ts:51-58,134-141,156-217`; `core/services/ui/layout-drawer.service.ts:63-72,123-126`; grep `router.events` en `core/` y `layout/`: solo `breadcrumb.service.ts` |
| S10 | 🟡 Baja | **El modal de confirmación global interpreta HTML de datos del usuario.** El mensaje se pinta con `[innerHTML]` e interpola textos escritos por usuarios (descripción de un egreso, nombre del alumno). Angular quita los scripts, pero `<b>`, `<a href>` o `<img>` sí se renderizan. El modal tampoco se cierra con Escape. | `layout/app-shell.component.ts:77-148` (`:118`); `admin-contabilidad-cuadratura.component.ts:136`; `secretaria-contabilidad-cuadratura.component.ts:92`; `admin-ex-alumnos.component.ts:72` |
| S11 | 🟡 Baja | **La acción rápida "Registrar pago" del dashboard de secretaria deja un canal Realtime abierto para siempre.** Llama `pagosFacade.initialize()`, que abre `pagos-global-realtime`, y nadie llama `destroyRealtime()`. El canal está además muerto (ver §1.2). | `features/secretaria/dashboard/secretaria-dashboard.component.ts:406-408`; `core/facades/pagos.facade.ts:127-160` |
| S12 | 🟡 Baja | **La sede elegida se comparte entre pestañas solo al recargar.** Está en `localStorage` sin listener de `storage`: si cambias de sede en la pestaña 1, la 2 sigue mostrando la anterior y al recargarla toma la nueva. Además, las vistas Profesional cambian la sede sin persistirla, así que al recargar vuelve la anterior. | `core/facades/branch.facade.ts:7,45-48,174-193,211-224` |
| S13 | 🟡 Baja | **Escrituras cuyo error no se revisa, no reportadas antes** (inventario completo en §1.7): pagar una liquidación marca los anticipos del mes como "descontados" sin revisar el resultado (si falla, quedan "pendientes" y se descuentan dos veces el mes siguiente). Lo mismo al revertir. En la matrícula, la extensión de la vigencia del borrador y el guardado de la modalidad de pago tampoco revisan errores. | `liquidaciones.facade.ts:372-377,455-460`; `enrollment.facade.ts:1079-1084,1719-1722` |
| S14 | 🟡 Baja | **Fechas de negocio en UTC, casos no reportados** (inventario completo en §1.8): fecha de término en la lista de Certificación B, fecha de pago de los cursos singulares en Reportes contables, fecha por defecto de un gasto fijo y "códigos SENCE vigentes hoy". De noche (desde ~21:00 hora Chile) caen en el día siguiente. | `certificacion-clase-b.facade.ts:519-521`; `core/utils/reportes-contables.utils.ts:153`; `registrar-gasto-fijo-drawer.component.ts:243`; `enrollment.facade.ts:399` |
| S15 | 🟡 Baja | **El selector de sede de "Ajustes" se salta los bloqueos del topbar.** El del topbar deshabilita "Todas las escuelas" durante la matrícula y las sedes sin Profesional en las vistas Profesional. El de Ajustes llama `selectBranch()` sin mirar `lockReason`/`disabledBranchIds`, así que el admin puede quedar en "Todas" a mitad del wizard (cruza con `023 · S21`) o en una sede sin Profesional. | `shared/components/ajustes-drawer/ajustes-drawer.component.ts:456-505` vs `shared/components/branch-selector/branch-selector.component.ts:81-133`; `branch.facade.ts:87-91,200-224` |

### 1.1 Inventario: edge functions (32)

`verify_jwt=false` solo en 3 funciones (`supabase/config.toml:357-365`). Las demás exigen un JWT
válido **en el gateway, pero la anon key pública también lo es**: si la función no llama a
`auth.getUser()` (o lo hace opcional), en la práctica queda **abierta a cualquiera**.

| Función | `verify_jwt` | Service role | ¿Valida usuario / rol / sede? | Usada por | Estado |
|---|---|---|---|---|---|
| `activate-instructor-account` | def. | Sí | Usuario ✓ · rol ✓ · sede ✗ | Instructores (piloto) | Ya reportada · `034 · S4` |
| `activate-student-account` | def. | Sí | Usuario ✓ · rol ✓ · sede ✗ (cualquier alumno por `userId` + email) | Matrícula, ficha (piloto) | Ya reportada · `023` (caso de sede) |
| `auto-create-next-promotions` | **false** | Sí | Nada | cron | Ya reportada · `025 · S2` |
| `create-instructor` | def. | Sí | Usuario ✓ · rol ✓ · sede del body | Instructores (piloto) | Ya reportada · `034 · S4` |
| `create-secretary` | def. | Sí | Solo admin ✓ | Secretarias (piloto) | OK (`034 · S5`: clave inicial = RUT) |
| `dispatch-scheduled-announcements` | def. | Sí | Solo service role ✓ (`:67-74,99`) | cron | OK |
| `export-certificates-zip` | def. | Sí | Sin sede | Certificación | Ya reportada · `033 · S4` |
| `export-special-services` | def. | Sí | Nada | Servicios especiales | Ya reportada · `031 · S1` |
| `export-students` | def. | Sí | Solo sesión; `branch_id` del body | Base Alumnos | Ya reportada · `024a · S1` |
| `generate-audit-report` | def. | Sí | Solo sesión; `branch_id` del body | Auditoría (admin) | **NUEVA · S4** |
| `generate-cash-closing-report` | def. | Sí | Solo sesión | Caja | Ya reportada · `029 · S5` |
| `generate-cash-history-report` | def. | Sí | Solo sesión | Historial cuadraturas | Ya reportada · `029 · S5` |
| `generate-certificate-b-pdf` | def. | Sí | Sin rol/sede (modo real) | Certificación, DMS | Ya reportada · `033 · S3` |
| `generate-certificate-professional-pdf` | def. | Sí | **Sesión opcional**, escribe en BD y Storage | DMS (preview), Profesional bloqueado | **NUEVA · S3** |
| `generate-class-book-pdf` | **false** | Sí | Nada | Libro de clases | Ya reportada · `025 · S1` |
| `generate-contract-pdf` | **false** | Sí | Nada | Matrícula | Ya reportada · `023 · S1` |
| `generate-enrollment-sheet` | def. | Sí | Sin rol/sede | Base Alumnos | Ya reportada · `024a · S2` |
| `generate-epq-pdf` | def. | No | Sin control, pero **no lee BD** (arma un PDF con lo que manda el body) | Ficha | OK (riesgo nulo) |
| `generate-ficha-tecnica-pdf` | def. | No (JWT del usuario) | La RLS del usuario hace de barrera | Ficha | OK si la RLS de sus tablas filtra (ver §1.3) |
| `generate-financial-report` | def. | Sí | Solo sesión | Reportes contables | Ya reportada · `029 · S5` |
| `generate-payment-report` | def. | Sí | Solo sesión | Pagos | Ya reportada · `028 · S11` |
| `generate-payroll-report` | def. | Sí | Solo sesión | Liquidaciones | Ya reportada · `029 · S5` |
| `generate-route-sheet-pdf` | def. | No (JWT del usuario) | RLS de `vehicles` (solo rol) | Flota | OK (la RLS de `vehicles` ya está en `032 · R03`) |
| `generate-student-license-pdf` | def. | Sí | Nada | Ficha | Ya reportada · `024b · S2` |
| `public-enrollment` | def. | Sí | Público por diseño, con throttle | `/inscripcion` (**bloqueada**) | **NUEVA · S7** (sigue viva) |
| `send-announcement` | def. | Sí | Usuario ✓ · rol ✓ · sede ✓ (`:88-90,133`) | Comunicados | OK (`035 · S20`: no revisa estado) |
| `send-certificate-email` | def. | Sí | Solo sesión | Certificación | Ya reportada · `033 · S26` |
| `send-zoom-email` | def. | Sí | Relay abierto | Ciclos teóricos | Ya reportada · `027 · S13` |
| `student-payment` | def. | Sí | Decodifica el JWT sin `getUser`; acciones legacy sin dueño | Portal alumno (**bloqueado**) | **NUEVA · S7** (legacy vivo) |
| `update-instructor` | def. | Sí | Rol ✓; `userId` del body sin dueño | Instructores | Ya reportada · `034 · S1` |
| `update-secretary` | def. | Sí | Solo admin ✓ | Secretarias | OK (`022 · S2`: no banea en Auth) |
| `update-student-profile` | def. | Sí | Rol ✓; cualquier usuario | Ficha | Ya reportada · `024b · S1` |

**Totales:** 32 funciones · 3 con `verify_jwt=false` · 19 ya reportadas · 3 nuevas (S3, S4, S7 ×2
funciones) · 7 OK. **Ninguna** valida la sede del llamador contra la del recurso, salvo
`send-announcement`.

### 1.2 Inventario: canales Realtime (15)

Tablas en la publicación `supabase_realtime` según las migraciones: `class_b_sessions`, `tasks`,
`users`, `notifications`, `students`, `payments`, `instructor_monthly_payments`,
`instructor_advances` y `branch_payroll_config` (**9**). Regla (fix-227-m): **si un canal escucha una
tabla no publicada, se muere entero**, aunque el cliente diga `SUBSCRIBED`.

| Canal (facade:línea) | Tablas | ¿Todas publicadas? | Dispose | Pantalla | Estado |
|---|---|---|---|---|---|
| `alumno-detalle-{id}` (`admin-alumno-detalle.facade.ts:244`) | `absence_evidence`, `class_b_sessions`, `class_b_practice_attendance`, 3 × `professional_*`, `payments`, `enrollments` | ✗ (6 no) | ✓ `:1648` | Ficha | Muerto · ya reportado `024b · S3` |
| `alumnos-profesional-realtime` (`admin-alumnos-profesional.facade.ts:83`) | `enrollments` | ✗ | ✓ | Base Alumnos Prof. | Muerto · ya reportado `025 · S13` |
| `alumnos-listado-realtime` (`admin-alumnos.facade.ts:122`) | `students`, `enrollments` | ✗ | ✓ | Base Alumnos B | Muerto · ya reportado `024a · S5` |
| `agenda-sessions` (`agenda.facade.ts:358`) | `class_b_sessions` | ✓ | ✓ | Agenda | OK (`026 · S17`: sin debounce) |
| `user-self` (`auth.facade.ts:163`) | `users` | ✓ | ✓ logout | Shell (grant en caliente) | OK |
| `cuadratura-hoy-realtime` (`cuadratura.facade.ts:254`) | `payments`, `expenses`, `instructor_advances`, `cash_closings`, `standalone_course_enrollments`, `special_service_sales` | ✗ (4 no) | ✓ | Caja diaria | Muerto · ya reportado `029 · S8` |
| `dashboard-realtime` (`dashboard.facade.ts:35`) | `students`, `class_b_sessions`, `payments` | ✓ | ✗ | Dashboard secretaria | Vivo, **nunca se cierra** · ya reportado `030 · S12` |
| `schedule-instructor-{id}` (`enrollment.facade.ts:1993`) | `class_b_sessions` (filtro instructor) | ✓ | ✓ `:2041-2051` | Wizard matrícula | OK |
| `flota-realtime` (`flota.facade.ts:78`) | `vehicles`, `vehicle_documents`, `vehicle_assignments` | ✗ | ✓ | Flota | Muerto · ya reportado `032 · S7` |
| `instructor-classes-today` (`instructor-clases.facade.ts:99`) | `class_b_sessions` | ✓ | ✓ | Portal instructor (**bloqueado**) | Fuera del piloto |
| `liquidaciones-realtime` (`liquidaciones.facade.ts:125`) | `instructor_monthly_payments`, `instructor_advances`, `branch_payroll_config` | ✓ | ✓ | Liquidaciones | OK |
| `user-notifications` (`notifications.facade.ts:396`) | `notifications` | ✓ | ✓ shell | Campana | OK |
| `pagos-global-realtime` (`pagos.facade.ts:130`) | `payments`, `enrollments` | ✗ | ✓ en Pagos / ✗ desde el dashboard | Pagos, acción rápida del dashboard | Muerto · ya reportado `028 · S10`; fuga de canal **NUEVA · S11** |
| `tasks-sent-{id}` / `tasks-received-{id}` (`tasks.facade.ts:436,445`) | `tasks` | ✓ | ✓ | Comunicación / Observaciones | OK (`035 · S14`: respuestas sin tiempo real) |

**Totales:** 15 canales (14 en el piloto) · **6 muertos** por tablas no publicadas (todos ya
reportados) · 2 que nunca se cierran (1 nuevo) · 7 OK. Postgres Changes respeta la RLS del que
escucha: donde la RLS es solo por rol (`payments`, `class_b_sessions`), **una secretaria recibe
en el WebSocket filas de la otra sede** (caso P14).

### 1.3 Inventario: RLS de las tablas con datos por sede

Helpers: `branch_visible(x)` = `x IS NULL OR grant multi-sede OR x = sede del usuario`
(`20260301000011:61-66`). **Ojo:** una fila con `branch_id` NULL la ve cualquier secretaria.
🔴 = la única barrera entre sedes es el filtro del navegador.

| Tabla | SELECT | INSERT | UPDATE | DELETE | ¿Facade filtra? | Estado |
|---|---|---|---|---|---|---|
| `enrollments` | sede ✓ | sede ✓ | sede ✓ | sede ✓ | ✓ | OK (`fix_h027`) |
| `students` | sede ✓ | 🔴 rol | 🔴 rol | 🔴 rol | ✓ | **NUEVA · S2** |
| `users` | 🔴 rol (todos) | sede ✓ (solo alumnos) | sede, sin límite de columnas | admin | ✓ | Ya reportada · `034 · S2` y `R11` (lectura = decisión fix-002) |
| `class_b_sessions` | 🔴 rol | 🔴 rol | 🔴 rol | 🔴 rol | ✓ (Asistencia: solo navegador) | Ya reportada · `026 · S12`, `027 · S12` |
| `class_b_practice_attendance` / `class_b_theory_attendance` | 🔴 rol | 🔴 rol | 🔴 rol | 🔴 rol | — | Ya reportada · `027 · S12` |
| `class_b_theory_sessions` | 🔴 rol | 🔴 rol | 🔴 rol | 🔴 rol | — | **NUEVA · S8** |
| `class_b_theory_cycles` | sede ✓ | sede ✓ | sede ✓ | admin | — | OK |
| `absence_evidence` | 🔴 rol | 🔴 rol | 🔴 rol | 🔴 rol | — | **NUEVA · S8** |
| `payments` | 🔴 rol | 🔴 rol | 🔴 rol | admin | ✓ | Ya reportada · `028 · S5` |
| `discounts` / `discount_applications` | 🔴 rol | admin / 🔴 rol | admin | admin | — | **NUEVA · S8** |
| `cash_closings` | sede ✓ (+2 días) | sede ✓ | sede ✓ (draft) | admin | ✓ | OK (`029 · S4`, `S13`) |
| `expenses` | sede ✓ | sede ✓ | sede ✓ | sede ✓ | ✓ | OK |
| `instructor_advances` | 🔴 rol | 🔴 rol | admin | admin | ✓ | **NUEVA · S8** (`029 · S2` cubre solo el DELETE) |
| `instructor_monthly_payments` / `_hours` | admin | admin | admin | admin | ✓ | OK (`029 · S11`: la secretaria ve vacío) |
| `cuadratura_adjustments` / `fixed_expenses` | admin | admin | admin | admin | — | OK |
| `special_service_sales` / `service_catalog` | 🔴 rol / global | 🔴 rol | 🔴 rol | 🔴 rol | ✓ | Ya reportada · `031 · S5`, `S15` |
| `standalone_courses` / `standalone_course_enrollments` | 🔴 rol | 🔴 rol | 🔴 rol | 🔴 rol | ✓ | **NUEVA · S8** |
| `student_documents` | sede ✓ | 🔴 rol | sede ✓ | sede ✓ | ✓ | NUEVA menor (INSERT; va en S8) |
| `school_documents` | 🔴 rol | 🔴 rol | admin | admin | ✓ | **NUEVA · S8** (`033 · S5` es otro problema) |
| `digital_contracts` | sede ✓ | 🔴 rol | 🔴 rol (`20260313130000:8`) | sede ✓ | ✓ | **NUEVA · S8** (la secretaria A puede modificar el contrato de una matrícula de B) |
| `certificates` / `certificate_issuance_log` | 🔴 rol | 🔴 rol / admin | admin | admin | ✓ | **NUEVA · S8** (`033 · S26` cubre las funciones) |
| `instructors` / `instructor_documents` | sede ✓ (o "ambas") | admin / sede ✓ | admin / sede ✓ | admin | ✓ | OK |
| `instructor_replacements` | 🔴 rol | 🔴 rol | admin | admin | — | **NUEVA · S8** |
| `vehicles` / `vehicle_documents` / `vehicle_assignments` / `maintenance_records` | 🔴 rol | sede ✓ / admin | sede ✓ / admin | admin | ✓ | Ya reportada · `032 · R03` (decisión) |
| `professional_promotions`, `promotion_courses`, `class_book` | 🔴 rol | 🔴 rol | 🔴 rol | admin | ✓ | Ya reportada · `025 · S6` |
| `announcements` / `announcement_recipients` | sede ✓ | sede ✓ | sede ✓ | — | ✓ | OK |
| `tasks` / `task_replies` | propio / sede ✓ | ✓ | ✓ | admin | ✓ | OK (`035 · S8`, `S13`) |
| `notifications` | propio ✓ | 🔴 rol (a cualquiera) | propio ✓ | admin | ✓ | Ya reportada · `035 · S21` |
| `secretary_observations` | 🔴 rol | propio ✓ | admin | admin | — | **NUEVA · S8** (revisar solape con `035`) |
| `consents` | 🔴 rol (+ propio) | cualquier sesión | admin (+ propio promo) | — | — | NUEVA menor (INSERT abierto; documentar) |
| `audit_log` | admin (+ propio) | **cualquier sesión** | — | — | ✓ | **NUEVA · S5** |
| `website_config` | pública (`true`) | sede ✓ | sede ✓ | sede ✓ | — | OK (pública por diseño, landing) |
| `branch_payroll_config` | rol (incl. instructor) | admin | admin | — | — | OK |

**Totales:** 33 grupos de tablas revisados · **13 NUEVOS** (S2, S5, S8 y 2 menores) · 9 ya
reportados · 11 OK.

### 1.4 Inventario: RPC y funciones `SECURITY DEFINER` invocables

`20260513000002_grant_data_api_access.sql:56,69-70` da `EXECUTE` sobre **todas** las funciones de
`public`, presentes y futuras, a `authenticated`. Solo `get_student_payment_status` y las 7
`exec_dashboard_*` tienen `REVOKE … FROM PUBLIC`. Las funciones `RETURNS TRIGGER` no se pueden
invocar por `/rpc` y no se listan.

| Función | Llamada desde | ¿Valida uid / rol / sede? | Revocada | Efecto si la llama cualquiera | Estado |
|---|---|---|---|---|---|
| `confirm_enrollment_with_payment` | `enrollment.facade.ts:1498` | ✗ / ✗ / ✗ | ✗ | Activa cualquier borrador con monto arbitrario | **NUEVA · S1** |
| `apply_class_b_absence_penalty` | `asistencia-clase-b.facade.ts:499` | ✗ / ✗ / ✗ | ✗ | Cancela clases de cualquier matrícula | Ya reportada (premisa) · `027 · S2`, `S7` |
| `mark_end_of_day_class_b_absences` | cron `0 1 * * *` UTC | ✗ | ✗ | Cierre nocturno a cualquier hora | Ya reportada · `027 · S2` |
| `get_next_enrollment_number` | `enrollment.facade.ts:2310`, `admin-pre-inscritos.facade.ts:540` | ✗ | ✗ (GRANT explícito) | Consume números de matrícula (quedan huecos) | NUEVA menor |
| `reserve_next_promotion_slot(p_branch_id)` | `auto-create-next-promotions` | ✗ | ✗ | Crea promociones planificadas en cualquier sede | Ya reportada · `025 · S2` |
| `soft_delete_task` | `tasks.facade.ts:324` | uid ✓ | GRANT | Valida dueño | OK |
| `user_complete_first_login` | `auth.facade.ts:266` | uid ✓ | — | Solo la propia fila | OK |
| `get_task_recipients` | tareas | uid ✓ | GRANT | — | OK |
| `exec_dashboard_*` (5 + 2 helpers) | `executive-dashboard.facade.ts:178-198` | `SECURITY INVOKER` + `assert_admin` ✓ | ✓ | — | OK |
| `auto_transition_promotion_status` / `_standalone_course_status` / `_theory_cycle_status` | cron 06:00 UTC | ✗ | ✗ | Idempotentes por fecha; adelantan transiciones | NUEVA menor (revocar) |
| `cleanup_expired_drafts` / `cleanup_expired_public_enrollment` / `cleanup_public_enrollment_throttle` | cron | ✗ | ✗ | Borran borradores vencidos antes de hora (idempotente) | NUEVA menor (revocar) |
| `notify_vehicle_document_expiry` | cron 06:00 UTC | ✗ | ✗ | Cualquiera repite las notificaciones a todos los admins | NUEVA menor (revocar) |
| `recalc_instructor_monthly_hours` | trigger/manual | ✗ | ✗ | Recalcula horas (idempotente) | NUEVA menor (revocar) |
| `ensure_theory_cycle` | trigger/cron | ✗ | ✗ | Crea ciclos teóricos | NUEVA menor (revocar) |
| `auth_*`, `branch_visible`, `instructor_enrollment_ids`, `auth_can_enroll_course_type`, `request_client_ip` | RLS | uid ✓ | — | Solo devuelven datos del propio usuario | OK |

**pg_cron (9 jobs):** `cleanup-expired-enrollment-drafts` (03:00 UTC), `auto-transition-promotion-status`,
`auto-transition-standalone-course-status`, `auto-transition-theory-cycle-status`,
`notify-vehicle-document-expiry` y `auto-create-next-promotions` (06:00 UTC = 03:00 Chile),
`cleanup-expired-public-enrollment` (cada 30 min), `mark-end-of-day-class-b-absences` (01:00 UTC =
22:00 Chile en horario de verano) y `dispatch-scheduled-announcements` (cada 15 min). Todas las
funciones que llaman son invocables por cualquier usuario logueado (arriba).

**Totales:** 16 filas (22 funciones) · 1 NUEVA grave (S1) · 7 nuevas menores (falta de `REVOKE`) ·
3 ya reportadas · 5 OK.

### 1.5 Inventario: buckets de Storage

| Bucket | Público | Lectura | Escritura | Borrado | Estado |
|---|---|---|---|---|---|
| `documents` (privado desde `20260413000001`) | No | Admin/secretaria: **todo el bucket**; instructor: sus `sessions/`; alumno: su certificado | Admin/secretaria: **cualquier ruta**; instructor: `sessions/` propias; **anon: `public-uploads/carnet/*`** | Solo admin | Ya reportada · `033 · S1`, `S2`. Subida anónima del carnet viva con `/inscripcion` bloqueada → nota en S7 |
| `website-public` | Sí | Cualquiera | Admin/secretaria (cualquier sede); **anon en `seeds/`** | Admin | **NUEVA · S6** |
| `assets` (logo en los PDF: `…/object/public/assets/chillan_capacita.png`) | Sí | Cualquiera | **No está en ninguna migración** (creado a mano) | — | Documentar: no es reproducible con `db reset` |

### 1.6 Inventario: shell y navegación (hallazgos de código)

| Punto | Observación | Estado |
|---|---|---|
| Menú por rol | `menu-config.service.ts` filtra Instructor/Alumno completo y el recorte Profesional con `isBlockedInPilot` | OK (verificar en C) |
| Rutas fuera del menú | `/admin/usuarios` y `/*/notificaciones` son maquetas | Ya reportada · `034 · S17`, `035 · S16` |
| Selector de sede | Visible para el admin y la secretaria con grant (`topbar.component.ts:291-298`), persistido en `localStorage` y limpiado al cerrar sesión (`auth.facade.ts:244-249`) | OK; entre pestañas → S12; en Ajustes → **S15** |
| Buscador global | Busca **en memoria** sobre lo que ya cargó `AdminAlumnosFacade` (solo Clase B, activos o Papelera según la vista) y `InstructoresFacade` (`global-search.facade.ts:130-146,149-177`) | Ver casos E03–E06 |
| Buscador de la secretaria | Rutas de admin | Ya reportada · `032 · S17` |
| Drawer global | Sin cierre al navegar, sin Escape, sin foco | **NUEVA · S9** |
| Modal de confirmación | `[innerHTML]`, sin Escape | **NUEVA · S10** |
| Tema | Solo claro/oscuro; el modo "sistema" legacy se migra a uno fijo (`theme.service.ts:55-58,70-80`). No hay opción "sistema" | Ver V03 |

### 1.7 Inventario: escrituras cuyo `{ error }` no se revisa

Grep de `insert`/`update`/`delete`/`upsert`/`rpc` sin `error` destructurado (excluye los portales bloqueados).

| Archivo:línea | Qué escribe | Estado |
|---|---|---|
| `cuadratura.facade.ts:514,527,543,552,568` | Revertir ingresos/egresos desde la caja | Ya reportada · `029 · S1`, `S2`, `031 · S9` |
| `cuadratura.facade.ts:738,777` | Guardar/cerrar arqueo | Ya reportada · `029 · S3` |
| `asistencia-clase-b.facade.ts:160,176,212,450,457,499` | Ausente, justificar, KM del vehículo, penalización | Ya reportada · `027 · S6`, `032 · S2` |
| `enrollment-payment.facade.ts:233,238` | Borrar descuento/pago previo al reintentar | Ya reportada · `028 · S13` |
| `enrollment.facade.ts:774,1056,1898-1963` | Limpieza de borrador (borra sesiones, pagos, documentos, alumno y usuario) | NUEVA menor: si falla a medias, quedan huérfanos sin aviso (cruza con `023 · S8`) |
| `enrollment.facade.ts:1079,1719` | Modalidad de pago; extender vigencia del borrador | **NUEVA · S13** |
| `enrollment.facade.ts:1446` | Confirmar sesiones reservadas | Ya reportada · `023 · S2` |
| `liquidaciones.facade.ts:372,455` | Anticipos → `discounted` / `pending` | **NUEVA · S13** |
| `announcements.facade.ts:520` | Cerrar comunicado (contadores) | Ya reportada · `035 · S2`/`S3` |
| `tasks.facade.ts:281,311` | Marcar leída/completada | Ya reportada · `035 · S11`, `S22` |
| `notification-templates.facade.ts:120-121` | Plantillas de notificación | NUEVA menor |
| `promociones.facade.ts:417,422,475` | Editar promoción (sesiones, cursos) | Ya reportada · `025 · S7`, `S20` |
| `admin-pre-inscritos.facade.ts:244-690` (9) | Pre-inscritos (**bloqueado**, pero se abre desde Base Prof.) | Ya reportada · `022 · S4` (acceso); errores sin reportar |

Lecturas con `const { data } = await …` sin `error` (un fallo se ve como lista vacía): el patrón
ya está reportado módulo por módulo (`024a · S8`, `026 · S11`, `028 · S6`, `030 · S15`, `031 · S6`,
`033 · S16`, `034 · S19`). Transversal: caso X01.

### 1.8 Inventario: fechas de negocio calculadas en UTC

Grep de `toISOString().slice/split` y `*.slice(0,10)` sobre timestamps en `src/app`. Las que parten
de `new Date('YYYY-MM-DDT12:00:00')` o de una fecha local a medianoche (datepicker) **son seguras**
y no se listan (`schedule-grid:368`, `reprogramar-clase-drawer:409`, `libro-de-clases.facade:770`,
`promotion-end-date.utils:16`, `admin-instructor-*-drawer:565/689`, `admin-promocion-crear-drawer:41`).
La utilidad correcta ya existe: `core/utils/date.utils.ts` (`todayIso()`, `getChileDateTimeRange()`) — DG-071.

| Archivo:línea | Fecha de negocio afectada | Estado |
|---|---|---|
| `enrollment-payment.facade.ts:175,254` | Fecha del pago de la matrícula / vigencia del descuento | Ya reportada · `023 · S9`, `028 · S4` |
| `admin-alumnos.facade.ts:472` | Fecha de ingreso (lista) | Ya reportada · `024a · S9` |
| `admin-alumno-detalle.facade.ts:523` | Fecha de ingreso (ficha) | Ya reportada · `024b · S17` |
| `ex-alumnos.facade.ts:198` | Fecha de egreso | Ya reportada · `024b · S6` |
| `dashboard-alerts.facade.ts:214,235` | Vencimiento de documentos (alertas) | Ya reportada · `030 · S18`, `032 · S10` |
| `flota.facade.ts:319`, `maintenance-form-drawer.component.ts:242,268` | Agenda del vehículo; fecha de mantención | Ya reportada · `032 · S10` |
| `descuentos-drawer.component.ts:370` | Vigencia del descuento | Ya reportada · `028 · S17` |
| `registrar-anticipo-drawer.component.ts:160`, `registrar-egreso-drawer.component.ts:596` | Fecha del anticipo / egreso (caja) | Ya reportada · `029 · S7` |
| `registrar-venta-drawer.component.ts:249`, `servicios-especiales.facade.ts:124` | Fecha de venta; "mes actual" de los KPIs | Ya reportada · `031 · S3` |
| `certificacion-clase-b.facade.ts:520` | "Fecha de término" en la lista de Certificación B | **NUEVA · S14** |
| `reportes-contables.utils.ts:153` | Fecha de pago de un curso singular en Reportes (mes del reporte) | **NUEVA · S14** |
| `registrar-gasto-fijo-drawer.component.ts:243` | Fecha por defecto de un gasto fijo | **NUEVA · S14** |
| `enrollment.facade.ts:399` | "Hoy" para listar códigos SENCE vigentes | **NUEVA · S14** |
| `servicios-especiales.facade.ts:516`, `admin-alumnos.facade.ts:247,283`, `auditoria.facade.ts:272`, `certificacion-clase-b.facade.ts:383` | Solo el nombre del archivo descargado | NUEVA cosmética |
| `admin-pre-inscritos.facade.ts:296`, `asistencia-profesional.facade.ts:787`, `certificacion-profesional.facade.ts:386`, `relatores.facade.ts:173`, `admin-sesion-drawer:441`, `week-matrix:209` | Módulos Profesional **bloqueados** | Fuera del piloto (anotar) |
| `dashboard.facade.ts` (día de "Clases Hoy") | KPI del día | Ya reportada · `030 · S4` |
| `asistencia-clase-b.facade.ts:22-24,594` | Día consultado en Asistencia | Ya reportada · `027 · S11` |

**Del lado de la BD:** `CURRENT_DATE` y `NOW()::date` se evalúan en UTC. Ejemplo: la policy de
`cash_closings` para la secretaria (`date >= CURRENT_DATE - 2 days`, `20260301000011:745`). El
cierre nocturno sí usa `America/Santiago`. Caso transversal: T01.

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (idealmente con el seed de spec `0008-i` + ajustes). Anota acá el
nombre/id real usado para cada uno. **Todo lo de la sección P se hace en un ambiente de prueba,
nunca contra datos reales del piloto:** varias pruebas escriben (archivar, confirmar borradores).

| Dato | Cómo debe estar | Para qué | Id usado |
|---|---|---|---|
| D1 | 2 sedes (A y B) con datos en **todos** los módulos: alumnos, matrículas, clases, pagos, caja del día, egresos, anticipos, ventas de servicios, cursos singulares, vehículos, documentos, certificados, tareas | Barrido multi-sede, "Todas" = A + B | |
| D2 | Un alumno de B con `students.id`, `users.id`, `enrollment_id`, un pago, un documento en Storage (ruta conocida) y un contrato | Pruebas por consola de la sección P | |
| D3 | Un **borrador** de matrícula (`status='draft'`) en la sede B, con clases `reserved` | S1 (P09) | |
| D4 | Una inscripción de curso singular y un anticipo de instructor en la sede B | S8 (P07) | |
| D5 | Un certificado profesional **no** generado (matrícula profesional cualquiera) | S3 (P11) | |
| D6 | Un volumen alto en una sede: > 300 alumnos, > 1.000 clases, > 500 pagos, > 200 documentos | Rendimiento (Z) y tope de 1.000 filas | |
| D7 | Nombres con tildes, ñ, `<b>`, comillas y 60+ caracteres (alumno y descripción de egreso) | S10, diseño | |
| D8 | Operaciones hechas entre 21:00 y 23:59 hora Chile (pago, egreso, venta, clase, matrícula, curso singular) | Hora de Chile (T) | |
| D9 | La anon key del proyecto (DevTools → Network → cualquier petición → cabecera `apikey`) | Pruebas "sin sesión" | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`); secretaria sin sede asignada; un instructor y un alumno de
prueba (portales bloqueados: sirven para probar que igual son rechazados por la API). Dos
navegadores o perfiles distintos para tiempo real (2 pestañas del mismo navegador **comparten
sesión**).

---

## 3. Casos

### A. Shell: sidebar, topbar, menú de usuario, Ajustes, cierre de sesión

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app` | Redirige a `/app/admin/dashboard`; sidebar, topbar y contenido sin errores de consola | ✓ | |
| A02 | Secretaria entra a `/app` | Redirige a `/app/secretaria/dashboard` | ✓ | |
| A03 | Ítem activo del sidebar en cada ruta | Solo el ítem de la ruta actual queda resaltado (`exact: true`). En la ficha `/alumnos/:id` y en `/flota/:id/mantenimientos`, ¿se resalta el padre? — anotar | ✓ | |
| A04 | Sidebar en móvil (375 px) | Botón de menú lo abre como drawer con fondo oscuro; clic afuera lo cierra; elegir un ítem lo cierra | ✓ | |
| A05 | Sidebar al abrir un drawer en pantallas ≤ 1280 px | Se colapsa solo para darle espacio al drawer (`app-shell.component.ts:294-299`) | — | |
| A06 | Logo y nombre de la sede en el sidebar | Muestra la sede correcta (secretaria: la suya; admin: la elegida o genérico en "Todas") | — | |
| A07 | Menú de usuario (avatar) | Abre con nombre, rol, tema y "Cerrar sesión"; se cierra al hacer clic afuera y al abrir la campana | ✓ | |
| A08 | Ajustes → Perfil | Datos propios; cambiar la contraseña con validación de coincidencia | — | |
| A09 | Ajustes → Configuración como secretaria | No ve los gestores de solo admin (horarios, precios, tarifas, plantillas, temas B, descuentos) | ✓ | |
| A10 | Ajustes → selector de sede durante la matrícula **(§4)** | "Todas las escuelas" deshabilitado igual que en el topbar (S15) | — | |
| A11 | Cerrar sesión desde el menú de usuario | Vuelve a `/login`; "Atrás" del navegador no muestra datos; la sede elegida se borra | ✓ | |
| A12 | Cerrar sesión con un drawer abierto | El drawer desaparece; al entrar con otra cuenta no reaparece | — | |
| A13 | Breadcrumb / título de la página en cada ruta | Coincide con la ruta | — | |
| A14 | `/app/admin` y `/app/secretaria` sin sub-ruta | Ya reportado `022 · S18` (404) — solo confirmar | — | |

### B. Barrido de rutas del piloto — **test Playwright prioritario** **(§4)**

**Checks por celda** (se aplican a cada ruta × rol × ancho × tema):
**C1** consola sin errores (se tolera el warning conocido `NG0955`, anotarlo) ·
**C2** red sin 4xx/5xx inesperados · **C3** sin scroll horizontal (`document.documentElement.scrollWidth
<= innerWidth` y lo mismo en `.shell-content`) · **C4** app-like en 1440 px: el documento no
scrollea y el overflow queda dentro de los paneles (medir en `.shell-content`, no en `main`: ver
`APP-LIKE-ROLLOUT.md` §"Cómo medir overflow") · **C5** legible en claro y oscuro (sin texto
invisible, badges y datepickers incluidos) · **C6** en 375 px scroll nativo y sin contenido cortado.

Matriz: 2 roles × 3 anchos (375, 768, 1440) × 2 temas = **12 pasadas por ruta**. Anota en **Res.**
las celdas que fallen (p. ej. `sec/375/osc: C3`).

| ID | Ruta (admin) | Ruta (secretaria) | App-like esperado en desktop | Auto | Res. |
|---|---|---|---|---|---|
| B01 | `/app/admin/dashboard` | `/app/secretaria/dashboard` | `--fill-screen-2` | ✓ | |
| B02 | `/app/admin/alumnos` | `/app/secretaria/alumnos` | `--fill-screen` | ✓ | |
| B03 | `/app/admin/alumnos/:id` | `/app/secretaria/alumnos/:id` | Sí (spec 0006-i) | ✓ | |
| B04 | `/app/admin/ex-alumnos` | `/app/secretaria/ex-alumnos` | `--fill-screen` | ✓ | |
| B05 | `/app/admin/clase-profesional/alumnos` | `/app/secretaria/profesional/alumnos` (sede con Profesional) | `--fill-screen` | ✓ | |
| B06 | `/app/admin/clase-profesional/promociones` | `/app/secretaria/profesional/promociones` | `--fill-screen` | ✓ | |
| B07 | `/app/admin/libro-de-clases` | `/app/secretaria/libro-de-clases` | `--fill-screen-4` | ✓ | |
| B08 | `/app/admin/agenda` | `/app/secretaria/agenda` | `--fill-screen` | ✓ | |
| B09 | `/app/admin/asistencia` (2 tabs) | `/app/secretaria/asistencia` | `--fill-screen-kpi` | ✓ | |
| B10 | `/app/admin/matricula` | `/app/secretaria/matricula` | **Patrón custom** (wizard; excepción documentada) | ✓ | |
| B11 | `/app/admin/pagos` | `/app/secretaria/pagos` | Sí (fix-132-m) | ✓ | |
| B12 | `/app/admin/contabilidad/cuadratura` | `/app/secretaria/contabilidad/cuadratura` | `--fill-screen --rows-fit` | ✓ | |
| B13 | `/app/admin/contabilidad/historial-cuadraturas` | `/app/secretaria/contabilidad/historial-cuadraturas` | Sí | ✓ | |
| B14 | `/app/admin/contabilidad/reportes` | `/app/secretaria/contabilidad/reportes` | `--fill-screen-4 --rows-fit` | ✓ | |
| B15 | `/app/admin/contabilidad/liquidaciones` | `/app/secretaria/contabilidad/liquidaciones` | Sí | ✓ | |
| B16 | `/app/admin/contabilidad/cursos` | `/app/secretaria/contabilidad/cursos` | Sí | ✓ | |
| B17 | `/app/admin/contabilidad/anticipos` | — (solo admin) | Sí | ✓ | |
| B18 | `/app/admin/servicios-especiales` | `/app/secretaria/servicios-especiales` | Sí | ✓ | |
| B19 | `/app/admin/certificacion` | `/app/secretaria/certificados` | `--fill-screen` | ✓ | |
| B20 | `/app/admin/documentos` (4 tabs) | `/app/secretaria/documentos` | Sí | ✓ | |
| B21 | `/app/admin/flota` | — | Sí | ✓ | |
| B22 | `/app/admin/flota/:id/mantenimientos` | — | Sí | ✓ | |
| B23 | `/app/admin/instructores` | `/app/secretaria/instructores` | Sí | ✓ | |
| B24 | `/app/admin/secretarias` | — | Sí | ✓ | |
| B25 | `/app/admin/tareas` | `/app/secretaria/observaciones` | `--fill-screen` | ✓ | |
| B26 | `/app/admin/auditoria` | — | Sí | ✓ | |
| B27 | `/app/admin/configuracion-web` | `/app/secretaria/configuracion-web` | Sí | ✓ | |
| B28 | `/app/admin/usuarios` | — | **Maqueta** (pendiente de construir; no evaluar C4) | ✓ | |
| B29 | `/app/admin/notificaciones` | `/app/secretaria/notificaciones` | **Maqueta** (no evaluar C4) | ✓ | |
| B30 | Cada ruta anterior **con un drawer abierto** (Nueva Matrícula o Ajustes) en 1440 px | Idem | Las listas pasan a modo compacto/tarjetas por container query; nada se corta | — | |
| B31 | Cada ruta de secretaria abierta **por el admin** con la URL de secretaria, y al revés | — | Redirección o acceso denegado, sin pantalla a medias | ✓ | |

**Rutas bloqueadas (deben mostrar "Módulo no disponible", no la pantalla):** los 7 módulos
Profesional (`pre-inscritos`, `relatores`, `asistencia`, `certificados`, `evaluaciones`, `archivo`,
`ex-alumnos-profesional`, en admin y secretaria), `/app/instructor/**`, `/app/alumno/**` e
`/inscripcion*`. Van como una fila más del mismo test (B32 ✓).

### C. Menú por rol y fase piloto

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Menú del admin | Aparecen todos los ítems de `menu-config.service.ts:70-190`, salvo los 7 Profesional bloqueados | ✓ | |
| C02 | Menú de la secretaria | Sin Anticipos, Secretarias, Auditoría, Flota (confirmar con el negocio) | ✓ | |
| C03 | Secretaria de una sede sin Profesional | Los ítems Profesional aparecen deshabilitados o no aparecen; la URL directa rebota (`professionalBranchGuard`) | ✓ | |
| C04 | Cada ítem del menú lleva a una ruta existente | Ningún 404 (se genera la lista desde el propio menú) | ✓ | |
| C05 | Entrar por URL a un módulo bloqueado | "Módulo no disponible" con botón "Volver a /app" sin cerrar sesión (fix-261-m) | ✓ | |
| C06 | Instructor o alumno inicia sesión | "Módulo no disponible" y botón que cierra sesión | ✓ | |

### D. Selector de sede

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Admin: selector en el topbar | Opciones "Todas las escuelas" + cada sede | ✓ | |
| D02 | Secretaria sin grant | No ve selector | ✓ | |
| D03 | Secretaria con grant | Ve el selector y se comporta como el admin (spec 0017) | ✓ | |
| D04 | Recargar (F5) con una sede elegida **(§4)** | Se conserva la sede y la etiqueta aparece desde el primer render, sin parpadeo (ASG-b-026) | ✓ | |
| D05 | Sede persistida que ya no existe (editar `localStorage` a un id inexistente) | Vuelve a "Todas" y limpia el valor | — | |
| D06 | Cambio rápido A → B → A con Slow 3G, en cada pantalla con datos por sede **(§4)** | Termina en A sin mezclar datos (guard de orden, spec 0005-m) | ✓ | |
| D07 | "Todas" = A + B en cada listado y KPI **(§4)** | Suma exacta en Alumnos, Pagos, Caja, Servicios, Certificación, Documentos, Instructores, Flota, Dashboard | ✓ | |
| D08 | Cambiar de sede en cada pantalla del piloto | La pantalla recarga sola. Hoy la secretaria con grant NO recarga en varias — ya reportado `024a · S6`, `026 · S16`, `028 · S19`, `029 · S16`, `030 · S7`, `031 · S13`, `033 · S25`: confirmar el total | ✓ | |
| D09 | Entrar a Nueva Matrícula con "Todas" | Pide elegir sede; "Todas" queda deshabilitado en el topbar | ✓ | |
| D10 | Entrar y salir de una vista Profesional | Solo sedes con Profesional; al salir vuelve a "Todas" (`025 · S22`: confirmar) | — | |
| D11 | Admin elige sede A, cierra sesión, entra una secretaria con grant | La secretaria parte en su sede o en "Todas", nunca en la del admin anterior | — | |
| D12 | Revocar el grant a una secretaria logueada | El selector desaparece y la vista vuelve a su sede sin volver a iniciar sesión (Paquete 7) | — | |
| D13 | Secretaria sin sede asignada | Todas las listas vacías (`NO_BRANCH_SCOPE`), nunca "todas las sedes" | ✓ | |

### E. Buscador global

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Abrir con el botón y con el atajo de teclado | Se abre el panel con foco en el input | ✓ | |
| E02 | Escape, clic afuera y seleccionar un resultado | Se cierra y limpia la búsqueda | ✓ | |
| E03 | Buscar un alumno recién entrado a la app (sin visitar Alumnos) **(§4)** | Encuentra al alumno (la búsqueda depende de datos ya cargados en memoria) | ✓ | |
| E04 | Buscar un alumno Profesional o un ex-alumno | ¿Aparece? Hoy solo busca Clase B de la Base — **decisión** | — | |
| E05 | Buscar estando en la Papelera de Alumnos | ¿Muestra archivados? (la vista de la Papelera "se pega", `024a · S7`) | — | |
| E06 | Secretaria A busca un RUT de la sede B | 0 resultados | ✓ | |
| E07 | Admin con sede A elegida busca un alumno de B | 0 resultados; con "Todas", sí aparece | ✓ | |
| E08 | Acciones rápidas (Registrar pago, Agendar, Nueva matrícula) como secretaria | Llevan a rutas `/app/secretaria/**` existentes (`032 · S17`) | ✓ | |
| E09 | Navegar resultados con flechas y Enter | Funciona sin mouse | — | |
| E10 | Instructor encontrado | Lleva a la lista de instructores (no hay ficha) — confirmar que es aceptable | — | |

### F. Drawers globales y modales

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Abrir un drawer en desktop | Empuja el contenido (`<main>` se angosta), sin taparlo | ✓ | |
| F02 | Abrir un drawer en 375 px | Pantalla completa con fondo oscuro; clic en el fondo lo cierra | ✓ | |
| F03 | Escape con un drawer abierto **(§4)** | Se cierra (hoy no, S9) | ✓ | |
| F04 | Navegar por el menú con un drawer abierto **(§4)** | El drawer se cierra (hoy queda abierto sobre otra pantalla, S9) | ✓ | |
| F05 | Abrir un drawer sobre otro (p. ej. ficha → Editar perfil) | Aparece "Volver" y regresa al anterior; X cierra todo | — | |
| F06 | Abrir un drawer desde otra pantalla con uno ya abierto (`open` en vez de `push`) | Reemplaza al anterior; si tenía un formulario a medias, ¿avisa? | — | |
| F07 | Foco al abrir y al cerrar | Al abrir, el foco entra al drawer; al cerrar, vuelve al botón que lo abrió | — | |
| F08 | Formulario a medias + cerrar con X | ¿Pide confirmación? Anotar en qué drawers se pierde lo escrito sin aviso | — | |
| F09 | Modal de confirmación global: Escape y clic afuera | Definir: hoy ninguno lo cierra (S10) | — | |
| F10 | Modal con texto de usuario que contiene HTML **(§4)** | Se ve el texto literal, no negrita ni enlaces (S10) | — | |
| F11 | Confirmación destructiva | Botón rojo (fix-094-b), no azul | ✓ | |
| F12 | Visor de documentos (DMS) sobre un drawer | Se ve por encima y se cierra sin cerrar el drawer | — | |

### G. Campana (solo apertura; el contenido está en `035`)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Abrir y cerrar la campana | Panel visible; se cierra con clic afuera y al abrir el menú de usuario | ✓ | |
| G02 | Contador con > 99 no leídas | No rompe el topbar | — | |
| G03 | Campana en 375 px | El panel cabe en pantalla | ✓ | |
| G04 | Clic en una notificación que lleva a un módulo bloqueado | Ya reportado `025 · S21`, `035 · S15` | — | |

### P. Aislamiento multi-sede por API (RLS, Storage, edge functions, RPC)

Todas con **sesión de secretaria de la sede A** salvo que diga otra cosa, y con ids de la sede B
(D2). Resultado esperado general: **0 filas, 401/403 o error**; si no, anotar y levantar P0.

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Leer `enrollments`, `students`, `cash_closings`, `expenses`, `class_b_theory_cycles`, `student_documents` de B **(§4)** | 0 filas (estas sí filtran por sede) | ✓ | |
| P02 | Leer `payments`, `class_b_sessions`, `special_service_sales`, `vehicles`, `users` de B | Hoy **sí** devuelve filas (ya reportado). Confirmar y anotar columnas expuestas | ✓ | |
| P03 | `UPDATE students SET status='archived'` sobre un alumno de B **(§4)** | Rechazado (S2) | ✓ | |
| P04 | `DELETE` de un alumno de B sin matrículas | Rechazado (S2) | — | |
| P05 | `UPDATE users` de la propia fila: `can_access_both_branches=true` y `role_id` de admin | Ya reportado `034 · S2` — confirmar | ✓ | |
| P06 | `UPDATE digital_contracts` de una matrícula de B | Rechazado (S8) | ✓ | |
| P07 | Leer y borrar `standalone_course_enrollments`; leer y crear `instructor_advances` de B **(§4)** | Rechazado (S8) | ✓ | |
| P08 | Leer `certificates`, `discount_applications`, `absence_evidence`, `secretary_observations`, `school_documents` de B | 0 filas (S8) — o documentar como decisión | ✓ | |
| P09 | RPC `confirm_enrollment_with_payment` sobre el borrador D3 de la sede B **(§4)** | Rechazado (S1). Repetir con la sesión de un **alumno** | ✓ | |
| P10 | Insertar en `audit_log` una fila con el `user_id` del admin **(§4)** | Rechazado (S5) | ✓ | |
| P11 | `generate-certificate-professional-pdf` sin sesión (solo anon key) **(§4)** | 401 (S3). Si responde con un `pdfUrl`, P0 | ✓ | |
| P12 | `generate-audit-report` con sesión de secretaria y `branch_id: null` | 403 (S4) | ✓ | |
| P13 | Storage `website-public`: subir `seeds/x.svg` sin sesión; sobrescribir el logo de la otra sede como secretaria **(§4)** | Ambos rechazados (S6) | ✓ | |
| P14 | Realtime: suscribirse (en la pestaña de la secretaria A) y registrar un pago en B desde otra sesión | La secretaria A **no** recibe la fila de B en el WebSocket (hoy la recibe: RLS de `payments` solo por rol) | — | |
| P15 | `public-enrollment` con la anon key: `check-duplicate` con un RUT conocido y `reserve-slots` **(§4)** | Con la fase bloqueada, deberían responder "no disponible". Si retiene horarios, S7 confirmada | ✓ | |
| P16 | RPC de cron (`notify_vehicle_document_expiry`, `cleanup_expired_drafts`, `auto_transition_*`) con sesión de secretaria | Rechazadas (hoy se ejecutan) | ✓ | |
| P17 | Storage `documents`: listar y descargar un archivo de B | Ya reportado `033 · S1` — confirmar | ✓ | |
| P18 | Edge functions ya reportadas: repetir la prueba de cada una con ids de B (tabla §1.1) | Una fila de resultado por función en el `fix.md` | ✓ | |
| P19 | Instructor y alumno (portales bloqueados) llaman `/rest/v1/payments` y `/rest/v1/class_b_sessions` | Solo sus propias filas | ✓ | |
| P20 | Admin "Todas": el total de cada módulo = A + B | Iguales (se cruza con D07) | ✓ | |
| P21 | Secretaria con grant: ve A y B; al quitarle el grant, deja de ver B **en la API** (no solo en la UI) | Confirmado por consola | — | |
| P22 | Filas con `branch_id` NULL (egresos, anticipos, documentos institucionales) | Documentar quién las ve: `branch_visible(NULL)` = todas las secretarias | — | |

### Q. Tiempo real (transversal)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Verificar la publicación real **(§4)** | `select tablename from pg_publication_tables where pubname='supabase_realtime'` coincide con las 9 tablas de §1.2 | — | |
| Q02 | 2 navegadores, cada canal "vivo" de §1.2 (Agenda, Liquidaciones, Campana, Tareas, Dashboard secretaria) | El cambio en A aparece en B en < 5 s sin recargar | — | |
| Q03 | Los 6 canales "muertos" | Confirmar que no reciben eventos (evidencia para sus fixes) | — | |
| Q04 | Salir de cada pantalla con canal | DevTools → WS: el canal se cierra (`phx_leave`). Anotar los que quedan abiertos (Dashboard secretaria `030 · S12`, acción rápida de pago S11) | — | |
| Q05 | Navegar 10 veces entre Dashboard y Pagos | El número de canales abiertos no crece | — | |
| Q06 | Perder la red 30 s y recuperarla | Los canales se reconectan y la pantalla se pone al día | — | |
| Q07 | Revocar el grant en caliente (canal `user-self`) | Se aplica sin volver a iniciar sesión (D12) | — | |

### T. Hora de Chile

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| T01 | **Operar entre 21:00 y 23:59 hora Chile** **(§4)** | Todas las fechas de negocio de §1.8 muestran y guardan el día de Chile | — | |
| T02 | Adelantar el reloj del equipo a las 23:30 (o emular con Playwright `timezoneId`/`clock`) | Igual que T01, sin esperar a la noche | ✓ | |
| T03 | Cambio de horario de verano/invierno (primer sábado de abril y de septiembre) | Las clases de ese fin de semana muestran la hora correcta | — | |
| T04 | Reporte mensual con un pago del último día del mes a las 22:30 | Cuenta en el mes correcto (S14, `029 · S7`) | — | |

### X. Errores, red y consola

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| X01 | Cada pantalla con la red cortada (DevTools → Offline) **(§4)** | Mensaje de error claro, nunca "lista vacía" ni ceros | — | |
| X02 | Una escritura que la RLS rechaza (p. ej. la secretaria borra un anticipo) | Toast de error, nunca de éxito (`029 · S2`) | — | |
| X03 | Pagar y revertir una liquidación con la red cortada justo después del primer paso **(§4)** | Los anticipos no quedan en un estado incoherente (S13) | — | |
| X04 | Sesión expirada (borrar el token en `localStorage`) y hacer una acción | Vuelve a `/login` con un mensaje, sin toasts de error en cadena | — | |
| X05 | Errores de edge function (500) | El mensaje real se ve (patrón DG-085, `034 · S6`) | — | |
| X06 | Recorrido completo con la consola abierta | Sin errores ni warnings nuevos, salvo `NG0955` (anotar dónde) | ✓ | |

### V. Visual: modo oscuro, responsive y app-like

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| V01 | Toggle de tema en el topbar | Alterna claro/oscuro con la animación circular, sin parpadeo | ✓ | |
| V02 | Recargar en oscuro | Arranca en oscuro, sin flash blanco | ✓ | |
| V03 | Preferencia del sistema operativo | Hoy no existe el modo "sistema": se toma una vez y queda fijo. ¿Es aceptable? — **decisión** | — | |
| V04 | Datepickers, selects y tooltips de PrimeNG en oscuro | Legibles (antecedente: `fix-152-b`) | ✓ | |
| V05 | Textos con `text-primary` (forma corta prohibida) | Grep en templates: 0 ocurrencias. Si hay, en oscuro el texto hereda el color | ✓ | |
| V06 | 768 px (tablet) en todas las rutas | Densidad intermedia coherente; nada se superpone | ✓ | |
| V07 | Zoom del navegador al 200 % en 1440 px | Sin scroll horizontal; se comporta como tablet | — | |
| V08 | Ventana de poca altura (1440 × 700) | Las páginas app-like siguen sin scroll del documento; los paneles scrollean | ✓ | |
| V09 | Scrollbar de Windows en las pestañas | Las pestañas no "saltan" al aparecer el scroll (`--fill-screen-kpi`) | — | |
| V10 | Colores de marca por viewport (regla 3-2-1) | Máximo 3 elementos con el color de marca | — | |
| V11 | Animación de entrada al navegar | Una vez, sin dejar contenido invisible | — | |

### K. Sesión en 2 pestañas (comparten `localStorage`)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Cerrar sesión en la pestaña 1 | La pestaña 2 va a `/login` al interactuar (o sola) | ✓ | |
| K02 | Pestaña 2 inicia sesión con otra cuenta | Ya reportado `022 · S8` — confirmar | ✓ | |
| K03 | Cambiar de sede en la pestaña 1 **(§4)** | La pestaña 2 sigue en la suya hasta recargar; al recargar toma la de la 1 (S12) — **decisión** | — | |
| K04 | Cambiar el tema en la pestaña 1 | ¿La 2 se actualiza? Anotar | — | |
| K05 | Matrícula a medias en ambas pestañas | Sin borradores duplicados ni pérdida de datos (cruza con `023`) | — | |

### Y. Accesibilidad básica

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Y01 | Recorrer el shell solo con Tab | Orden lógico: sidebar → topbar → contenido; el foco siempre visible | — | |
| Y02 | Al cambiar de ruta | El foco va a `<main>` (`app-shell.component.ts:253-260`) | — | |
| Y03 | Botones de solo ícono del shell (campana, tema, búsqueda, cerrar drawer, menú móvil) | Tienen `aria-label` | ✓ | |
| Y04 | Contraste en claro y oscuro (Lighthouse / axe) | Sin errores de contraste en las 5 pantallas más usadas | ✓ | |
| Y05 | Drawer y modal con lector de pantalla | Se anuncian como diálogo (hoy el drawer no, S9) | — | |
| Y06 | Tamaño táctil en 375 px | Botones del shell ≥ 44 px | — | |
| Y07 | Atributos `data-llm-*` en botones de acción y navegación del shell | Presentes (`ai-readability.md`) | ✓ | |

### Z. Rendimiento con muchos datos (D6)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Z01 | Base Alumnos, Pagos, Agenda, Documentos, Caja y Dashboard con D6 | Carga < 3 s en red normal; sin congelar la pestaña | — | |
| Z02 | Listas que traen todo y scrollean por dentro | Scroll fluido; ¿alguna necesita paginar? | — | |
| Z03 | Tope de 1.000 filas de PostgREST | Ninguna lista corta en 1.000 sin aviso (`033 · S12`); revisar las demás con D6 | — | |
| Z04 | Memoria tras 30 min de uso (DevTools → Memory) | No crece sin límite (canales y suscripciones que no se cierran) | — | |
| Z05 | Buscador global con D6 | Responde sin demora al tipear | — | |

---

## 4. Casos con pasos numerados

### A10 — Selector de sede de Ajustes durante la matrícula (S15)

**Precondición:** sesión admin con la sede A elegida.
1. Menú → Nueva Matrícula. Verificar que en el topbar "Todas las escuelas" está deshabilitado.
2. Sin salir del wizard, abrir Ajustes (menú de usuario o engranaje) → sección de sede.
3. Clic en "Todas las escuelas".
4. Cerrar Ajustes y mirar el wizard y el topbar.

**Esperado:** en el paso 3 la opción está deshabilitada o no hace nada. Si el topbar pasa a "Todas"
con el wizard abierto, S15 confirmada (y revisar en qué sede quedaría la matrícula, `023 · S21`).

### B — Barrido de rutas (Playwright, prioridad 1)

**Precondición:** `ASG-i-021` montado; cuentas admin y secretaria de la sede A con datos (D1);
`ng serve` o el build del piloto.
1. Por cada rol, iniciar sesión una vez y guardar el `storageState`.
2. Para cada ruta de la tabla B de ese rol (resolver `:id` con un alumno y un vehículo reales):
   a. Para cada ancho (375, 768, 1440) y tema (claro/oscuro, fijando la clave de tema en
      `localStorage` antes de navegar):
   b. Escuchar `console` (nivel `error`) y `response` (status ≥ 400) desde antes de navegar.
   c. Navegar y esperar a que desaparezcan los skeletons (`app-skeleton-block`) o 10 s.
   d. **C3:** `document.documentElement.scrollWidth <= innerWidth` y lo mismo con `.shell-content`.
   e. **C4** (solo 1440): `.shell-content.scrollHeight <= .shell-content.clientHeight + 1` en las
      rutas app-like; en B10, B28 y B29 solo anotar.
   f. Captura de pantalla completa con el nombre `rol_ruta_ancho_tema.png`.
3. Repetir el paso 2 con un drawer abierto (B30) solo en 1440.
4. Para cada ruta bloqueada (B32), verificar que termina en `/modulo-no-disponible`.
5. Generar un resumen: filas con fallas por check.

**Esperado:** 0 errores de consola (salvo `NG0955`, que se lista aparte), 0 respuestas 4xx/5xx
inesperadas, 0 scroll horizontal y C4 en todas las rutas app-like. **C5 (legibilidad)** se revisa a
ojo sobre las capturas en oscuro. **Evidencia:** la carpeta de capturas y el resumen.

### D04 — La sede elegida sobrevive a F5

**Precondición:** sesión admin.
1. Elegir la sede B en el topbar.
2. Ir a Pagos y anotar el total.
3. Recargar con F5 y mirar el topbar mientras carga.
4. Cerrar sesión y volver a entrar.

**Esperado:** en el paso 3 el topbar dice "B" desde el primer render (sin "—" ni parpadeo) y Pagos
muestra el mismo total. En el paso 4 parte en "Todas" (la sede se borra al cerrar sesión).

### D06 — Cambio rápido de sede en cada pantalla

**Precondición:** sesión admin; D1; DevTools → Slow 3G.
1. Abrir Base Alumnos B.
2. Elegir A, inmediatamente B e inmediatamente A, sin esperar.
3. Esperar a que termine todo y revisar que todo lo visible es de A.
4. Repetir en Pagos, Caja, Agenda, Asistencia, Servicios especiales, Certificación, Documentos,
   Instructores, Flota, Liquidaciones, Reportes y Dashboard.

**Esperado:** en todas termina en A sin filas de B. Anota las pantallas donde se mezclan datos
(las que no usan `createRequestGuard`, p. ej. `028 · S20`).

### D07 — "Todas" = A + B

**Precondición:** sesión admin; D1.
1. Por cada pantalla de D06, anotar el total (o el KPI principal) con la sede A, con la B y con
   "Todas".
2. Comparar A + B con "Todas".

**Esperado:** iguales en todas. Si alguna difiere, anota cuál, cuánto y si las filas con
`branch_id` NULL o "ambas sedes" explican la diferencia (P22).

### E03 — Buscador global sin haber visitado Alumnos

**Precondición:** sesión nueva de secretaria (recién iniciada, sin navegar).
1. En el Dashboard, abrir el buscador.
2. Escribir 3 letras del apellido de un alumno activo conocido.
3. Esperar 3 s.
4. Ir a Base Alumnos B, volver al Dashboard y repetir la búsqueda.

**Esperado:** el alumno aparece en el paso 3. Si solo aparece en el paso 4, el buscador depende de
que la lista ya esté cargada: anotarlo como bug.

### F03 — Escape cierra el drawer (S9)

1. En Base Alumnos B, clic en "Nueva Matrícula" (se abre el drawer).
2. Presionar Escape.
3. Repetir con Ajustes y con un drawer de Pagos.

**Esperado:** se cierra en los 3. Hoy no debería cerrarse: S9 confirmada.

### F04 — Navegar con un drawer abierto (S9)

1. En Base Alumnos B, abrir "Nueva Matrícula" y avanzar al paso 2.
2. Sin cerrar el drawer, clic en "Agenda" en el sidebar.
3. Mirar la pantalla.
4. Volver a Alumnos.

**Esperado:** en el paso 3 el drawer se cerró (idealmente preguntando si se pierde lo avanzado). Si
sigue abierto sobre la Agenda, S9 confirmada. En el paso 4, anota si el wizard conservó los datos.

### F10 — HTML en el modal de confirmación (S10)

**Precondición:** sesión admin o secretaria; caja del día abierta.
1. Registrar un egreso con la descripción `Prueba <b>negrita</b> <a href="https://example.com">link</a>`.
2. En la lista de la caja, clic en eliminar ese egreso.
3. Mirar el texto del modal. No hacer clic en el enlace.
4. Cancelar y borrar el egreso de prueba.

**Esperado:** el modal muestra el texto literal con `<b>` y `<a>`. Si aparece "negrita" en negrita
o un enlace clicable, S10 confirmada.

### P01 — La secretaria A no lee tablas que sí filtran por sede

**Precondición:** sesión de secretaria A; ids de D2 (sede B).
1. En Base Alumnos B, copiar desde Network una petición a `/rest/v1/students` ("Copy as fetch").
2. En Console, cambiar la URL por `/rest/v1/students?id=eq.<id de B>&select=*` y ejecutar.
3. Repetir con `enrollments?id=eq.<id>`, `cash_closings?branch_id=eq.<B>`,
   `expenses?branch_id=eq.<B>`, `class_b_theory_cycles?branch_id=eq.<B>` y
   `student_documents?enrollment_id=eq.<id>`.

**Esperado:** `[]` en todas. Cualquier fila de B es **P0 inmediato**.

### P03 — La secretaria A archiva un alumno de B (S2)

**Precondición:** ambiente de prueba; sesión de secretaria A; `students.id` de un alumno de B.
1. Copiar cualquier `PATCH` o `GET` a `/rest/v1/students` como en P01.
2. Armar un `fetch` con método `PATCH` a `/rest/v1/students?id=eq.<id de B>`, cabecera
   `Prefer: return=representation` y body `{"status":"archived"}`.
3. Ejecutar y mirar la respuesta.
4. Con la sesión del admin, revisar la Papelera de la sede B.

**Esperado:** respuesta `[]` (0 filas afectadas) y el alumno sigue activo. Si la respuesta trae la
fila con `archived`, S2 confirmada → P0. **Restaurar** al alumno desde la Papelera.

### P07 — Cursos singulares y anticipos de otra sede (S8)

**Precondición:** ambiente de prueba; sesión de secretaria A; D4.
1. `GET /rest/v1/standalone_course_enrollments?select=*` → anotar si aparecen filas de B.
2. `GET /rest/v1/instructor_advances?select=*` → lo mismo.
3. `DELETE /rest/v1/standalone_course_enrollments?id=eq.<id de B>` con `Prefer: return=representation`.
4. `POST /rest/v1/instructor_advances` con un instructor de B y monto 1.

**Esperado:** pasos 1–2 sin filas de B; pasos 3–4 rechazados. Anota cada uno. Si el paso 3 borra,
recrear la inscripción con el admin y revisar la caja de B.

### P09 — Confirmar un borrador ajeno por RPC (S1)

**Precondición:** ambiente de prueba; D3 (borrador de la sede B, anotar su `id`); sesión de
secretaria A.
1. Copiar cualquier petición `/rest/v1/…` como en P01 (para tener las cabeceras).
2. Cambiar la URL a `/rest/v1/rpc/confirm_enrollment_with_payment`, método `POST`, body
   `{"p_enrollment_id": <id D3>, "p_payment_method": "pendiente", "p_total_amount": 0}`.
3. Ejecutar.
4. Con el admin, abrir la ficha del alumno de D3 y la caja de B.
5. Repetir los pasos 1–3 con la sesión de un **alumno** de prueba sobre otro borrador.

**Esperado:** error de permisos en los pasos 3 y 5. Si devuelve un número de matrícula (texto),
S1 confirmada → **P0**: la matrícula quedó `active` sin pasar por el wizard.

### P10 — Fabricar una entrada de auditoría (S5)

**Precondición:** sesión de secretaria A; `users.id` del admin.
1. `POST /rest/v1/audit_log` con body `{"user_id": <id admin>, "action": "DELETE", "entity": "payments", "entity_id": 1, "detail": "prueba 037"}`.
2. Con el admin, abrir Auditoría y filtrar por el admin.

**Esperado:** rechazado en el paso 1. Si la fila aparece en Auditoría como hecha por el admin,
S5 confirmada.

### P11 — Certificado profesional sin sesión (S3)

**Precondición:** ambiente de prueba; anon key (D9); `enrollment_id` de D5.
1. Abrir una pestaña **sin sesión** (incógnito) en cualquier página y abrir la consola.
2. Ejecutar un `fetch` `POST` a `<SUPABASE_URL>/functions/v1/generate-certificate-professional-pdf`
   con cabeceras `apikey: <anon>`, `Authorization: Bearer <anon>`, `Content-Type: application/json`
   y body `{"enrollment_id": <id D5>}`.
3. Con el admin, revisar si la matrícula de D5 ahora tiene certificado.

**Esperado:** 401/403 y nada cambia. Si responde con `pdfUrl` o la matrícula queda con certificado,
S3 confirmada → **P0**.

### P13 — Storage `website-public` (S6)

**Precondición:** anon key; un PNG pequeño de prueba.
1. En incógnito, `fetch` `POST` a `<SUPABASE_URL>/storage/v1/object/website-public/seeds/prueba-037.png`
   con `apikey` y `Authorization: Bearer <anon>` y el PNG como body.
2. Abrir `<SUPABASE_URL>/storage/v1/object/public/website-public/seeds/prueba-037.png`.
3. Con la sesión de la secretaria A, en Configuración Web, subir un logo y copiar la petición;
   repetirla cambiando la ruta a la del logo de la sede B.
4. Borrar lo subido con el admin.

**Esperado:** pasos 1 y 3 rechazados. Si el archivo queda público o el logo de B cambia, S6
confirmada.

### P15 — Matrícula pública con la fase bloqueada (S7)

**Precondición:** anon key; `/inscripcion` bloqueada (verificar que redirige a "Módulo no disponible").
1. En incógnito, `fetch` `POST` a `<SUPABASE_URL>/functions/v1/public-enrollment` con
   `{"action":"check-duplicate","rut":"<RUT de un alumno activo>","licenseClass":"B"}`.
2. Repetir con `{"action":"load-instructors", …}` y luego `reserve-slots` sobre un horario libre
   de la agenda (copiar los parámetros del código o de un QA previo).
3. Con la secretaria, abrir la Agenda en ese horario.

**Esperado:** decisión de negocio (§5). Si el paso 1 revela que el RUT tiene matrícula o el paso 3
muestra el horario retenido, S7 confirmada.

### Q01 — Publicación Realtime real

**Precondición:** acceso de solo lectura al SQL editor del ambiente del piloto.
1. Ejecutar `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;`
2. Comparar con la lista de §1.2.

**Esperado:** las mismas 9 tablas. Si hay más (alguien las agregó a mano), actualizar §1.2 y
reevaluar los canales "muertos"; si hay menos, un canal "vivo" también está muerto.

### T01 — Operar entre 21:00 y 23:59 hora Chile

**Precondición:** sesión de secretaria; hora real entre 21:00 y 23:59 de Chile (o T02).
1. Registrar un pago de matrícula, un egreso, un anticipo, una venta de servicio especial y un curso
   singular pagado.
2. Matricular un alumno nuevo.
3. Revisar la fecha que muestra cada pantalla: Caja del día, Pagos, Base Alumnos (fecha de ingreso),
   Servicios especiales, Reportes contables (mes y día) y Dashboard ("Clases Hoy").
4. Al día siguiente, revisar el cierre de caja del día anterior y el Historial de cuadraturas.
5. Revisar la lista de Certificación B de un alumno cuya última clase fue después de las 21:00.

**Esperado:** todo aparece con la fecha del día de Chile en que se hizo, y la caja de ese día lo
incluye. Anota cada fecha corrida contra §1.8.

### X01 — Pantallas sin red

1. Iniciar sesión y abrir el Dashboard.
2. DevTools → Network → Offline.
3. Navegar por el menú a cada pantalla del piloto (el bundle ya está cargado; las que no, anotarlas).
4. Anotar qué muestra cada una cuando termina el skeleton.
5. Volver a Online y recargar.

**Esperado:** un mensaje de error claro en cada una. Anota las que muestran "sin datos", ceros o
"¡Sin saldos pendientes!" (patrón ya reportado por módulo; esta es la lista completa).

### X03 — Liquidación a medias (S13)

**Precondición:** ambiente de prueba; admin; un instructor con anticipos en el mes.
1. En Liquidaciones, DevTools → Network → bloquear la URL que contiene `instructor_advances`
   (Request blocking).
2. Pagar la liquidación del instructor.
3. Quitar el bloqueo y recargar.
4. Revisar el estado de los anticipos del mes.

**Esperado:** o el pago falla completo con un error, o los anticipos quedan "descontados". Si el
pago aparece hecho con anticipos "pendientes" y sin aviso, S13 confirmada.

### K03 — Sede en 2 pestañas (S12)

**Precondición:** admin; 2 pestañas del mismo navegador en Pagos.
1. Pestaña 1: elegir la sede A. Pestaña 2: elegir la B.
2. Volver a la pestaña 1 sin recargar y registrar un pago "de la sede que se ve".
3. Recargar la pestaña 1.

**Esperado:** decisión (§5). Anota en qué sede quedó el pago del paso 2 y qué sede muestra la
pestaña 1 tras recargar (hoy: la B, la última elegida en cualquier pestaña).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| P02 / `034 · R11` / `032 · R03` | ¿Es aceptable que la secretaria lea por API `users`, `vehicles`, `payments` y `class_b_sessions` de la otra sede? (Hoy sí, "por decisión" en algunos casos.) Si no, la RLS debe filtrar por sede |
| P08 | ¿Certificados, descuentos, justificativos, observaciones y documentos institucionales deben ser por sede? |
| P15 / S7 | Mientras la matrícula pública esté bloqueada, ¿se deshabilita también `public-enrollment` (y las acciones legacy de `student-payment`), o solo la pantalla? |
| P16 | ¿Se revoca `EXECUTE` a `authenticated` en todas las funciones de cron y en las `SECURITY DEFINER` sin validación (un `REVOKE` por función + ajustar `ALTER DEFAULT PRIVILEGES`)? |
| P22 | ¿Quién debe ver las filas con `branch_id` NULL (egresos o documentos "institucionales")? |
| E04 | ¿El buscador global debe encontrar alumnos Profesional y ex-alumnos? |
| F08 | ¿Cerrar un drawer con un formulario a medias debe pedir confirmación, en todos o en cuáles? |
| F09 | ¿El modal de confirmación se cierra con Escape o clic afuera (= Cancelar)? |
| K03 | ¿La sede elegida es por pestaña o global del navegador? |
| V03 | ¿Hace falta la opción "según el sistema" en el tema? |
| Z02 | ¿Qué listas deben paginar en vez de traer todo y scrollear? |
| S5 | ¿La bitácora de auditoría debe poder escribirse solo desde triggers (sin `INSERT` desde el cliente)? |
