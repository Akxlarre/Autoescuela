# Testing — Asistencia Clase B, inasistencias y penalización

> **Asignación:** `ASG-i-027` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/asistencia`, `/app/secretaria/asistencia` (tabs **Prácticas** y **Ciclos
> Teóricos**) + panel de inasistencias y "Reagendar Clases" de la ficha del alumno.
> **Incluye:** tabla del día, iniciar/finalizar clase desde Asistencia, marcar ausente, justificar,
> rail de alertas (Eliminar / Reactivar / Recordar), penalización por 2 faltas consecutivas (RPC),
> cron nocturno `no_show`, justificación y reagendamiento desde la ficha, alerta "2+ clases sin
> asistir" del Dashboard, tab Ciclos Teóricos (Zoom, mover/incorporar alumnos).
> **No incluye:** Asistencia Profesional (bloqueada en el piloto), portal Instructor (bloqueado),
> la Agenda por dentro (ver `026-agenda-triple-match.md`), la ficha por dentro fuera del panel de
> inasistencias (ver `024b-ficha-ex-alumnos.md`), certificación (ver `033-…`).
>
> **Código leído para armar esta lista:**
> `features/admin/asistencia/{admin-asistencia,admin-iniciar-clase-drawer,admin-finalizar-clase-drawer}.component.ts`,
> `features/secretaria/asistencia/secretaria-asistencia.component.ts`,
> `shared/components/asistencia-clase-b-content/`, `shared/components/ciclos-teoricos-content/`,
> `core/facades/{asistencia-clase-b,ciclos-teoricos,admin-alumno-detalle,dashboard-alerts,certificacion-clase-b}.facade.ts`,
> `features/admin/alumno-detalle/{inasistencia-drawer,inasistencias-drawer,reagendar-clases-drawer}/`,
> `features/dashboard/alerts-drawer/alerts-drawer.component.ts`,
> `core/utils/{class-b-session,date}.utils.ts`, `supabase/functions/send-zoom-email/`,
> migraciones `20260301000008` (trigger `trg_class_b_dropout`), `20260301000011` (RLS),
> `20260412000000`, `20260513000002` (grants), `20260709120000`, `20260804120000`,
> `20260811110000`/`20260812150000` (doble agendamiento), `20260817120000` (`archived_at`),
> `indices/DOMAIN-GOTCHAS.md` (DG-050, DG-054, DG-055, DG-075), `docs/UAT-PLAN.md` Paquete 2.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-027`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S18)** salen de leer el código, **no están confirmadas** en navegador ni en
  BD. Confirmarlas o descartarlas es parte del trabajo.
- **Reglas de negocio tal como están programadas** (para entender los casos):
  - "Consecutivas" = **número de clase** N y N+1 (no fechas). Cuentan `absent`/`no_show` vigentes
    (`archived_at IS NULL`); una justificada (`excused`) no cuenta.
  - Si existe **cualquier** par consecutivo, la RPC cancela **todas** las clases `scheduled` (1-12)
    de la matrícula, sin importar la fecha.
  - El cron corre a las **01:00 UTC** = 22:00 hora de Chile en horario de verano (hoy) / 21:00 en
    invierno. Marca `no_show` + ausente toda clase `scheduled` cuya fecha en Chile sea **hoy o
    anterior**, y aplica la penalización.
  - Con el portal Instructor bloqueado, **la única forma de registrar que el alumno vino es
    Iniciar → Finalizar en esta pantalla** (o desde "Clases Actuales" del Dashboard). Una clase
    que nadie inicia queda como inasistencia esa noche.
- **Datos con fechas en el pasado:** sembrarlos (ver §2), no esperar al reloj real. Para el cron,
  ejecutar la función a mano en un entorno de prueba (nunca en producción con datos reales).

---

## 0. Traspasado desde ASG-i-024 (Matías, 2026-10-04)

El testing de la ficha del alumno (`ASG-i-024`, track `fix-264-m`) dejó sin ejecutar los casos del
reagendamiento masivo y de la penalización, porque son de esta asignación. Se ejecutan acá.
Equivalencias con `024b-ficha-ex-alumnos.md`:

| Caso de `024b` | Se ejecuta acá como |
|---|---|
| G03 (paso 1: todas preseleccionadas, con su badge) | J04 |
| G04 (desmarcar todas deshabilita "Seleccionar Horarios") | J11 (nuevo) |
| G05 (ciclo completo del reagendamiento masivo) | J06 |
| G06, G07 (razón obligatoria, "Otro" con detalle, menos horarios que clases) | J05 |
| G08 ("Volver" desde el paso 2 conserva la selección) | J12 (nuevo) |
| G09 (reagendar solo algunas: las demás siguen en rojo o ámbar) | J07 |
| G10 (falla a mitad del guardado) | J08 |
| G11 (una inasistencia nueva tras reagendar no vuelve a penalizar por las viejas) | J07, F04 |
| G12 (un solo aviso agrupado al alumno y al instructor) | J06 |
| H08 (efecto de justificar sobre la penalización) | F04, G05 |

**Ya resuelto en `ASG-i-024`: ejecutar como regresión, no como sospecha.**

| Acá | Qué pasó | Track |
|---|---|---|
| J03 (¿una falta ya reagendada ofrece "Justificar"?) | Decidido y hecho: una inasistencia reagendada no se justifica; se ve "Reagendada" sin el botón | `hotfix-128-m` |
| J09 (tras reagendar no queda "Ausente") | La reprogramación individual también archiva la asistencia anterior y queda en el historial | `fix-279-m` |
| J06 (respeta Triple Match) | La grilla no ofrece horarios que chocan con otra clase del alumno y la base los rechaza. Tope de 2 clases por día sin contar las canceladas | `fix-299-m`, `fix-300-m`, `fix-301-m` |
| Historial de reagendamientos con 2 matrículas | El panel muestra el de la matrícula elegida | `fix-298-m` |

