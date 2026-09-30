# Testing — Ficha del alumno Clase B y Ex-Alumnos B

> **Asignación:** `ASG-i-024` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/alumnos/:id`, `/app/secretaria/alumnos/:id` (mismo componente
> `AdminAlumnoDetalleComponent`), `/app/admin/ex-alumnos`, `/app/secretaria/ex-alumnos`.
> **Incluye:** la ficha completa (cabecera, datos personales, selector de matrículas, grilla de clases
> prácticas, Ficha Técnica e impresión, reprogramar clase, reagendamiento masivo de clases
> penalizadas, inasistencias y justificar, estado financiero, carnet, contrato, certificado, editar
> perfil e invitación, consentimientos, historial de reagendamientos, marcar como ex-alumno,
> eliminar/archivar desde la ficha) y Ex-Alumnos B (lista, período, búsqueda, tarjetas,
> re-matricular, tasas y opiniones).
> **No incluye:** la lista de Base de Alumnos (ver `024a-base-alumnos-b.md`); la regla de
> penalización por inasistencias en detalle (ver `027-asistencia-clase-b.md`); registrar un pago
> (ver `028-pagos-descuentos.md`); el grid de agendamiento por dentro (ver
> `026-agenda-triple-match.md`); el envío del certificado por email (ver
> `033-documentos-y-certificacion.md`); el wizard de matrícula por dentro (ver
> `023-matricula-presencial.md`); la ficha de un alumno Profesional (ver `025`).
>
> **Código leído para armar esta lista:**
> `features/admin/alumno-detalle/` completo (componente, `editar-perfil-drawer`,
> `ficha-tecnica-drawer`, `components/ficha-tecnica`, `reprogramar-clase-drawer`,
> `reagendar-clases-drawer` (paso 1 y 2), `inasistencias-drawer`, `inasistencia-drawer`,
> `consentimientos-drawer`, `historial-reagendamientos-drawer`, `components/historial-pagos`),
> `core/facades/admin-alumno-detalle.facade.ts`, `core/facades/ex-alumnos.facade.ts`,
> `core/facades/certificacion-clase-b.facade.ts` (generar/ver), `core/utils/carnet-menu.util.ts`,
> `core/utils/period-window.utils.ts`, `core/services/infrastructure/error-sanitizer.service.ts`,
> `shared/components/ex-alumnos-content/`, `shared/components/egresado-card/`,
> `features/{admin/alumnos,secretaria}/ex-alumnos/`, `features/admin/alumnos/ex-alumnos/components/`,
> `features/secretaria/matricula/secretaria-matricula.component.ts` (arranque con `?rut=`),
> `supabase/functions/{update-student-profile,activate-student-account,generate-student-license-pdf,generate-ficha-tecnica-pdf,generate-certificate-b-pdf}/`,
> migraciones de RLS (`students`, `enrollments`, `class_b_practice_attendance`), de publicación
> Realtime y de triggers de `enrollments`; specs `0006-i`, `0007-i`, `0038-b`, fixes `fix-012-i`,
> `fix-029-i`, `fix-040-i`; `docs/UAT-PLAN.md` Paquete 2.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-024`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S20)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- Casi todos los botones de la ficha viven en la **tarjeta de perfil** (columna izquierda). En la
  cabecera solo quedan "Editar Perfil", "Eliminar Alumno" y, cuando aplica, "Marcar como Ex-Alumno".
  "Reprogramar clase" **no** está en la grilla principal: está en **Ficha Técnica → columna Acción**.

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Una secretaria puede editar a cualquier usuario, incluido un admin.** "Editar Perfil" llama a una edge function con clave de servicio que solo verifica que quien llama sea admin o secretaria; no verifica que el `userId` sea un alumno ni que sea de su sede. Cambiar el email de un admin en Auth y luego pedir "olvidé mi contraseña" sería una toma de cuenta. | `supabase/functions/update-student-profile/index.ts:78-80,92-93,102-121,149-152` |
| S2 | 🔴 Alta | **El carnet PDF no tiene ningún control de acceso.** La función usa la clave de servicio y no revisa quién llama: cualquier sesión (incluido un alumno, y posiblemente la clave pública del sitio) puede generar el carnet de cualquier matrícula, con nombre, RUT y **foto**, y además sobrescribe `enrollments.license_*_url`. | `supabase/functions/generate-student-license-pdf/index.ts:38-61,121-136,158-170` |
| S3 | 🟠 Media | **Tiempo real de la ficha probablemente muerto.** El canal escucha 7 tablas; 5 de ellas (`absence_evidence`, `class_b_practice_attendance`, `professional_*` ×3) no están en ninguna migración de `supabase_realtime`. Por el mecanismo documentado en `fix-227-m`, eso deja mudo el canal entero (también `class_b_sessions` y `payments`). Además no filtra por alumno: si funcionara, cualquier cambio en cualquier alumno recargaría la ficha. | `admin-alumno-detalle.facade.ts:240-280`; `supabase/migrations/20260907120000_branch_payroll_config.sql:55-66` |
| S4 | 🟠 Media | **Borradores y matrículas canceladas se cuelan en la ficha.** La consulta no trae `enrollments.status`, así que el filtro `status !== 'draft'` nunca excluye nada: los borradores aparecen en el selector y, si el más reciente es un borrador abandonado (p. ej. una re-matrícula a medias), la ficha muestra ese borrador como matrícula principal (0 clases, "Matrícula —"). | `admin-alumno-detalle.facade.ts:402-409,419-422,437-438` |
| S5 | 🟠 Media | **"Marcar como Ex-Alumno" nunca desaparece.** La condición usa `alumno.estado !== 'Finalizado'`, pero `estado` sale de `students.status` (active/pending/inactive/graduated/archived), que nunca vale `completed`; marcar ex-alumno cambia `enrollments.status`. Tras marcar, la ficha sigue diciendo "ESTADO: Activo" y el botón sigue ahí. Además `graduated`/`archived`/`pending` se muestran en inglés. | `admin-alumno-detalle.component.ts:1481-1485`; `admin-alumno-detalle.facade.ts:524,1197-1201,1212-1220`; `supabase/migrations/20260426000001_students_status_add_archived.sql:6` |
| S6 | 🟠 Media | **La "fecha de egreso" no es la fecha de egreso.** Ex-Alumnos usa `enrollments.updated_at`; marcar como ex-alumno no lo actualiza (no hay trigger `updated_at` en `enrollments`), pero registrar un pago sí. Resultado: el año y el filtro de período usan la fecha del último pago (o de creación); un egresado reciente con último pago antiguo queda **oculto** con el período por defecto (últimos 12 meses), y pagar una deuda después de egresar mueve su fecha. | `ex-alumnos.facade.ts:147,164,196-198`; `admin-alumno-detalle.facade.ts:1197-1201`; `supabase/migrations/20260301000008_08_misc_and_triggers.sql:193` |
| S7 | 🟠 Media | **Reprogramar individualmente una clase con inasistencia repite el bug de DG-075.** El lápiz de Ficha Técnica aparece en toda clase no completada (incluidas "Inasistencia" y "Cancelada"). `reprogramarClase()` vuelve la sesión a `scheduled` pero **no archiva** la asistencia vieja ni deja registro en el historial de reagendamientos (el flujo masivo sí lo hace). La inasistencia vieja sigue contando y la penalización podría volver a dispararse. | `components/ficha-tecnica/admin-ficha-tecnica.component.ts:155-166`; `admin-alumno-detalle.facade.ts:1380-1391` vs `1572-1577,1579-1597`; `indices/DOMAIN-GOTCHAS.md` DG-075 |
| S8 | 🟠 Media | **Email duplicado en "Editar Perfil" muestra un error genérico.** El error de la edge function llega como `FunctionsHttpError`, que el sanitizador convierte en "Ha ocurrido un error inesperado…"; el texto real ("Ya existe un usuario con ese correo") se pierde. `fix-029-i` corrigió esto solo para instructores. | `admin-alumno-detalle.facade.ts:1073-1074`; `error-sanitizer.service.ts:110-116`; `specs/fixes/fix-029-i-edge-function-error-swallowed/fix.md:12` |
| S9 | 🟠 Media | **El botón "Documentos" de la ficha desapareció.** La spec `0006-i` (AC3) lo verificó en la cabecera; el rediseño del 2026-08-30 (3 columnas) no lo incluye y la ficha hoy no muestra ni abre documentos del alumno. | `specs/specs/0006-i-app-like-alumno-detalle/acceptance.md:64-73` vs `admin-alumno-detalle.component.ts:1495-1509` |
| S10 | 🟠 Media | **El "bypass" del admin para generar certificado desde la ficha no funciona.** La ficha pregunta "¿generar de todas formas?" pero llama sin `force`, y la función rechaza. Además la ficha cuenta clases "presentes" y la función cuenta clases con **nota** (`evaluation_grade`): la secretaria puede ver "Generar Certificado" habilitado y recibir un rechazo. Generar desde la ficha tampoco notifica al alumno. | `admin-alumno-detalle.component.ts:1337-1338,1758-1774`; `certificacion-clase-b.facade.ts:117-122`; `generate-certificate-b-pdf/index.ts:139-143,156-158` |
| S11 | 🟡 Baja-Media | **Carnet con la marca de una sola sede.** Nombre, dirección, email y logo de "Conductores Chillán" están fijos en el código: un alumno de la otra sede recibe un carnet con marca ajena. | `generate-student-license-pdf/index.ts:19-27` |
| S12 | 🟡 Baja-Media | **El error "se pega".** Si falla la carga de una ficha (id inexistente, alumno de otra sede) y luego se vuelve a la ficha del alumno anterior, el facade la trata como "mismo alumno" y refresca en segundo plano sin limpiar el error: se sigue viendo "Error al cargar la ficha" para un alumno válido hasta recargar con F5. | `admin-alumno-detalle.facade.ts:295-302,322,325-331,334-342,542-548`; `admin-alumno-detalle.component.ts:273` |
| S13 | 🟡 Baja | **Id no numérico en la URL** (`/alumnos/abc`): no se carga nada; se ve la ficha del alumno visto antes (facade singleton) o "Cargando…" para siempre. | `admin-alumno-detalle.component.ts:1635-1643` |
| S14 | 🟡 Baja | **El selector de matrícula "salta".** Cualquier refresco (justificar, reprogramar, generar certificado, evento Realtime) recarga desde la matrícula más reciente y pierde la elegida. El historial de reagendamientos no se recarga al cambiar de matrícula ni se limpia al cambiar de alumno (puede mostrar el de otro alumno). | `admin-alumno-detalle.facade.ts:354-391,485-541,305-322`; `admin-alumno-detalle.component.ts:1638-1641` |
| S15 | 🟡 Baja | **Tarjetas de Ex-Alumnos (móvil):** "Ver ficha" no pasa `?from=ex-alumnos`, así que "Volver" lleva a la Base de Alumnos, donde el egresado no está. | `ex-alumnos-content.component.ts:248-249` vs `290-294`; `egresado-card.component.ts:144,178` |
| S16 | 🟡 Baja | **Tasas y opiniones de Ex-Alumnos sin filtro de sede** (exámenes, licencias obtenidas y encuestas de todas las sedes, con nombre del alumno en las opiniones). Tasa "municipal" y "psicotécnico" son el mismo número. | `ex-alumnos.facade.ts:227-238,259-263,280-290` |
| S17 | 🟡 Baja | **Fecha de ingreso** = `students.created_at` en UTC y en formato `AAAA-MM-DD`: para un alumno creado de noche sale el día siguiente; para un re-matriculado sale la fecha de su primera matrícula. | `admin-alumno-detalle.facade.ts:523` |
| S18 | 🟡 Baja | **Editar Perfil:** tras guardar, el botón se rehabilita 1,2 s antes de cerrar (doble envío) y el `setTimeout` cierra el drawer que esté abierto en ese momento. "Enviar invitación" usa el email escrito en el formulario aunque no se haya guardado; la función lo rechaza por no coincidir y el mensaje es genérico. | `editar-perfil-drawer/admin-editar-perfil-drawer.component.ts:331-338,348-357`; `activate-student-account/index.ts:303-305` |
| S19 | 🟡 Baja | **La ficha no permite registrar un pago** y "Ver todo el historial" abre Pagos sin filtrar por el alumno. | `components/historial-pagos/admin-historial-pagos.component.ts:109-115`; `admin-alumno-detalle.component.ts:1245-1247` |
| S20 | 🟡 Baja | **Reprogramar: el bloqueo del alumno es solo por día completo** (2 clases en el día). Un horario a la misma hora que otra clase del alumno con otro instructor aparece disponible. Confirmar si la BD lo impide. | `admin-alumno-detalle.facade.ts:1666-1679,1708-1710` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (seed de spec `0008-i` + ajustes). Anotar acá el nombre/RUT real usado.

