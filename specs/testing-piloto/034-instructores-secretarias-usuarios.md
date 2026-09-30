# Testing — Gestión de instructores, secretarias y usuarios

> **Asignación:** `ASG-i-034` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/instructores`, `/app/secretaria/instructores` (es la misma pantalla,
> fix-208-m), `/app/admin/secretarias`, `/app/admin/usuarios`, drawer **Ajustes** (Mi Perfil →
> Cambiar contraseña; Ajustes → Tarifa Instructores).
> **Incluye:** lista de instructores, crear/editar/ver instructor, "Ambas sedes", vehículo
> asignado, desactivar, reenviar invitación, horario, horas trabajadas, apertura de documentos
> del instructor; lista/crear/editar/ver secretaria, grant multi-sede (otorgar/revocar en
> caliente), desactivar; página Usuarios; cambio de contraseña propio; tarifa por hora por sede;
> casos de seguridad (secretaria contra acciones de admin, por UI y llamando edge functions/API).
> **No incluye:** el portal del instructor por dentro (bloqueado en el piloto), la subida y
> revisión de documentos por dentro (ver el checklist de `ASG-i-033`), la agenda por dentro
> (ver `026-agenda-triple-match.md`), Liquidaciones (ver `029-contabilidad.md`), login/primer
> ingreso/cuenta desactivada en general (ver `022-autenticacion-sesion-fase-piloto.md`).
>
> **Código leído para armar esta lista:**
> `features/admin/instructores/` (lista + drawers crear, editar, ver, horario, horas),
> `features/secretaria/instructores/secretaria-instructores.component.ts`,
> `features/admin/secretarias/` (lista + drawers crear, editar, ver),
> `features/admin/usuarios/admin-usuarios.component.ts`,
> `features/admin/configuracion-nomina/tarifa-instructores-drawer.component.ts`,
> `shared/components/{ajustes-drawer,instructor-card}/`,
> `core/facades/{instructores,secretarias,branch,auth,payroll-config}.facade.ts`,
> `core/facades/agenda.facade.ts` (pickers de instructor), `core/facades/dms.facade.ts`
> (subida de documentos de instructor), `core/utils/{branch-scope,instructor-doc-types.util,document-file-validation.util}.ts`,
> `supabase/functions/{create-instructor,update-instructor,create-secretary,update-secretary,activate-instructor-account}/`,
> migraciones de RLS de `users`/`instructors`/`instructor_documents`/`branch_payroll_config`,
> trigger `trg_license_alert`, vista `v_class_b_schedule_availability` (hotfix-003), realtime de
> `users`. Specs/fixes: `0004-m`, `0014-m`, `0017-b`, `fix-028-i`, `fix-029-i`, `fix-168-m`,
> `fix-169-m`; `docs/UAT-PLAN.md` Paquetes 6 y 7.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-034`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S22)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **Los casos de seguridad (sección R) se ejecutan contra un entorno de pruebas**, nunca contra
  producción ni con cuentas reales: varios, si la sospecha se confirma, cambian el correo o el
  rol de una cuenta. Usa siempre las cuentas "víctima" de §2.