Tests E2E que ya cubren parte de esto: `e2e/alumnos-b-ficha.spec.ts`, casos H02 · H03 · H04 · H09,
H07, S03, F04 · F11 · F13 · E09 y N06 · N07.

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Trigger viejo de "deserción" posiblemente activo: 2 faltas cancelan la MATRÍCULA entera.** `trg_class_b_dropout` (AFTER INSERT/UPDATE en `class_b_practice_attendance`) mira las 2 asistencias más recientes del alumno por `recorded_at` (sin mirar número de clase, matrícula ni `archived_at`) y, si ambas son ausencia, pone `enrollments.status = 'cancelled'`. Ninguna migración lo elimina. Si está activo, tras la 2ª falta el alumno desaparece de Asistencia (filtra `enrollments.status='active'`), de las alertas y de la Base de Alumnos. | `migrations/20260301000008…:343-385`; `20260412000000…:18-62`; `asistencia-clase-b.facade.ts:597,695` |
| S2 | 🔴 Alta | **Cualquier usuario logueado puede ejecutar el cierre nocturno.** `mark_end_of_day_class_b_absences()` y `apply_class_b_absence_penalty()` son `SECURITY DEFINER`, sin chequeo de rol, y hay `GRANT EXECUTE ON ALL FUNCTIONS … TO authenticated`. Un alumno/instructor (o una secretaria por error) llamando la RPC a las 10:00 marcaría como inasistencia **todas las clases de hoy** (incluso las de la tarde) de todas las sedes y penalizaría. | `20260817120000…:109-165`; `20260513000002…:56,69-70` |
| S3 | 🔴 Alta | **"Reactivar" revive clases canceladas de cualquier fecha y por cualquier motivo.** Pasa a `scheduled` TODAS las `cancelled` de la matrícula (incluidas las de días pasados y las canceladas por la penalización) sin archivar la falta ni revisar disponibilidad. Las de fechas pasadas se vuelven inasistencias esa misma noche con el cron; el par de faltas sigue vigente, así que la próxima falta vuelve a cancelar todo. | `asistencia-clase-b.facade.ts:277-299`; cron `20260817120000…:123-156` |
| S4 | 🔴 Alta | **Dashboard "Borrar horarios": un clic, sin confirmación, cancela todas las clases futuras de N alumnos.** La alerta "N alumnos con 2+ clases sin asistir" cuenta clases `scheduled` cuya hora ya pasó (no faltas reales): un alumno con 2 clases hoy en la mañana que nadie "Inició" todavía cae ahí. Además no deja `cancelled_at`. | `dashboard-alerts.facade.ts:126-131,347-370`; `alerts-drawer.component.ts:203-213` |
| S5 | 🔴 Alta | **En el piloto nadie puede poner la nota de evaluación → nadie llega a certificación.** "Finalizar" desde Asistencia no escribe `evaluation_grade` (a propósito, fix-115-m: es del instructor), pero el portal Instructor está bloqueado. Certificación cuenta clases con `evaluation_grade` no nulo. El toast dice "Evaluación y asistencia registradas" aunque no hay evaluación. | `asistencia-clase-b.facade.ts:420-478`; `certificacion-clase-b.facade.ts:459-464`; `pilot-phase.config.ts:7-11` |
| S6 | 🟠 Media | **Marcar ausente / justificar no revisan errores de BD.** El `upsert`/`update` no mira `error` (Supabase no lanza excepción): si RLS o la red fallan, igual sale "Asistencia marcada" / "Justificación registrada" y la fila cambia en pantalla. Error de la RPC de penalización también se ignora. | `asistencia-clase-b.facade.ts:153-186,205-226,499-502` |
| S7 | 🟠 Media | **Justificar no revierte la penalización ni refresca las alertas.** La falta pasa a `excused` (deja de contar para el futuro), pero las clases ya canceladas siguen canceladas y el alumno sigue en el rail de alertas hasta recargar. | `asistencia-clase-b.facade.ts:199-232`; RPC `20260817120000…:69-94` |
| S8 | 🟠 Media | **Alerta "faltas consecutivas" cuenta todas las faltas, no consecutivas.** 2 faltas separadas (clase 2 y 7) salen como "2 faltas" en rojo con "Eliminar" y el tooltip "2 inasistencias consecutivas". "Última falta" usa `recorded_at` en UTC (fecha en que se marcó, no la de la clase). | `asistencia-clase-b.facade.ts:739-755`; `asistencia-clase-b-content.component.ts:1076-1079,1097-1101` |
| S9 | 🟠 Media | **"Eliminar" → "Reactivar" no sobrevive a una recarga.** `horarioActivo` se calcula con el estado de la sesión de la falta (`no_show`, nunca `cancelled`), así que tras "Actualizar" vuelve a mostrar "Eliminar" y el botón Reactivar desaparece. | `asistencia-clase-b.facade.ts:736,752` vs `264-266` |
| S10 | 🟠 Media | **"Solo después de la hora" es solo visual.** El facade no valida la hora; un reloj de PC adelantado (o una llamada directa) marca ausente una clase futura y dispara la penalización. | `asistencia-clase-b-content.component.ts:568,1070-1073`; `asistencia-clase-b.facade.ts:142-196` |
| S11 | 🟠 Media | **Día consultado en UTC.** El rango del día se arma sin zona horaria (`T00:00:00`–`T23:59:59`) y la BD lo interpreta en UTC: en invierno (UTC-4) la clase de 20:00 aparece al día siguiente; hoy (UTC-3) cualquier clase ≥ 21:00 (p. ej. reprogramación manual) cae en el día siguiente. | `asistencia-clase-b.facade.ts:22-24,594-595` |
| S12 | 🟠 Media | **Secretaria: el filtro de sede es solo del navegador.** RLS de `class_b_sessions` y `class_b_practice_attendance` deja a la secretaria leer y modificar **todas las sedes**. La pantalla toma `branchId` una vez en `ngOnInit`; si es `null` (secretaria sin sede o sesión aún no cargada tras F5) ve todas las sedes; con grant multi-sede no puede cambiar de sede. | `secretaria-asistencia.component.ts:82-92`; `20260301000011…:346-363,393-403` |
| S13 | 🟠 Media | **`send-zoom-email` es un relay abierto de correo.** Solo exige estar logueado; destinatarios, enlace y texto vienen del navegador y se insertan sin escapar en el HTML. Cualquier cuenta podría enviar correos de phishing con la marca de la escuela. | `supabase/functions/send-zoom-email/index.ts:89,98,120-138` |
| S14 | 🟡 Baja-Media | **Clase `in_progress` de un día anterior invisible en Asistencia** y bloquea al instructor ("ya tiene una clase en curso"). Conocido (DG-054) y sin resolver aquí. | `asistencia-clase-b.facade.ts:594-596`; `20260804120000…:9-18` |
| S15 | 🟡 Baja-Media | **Firmas no se guardan:** el drawer captura la imagen de la firma, pero solo se guarda `true/false`. | `asistencia-clase-b.facade.ts:437-442` |
| S16 | 🟡 Baja | **Reagendar no es atómico:** recicla clase por clase; si falla a la mitad (p. ej. choque de horario), quedan unas reagendadas y otras no, sin historial. | `admin-alumno-detalle.facade.ts:1545-1590` |
| S17 | 🟡 Baja | **Tiempo real de la ficha probablemente muerto:** el canal escucha `class_b_practice_attendance`, `absence_evidence` y tablas Profesional, que no están en `supabase_realtime`; mismo patrón de fix-227-m. Asistencia B no tiene tiempo real. | `admin-alumno-detalle.facade.ts:240-280` |
| S18 | 🟡 Baja | **Detalles de la pantalla:** subtítulo siempre dice la fecha de hoy aunque mires otro día; KPI "Tasa" cuenta clases pendientes como no asistidas (de mañana marca 0%) y su tendencia "vs mes anterior" es siempre 0; "Inasistencias Hoy" es del día elegido e incluye justificadas; tabla ordenada por hora real de inicio, no por hora agendada; `todayIsoVal` se congela si la pantalla queda abierta pasada la medianoche; fecha elegida persiste en el facade singleton; "Actualizar" no recarga el roster del ciclo; en "Todas" se puede mover un alumno a un ciclo de otra sede; certificado médico de la ficha es "simulado" (el archivo no se sube) y solo existe para Profesional. | `asistencia-clase-b-content.component.ts:98,848-857,946`; `asistencia-clase-b.facade.ts:62,598,768,777`; `ciclos-teoricos.facade.ts:117-128`; `ciclos-teoricos-content.component.ts:751-755`; `admin-inasistencia-drawer.component.ts` (`fileUrl: null`); `admin-inasistencias-drawer.component.ts` (botón solo si ≠ class_b) |