| Dato | Cómo debe estar | Para qué | Alumno usado |
|---|---|---|---|
| D1 | Clase B activo, 12 clases agendadas (3 completadas, 1 futura con instructor), 2 pagos, saldo > 0, contrato presencial, foto carnet | Caso "todo OK" | |
| D2 | Clase B con 2 inasistencias consecutivas → clases `cancelled` por penalización + `no_show` | Reagendar masivo, grilla roja/ámbar | |
| D3 | Clase B con 1 inasistencia sin justificar y 1 justificada | Panel de inasistencias | |
| D4 | Clase B 12/12 con nota, certificado generado **y enviado por email**, matrícula aún activa | Marcar como Ex-Alumno | |
| D5 | Clase B 12/12 presentes pero **sin nota** en alguna clase, sin certificado | S10 | |
| D6 | 2 matrículas B (una antigua `completed`, una refuerzo activa de 6 clases) | Selector de matrícula, refuerzo | |
| D7 | Clase B + Profesional | Qué matrícula muestra la ficha | |
| D8 | Solo Profesional | URL manipulada | |
| D9 | Matrícula B activa + un **borrador** B más reciente (re-matrícula abandonada) | S4 | |
| D10 | Alumno sin cuenta Auth (`supabase_uid` nulo) y otro con `first_login = true` | Invitación | |
| D11 | Alumno archivado | URL manipulada, Ex-Alumnos | |
| D12 | Alumno de la sede B | Aislamiento para secretaria A | |
| D13 | 2 ex-alumnos B: uno marcado hoy con último pago hace > 12 meses; otro con saldo > 0 | S6, "Con deuda" | |
| D14 | Ex-alumno B re-matriculado (una `completed` + una activa) | Aparece en ambas listas | |
| D15 | Matrícula online con contrato generado sin firmar (si existe en datos históricos) | Menú Contrato | |
| D16 | Alumno con consentimientos otorgados y uno sin registros | Drawer Consentimientos | |
| D17 | Alumno con reagendamientos previos | Drawer Reagendamientos | |
| D18 | Nombre con tilde y ñ, sin apellido materno, email muy largo | Diseño | |
| D19 | Alumno de la sede "Autoescuela Chillán" (la otra marca) | S11 | |
| D20 | > 20 ex-alumnos B, de al menos 2 años distintos | Paginación, período | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede;
instructor (para ver notificaciones); alumno con cuenta activa (para S2).