- Hallazgos **ya confirmados por otras investigaciones** que este módulo toca (no se repiten como
  sospechas nuevas, pero sí hay casos que los cruzan):
  - `update-student-profile` solo verifica que quien llama sea admin/secretaria y acepta cualquier
    `userId` (`update-student-profile/index.ts:78-80,102-121`).
  - Un usuario desactivado sigue pudiendo entrar: `update-secretary` solo cambia `users.active`, no
    bloquea en Auth (`update-secretary/index.ts:148-155`).
  - Clave inicial de la secretaria = cuerpo del RUT y `first_login` solo se exige en el cliente
    (`create-secretary/index.ts:122`).

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **`update-instructor` sirve para editar a CUALQUIER usuario, incluido un admin.** Verifica solo que quien llama sea admin o secretaria; después usa el `userId` del body sin comprobar que sea el dueño del `instructorId`, que tenga rol instructor ni que sea de la sede de la secretaria. Con la clave de servicio le cambia el **email en Auth** y en `users`, el `active` y el `branch_id`. Una secretaria podría ponerle su propio correo a la cuenta de un admin y pedir "olvidé mi contraseña" → toma de la cuenta. Es el mismo patrón ya confirmado en `update-student-profile`. También permite editar/mover instructores de otra sede. | `supabase/functions/update-instructor/index.ts:97-100,111-129,150-172,174-195` |
| S2 | 🔴 Alta | **La RLS de `users` deja a la secretaria modificarse a sí misma y a cualquier no-admin de su sede desde la consola.** `update_users` para secretaria solo exige `branch_visible(branch_id)` y que la fila no sea de admin, sin restringir columnas. Podría: otorgarse `can_access_both_branches = true` (ver todas las sedes), cambiar su `branch_id`, ponerse `first_login = false`, o cambiar el `role_id` de un alumno o instructor a `secretary` (acceso de personal). `auth_user_role()` y `auth_can_access_both_branches()` leen esa misma tabla, así que el cambio surte efecto de inmediato. | `supabase/migrations/20260307120000_fix_users_rls_secretary_enrollment.sql:27-35`; `20260301000011_10_rls_policies.sql:28-43` |
| S3 | 🟠 Media | **La secretaria no puede crear instructores (o los crea en la sede equivocada).** En el drawer Crear, la sede se llena solo desde `branchFacade.selectedBranchId()`; el selector de sede y el mensaje "Selecciona una sede." se muestran **solo a admin**. Para una secretaria sin grant ese valor es `null` → el formulario nunca es válido y "Crear instructor" no hace nada, sin mensaje. Si en ese navegador quedó guardada la sede de otro usuario (admin que cerró sin "Cerrar sesión"), el instructor se crea en **esa** sede (contradice AC2 de `0004-m`). | `admin-instructor-crear-drawer.component.ts:229-244,482,599-607,636`; `branch.facade.ts:23,46-49`; `auth.facade.ts:244-249` |
| S4 | 🟠 Media | **Crear instructor e invitar confían en lo que manda el navegador.** `create-instructor` usa el `branchId` del body tal cual (una secretaria puede crear instructores en la otra sede llamando la función directo). `activate-instructor-account` deja a cualquier secretaria reenviar la invitación de un instructor de cualquier sede. | `create-instructor/index.ts:199-202,224,240,304`; `activate-instructor-account/index.ts:190-193,203-223` |
| S5 | 🟠 Media | **Cambiar un email puede dejar Auth y la tabla desincronizados.** Las dos funciones de edición cambian primero el email en Auth y después hacen el UPDATE de `users`; si ese UPDATE falla (por ejemplo `users_email_key`: el correo ya existe en `users` pero no en Auth, que es justo el error que registró `fix-029-i`) **no revierten Auth**. Resultado: la persona entra con el correo nuevo pero la app la busca con el viejo. | `update-instructor/index.ts:150-195`; `update-secretary/index.ts:122-175`; `specs/fixes/fix-029-i-edge-function-error-swallowed/fix.md:14-20` |
| S6 | 🟠 Media | **Errores reales de las edge functions tragados (patrón DG-085).** `fix-029-i` solo corrigió "Editar instructor". Crear instructor, crear/editar secretaria y reenviar invitación siguen mostrando un mensaje genérico en vez de "Ya existe un usuario con ese correo", "licencia vencida", RUT duplicado o "El email no coincide…". Además el chequeo `includes('already registered')` probablemente no calza con el texto actual de Supabase ("…has already been registered"), así que el 409 se vuelve 500. | `instructores.facade.ts:580-581,695-696`; `secretarias.facade.ts:199-200,232-233`; `create-instructor/index.ts:283`; `create-secretary/index.ts:135` |
| S7 | 🟠 Media | **El estado de la licencia se congela.** `license_status` se calcula al crear/editar y el trigger solo corre en `UPDATE OF license_expiry`; no hay tarea programada. Una licencia que vence sigue "Vigente", el filtro "Licencia por vencer" no la cuenta y la agenda sigue ofreciendo al instructor (la vista solo mira `i.active`). | `20260301000008_08_misc_and_triggers.sql:294-309`; `instructores.facade.ts:727-728`; `20260917110000_hotfix003_…sql:57-59` |
| S8 | 🟠 Media | **Un instructor sin vehículo no aparece para agendar.** La vista de disponibilidad hace JOIN con la asignación de vehículo vigente; el drawer Crear deja el vehículo como opcional y no avisa. El caso del UAT ("Crear instructor → aparece en Agenda") solo pasa si se le asignó vehículo. | `20260917110000_hotfix003_…sql:41-51`; `admin-instructor-crear-drawer.component.ts:368-383` |
| S9 | 🟡 Baja-Media | **Desactivar un instructor no libera su vehículo ni avisa de sus clases futuras.** La asignación queda abierta (el vehículo sigue "asignado" y no se ofrece a otro) y las clases ya agendadas quedan con un instructor inactivo. | `update-instructor/index.ts:197-247`; `admin-instructor-editar-drawer.component.ts:457-487` |
| S10 | 🟡 Baja | **"Reenviar invitación" usa el correo del formulario, no el guardado.** Si editaste el correo y aún no guardas, la función responde 400 "El email no coincide" (y por S6 se ve genérico). En el piloto, además, el link lleva a un portal bloqueado. | `admin-instructor-editar-drawer.component.ts:431-455,763-772`; `activate-instructor-account/index.ts:215-218` |
| S11 | 🟡 Baja | **Alta de secretaria sin invitación ni aviso de la clave.** La cuenta se crea con clave = cuerpo del RUT (hallazgo ya conocido), no se manda correo y el admin no ve en ninguna parte cuál es la clave. El UAT anotó que "el login con password por defecto no funciona" y lo atribuyó a una invitación que para secretarias no existe. | `create-secretary/index.ts:118-132`; `docs/UAT-PLAN.md:133` |
| S12 | 🟡 Baja | **Apellido materno obligatorio.** Personas sin segundo apellido (extranjeros) no se pueden crear como secretaria ni instructor, y una secretaria antigua sin materno no se puede editar **ni desactivar**. | `create-secretary/index.ts:101`; `update-secretary/index.ts:105-117`; `admin-secretarias-editar-drawer.component.ts:448`; `admin-instructor-crear-drawer.component.ts:455` |
| S13 | 🟡 Baja | **Textos engañosos en Editar secretaria.** "Se enviará confirmación al nuevo correo" (el cambio vía API de admin es directo, sin correo) y "La secretaria no podrá iniciar sesión mientras esté inactiva" (falso, hallazgo ya confirmado). | `admin-secretarias-editar-drawer.component.ts:227-230,271-275`; `update-secretary/index.ts:134-137,148-155` |
| S14 | 🟡 Baja | **"Último acceso" no es el último acceso.** Muestra `users.updated_at` (última vez que se editó la fila), no el último login. | `secretarias.facade.ts:267`; `admin-secretarias-ver-drawer.component.ts:143-159` |
| S15 | 🟡 Baja | **Ficha del instructor:** el botón "Ver clases activas (N)" no tiene acción; "Clases activas" cuenta solo clases *en curso* hoy, con un rango de fecha sin zona horaria (casi siempre 0). | `admin-instructor-ver-drawer.component.ts:334-340`; `instructores.facade.ts:310-330` |
| S16 | 🟡 Baja | **Horas trabajadas sin filtro de sede** (depende de la RLS de `instructor_monthly_hours`): los instructores que no están en la lista cargada salen como "Instructor #id". Un error se ve como "Sin clases registradas". El mes elegido queda guardado entre aperturas. | `instructores.facade.ts:145-146,447-485` |
| S17 | 🟡 Baja | **`/app/admin/usuarios` es un placeholder** ("PLANO · Pendiente calcar desde mockup") y se llega a él desde "Actividad reciente" del dashboard. | `admin-usuarios.component.ts:8-25`; `recent-activity-drawer.component.ts:183-184` |
| S18 | 🟡 Baja | **Sin auditoría de cambios de instructor.** Solo `users` tiene trigger de auditoría; cambios en `instructors` (licencia, tipo, "Ambas", activo), `vehicle_assignments` y `branch_payroll_config` (tarifa) no quedan en el log. | `20260301000008_08_misc_and_triggers.sql:259-260` (lista de `trg_audit_*`: no incluye esas tablas) |
| S19 | 🟡 Baja | **Error de carga invisible y sin guard de orden.** Las listas guardan el error pero muestran "No hay instructores que coincidan con los filtros." / "No hay registros…". Ningún facade usa `createRequestGuard()`: un cambio rápido de sede puede terminar mostrando la sede anterior. | `admin-instructores.component.ts:163-175`; `instructores.facade.ts:260-307`; `secretarias.facade.ts:141-179` |
| S20 | 🟡 Baja | **Editar instructor acepta licencia vencida** (Crear la bloquea) y marca "Número de licencia *" sin validarlo; Crear ni siquiera lo pide (manda vacío). | `admin-instructor-editar-drawer.component.ts:275-287,635-643`; `admin-instructor-crear-drawer.component.ts:649` |
| S21 | 🟡 Baja | **Filtros de Secretarias sin "volver a Todas"** (los select no tienen botón de limpiar) y KPI "Sedes con personal" siempre 1 con una sede elegida en el topbar. | `admin-secretarias.component.ts:148-169`; `secretarias.facade.ts:103-108` |
| S22 | 🟡 Baja | **Tarifa por hora:** el input acepta decimales pero la columna es `INTEGER` (error crudo de Postgres en el toast); acepta 0. | `tarifa-instructores-drawer.component.ts:119-127`; `20260907120000_branch_payroll_config.sql:17` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (entorno de pruebas, idealmente seed de spec `0008-i` + ajustes). Para
la invitación/activación hace falta un **correo real de pruebas o el inbox local de Supabase
(Mailpit/Inbucket)**. Anotar acá el nombre/RUT/correo real usado.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Instructor práctico sede A, activo, con vehículo de sede A, licencia vigente, con clases futuras agendadas | Caso normal, desactivar con clases | |
| D2 | Instructor sede B "Ambas sedes" con vehículo "Ambas" | Pickers de las 2 sedes | |
| D3 | Instructor "Ambas" con vehículo solo de sede A | Advertencia AC-E1 de `0004-m` | |
| D4 | Instructor con licencia que vence en ≤ 30 días | "Por vencer" | |
| D5 | Instructor con `license_expiry` ya pasada pero `license_status = 'valid'` (licencia que venció después de su última edición) | S7 | |
| D6 | Instructor sin vehículo asignado | S8 | |
| D7 | Instructor inactivo | Filtros, agenda | |
| D8 | Instructor creado que nunca activó su cuenta (`first_login = true`) y otro insertado sin cuenta Auth (`supabase_uid` nulo) | Reenviar invitación (fix-168/169-m) | |
| D9 | Instructor teórico (`type = 'theory'`) | No debe salir en pickers de práctica | |
| D10 | Un correo ya usado por un alumno y un RUT ya usado por un alumno | Duplicados | |
| D11 | Correo que existe en `users` pero NO en Auth (alumno pre-inscrito o de seed) | S5 | |
| D12 | Secretaria sede A sin grant, secretaria sede B, secretaria con grant | Sedes y grant | |
| D13 | Secretaria sin apellido materno (creada por SQL) | S12 | |
| D14 | Secretaria sin sede asignada (`branch_id` nulo) | AC-E1 de `0017-b` | |
| D15 | Nombres con tilde/ñ y muy largos | Diseño y búsqueda | |
| D16 | Vehículos libres de sede A, de sede B y "Ambas"; uno en mantención | Picker de vehículo | |