---

## 2. Datos de prueba necesarios

Sembrar en un entorno de prueba (seed tipo `0008-i` + ajustes con fechas en el pasado). Anotar el
alumno/matrícula usado.

| Dato | Cómo debe estar | Para qué | Alumno usado |
|---|---|---|---|
| D1 | Clase B activo, 12 clases agendadas, la clase de hoy a una hora que ya pasó | Iniciar / Finalizar / Ausente | |
| D2 | Clase de hoy a una hora **futura** (más tarde) | "Ausente" no debe aparecer | |
| D3 | Clase 3 ya `no_show` (sembrada ayer) y clase 4 hoy, hora pasada | 2ª falta consecutiva → penalización | |
| D4 | Clase 2 `no_show` y clase 5 hoy, hora pasada | 2 faltas NO consecutivas | |
| D5 | Clase 3 `excused` (justificada) y clase 4 hoy | Justificada rompe la cadena | |
| D6 | Alumno ya penalizado (clases 5-12 `cancelled`, 3 y 4 `no_show`) | Reagendar, Reactivar, Recordar | |
| D7 | Clase `scheduled` de **ayer**, nadie la inició | Cron / alerta del Dashboard | |
| D8 | Clase `in_progress` de **ayer** del instructor I1 | S14 | |
| D9 | 2 clases hoy en la mañana del mismo alumno, sin iniciar | Alerta Dashboard (S4) | |
| D10 | Clase agendada a las 21:00 o 21:30 (reprogramación manual) | S11 | |
| D11 | Clases en sede A y en sede B el mismo día | Aislamiento entre sedes | |
| D12 | Alumno con 1 sola falta | Alerta amarilla + "Recordar" | |
| D13 | Alumno con 1 falta y **sin** cuenta de usuario (`students.user_id` nulo) | Error de "Recordar" | |
| D14 | Vehículo con `current_km` conocido; otro vehículo de la sede | Iniciar con cambio de vehículo | |
| D15 | Ciclo teórico activo con roster y otro ciclo de la misma sede; un ciclo de la otra sede | Tab Ciclos | |
| D16 | Alumno con emails reales de prueba (no de alumnos) | Envío Zoom | |
| D17 | Matrícula `withdrawn` o `completed` con clases `scheduled` | Cron no debería tocarla | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede;
secretaria sin sede; una cuenta alumno o instructor (solo para S2, en entorno de prueba).

**Consulta útil (solo lectura, SQL Editor):**
`select tgname, tgenabled from pg_trigger where tgname in ('trg_class_b_dropout','trg_prevent_double_booking','trg_prevent_concurrent_in_progress');`
— responde S1 antes de empezar.

---

## 3. Casos