---

## 3. Casos

### A. Carga, acceso y URL manipulada

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin abre la ficha de D1 desde la Base (ojo) | Skeleton con la misma forma de 3 columnas → datos. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria abre la ficha de D1 | Igual, en `/app/secretaria/alumnos/:id` | ✓ | |
| A03 | Secretaria A escribe la URL de D12 (sede B) **(§4)** | Mensaje claro de "sin acceso / no encontrado", sin datos de D12 (hoy: "…(PGRST116)") | ✓ | |
| A04 | Id numérico inexistente (`/alumnos/999999`) | "Error al cargar la ficha" con mensaje entendible y botón Volver | ✓ | |
| A05 | Error y luego volver a la ficha anterior **(§4)** | La ficha anterior se ve bien, sin el error pegado (S12) | — | |
| A06 | Id no numérico (`/alumnos/abc`) **(§4)** | Mensaje de error; nunca la ficha de otro alumno (S13) | ✓ | |
| A07 | D8 (solo Profesional) por `/app/admin/alumnos/:id` | Vista Profesional; "Volver" lleva a Alumnos Profesional | ✓ | |
| A08 | D11 (archivado) por URL | ¿Se muestra? Hoy se ve normal con "ESTADO: archived" — decisión | — | |
| A09 | Secretaria escribe `/app/admin/alumnos/:id` | Acceso denegado | ✓ | |
| A10 | F5 dentro de la ficha | Recarga la misma ficha | ✓ | |
| A11 | Ficha A → volver → ficha B | Skeleton y luego B; nunca datos de A mezclados | ✓ | |
| A12 | Ficha A → volver → ficha A | Datos al instante, sin skeleton | — | |
| A13 | "Volver" desde la ficha abierta desde la Base / desde Ex-Alumnos | Vuelve a la lista de origen (etiqueta "Listado de Alumnos" / "Ex-Alumnos B") | ✓ | |
| A14 | Red lenta (Slow 3G) | El skeleton no salta al llegar los datos | — | |

### B. Cabecera y datos personales

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Título y línea de contexto | "Nombre completo" y "Curso · Matrícula #N" correctos | ✓ | |
| B02 | Sin apellido materno (D18) | Sin espacios dobles ni "null" | — | |
| B03 | Nombre largo | Truncado con tooltip | — | |
| B04 | RUT | Coincide con el registrado (¿con formato chileno?) | — | |
| B05 | Chip de estado y "ESTADO:" | Texto en español; verde solo si Activo (S5: `graduated`/`archived`/`pending` salen en inglés) | ✓ | |
| B06 | Email largo (D18) | Se corta sin romper la columna | — | |
| B07 | Teléfono vacío | "—" | — | |
| B08 | Fecha de ingreso de alumno creado después de las 21:00 | Fecha correcta de Chile y formato `dd-mm-aaaa` (S17) | — | |
| B09 | Fecha de ingreso de D6 (re-matriculado) | ¿Primera matrícula o la actual? — decisión | — | |
| B10 | Acciones de la tarjeta de perfil de D1 | Carnet, Certificado, (Contrato), Inasistencias, Ficha Técnica, Consentimientos, Reagendamientos; cada una con `data-llm-action` | ✓ | |
| B11 | Cabecera | Solo "Editar Perfil" y "Eliminar Alumno" (+ "Marcar como Ex-Alumno" si aplica) | ✓ | |

### C. Selector de matrículas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Alumno con 1 matrícula | No aparece el selector | ✓ | |
| C02 | D9 (borrador más reciente) **(§4)** | El borrador no aparece ni se muestra como matrícula principal (S4) | ✓ | |
| C03 | D6: cambiar de matrícula | Curso, Nº, saldo, pagos, grilla (12 ↔ 6 clases), carnet y certificado cambian a los de esa matrícula | ✓ | |
| C04 | Elegir la matrícula antigua y justificar/refrescar algo **(§4)** | Se mantiene la matrícula elegida (S14) | — | |
| C05 | D7 (B + Profesional) | ¿Qué matrícula se abre por defecto? Al elegir la Profesional cambia a la vista Profesional | — | |
| C06 | Matrícula cancelada en el historial | ¿Debe aparecer? — decisión | — | |
| C07 | Selector con drawer abierto | No se solapa con las columnas | — | |

### D. Clases prácticas (grilla principal)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | D1 | 12 tarjetas: completadas en verde con ✓, agendadas en azul con fecha, hora e instructor, sin agendar en gris | ✓ | |
| D02 | Contador "N de 12" y % | Coinciden con las clases realmente asistidas | ✓ | |
| D03 | Barra de progreso < 15 % | Sin texto dentro, sin desbordar | — | |
| D04 | D2 | Inasistencia en rojo, "Cancelada — pendiente reagendar" en ámbar | ✓ | |
| D05 | D3 | "Inasistencia — Justificada" en la justificada | ✓ | |
| D06 | Refuerzo (D6) | 6 tarjetas, "N de 6" | ✓ | |
| D07 | Hora de una clase de las 08:30 | Muestra 08:30 (hora de Chile) | — | |
| D08 | Fecha de las tarjetas | `dd-mm` sin año — ¿suficiente cuando el curso cruza de año? | — | |
| D09 | Clase marcada presente en Asistencia B (otra pestaña) → volver a la ficha | Aparece completada (sin Realtime, al menos al volver) | — | |
| D10 | "OK" y "Pendientes" bajo la barra | Suman el total requerido | — | |