**Cuentas:** admin; secretaria sede A (sin grant); secretaria sede B; secretaria con grant
multi-sede; secretaria sin sede (D14); **cuentas "víctima" de prueba** para la sección R: un admin
secundario de pruebas, un alumno y un instructor de pruebas cuyos correos puedas controlar. Para
los casos de 2 sesiones usa **2 navegadores o perfiles distintos** (2 pestañas del mismo comparten
la sesión y el `localStorage`, ver `UAT-PLAN.md:146`).

---

## 3. Casos

### A. Acceso y navegación

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin → menú lateral → Instructores | Abre `/app/admin/instructores`: skeleton → tabla. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria → menú lateral → Instructores | Abre `/app/secretaria/instructores`, solo instructores de su sede + los "Ambas" | ✓ | |
| A03 | Admin → menú lateral → Secretarias | Abre `/app/admin/secretarias` | ✓ | |
| A04 | Secretaria escribe la URL `/app/admin/secretarias` e `/app/admin/instructores` | Acceso denegado | ✓ | |
| A05 | Menú lateral de admin | No hay entrada "Usuarios" (ver sección O) | — | |
| A06 | Salir de Instructores y volver | Datos al instante, sin skeleton (refresco en segundo plano) | — | |
| A07 | F5 en cada pantalla | Carga normal | ✓ | |
| A08 | Carga con la red cortada | Mensaje de error claro, no "No hay instructores que coincidan con los filtros." (S19) | — | |
| A09 | Carga con red lenta (Slow 3G) | Skeleton con la forma de la tabla final, sin saltos | — | |

### B. Lista de instructores

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Columnas (admin con una sede) | Nombre + email, RUT, Licencia, Vehículo, Clases activas, Estado, Acciones; sin columna Sede | ✓ | |
| B02 | Admin con "Todas las sedes" | Aparece la columna Sede (nombre o "Ambas"); no existe columna "Tipo" (AC7 `0004-m`) | ✓ | |
| B03 | Secretaria | Nunca ve columna Sede | ✓ | |
| B04 | Pill "Todos (N)" | N = total de filas | ✓ | |
| B05 | Pill "Activos (N)" | Solo D1, D2… activos; D7 no | ✓ | |
| B06 | Pill "Licencia por vencer (N)" | Solo D4. D5 (vencida sin actualizar) ¿aparece? (S7). Las ya vencidas no entran en este filtro — confirmar si es lo deseado | ✓ | |
| B07 | Licencia vencida sin editar **(§4)** | D5 debe verse "Vencida" (S7) | — | |
| B08 | Badge de licencia | Colores Vigente/Por vencer/Vencida; "Vence:" con la fecha — ¿formato AAAA-MM-DD es aceptable? | — | |
| B09 | Vehículo | Patente + modelo; D6 "Sin asignar" | ✓ | |
| B10 | Estado de un instructor con `instructors.active = true` pero `users.active = false` | Sale "Inactivo" (así está programado) | — | |
| B11 | Clic en el email | Abre el cliente de correo (`mailto:`) | — | |
| B12 | Orden | Del registrado más recientemente al más antiguo | — | |
| B13 | Búsqueda | No existe buscador en Instructores — confirmar que es aceptable | — | |
| B14 | Nombre largo (D15) | No rompe la fila | — | |
| B15 | Sin instructores en la sede | "No hay instructores que coincidan con los filtros." | — | |

### C. Crear instructor (admin)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | "Nuevo Instructor" | Drawer "Crear instructor Clase B" con secciones Información Personal, Licencia Clase B, Documentos, Asignación | ✓ | |
| C02 | Clic en "Crear instructor" con todo vacío | Todos los campos marcados con su error; no llama a la función | ✓ | |
| C03 | Alta completa con vehículo → aparece en agenda **(§4)** | Toast "Instructor creado", aparece en la lista y en el picker/disponibilidad de agenda de su sede | ✓ | |
| C04 | Alta sin vehículo **(§4)** | Se crea; ¿aparece para agendar? (S8) | — | |
| C05 | RUT: escribir sin puntos y salir del campo | Se formatea y autocompleta el DV; "RUT válido" | ✓ | |
| C06 | Email ya usado por otro usuario **(§4)** | Mensaje claro "Ya existe un usuario con ese correo" (S6) | ✓ | |
| C07 | RUT ya usado por un alumno (D10) **(§4)** | Mensaje claro; no queda cuenta Auth huérfana | ✓ | |
| C08 | Correo con mayúsculas | Se guarda en minúsculas | — | |
| C09 | Teléfono con menos de 8 dígitos | Error "Ingresa un teléfono válido…" | ✓ | |
| C10 | Nombre / apellidos de 1 letra | Error "mínimo 2 caracteres" | ✓ | |
| C11 | Sin apellido materno (extranjero) | Hoy no deja crear (S12) — decisión | — | |
| C12 | Fecha de vencimiento en ≤ 30 días | Aviso "Por vencer: menos de 30 días"; se puede crear | ✓ | |
| C13 | Fecha de vencimiento pasada | Aviso "Vencida: no se puede registrar"; el botón no crea | ✓ | |
| C14 | Fecha de vencimiento = hoy | ¿Vigente o vencida? Anotar | — | |
| C15 | Sin tipo de instructor | "Selecciona el tipo de instructor." | ✓ | |
| C16 | Tipo "Teórico" | Se crea; no debe aparecer en pickers de práctica (ver J04) | — | |
| C17 | Sede: admin con "Todas" en el topbar | Aparece el selector de sede/Ambas; obligatorio | ✓ | |
| C18 | Sede: admin con una sede en el topbar | La sede viene precargada con la del topbar | — | |
| C19 | Picker de vehículo | Solo vehículos disponibles de la sede elegida o "Ambas"; nunca uno en mantención ni asignado a otro (AC6 `0004-m`) | ✓ | |
| C20 | Cambiar la sede después de elegir vehículo | ¿El vehículo elegido de la sede anterior queda seleccionado aunque ya no esté en la lista? | — | |
| C21 | Adjuntar documento: tipo + archivo PDF válido | Aparece en la lista de adjuntos; el tipo desaparece del selector | ✓ | |
| C22 | Adjuntar archivo .docx o > 5 MB | "Solo se permiten archivos PDF, JPG, PNG o WEBP." / "El archivo no puede superar los 5 MB." | ✓ | |
| C23 | Quitar un adjunto | Se quita y el tipo vuelve al selector | — | |
| C24 | Alta con 2 documentos | Ambos quedan en la ficha de documentos del instructor, estado "pendiente" (cruce con 033) | — | |
| C25 | Falla la subida de un documento (cortar la red justo después de crear) | Toast "No se pudo subir un documento… puedes reintentarlo desde la ficha"; el instructor queda creado | — | |
| C26 | Doble clic en "Crear instructor" | Un solo instructor; botón deshabilitado con "Creando…" sin cambiar de ancho | ✓ | |
| C27 | Cancelar / cerrar el drawer con datos | Se cierra sin crear — ¿avisa que se pierde lo escrito? | — | |
| C28 | Correo de invitación | Llega "Activa tu cuenta de instructor" al correo (Mailpit) | — | |
| C29 | Falla el envío del correo (SMTP mal configurado en pruebas) | El instructor queda creado y el admin **no recibe ningún aviso** de que el correo no salió — confirmar si es aceptable | — | |