### A. Carga y acceso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app/admin/asistencia` | Skeleton (tabla + rail) → tab Prácticas del día. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/asistencia` | Igual, solo clases de su sede, sin columna Sede | ✓ | |
| A03 | Secretaria escribe `/app/admin/asistencia` | Acceso denegado | ✓ | |
| A04 | Salir y volver | Datos al instante, sin skeleton | — | |
| A05 | F5 directo en la ruta de secretaria **(§4)** | Solo su sede, nunca todas (S12) | ✓ | |
| A06 | Menú lateral → Asistencia | Llega a la pantalla y al tab Prácticas | ✓ | |
| A07 | Red cortada al cargar | Hoy no hay mensaje de error: queda vacío "Sin resultados" — anotar | — | |
| A08 | Desktop 1440×900 | La página no scrollea; scroll dentro de la tabla y del rail; `thead` fijo (spec 0030 AC1/AC3) | ✓ | |
| A09 | Alternar tabs Prácticas / Ciclos | Sin salto de la fila de tabs ni aparición de scrollbar | — | |

### B. Tabla del día (Prácticas)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Columnas | Agendada, Inicio, Fin, (Sede), Instructor, Alumno, Vehículo, Estado, Acciones | ✓ | |
| B02 | Hora agendada | Hora de Chile correcta | ✓ | |
| B03 | Orden de filas | Por hora agendada — hoy ordena por hora real de inicio (S18) | — | |
| B04 | Clases canceladas y reservas del wizard (`reserved`) | No aparecen | ✓ | |
| B05 | Clase de matrícula retirada/finalizada/cancelada | No aparece | ✓ | |
| B06 | Clase a las 21:00+ (D10) **(§4)** | Aparece en su día (S11) | — | |
| B07 | Cambiar la fecha a ayer y a mañana | Recarga con skeleton; mañana muestra "Solo lectura" y sin botones Iniciar/Ausente | ✓ | |
| B08 | Subtítulo del hero al mirar otra fecha | Debería reflejar la fecha elegida (S18) | — | |
| B09 | Borrar la fecha del selector | No pasa nada (así está programado) | — | |
| B10 | Filtros de estado (Todos/Presente/Ausente/En curso/Pendiente) con contadores | Filtran bien; los contadores suman el total | ✓ | |
| B11 | Filtro instructor y volver a "Todos" | ¿Se puede volver a todos? (el select no tiene limpiar) | — | |
| B12 | Filtro instructor + estado | Intersección correcta; contadores de estado no siguen al instructor — anotar | — | |
| B13 | Fecha sin clases o filtro sin resultados | "Sin resultados", sin "Cargar más" | ✓ | |
| B14 | Botón "Actualizar" (hero y tabla) | Recarga tabla, alertas y ciclos | ✓ | |
| B15 | Pantalla abierta pasada la medianoche | "Hoy" y "Solo lectura" siguen correctos (S18) | — | |
| B16 | Clase `in_progress` de ayer (D8) | Visible y destacada en algún lado de Asistencia (S14) | — | |

### C. Iniciar clase (sin portal Instructor)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | "Iniciar" en D1 **(§4)** | Drawer con alumno, Nº clase, hora, instructor; odómetro precargado con km del vehículo | ✓ | |
| C02 | Comenzar clase | Fila "En curso", hora real de inicio, KPI En Curso +1, Dashboard "Clases Actuales" actualizado | ✓ | |
| C03 | Km vacío, negativo, > 999.999 | Botón deshabilitado / mensaje | ✓ | |
| C04 | Km menor que el `current_km` del vehículo | Debería advertir — hoy lo acepta | — | |
| C05 | Cambiar vehículo en el selector (D14) | Precarga el km de ese vehículo; la fila queda con el vehículo nuevo | — | |
| C06 | Elegir un vehículo en mantención o en uso por otra clase | ¿Lo permite? Anotar | — | |
| C07 | Iniciar una 2ª clase del mismo instructor con otra en curso | Error "El instructor ya tiene una clase en curso…" dentro del drawer | ✓ | |
| C08 | Iniciar antes de la hora agendada (D2) | Permitido — confirmar que es lo deseado | — | |
| C09 | Doble clic en "Comenzar Clase" | Una sola actualización | — | |
| C10 | Cancelar el drawer | La fila sigue Pendiente | ✓ | |
| C11 | Iniciar desde el Dashboard ("Clases Actuales") y mirar Asistencia | Coherente en ambos (DG-055) | — | |

### D. Finalizar clase

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | "Finalizar" en una clase en curso **(§4)** | Drawer con km de salida; exige km de retorno mayor | ✓ | |
| D02 | Km retorno ≤ km salida | Mensaje y botón deshabilitado | ✓ | |
| D03 | Km retorno absurdo (+5.000 km) | ¿Advierte? Anotar | — | |
| D04 | Cerrar clase sin firmas | Fila "Presente"/"Finalizada", hora fin, tasa recalculada | ✓ | |
| D05 | Cerrar con firmas del alumno e instructor | ¿Se puede ver la firma después? (S15) | — | |
| D06 | Km del vehículo después de cerrar | `current_km` = km de retorno (Flota) | — | |
| D07 | Evaluación / nota de la clase **(§4)** | No existe en este drawer; queda sin nota → certificación (S5) | — | |
| D08 | Toast al cerrar | Dice "Evaluación y asistencia registradas" aunque no hay evaluación (S5) | — | |
| D09 | Ficha del alumno tras cerrar | Clase completada, progreso +1 | — | |
| D10 | Notificación "clase completada" | No debe decir "por el instructor" si cerró la secretaria (DG-059) | — | |
| D11 | Fallo de red al cerrar | Mensaje en el drawer; la clase sigue En curso | — | |