### E. Ficha Técnica e impresión

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Botón "Ficha Técnica" | Drawer con tabla de 12 filas: tema, fecha/hora, instructor, km, observaciones, firmas | ✓ | |
| E02 | Kilometraje y observaciones de una clase completada | Coinciden con lo registrado por el instructor | — | |
| E03 | Firmas | Puntos de color solo si hay firma; tooltip correcto | — | |
| E04 | Columna Acción | Lápiz solo en clases no completadas | ✓ | |
| E05 | "Imprimir Informe" | Spinner en el botón → PDF con los mismos datos que la tabla | ✓ | |
| E06 | Imprimir 2 veces seguidas rápido | Un solo PDF, botón deshabilitado mientras genera | — | |
| E07 | Falla la función de PDF | Toast "No se pudo generar la Ficha Técnica" | — | |
| E08 | Drawer en pantalla angosta | Cambia a tarjetas, sin scroll horizontal | — | |
| E09 | Clase con inasistencia reagendada | La tabla no muestra la inasistencia vieja como vigente | — | |

### F. Reprogramar clase (individual, desde Ficha Técnica)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Lápiz en una clase agendada | Pantalla "Clase #N — Nombre" con lista de instructores de la sede | ✓ | |
| F02 | Reprogramar a otro instructor y horario **(§4)** | El horario viejo se libera y el nuevo se ocupa en la Agenda; toast de éxito; la ficha refleja el cambio | ✓ | |
| F03 | Mientras cargan los instructores | ¿Skeleton o "No hay instructores disponibles" por un instante? | — | |
| F04 | Reprogramar una clase con Inasistencia o Cancelada **(§4)** | La inasistencia vieja queda archivada y no vuelve a penalizar (S7) | — | |
| F05 | Instructor sin disponibilidad | "Sin disponibilidad" | — | |
| F06 | Navegar semanas y días | Flechas se deshabilitan en la primera/última semana | — | |
| F07 | Slot a la misma hora que otra clase del alumno | No debe ser elegible (S20) | — | |
| F08 | Día donde el alumno ya tiene 2 clases | Todos los slots de ese día bloqueados | — | |
| F09 | Slot con vehículo con documento vencido | Ícono de advertencia con tooltip (no bloquea) | — | |
| F10 | Dos usuarios toman el mismo slot a la vez | El segundo recibe error claro, sin doble agenda | — | |
| F11 | "Cancelar" | ¿Vuelve a Ficha Técnica o cierra todo? (hoy cierra todo) | — | |
| F12 | Notificaciones | Alumno e instructor (y el instructor anterior si cambió) reciben aviso | — | |
| F13 | Historial de reagendamientos | ¿Debe registrar la reprogramación individual? Hoy no (S7) — decisión | — | |
| F14 | Doble clic en "Confirmar Reprogramación" | Una sola actualización | — | |

### G. Reagendar clases penalizadas (masivo, 2 pasos)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Botón "Reagendar Clases (N)" en D2 | Visible solo con clases canceladas/no_show; N = cantidad | ✓ | |
| G02 | Alumno sin clases pendientes | El botón no aparece | ✓ | |
| G03 | Paso 1: todas preseleccionadas | Checkboxes marcados, badge Cancelada/Inasistencia/Justificada | ✓ | |
| G04 | Desmarcar todas | "Seleccionar Horarios (0)" deshabilitado | ✓ | |
| G05 | Ciclo completo **(§4)** | Las clases elegidas quedan agendadas, en azul, historial con razón | ✓ | |
| G06 | Guardar sin razón / "Otro" sin detalle | Mensaje de error, no guarda | ✓ | |
| G07 | Menos horarios que clases elegidas | No deja guardar | ✓ | |
| G08 | "Volver" desde el paso 2 | Vuelve al paso 1 con la selección intacta | — | |
| G09 | Reagendar solo algunas | Las no elegidas siguen en rojo/ámbar | — | |
| G10 | Falla a mitad (red cortada después del primer horario) | ¿Queda un estado coherente? El guardado no es atómico — anotar qué queda | — | |
| G11 | Después de reagendar, registrar una inasistencia nueva en una clase reagendada | La penalización no vuelve a cancelar por las faltas viejas (ver `027`) | — | |
| G12 | Notificaciones | Un solo aviso agrupado al alumno y al instructor | — | |

### H. Inasistencias y justificar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Botón "Inasistencias" sin inasistencias | "No hay inasistencias registradas hasta la fecha", sin botón Registrar (Clase B) | ✓ | |
| H02 | Justificar una inasistencia de D3 **(§4)** | Badge "Justificado" + "Ver motivo"; la grilla dice "Inasistencia — Justificada" | ✓ | |
| H03 | Motivo vacío o solo espacios | "Guardar" deshabilitado | ✓ | |
| H04 | Cerrar el modal con X, Cancelar y clic afuera | Se cierra sin guardar | — | |
| H05 | "Ver motivo" con texto largo | Scroll dentro del modal | — | |
| H06 | Inasistencia ya reagendada | Badge "Reagendada"; ¿debe poder justificarse? — decisión | — | |
| H07 | Falla al justificar | Toast de error; sigue sin justificar | — | |
| H08 | Efecto sobre la penalización | Según regla de `027`; la ficha refleja el resultado | — | |
| H09 | Doble clic en "Guardar" | Una sola actualización | — | |

### I. Estado financiero

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Total pagado y saldo | Iguales a lo registrado en Pagos para esa matrícula | ✓ | |
| I02 | Lista de pagos | Fecha, concepto, monto, método y estado correctos | ✓ | |
| I03 | Sin pagos | "No hay pagos registrados" centrado | ✓ | |
| I04 | Pago anulado o pendiente | Estado correcto (un estado desconocido hoy se muestra como "Pagado") | — | |
| I05 | Muchos pagos | La lista scrollea por dentro; la página no crece | — | |
| I06 | "Ver todo el historial" (admin y secretaria) | Abre Pagos de su portal; ¿filtrado por el alumno? (S19) | ✓ | |
| I07 | Registrar un pago en Pagos y volver a la ficha | Totales actualizados | — | |
| I08 | Registrar pago desde la ficha | No existe — decisión (S19) | — | |

### J. Carnet

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Menú "Carnet" de D1 sin carnets | "Generar Carnet 6/12 clases" habilitados, "Ver" deshabilitados | ✓ | |
| J02 | Generar Carnet 6 clases | Botón "Generando…" → visor con el PDF; "Ver" se habilita | ✓ | |
| J03 | Contenido del carnet | Nombre, RUT, Nº matrícula, foto, instructor mayoritario, 6 o 12 filas | — | |
| J04 | Refuerzo (D6) | Solo existe el carnet de 6 | ✓ | |
| J05 | Alumno de la otra sede (D19) | Marca y datos de su propia sede (S11) | — | |
| J06 | Alumno sin foto | Carnet sin foto, sin error | — | |
| J07 | "Volver a generar" | Reemplaza el anterior | — | |
| J08 | **Seguridad (S2)** **(§4)** | Una sesión de alumno o de otra sede no puede generar el carnet de otra matrícula | ✓ | |
| J09 | Clic fuera del menú / scroll con menú abierto | Se cierra / se reposiciona | — | |

