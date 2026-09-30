# Testing — Auditoría y Configuración web

> **Asignación:** `ASG-i-036` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/auditoria`, `/app/admin/configuracion-web`,
> `/app/secretaria/configuracion-web`, `/politica-privacidad/:branchSlug` (pública)
> **Incluye:** log de auditoría (tabla, filtros, paginación, drawer de detalle, exportar
> Excel/PDF), cobertura del trigger `log_change()` (acción en otro módulo → registro), las 6
> pestañas de Configuración web (General & Redes, Hero, Cursos & Precios, Promo, Contacto &
> Horas, FAQs), subida de imágenes/videos al bucket `website-public`, reflejo en la landing
> pública (`webs/`), política de privacidad por sede.
> **No incluye:** publicación de la landing en cPanel (spec `0005-b`, desactivada), el catálogo
> operacional de cursos por dentro (`/app/admin/configuracion-precios`), el widget "Actividad
> reciente" del dashboard (ver `030-dashboards.md`).
>
> **Código leído para armar esta lista:**
> `features/admin/auditoria/{admin-auditoria,audit-log-detail-drawer}.component.ts`,
> `core/facades/auditoria.facade.ts`, `core/models/{dto/audit-log,ui/audit-log-row}.model.ts`,
> `supabase/functions/generate-audit-report/index.ts`,
> `features/admin/configuracion-web/admin-configuracion-web.component.ts` y `tabs/*` (6 pestañas),
> `core/facades/{website-config,courses}.facade.ts`,
> `features/legal/politica-privacidad/politica-privacidad.component.ts`,
> `core/models/ui/privacy-policy.model.ts`, `app.routes.ts`, `core/services/auth/menu-config.service.ts`,
> `webs/src/layouts/LandingLayout.astro`, `webs/src/lib/data/resolveCourses.ts`,
> migraciones: `20260301000008` (triggers originales), `20260301000011` (RLS `audit_log`),
> `20260306120000` (INSERT policy), `20260323110000`, `20260614160000` (triggers agregados),
> `20260614201000` (`audit_log.branch_id`), `20260809100000` (versión vigente de `log_change()`),
> `20260825210000` (secretaria lee sus acciones), `20260522000000` / `20260522010000` /
> `20260525010000` (tabla `website_config`, RLS, bucket), `20260523000000` (FK de cursos),
> `20260816180000` (fix-190, datos de contacto). Specs `0003-b`, `0004-b`; `docs/UAT-PLAN.md` Paquete 6.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-036`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S22)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- Los casos de seguridad (**H**, **R**) se hacen con DevTools ("Copy as fetch" desde Network) y
  **solo contra el entorno de pruebas**, nunca contra producción.

---

## 1. Sospechas de bug encontradas en el código

### Auditoría

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Exportar auditoría sin control de rol.** La edge function solo verifica que haya sesión y lee `audit_log` con la clave de servicio (salta RLS). Una secretaria, un instructor o un alumno logueado podría descargar el log completo de todas las sedes. | `supabase/functions/generate-audit-report/index.ts:141-155,166,190-218` |
| S2 | 🔴 Alta | **Autoría falsificable.** `log_change()` toma primero el header HTTP `x-audit-user-id` (pensado para edge functions) **antes** que `auth.uid()`. Cualquier usuario que haga una petición REST con ese header puede atribuirle su acción a otra persona. | `migrations/20260809100000_fix145…sql:509-523` (fallback 1 antes que el 3 en :530-540) |
| S3 | 🔴 Alta | **El log no es "inmutable":** la policy `insert_audit_log` deja a **cualquier** usuario autenticado insertar filas directo en `audit_log` (con `user_id`, `detail` y fecha a elección). Además es innecesaria: `log_change()` ya es `SECURITY DEFINER`. | `migrations/20260306120000_audit_log_insert_policy.sql:15-17`; `20260809100000…sql:458-462` |
| S4 | 🔴 Alta | **Acciones críticas sin auditar.** Solo 20 tablas tienen trigger. **No** se auditan, entre otras: `courses` (precio del catálogo), `pricing_seasons`, `discounts`, `discount_applications`, `cash_closings` (cuadre de caja), `cuadratura_adjustments`, `expenses`, `fixed_expenses`, `instructor_advances`, `instructor_monthly_payments`, `class_b_practice_attendance`, `class_b_theory_attendance`, `school_documents`, `digital_contracts`, `sii_receipts`, `instructors`, `branches`, `service_catalog`, `standalone_courses`, `tasks`, `announcements`. | `grep "CREATE TRIGGER trg_audit_"` en `supabase/migrations/` (lista completa en §3.C) |
| S5 | 🟠 Media | **Solo se ven acciones de secretarias.** La consulta filtra `roles.name = 'secretary'`: lo que hace el admin (editar usuarios, crear secretarias, cambiar config web), los instructores (evaluar clases) y los procesos sin usuario (inscripción online, webhooks) **nunca aparecen**, aunque el trigger los registre. | `auditoria.facade.ts:164,176`; `generate-audit-report/index.ts:190-193,216-220`; hero `admin-auditoria.component.ts:59-60` |
| S6 | 🟠 Media | **Autor equivocado en ediciones de pagos/matrículas.** Si la fila tiene `registered_by`, se usa ese valor antes que el usuario de la sesión: si el admin (u otra secretaria) edita un pago, el log dice que lo hizo quien lo registró originalmente. | `20260809100000…sql:525-528` |
| S7 | 🟠 Media | **Filtro y columna "Sede" usan la sede del usuario, no la del registro.** Existe `audit_log.branch_id` (sede de la entidad), pero se filtra y muestra `users.branch_id`. Una secretaria con grant multi-sede que actúa en la sede B aparece como sede A; al filtrar B no sale. | `auditoria.facade.ts:169-171,180,308`; `20260614201000…sql:6-7` |
| S8 | 🟠 Media | **Filtros fantasma al volver.** Los filtros de la pantalla viven en signals del componente (se resetean al salir), pero los del facade singleton no: al volver, la tabla sigue filtrada y los controles se ven vacíos. Al cambiar de sede tampoco se limpian (el filtro de una secretaria de la sede A deja la tabla vacía en la B). | `admin-auditoria.component.ts:491-495`; `auditoria.facade.ts:85-92,113-117` |
| S9 | 🟠 Media | **Diff de Configuración web ilegible.** `website_config` guarda todo en una columna JSONB `config`; el trigger compara columna por columna, así que el detalle es "Configuración: {JSON completo} -> {JSON completo}". | `20260809100000…sql:747-767` (sin caso para `config` en `audit_resolve_display_value`, :340-445) |
| S10 | 🟡 Baja-Media | **Filtro de fechas en UTC.** Se envía `YYYY-MM-DDT00:00:00` sin zona; Supabase lo interpreta en UTC. "Desde 29" incluye acciones del 28 después de las 21:00 (hora Chile) y "Hasta 29" deja fuera las del 29 después de las 21:00. No valida desde > hasta. | `auditoria.facade.ts:183-188`; `generate-audit-report/index.ts:223-224` |
| S11 | 🟡 Baja | **"Ciclos Teóricos" inalcanzable por filtro.** `class_b_theory_sessions` está mapeada a "Ciclos Teóricos", pero esa opción no está en el filtro de Módulo, y "Otros" la excluye. Al revés, `website_config`, `special_service_sales`, `standalone_course_enrollments` y `professional_pre_registrations` no están mapeadas: salen con el nombre crudo de la tabla y solo en "Otros". | `audit-log-row.model.ts:28-53,65-76` |
| S12 | 🟡 Baja | **Columna IP siempre "—":** `log_change()` nunca llena `ip`. | `20260809100000…sql:790-791`; `auditoria.facade.ts:312` |
| S13 | 🟡 Baja | **Exportación truncada en silencio a 5.000 filas** y sin carrera controlada en la tabla (sin `createRequestGuard`: cambiar filtros/página rápido puede dejar datos de una consulta vieja). | `generate-audit-report/index.ts:214`; `auditoria.facade.ts:142-225` |

### Configuración web y landing

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S14 | 🔴 Alta | **XSS almacenado en la landing pública.** El script de hidratación inserta con `innerHTML`, sin escapar, textos que la secretaria edita: "Qué incluye" de cada curso, texto del trust badge, nombre de la marca (copyright), URL del logo; y pone `mapEmbedUrl` como `src` de un iframe (acepta `javascript:`). | `webs/src/layouts/LandingLayout.astro:638,400,267-269,293-294,858` |
| S15 | 🔴 Alta | **Bucket `website-public` sin límite por sede y con subida anónima.** Cualquiera **sin sesión** puede subir archivos a `seeds/`; cualquier secretaria puede subir o sobrescribir (UPDATE) cualquier archivo del bucket, incluido el logo de la otra sede y los `seeds/`. Acepta SVG (script embebido) y hasta 50 MB. | `migrations/20260522010000_create_website_public_bucket.sql:14-19,55-62,66-78`; `20260525010000…sql` |
| S16 | 🟠 Media | **"Por qué elegirnos" se sobrescribe en cada guardado** con 6 textos fijos en el código (menciona "Dirección de Tránsito de Chillán" para ambas sedes). Cualquier contenido propio de `whyUs` se pierde al publicar. | `admin-configuracion-web.component.ts:766-801` |
| S17 | 🟠 Media | **Curso inactivo aparece como "Curso no existe".** El catálogo se carga solo con `active = true`, así que una card de un curso desactivado cae en la rama "huérfano" (borde rojo, select vacío) y la advertencia "Curso inactivo — no visible en web" nunca se muestra (AC4 de `0004-b`). | `courses.facade.ts:81-84`; `cursos-tab.component.ts:74-76,100-110` |
| S18 | 🟠 Media | **Precio promocional sin validación.** Marcar "Personalizar precio" pone el override en 0 (= "Gratis") al instante; acepta negativos (solo `min="0"` en HTML, sin `Validators.min`); si se borra el número, el override desaparece. Contra AC8 de `0003-b`. | `cursos-tab.component.ts:163-171,188-195`; `admin-configuracion-web.component.ts:757` |
| S19 | 🟠 Media | **Cambio de sede con cambios sin guardar / carrera.** Cambiar de sede en el topbar descarta lo editado sin avisar; `loadConfig` no tiene guard de respuesta vieja, y "Publicar" usa la sede vigente al guardar: con un cambio rápido A→B el formulario podría quedar con datos de A y publicarse en B. | `website-config.facade.ts:103-139`; `admin-configuracion-web.component.ts:488-501,847` |
| S20 | 🟡 Baja-Media | **Landing: cards nuevas no aparecen hasta recompilar.** La hidratación rellena por índice las cards que ya venían del build (`data-course-index`); si se publican más cursos que los del build, los extra no se ven (AC6). Además el precio promocional de la landing no llega a la matrícula, que cobra `courses.base_price`. | `LandingLayout.astro:594-601`; `enrollment.facade.ts:704,725` |
| S21 | 🟡 Baja | **Botón "Publicar Cambios" del hero con estado viejo:** su `disabled` lee `form.invalid` dentro de un `computed` (no es signal), así que no se actualiza al corregir/romper el formulario; el del pie sí. | `admin-configuracion-web.component.ts:368-377` |
| S22 | 🟡 Baja | **Secretaria sin sede asignada:** no carga nada pero ve el formulario editable con valores por defecto; "Publicar" enviaría `branch_id` nulo. Promo activa sin título también se acepta. | `admin-configuracion-web.component.ts:313-318,490,421-426,847` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar. Anotar acá el dato real usado para cada uno.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | ≥ 30 registros de auditoría de secretarias de ambas sedes, en ≥ 3 días distintos | Paginación, filtros | |
| D2 | Al menos 1 acción de secretaria hecha **entre 21:00 y 23:59** hora Chile | Filtro de fechas (S10) | |
| D3 | Secretaria sede A y secretaria sede B con acciones propias | Filtro por sede/secretaria | |
| D4 | Secretaria con grant multi-sede (`can_access_both_branches = true`) que actúe en la sede que no es la suya | S7 | |
| D5 | Matrícula con pago registrado por secretaria A | Edición de pago por admin (S6) | |
| D6 | Curso activo del catálogo en cada sede, con `base_price` conocido | Cards de la landing | |
| D7 | Curso de catálogo **desactivado** que esté en una card de la web | S17 | |
| D8 | Sede con configuración web **sin** `pricingFooter` (config antigua) o recién creada | Validaciones al cargar | |
| D9 | Imágenes: PNG 200 KB, SVG, WebP, JPG 8 MB, `.ico`, video MP4 < 5 MB y > 5 MB, un PDF | Subidas | |
| D10 | Textos con tildes, ñ, comillas, `<b>hola</b>` y `<img src=x onerror=alert(1)>` | Escapado en landing (S14) | |
| D11 | Landing de cada sede corriendo (`webs/`, `npm run dev`) apuntando a la misma BD | Reflejo en la web | |

**Cuentas:** admin; secretaria sede A (Autoescuela); secretaria sede B (Conductores);
secretaria con grant multi-sede; secretaria sin sede asignada (para I10); instructor y alumno
(para H01 y R04); navegador **sin sesión** (para R06).

---

## 3. Casos

### A. Acceso y rutas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin → menú "Auditoría" | Abre `/app/admin/auditoria`; skeleton → tabla. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria escribe `/app/admin/auditoria` | Acceso denegado / redirige a su inicio. El menú de secretaria no muestra "Auditoría" | ✓ | |
| A03 | Instructor y alumno escriben `/app/admin/auditoria` | Acceso denegado | ✓ | |
| A04 | Admin → menú "Sitio Web" | Abre `/app/admin/configuracion-web` | ✓ | |
| A05 | Secretaria → menú "Sitio Web" | Abre `/app/secretaria/configuracion-web` | ✓ | |
| A06 | Secretaria escribe `/app/admin/configuracion-web` | Acceso denegado | ✓ | |
| A07 | Admin escribe `/app/secretaria/configuracion-web` | Acceso denegado | ✓ | |
| A08 | F5 en cada ruta | Carga normal, misma sede | ✓ | |
| A09 | Sin sesión, abrir cualquiera de las 3 rutas | Redirige a login | ✓ | |

### B. Auditoría — carga y tabla

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Columnas | Fecha/Hora, Usuario (nombre + correo), [Sede], Acción, Módulo, Detalles, IP | ✓ | |
| B02 | Orden | Del más reciente al más antiguo | ✓ | |
| B03 | Fecha/Hora | En hora de Chile (comparar con la hora real de una acción recién hecha) | — | |
| B04 | Badge de acción | Crear (verde, +), Actualizar (marca, lápiz), Eliminar (advertencia, triángulo) | — | |
| B05 | Columna IP | Hoy siempre "—" (S12). **Decisión:** ¿se registra IP o se quita la columna? | — | |
| B06 | Correo del usuario | Es el correo personal de la secretaria (según el banner de política) y el enlace `mailto:` no abre el drawer | — | |
| B07 | Sin registros (filtro imposible) | Ícono + "No hay registros de auditoría para los filtros seleccionados." | ✓ | |
| B08 | Carga con la red cortada | Toast de error + mensaje; nunca el estado vacío como si no hubiera datos | — | |
| B09 | Salir y volver | ¿Vuelve a mostrar skeleton? (el `initialize` recarga con `isLoading`) — anotar | — | |
| B10 | Detalle largo en la fila | No rompe la fila; la columna Detalles tiene ancho mínimo legible | — | |

### C. Auditoría — cobertura: acción en otro módulo → registro

Hacer cada acción **como secretaria de la sede A** y luego, como admin, buscar el registro. En
cada fila verificar: usuario correcto, fecha/hora, sede, acción, módulo y un detalle con
**nombres legibles** (no IDs crudos como `id=123` o `course_id: 4 -> 5`).

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Matricular un alumno Clase B **(§4)** | Registros de Alumnos (alumno), Matrículas ("Registrado: Nombre - Curso ($precio)") y Pagos | ✓ | |
| C02 | Registrar un pago / abono | Pagos: "$monto (Método) de Nombre (Nº matrícula)" | ✓ | |
| C03 | Archivar y restaurar un alumno | Alumnos: Actualizar con el cambio de estado legible | ✓ | |
| C04 | Reprogramar una clase práctica (cambio de hora e instructor) | Agenda: Actualizar con hora vieja → nueva y nombre de instructor | ✓ | |
| C05 | Cancelar una clase | Agenda: registro con el estado legible | — | |
| C06 | Subir un documento del alumno (CI, foto) | Alumnos: "Cédula de identidad de Nombre" (tipo traducido) | — | |
| C07 | Editar datos de un alumno (teléfono) | Usuarios o Alumnos: "Teléfono: X -> Y" | — | |
| C08 | Registrar una mantención / documento de vehículo | Flota: tipo traducido + patente | — | |
| C09 | Venta de servicio especial | Registro visible (hoy sale como módulo `special_service_sales` en "Otros", S11) | — | |
| C10 | Inscripción a curso singular | Ídem (`standalone_course_enrollments`, S11) | — | |
| C11 | Emitir un certificado | Certificación: "Folio N - Nombre" | — | |
| C12 | Guardar Configuración web **(§4)** | Registro de la config web con detalle entendible (S9) | ✓ | |
| C13 | Cambiar el precio base de un curso en el catálogo | **Hoy no queda registro (S4)** | ✓ | |
| C14 | Hacer un cuadre / cierre de caja | **Hoy no queda registro (S4)** | — | |
| C15 | Registrar un gasto / gasto fijo | **Hoy no queda registro (S4)** | — | |
| C16 | Aplicar un descuento a una matrícula | **Hoy no queda registro (S4)** | — | |
| C17 | Marcar asistencia práctica o teórica | **Hoy no queda registro (S4)** | — | |
| C18 | Registrar un anticipo o pago a instructor | **Hoy no queda registro (S4)** | — | |
| C19 | Subir un documento de la escuela / firmar contrato digital | **Hoy no queda registro (S4)** | — | |
| C20 | Admin edita un usuario o crea una secretaria **(§4)** | El trigger registra, pero **no se ve** en la pantalla (S5) | ✓ | |
| C21 | Instructor evalúa una clase práctica | Queda registro pero no se ve (S5) | — | |
| C22 | Alumno se inscribe online (landing / inscripción pública) | ¿Se ve? Probablemente no: sin usuario o no es secretaria (S5) | — | |
| C23 | Acción que no cambia nada (guardar sin modificar) | No genera registro (así está programado) | — | |
| C24 | Una acción de la que no se sabe si quedó registro | Buscar el registro por módulo + fecha y confirmar que no hay duplicados (una acción = un registro por fila modificada) | — | |

Tablas **con** trigger hoy (referencia): `users`, `students`, `student_documents`, `enrollments`,
`payments`, `class_b_sessions`, `class_b_theory_sessions`, `promotion_courses`,
`professional_theory_sessions`, `professional_practice_sessions`, `professional_module_grades`,
`professional_pre_registrations`, `class_book`, `vehicles`, `vehicle_documents`,
`maintenance_records`, `certificates`, `standalone_course_enrollments`, `special_service_sales`,
`website_config`.

### D. Auditoría — atribución y sede

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Admin con "Todas las sedes" | Columna Sede visible, registros de ambas sedes | ✓ | |
| D02 | Admin elige la sede A **(§4)** | Recarga sola; sin columna Sede; solo acciones de la sede A | ✓ | |
| D03 | Cambio rápido de sede A→B→A (Slow 3G) | Termina con la sede A sin mezclar registros | — | |
| D04 | Secretaria con grant (D4) actúa en la sede B **(§4)** | El registro aparece al filtrar la sede **B** y dice Sede B (S7) | — | |
| D05 | Admin edita un pago registrado por la secretaria A (D5) **(§4)** | El registro dice que lo editó el admin, no la secretaria (S6) | — | |
| D06 | Secretaria desactivada o eliminada | Sus registros antiguos siguen visibles con su nombre | — | |
| D07 | Total "Todas" = suma de sedes | Coincide (salvo registros de secretarias sin sede) | ✓ | |

### E. Auditoría — filtros y paginación

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Fecha desde | Solo registros desde ese día (hora Chile) | ✓ | |
| E02 | Fecha hasta | Solo hasta ese día inclusive | ✓ | |
| E03 | Desde = Hasta = día de D2 **(§4)** | Incluye la acción de las 21:00-23:59 y excluye las del día anterior a esa hora (S10) | — | |
| E04 | Desde posterior a Hasta | Mensaje de validación o resultado vacío coherente (hoy no valida) | — | |
| E05 | Filtro Secretaria | Solo las secretarias de la sede vigente en el desplegable; filtra bien | ✓ | |
| E06 | Filtro Acción: Crear / Actualizar / Eliminar | Solo ese tipo | ✓ | |
| E07 | Filtro Módulo: cada opción | Solo ese módulo | ✓ | |
| E08 | Buscar una acción de ciclos teóricos | ¿Hay forma de filtrarla? (S11: no está la opción y "Otros" la excluye) | — | |
| E09 | Módulo = Otros | Muestra config web, servicios especiales, cursos singulares, pre-inscripciones — con nombre crudo de tabla (S11) | — | |
| E10 | Combinar los 5 filtros | Intersección correcta | ✓ | |
| E11 | Volver un filtro a "todos" sin "Limpiar Filtros" | ¿Se puede? (los select no tienen botón de limpiar) | — | |
| E12 | "Limpiar Filtros" | Controles vacíos y tabla completa, página 1 | ✓ | |
| E13 | Filtrar → otra pantalla → volver **(§4)** | Controles y tabla coherentes (S8) | — | |
| E14 | Filtro Secretaria de la sede A → cambiar a la sede B | El filtro se limpia; la tabla no queda vacía sin razón visible (S8) | — | |
| E15 | Paginación con D1 | 25 por página; "Mostrando 1 a 25 de N registros" correcto | ✓ | |
| E16 | Navegar hasta la última página | Sin filas repetidas ni faltantes | ✓ | |
| E17 | Estar en la página 3 y cambiar un filtro | Vuelve a la página 1 | ✓ | |
| E18 | Clic rápido en varias páginas (Slow 3G) | La tabla termina mostrando la última página pedida (S13) | — | |

### F. Auditoría — drawer de detalle

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Clic en una fila | Drawer "Detalle de Auditoría": Fecha, Acción, Módulo, Sede, IP, Usuario, Detalle completo | ✓ | |
| F02 | Teclado: Tab hasta la fila + Enter | Abre el drawer | — | |
| F03 | Detalle con varios cambios ("A: x -> y; B: …") | Se lee completo, con saltos de línea, sin cortarse | — | |
| F04 | Detalle de un UPDATE de config web | Legible (S9) — anotar el largo real | — | |
| F05 | ¿Se puede identificar el registro afectado? | Hoy el drawer no muestra `entity_id` ni enlace a la ficha. **Decisión:** ¿hace falta? | — | |
| F06 | Abrir el drawer y cambiar de fila | Muestra la fila nueva | — | |
| F07 | Tabla con drawer abierto | La tabla scrollea horizontal, sin superponerse | — | |

### G. Auditoría — exportar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Excel sin filtros | Descarga `Auditoria_<fecha>`; filas = total en pantalla | ✓ | |
| G02 | PDF sin filtros | PDF con sede, "generado por", totales Crear/Actualizar/Eliminar | ✓ | |
| G03 | Exportar con cada filtro | El archivo respeta todos los filtros de la pantalla | ✓ | |
| G04 | Fechas en el archivo | En hora de Chile, igual que la pantalla | — | |
| G05 | Tildes y ñ en el PDF | Se ven bien | — | |
| G06 | Más de 5.000 registros | ¿Avisa que se truncó? (S13) | — | |
| G07 | Botón mientras exporta | Spinner, deshabilitado, sin cambiar de ancho | — | |
| G08 | Falla de la función | Toast "No se pudo generar el reporte" | — | |
| G09 | Menú de exportar: clic afuera | Se cierra | — | |

### H. Auditoría — seguridad e inmutabilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Exportar como secretaria / instructor **(§4)** | 403 / error; nunca el archivo (S1) | ✓ | |
| H02 | Secretaria lee `audit_log` por REST | Solo sus propias acciones (policy de fix-224), nunca las de otras | ✓ | |
| H03 | Secretaria inserta una fila en `audit_log` por REST **(§4)** | Rechazado (S3) | ✓ | |
| H04 | Secretaria intenta UPDATE / DELETE de una fila de `audit_log` | Rechazado (sin policy) | ✓ | |
| H05 | Header `x-audit-user-id` falso **(§4)** | La acción queda a nombre de quien la hizo, no del id del header (S2) | ✓ | |
| H06 | Admin intenta borrar una fila de `audit_log` | Rechazado — ni el admin debería poder | — | |

### I. Configuración web — carga, sede y roles

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Admin con "Todas las sedes" | Estado vacío "Selecciona una sede en el menú superior"; sin pestañas | ✓ | |
| I02 | Admin elige la sede A | Skeleton → formulario con la config de A (nombre, dominio, tema azul) | ✓ | |
| I03 | Admin cambia a la sede B | Skeleton → config de B (tema roja); nada de A en ningún campo | ✓ | |
| I04 | Admin edita un campo y cambia de sede sin guardar **(§4)** | ¿Avisa que se pierden los cambios? (S19) | — | |
| I05 | Cambio rápido A→B (Slow 3G) y publicar | Se publica en B lo que se ve de B; nunca datos de A en B (S19) | — | |
| I06 | Secretaria sede A | Línea "Sede: Autoescuela Chillán"; sin selector; config de A | ✓ | |
| I07 | Secretaria sede B | Config de B | ✓ | |
| I08 | Secretaria con grant cambia la sede en el topbar | La pantalla sigue en su sede (usa `branchId` fijo) — **decisión:** ¿debería poder editar la otra? | — | |
| I09 | KPIs del hero | Campaña Promo, Cursos Activos (= cards), Preguntas Frecuentes, Dominio Web coinciden con la config | ✓ | |
| I10 | Secretaria sin sede asignada | Mensaje claro; no un formulario editable que se pueda publicar (S22) | — | |
| I11 | Salir y volver (misma sede) | Datos al instante, sin skeleton | — | |
| I12 | Carga con red cortada | Toast "Error al cargar configuración"; no un formulario vacío publicable | — | |
| I13 | Sede sin fila en `website_config` (D8) | Formulario con valores por defecto de esa sede, editable (AC-E1) | — | |

### J. General & Redes (incluye imágenes)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Nombre, nombre corto, slogan, dominio vacíos | Error de validación y no se puede publicar | ✓ | |
| J02 | Tema Visual | Bloqueado, muestra el tema de la sede; **sin warning de "disabled" en consola** (ASG-i-020) | ✓ | |
| J03 | Dominio con formato raro ("http://", espacios) | ¿Valida? — anotar | — | |
| J04 | Redes con texto que no es URL | ¿Valida? — anotar; en la landing el enlace no debe romperse | — | |
| J05 | Subir logo PNG/SVG/WebP (D9) | Spinner → toast "Logo subido" → preview con la URL nueva | ✓ | |
| J06 | Subir un PDF o archivo no permitido | Mensaje de error claro | — | |
| J07 | Subir una imagen de 8 MB | Se optimiza o se rechaza con mensaje | — | |
| J08 | Subir logo y **no** publicar, salir **(§4)** | El sitio sigue con el logo anterior (la subida no publica) — confirmar que es lo esperado | — | |
| J09 | Imagen OG y Favicon (`.ico`) | Suben y se ven en el preview | — | |
| J10 | Pegar una URL externa en vez de subir | Se acepta y se ve el preview | — | |

### K. Sección Hero

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Titular, subtítulo, texto del botón y WhatsApp del CTA vacíos | Error y no publica | ✓ | |
| K02 | Diseño: centrado / dividido izquierda / derecha | Se guarda y la landing lo refleja | — | |
| K03 | Fondo: tema / color / imagen / video | Cada tipo muestra sus controles; se guarda | — | |
| K04 | Opacidad del overlay en 0 y 100 | Se guarda el número y la landing lo respeta | — | |
| K05 | Video > 5 MB | Advertencia; decide si igual sube (hoy sube) | — | |
| K06 | Media lateral: ninguno / imagen / video | Coherente con el diseño elegido | — | |
| K07 | Trust badge: activar sin texto | ¿Valida? — anotar | — | |
| K08 | Pilares: cambiar ícono (buscador, categorías, quitar) | El ícono elegido se guarda y se ve en la landing | — | |
| K09 | Pilar sin texto | Error de validación | ✓ | |
| K10 | Número de WhatsApp en formato raro | ¿Valida? El botón de la landing debe abrir el chat correcto | — | |

### L. Cursos & Precios

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Sede sin cursos activos en el catálogo | "Este branch no tiene cursos operacionales activos"; sin botón Agregar | — | |
| L02 | Agregar card y publicar sin elegir curso | Error de validación (AC1 de `0004-b`) | ✓ | |
| L03 | Desplegable de cursos | Solo cursos **activos** de **la sede** vigente | ✓ | |
| L04 | Precio base heredado | Igual al `base_price` del catálogo (D6) | ✓ | |
| L05 | Mismo curso en 2 cards | Error "ya está publicado en otra card" y no guarda | ✓ | |
| L06 | Override de precio **(§4)** | Precio promo en la landing + base tachado; badge "Override activo" (AC3) | ✓ | |
| L07 | Override = 0 | "Gratis" en el preview y en la landing (AC-E3 de `0004-b`) | ✓ | |
| L08 | Override negativo o vacío | Error de validación; no publica (S18, AC8 de `0003-b`) | ✓ | |
| L09 | Marcar "Personalizar precio" y publicar sin tocar el número | ¿Queda el curso "Gratis" por accidente? (S18) | — | |
| L10 | Card de curso desactivado (D7) **(§4)** | Advertencia "Curso inactivo — no visible en web", no "Curso no existe" (S17) | — | |
| L11 | Duración, descripción, "qué incluye" vacíos | Error de validación | ✓ | |
| L12 | "Qué incluye" con comas y espacios dobles | Cada ítem limpio como un check en la landing | — | |
| L13 | Badge sin marcar "Destacar" | El campo se deshabilita; ¿el texto viejo igual se publica? — anotar | — | |
| L14 | Orden de visualización: 0, repetidos, vacío | Orden coherente en la landing (0 se convierte en 1) | — | |
| L15 | Eliminar una card | Sin confirmación hoy — confirmar si es aceptable; al publicar desaparece de la landing | — | |
| L16 | Términos de Pago y Garantía: vacíos o > 100 / > 300 caracteres | Mensajes "requerido" / "Máximo N caracteres" | ✓ | |
| L17 | Cambiar el precio en el catálogo sin tocar la web **(§4)** | La landing muestra el precio nuevo (AC2 de `0004-b`) | — | |
| L18 | Intentar eliminar del catálogo un curso usado en una card | Bloqueado con el mensaje del trigger (AC-E2 de `0004-b`) | — | |

### M. Campaña Promo

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Activar, llenar título, badge y descripción, publicar | Banner visible en la landing (AC7) | ✓ | |
| M02 | Desactivar y publicar | Banner oculto | ✓ | |
| M03 | Activar sin título ni descripción | Debería exigirlos (hoy los acepta, S22) | — | |
| M04 | Botón del banner en la landing | Abre WhatsApp con el mensaje de la promo | — | |
| M05 | KPI "Campaña Promo" | Cambia a Activa/Inactiva después de publicar | — | |

### N. Contacto & Horas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Dirección, ciudad, región, teléfono, WhatsApp, correo, mapa vacíos | Error y no publica; ¿se ve **qué** campo falla? | ✓ | |
| N02 | Correo inválido | Error de formato | ✓ | |
| N03 | Latitud/longitud fuera de rango (ej. 200) | ¿Valida? — anotar | — | |
| N04 | URL del mapa que no es de Google Maps | ¿Valida? En la landing el mapa no debe romperse | — | |
| N05 | Agregar/quitar bloque de horario; bloque vacío | Error en el bloque vacío | ✓ | |
| N06 | Quitar todos los horarios y publicar | ¿Se acepta? Al recargar vuelven los 2 por defecto — anotar | — | |
| N07 | Cambiar dirección/correo de contacto | La landing lo refleja; **decisión:** ¿debe coincidir con la política de privacidad y `branches`? (fix-190) | — | |

### O. FAQs

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Agregar FAQ, llenar y publicar | Aparece en la landing | ✓ | |
| O02 | FAQ con pregunta o respuesta vacía | Error inline y no publica | ✓ | |
| O03 | Eliminar FAQ | Desaparece al publicar | — | |
| O04 | Sin FAQs | Estado vacío en el panel; la landing no muestra la sección vacía | — | |
| O05 | Respuesta larga con saltos de línea | Se ve bien en la landing | — | |

### P. Guardar, validaciones y errores

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Publicar con todo válido | Toast "Configuración guardada"; al recargar, los datos persisten | ✓ | |
| P02 | Error en una pestaña que no está abierta **(§4)** | Se sabe en qué pestaña está el error | — | |
| P03 | Config antigua sin Términos de Pago (D8) | Al cargar, ¿el formulario queda inválido y bloquea publicar hasta llenarlos? — anotar | — | |
| P04 | Botón del hero vs botón del pie | Ambos se habilitan/deshabilitan juntos (S21) | — | |
| P05 | Doble clic en "Publicar" | Un solo guardado; spinner "Guardando Cambios…" | — | |
| P06 | Falla de red al publicar | Toast de error; lo escrito sigue en pantalla (AC-E2) | — | |
| P07 | Error del trigger de cursos (p. ej. curso de otra sede) | Mensaje entendible, no el texto técnico de Postgres | — | |
| P08 | Contenido de "Por qué elegirnos" después de publicar **(§4)** | No se pierde contenido previo (S16) | — | |
| P09 | Mensaje de estado del pie | Sin emoji ("⚠️") — usar ícono Lucide (regla visual) | — | |
| P10 | Salir de la pantalla con cambios sin publicar | ¿Avisa? — **decisión** | — | |

### Q. Landing pública (reflejo)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Publicar un precio y abrir la landing en ventana privada | Precio nuevo en < 2 s, sin salto visual (AC4) | — | |
| Q02 | Publicar una card de curso **nueva** **(§4)** | Aparece en la landing sin recompilar (S20, AC6) | — | |
| Q03 | Curso desactivado en el catálogo | La card no aparece en la landing (AC4 de `0004-b`) | — | |
| Q04 | Precio de la landing vs precio al matricular **(§4)** | Coinciden, o se define qué pasa con el precio promo (S20) | — | |
| Q05 | Cada sede su landing | Lo publicado en A no aparece en la landing de B | — | |
| Q06 | Tildes, ñ y comillas (D10) | Se ven bien | — | |
| Q07 | Texto con `<b>` / `<img onerror>` en "Qué incluye" **(§4)** | Se muestra como texto; **nunca** se ejecuta (S14) | — | |
| Q08 | Logo, OG, favicon nuevos | Se ven; al compartir el link en WhatsApp sale la OG (puede demorar por caché) | — | |

### R. Configuración web — seguridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | Secretaria A hace upsert de `website_config` con `branch_id` de B **(§4)** | Error de permisos; config de B intacta (AC3) | ✓ | |
| R02 | Secretaria con grant hace lo mismo | Se permite (RLS `branch_visible`) — confirmar que es lo deseado | — | |
| R03 | Anónimo lee `website_config` | Permitido (la landing lo necesita); no debe contener datos privados | ✓ | |
| R04 | Instructor/alumno hace upsert en `website_config` | Rechazado | ✓ | |
| R05 | Secretaria A sube/sobrescribe un archivo en `website-assets/branch-2/` o en `seeds/` **(§4)** | Rechazado (S15) | ✓ | |
| R06 | Sin sesión, subir un archivo a `seeds/` del bucket **(§4)** | Rechazado (S15) | ✓ | |
| R07 | Subir un SVG con `<script>` | Rechazado o saneado (S15) | — | |
| R08 | `mapEmbedUrl = javascript:alert(1)` | No se ejecuta en la landing (S14) | — | |

### V. Política de privacidad (ruta pública)

El contenido **no** sale de Configuración web: está fijo en `privacy-policy.model.ts`.

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| V01 | Sin sesión: `/politica-privacidad/autoescuela-chillan` | Política de "Jorge Enrique Pérez Godoy…" con RUT 76.007.217-6, Maipón 418, otecchillan@gmail.com | ✓ | |
| V02 | Sin sesión: `/politica-privacidad/conductores-chillan` | Sociedad Comercial Chillán Capacita Ltda., RUT 77.940.120-0, Carrera 74, conductorchillan@gmail.com | ✓ | |
| V03 | Slug inválido (`/politica-privacidad/xyz`) | "No encontramos esa política…" con botones a las 2 sedes | ✓ | |
| V04 | Slug en mayúsculas (`Autoescuela-Chillan`) | ¿Encuentra? (hoy distingue mayúsculas) — anotar | — | |
| V05 | Sin slug (`/politica-privacidad/`) | No pantalla en blanco | — | |
| V06 | Enlace desde el paso de contrato (matrícula presencial y online) | Abre la política de **la sede de la matrícula** | ✓ | |
| V07 | Dirección/correo de la política vs contacto de la landing y `branches` | Coinciden | — | |
| V08 | País de alojamiento de Supabase | Hoy dice solo "fuera de Chile" (`SUPABASE_HOSTING_COUNTRY = null`) — bloqueante de publicación reportado por el propio código | — | |
| V09 | La landing enlaza a la política | Hoy la landing no tiene enlace (no se encontró en `webs/`) — **decisión** | — | |
| V10 | 375 px, modo oscuro, imprimir | Tablas con scroll propio, legible, sin scroll horizontal de página | — | |

### T. Visual, app-like y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| T01 | Auditoría en desktop | La página no scrollea; la tabla scrollea por dentro (ASG-b-069) | ✓ | |
| T02 | Configuración web en desktop | El formulario scrollea por dentro; el hero queda fijo (ASG-b-072) | ✓ | |
| T03 | 375 / 768 / 1440 px | Sin scroll horizontal de página (la tabla de auditoría sí scrollea en su caja) | ✓ | |
| T04 | Pestañas en móvil | Etiquetas cortas legibles | — | |
| T05 | Modo claro y oscuro | Badges, drawer, banners y selects legibles | ✓ | |
| T06 | Solo teclado | Se llega a filtros, filas, pestañas y botones; foco visible | — | |
| T07 | Consola | Sin errores ni warnings (incluido el de `disabled`, ASG-i-020) en ambas pantallas | ✓ | |

---

## 4. Casos con pasos numerados

### C01 — Matrícula queda en auditoría

**Precondición:** sesión secretaria sede A en un navegador; admin en otro.
1. Como secretaria, anotar la hora y matricular un alumno Clase B con pago.
2. Como admin, abrir Auditoría con la sede A elegida.
3. Filtrar Fecha desde/hasta = hoy y Secretaria = la que matriculó.
4. Buscar los registros de Alumnos, Matrículas y Pagos de esa matrícula.
5. Abrir el drawer de cada uno.

**Esperado:** 3 o más registros con el nombre de la secretaria, hora ±1 min, Sede A, y detalle con
nombre del alumno, curso y monto (no IDs). **Evidencia:** captura del paso 4.

### C12 — Guardar configuración web queda en auditoría

**Precondición:** sesión secretaria sede A.
1. En Configuración web cambiar solo el slogan y publicar.
2. Como admin, en Auditoría filtrar Módulo = Otros y fecha = hoy.
3. Abrir el registro.

**Esperado:** registro "Configuración web - <Sede A>" con la secretaria como autora y un detalle
que permita saber **qué** cambió (slogan viejo → nuevo). Si se ve el JSON completo, S9 confirmada
(anotar el largo aproximado).

### C20 — Acciones del admin

1. Como admin, editar el teléfono de una secretaria (Usuarios).
2. Como admin, crear una secretaria de prueba.
3. Abrir Auditoría, fecha = hoy, sin filtros.

**Esperado según la regla actual:** no aparecen (la pantalla solo muestra secretarias, S5).
Anotar el resultado y llevar a §5 si el negocio quiere ver las acciones del admin.

### D02 — Admin cambia de sede

**Precondición:** D1 (acciones en ambas sedes).
1. Topbar → "Todas" → anotar el total y verificar la columna Sede.
2. Elegir la sede A → anotar el total; verificar que no está la columna y que todas las filas
   son de secretarias de A.
3. Elegir la sede B → lo mismo.

**Esperado:** la tabla recarga sola cada vez y Todas = A + B.

### D04 — Secretaria con grant actúa en la otra sede

**Precondición:** D4, secretaria de la sede A con grant.
1. Como esa secretaria, cambiar la sede a B y registrar un pago de un alumno de B.
2. Como admin, en Auditoría elegir la sede B.
3. Elegir la sede A.

**Esperado:** el registro aparece en la sede **B** con Sede = B. Si solo aparece en A, S7
confirmada.

### D05 — Autor de una edición de pago

**Precondición:** D5.
1. Como admin, editar un dato del pago de D5 (por ejemplo, observación o método) y guardar.
2. En Auditoría, "Todas", fecha = hoy, Módulo = Pagos.
3. Abrir el registro "Actualizar" de ese pago.

**Esperado:** que diga que lo hizo el admin. Si aparece a nombre de la secretaria que registró el
pago, S6 confirmada. Si no aparece (porque el admin no es secretaria), anotar también S5.

### E03 — Filtro de fechas en el borde del día

**Precondición:** D2: una acción hecha el día X a las 22:00 hora Chile.
1. Fecha desde = X, Fecha hasta = X.
2. Buscar la acción de las 22:00.
3. Fecha desde = X+1, Fecha hasta = X+1.

**Esperado:** en el paso 2 aparece; en el paso 3 no aparece. Si es al revés, S10 confirmada.

### E13 — Filtros fantasma

1. En Auditoría, filtrar Acción = Eliminar. Anotar el total.
2. Ir por el menú a otra pantalla.
3. Volver a Auditoría.
4. Mirar los controles de filtro y el total.

**Esperado:** o bien los controles siguen mostrando "Eliminar" con el mismo total, o bien todo se
limpió y el total es el general. Si los controles están vacíos pero el total es el filtrado, S8
confirmada.

### H01 — Exportar como secretaria (S1)

**Precondición:** sesión admin en un navegador y secretaria en otro.
1. Como admin, exportar Excel de auditoría y copiar la petición `generate-audit-report` desde
   Network ("Copy as fetch").
2. Como secretaria, en cualquier pantalla abrir DevTools → Network y copiar el header
   `Authorization` de cualquier petición a Supabase.
3. En la consola de la secretaria, pegar la petición del paso 1 reemplazando el `Authorization`
   por el de la secretaria, con `branch_id: null`. Ejecutar.
4. Repetir con un instructor.

**Esperado:** 401/403 o error. Si devuelve filas, S1 confirmada → **P0 inmediato** (expone el
historial de acciones de todas las sedes).

### H03 — Insertar un registro falso (S3)

**Precondición:** sesión secretaria.
1. Copiar desde Network cualquier petición REST de Supabase ("Copy as fetch").
2. Cambiarla a `POST /rest/v1/audit_log` con body
   `{"user_id": <id de otra secretaria>, "action": "DELETE", "entity": "payments", "detail": "PRUEBA QA"}`.
3. Ejecutar y, como admin, buscar "PRUEBA QA" en Auditoría.

**Esperado:** la petición es rechazada. Si se inserta, S3 confirmada → reportar y **pedir al admin
de BD que borre la fila de prueba**.

### H05 — Header de autoría falso (S2)

**Precondición:** sesión secretaria A; id numérico de otra secretaria B.
1. Copiar desde Network la petición REST de una edición que la secretaria A sí puede hacer (por
   ejemplo, cambiar el teléfono de un alumno propio).
2. Agregar el header `x-audit-user-id: <id de B>` y ejecutarla.
3. Como admin, abrir el registro de esa edición.

**Esperado:** autora = secretaria A. Si dice B, S2 confirmada → P0 (la auditoría no sirve como
prueba).

### I04 — Cambiar de sede con cambios sin guardar

1. Como admin, sede A → pestaña General → cambiar el slogan (no publicar).
2. Cambiar el topbar a la sede B.
3. Volver a la sede A.

**Esperado:** en el paso 2, un aviso de cambios sin guardar. Si no avisa, anotar que en el paso 3
el slogan volvió al original (se perdió) y llevar a §5.

### J08 — Subir imagen sin publicar

1. Sede A → General → subir un logo nuevo.
2. Verificar el toast "Logo subido" y el preview.
3. Salir de la pantalla sin publicar.
4. Abrir la landing de A.

**Esperado:** la landing sigue con el logo anterior. Confirmar con negocio si es lo esperado (el
toast dice "subido", lo que puede hacer creer que ya está en la web).

### L06 — Precio promocional

**Precondición:** D6, card del curso con `base_price` = P.
1. Marcar "Personalizar precio para promo" → verificar qué valor aparece (hoy 0 → "Gratis").
2. Escribir P − 20.000 → verificar el texto "La landing mostrará $… con tachado de $P".
3. Publicar.
4. Abrir la landing en ventana privada.

**Esperado:** la card muestra P − 20.000 y P tachado. Al desmarcar y publicar, vuelve a P.

### L10 — Card de un curso desactivado

**Precondición:** D7.
1. Abrir Cursos & Precios.
2. Ubicar la card del curso desactivado.
3. Abrir la landing.

**Esperado:** en el panel, badge amarillo "Curso inactivo — no visible en web" y el nombre del
curso; en la landing, la card no aparece. Si el panel dice "Curso no existe" en rojo, S17
confirmada.

### L17 — Precio del catálogo llega a la landing

1. En el catálogo (Configuración de precios), cambiar el `base_price` de un curso sin override.
2. Sin tocar Configuración web, abrir la landing en ventana privada.
3. Como admin, buscar en Auditoría el cambio de precio del paso 1.

**Esperado:** la landing muestra el precio nuevo (AC2). En el paso 3, hoy **no hay registro**
(S4) — anotar.

### P02 — Error en otra pestaña

1. Pestaña Contacto → borrar la dirección.
2. Ir a la pestaña General.
3. Mirar el pie y los botones "Publicar".
4. Clic en el "Publicar Cambios" del hero.

**Esperado:** se indica en qué pestaña está el error (o la pestaña se marca). Hoy solo sale "Existen
errores de validación" y el toast "revise cada pestaña" — anotar si es suficiente. Verificar que el
botón del hero también esté deshabilitado (S21).

### P08 — "Por qué elegirnos" no se pierde

**Precondición:** conocer el contenido actual de `whyUs` de la sede B (en la landing o en la BD).
1. Como admin, sede B, cambiar solo el slogan y publicar.
2. Abrir la landing de B, sección "Por qué elegirnos".

**Esperado:** el mismo contenido que antes. Si ahora dice "Dirección de Tránsito de Chillán" y los
6 textos fijos del código, S16 confirmada.

### Q02 — Card nueva aparece en la landing

**Precondición:** la landing de A se compiló con N cards.
1. Agregar una card nueva (N+1) con un curso activo y publicar.
2. Abrir la landing en ventana privada y contar las cards (sección Cursos y tabla de precios).

**Esperado:** N+1 cards. Si solo se ven N, S20 confirmada (requiere recompilar).

### Q04 — Precio de la landing vs matrícula

**Precondición:** card con override activo (L06).
1. Anotar el precio de la landing.
2. Hacer una matrícula de prueba de ese curso (presencial y, si está habilitada, online).
3. Comparar el precio del paso de pago.

**Esperado:** definido por negocio (§5). Hoy la matrícula cobra el `base_price`, no el promocional.

### Q07 — Texto con HTML en la landing (S14)

**Precondición:** entorno de pruebas; landing de A corriendo.
1. En Cursos, "Qué incluye" de una card: `Clases prácticas, <img src=x onerror=alert('QA')>`.
2. En Hero, trust badge activado con texto `<b>negrita</b>`.
3. Publicar y abrir la landing.

**Esperado:** los textos se muestran literales (se ven los `<` `>`) y no aparece ningún `alert`.
Si aparece el alert o la negrita, S14 confirmada → **P0**. Al terminar, dejar los textos como
estaban y publicar.

### R01 — Secretaria edita la web de otra sede

**Precondición:** sesión secretaria A sin grant.
1. Publicar un cambio mínimo en su sede y copiar la petición `website_config` desde Network.
2. En la consola, repetirla con `branch_id` de la sede B y un slogan "PRUEBA QA".
3. Como admin, abrir la config de B.

**Esperado:** error de permisos (AC3) y B sin cambios. Si B dice "PRUEBA QA", fuga → **P0**.

### R05 — Secretaria sobrescribe archivos de otra sede (S15)

**Precondición:** sesión secretaria A; URL del logo actual de la sede B.
1. Subir un logo propio y copiar la petición a `storage/v1/object/website-public/...`.
2. Repetirla cambiando la ruta a `website-assets/branch-2/prueba-qa.png`.
3. Repetirla con la ruta exacta del logo de B (sobrescritura, `x-upsert: true`).

**Esperado:** ambos rechazados. Si se aceptan, S15 confirmada. **No** ejecutar el paso 3 sobre el
logo real sin respaldo: usar una copia de prueba.

### R06 — Subida anónima al bucket (S15)

1. En una ventana privada **sin sesión**, abrir la landing y copiar la anon key del script.
2. Hacer `POST` a `/storage/v1/object/website-public/seeds/prueba-qa.png` con esa key y una
   imagen pequeña.

**Esperado:** rechazado. Si se sube, S15 confirmada (cualquiera puede alojar archivos en el
dominio de la escuela) — reportar y pedir que se borre el archivo.

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| C20 / C21 / C22 | ¿La auditoría debe mostrar también acciones del admin, de instructores y de procesos automáticos (inscripción online, webhooks)? Hoy solo secretarias. |
| C13–C19 | ¿Qué otras acciones deben auditarse? (precios del catálogo, cuadre de caja, gastos, descuentos, asistencia, pagos a instructores, contratos). |
| D04 | "Sede" de un registro: ¿la de la secretaria o la del alumno/registro afectado? |
| B05 | ¿Se registra la IP o se quita la columna? |
| F05 | ¿El detalle debe enlazar a la ficha del registro afectado? |
| H06 | ¿Nadie (ni el admin) puede borrar registros de auditoría? ¿Por cuánto tiempo se conservan? |
| I04 / P10 | ¿Avisar al cambiar de sede o salir con cambios sin publicar? |
| I08 / R02 | ¿La secretaria con grant multi-sede puede editar la web de ambas sedes? |
| J03 / J04 / K10 / N03 / N04 | ¿Qué formato se exige para dominio, redes, WhatsApp, coordenadas y URL del mapa? |
| J08 | ¿Subir una imagen debe publicarla al tiro, o solo al "Publicar"? |
| L09 / L15 | ¿Confirmación al eliminar una card? ¿El override debe partir vacío en vez de 0? |
| M03 | ¿Promo activa exige título y descripción? |
| N07 / V07 | ¿La dirección y el correo de contacto de la landing deben quedar amarrados a los de la política de privacidad y `branches` (fix-190), o la secretaria puede cambiarlos libremente? |
| P08 | ¿"Por qué elegirnos" debe ser editable desde el panel o fijo por sede? |
| Q04 | Si la landing muestra un precio promocional, ¿la matrícula debe cobrar ese precio? |
| V09 | ¿La landing debe enlazar a la política de privacidad de su sede? |
| Secretaria | ¿La secretaria puede editar nombre, dominio, logo y datos de contacto de la marca, o solo precios/promos/FAQs (US2 de `0003-b` habla de "promociones o precios")? |