### E. Marcar ausente

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Clase con hora futura (D2) | Botón "Ausente" no aparece | ✓ | |
| E02 | Justo a la hora agendada (esperar el minuto) | Aparece al recargar/actualizar (no aparece solo) — anotar | — | |
| E03 | Clase con hora pasada (D1) | Botón visible → modal "Marcar inasistencia" | ✓ | |
| E04 | Cancelar el modal | Sigue Pendiente (fix-035-m AC1) | ✓ | |
| E05 | Confirmar (1ª falta) **(§4)** | "Ausente", toast, alerta amarilla "1 falta" con "Recordar", sin penalización | ✓ | |
| E06 | Reloj del PC adelantado 3 horas **(§4)** | No debería poder marcar una clase futura (S10) | — | |
| E07 | Volver a marcar presente una ausente | No existe botón — ¿cómo se corrige un error? (§5) | — | |
| E08 | Clase en curso: el alumno se fue | No hay "Ausente" en curso — anotar | — | |
| E09 | Falla de BD al marcar **(§4)** | Toast de error y la fila sin cambios (S6) | — | |
| E10 | Mismo caso en secretaria | Igual (fix-035-m AC3) | ✓ | |
| E11 | Doble clic en "Marcar ausente" del modal | Una sola falta | — | |

### F. Penalización (2 consecutivas)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | 2ª falta consecutiva (D3) **(§4)** | Toast "Agenda liberada…se cancelaron N clase(s)"; clases 5-12 canceladas; matrícula sigue **activa** (S1) | ✓ | |
| F02 | 2 faltas no consecutivas (D4) **(§4)** | Sin penalización; pero la alerta sale roja "2 faltas" con "Eliminar" (S8) | ✓ | |
| F03 | Justificada entre medio (D5): falta 3 justificada + falta 4 | Sin penalización | ✓ | |
| F04 | Falta → justificar → otra falta consecutiva a la primera **(§4)** | Sin penalización | ✓ | |
| F05 | Clases reagendadas fuera de orden (la 5 antes que la 4 por fecha) | "Consecutivas" es por número, no por fecha — ¿correcto? (§5) | — | |
| F06 | Qué cancela la penalización | Solo `scheduled` 1-12 de esa matrícula; incluye clases de hoy más tarde; no toca completadas ni en curso | — | |
| F07 | Otra matrícula del mismo alumno (refuerzo) | No se ve afectada | — | |
| F08 | Alumno tras la penalización en Base de Alumnos / Agenda / ficha | Sigue en la Base; ficha con "Cancelada — pendiente de reagendar"; cupos libres en la Agenda | — | |
| F09 | Notificación al alumno por la penalización | ¿Se le avisa? (no hay código que lo haga) — §5 | — | |

### G. Justificar (tabla del día)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | "Justificar" en una ausente | Modal; "Guardar" deshabilitado con texto vacío o solo espacios | ✓ | |
| G02 | Guardar motivo | Badge "Justificada", botón "Ver motivo" con tooltip | ✓ | |
| G03 | "Ver motivo" con texto largo y saltos de línea | Se lee completo con scroll | — | |
| G04 | Cerrar modal con X, Escape y clic afuera | Se cierra sin guardar | ✓ | |
| G05 | Justificar la 2ª falta ya penalizada **(§4)** | ¿Vuelven las clases canceladas? Hoy no (S7) — §5 | — | |
| G06 | Alerta del alumno tras justificar | Debería bajar/desaparecer sin recargar (S7) | — | |
| G07 | Justificar una falta que marcó el cron (sin fila previa manual) | Se guarda; tras recargar sigue "Justificada" | — | |
| G08 | Justificar con falla de BD | Toast de error, no "Justificada" (S6) | — | |
| G09 | Certificado médico | En Clase B no hay dónde adjuntarlo (solo texto) — §5 | — | |
| G10 | Recargar tras justificar | Persiste "Justificada" y el motivo | ✓ | |

### H. Rail de alertas (Eliminar / Reactivar / Recordar)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Sin alertas | El rail no aparece; la tabla ocupa todo — ¿aceptable? | — | |
| H02 | Alerta amarilla (D12) | Nombre, "1 falta · últ. DD-MM" (fecha correcta en Chile, S8), botón Recordar | ✓ | |
| H03 | "Recordar" **(§4)** | Spinner solo en esa fila; toast; notificación le llega al alumno (fix-093-b) | ✓ | |
| H04 | "Recordar" a D13 (sin cuenta) | Toast "no tiene una cuenta asociada" | — | |
| H05 | Alerta roja (D6) | Botón "Eliminar" | ✓ | |
| H06 | "Eliminar" → confirmar | Cancela clases agendadas; muestra "Reactivar" | ✓ | |
| H07 | "Eliminar" sobre alumno ya penalizado | No hay nada que cancelar, igual "Horario eliminado" — anotar | — | |
| H08 | Recargar tras "Eliminar" | Debe seguir mostrando "Reactivar" (S9) | ✓ | |
| H09 | "Reactivar" **(§4)** | Solo las canceladas por "Eliminar" y futuras; nunca fechas pasadas (S3) | — | |
| H10 | "Reactivar" cuando el cupo ya lo tomó otro alumno | Error claro; nada a medias | — | |
| H11 | Alerta de alumno con clases reagendadas (falta archivada) | No aparece | ✓ | |
| H12 | Filtro de sede en alertas | Solo alumnos de la sede elegida | ✓ | |
| H13 | Nombre largo en el rail | No rompe; tooltip de política | — | |

### I. Cron nocturno

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Clase de ayer sin iniciar (D7) tras el cron **(§4)** | `no_show` + ausente; si hay par consecutivo, penaliza | — | |
| I02 | Clase en curso a la hora del cron | Queda `in_progress` (no se cierra sola) | — | |
| I03 | Clase de 20:00 que se inicia tarde (después del cron en invierno) | ¿Ya quedó ausente? Anotar (hoy cron = 22:00 verano) | — | |
| I04 | Matrícula retirada/finalizada con clases agendadas (D17) | ¿El cron les marca faltas? (no filtra estado de matrícula) | — | |
| I05 | Ejecución doble del cron | Idempotente | — | |
| I06 | Cambio de horario (abril/septiembre) | Cron sigue en 01:00 UTC → hora local cambia; revisar que no marque clases del día aún en curso | — | |
| I07 | **Seguridad (S2)** **(§4)** | Un usuario no staff no puede ejecutarlo | — | |
| I08 | Día con 100% clases iniciadas/cerradas | Cron no marca nada | — | |