### K. Contrato

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Matrícula presencial con contrato | "Ver Contrato" abre el PDF firmado | ✓ | |
| K02 | Matrícula presencial sin contrato | No hay botón de contrato | — | |
| K03 | D15 (online sin firmar) | Menú "Descargar Contrato" / "Subir Firmado" | — | |
| K04 | Subir un archivo que no es PDF | Rechazo claro (hoy solo lo filtra el diálogo) | — | |
| K05 | Subir PDF firmado | Toast de éxito; el botón pasa a "Ver Contrato" | — | |

### L. Certificado

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Secretaria con < 12 clases | "Certificado (N/12)" deshabilitado | ✓ | |
| L02 | D4 (ya generado) | "Ver Certificado" abre el PDF | ✓ | |
| L03 | Admin con < 12 clases **(§4)** | Confirmación y certificado generado (S10) | — | |
| L04 | D5 (presentes sin nota) | Botón y función coinciden en si es elegible (S10) | — | |
| L05 | Generar con 12/12 | "Generando…" → visor; queda "Ver Certificado" | ✓ | |
| L06 | Rechazo de la función | Toast con el motivo real | — | |
| L07 | Notificación al alumno al generar desde la ficha | ¿Llega? (S10) | — | |

### M. Editar perfil e invitación

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Abrir "Editar Perfil" | Formulario precargado con los datos actuales | ✓ | |
| M02 | Email ya usado por otro usuario **(§4)** | Mensaje claro "Ya existe…", nada cambia en Auth ni en la tabla (S8) | ✓ | |
| M03 | Cambiar nombre y teléfono | Éxito; la ficha, la Base y la Agenda muestran el nombre nuevo | ✓ | |
| M04 | **Seguridad (S1)** **(§4)** | Una secretaria no puede editar a un admin, instructor ni alumno de otra sede | ✓ | |
| M05 | Invitación con email editado sin guardar **(§4)** | Aviso claro o usa el email guardado (S18) | — | |
| M06 | Vaciar nombres / apellido paterno | Mensaje de campo obligatorio, botón deshabilitado | ✓ | |
| M07 | Email inválido | "Ingresa un email válido" | ✓ | |
| M08 | Teléfono con letras | ¿Se valida? — decisión | — | |
| M09 | Email con mayúsculas | Se guarda en minúsculas | — | |
| M10 | Cambiar email de un alumno con cuenta activa | Puede iniciar sesión con el nuevo email, no con el viejo | — | |
| M11 | Cambiar email de un alumno sin cuenta (D10) | Se guarda; luego "Enviar invitación" llega al nuevo | — | |
| M12 | "Enviar invitación" (D10) | Aviso amarillo visible; toast de éxito; el correo llega | — | |
| M13 | Alumno con cuenta ya activada | No aparece el aviso de invitación | ✓ | |
| M14 | Doble clic en "Guardar Cambios" y clic durante el mensaje de éxito | Una sola actualización (S18) | — | |
| M15 | Cancelar después de escribir y reabrir | Datos originales | — | |
| M16 | Auditoría | El cambio queda con usuario y fecha | — | |

### N. Consentimientos y Reagendamientos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Consentimientos de D16 | Tipo, estado, fecha, origen, versión e IP | ✓ | |
| N02 | Alumno sin consentimientos | Estado vacío centrado con explicación | ✓ | |
| N03 | Falla la carga | Alerta de error (nunca "sin consentimientos") | — | |
| N04 | Admin: "Registrar revocación" | Confirmación → estado "Revocado" con fecha, sin borrar el original | — | |
| N05 | Secretaria | No ve el botón de revocar | ✓ | |
| N06 | Reagendamientos de D17 | Clase, fecha anterior → nueva, razón y fecha de registro | ✓ | |
| N07 | Reagendamientos con 2 matrículas (D6) | Muestra el de la matrícula elegida (S14) | — | |
| N08 | Ficha de un alumno sin reagendamientos justo después de ver D17 | Vacío, nunca el historial de D17 (S14) | — | |

### O. Marcar como Ex-Alumno

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Ciclo completo con D4 **(§4)** | Pasa a Ex-Alumnos; la ficha deja de ofrecer el botón (S5) | ✓ | |
| O02 | D5 (sin certificado enviado) | El botón no aparece | ✓ | |
| O03 | Cancelar la confirmación | No cambia nada | ✓ | |
| O04 | Fecha de egreso en Ex-Alumnos **(§4)** | Es la fecha de hoy (S6) | — | |
| O05 | D4 con saldo > 0 | ¿Debe permitirse? Hoy sí — decisión | — | |
| O06 | Doble clic en confirmar | Un solo cambio, un solo toast | — | |
| O07 | Falla al marcar | Toast de error; sigue en la Base | — | |

### P. Eliminar (archivar) desde la ficha

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | "Eliminar Alumno" | Abre el mismo modal de archivar de la Base (ver `024a` L) | ✓ | |
| P02 | Archivar desde la ficha **(§4)** | Toast de éxito y vuelve a la lista; el alumno está en la Papelera | ✓ | |
| P03 | Falla al archivar | Toast de error, sigue en la ficha, sin error en consola | — | |
| P04 | Archivar un ex-alumno desde su ficha | ¿Desaparece de Ex-Alumnos? Hoy no — decisión | — | |
| P05 | Texto del botón | Dice "Eliminar" pero archiva — ¿renombrar? | — | |

### Q. Lo que la ficha no tiene (confirmar)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Documentos del alumno | Botón "Documentos" (spec 0006-i AC3) — hoy no existe (S9) | ✓ | |
| Q02 | Contacto rápido | Email y teléfono no son enlaces (mailto/WhatsApp) — ¿aceptable? | — | |
| Q03 | Exportar ficha PDF desde la ficha | Solo existe en la Base — ¿aceptable? | — | |

### R. Tiempo real y SWR

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | 2 sesiones: registrar un pago del alumno **(§4)** | La ficha abierta en B se actualiza sola (S3) | ✓ | |
| R02 | 2 sesiones: el instructor marca asistencia **(§4)** | La grilla en B se actualiza sola (S3) | — | |
| R03 | Cambio en OTRO alumno con la ficha abierta | La ficha no parpadea ni cambia de matrícula | — | |
| R04 | Salir de la ficha | Se cierra el canal (DevTools → WS) | — | |

### S. Sedes, roles y seguridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| S01 | Admin abre fichas de ambas sedes | Todo funciona; instructores de reprogramar son de la sede del alumno (+ los de ambas sedes) | — | |
| S02 | Secretaria con grant abre una ficha de la otra sede | Se ve y opera normalmente | — | |
| S03 | **RLS justificar** **(§4)** | Una secretaria no puede justificar inasistencias de otra sede | ✓ | |
| S04 | **RLS marcar ex-alumno** | Secretaria A no puede cambiar el estado de una matrícula de la sede B (petición copiada) | ✓ | |
| S05 | Secretaria sin sede asignada | No ve ninguna ficha | — | |