### D. Crear instructor (secretaria)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Secretaria sin grant crea un instructor **(§4)** | Se crea en SU sede (AC2 `0004-m`). Hoy probable que el botón no haga nada (S3) | ✓ | |
| D02 | Secretaria en un PC donde antes estuvo el admin con otra sede **(§4)** | El instructor queda en la sede de la secretaria, nunca en la del admin (S3) | — | |
| D03 | Opción "Ambas sedes" | No está disponible para la secretaria (AC2 `0004-m`) | ✓ | |
| D04 | Secretaria con grant, topbar en sede B | ¿En qué sede queda el instructor? ¿Puede elegir? — decisión | — | |
| D05 | Secretaria con grant, topbar en "Todas" | ¿Puede crear? (hoy no ve selector de sede) | — | |

### E. Editar instructor

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Lápiz en la fila / "Editar perfil" desde Ver | Drawer con los datos actuales precargados | ✓ | |
| E02 | RUT | Deshabilitado, "El RUT no puede ser modificado" | ✓ | |
| E03 | Cambiar nombre y teléfono | Toast "Instructor actualizado"; la lista lo refleja sin recargar | ✓ | |
| E04 | Email a uno ya usado por otro usuario **(§4)** | "Ya existe otro usuario registrado con ese correo electrónico." y **Auth sin cambios** (S5) | ✓ | |
| E05 | Email a uno nuevo y libre **(§4)** | Aviso "Se actualizará el acceso…"; el instructor entra con el correo nuevo y no con el viejo | — | |
| E06 | Email con mayúsculas y espacios | Se guarda limpio en minúsculas; no lo toma como cambio si solo difiere en mayúsculas | — | |
| E07 | Fecha de vencimiento pasada | Hoy deja guardar "Vencida" (S20) — decisión | — | |
| E08 | Número de licencia vacío (marcado con *) | Hoy guarda igual (S20) | — | |
| E09 | Cambiar el vehículo | Aviso de nuevo historial; al guardar, el historial muestra el anterior con fecha de término y el nuevo "→ Actual" | ✓ | |
| E10 | Quitar el vehículo (X del select) | La asignación queda cerrada; el vehículo vuelve a estar disponible en otros pickers | — | |
| E11 | Picker de vehículo al editar | Disponibles + el actual, solo de su sede o "Ambas" | ✓ | |
| E12 | Admin cambia la sede del instructor | Se guarda; desaparece de la lista de la sede anterior | — | |
| E13 | Admin cambia la sede de un instructor con clases futuras en la sede anterior | ¿Qué pasa con esas clases? — decisión | — | |
| E14 | Secretaria edita un instructor de su sede | Puede; no ve selector de sede ni "Ambas" (AC3 `0004-m`) | ✓ | |
| E15 | Secretaria edita un instructor "Ambas" de la otra sede (D2) | Puede editar datos; "Ambas" y sede no cambian (AC3 `0004-m`) | ✓ | |
| E16 | Guardar sin cambios | No rompe; ¿vuelve a crear una asignación de vehículo? (no debería) | — | |
| E17 | Falla de red al guardar | Toast de error; el drawer queda abierto con lo escrito | — | |
| E18 | "Ver y subir documentos" | Abre el drawer de documentos del instructor correcto (cruce con 033) | ✓ | |
| E19 | Cancelar | Se cierra sin guardar | — | |

### F. Desactivar / reactivar instructor

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Desactivar a D1 (con clases futuras y vehículo) **(§4)** | Aviso de clases futuras; no aparece en agenda para nuevas clases; decisión sobre sus clases y su vehículo (S9) | — | |
| F02 | Texto al marcar "Inactivo" | "Desactivar este instructor impedirá nuevas asignaciones de clases." | ✓ | |
| F03 | Instructor inactivo en la lista | Estado "Inactivo"; fuera del conteo "Activos" | ✓ | |
| F04 | Reactivar | Vuelve a los pickers de agenda | ✓ | |
| F05 | Historial | Sus clases pasadas, liquidaciones y asistencia siguen visibles con su nombre | — | |
| F06 | Secretaria desactiva un instructor | ¿Debe poder? (hoy puede) — decisión | — | |
| F07 | Instructor desactivado intenta entrar | En el piloto su portal está bloqueado igual; anotar qué ve (cruce con 022) | — | |

### G. "Ambas sedes" y vehículo

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | D2 en los pickers de agenda de las 2 sedes **(§4)** | Aparece en ambas (fix-028-i) | ✓ | |
| G02 | D2 en la lista de Instructores de la secretaria de la otra sede | Aparece (AC3 `0004-m`) | ✓ | |
| G03 | D3: instructor "Ambas" con vehículo de una sola sede **(§4)** | Advertencia "Este instructor no podrá dictar clases en…"; no genera disponibilidad en la sede no cubierta (AC-E1) | — | |
| G04 | D2 con clase el lunes 8:30 en sede A; buscar el mismo horario desde sede B | Slot ocupado (AC4 `0004-m`) | — | |
| G05 | Admin quita "Ambas" a D2 | Desaparece de la lista/pickers de la otra sede | — | |
| G06 | Admin "Todas las sedes": columna Sede de D2 | "Ambas" | ✓ | |

### H. Invitación y activación del instructor (fix-168/169-m)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Editar a D8 (nunca activó) | Banner "Este instructor todavía no tiene cuenta activada…" + "Reenviar invitación" | ✓ | |
| H02 | Reenviar invitación **(§4)** | Toast "Invitación enviada correctamente."; llega el correo | — | |
| H03 | Reenviar con el correo editado sin guardar **(§4)** | Mensaje claro, o que use el correo guardado (S10) | — | |
| H04 | D8 sin cuenta Auth (`supabase_uid` nulo) | Crea la cuenta, vincula `supabase_uid` y envía el correo (fix-169-m) | — | |
| H05 | Instructor que ya activó | No aparece el banner; si se fuerza la llamada: 409 "Este instructor ya activó su cuenta." | — | |
| H06 | Clic en el link del correo durante el piloto | ¿Qué ve el instructor? (portal bloqueado → "Módulo no disponible"). Decisión: ¿se deben mandar invitaciones durante el piloto? | — | |
| H07 | Reenviar 2 veces seguidas | El primer link, ¿sigue sirviendo o queda invalidado? Anotar | — | |
| H08 | Falla el SMTP | Toast de error claro (hoy genérico, S6) | — | |

### I. Ver ficha, horario y horas trabajadas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Ojo en la fila | "Detalle de Instructor": iniciales, nombre, "Instructor práctico/teórico/ambos", estado | ✓ | |
| I02 | Datos | RUT, email, teléfono (si hay), tipo, fecha de registro, licencia, vehículo actual y fecha de asignación | ✓ | |
| I03 | "Clases activas" con una clase en curso ahora | Cuenta 1; sin clases en curso cuenta 0 — ¿es lo que debe medir? (S15) | — | |
| I04 | "Ver clases activas (N)" | Hoy no hace nada (S15) | — | |
| I05 | Historial de vehículos | Coincide con las asignaciones reales, más reciente arriba | — | |
| I06 | "Ver horario" | Próximas clases agendadas agrupadas por día, con alumno, patente y Nº de clase | ✓ | |
| I07 | Horario de un instructor sin clases | "Sin clases agendadas" | — | |
| I08 | Horario con > 60 clases futuras | Solo muestra 60 — ¿aceptable? | — | |
| I09 | "Ver documentos" | Abre el drawer de documentos (cruce con 033) | ✓ | |
| I10 | "Horas trabajadas" | Mes actual, "Mes actual", flecha siguiente deshabilitada | ✓ | |
| I11 | Mes anterior | Carga ese mes; totales de clases y horas equivalentes cuadran con la suma de filas | ✓ | |
| I12 | Horas vs Liquidaciones del mismo mes | Mismas horas equivalentes por instructor (cruce con 029) | — | |
| I13 | Secretaria abre Horas trabajadas | Solo instructores de su sede; ninguno como "Instructor #id" (S16) | — | |
| I14 | Cerrar y reabrir Horas trabajadas después de ir a un mes anterior | ¿Vuelve al mes actual? (S16) | — | |