### J. Ficha del alumno: inasistencias y reagendar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Panel "Inasistencias Registradas" | Lista faltas con Nº clase, fecha, instructor, "Justificado"/"Reagendada" | ✓ | |
| J02 | Justificar desde la ficha | Toast y badge; mismo efecto que desde Asistencia | ✓ | |
| J03 | Falta ya reagendada | ¿Debe ofrecer "Justificar"? Hoy sí | — | |
| J04 | "Reagendar Clases" paso 1 (D6) | Todas pre-marcadas; badges Cancelada / Inasistencia / Inasistencia — Justificada | ✓ | |
| J05 | Paso 2: razón obligatoria, "Otro" exige texto, cantidad de horarios = seleccionadas | Validaciones correctas | ✓ | |
| J06 | Reagendar todo **(§4)** | Vuelven a la agenda (azules), respetan Triple Match, historial registrado, notificación | ✓ | |
| J07 | Reagendar solo las canceladas, no las 2 faltas **(§4)** | Una nueva falta aislada no debería cancelar todo otra vez | — | |
| J08 | Choque a mitad del reagendamiento | Todo o nada (S16) | — | |
| J09 | Tras reagendar, Asistencia del nuevo día | Clase "Pendiente", no "Ausente" (DG-075) | ✓ | |
| J10 | Ficha abierta en otra sesión mientras se justifica | ¿Se actualiza sola? (S17) | — | |
| J11 | Paso 1: desmarcar todas las clases (traspasado de `024b` G04) | "Seleccionar Horarios (0)" deshabilitado | ✓ | |
| J12 | "Volver" desde el paso 2 (traspasado de `024b` G08) | Vuelve al paso 1 con la selección intacta | — | |

### K. Dashboard y otros módulos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Alerta "N alumnos con 2+ clases sin asistir" con D9 **(§4)** | No debería contar clases de hoy aún no registradas (S4) | — | |
| K02 | "Borrar horarios" en esa alerta **(§4)** | Debe pedir confirmación y no borrar a alumnos sanos (S4) | — | |
| K03 | KPI inasistencias del Dashboard Ejecutivo vs Asistencia | Coherentes (el ejecutivo cuenta archivadas) | — | |
| K04 | Alumno con 12/12 cerradas en el piloto **(§4)** | ¿Aparece para certificación? (S5) | — | |
| K05 | Horas del instructor (liquidación) tras cerrar clases desde aquí | Se suman | — | |

### L. Tab Ciclos Teóricos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Abrir el tab | Selector con ciclos de los últimos 3 meses (Activos/Finalizados); autoselecciona el activo | ✓ | |
| L02 | Sin ciclos | Mensaje vacío | — | |
| L03 | Cambiar de ciclo | Clases 1-6 y roster del ciclo; buscador se limpia | ✓ | |
| L04 | Guardar tema y enlace Zoom | Toasts; persisten al recargar | ✓ | |
| L05 | Enlace inválido ("hola") | ¿Lo acepta? Anotar | — | |
| L06 | Enviar sin enlace | Botón deshabilitado | ✓ | |
| L07 | Enviar a destinatarios (D16), desmarcar uno, "todos" | Solo a los marcados; badge "Enviado el…"; reenviar | — | |
| L08 | Envío parcial / falla del SMTP | "Envío parcial" / error | — | |
| L09 | **Seguridad (S13)** **(§4)** | La función no debe enviar a correos arbitrarios | — | |
| L10 | Mover alumno a otro ciclo | Sale del roster | ✓ | |
| L11 | Admin en "Todas": mover a ciclo de otra sede | No debería permitirse (S18) | — | |
| L12 | Incorporar alumno de otro ciclo | Solo candidatos de la misma sede; entra al roster | ✓ | |
| L13 | "Actualizar" tras cambios en otra sesión | Roster refrescado (S18) | — | |
| L14 | Asistencia a teóricas | No existe (spec: "sin asistencia") — confirmar | — | |

### M. Sedes y roles

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Admin "Todas" | Columna Sede, clases de todas | ✓ | |
| M02 | Admin cambia de sede | Recarga sola (tabla, alertas, ciclos) | ✓ | |
| M03 | Cambio rápido A→B→A | Termina en A sin mezclar | — | |
| M04 | Secretaria con grant multi-sede | ¿Puede ver la otra sede? Hoy no (S12) | — | |
| M05 | Secretaria sin sede | Nunca todas las sedes (S12) | — | |
| M06 | **RLS** **(§4)** | Secretaria A no lee ni modifica clases de B | ✓ | |
| M07 | Admin → cerrar sesión → secretaria en la misma pestaña | No ve por un instante datos de todas las sedes (facade singleton) | — | |

### N. Tiempo real y 2 sesiones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | 2 sesiones: A marca ausente | B no se entera hasta "Actualizar" (no hay tiempo real) — ¿aceptable? | — | |
| N02 | 2 sesiones: A y B marcan ausente la misma clase **(§4)** | Una sola falta, sin error | — | |
| N03 | 2 sesiones: A inicia, B intenta iniciar la misma clase | B recibe error o ve que ya está en curso | — | |

### O. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Modo oscuro/claro | Badges, rail y modales legibles | ✓ | |
| O02 | 375 px | Tabla con scroll horizontal dentro del card, 6 filas + "Cargar más", rail debajo | ✓ | |
| O03 | "Cargar más" y cambiar filtro/fecha/tab | Vuelve a 6 (spec 0030 AC6) | ✓ | |
| O04 | Drawer abierto en desktop | Rail se apila y densidad baja (AC7) | — | |
| O05 | Solo teclado | Tabs, botones y modales accesibles | — | |

---

## 4. Casos con pasos numerados

### A05 — F5 de la secretaria no muestra todas las sedes