### T. Ex-Alumnos: carga y lista

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| T01 | Admin y secretaria entran a Ex-Alumnos | Skeleton → tabla; consola limpia | ✓ | |
| T02 | Quién aparece | Solo matrículas B `completed`; ningún Profesional | ✓ | |
| T03 | D14 (re-matriculado) | Aparece en Ex-Alumnos **y** en la Base — ¿correcto? | — | |
| T04 | D11 archivado con matrícula completada | ¿Debe aparecer? — decisión | — | |
| T05 | Columnas | Iniciales, nombre, email, RUT, Nº exp., licencia, año/sede, estado de cuenta | ✓ | |
| T06 | "Debe $X" / "Al día" | Coincide con el saldo real | ✓ | |
| T07 | Chip y KPIs "Egresados Clase B" / "Con deuda" | ¿Cuentan todo o solo el período elegido? Hoy todo — decisión | ✓ | |
| T08 | Orden | Del egreso más reciente al más antiguo (S6) | — | |
| T09 | Paginación con D20 | 10 por página, "Mostrando…" correcto | ✓ | |
| T10 | Ojo "Ver ficha" | Abre la ficha; "Volver" regresa a Ex-Alumnos B | ✓ | |
| T11 | Ficha abierta desde Ex-Alumnos de D14 | ¿Muestra la matrícula completada o la nueva? — decisión | — | |
| T12 | Salir y volver | Sin skeleton, datos al instante | — | |
| T13 | Error de carga (red cortada) | Mensaje de error, no "No se encontraron egresados" | — | |
| T14 | Exportar lista / certificado desde Ex-Alumnos | No existen — ¿aceptable? | — | |

### U. Ex-Alumnos: búsqueda y período (spec 0038-b)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| U01 | Período por defecto | "Últimos 12 meses" | ✓ | |
| U02 | Cambiar a "Todo" y a un año | La lista cambia; años disponibles salen de los datos | ✓ | |
| U03 | Buscar un egresado fuera del período | Lo encuentra (buscar ignora el período) | ✓ | |
| U04 | Buscar por nombre + apellido, sin tilde, RUT con y sin puntos, Nº exp. | Encuentra en todos | ✓ | |
| U05 | Sin resultados → "Limpiar filtros" | Búsqueda vacía y período vuelve a "Últimos 12 meses" | ✓ | |
| U06 | D13 egresado hoy con último pago antiguo **(§4)** | Aparece en "Últimos 12 meses" (S6) | — | |
| U07 | Egresado el 31-dic de noche | Queda en el año correcto | — | |

### V. Ex-Alumnos: tarjetas (pantalla angosta)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| V01 | 375 px | Tarjetas, sin scroll horizontal | ✓ | |
| V02 | "Ver ficha" desde la tarjeta → "Volver" **(§4)** | Regresa a Ex-Alumnos (S15) | ✓ | |
| V03 | "Cargar más" | Suma de a 6 | ✓ | |
| V04 | Buscar después de "Cargar más" | ¿Vuelve a 6? Hoy solo lo resetea "Limpiar filtros" | — | |
| V05 | Re-matricular desde la tarjeta | Igual que desde la tabla | ✓ | |

### W. Ex-Alumnos: re-matricular (fix-040-i)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| W01 | Ciclo completo (admin y secretaria) **(§4)** | Confirmación → wizard con el paso 1 precargado (RUT, nombres, email, teléfono) | ✓ | |
| W02 | Cancelar la confirmación | No abre nada, la URL no cambia | ✓ | |
| W03 | Sede con borradores pendientes **(§4)** | Al elegir "Nueva" se precarga igual | — | |
| W04 | RUT guardado sin puntos (datos del seed) | Precarga igual (`fix-042-i` sigue abierto) | — | |
| W05 | Admin con "Todas" re-matricula un egresado de la sede B | El selector de sede global cambia a B — ¿aceptable? | — | |
| W06 | Re-matricular a A, cancelar, re-matricular a B | Se precarga B, no A | — | |
| W07 | "Reiniciar" dentro del wizard | ¿Vuelve a precargar? | — | |
| W08 | Completar la re-matrícula | El alumno aparece en la Base con la matrícula nueva; la antigua sigue en Ex-Alumnos | — | |

### X. Ex-Alumnos: tasas y opiniones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| X01 | "Tasas de Aprobación" | Drawer con tasas y balance del año | ✓ | |
| X02 | Tasa municipal vs psicotécnico | Hoy son el mismo número (S16) | — | |
| X03 | "Opiniones de Egresados" | Lista con estrellas, búsqueda y promedio | ✓ | |
| X04 | Secretaria A | Solo datos de su sede (S16) | — | |
| X05 | Sin encuestas | Estado vacío, sin valores de otra sede | — | |

### Y. Ex-Alumnos: sedes

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Y01 | Admin cambia de sede | La lista recarga sola | ✓ | |
| Y02 | Cambio rápido A→B→A **(§4)** | Termina en A sin mezclar | — | |
| Y03 | Secretaria sin grant | Solo su sede | ✓ | |
| Y04 | Secretaria con grant cambia de sede | ¿Recarga? (la pantalla de secretaria no escucha el cambio) | — | |

### Z. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Z01 | Modo oscuro y claro | Tarjetas de clase, badges, drawers y modales legibles | ✓ | |
| Z02 | Desktop ≥ 1024 px | 3 columnas; el documento no scrollea; cada columna scrollea por dentro | ✓ | |
| Z03 | Drawer abierto (modo compacto) | Columnas apiladas sin solaparse | — | |
| Z04 | 375 / 768 px | Scroll nativo, sin cajas vacías gigantes | ✓ | |
| Z05 | Solo teclado | Se llega a todas las acciones y menús; foco visible; Escape cierra modales | — | |
| Z06 | Nombre con `<` o `&` en el modal de re-matricular | Se muestra tal cual (el mensaje usa HTML) | — | |

---

## 4. Casos con pasos numerados

### A03 — Secretaria abre por URL la ficha de otra sede

**Precondición:** sesión de secretaria de la sede A; id de D12 (sede B), obtenido desde la sesión
de admin.
1. Escribir `/app/secretaria/alumnos/<id de D12>`.
2. Esperar a que termine la carga.
3. Revisar en Network la respuesta de `/rest/v1/students`.

**Esperado:** mensaje entendible ("no tienes acceso" o "alumno no encontrado"), ningún dato de D12
en pantalla ni en la respuesta. **Evidencia:** captura del mensaje y de la respuesta.

### A05 — El error no debe quedar pegado

**Precondición:** sesión admin.
1. Abrir la ficha de D1 y esperar que cargue.
2. Cambiar la URL a `/app/admin/alumnos/999999`.
3. Verificar el mensaje de error.
4. Presionar "Atrás" del navegador (vuelve a D1).

**Esperado:** en el paso 4 se ve la ficha de D1 normal. Si se ve "Error al cargar la ficha", S12
confirmada.

### A06 — Id no numérico