### J. El instructor en la agenda (cruce con 026)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Instructor nuevo con vehículo | Aparece en el picker y en la disponibilidad de su sede (ver C03) | ✓ | |
| J02 | Instructor nuevo sin vehículo (D6) | ¿Aparece para agendar? (S8) | — | |
| J03 | Instructor inactivo (D7) | No aparece | ✓ | |
| J04 | Instructor teórico (D9) | No aparece en pickers de práctica | ✓ | |
| J05 | Instructor con licencia vencida (D5) | No debería ofrecerse para agendar (S7) — decisión | — | |

### K. Lista de secretarias (admin)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | KPIs del hero | Total, Sedes con personal, Cuentas Activas, Inactivas cuadran con la lista | ✓ | |
| K02 | Admin elige una sede en el topbar | Solo secretarias de esa sede; "Sedes con personal" = 1 (S21) | ✓ | |
| K03 | Buscar por nombre, apellido y email | Encuentra (también sin tildes) | ✓ | |
| K04 | Filtro Sede y filtro Estado | Solo las que corresponden | ✓ | |
| K05 | Volver un filtro a "todas" | Hoy no hay forma sin recargar (S21) | — | |
| K06 | Sin resultados | "No hay registros que coincidan con los filtros." | ✓ | |
| K07 | Fila | Iniciales, nombre, badge Activa/Inactiva, email, sede | ✓ | |
| K08 | Secretaria con grant | ¿Se distingue en la lista? (hoy solo en el detalle) | — | |
| K09 | Pantalla angosta: "Cargar más" | Suma de a 10; al filtrar vuelve a 10 | — | |
| K10 | Panel de Control → "Explorar Auditoría" | Navega a `/app/admin/auditoria` | ✓ | |
| K11 | Ojo → detalle | RUT, Sede, "Acceso a sedes", teléfono, Alias, "Último acceso" | ✓ | |
| K12 | "Último acceso" después de que la secretaria entra sin que nadie edite su ficha | Hoy no cambia (S14) | — | |
| K13 | "Editar secretaria" desde el detalle | Abre el drawer de edición con sus datos | ✓ | |

### L. Crear secretaria

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Alta completa → primer ingreso **(§4)** | Se crea, aparece en la lista, y la secretaria puede entrar con la clave que corresponda y se le exige cambiarla | ✓ | |
| L02 | Todo vacío | Errores en cada campo | ✓ | |
| L03 | RUT inválido / DV autocompletado | Igual que en instructor (C05) | ✓ | |
| L04 | Email ya usado por otro usuario **(§4)** | Mensaje claro (S6); no queda cuenta Auth huérfana | ✓ | |
| L05 | RUT ya usado (D10) | Mensaje claro; no queda cuenta Auth huérfana | — | |
| L06 | Sin apellido materno | Hoy no deja (S12) — decisión | — | |
| L07 | Admin con una sede en el topbar | Sede bloqueada con "Sede fijada por el selector de la barra superior…" | ✓ | |
| L08 | Admin con "Todas" | Sede obligatoria para elegir | ✓ | |
| L09 | "Todas las sedes" en Acceso a sedes | Texto "Podrá ver y operar en todas las sedes…"; se guarda con el grant | ✓ | |
| L10 | ¿Cómo sabe el admin cuál es la clave inicial? | Hoy en ninguna parte (S11) — decisión | — | |
| L11 | Doble clic en crear | Una sola secretaria | ✓ | |

### M. Editar y desactivar secretaria

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Editar nombre/teléfono | Toast "Secretaria actualizada"; lista actualizada | ✓ | |
| M02 | Cambiar el email **(§4)** | Entra con el nuevo, no con el viejo; ¿llega un correo de confirmación como dice el aviso? (S13) | — | |
| M03 | Email a uno usado | Mensaje claro; Auth sin cambios (S5, S6) | ✓ | |
| M04 | Cambiar la sede de una secretaria sin grant **(§4)** | En su sesión abierta pasa a ver la sede nueva | — | |
| M05 | Desactivar con la secretaria logueada **(§4)** | Según el texto "no podrá iniciar sesión…" — hallazgo ya conocido: sigue entrando | — | |
| M06 | Reactivar | Vuelve a "Activa" | ✓ | |
| M07 | Editar D13 (sin apellido materno) | Hoy no se puede guardar ni desactivar (S12) | — | |
| M08 | Historial de una secretaria desactivada | Sus pagos, matrículas y cuadraturas siguen mostrando su nombre | — | |
| M09 | Falla de red al guardar | Toast de error (hoy genérico, S6) | — | |

### N. Grant multi-sede (spec 0017-b)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Otorgar el grant con la secretaria logueada **(§4)** | Aparece el selector de sede sin recargar (AC-E3) | — | |
| N02 | Revocar con la secretaria en "Todas" **(§4)** | El selector desaparece y los datos se acotan a su sede sin recargar (AC-E3) | — | |
| N03 | Secretaria sin grant | Sin selector de sede en el topbar (AC5) | ✓ | |
| N04 | Secretaria con grant: A / B / Todas | Datos filtrados igual que un admin (AC2) en Alumnos, Instructores, Pagos… | — | |
| N05 | Secretaria con grant en "Todas": Instructores | ¿Muestra la columna Sede? (hoy solo admin) | — | |
| N06 | Secretaria sin sede (D14) | No ve datos de ninguna sede (AC-E1) | ✓ | |
| N07 | Grant en auditoría | Queda en el log: admin, secretaria, valor nuevo (AC6) | — | |
| N08 | Secretaria con grant revocado recarga (F5) | Sigue anclada a su sede | ✓ | |

### O. Usuarios (`/app/admin/usuarios`)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Admin entra por URL | Hoy muestra un placeholder "PLANO · Pendiente calcar desde mockup" (S17) — decisión: ocultar en el piloto | ✓ | |
| O02 | Dashboard → Actividad reciente → actividad sobre `users` | Lleva a ese placeholder (S17) | — | |
| O03 | Secretaria por URL | Acceso denegado | ✓ | |
| O04 | ¿Dónde hace el admin un reset de contraseña de otro usuario? | No existe en la app — decisión (ver §5) | — | |

### P. Mi perfil y contraseña propia (drawer Ajustes)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Abrir Ajustes → Mi Perfil (admin y secretaria) | Nombre, rol, email, Sede, Estado "Activo" | ✓ | |
| P02 | Cambiar contraseña **(§4)** | Toast "Contraseña actualizada correctamente."; entra con la nueva y no con la vieja | ✓ | |
| P03 | Contraseñas distintas / menos de 6 caracteres | Botón deshabilitado | ✓ | |
| P04 | No pide la contraseña actual | Confirmar si es aceptable (una sesión abierta ajena podría cambiarla) | — | |
| P05 | Nueva contraseña = el RUT | ¿Se acepta? | — | |
| P06 | Los datos propios (nombre, teléfono) | No se pueden editar desde el perfil — confirmar | — | |
| P07 | Secretaria: tab Seguridad | No aparece | ✓ | |