**Precondición:** secretaria de sede A; clases hoy en A y B (D11).
1. Entrar a Asistencia.
2. Presionar F5 y esperar la carga.
3. Repetir con DevTools → Slow 3G.

**Esperado:** solo clases de A, sin columna Sede, en ambos intentos. Si aparece alguna de B, S12
confirmada.

### B06 — Clase de noche en su día

**Precondición:** D10 (clase hoy a las 21:00 o más tarde).
1. Asistencia con la fecha de hoy → buscarla.
2. Cambiar a mañana → buscarla.

**Esperado:** aparece hoy y no mañana. Si es al revés, S11 confirmada (en invierno pasa con la de 20:00).

### C01 — Iniciar clase

**Precondición:** D1, D14; secretaria.
1. Clic en "Iniciar" de D1.
2. Verificar datos del drawer y km precargado = `current_km`.
3. Cambiar al otro vehículo → verificar km nuevo.
4. "Comenzar Clase".
5. Verificar fila "En curso", hora de inicio, KPI "En Curso" y el Dashboard.

**Evidencia:** captura del paso 5.

### D01 / D07 — Finalizar clase y nota de evaluación

**Precondición:** la clase de C01 en curso.
1. Clic en "Finalizar".
2. Ingresar km = salida → verificar mensaje y botón deshabilitado.
3. Ingresar km = salida + 15, firmar ambos.
4. "Cerrar Clase".
5. Abrir la ficha de D1 → clase completada; buscar la nota/evaluación.
6. En SQL (solo lectura): `select evaluation_grade, student_signature from class_b_sessions where id = …`.

**Esperado:** clase cerrada. `evaluation_grade` quedará vacío y no hay forma de ponerlo sin portal
Instructor (S5): anotar para §5.

### E05 — Primera falta

**Precondición:** D1 sin faltas previas, hora pasada.
1. Clic en "Ausente" → confirmar.
2. Verificar toast, fila "Ausente", KPI Inasistencias +1.
3. Verificar alerta amarilla con "1 falta" y fecha de hoy.
4. En la ficha: clases 2-12 siguen agendadas.

**Esperado:** sin toast de "Agenda liberada".

### E06 — Marcar ausente antes de la hora

**Precondición:** D2 (clase hoy en 3 horas). Solo en un PC de prueba.
1. Adelantar el reloj de Windows 4 horas.
2. Recargar Asistencia → ¿aparece "Ausente" en D2?
3. Si aparece, marcarla. Restaurar el reloj.

**Esperado:** no debería poder (S10). Si se pudo, revertir el dato y reportar.

### E09 — Falla al marcar ausente

1. DevTools → Network → bloquear el patrón `class_b_practice_attendance` (Request blocking).
2. Marcar ausente una clase.
3. Quitar el bloqueo y "Actualizar".

**Esperado:** en el paso 2 toast de error; en el 3 la clase sigue como antes. Si mostró "Asistencia
marcada" y al actualizar cambió de estado sin fila de asistencia, S6 confirmada.

### F01 — Penalización por 2 consecutivas

**Precondición:** D3 (clase 3 `no_show`, clase 4 hoy hora pasada). Consulta S1 hecha.
1. Anotar en la ficha: estados de 1-12 y estado de la matrícula.
2. Marcar ausente la clase 4.
3. Verificar toast "…se cancelaron N clase(s) futura(s)" con N = clases agendadas restantes.
4. Actualizar Asistencia: la fila y la alerta roja deben seguir visibles.
5. Ficha: clases 5-12 "Cancelada — pendiente de reagendar".
6. Base de Alumnos: el alumno sigue ahí; SQL: `enrollments.status` = `active`.
7. Agenda: los cupos del instructor quedaron libres.

**Esperado:** como arriba. Si la matrícula quedó `cancelled` o el alumno desapareció, S1 confirmada → P0.

### F02 — Faltas no consecutivas

**Precondición:** D4 (clase 2 `no_show`, clase 5 hoy).
1. Marcar ausente la 5.
2. Verificar: sin toast de penalización; clases 6-12 agendadas.
3. Mirar el rail.

**Esperado:** sin cancelaciones. El rail mostrará "2 faltas" en rojo con "Eliminar" (S8): anotar.

### F04 — Falta, justificación y otra falta

**Precondición:** alumno con clase 3 hoy (hora pasada) y clase 4 sembrada para hoy también.
1. Marcar ausente la 3.
2. Justificarla ("Certificado médico").
3. Marcar ausente la 4.

**Esperado:** sin penalización (la 3 no cuenta). Alerta con 1 falta viva.

### G05 — Justificar después de la penalización

**Precondición:** alumno de F01 ya penalizado.
1. Justificar la falta de la clase 4.
2. Revisar la ficha y la Agenda.

**Esperado:** anotar si las clases 5-12 vuelven o siguen canceladas (hoy siguen: S7). Decisión en §5.

### H03 — Recordar

**Precondición:** D12 con cuenta de alumno.
1. Clic en "Recordar" → verificar spinner solo en esa fila.
2. Iniciar sesión como el alumno (entorno de prueba) o revisar la tabla `notifications`.

**Esperado:** notificación "Recordatorio de asistencia" con el número de faltas. (El portal Alumno
está bloqueado en el piloto: confirmar por la tabla.)

### H09 — Reactivar no revive fechas pasadas

**Precondición:** D6 con al menos una clase cancelada con fecha ya pasada (sembrar).
1. En el rail, "Eliminar" → confirmar.
2. "Reactivar".
3. Revisar en la ficha qué clases volvieron.
4. (Entorno de prueba) Ejecutar el cron (I01) y revisar de nuevo.

**Esperado:** solo vuelven las canceladas por "Eliminar" y futuras. Si vuelve alguna pasada y el
cron la convierte en falta, o se vuelve a cancelar todo, S3 confirmada.

### I01 — Cron nocturno