1. Abrir la ficha de D1.
2. Cambiar la URL a `/app/admin/alumnos/abc` y presionar Enter (sin F5).
3. Repetir con F5 en esa misma URL.

**Esperado:** en ambos casos un mensaje de error. Si en el paso 2 se ve D1 o en el paso 3 queda
"Cargando…" para siempre, S13 confirmada.

### C02 — Borrador más reciente

**Precondición:** D9 (matrícula B activa y luego un borrador abandonado desde "Nueva Matrícula" con
su mismo RUT).
1. Abrir la ficha de D9.
2. Revisar título, Nº de matrícula, curso y grilla.
3. Revisar si aparece el selector de matrículas y qué pestañas tiene.

**Esperado:** se muestra la matrícula activa; el borrador no aparece. Si la ficha muestra
"Matrícula —", 0 clases o una pestaña extra, S4 confirmada.

### C04 — La matrícula elegida no debe saltar

**Precondición:** D6 con una inasistencia sin justificar en la matrícula **antigua** (si no es
posible, usar cualquier acción que refresque, como generar el carnet).
1. En el selector, elegir la matrícula antigua.
2. Inasistencias → Justificar → escribir motivo → Guardar.
3. Observar el selector y la grilla después del toast.

**Esperado:** sigue elegida la matrícula antigua y la grilla muestra la justificación. Si vuelve a
la matrícula más reciente, S14 confirmada.

### F02 — Reprogramar libera y ocupa el horario

**Precondición:** D1 con la clase #5 agendada; Agenda abierta en otra pestaña en esa semana.
1. Anotar fecha, hora e instructor de la clase #5.
2. Ficha Técnica → lápiz de la clase #5.
3. Elegir otro instructor, otro día y un horario disponible → "Confirmar Reprogramación".
4. Verificar toast y que el drawer se cierra.
5. Verificar en la ficha la nueva fecha/hora/instructor de la clase #5.
6. Recargar la Agenda: el horario viejo aparece libre y el nuevo ocupado.
7. Revisar las notificaciones del alumno y de ambos instructores.

**Evidencia:** captura de la Agenda antes y después.

### F04 — Reprogramar individualmente una clase con inasistencia

**Precondición:** D2 (clase con Inasistencia y clases Canceladas).
1. Ficha Técnica → lápiz de la clase con Inasistencia → reprogramar a un horario futuro.
2. Abrir el drawer "Inasistencias": ¿la inasistencia aparece como "Reagendada"?
3. Abrir "Reagendamientos": ¿quedó registrada?
4. Revisar en Asistencia B esa clase: ¿aparece "Ausente" sobre la clase agendada?
5. Repetir con una clase Cancelada.

**Esperado:** mismo resultado que el reagendamiento masivo (inasistencia archivada, registro en el
historial). Si la clase aparece agendada pero con la inasistencia vigente, S7 confirmada →
reportar como alta (puede volver a disparar la penalización).

### G05 — Reagendamiento masivo completo

**Precondición:** D2 con al menos 3 clases pendientes.
1. "Reagendar Clases (N)" → dejar marcadas 2 → "Seleccionar Horarios (2)".
2. Elegir razón "Médica".
3. Elegir instructor y 2 horarios → "Guardar Reagendamiento".
4. Verificar toast, que el drawer se cierra y que las 2 clases están azules con fecha nueva.
5. Verificar que el botón ahora dice "Reagendar Clases (N-2)".
6. Abrir "Reagendamientos": 2 registros con razón "Médica".
7. Abrir "Inasistencias": las reagendadas tienen badge "Reagendada".
8. Verificar la Agenda.

**Evidencia:** captura de los pasos 4 y 6.

### H02 — Justificar una inasistencia

**Precondición:** D3.
1. Inasistencias → "Justificar" en la inasistencia pendiente.
2. Verificar "Guardar" deshabilitado → escribir motivo → Guardar.
3. Verificar toast, badge "Justificado" y "Ver motivo".
4. Clic en "Ver motivo" → mismo texto escrito.
5. Cerrar el drawer y verificar en la grilla "Inasistencia — Justificada".
6. Recargar con F5 y repetir 3–5.

**Esperado:** todo persiste tras recargar.

### J08 — Seguridad: carnet de otra matrícula (S2)

**Precondición:** sesión de secretaria A; `enrollment_id` de una matrícula de la sede B; cuenta de
alumno activa.
1. En la ficha de un alumno propio, Carnet → Generar Carnet 6 clases; en Network copiar la petición
   `generate-student-license-pdf` ("Copy as fetch").
2. En Console, pegarla con el `enrollment_id` de la sede B y ejecutarla.
3. Iniciar sesión como el alumno (otro navegador) y repetir el paso 2 con su token.

**Esperado:** error 401/403 en ambos pasos, **nunca** un PDF ni `pdfUrl`. Si devuelve el carnet,
S2 confirmada → **P0 inmediato** (expone RUT y foto).

### L03 — Admin genera certificado sin las 12 clases

**Precondición:** sesión admin; alumno con 8/12 clases.
1. Clic en "Generar Certificado (8/12)".
2. Confirmar en el modal "Prácticas incompletas".
3. Observar el resultado.

**Esperado:** certificado generado y visible. Si aparece un toast de error por clases incompletas,
S10 confirmada.

### M02 — Email duplicado

**Precondición:** conocer el email de otro alumno con cuenta activa.
1. Editar Perfil de D1 → poner el email del otro alumno → Guardar Cambios.
2. Leer el mensaje.
3. Cerrar y reabrir la ficha: el email de D1 sigue siendo el original.
4. Iniciar sesión como D1 con su email original: funciona.

**Esperado:** mensaje "Ya existe un usuario con ese correo…". Si el mensaje es "Ha ocurrido un error
inesperado…", S8 confirmada (regresión del patrón de `fix-029-i`).

### M04 — Seguridad: editar a un usuario que no es alumno de la sede (S1)

**Precondición:** sesión de secretaria A; `users.id` del admin (desde la sesión de admin). **Usar
un email de prueba que controles y restaurar los datos al final.**
1. En Editar Perfil de un alumno propio, guardar un cambio de teléfono y copiar desde Network la
   petición `update-student-profile` ("Copy as fetch").
2. En Console, cambiar `userId` por el del admin, `firstNames` por "PRUEBA" y ejecutar **sin
   cambiar el email**.
3. Revisar si el nombre del admin cambió.
4. Repetir con el `userId` de un alumno de la sede B.

**Esperado:** 403 en ambos casos. Si cambia algo, S1 confirmada → **P0 inmediato**: con el mismo
método se podría cambiar el email del admin y tomar la cuenta. Restaurar los datos.

### M05 — Invitación con email editado sin guardar

**Precondición:** D10 (sin cuenta).
1. Editar Perfil → cambiar el email por otro válido **sin** Guardar.
2. Clic en "Enviar invitación".
3. Leer el mensaje.

**Esperado:** aviso claro ("guarda el email antes de invitar") o la invitación se envía al email
guardado. Si aparece un error genérico, S18 confirmada.