### Q. Tarifa por hora de instructores (spec 0014-m)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Admin → Ajustes → Tarifa Instructores | Una fila por sede con "Actual: $X / hora" | ✓ | |
| Q02 | Cambiar y guardar | Toast "Tarifa por hora actualizada correctamente."; el "Actual" cambia | ✓ | |
| Q03 | Botón Guardar sin cambios / campo vacío / negativo | Deshabilitado (AC-E2) | ✓ | |
| Q04 | Decimal (5000,5) | Mensaje claro, no error crudo de BD (S22) | — | |
| Q05 | Tarifa 0 | Hoy se acepta — decisión | — | |
| Q06 | Liquidaciones después del cambio | Usan la tarifa nueva (AC3–AC5, cruce con 029) | — | |
| Q07 | Secretaria abre Ajustes | No ve la sección (AC7) | ✓ | |
| Q08 | Auditoría del cambio de tarifa | Hoy no queda registro (S18) — decisión | — | |

### R. Seguridad (secretaria contra acciones de admin)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | Secretaria cambia el email de un admin con `update-instructor` **(§4)** | 403 o error, **nunca** cambio (S1) | ✓ | |
| R02 | Secretaria edita un instructor de otra sede con `update-instructor` **(§4)** | Rechazo (S1) | ✓ | |
| R03 | Secretaria se otorga el grant por la API **(§4)** | Rechazo por RLS (S2) | ✓ | |
| R04 | Secretaria cambia el rol de un alumno por la API **(§4)** | Rechazo por RLS (S2) | ✓ | |
| R05 | Secretaria crea un instructor en la otra sede con `create-instructor` **(§4)** | Queda en su sede o rechazo (S4) | ✓ | |
| R06 | Secretaria llama `create-secretary` y `update-secretary` **(§4)** | 403 "Solo los administradores…" | ✓ | |
| R07 | Secretaria escribe en `branch_payroll_config` por la API **(§4)** | Rechazo por RLS (AC6 `0014-m`) | ✓ | |
| R08 | Secretaria manda `bothBranches: true` a `create-instructor` / `update-instructor` | Se ignora: queda `false` / sin cambio | ✓ | |
| R09 | Instructor (o alumno) con sesión llama `create-instructor` | 403 | ✓ | |
| R10 | Llamada sin sesión (sin `Authorization`) | 401 "No autorizado" | ✓ | |
| R11 | Secretaria lee `users` de otra sede por la API | Hoy la RLS le deja leer todos los usuarios (decisión de fix-002). Anotar qué columnas ve (RUT, teléfono) — decisión | — | |
| R12 | Secretaria reenvía la invitación de un instructor de otra sede con `activate-instructor-account` | ¿Debe poder? (S4) | — | |

### T. Auditoría

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| T01 | Crear instructor / secretaria | Entrada en Auditoría con el admin (o secretaria) que lo hizo, fecha y sede | — | |
| T02 | Editar email, activo o sede de una secretaria | Queda el antes/después | — | |
| T03 | Cambiar licencia, tipo o "Ambas" de un instructor | Hoy no queda registro (S18) | — | |
| T04 | Cambiar el vehículo asignado | ¿Queda registro? (S18) | — | |

### V. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| V01 | Modo oscuro y claro en las 3 pantallas y sus drawers | Todo legible, incluidos badges de licencia y avisos | ✓ | |
| V02 | 375 / 768 / 1440 px | Sin scroll horizontal; Instructores cambia a tarjetas bajo 850 px de contenedor | ✓ | |
| V03 | Desktop | Las listas scrollean por dentro; el documento no (app-like) | ✓ | |
| V04 | Tarjeta de instructor | Mismos datos que la fila; botones ver/editar funcionan | ✓ | |
| V05 | "Cargar más" en tarjetas de instructores | Suma de a 6; al cambiar de pill vuelve a 6 | — | |
| V06 | Drawer abierto en desktop | La lista pasa a modo compacto sin romperse | — | |
| V07 | Solo teclado | Se llega a todos los botones, pills y selects; el foco se ve | — | |
| V08 | Tooltips / `aria-label` | Presentes en botones de solo ícono | — | |

---

## 4. Casos con pasos numerados

### B07 — Licencia que venció sin que nadie editara al instructor (S7)

**Precondición:** D5. Si no existe, en el entorno de pruebas deja un instructor con
`license_expiry` = ayer y `license_status = 'valid'` (así queda uno cuya licencia venció después
de su última edición).
1. Abrir Instructores y buscar D5.
2. Mirar el badge de licencia y el pill "Licencia por vencer (N)".
3. Abrir su detalle (ojo).
4. Ir a Agenda de su sede y buscar disponibilidad con ese instructor.

**Esperado:** en 2 y 3 "Vencida"; en 4 no se ofrece para agendar. Si sale "Vigente" o se puede
agendar, S7 confirmada. **Evidencia:** captura de 2 y 4.

### C03 — Alta completa y el instructor aparece en la agenda

**Precondición:** admin con la sede A en el topbar; un vehículo libre de la sede A.
1. Instructores → "Nuevo Instructor".
2. Completar nombres, 2 apellidos, RUT válido, correo de pruebas (Mailpit), teléfono.
3. Fecha de vencimiento a más de 30 días → verificar "Vigente".
4. Tipo = Práctico; Vehículo = el libre de la sede A.
5. "Crear instructor" → verificar "Creando…" y luego el toast "Instructor creado".
6. Verificar que aparece en la lista, con el vehículo y estado "Activo".
7. Revisar Mailpit: llega "Activa tu cuenta de instructor".
8. Ir a Agenda (sede A) → verificar que aparece en el picker de instructores y que tiene
   horarios disponibles.
9. Volver a Crear instructor → verificar que ese vehículo ya no aparece como disponible.

**Esperado:** todo lo anterior. **Evidencia:** captura del paso 8.

### C04 — Alta sin vehículo (S8)

1. Crear un instructor igual que C03 pero dejando "Vehículo asignado" vacío.
2. Ir a Agenda de su sede.
3. Verificar si aparece en el picker y si tiene horarios disponibles.

**Esperado:** si no se le puede agendar ninguna clase, el drawer de creación debería avisarlo (o
exigir vehículo). Anotar el comportamiento para la decisión de §5.

### C06 — Email duplicado al crear

**Precondición:** D10 (correo ya usado por un alumno).
1. Crear instructor con todos los datos válidos y ese correo.
2. Clic en "Crear instructor".
3. Anotar el texto exacto del toast.
4. Abrir DevTools → Network → la petición `create-instructor` → anotar status y body.
5. Verificar en la lista que no apareció el instructor.

**Esperado:** toast "Ya existe un usuario con ese correo electrónico" (o equivalente claro). Si
dice "Ha ocurrido un error inesperado…", S6 confirmada; si el status es 500 en vez de 409, anotar
el mensaje del body (chequeo `already registered`).

### C07 — RUT duplicado al crear

**Precondición:** D10 (RUT ya usado por un alumno); correo nuevo y libre.
1. Crear instructor con ese RUT y el correo libre.
2. Anotar el toast y el body de la respuesta en Network.
3. En Supabase (Studio del entorno de pruebas) → Authentication, buscar el correo libre.

**Esperado:** mensaje claro de RUT duplicado y **el correo no existe en Auth** (la función hace
rollback). Si el correo quedó en Auth, hay una cuenta huérfana que bloqueará un nuevo intento.

### D01 — La secretaria crea un instructor (S3)

**Precondición:** navegador limpio (o después de "Cerrar sesión" de otro usuario); sesión de
secretaria de la sede A sin grant.
1. Instructores → "Nuevo Instructor".
2. Verificar si hay algún campo de sede (no debería haberlo).
3. Completar todos los campos visibles de forma válida.
4. Clic en "Crear instructor".
5. Anotar qué pasa (toast, errores visibles, petición en Network).
6. Si se creó: verificar que aparece en su lista y, con sesión de admin y "Todas", que su Sede es A.