**Precondición:** entorno de prueba; D7 (clase de ayer sin iniciar), D8, D17.
1. En SQL Editor: `select public.mark_end_of_day_class_b_absences();`
2. Revisar D7: `no_show` + fila de asistencia `absent`.
3. Revisar D8: sigue `in_progress`.
4. Revisar D17: anotar si le marcó faltas.
5. Si D7 formaba par consecutivo, clases futuras canceladas.
6. Ejecutar de nuevo el paso 1 → nada cambia.

### I07 — Seguridad: ejecutar el cierre como alumno (S2)

**Precondición:** entorno de prueba; sesión de alumno o instructor; clases de hoy más tarde.
1. En la app con esa sesión, copiar desde Network una petición a `/rest/v1/` ("Copy as fetch").
2. En Console, cambiarla a `POST /rest/v1/rpc/mark_end_of_day_class_b_absences` con body `{}`.
3. Revisar las clases de hoy de la tarde.

**Esperado:** 401/403 y ninguna clase cambiada. Si las clases de la tarde quedaron ausentes, S2
confirmada → **P0 inmediato**. Repetir con `apply_class_b_absence_penalty`.

### J06 — Reagendar todo

**Precondición:** D6.
1. Ficha → "Reagendar Clases" → dejar todo marcado → "Seleccionar Horarios".
2. Razón = "Otro" sin texto → verificar mensaje.
3. Elegir instructor y exactamente N horarios (máx. 2 por día).
4. "Guardar Reagendamiento".
5. Verificar: clases azules con nuevas fechas, historial de reagendamientos, notificación al alumno.
6. Asistencia en la fecha de una clase nueva: "Pendiente".
7. Marcar ausente una sola clase nueva (no consecutiva a otra falta viva).

**Esperado:** en el paso 7, sin penalización (las faltas viejas están archivadas).

### J07 — Reagendar solo las canceladas

**Precondición:** otro alumno como D6.
1. Reagendar desmarcando las 2 faltas (3 y 4).
2. En la fecha de la clase 5 nueva, marcarla ausente.

**Esperado:** anotar si se cancelan otra vez todas (el par 3-4 sigue vivo). Decisión en §5.

### K01 / K02 — Alerta "2+ clases sin asistir" del Dashboard

**Precondición:** D9 (2 clases hoy en la mañana, sin iniciar); hora actual posterior a ambas.
1. Dashboard → alertas: ¿aparece el alumno?
2. Sin hacer clic en "Borrar horarios", anotar cuántos alumnos cuenta y quiénes.
3. (Entorno de prueba) clic en "Borrar horarios".

**Esperado:** no debería contar clases de hoy que aún se pueden registrar; el botón debería pedir
confirmación. Si cancela todo sin preguntar, S4 confirmada.

### K04 — Certificación en el piloto

**Precondición:** alumno con 12 clases cerradas desde Asistencia (sembrar 11 + cerrar 1).
1. Ir a Certificación Clase B.
2. Buscar al alumno.

**Esperado:** anotar si figura con 12 prácticas o con 0 (S5). Si no puede certificarse, P0 de negocio.

### L09 — Seguridad: correo Zoom a cualquiera (S13)

**Precondición:** sesión secretaria; un correo propio de prueba externo.
1. Enviar un Zoom real y copiar la petición `send-zoom-email` desde Network.
2. En Console, cambiar `recipients` a tu correo externo y `zoomLink` a `https://example.com`.
3. Ejecutar.

**Esperado:** rechazo. Si llega el correo con la marca de la escuela, S13 confirmada.

### M06 — RLS de asistencia por sede

**Precondición:** secretaria A; id de una clase de la sede B.
1. Copiar una petición a `/rest/v1/class_b_sessions` desde Network.
2. En Console, pedir esa clase de B por id (quitando el filtro de sede).
3. (Entorno de prueba) intentar un `PATCH` de `status`.

**Esperado:** 0 filas y el PATCH sin efecto. Si lee o modifica, fuga → **P0 inmediato** (S12).

### N02 — Dos sesiones marcan la misma ausencia

**Precondición:** 2 navegadores distintos, misma sede, clase pasada sin marcar.
1. En ambos, abrir el modal "Marcar inasistencia" de la misma clase.
2. Confirmar en A y luego en B.
3. Revisar la ficha.

**Esperado:** una sola falta; toast de penalización a lo más una vez.

---

## 5. Decisiones de negocio pendientes

| Caso | Pregunta |
|---|---|
| S1 / F01 | ¿2 faltas consecutivas cancelan solo las clases o también la matrícula? (hay dos reglas en BD) |
| F05 | ¿"Consecutivas" es por número de clase o por fecha? |
| F09 | ¿Se notifica al alumno cuando pierde su agenda? |
| E07 | ¿Cómo se corrige una ausencia marcada por error (volver a presente)? |
| E08 | ¿Se puede marcar ausente una clase ya iniciada? |
| C08 | ¿Se puede iniciar una clase antes de su hora? |
| G05 / S7 | ¿Justificar la falta que causó la penalización debe devolver las clases? |
| G09 | ¿Se exige certificado médico para justificar en Clase B? ¿Dónde se adjunta? |
| H07 / H09 | ¿Qué debe hacer "Eliminar"/"Reactivar" si la penalización ya canceló todo? ¿Siguen siendo necesarios? |
| J07 | ¿Reagendar solo las canceladas debe "perdonar" las faltas que causaron la penalización? |
| I04 | ¿El cron debe marcar faltas en matrículas retiradas/finalizadas? |
| S5 / K04 | ¿Quién pone la nota de cada clase mientras el portal Instructor está bloqueado? |
| K01 | ¿Qué debe medir la alerta del Dashboard: faltas reales o clases no registradas? |
| C04 / C06 | ¿Se valida km menor al actual o vehículo en mantención? |
| N01 | ¿Hace falta tiempo real en Asistencia B? |
| L14 | ¿Las clases teóricas necesitan registro de asistencia? |