### O01 — Marcar como Ex-Alumno

**Precondición:** D4; anotar el total de la Base y el de Ex-Alumnos.
1. Abrir la ficha de D4 → verificar el botón "Marcar como Ex-Alumno" en la cabecera.
2. Clic → leer la confirmación → confirmar.
3. Verificar toast de éxito.
4. Sin recargar, verificar si el botón y el chip "Activo" siguen en la ficha.
5. Volver a la Base: D4 ya no está y el total bajó en 1.
6. Abrir Ex-Alumnos: D4 aparece con su Nº, sede y "Al día".
7. Abrir su ficha desde Ex-Alumnos y verificar el estado mostrado.

**Esperado:** en los pasos 4 y 7 el botón ya no aparece y el estado indica egresado. Si sigue, S5
confirmada.

### O04 / U06 — La fecha de egreso es la del egreso

**Precondición:** D13 (matrícula cuyo último pago tiene más de 12 meses, aún activa y con
certificado enviado).
1. Marcar a D13 como Ex-Alumno hoy.
2. Abrir Ex-Alumnos con el período por defecto.
3. Buscar a D13 sin escribir en el buscador (recorrer la lista).
4. Cambiar el período a "Todo" y ver el año que muestra.
5. Registrar un pago de un ex-alumno con deuda y volver a Ex-Alumnos.

**Esperado:** D13 aparece en "Últimos 12 meses" con el año actual; en el paso 5 el año del otro
egresado no cambia. Si no, S6 confirmada.

### P02 — Archivar desde la ficha

**Precondición:** D1 (con historial).
1. Ficha → "Eliminar Alumno" → verificar el modal "con historial".
2. Escribir `borrarlo` → Archivar.
3. Verificar toast y que vuelve a la lista de origen.
4. Verificar que D1 está en la Papelera.

**Esperado:** como arriba, sin errores en consola. Repetir abriendo la ficha desde Ex-Alumnos
(anotar a dónde vuelve y si sigue listado ahí).

### R01 — Tiempo real: pago

**Precondición:** 2 navegadores distintos; en B, la ficha de D1 abierta.
1. En A, registrar un pago de D1 en Pagos.
2. Sin tocar B, esperar 5 segundos.
3. Si no cambió, recargar B.

**Esperado:** en el paso 2 cambian Total pagado, Saldo y la lista. Si solo cambia en el paso 3, S3
confirmada.

### R02 — Tiempo real: asistencia

Misma precondición que R01, con una clase de D1 cuya hora ya pasó.
1. En A (instructor o Asistencia B), marcar presente esa clase.
2. Mirar B sin recargar.

**Esperado:** la tarjeta pasa a verde y el % sube. Anotar si solo cambia al recargar (S3).

### S03 — RLS: justificar inasistencia de otra sede

**Precondición:** sesión de secretaria A; id de una fila de `class_b_practice_attendance` de un
alumno de la sede B (desde admin).
1. Justificar una inasistencia de un alumno propio y copiar la petición PATCH a
   `/rest/v1/class_b_practice_attendance` ("Copy as fetch").
2. En Console, cambiar el `id=eq.` por el de la sede B y ejecutarla.
3. Verificar desde admin si esa inasistencia quedó justificada.

**Esperado:** 0 filas actualizadas. La policy de UPDATE solo mira el rol
(`20260301000011_10_rls_policies.sql:400-401`), así que es probable que funcione → reportar.

### V02 — Volver desde una tarjeta de Ex-Alumnos

1. Ventana de 375 px → Ex-Alumnos.
2. En una tarjeta, "Ver ficha".
3. Clic en "Volver" de la ficha.

**Esperado:** vuelve a Ex-Alumnos B. Si va a la Base de Alumnos, S15 confirmada.

### W01 — Re-matricular un egresado

**Precondición:** un ex-alumno B de la sede de la sesión, sin borradores pendientes en la sede.
1. Ex-Alumnos → icono "Re-matricular" → leer la confirmación con su nombre → Continuar.
2. Verificar que la URL tiene `?rut=` y se abre "Nueva Matrícula".
3. Verificar el paso 1: RUT, nombres, apellidos, email y teléfono precargados y toast "Datos
   precargados".
4. Elegir un curso y avanzar al paso 2 (sin terminar).
5. Cerrar el drawer.

**Esperado:** pasos 2–3 correctos para admin y secretaria. Si el paso 1 llega vacío, revisar si el
RUT del seed está sin puntos (`fix-042-i`).

### W03 — Re-matricular con borradores pendientes

**Precondición:** al menos un borrador de matrícula en la sede.
1. Re-matricular un egresado → Continuar.
2. Se muestra la lista de borradores → elegir "Nueva matrícula".
3. Verificar el paso 1.

**Esperado:** el paso 1 llega precargado con el egresado, no vacío ni con datos de un borrador.

### Y02 — Cambio rápido de sede en Ex-Alumnos

**Precondición:** sesión admin; DevTools → Slow 3G.
1. Elegir la sede A, inmediatamente la B e inmediatamente la A.
2. Esperar a que termine todo.

**Esperado:** la lista final es solo de la sede A (el facade no tiene guarda de respuestas fuera de
orden).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| A08 / P04 / T04 | ¿Qué pasa con la ficha y con Ex-Alumnos de un alumno archivado? |
| B05 / O01 | ¿El estado de la ficha debe ser el del alumno o el de la matrícula elegida? |
| B09 | ¿"Fecha de ingreso" es la de la primera matrícula o la de la matrícula elegida? |
| C05 / T11 | ¿Qué matrícula abre por defecto la ficha de un alumno con varias (B + Profesional, egresado re-matriculado)? |
| C06 | ¿Las matrículas canceladas deben verse en el selector? |
| F11 / F13 | ¿"Cancelar" en reprogramar debe volver a Ficha Técnica? ¿La reprogramación individual va al historial de reagendamientos con razón? |
| F04 | ¿Se permite reprogramar individualmente una clase con inasistencia/cancelada, o solo con "Reagendar Clases"? |
| H06 | ¿Se puede justificar una inasistencia que ya fue reagendada? |
| I08 / Q01–Q03 | ¿La ficha debe permitir registrar pago, ver documentos, exportar PDF y contactar? |
| M08 | ¿Se valida el formato del teléfono? |
| O05 | ¿Marcar como ex-alumno debe exigir saldo 0 (la asignación dice "12/12 y saldo 0")? Hoy solo exige certificado enviado. |
| P05 | ¿"Eliminar Alumno" debe llamarse "Archivar"? |
| T03 | ¿Un egresado re-matriculado debe aparecer en ambas listas? |
| T07 | ¿Los KPIs de Ex-Alumnos siguen al período elegido? |
| T14 | ¿Hace falta exportar la lista o bajar el certificado desde Ex-Alumnos? |
| W05 | ¿Re-matricular como admin debe cambiar la sede global elegida? |
| X02 / X04 | ¿Qué deben medir las tasas y las opiniones, y por sede? |