**Esperado:** se crea en la sede A. Si el botón no hace nada y no hay petición en Network, S3
confirmada → **bloquea el alta de instructores por secretarias en el piloto**.

### D02 — PC compartido: la sede que dejó otro usuario

1. En un navegador, entrar como admin y elegir la **sede B** en el topbar.
2. Cerrar la pestaña **sin** usar "Cerrar sesión" (y, si la sesión sigue viva, borrar solo la
   sesión desde el login/otra ventana sin tocar el `localStorage`).
3. En el mismo navegador, entrar como secretaria de la sede A.
4. Crear un instructor como en D01.
5. Con sesión de admin, "Todas", revisar la Sede del instructor nuevo.

**Esperado:** Sede = A. Si quedó en B (y no aparece en la lista de la secretaria), S3 confirmada.

### E04 — Email duplicado al editar, sin desincronizar Auth (S5)

**Precondición:** D1 y D11 (correo que existe en `users` pero no en Auth). Anotar el correo actual
de D1.
1. Editar D1 → poner el correo de D11 → "Guardar cambios".
2. Anotar el toast (debería ser "Ya existe otro usuario registrado con ese correo electrónico.").
3. En Studio → Authentication, buscar el usuario de D1 y anotar su correo en Auth.
4. En Studio → tabla `users`, anotar el correo de D1.
5. Repetir con un correo que sí existe en Auth (el de un alumno con cuenta).

**Esperado:** en ambos intentos, Auth y `users` conservan el correo original de D1. Si en el paso
3 Auth tiene el correo de D11 y `users` el original, S5 confirmada → **P0**: D1 no podrá entrar.
**Evidencia:** capturas de 3 y 4.

### E05 — Cambio de email correcto

**Precondición:** instructor de pruebas que ya activó su cuenta y cuya clave conoces.
1. Editar → correo nuevo y libre → verificar el aviso "Se actualizará el acceso…" → guardar.
2. Cerrar sesión e intentar entrar con el correo viejo.
3. Entrar con el correo nuevo y la misma clave.

**Esperado:** 2 falla, 3 entra (en el piloto llegará a "Módulo no disponible", lo que igual prueba
que la autenticación funcionó).

### F01 — Desactivar un instructor con clases futuras (S9)

**Precondición:** D1 con al menos 1 clase futura agendada y vehículo asignado. Anotar la patente.
1. Editar D1 → "Inactivo" → verificar el aviso → "Guardar cambios".
2. Ir a Agenda: buscar las clases futuras de D1.
3. Intentar agendar una clase nueva con D1.
4. Crear/editar otro instructor y abrir el picker de vehículo: buscar la patente de D1.

**Esperado:** en 1, idealmente un aviso de que tiene N clases futuras; en 2, anotar qué pasa con
esas clases (siguen con D1, se marcan, etc.); en 3, D1 no aparece; en 4, anotar si el vehículo
quedó libre. Llevar el resultado a la decisión de §5.

### G01 — Instructor "Ambas" en los pickers de las 2 sedes

**Precondición:** D2 (sede principal B, "Ambas", vehículo "Ambas").
1. Admin → topbar sede A → Agenda → picker de instructor: buscar D2.
2. Topbar sede B → lo mismo.
3. Con sesión de secretaria de la sede A → Agenda → picker: buscar D2.
4. Esa secretaria → Instructores: buscar D2.

**Esperado:** D2 aparece en los 4 pasos.

### G03 — "Ambas" con vehículo de una sola sede (AC-E1 de 0004-m)

**Precondición:** admin; un instructor de la sede A con vehículo solo de la sede A.
1. Editar → selector de sede → "Ambas".
2. Verificar la advertencia "Este instructor no podrá dictar clases en <sede B>: su vehículo
   asignado es de <sede A>…".
3. Guardar (la advertencia no bloquea).
4. Agenda sede B → buscar disponibilidad con ese instructor.

**Esperado:** en 4 no tiene horarios en la sede B, pero sí aparece en la sede A.

### H02 — Reenviar invitación

**Precondición:** D8 (creado, nunca activó); Mailpit abierto.
1. Editar D8 → verificar el banner amarillo.
2. "Reenviar invitación" → verificar "Enviando…" y el toast de éxito.
3. En Mailpit, abrir el correo nuevo y copiar el link.
4. Abrir el link en una ventana privada.
5. Repetir 1-2 con el D8 sin cuenta Auth (`supabase_uid` nulo) y verificar después en `users`
   que ya tiene `supabase_uid`.

**Esperado:** correo con el mismo diseño que el de alta; en 4, anotar a dónde llega (en el piloto
se espera "Módulo no disponible"); en 5, cuenta creada y vinculada.

### H03 — Reenviar con el correo editado sin guardar (S10)

1. Editar D8 → cambiar el correo (sin guardar).
2. Clic en "Reenviar invitación".
3. Anotar el toast y el body de la respuesta.

**Esperado:** o bien un mensaje claro ("guarda primero el correo nuevo"), o bien se envía al
correo guardado. Si el toast es genérico, S6 + S10 confirmadas.

### L01 — Alta de secretaria y primer ingreso (S11)

**Precondición:** admin; RUT válido de prueba (anotar el cuerpo sin DV, por ejemplo 15206231);
correo de pruebas.
1. Secretarias → "Nueva Secretaria" → completar todo, sede A, "Solo su sede" → crear.
2. Verificar el toast, que aparece en la lista como "Activa" y los KPIs.
3. Revisar el correo de pruebas: ¿llegó algo?
4. En una ventana privada, entrar con el correo y como clave el cuerpo del RUT.
5. Si entra: verificar que obliga a cambiar la clave antes de usar la app.
6. Cambiar la clave, entrar a Alumnos B y verificar que solo ve la sede A.
7. Si en 4 no entra, probar con el RUT completo con y sin puntos, y anotar cuál funciona.

**Esperado:** la secretaria puede entrar con una clave que el admin conoce, se le exige cambiarla y
queda anclada a su sede. Anotar en 3 y 7 lo que pasa (UAT: "el login con password por defecto no
funciona").

### L04 — Email duplicado al crear secretaria

1. Crear secretaria con un correo ya usado (instructor, alumno u otra secretaria).
2. Anotar el toast y el body de la respuesta.
3. Studio → Authentication: verificar que no quedó una cuenta extra.

**Esperado:** mensaje claro de correo repetido, sin cuenta huérfana. Si el toast es genérico, S6.

### M02 — Cambiar el correo de una secretaria

**Precondición:** secretaria de pruebas con clave conocida.
1. Editar → correo nuevo → verificar el aviso "Se enviará confirmación al nuevo correo…" → guardar.
2. Revisar el buzón nuevo y el viejo: ¿llegó algún correo?
3. Entrar con el correo nuevo y la misma clave; intentar con el viejo.

**Esperado:** entra solo con el nuevo. Si en 2 no llegó nada, el texto del aviso es engañoso (S13).

### M04 — Cambiar la sede de una secretaria con sesión abierta

**Precondición:** 2 navegadores. Navegador 1: secretaria sede A sin grant en Alumnos B.
Navegador 2: admin.
1. En el 2, editar a esa secretaria → sede B → guardar.
2. En el 1, sin recargar, esperar 5 segundos y mirar Alumnos B; cambiar a otra pantalla y volver.
3. Recargar el 1.

**Esperado:** la lista pasa a la sede B (idealmente en 2, como máximo en 3). Anotar en qué paso.

### M05 — Desactivar una secretaria logueada

**Precondición:** 2 navegadores. Navegador 1: secretaria de pruebas logueada. Navegador 2: admin.
1. En el 2, editar → "Inactiva" → verificar el texto "no podrá iniciar sesión…" → guardar.
2. En el 1, seguir navegando y registrar una acción (por ejemplo, ver Alumnos).
3. En el 1, cerrar sesión y volver a entrar.

**Esperado (regla):** en 2 queda fuera o sin poder operar; en 3 no entra. Hallazgo ya conocido:
hoy sigue entrando → anotar y enlazar al fix existente, no abrir uno duplicado.

### N01 — Otorgar el grant en caliente

**Precondición:** 2 navegadores. 1: secretaria sede A sin grant en Alumnos B. 2: admin.
1. En el 1, verificar que no hay selector de sede.
2. En el 2, editar a la secretaria → "Todas las sedes" → guardar.
3. En el 1, sin recargar, esperar 5 segundos.
4. Elegir la sede B en el selector y luego "Todas".

**Esperado:** en 3 aparece el selector; en 4 los datos cambian igual que para un admin.

### N02 — Revocar el grant en caliente

Continuación de N01, con el 1 en "Todas".
1. En el 2, editar → "Solo su sede" → guardar.
2. En el 1, sin recargar, esperar 5 segundos.

**Esperado:** el selector desaparece y la lista queda solo con la sede A (AC-E3, ya verificado en
`UAT-PLAN.md:146` vía SQL; aquí se verifica desde la pantalla real del admin).

### P02 — Cambiar la contraseña propia

**Precondición:** secretaria de pruebas con clave conocida.
1. Ajustes → Mi Perfil → "Cambiar Contraseña".
2. Escribir una nueva de 5 caracteres → botón deshabilitado.
3. Escribir una válida y una confirmación distinta → deshabilitado.
4. Escribir la misma en los 2 → "Cambiar Contraseña" → toast.
5. Cerrar sesión; entrar con la vieja (falla) y con la nueva (entra).

**Esperado:** lo descrito.

### R01 — Secretaria cambia el correo de un admin (S1)

**Precondición:** entorno de pruebas; sesión de secretaria; admin **secundario de pruebas** con
su `users.id` (desde Studio) y un instructor cualquiera con su `id` de `instructors`.
1. Con la secretaria, editar un instructor de su sede y guardar sin cambios; copiar la petición
   `update-instructor` desde Network ("Copy as fetch").
2. En Console, pegarla cambiando en el body: `userId` = id del admin de pruebas, `email` = un correo
   de pruebas tuyo, `currentEmail` = el correo actual del admin. Ejecutarla.
3. Anotar status y respuesta.
4. En Studio, revisar el correo del admin de pruebas en Auth y en `users`.
5. **Restaurar** el correo original del admin (con el admin principal, o por SQL en pruebas).

**Esperado:** 403/rechazo y ningún cambio. Si el correo del admin cambió, S1 confirmada → **P0
inmediato** (toma de cuenta vía "olvidé mi contraseña").

### R02 — Secretaria edita un instructor de otra sede (S1)

1. Igual que R01 paso 1.
2. En Console, cambiar `instructorId`/`userId` por los de un instructor de la sede B (no "Ambas")
   y `firstNames` por "PRUEBA". Ejecutar.
3. Con admin, revisar ese instructor.

**Esperado:** rechazo. Si su nombre cambió, S1 confirmada. Restaurar el nombre.

### R03 — Secretaria se otorga el grant (S2)

**Precondición:** secretaria de la sede A sin grant; su `users.id`.
1. Con su sesión, copiar cualquier petición a `/rest/v1/…` desde Network ("Copy as fetch").
2. En Console, armar un `PATCH` a `/rest/v1/users?id=eq.<su id>` con el mismo `apikey` y
   `Authorization`, body `{"can_access_both_branches": true}` y header `Prefer: return=representation`.
3. Ejecutarlo y anotar la respuesta.
4. Recargar la app.

**Esperado:** 0 filas actualizadas / error. Si aparece el selector de sede en 4, S2 confirmada →
**P0 inmediato**. Restaurar el valor a `false`.

### R04 — Secretaria cambia el rol de un alumno (S2)

**Precondición:** alumno de pruebas de la sede A (su `users.id`); `id` del rol `secretary` (tabla
`roles`).
1. Como en R03, `PATCH /rest/v1/users?id=eq.<id del alumno>` con `{"role_id": <id secretary>}`.
2. Anotar la respuesta.
3. Entrar con la cuenta del alumno de pruebas.

**Esperado:** rechazo. Si el alumno entra al panel de secretaria, S2 confirmada → **P0**.
Restaurar el `role_id`.

### R05 — Secretaria crea un instructor en la otra sede (S4)

1. Con la secretaria, capturar una petición `create-instructor` (si D01 falló por S3, armarla con
   el body de C03 y el token de la sesión).
2. Cambiar `branchId` por el id de la sede B y el correo/RUT por datos nuevos. Ejecutar.
3. Con admin y "Todas", revisar la Sede del instructor creado.

**Esperado:** queda en la sede A o la función lo rechaza (AC2 `0004-m`). Si queda en B, S4
confirmada. Borrar o desactivar el instructor de prueba.

### R06 — Secretaria llama las funciones de secretarias

1. Con la sesión de secretaria, en Console invocar `create-secretary` con un body completo
   (copiar la estructura de una petición del admin).
2. Invocar `update-secretary` con el `userId` de otra secretaria y `active: false`.

**Esperado:** ambas 403 "Solo los administradores…". Verificar con admin que la otra secretaria
sigue activa.

### R07 — Secretaria escribe la tarifa

1. Con la secretaria, `PATCH /rest/v1/branch_payroll_config?branch_id=eq.<su sede>` con
   `{"amount_per_hour": 1}` (misma técnica que R03).
2. Con admin, abrir Ajustes → Tarifa Instructores.

**Esperado:** rechazo y la tarifa sin cambios (AC6 `0014-m`).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| B06 | ¿"Licencia por vencer" debe incluir las ya vencidas? |
| B13 | ¿Hace falta buscador en Instructores? |
| C04 / J02 | ¿Un instructor práctico puede crearse sin vehículo? Si sí, ¿cómo se le agenda? |
| C11 / L06 / M07 | ¿Se permite personal sin apellido materno? |
| C14 | ¿Una licencia que vence hoy está vigente? |
| C29 | ¿El admin debe enterarse si el correo de invitación no salió? |
| D04 / D05 | ¿En qué sede crea instructores una secretaria con grant? |
| E07 / J05 | ¿Se puede guardar o agendar a un instructor con licencia vencida? |
| E13 | ¿Qué pasa con las clases futuras de un instructor que cambia de sede? |
| F01 | Al desactivar un instructor: ¿qué pasa con sus clases futuras y con su vehículo? |
| F06 | ¿La secretaria puede desactivar instructores? |
| H06 | ¿Se envían invitaciones a instructores durante el piloto, si su portal está bloqueado? |
| L10 | ¿Cómo recibe la secretaria su clave inicial? ¿Clave = RUT o invitación por correo como los instructores? |
| O01 / O04 | ¿Se oculta `/admin/usuarios` en el piloto? ¿Dónde resetea el admin la clave de otro usuario? |
| P04 | ¿Cambiar la contraseña debe pedir la actual? |
| Q05 / Q08 | ¿Se acepta tarifa 0? ¿El cambio de tarifa debe quedar auditado? |
| R11 | ¿La secretaria debe poder leer RUT/teléfono de usuarios de otras sedes? |
| R12 | ¿La secretaria puede reenviar invitaciones a instructores de otra sede? |
| T03 / T04 | ¿Los cambios de licencia, tipo, "Ambas" y vehículo deben quedar en Auditoría? |
