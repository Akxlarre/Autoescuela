**Análisis de Base de Datos — Sistema Escuela de Conductores** 

**Índice** 

1\. Resumen ejecutivo 

2\. Módulos y entidades 

3\. Atributos detallados por entidad 

4\. Diagrama ERD textual 

5\. Consideraciones especiales 

6\. Dependencias entre módulos 

**1\. Resumen ejecutivo** 

El sistema gestiona **dos sedes** bajo una arquitectura multi-tenant ligera: 

| Sede  | Tipo de curso  | Slug |
| :---- | :---- | :---- |
| Autoescuela Chillán  | Clase B, Clase B \+ SENCE  | `autoescuela-chillan` |
| Conductores Chillán  | Profesional A2, A3, A4, A5  | `conductores-chillan` |

Se identificaron **68 entidades** distribuidas en **14 módulos funcionales** con 128 Requisitos Funcionales. El núcleo del negocio es la tríada **Alumno** → **Matrícula** → **Clase/Promoción**, sobre la que pivota toda la lógica contable, académica y documental. 

**Roles del sistema** 

`admin` · `secretary` · `instructor` · `student` · 

**Separación Clase B vs Clase Profesional** 

Las sesiones de clase y la asistencia tienen dinámicas completamente distintas en cada sede:

| Aspecto  | Clase B (Autoescuela)  | Clase Profesional (Conductores) |
| :---- | :---- | :---- |
| Sesiones  | Individual alumno \+ instructor \+ vehículo  | Grupales dentro de una promoción |
| Secuencia  | 12 clases numeradas y ordenadas  | 30 días continuos (lunes a sábado) |
| Teoría  | Grupal, Zoom  | Zoom, marcado por secretaria/admin |
| Práctica  | 1:1 con instructor, vehículo asignado  | Bloques de maquinaria propia/arrendada |
| Firmas  | Doble firma alumno \+ instructor (RF-107)  | No aplica |
| Asistencia teórica  | `class_b_theory_attendance`  | `professional_theory_attendance` |
| Asistencia práctica  | `class_b_practice_attendance`  | `professional_practice_attendance` |
| Ficha técnica  | KM recorridos \+ GPS \+ notas desempeño  | No aplica |
| Evaluación  | Ensayos teóricos prep. examen municipal  | Notas por módulo técnico (1.0–7.0) |
| Cierre  | Clase \#12 \+ 100% asistencia teórica  | Acta final Aprobado/Reprobado |

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 1   
**2\. Módulos y entidades** 

**Módulo 1 — Gestión de Usuarios, Roles y Sedes (RF-001 a RF-015)** 

| Entidad  | RF Clave  | Descripción |
| :---- | :---- | :---- |
| `branches`  | RF-012  | Las dos sedes físicas |
| `roles`  | RF-005  | Catálogo de roles con permisos (Admin, Secretaria, Instructor B) |
| `users`  | RF-001  | Todos los actores del sistema |
| `audit_log`  | RF-009, RF-010  | Historial inmutable de acciones (crear, editar, eliminar) |
| `login_attempts`  | RF-014  | Registro de intentos fallidos para  anti-brute-force |
| `students`  | RF-006, RF-082  | Extensión de `users` con datos académicos y de licencia previa |
| `courses`  | RF-012  | Catálogo de cursos ofrecidos por sede (Clase B, A2, A3, A4, A5) |
| `sence_codes`  | —  | Códigos SENCE asociados a cursos con franquicia tributaria |

**Reglas clave:** 

• RUT chileno validado con formato \+ dígito verificador (RF-002) 

• Unicidad de email y RUT en base de datos (RF-002) 

• Admin puede autorizar a secretaria para operar en ambas sedes (RF-013) 

• Cambio de contraseña obligatorio en primer login (RF-015) 

• Timeout de sesión 30 minutos (RF-094) 

**Módulo 2 — Notificaciones y Comunicación (RF-016 a RF-025)** 

| Entidad  | RF Clave  | Descripción |
| :---- | :---- | :---- |
| `notifications`  | RF-019, RF-020  | Mensajes individuales y masivos |
| `notification_templates`  | RF-016, RF-017  | Plantillas automáticas (Zoom, cobros, alertas) |
| `alert_config`  | RF-024  | Días de anticipación configurables por tipo de alerta |

**Automatismos requeridos:** 

• Envío automático de link Zoom para clases teóricas (RF-016, RF-017) 

• Aviso de cobro 2da cuota antes de la clase 7 (RF-018) 

• Alerta al Admin cuando llega matrícula web (RF-022) 

• Notificación de encuesta post-curso (RF-023) 

• Alerta de documentos de flota próximos a vencer (RF-021) 

**Módulo 3 — Contabilidad y Cuadratura (RF-026 a RF-040)**

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 2 

| Entidad  | RF Clave  | Descripción |
| :---- | :---- | :---- |
| `payments`  | RF-026, RF-027  | Ingresos: efectivo, voucher, transferencia, tarjeta |
| `payment_denominations`  | RF-026  | Desglose de billetes y monedas por  transacción en efectivo; solo cuando `cash_amount &gt; 0` |
| `expenses`  | RF-028  | Gastos categorizados (bencina, arriendo, aseo, etc.) |
| `sii_receipts`  | RF-033  | Boletas y facturas emitidas; desglose por concepto (Clase B / Clase A / Sensometría / Otros) para cuadratura planilla |
| `cash_closings`  | RF-029, RF-032  | Cuadratura diaria con arqueo físico de billetes/monedas, diferencia y estado; bloquea edición tras cierre (RF-037) |
| `instructor_advances`  | RF-038  | Cuenta corriente interna de anticipos a instructores |
| `instructor_monthly_payments`  | RF-038  | Liquidación mensual: base\_salary −  anticipos del período \= net\_payment; trigger marca anticipos como 'deducted' |
| `standalone_courses`  | RF-035  | Catálogo de cursos singulares grupales (SENCE, Grúa, Retroexcavadora,  Maquinaria, etc.); reemplaza el esquema anterior de registro individual por alumno |
| `standalone_course_enrollments`  | RF-035  | Inscripción individual de un alumno a un `standalone_courses`; incluye pago total al inicio y certificado asociado |
| `service_catalog`  | RF-034  | Catálogo dinámico de servicios especiales con precio configurable |
| `special_service_sales`  | RF-034  | Venta individual de cada servicio; incluye metadata variable por tipo (JSONB  justificado: estructura distinta por servicio) |
| `discounts`  | —  | Descuentos comerciales aplicables a matrículas (porcentaje o monto fijo) |
| `discount_applications`  | —  | Registro de descuento aplicado a una matrícula específica |

**Reportes derivados (sin tabla propia):** 

• RF-030: Reporte contable mensual exportable a PDF/Excel — se genera consultando `payments`, `expenses`, `sii_receipts` y `cash_closings` filtrados por rango de fechas. 

• RF-031: Cálculo de Total Neto (Ingresos − Gastos) por rango de fechas — derivado de `payments` y `expenses`. **Reglas clave:** 

• Balance diario automático: Ingresos Cash − Gastos Cash (RF-029) 

• Bloqueo de edición de registros tras cuadrar el día (RF-037); `cash_closings.status` registra `'descuadre'` cuando `difference` ≠ `0` 

• Arqueo físico al cerrar caja: suma de `qty_bill_ × denominación + qty_coin_ × denominación = arqueo_amount`; `difference = arqueo_amount` − `balance` (Módulo 10, ultimos\_cambios) • Historial de cuadraturas calendario: `cash_closings` tiene `closed_by` \+ `closed_at`; no editable después de 48 horas para secretaria 

• Desglose de billetes por transacción en efectivo: `payment_denominations` (Módulo 4, ultimos\_cambios)

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 3   
• Boletas y facturas unificadas en `sii_receipts.type`; constraint garantiza que `amount_class_b + amount_class_a + amount_sensometry + amount_other = amount` 

• Liquidación mensual instructores: `instructor_monthly_payments` agrega horas × tarifa y descuenta anticipos pendientes del período 

• Indicador morosidad en dashboard secretaría (RF-039) 

• Rentabilidad estimada por curso: Ingreso − Gastos directos (RF-040) 

• Comprobante de pago interno generado por cada abono (RF-036) 

**Módulo 4 — Gestión Académica Clase B (RF-041 a RF-057)** 

Exclusivo de **Autoescuela Chillán**. Todas las sesiones son individuales (1 alumno \+ 1 instructor \+ 1 vehículo). 

| Entidad  | RF Clave  | Descripción |
| :---- | :---- | :---- |
| `instructors`  | RF-041, RF-042  | Ficha con licencia, historial vehículos, disponibilidad |
| `vehicle_assignments`  | RF-042, RF-045  | Historial instructor ↔ vehículo |
| `instructor_replacements`  | RF-044  | Sustitución con registro original vs real |
| `instructor_monthly_hours`  | RF-047  | Cálculo horas teóricas \+ prácticas (×1.5h) por mes |
| `class_b_sessions`  | RF-046, RF-048, RF-049  | Sesiones **prácticas** individuales (1 alumno \+ 1 instructor \+ 1 vehículo); secuencia 1–12; incluye KM, GPS y notas de desempeño post-clase |
| `class_b_theory_sessions`  | RF-016, RF-046, RF-051  | Sesiones teóricas grupales Zoom Clase B (link automático RF-016) |
| `class_b_theory_attendance`  | RF-051, RF-052  | Asistencia a clases teóricas Clase B (grupal Zoom) |
| `class_b_practice_attendance`  | RF-051, RF-052  | Asistencia a clases prácticas Clase B (individual) |
| `class_b_exam_scores`  | RF-057  | Puntajes de ensayos de preparación examen municipal (ingreso manual por instructor/secretaria) |
| `class_b_exam_catalog`  | RF-057  | Catálogo de ensayos online: título, tiempo límite, nº preguntas, umbral de aprobación |
| `class_b_exam_questions`  | RF-057  | Banco de preguntas de cada ensayo (enunciado, opciones A–D, respuesta correcta) |
| `class_b_exam_attempts`  | RF-057  | Intentos del alumno en ensayos online; respuestas y calificación automática |
| `route_incidents`  | RF-111  | Incidentes asociados a vehículo e instructor durante Clase B |

**Reglas clave:** 

• Advertencia al desactivar instructor con clases pendientes (RF-043) 

• Firma digital alumno al finalizar clase B práctica (RF-050) 

• "Doble Firma": instructor \+ alumno para cerrar sesión (RF-107) 

• Deserción automática: eliminar de agenda tras 2 inasistencias prácticas consecutivas (RF-053) • Gatillo RF-082.4: al completar clase \#12 \+ 100% asistencia teórica → habilitar "Generar Certificado B" • Bloqueo de firmas retroactivas (solo Admin puede autorizar, RF-106)

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 4   
• `class_b_exam_scores`: puntajes de ensayos físicos (sobre 100); difiere de `class_b_exam_attempts` (online, auto-calificado) 

• `class_b_exam_catalog`: Admin gestiona el catálogo; cada ensayo define nº de preguntas a sortear del banco y tiempo límite 

• `class_b_exam_questions`: preguntas reutilizables entre versiones del ensayo; Admin CRUD; el banco puede rotar entre intentos 

• `class_b_exam_attempts`: un alumno puede tener múltiples intentos; calificación automática al enviar; respuestas guardadas en JSONB 

**Módulo 5 — Gestión Clase Profesional (RF-058 a RF-079)** 

Exclusivo de **Conductores Chillán**. Las sesiones son grupales dentro de una promoción de 30 días.

| Entidad  | RF Clave  | Descripción |
| ----- | :---- | :---- |
| `lecturers`  | RF-058  | Profesionales con especialidad  A2/A3/A4/A5; solo dato de registro (sin acceso al sistema); pueden estar asignados a múltiples `promotion_courses`  simultáneamente |
| `lecturer_monthly_hours`  | RF-047 análogo  | Cálculo de horas por relator por mes |
| `professional_promotions`  | RF-059  | **Entidad paraguas**: período de 30 días, inicio lunes, máx 100 alumnos totales |
| `promotion_courses`  | RF-059  | Cada uno de los 4 cursos (A2/A3/A4/A5) dentro de una promoción; máx 25 alumnos c/u, relator propio |
| `professional_theory_sessions`  | RF-016, RF-078  | Sesiones teóricas Zoom por curso dentro de una promoción (link automático RF-016) |
| `professional_practice_sessions`  | RF-068  | Sesiones grupales **prácticas** de campo por curso dentro de una promoción |
| `professional_theory_attendance`  | RF-078  | Marcado manual de asistencia Zoom por secretaria/admin |
| `professional_practice_attendance`  | RF-068  | Asistencia a bloques prácticos  profesionales; registrada por  secretaria/admin |
| `professional_module_grades`  | RF-072  | Notas por módulo técnico; ingresadas por **secretaria/admin** basándose en resultados de pruebas físicas |
| `license_validations`  | RF-064, RF-065, RF-066  | A2+A4 simultáneo, libros duales,  convalidación histórica |
| `session_machinery`  | RF-073  | Maquinaria propia/arrendada registrada por sesión práctica |
| `absence_evidence`  | RF-071  | Adjunto de licencias médicas para justificar faltas |
| `professional_final_records`  | RF-074  | Concepto Aprobado/Reprobado \+ examen práctico |
| `professional_schedule_templates`  | RF-059  | Plantilla reutilizable de horario fijo para los 30 días de un curso profesional. Aplicada al crear un `promotion_courses`, genera automáticamente todas las sesiones vía T10. |

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 5 

| Entidad  | RF Clave  | Descripción |
| :---- | :---- | :---- |
| `template_blocks`  | RF-059  | Bloque horario individual dentro de una plantilla: tipo (teórico/práctico), semana 1–5, día lunes–sábado, hora inicio/fin. |

**Reglas clave:** 

• Validación edad \> 20 años y antigüedad licencia \> 2 años para A2/A4 (RF-062) — validado desde `students.birth_date` \+ `students.license_obtained_date` 

• Validación cadena: A3/A5 exige A2 o A4 previa de 2 años (RF-063) — validado desde 

`students.current_license_class` \+ `students.license_obtained_date` \+ historial de `enrollments` completadas. No requiere tabla separada. 

• Convalidación: reducción a 60h para A2+A4 simultáneos (RF-064) 

• El 2do libro de convalidación abre 2 semanas después (RF-065) 

• Convalidación histórica: vincular alumno a promociones de hasta 6 años atrás (RF-066) 

• Mínimo 75% asistencia teórica y 100% práctica para aprobar (RF-069) 

• Semáforo: Verde (OK), Amarillo (límite), Rojo (reprobado por falta) (RF-070) 

• Gatillo RF-093: certificado profesional solo si 30 días cumplidos \+ asistencia OK \+ notas ≥ 4.0 \+ pagado total **Funcionalidades absorbidas (sin tabla propia):** 

• RF-060 (Vista de Horario Relator): los relatores ya no acceden al sistema. La consulta de asignaciones y horarios de relatores es responsabilidad de secretaria/admin, derivada de `promotion_courses` \+ 

`professional_theory_sessions` \+ `professional_practice_sessions`. 

• RF-102 (Encuesta de satisfacción post-curso): funcionalidad derivada que se implementa como formulario externo (Google Forms, Typeform, etc.) con link enviado vía `notifications`. No requiere tabla propia en el sistema. 

**Módulo 6 — Gestión de Matrícula y Expediente Digital (RF-080 a RF-086)**

| Entidad  | RF Clave  | Descripción |
| :---- | :---- | ----- |
| `professional_pre_registrations`  | —  | Pre-inscripción para Clase Profesional; dos orígenes: autoservicio público  (`/matricula-online`, crea cuenta temporal en `users`) o ingreso manual por secretaria. Incluye test psicológico online, expiración automática y conversión a matrícula presencial |
| `enrollments`  | RF-080  | Formulario completo; número correlativo año-NNNN |
| `student_documents`  | RF-082  | Foto, cédula, cert. médico, SEMEP,  autorización notarial |
| `digital_contracts`  | RF-083  | Contrato aceptado digitalmente por el alumno; incluye `file_url` del PDF firmado que se muestra en el DMS |
| `certificate_issuance_log`  | RF-096  | Historial de descargas/envíos de certificados |
| `school_documents`  | —  | Documentos institucionales de la escuela (facturas folios, resoluciones MTT,  decretos); solo Admin puede eliminar |
| `document_templates`  | —  | Plantillas descargables del DMS (Contrato Clase B, HVC, Autorización Notarial, etc.); versionadas, con contador de descargas; solo Admin gestiona |

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 6   
**Repositorio DMS (Módulo 12):** La superficie del DMS agrupa tres fuentes: \- **Documentos del Alumno:** `student_documents` \+ `digital_contracts` (contratos firmados). La vista `v_dms_student_documents` los unifica (ver §5.6). \- **Documentos de la Escuela:** `school_documents` (facturas folios, resoluciones MTT, decretos). \- **Plantillas:** `document_templates` (archivos base reutilizables, solo lectura para secretaria). 

Regla transversal: solo Admin puede eliminar en cualquiera de las tres fuentes; Secretaria puede subir y visualizar. **Reglas clave:** 

• RF-082.1: Si alumno \< 18 años → bloquear hasta cargar "Autorización Notarial" 

• RF-082.2: Profesional bloqueado sin `driver_record` (HVC); puede iniciar el curso sin tener `national_id` ni `driver_license` físicamente, pero HVC es **siempre obligatorio y bloqueante** 

• RF-082.3: Alerta si Hoja de Vida tiene más de 30 días al momento de matricular 

• RF-082.4 (carnet online): alumno matriculado online debe subir `id_photo` en la plataforma antes de su primera clase presencial; sin esa foto el carnet no puede generarse 

• RF-085: Marcador visual "Documentación Completa" 

• Buscador por RUT, nombre o N° expediente (RF-081) 

**Módulo 7 — Logística de Flota y Recursos (RF-087 a RF-091)** 

| Entidad  | RF Clave  | Descripción |
| :---- | :---- | :---- |
| `vehicles`  | RF-087  | Patente, marca, modelo, año, sede |
| `vehicle_documents`  | RF-021  | SOAP, Rev. Técnica, Permiso Circulación, Seguro |
| `maintenance_records`  | RF-089  | Historial y programación de mantenciones |

**Reglas clave:** 

• Calendario de disponibilidad para evitar tope de clases (RF-088) 

• Alerta de kilometraje informativa basada en `class_b_sessions.km_end` (RF-090) 

• Validación formato patente chilena (RF-096 del módulo 8\) 

• **RF-091 Hoja de Ruta Diaria:** reporte derivado, sin tabla propia. Se genera consultando `class_b_sessions` filtrado por `(vehicle_id, DATE(scheduled_at))`, enriquecido con `students`, `instructors` y `vehicles`. Las observaciones/fallas mecánicas del footer se registran en `route_incidents`. 

**Módulo 8 — Seguridad y Administración de Sistema (RF-092 a RF-098)**

| Entidad  | RF  | Descripción |
| :---- | :---- | :---- |
| `secretary_observations`  | —  | Bitácora interna: observaciones y  recordatorios de la secretaria dirigidos al Admin; el admin puede responder y marcar como resuelto |
| `school_schedules`  | RF-095  | Horarios de operación por sede y día de semana (apertura/cierre); configurados en el panel global |

| Funcionalidad  | RF  | Descripción |
| :---- | :---- | :---- |
| Backup automático diario  | RF-092  | Nube/servidor externo |
| Encriptación datos sensibles  | RF-093  | RUT y contraseñas |
| Timeout sesión  | RF-094  | 30 min inactividad |

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 7 

| Funcionalidad  | RF  | Descripción |
| :---- | :---- | :---- |
| Panel configuración global  | RF-095  | Precios base, feriados, nombres sede |
| Bloqueo SQL injection / XSS  | RF-097  | Validaciones en formularios |
| Exportación CSV alumnos  | RF-098  | Solo Admin |

**Módulo 9 — Calidad y Reportabilidad — KPIs (RF-099 a RF-105)** 

| Entidad  | RF  | Descripción |
| :---- | :---- | :---- |
| `class_book`  | RF-103  | Libro oficial por curso dentro de una  promoción; interfaz de gestión tipo grilla (agregar/quitar alumnos, corregir datos antes del cierre); período de gracia 1 semana post-promoción; historial de libros cerrados para auditorías MTT |

**Reportes requeridos (derivados, sin tabla propia — se calculan en tiempo real consultando las entidades transaccionales):** 

• Total recaudado hoy vs ayer (RF-099) — derivado de `payments` \+ `expenses` 

• Alumnos matriculados este mes por categoría (RF-100) — derivado de `enrollments` \+ `courses` • Tasa de aprobación municipal (RF-101) — derivado de `professional_final_records` \+ `enrollments` • Productividad instructores: clases realizadas vs canceladas (RF-104) — derivado de `class_b_sessions` • Alumnos próximos a vencer plazo Clase B (RF-105) — derivado de `enrollments` \+ `class_b_sessions` **Archivo histórico de Ex-Alumnos** (`students.status = 'graduated'`): 

• Vista de archivo histórico con filtros por: año de egreso (derivado de `enrollments.updated_at WHERE status = 'completed'`), tipo de licencia obtenida (`students.current_license_class`) y N° certificado Casa de Moneda (`certificates.folio WHERE type = 'professional'`) 

• Estado de cuenta post-egreso: se obtiene consultando `enrollments.pending_balance` \+ `payments` para el `student_id` correspondiente; si `pending_balance &gt; 0` en alguna matrícula completada, el ex-alumno figura con saldo pendiente. No requiere tabla adicional. 

**Módulo 10 — Reglas de Negocio y Validaciones (RF-106 a RF-112)** 

| Entidad  | RF  | Descripción |
| :---- | :---- | ----- |
| `disciplinary_notes`  | RF-109  | Asociadas al perfil del alumno |
| `pricing_seasons`  | RF-110  | Cambio masivo de precios por fechas especiales |
| `certificate_batches`  | RF-112  | Lotes de folios Casa de Moneda recibidos; control de rango y disponibilidad. Cubre el stock físico: `available_folios` se decrementa automáticamente al emitir cada certificado (trigger T5) |
| `certificates`  | RF-075, RF-076  | Certificados emitidos (Clase B y  Profesional); folio único, QR verificación, link a lote |
| `certificate_issuance_log`  | RF-096  | Historial de descargas/envíos de certificados |

**Nota RF-112:** `certificate_batches` absorbe completamente la funcionalidad de control de stock de certificados Casa de Moneda. No se requiere una tabla separada `mint_certificate_stock`: cada lote registra el rango de folios

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 8   
(`folio_from`..`folio_to`) y los folios disponibles (`available_folios`), decrementados automáticamente por el trigger T5 al emitir un `certificates`. 

**Módulo 14 — Cumplimiento Normativo y Biometría (RF-126 a RF-128)** 

| Entidad  | RF  | Descripción |
| :---- | :---- | ----- |
| `biometric_records`  | RF-126  | Entrada/salida por huella o facial (API MTT) |

**RF-128 (Export SENCE):** La generación del archivo plano/Excel para LRE y portales SENCE es un **reporte derivado** que se genera bajo demanda consultando `enrollments` (con `sence_code_id IS NOT NULL`), 

`professional_practice_attendance` y `professional_theory_attendance`. No requiere tabla propia. 

**3\. Atributos detallados por entidad** 

`branches` 

`id int4 PK`   
`name TEXT NOT NULL -- "Autoescuela Chillán" | "Conductores Chillán"`   
`slug TEXT UNIQUE -- "autoescuela-chillan" | "conductores-chillan"`   
`address TEXT`   
`phone TEXT`   
`email TEXT`   
`active BOOLEAN DEFAULT true`   
`created_at TIMESTAMPTZ` 

`roles` 

`id int4 PK`   
`name TEXT UNIQUE -- 'admin' | 'secretary' | 'instructor' | 'student'`   
`description TEXT`   
`created_at TIMESTAMPTZ` 

`users` 

Todos los actores del sistema. Incluye también las **cuentas temporales** creadas durante la pre-inscripción pública de Clase Profesional (`/matricula-online`). 

**Convención de cuenta temporal** (pre-inscripción pública): \- `role_id = NULL` — sin rol asignado, sin acceso al sistema general \- `active = false` — solo puede acceder al portal del test psicológico \- Al convertir a matrícula: `role_id` → `student`, `active = true`, `first_login = true` \- Al expirar/rechazar la pre-inscripción: la cuenta permanece con `active = false` indefinidamente (no se elimina para preservar trazabilidad; el RUT queda bloqueado para nueva pre-inscripción) 

`id int4 PK`   
`supabase_uid uuid UNIQUE NULL -- UID del usuario en auth.users (Supabase)`   
`rut TEXT UNIQUE NOT NULL`   
`first_names TEXT NOT NULL`   
`paternal_last_name TEXT NOT NULL`   
`maternal_last_name TEXT NOT NULL`   
`email TEXT UNIQUE NOT NULL`   
`phone TEXT`   
`role_id int4 FK` → `roles.id NULL -- NULL = cuenta temporal de pre-inscripción branch_id int4 FK` → `branches.id NULL -- NULL mientras es cuenta temporal` 

`can_access_both_branches BOOLEAN DEFAULT false -- RF-013`   
`active BOOLEAN DEFAULT true`   
 `-- false = cuenta temporal (pre-inscripción) o usuario desactivado`   
`first_login BOOLEAN DEFAULT true -- RF-015: forzar cambio contraseña` 

`created_at TIMESTAMPTZ`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 9   
`updated_at TIMESTAMPTZ` 

`login_attempts` 

`id int4 PK`   
`email TEXT NOT NULL`   
`ip TEXT`   
`successful BOOLEAN`   
`user_id int4 FK` → `users.id NULL`   
`created_at TIMESTAMPTZ -- RF-014: detectar fuerza bruta` 

`students` 

Extiende `users` con información académica (RF-006, RF-082) 

`id int4 PK`   
`user_id int4 FK` → `users.id UNIQUE`   
`birth_date DATE NOT NULL`   
`gender CHAR(1) -- 'M' | 'F'`   
`address TEXT`   
`region TEXT`   
`district TEXT`   
`is_minor BOOLEAN -- edad == 17, requiere notarial (RF-082.1)`   
`has_notarial_auth BOOLEAN DEFAULT false`   
`-- RF-062, RF-063: datos de licencia previa para validación de cadena (Clase Profesional)`   
`current_license_class TEXT NULL -- 'B' | 'A2' | 'A3' | 'A4' (licencia que posee hoy) license_obtained_date DATE NULL -- fecha en que obtuvo esa licencia (para calcular antigüedad` ≥ `2 años) status TEXT -- 'active' | 'pending' | 'inactive' | 'graduated' created_at TIMESTAMPTZ` 

`courses` 

`id int4 PK`   
`code TEXT UNIQUE`   
 `-- 'class_b' | 'class_b_sence' | 'professional_a2' | 'a3' | 'a4' | 'a5'`   
`name TEXT NOT NULL`   
`type TEXT -- 'class_b' | 'professional'`   
`duration_weeks INT -- 8 para B, 4-5 para profesional (~30 días)`   
`practical_hours NUMERIC(5,1)`   
`theory_hours NUMERIC(5,1)`   
`base_price INTEGER -- en CLP`   
`license_class TEXT -- 'B' | 'A2' | 'A3' | 'A4' | 'A5'`   
`branch_id int4 FK` → `branches.id`   
`active BOOLEAN DEFAULT true` 

`sence_codes` 

`id int4 PK`   
`code TEXT UNIQUE NOT NULL`   
`description TEXT`   
`course_id int4 FK` → `courses.id`   
`valid BOOLEAN DEFAULT true`   
`start_date DATE`   
`end_date DATE` 

`professional_pre_registrations` 

Pre-inscripción para Clase Profesional. Tiene **dos orígenes posibles**, pero en **ambos casos** se crea primero un registro en `users` (`role_id = NULL`, `active = false`). Los datos personales (rut, nombres, email, teléfono) viven **exclusivamente en** `users`; esta tabla solo almacena lo propio de la pre-inscripción, evitando duplicación.

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 10   
1\. **Autoservicio público** (`/matricula-online`): El potencial alumno rellena sus datos → el sistema crea la cuenta temporal en `users` y este registro en un solo flujo. Esa cuenta le da acceso únicamente al portal del test psicológico. 2\. **Ingreso manual por secretaria** (`/secretaria/alumnos/pre-inscritos`): La secretaria ingresa los datos → el sistema también crea la cuenta temporal en `users` antes de insertar aquí. 

Al convertir a matrícula: `users.role_id` → `'student'`, `users.active = true`, `users.branch_id` asignado, se crean `students` y `enrollments`. Al expirar/rechazar: `users.active = false`. 

`id int4 PK`   
`-- Los datos personales NO se repiten aquí: están en users (rut, nombres, email, teléfono). -- temp_user_id es SIEMPRE NOT NULL: la cuenta temporal se crea antes de insertar este registro. temp_user_id int4 FK` → `users.id UNIQUE NOT NULL` 

 `-- users.role_id = NULL, users.active = false, users.branch_id = NULL mientras pre-inscrito  -- Al convertir: users.role_id` → `'student', users.active = true, users.branch_id asignado desired_course_class TEXT NOT NULL -- 'A2' | 'A3' | 'A4' | 'A5'` 

`psych_test_status TEXT DEFAULT 'not_started'`   
 `-- 'not_started' | 'in_progress' | 'completed'`   
`psych_test_result TEXT NULL -- 'fit' | 'unfit' (solo cuando psych_test_status='completed') registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` 

`expires_at TIMESTAMPTZ NOT NULL -- purga automática (ej. NOW() + INTERVAL '7 days') status TEXT DEFAULT 'pending_review'` 

 `-- 'pending_review'` → `esperando revisión de la secretaria`   
 `-- 'approved'` → `apto para matricular (psych_test_result='fit')`   
 `-- 'enrolled'` → `convertido a matrícula (ver converted_enrollment_id)`   
 `-- 'expired'` → `job ejecuta: UPDATE users SET active=false WHERE id=temp_user_id`   
 `-- 'rejected'` → `resultado 'unfit' o descartado; ídem: users.active = false`   
`converted_enrollment_id int4 FK` → `enrollments.id NULL -- poblado al matricular` 

**Job de limpieza:** Cada N horas, para registros donde `expires_at &lt; NOW()` y `status NOT IN ('enrolled', 'rejected')`: 1\. `UPDATE users SET active = false WHERE id = (SELECT temp_user_id FROM ...)` 2\. `UPDATE professional_pre_registrations SET status = 'expired'` 

`enrollments` 

Entidad central. Aplica a Clase B (RF-009 a RF-010) y Profesional (RF-059 a RF-079). El tipo de curso se deriva siempre de `enrollments.course_id` → `courses.type` ('class\_b' | 'professional'). 

**Flujo de estados según tipo de curso:** \- **Clase B:** `draft` → `pending_docs` → `active` → `completed` | `cancelled` El estado `draft` se crea cuando el alumno selecciona horarios desde el calendario, antes de ingresar datos personales y realizar el pago. Los `class_b_sessions` quedan en estado `'scheduled'` vinculados a esta matrícula draft, bloqueando esos slots del calendario. Si el proceso no se completa antes de `expires_at`, un job limpia los slots y anula el draft. \- **Clase Profesional:** `pending_docs` → `active` → `completed` | `cancelled` No usa estado `draft`. `promotion_course_id` puede asignarse en el momento de la matrícula o dejarse en NULL y asignarse después desde la vista de promociones. Alumnos profesionales sin promoción asignada: `courses.type='professional' AND promotion_course_id IS NULL`. 

`id int4 PK`   
`number TEXT UNIQUE -- "2026-0201" (NULL en estado 'draft')`   
`student_id int4 FK` → `students.id`   
`course_id int4 FK` → `courses.id -- courses.type determina si es 'class_b' o 'professional' branch_id int4 FK` → `branches.id` 

`sence_code_id int4 FK` → `sence_codes.id NULL`   
`-- Solo aplica a matrículas profesionales (courses.type = 'professional')`   
`-- NULL = alumno profesional aún no asignado a una promoción (pendiente de asignación)`   
`-- valor = asignado directamente en matrícula o desde la vista de promociones`   
`-- Para class_b siempre debe ser NULL; validado por trg_enrollment_validation`   
`promotion_course_id int4 FK` → `promotion_courses.id NULL`   
 `-- La promoción (período, fechas) se obtiene via: promotion_courses.promotion_id`   
`-- Pagos`   
`base_price INTEGER`   
`discount INTEGER DEFAULT 0`   
`total_paid INTEGER DEFAULT 0`   
`pending_balance INTEGER`   
`payment_status TEXT -- 'paid_full' | 'pending' | 'partial' (RF-093, RF-076)`   
`-- Estado académico`   
`-- 'draft' SOLO para Clase B (courses.type='class_b'): matrícula provisional mientras se selecciona horario status TEXT -- 'draft' | 'pending_docs' | 'active' | 'completed' | 'cancelled' -- Expiración de draft (solo Clase B en estado 'draft')`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 11   
`-- NULL cuando status != 'draft'. Los slots de class_b_sessions reservados se liberan al expirar. expires_at TIMESTAMPTZ NULL -- típicamente NOW() + INTERVAL '24 hours'` 

`-- Expediente`   
`docs_complete BOOLEAN DEFAULT false -- RF-085`   
`contract_accepted BOOLEAN DEFAULT false -- RF-083`   
`-- Habilitación certificado (gatillo RF-082.4)`   
`certificate_enabled BOOLEAN DEFAULT false`   
`-- Canal de matrícula`   
`-- 'online'` → `exclusivo Clase B (alumno reserva slots desde la web)`   
`-- 'in_person'` → `obligatorio para Profesional y SENCE (secretaria valida presencialmente) -- Validado en trg_enrollment_validation: si courses.type = 'professional'` → `debe ser 'in_person' -- Nota SENCE: cuando sence_code_id IS NOT NULL, los registros de payments y payment_status -- son gestionados internamente vía franquicia tributaria; no se exponen al alumno en su portal. registration_channel TEXT DEFAULT 'in_person' -- 'online' | 'in_person'` 

`-- Control`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ`   
`updated_at TIMESTAMPTZ` 

`-- Constraints (solo los que no requieren JOIN a courses)`   
`-- expires_at solo existe cuando hay draft`   
`CONSTRAINT chk_expires_at_draft_only`   
 `CHECK (expires_at IS NULL OR status = 'draft')`   
`-- número de matrícula obligatorio salvo en draft`   
`CONSTRAINT chk_enrollment_number`   
 `CHECK (status = 'draft' OR number IS NOT NULL)`   
`-- Las reglas que requieren JOIN a courses (type 'class_b'/'professional') se validan`   
`-- en trg_enrollment_validation (ver sección Triggers)` 

`student_documents` 

`id int4 PK`   
`enrollment_id int4 FK` → `enrollments.id`   
`type TEXT`   
 `-- Solo Clase B: 'id_photo' (foto carnet; alumnos online la suben en plataforma antes de la 1ra clase)  -- 'notarial_authorization' (solo menores de edad, RF-082.1)` 

 `-- Solo Profesional: 'national_id' (foto cédula)`   
 `-- 'driver_license' (foto licencia de conducir; flexible si no la tienen físicamente)  -- 'driver_record' (Hoja de Vida del Conductor; OBLIGATORIO, bloqueante, RF-082.2)  -- 'psychological_exam' (Examen Psicológico Interno, RF-082.2)` 

 `-- 'background_certificate'`   
`file_name TEXT NOT NULL`   
`storage_url TEXT NOT NULL`   
`status TEXT -- 'pending' | 'approved' | 'rejected' | 'pending_review'`   
`document_issue_date DATE NULL -- RF-082.3: para verificar antigüedad HVC`   
`notes TEXT`   
`uploaded_at TIMESTAMPTZ`   
`reviewed_by int4 FK` → `users.id NULL`   
`reviewed_at TIMESTAMPTZ` 

`digital_contracts` 

El contrato firmado aparece en el DMS ("Documentos del Alumno") como tipo `'contract'`. La vista `v_dms_student_documents` (§5.6) lo une con `student_documents` en una lista unificada por alumno. `file_name` y `file_url` son obligatorios para que el contrato sea visible en el repositorio; mientras no se genere el PDF, el contrato existe como aceptación lógica (`accepted_at`) pero no como documento físico. 

`id int4 PK`   
`enrollment_id int4 FK` → `enrollments.id UNIQUE`   
`student_id int4 FK` → `students.id`   
`content_hash TEXT -- hash del contrato firmado`   
`signature_ip TEXT`   
`accepted_at TIMESTAMPTZ`   
`-- DMS: archivo PDF del contrato firmado (requerido para visualización en Repositorio de Documentos) file_name TEXT NULL -- ej. "Contrato_Maria_Gonzalez_2026.pdf"` 

`file_url TEXT NULL -- URL al PDF firmado en storage; NULL hasta que se genera el PDF`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 12   
`school_documents` 

Repositorio de documentos institucionales de la escuela (DMS). No ligados a un alumno ni a una matrícula. Solo el Admin puede eliminar; Secretaria solo puede subir y visualizar. 

`id int4 PK`   
`type TEXT NOT NULL`   
 `-- 'factura_folios'` → `Facturas de compra de folios Casa de Moneda`   
 `-- 'resolucion_mtt'` → `Resoluciones y autorizaciones del MTT`   
 `-- 'decreto'` → `Decretos que modifican reglamentos`   
 `-- 'otro'` → `Cualquier otro documento institucional`   
`file_name TEXT NOT NULL -- nombre original del archivo`   
`storage_url TEXT NOT NULL -- URL al archivo en storage`   
`description TEXT NULL -- descripción breve del documento`   
`branch_id int4 FK` → `branches.id NULL -- NULL = aplica a ambas sedes`   
`uploaded_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`document_templates` 

DMS — Plantillas descargables/reutilizables (contratos, formularios MTT, comprobantes, etc.). Solo el Admin puede crear, editar o eliminar plantillas; Secretaria, Instructor y Alumno solo pueden descargar. No confundir con `school_documents` (documentos subidos/archivados) ni con `digital_contracts` (contratos firmados por alumno). 

`id int4 PK`   
`name TEXT NOT NULL -- "Contrato Matrícula Clase B" | "Hoja de Vida del Conductor" | ... description TEXT NULL` 

`category TEXT NOT NULL`   
 `-- 'clase_b'` → `Plantillas exclusivas de Clase B`   
 `-- 'clase_profesional'` → `Plantillas exclusivas de Clase Profesional`   
 `-- 'general'` → `Certificados genéricos, formularios comunes`   
 `-- 'administrativo'` → `Recibos de pago, planillas, actas internas`   
`format TEXT NOT NULL -- 'pdf' | 'docx' | 'xlsx'`   
`version TEXT NULL -- "v3.2", "v1.4 (MTT 2024)"`   
`file_url TEXT NOT NULL -- URL al archivo base en storage`   
`download_count INTEGER DEFAULT 0 -- incrementado cada vez que alguien descarga`   
`active BOOLEAN DEFAULT true`   
`updated_by int4 FK` → `users.id NULL -- último admin que actualizó la plantilla created_at TIMESTAMPTZ` 

`updated_at TIMESTAMPTZ` 

`payments` 

`id int4 PK`   
`enrollment_id int4 FK` → `enrollments.id`   
`type TEXT -- 'enrollment' | 'monthly_fee' | 'complement' | 'special_service' document_number TEXT NULL -- N° voucher / transferencia / cheque (RF-027)` 

`total_amount INTEGER NOT NULL`   
`cash_amount INTEGER DEFAULT 0`   
`transfer_amount INTEGER DEFAULT 0`   
`card_amount INTEGER DEFAULT 0`   
`voucher_amount INTEGER DEFAULT 0`   
`status TEXT -- 'paid' | 'pending' | 'partial'`   
`payment_date DATE`   
`receipt_url TEXT NULL`   
`requires_receipt BOOLEAN DEFAULT true -- RF-033: "Falta Boleta"`   
`receipt_id int4 FK` → `sii_receipts.id NULL`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`payment_denominations` 

Módulo 4 (ultimos\_cambios) — Desglose de billetes y monedas por transacción en efectivo. Solo se crean filas cuando `payments.cash_amount &gt; 0`. La suma `denomination × quantity` de todas las filas asociadas a un `payment_id`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 13   
debe igualar `payments.cash_amount`. 

`id int4 PK`   
`payment_id int4 FK` → `payments.id NOT NULL`   
`denomination INTEGER NOT NULL`   
 `-- Billetes: 20000 | 10000 | 5000 | 2000 | 1000`   
 `-- Monedas: 500 | 100 | 50 | 10`   
`quantity SMALLINT NOT NULL CHECK (quantity &gt; 0)`   
`-- No se necesita updated_at: el desglose es inmutable una vez registrado`   
`created_at TIMESTAMPTZ` 

`CONSTRAINT chk_valid_denomination`   
 `CHECK (denomination IN (20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10))`   
`UNIQUE(payment_id, denomination)` 

`expenses` 

`id int4 PK`   
`branch_id int4 FK` → `branches.id`   
`category TEXT -- 'fuel' | 'rent' | 'cleaning' | 'materials' | 'other'`   
`description TEXT NOT NULL`   
`amount INTEGER NOT NULL`   
`date DATE NOT NULL`   
`receipt_url TEXT NULL`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`sii_receipts` 

Cubre tanto boletas electrónicas (B2C) como facturas (B2B) emitidas por la escuela. El campo `type` distingue el tipo de documento. El `folio` es único por tipo y sede. Los campos `amount_*` desglosan el monto total por concepto para la cuadratura planilla (Módulo 10). 

`id int4 PK`   
`type TEXT NOT NULL DEFAULT 'boleta' -- 'boleta' | 'factura'`   
`folio INTEGER NOT NULL`   
 `-- RF-033: único por (type, branch_id). Las facturas tienen numeración independiente. amount INTEGER NOT NULL` 

`-- Desglose por concepto para la cuadratura planilla (columnas Clase B / Clase A / Sensometría / Otros) amount_class_b INTEGER NOT NULL DEFAULT 0` 

`amount_class_a INTEGER NOT NULL DEFAULT 0 -- incluye todos los cursos Profesionales amount_sensometry INTEGER NOT NULL DEFAULT 0 -- Examen Psicotécnico y servicios especiales amount_other INTEGER NOT NULL DEFAULT 0` 

`-- Constraint: el desglose debe sumar el total`   
`CONSTRAINT chk_receipt_breakdown`   
 `CHECK (amount_class_b + amount_class_a + amount_sensometry + amount_other = amount) issued_at TIMESTAMPTZ` 

`status TEXT -- 'issued' | 'cancelled'`   
`recipient_tax_id TEXT -- RUT del receptor (persona o empresa) recipient_name TEXT -- nombre del receptor` 

`branch_id int4 FK` → `branches.id`   
`created_at TIMESTAMPTZ` 

`UNIQUE(type, folio, branch_id)` 

`cash_closings` 

`id int4 PK`   
`branch_id int4 FK` → `branches.id`   
`date DATE NOT NULL UNIQUE (per branch)`   
`-- Totales por método de pago (ingresos del día)`   
`cash_amount INTEGER DEFAULT 0` 

`transfer_amount INTEGER DEFAULT 0`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 14   
`card_amount INTEGER DEFAULT 0 -- Transbank / débito / crédito`   
`voucher_amount INTEGER DEFAULT 0`   
`total_income INTEGER`   
`total_expenses INTEGER`   
`balance INTEGER -- RF-029: Ingresos Cash` − `Gastos Cash (automático) payments_count INTEGER` 

`-- Arqueo de caja física (Módulo 10 — ultimos_cambios)`   
`-- Columnas de denominación: cantidad de cada billete/moneda contado físicamente`   
`qty_bill_20000 SMALLINT DEFAULT 0`   
`qty_bill_10000 SMALLINT DEFAULT 0`   
`qty_bill_5000 SMALLINT DEFAULT 0`   
`qty_bill_2000 SMALLINT DEFAULT 0`   
`qty_bill_1000 SMALLINT DEFAULT 0`   
`qty_coin_500 SMALLINT DEFAULT 0`   
`qty_coin_100 SMALLINT DEFAULT 0`   
`qty_coin_50 SMALLINT DEFAULT 0`   
`qty_coin_10 SMALLINT DEFAULT 0`   
`arqueo_amount INTEGER NULL -- total contado físico (suma denominaciones × cantidades) difference INTEGER NULL -- arqueo_amount` − `balance (esperado en efectivo) -- Estado del cierre` 

`status TEXT DEFAULT 'open' -- 'open' | 'closed' | 'descuadre'`   
 `-- 'open'` → `caja del día aún no cerrada`   
 `-- 'closed'` → `cerrada sin diferencia (difference = 0 o NULL)`   
 `-- 'descuadre'` → `cerrada con diferencia` ≠ `0; requiere justificación`   
`closed BOOLEAN DEFAULT false -- RF-037: bloquea edición; redundante con status pero mantiene  compatibilidad` 

`closed_by int4 FK` → `users.id`   
`closed_at TIMESTAMPTZ`   
`notes TEXT -- justificación obligatoria cuando status = 'descuadre' -- Constraint: arqueo_amount debe coincidir con la suma de denominaciones` 

`CONSTRAINT chk_arqueo_amount`   
 `CHECK (arqueo_amount IS NULL OR`   
 `arqueo_amount = (qty_bill_20000*20000 + qty_bill_10000*10000 + qty_bill_5000*5000 +  qty_bill_2000*2000 + qty_bill_1000*1000 +` 

 `qty_coin_500*500 + qty_coin_100*100 +`   
 `qty_coin_50*50 + qty_coin_10*10))` 

`instructor_advances` 

`id int4 PK`   
`instructor_id int4 FK` → `instructors.id`   
`date DATE NOT NULL`   
`amount INTEGER NOT NULL`   
`reason TEXT -- 'salary' | 'allowance' | 'materials' | 'other'`   
`description TEXT`   
`status TEXT -- 'pending' | 'deducted'`   
`deducted_on DATE NULL`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`instructor_monthly_payments` 

Módulo 4 (ultimos\_cambios) — Liquidación mensual de instructores. Registra el pago neto de cada instructor por período, descontando automáticamente los anticipos pendientes de ese mes (`instructor_advances.status = 'pending'`). Al registrar el pago, un trigger marca los anticipos del período como `status = 'deducted'`. 

`id int4 PK`   
`instructor_id int4 FK` → `instructors.id NOT NULL`   
`period TEXT NOT NULL -- "2026-03" (mes del pago)`   
`base_salary INTEGER NOT NULL -- horas del período × tarifa del instructor advances_deducted INTEGER NOT NULL DEFAULT 0 -- SUM(instructor_advances.amount) WHERE period y  status='pending'` 

`net_payment INTEGER NOT NULL -- base_salary` − `advances_deducted`   
`payment_status TEXT DEFAULT 'pending' -- 'pending' | 'paid'`   
`paid_at TIMESTAMPTZ NULL`   
`paid_by int4 FK` → `users.id NULL` 

`notes TEXT NULL`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 15   
`CONSTRAINT chk_net_payment`   
 `CHECK (net_payment = base_salary - advances_deducted)`   
`UNIQUE(instructor_id, period)` 

`standalone_courses` 

RF-035 — Catálogo de cursos singulares grupales. Reemplaza el esquema anterior (registro individual por alumno). Los alumnos pagan el total al inicio; reciben diploma, certificado y carnet. No se gestiona agenda/horario. Solo se gestiona: datos del alumno, pagos y documentos. 

`id int4 PK`   
`name TEXT NOT NULL -- "Operador de Grúa Horquilla" | "Operador Retroexcavadora" | "Maquinaria  Pesada Básico" | ...` 

`type TEXT NOT NULL -- 'sence' | 'particular'`   
 `-- 'sence'` → `financiado por franquicia tributaria SENCE; el alumno no gestiona pagos directamente  -- 'particular'` → `pago directo del alumno (boleta/factura)` 

`billing_type TEXT NOT NULL -- 'sence_franchise' | 'boleta' | 'factura'`   
`base_price INTEGER NOT NULL -- precio en CLP (0 para SENCE gestionado externamente) duration_hours INTEGER NOT NULL -- ej. 40, 60, 80` 

`max_students SMALLINT NOT NULL -- cupo máximo del curso`   
`start_date DATE NOT NULL`   
`end_date DATE NULL`   
`status TEXT -- 'upcoming' | 'active' | 'completed' | 'cancelled'`   
`branch_id int4 FK` → `branches.id`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`standalone_course_enrollments` 

Inscripción individual de un alumno a un `standalone_courses`. Los alumnos pagan el total al inicio; pueden recibir certificado, diploma y carnet. 

`id int4 PK`   
`standalone_course_id int4 FK` → `standalone_courses.id NOT NULL`   
`student_id int4 FK` → `students.id NOT NULL`   
`amount_paid INTEGER NOT NULL -- debe ser = standalone_courses.base_price salvo excepciones payment_status TEXT -- 'paid' | 'pending' | 'partial'` 

`certificate_id int4 FK` → `certificates.id NULL -- si se emite certificado Casa de Moneda registered_by int4 FK` → `users.id` 

`enrolled_at TIMESTAMPTZ NOT NULL`   
`UNIQUE(standalone_course_id, student_id)` 

**Tablas exclusivas de Clase B (Autoescuela Chillán)** 

`instructors` 

`id int4 PK`   
`user_id int4 FK` → `users.id UNIQUE`   
`type TEXT -- 'theory' | 'practice' | 'both'`   
`-- RF-041: Licencia`   
`license_number TEXT`   
`license_class TEXT -- 'B'`   
`license_expiry DATE`   
`license_status TEXT -- 'valid' | 'expiring_soon' | 'expired'`   
`-- Disponibilidad`   
`available_days INT[] -- [1,2,3,4,5]`   
`available_from TIME`   
`available_until TIME`   
`-- Control`   
`active_classes_count INT DEFAULT 0 -- RF-043`   
`active BOOLEAN DEFAULT true` 

`registration_date DATE`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 16   
`vehicle_assignments` 

`id int4 PK`   
`instructor_id int4 FK` → `instructors.id`   
`vehicle_id int4 FK` → `vehicles.id`   
`start_date DATE NOT NULL`   
`end_date DATE NULL -- NULL = activa`   
`assigned_by int4 FK` → `users.id`   
`reason TEXT NULL`   
`created_at TIMESTAMPTZ` 

`instructor_replacements` 

`id int4 PK`   
`absent_instructor_id int4 FK` → `instructors.id`   
`replacement_instructor_id int4 FK` → `instructors.id`   
`date DATE NOT NULL`   
`reason TEXT NOT NULL`   
`affected_classes int4[] -- array de class_b_sessions.id (RF-044)`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`instructor_monthly_hours` 

`id int4 PK`   
`instructor_id int4 FK` → `instructors.id`   
`period TEXT NOT NULL -- "2026-02"`   
`theory_hours NUMERIC(6,1) DEFAULT 0`   
`practical_sessions INTEGER DEFAULT 0`   
`total_equivalent NUMERIC(6,1) -- theory + (practical × 1.5)`   
`UNIQUE(instructor_id, period)` 

`class_b_sessions` 

Sesiones **prácticas** individuales de Clase B. Cada fila \= 1 alumno \+ 1 instructor \+ 1 vehículo \+ 1 slot horario. Las sesiones teóricas grupales se registran en `class_b_theory_sessions`. Los datos técnicos post-clase (KM, GPS, notas de desempeño) viven aquí directamente. 

`id int4 PK`   
`enrollment_id int4 FK` → `enrollments.id -- courses.type = 'class_b'`   
`instructor_id int4 FK` → `instructors.id`   
`vehicle_id int4 FK` → `vehicles.id NOT NULL -- siempre requerido (sesión práctica) class_number SMALLINT -- 1..12 (secuencia obligatoria)` 

`scheduled_at TIMESTAMPTZ`   
`start_time TIME`   
`end_time TIME`   
`duration_min SMALLINT DEFAULT 90`   
`status TEXT -- 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'in_progress' -- RF-015: Política 24h` 

`counts_as_taken BOOLEAN DEFAULT false -- True si canceló &lt;24h o no_show`   
`cancelled_at TIMESTAMPTZ NULL`   
`completed_at TIMESTAMPTZ NULL`   
`-- Post-clase (RF-049): se completan al cerrar la sesión`   
`evaluation_grade NUMERIC(3,1) NULL -- nota numérica de desempeño`   
`performance_notes TEXT NULL -- notas cualitativas libres del instructor`   
`km_start INTEGER NULL -- odómetro al inicio (RF-090)`   
`km_end INTEGER NULL -- odómetro al fin; km recorridos = km_end - km_start gps_start POINT NULL -- RF-127: coordenadas inicio de ruta` 

`gps_end POINT NULL -- RF-127: coordenadas fin de ruta`   
`notes TEXT NULL -- observaciones generales de la clase` 

`-- Firmas (RF-050, RF-107)`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 17   
`student_signature BOOLEAN DEFAULT false`   
`instructor_signature BOOLEAN DEFAULT false`   
`signature_timestamp TIMESTAMPTZ NULL`   
`-- Instructor real vs original (RF-044)`   
`original_instructor_id int4 FK` → `instructors.id NULL`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ`   
`updated_at TIMESTAMPTZ` 

`class_b_theory_sessions` 

Sesiones teóricas grupales de Clase B (Zoom). Múltiples alumnos asisten a la misma sesión. Las sesiones prácticas individuales se registran en `class_b_sessions`. 

`id int4 PK`   
`branch_id int4 FK` → `branches.id`   
`instructor_id int4 FK` → `instructors.id NULL -- instructor que imparte; NULL si se usa relator externo scheduled_at TIMESTAMPTZ NOT NULL` 

`start_time TIME`   
`end_time TIME`   
`duration_min SMALLINT DEFAULT 90`   
`topic TEXT NULL -- unidad o tema de la clase`   
`zoom_link TEXT NULL -- RF-016: enviado automáticamente a los alumnos de Clase B status TEXT -- 'scheduled' | 'completed' | 'cancelled'` 

`notes TEXT NULL`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`class_b_theory_attendance` 

Asistencia a clases teóricas grupales de Clase B (Zoom, no individual). 

`id int4 PK`   
`theory_session_b_id int4 FK` → `class_b_theory_sessions.id`   
`student_id int4 FK` → `students.id`   
`status TEXT -- 'present' | 'absent' | 'excused'`   
`justification TEXT NULL`   
`recorded_by int4 FK` → `users.id`   
`recorded_at TIMESTAMPTZ`   
`UNIQUE(theory_session_b_id, student_id)` 

`class_b_practice_attendance` 

Asistencia a clases prácticas individuales de Clase B. Una práctica es siempre 1:1, pero se registra para trazabilidad y regla de deserción. 

`id int4 PK`   
`class_b_session_id int4 FK` → `class_b_sessions.id`   
`student_id int4 FK` → `students.id`   
`status TEXT -- 'present' | 'absent' | 'excused' | 'no_show'`   
`justification TEXT NULL`   
`evidence_url TEXT NULL`   
`consecutive_absences INT DEFAULT 0 -- RF-053: 2 = deserción`   
`recorded_by int4 FK` → `users.id`   
`recorded_at TIMESTAMPTZ`   
`UNIQUE(class_b_session_id, student_id)` 

`class_b_exam_scores` 

RF-057 — Puntajes de ensayos de preparación para el examen municipal teórico. Ingreso **manual** por instructor o secretaria. Diferente de `class_b_exam_attempts` (ensayos online autogestionados, calificación automática). 

`id int4 PK`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 18   
`student_id int4 FK` → `students.id`   
`enrollment_id int4 FK` → `enrollments.id`   
`date DATE`   
`score SMALLINT -- sobre 100`   
`passed BOOLEAN`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`class_b_exam_catalog` 

RF-057 — Catálogo de ensayos online autogestionados para alumnos Clase B. Define la configuración de cada ensayo: cuántas preguntas sortear del banco, tiempo límite y umbral de aprobación. Solo Admin puede crear/editar/desactivar ensayos del catálogo. 

`id int4 PK`   
`title TEXT NOT NULL -- "Ensayo Teórico N°1 — Reglamento del Tránsito"`   
`description TEXT NULL`   
`time_limit_min SMALLINT NOT NULL -- minutos (ej. 45)`   
`total_questions SMALLINT NOT NULL -- nº de preguntas a sortear del banco (ej. 35)`   
`pass_score SMALLINT NOT NULL -- puntaje mínimo sobre 100 para aprobar (ej. 70)`   
`active BOOLEAN DEFAULT true`   
`created_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ`   
`updated_at TIMESTAMPTZ` 

`class_b_exam_questions` 

RF-057 — Banco de preguntas asociadas a un ensayo del catálogo. Las preguntas son reutilizables y pueden rotar entre intentos (el sistema sortea `exam_catalog.total_questions` al iniciar). Solo Admin puede gestionar el banco; Alumno solo puede verlas durante el intento activo. 

`id int4 PK`   
`exam_id int4 FK` → `class_b_exam_catalog.id NOT NULL`   
`question_text TEXT NOT NULL`   
`option_a TEXT NOT NULL`   
`option_b TEXT NOT NULL`   
`option_c TEXT NOT NULL`   
`option_d TEXT NULL -- algunas preguntas pueden tener solo 3 opciones`   
`correct_option CHAR(1) NOT NULL -- 'A' | 'B' | 'C' | 'D'`   
`active BOOLEAN DEFAULT true`   
`created_at TIMESTAMPTZ` 

`class_b_exam_attempts` 

RF-057 — Registro de cada intento de un alumno en un ensayo online. Al enviar, el sistema califica automáticamente comparando `answers` con `class_b_exam_questions.correct_option`. Un alumno puede tener múltiples intentos; no hay límite definido por defecto. 

`id int4 PK`   
`exam_id int4 FK` → `class_b_exam_catalog.id NOT NULL`   
`student_id int4 FK` → `students.id NOT NULL`   
`enrollment_id int4 FK` → `enrollments.id NOT NULL`   
`started_at TIMESTAMPTZ NOT NULL`   
`submitted_at TIMESTAMPTZ NULL -- NULL si abandonó sin enviar`   
`score SMALLINT NULL -- sobre 100; NULL hasta que se envía y califica`   
`passed BOOLEAN NULL -- NULL hasta calificación`   
`answers JSONB NULL`   
 `-- { "q_id_1": "C", "q_id_2": "A", ... } (keyed por class_b_exam_questions.id)`   
 `-- Poblado al enviar; NULL si el intento fue abandonado`   
`timed_out BOOLEAN DEFAULT false -- true si el tiempo expiró antes del envío manual created_at TIMESTAMPTZ`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 19   
`route_incidents` 

`id int4 PK`   
`vehicle_id int4 FK` → `vehicles.id`   
`instructor_id int4 FK` → `instructors.id`   
`class_b_session_id int4 FK` → `class_b_sessions.id NULL`   
`occurred_at TIMESTAMPTZ`   
`description TEXT NOT NULL`   
`type TEXT -- 'accident' | 'infraction' | 'mechanical_damage' | 'other' evidence_url TEXT NULL` 

`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

**Tablas exclusivas de Clase Profesional (Conductores Chillán)** 

`lecturers` 

RF-058 — Registro de profesionales de Clase Profesional (datos y asignaciones). **Sin acceso al sistema:** los relatores no tienen cuenta de usuario ni FK a `users`. La ficha existe únicamente para registrar datos personales, asignaciones a `promotion_courses` y calcular horas mensuales. Un relator puede aparecer en múltiples `promotion_courses` simultáneamente; no hay UNIQUE en `promotion_courses.lecturer_id`. 

`id int4 PK`   
`rut TEXT NOT NULL UNIQUE -- RUT chileno validado (ej. "12.345.678-9") first_names TEXT NOT NULL` 

`paternal_last_name TEXT NOT NULL`   
`maternal_last_name TEXT`   
`email TEXT UNIQUE`   
`phone TEXT`   
`specializations TEXT[] -- ['A2','A4'] etc.`   
`active BOOLEAN DEFAULT true`   
`registration_date DATE` 

`lecturer_monthly_hours` 

Equivalente a `instructor_monthly_hours` para relatores de Clase Profesional. 

`id int4 PK`   
`lecturer_id int4 FK` → `lecturers.id`   
`period TEXT NOT NULL -- "2026-02"`   
`theory_hours NUMERIC(6,1) DEFAULT 0 -- sesiones Zoom`   
`practical_hours NUMERIC(6,1) DEFAULT 0 -- bloques campo`   
`total_hours NUMERIC(6,1)`   
`UNIQUE(lecturer_id, period)` 

`professional_promotions` 

RF-059 — Entidad paraguas del período de 30 días (≠ descuentos comerciales). Agrupa los 4 cursos (A2, A3, A4, A5) que corren en paralelo bajo una misma ventana de tiempo. Máximo 100 alumnos en total \= 4 cursos × 25 alumnos c/u. 

`id int4 PK`   
`code TEXT UNIQUE -- "PROM-2026-01"`   
`name TEXT -- "Promoción Enero 2026" (sin especificar curso; los cursos van en  promotion_courses)` 

`start_date DATE NOT NULL -- siempre lunes`   
`end_date DATE -- inicio + 30 días (siempre sábado)`   
`max_students SMALLINT DEFAULT 100 -- total entre los 4 cursos (4 × 25)`   
`status TEXT -- 'planned' | 'in_progress' | 'finished' | 'cancelled'`   
`current_day SMALLINT DEFAULT 0 -- RF-079: "Día X de 30" (calculado)`   
`branch_id int4 FK` → `branches.id -- siempre conductores-chillan` 

`created_at TIMESTAMPTZ`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 20   
`promotion_courses` 

Cada uno de los (hasta 4\) cursos que componen una `professional_promotions`. Una promoción típica tiene un curso por cada clase de licencia: A2, A3, A4 y A5. Cada curso tiene su propio relator y su propio cupo de 25 alumnos. 

`id int4 PK`   
`promotion_id int4 FK` → `professional_promotions.id NOT NULL`   
`course_id int4 FK` → `courses.id NOT NULL -- license_class = 'A2' | 'A3' | 'A4' | 'A5' lecturer_id int4 FK` → `lecturers.id NOT NULL -- relator asignado a este curso` 

`template_id int4 FK` → `professional_schedule_templates.id NULL`   
 `-- Plantilla de horario fijo para este curso. Si se especifica, el trigger T10`   
 `-- genera automáticamente todas las professional_theory_sessions y professional_practice_sessions  -- al insertar este registro, calculando las fechas reales desde promotion.start_date.` 

`max_students SMALLINT DEFAULT 25 -- máximo por curso (RF-059)`   
`enrolled_students SMALLINT DEFAULT 0 -- se incrementa al activar cada matrícula`   
`status TEXT -- 'planned' | 'in_progress' | 'finished' | 'cancelled'`   
`created_at TIMESTAMPTZ` 

`-- Un curso no puede repetirse dentro de la misma promoción`   
`UNIQUE(promotion_id, course_id)` 

`professional_schedule_templates` 

"Los horarios para todos los alumnos son siempre los mismos, son fijos" — representado aquí. Define el patrón reutilizable de sesiones (teóricas Zoom \+ prácticas de campo) para los 30 días de un curso profesional. Al asignarse a un `promotion_courses`, el trigger T10 genera automáticamente todos los registros de `professional_theory_sessions` y `professional_practice_sessions`. 

`id int4 PK`   
`name TEXT NOT NULL -- "Horario Estándar Clase Profesional"`   
`description TEXT NULL`   
`active BOOLEAN DEFAULT true`   
`created_at TIMESTAMPTZ` 

`template_blocks` 

Detalle de cada sesión dentro de una `professional_schedule_templates`. Define cuándo ocurre cada bloque (teórico o práctico) durante el período de 30 días. El período corre lunes a sábado → 5 semanas × 6 días \= 30 días laborables. 

`id int4 PK`   
`template_id int4 FK` → `professional_schedule_templates.id NOT NULL`   
`type TEXT NOT NULL -- 'theory' | 'practice'`   
`week_number SMALLINT NOT NULL -- 1..5 (semana dentro del período de 30 días)`   
`day_of_week SMALLINT NOT NULL -- 1=Lunes..6=Sábado (no hay domingos)`   
`start_time TIME NOT NULL`   
`end_time TIME NOT NULL`   
`description TEXT NULL -- temática / módulo a cubrir en esta sesión (opcional)` 

`-- Constraints`   
`CONSTRAINT chk_working_day_of_week CHECK (day_of_week BETWEEN 1 AND 6)`   
`CONSTRAINT chk_week_number CHECK (week_number BETWEEN 1 AND 5)` 

**Cálculo de fecha real** al generar sesiones (trigger T10): \`\` `real_date = promotion.start_date + INTERVAL '(week_number - 1) * 7 days' + INTERVAL '(day_of_week - 1) days' -- Ejemplo: week_number=1, day_of_week=1` → `start_date (lunes de la 1ª semana) -- week_number=2, day_of_week=3` → `start_date + 9 días (miércoles 2ª semana)` \`\` 

`professional_theory_sessions` 

Sesiones teóricas Zoom de Clase Profesional (RF-016, RF-078). Una sesión por bloque, específica por curso dentro de la promoción. Cada curso (A2, A3, A4, A5) tiene sus propias sesiones Zoom con su relator asignado. Las sesiones prácticas de campo se registran en `professional_practice_sessions`.

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 21   
`id int4 PK`   
`promotion_course_id int4 FK` → `promotion_courses.id NOT NULL`   
 `-- Identifica simultáneamente el curso (A2/A3/A4/A5) y la promoción (período).`   
 `-- El relator se obtiene via: promotion_courses.lecturer_id`   
`date DATE NOT NULL`   
`start_time TIME`   
`end_time TIME`   
`status TEXT -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled'`   
`zoom_link TEXT NULL -- RF-016: enviado automáticamente a los alumnos del curso notes TEXT NULL` 

`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`professional_practice_sessions` 

Sesiones **prácticas** de campo de Clase Profesional. Cada fila \= 1 bloque práctico específico por curso dentro de la promoción. Cada curso (A2, A3, A4, A5) tiene sus propias prácticas con maquinaria correspondiente a su clase de licencia. Las sesiones teóricas Zoom se registran en `professional_theory_sessions`. 

`id int4 PK`   
`promotion_course_id int4 FK` → `promotion_courses.id NOT NULL`   
 `-- Identifica simultáneamente el curso (A2/A3/A4/A5) y la promoción (período).`   
`date DATE NOT NULL`   
`start_time TIME`   
`end_time TIME`   
`status TEXT -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled'`   
`notes TEXT NULL`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`professional_theory_attendance` 

Marcado manual de asistencia a clases teóricas Zoom por el relator (RF-078). 

`id int4 PK`   
`theory_session_prof_id int4 FK` → `professional_theory_sessions.id`   
`enrollment_id int4 FK` → `enrollments.id`   
`student_id int4 FK` → `students.id`   
`status TEXT -- 'present' | 'absent' | 'excused'`   
`justification TEXT NULL`   
`evidence_id int4 FK` → `absence_evidence.id NULL`   
`recorded_by int4 FK` → `users.id -- secretaria o admin`   
`recorded_at TIMESTAMPTZ`   
`UNIQUE(theory_session_prof_id, student_id)` 

`professional_practice_attendance` 

Asistencia a bloques prácticos de Clase Profesional. Porcentaje por bloque (RF-068). 

`id int4 PK`   
`session_id int4 FK` → `professional_practice_sessions.id -- sesión práctica de campo enrollment_id int4 FK` → `enrollments.id` 

`student_id int4 FK` → `students.id`   
`status TEXT -- 'present' | 'absent' | 'excused'`   
`block_percentage NUMERIC(5,2) DEFAULT 100.0 -- % del bloque completado`   
`justification TEXT NULL`   
`evidence_id int4 FK` → `absence_evidence.id NULL`   
`recorded_by int4 FK` → `users.id -- secretaria o admin`   
`recorded_at TIMESTAMPTZ`   
`UNIQUE(session_id, student_id)` 

`absence_evidence` 

RF-071 — Adjuntos de licencias médicas u otros documentos para justificar faltas (Profesional).

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 22   
`id int4 PK`   
`enrollment_id int4 FK` → `enrollments.id`   
`document_type TEXT -- 'medical_leave' | 'medical_certificate' | 'other'`   
`description TEXT`   
`file_url TEXT NOT NULL`   
`document_date DATE`   
`status TEXT -- 'pending' | 'approved' | 'rejected'`   
`reviewed_by int4 FK` → `users.id NULL`   
`reviewed_at TIMESTAMPTZ NULL`   
`created_at TIMESTAMPTZ` 

`professional_module_grades` 

RF-072 — Notas por módulo técnico de Clase Profesional. Ingresadas manualmente por secretaria/admin basándose en resultados de pruebas físicas corregidas por el relator. `recorded_by` captura quién ingresó la nota (útil para datos históricos ingresados en nombre del relator). Editable hasta el cierre definitivo del libro (`class_book.status = 'closed'`); `updated_at` registra correcciones. 

`id int4 PK`   
`enrollment_id int4 FK` → `enrollments.id -- courses.type = 'professional'`   
`module TEXT NOT NULL -- "Módulo 1: Seguridad Vial"`   
`grade NUMERIC(3,1)`   
`passed BOOLEAN`   
`template_id int4 NULL`   
`recorded_by int4 FK` → `users.id -- secretaria o admin`   
`created_at TIMESTAMPTZ`   
`updated_at TIMESTAMPTZ -- registra correcciones previas al cierre del libro` 

`session_machinery` 

`id int4 PK`   
`session_id int4 FK` → `professional_practice_sessions.id -- solo práctica_campo`   
`type TEXT -- 'owned' | 'rented'`   
`description TEXT`   
`rental_cost INTEGER NULL`   
`created_at TIMESTAMPTZ` 

`license_validations` 

`id int4 PK`   
`student_id int4 FK` → `students.id`   
`enrollment_a2_id int4 FK` → `enrollments.id`   
`enrollment_a4_id int4 FK` → `enrollments.id`   
`reduced_hours INTEGER DEFAULT 60 -- RF-064`   
`book2_open_date DATE -- RF-065: 2 semanas después`   
`history_ref_id int4 FK` → `enrollments.id NULL -- RF-066`   
`created_at TIMESTAMPTZ` 

`professional_final_records` 

RF-074 — Resultado final del alumno en una promoción profesional. 

`id int4 PK`   
`enrollment_id int4 FK` → `enrollments.id UNIQUE -- courses.type = 'professional'`   
`result TEXT NOT NULL -- 'approved' | 'failed'`   
`final_grade NUMERIC(3,1) NULL -- promedio ponderado módulos`   
`practical_exam_passed BOOLEAN`   
`theory_attendance_pct NUMERIC(5,2) -- calculado al cerrar`   
`practical_attendance_pct NUMERIC(5,2)`   
`notes TEXT` 

`record_date DATE NOT NULL`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 23   
`registered_by int4 FK` → `users.id -- secretaria o admin`   
`created_at TIMESTAMPTZ` 

**Tablas compartidas (Clase B y Profesional)** 

`vehicles` 

`id int4 PK`   
`license_plate TEXT UNIQUE NOT NULL`   
`brand TEXT NOT NULL`   
`model TEXT NOT NULL`   
`year SMALLINT NOT NULL`   
`body_type TEXT -- 'sedan' | 'hatchback' | 'suv'`   
`transmission TEXT -- 'manual' | 'automatic'`   
`branch_id int4 FK` → `branches.id`   
`status TEXT -- 'operational' | 'in_use' | 'maintenance' | 'out_of_service' | 'blocked' current_km INTEGER DEFAULT 0` 

`last_inspection DATE NULL`   
`last_maintenance DATE`   
`created_at TIMESTAMPTZ` 

`vehicle_documents` 

`id int4 PK`   
`vehicle_id int4 FK` → `vehicles.id`   
`type TEXT -- 'soap' | 'technical_inspection' | 'circulation_permit' | 'insurance' issue_date DATE` 

`expiry_date DATE NOT NULL`   
`status TEXT -- 'valid' | 'expiring_soon' | 'expired'`   
`file_url TEXT NULL`   
`created_at TIMESTAMPTZ` 

`maintenance_records` 

`id int4 PK`   
`vehicle_id int4 FK` → `vehicles.id`   
`type TEXT -- 'preventive' | 'corrective'`   
`description TEXT NOT NULL`   
`scheduled_date DATE`   
`completed_date DATE NULL`   
`km_at_time INTEGER`   
`workshop TEXT`   
`status TEXT -- 'scheduled' | 'in_progress' | 'completed'`   
`cost INTEGER NULL`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`certificate_batches` 

`id int4 PK`   
`batch_code TEXT UNIQUE NOT NULL -- "2026-01"`   
`folio_from INTEGER NOT NULL`   
`folio_to INTEGER NOT NULL`   
`available_folios INTEGER`   
`branch_id int4 FK` → `branches.id`   
`received_date DATE`   
`received_by int4 FK` → `users.id` 

`created_at TIMESTAMPTZ`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 24   
`certificates` 

`id int4 PK`   
`folio INTEGER UNIQUE NOT NULL`   
`batch_id int4 FK` → `certificate_batches.id`   
`enrollment_id int4 FK` → `enrollments.id`   
`student_id int4 FK` → `students.id`   
`type TEXT -- 'class_b' | 'professional'`   
`status TEXT -- 'available' | 'issued' | 'cancelled' qr_url TEXT NULL -- RF-075: QR de verificación issued_date DATE NULL` 

`issued_by int4 FK` → `users.id NULL`   
`created_at TIMESTAMPTZ` 

`certificate_issuance_log` 

`id int4 PK`   
`certificate_id int4 FK` → `certificates.id`   
`action TEXT -- 'downloaded' | 'email_sent' | 'printed' user_id int4 FK` → `users.id` 

`ip TEXT`   
`created_at TIMESTAMPTZ` 

`discounts` **(descuentos comerciales)** 

Diferente a `professional_promotions` — son descuentos aplicados en matrícula 

`id int4 PK`   
`name TEXT NOT NULL`   
`discount_type TEXT -- 'percentage' | 'fixed_amount'`   
`value INTEGER NOT NULL`   
`valid_from DATE NOT NULL`   
`valid_until DATE NULL -- NULL = permanente`   
`applicable_to TEXT -- 'all' | 'class_b' | 'professional' status TEXT -- 'active' | 'inactive' | 'expired' referral_code TEXT NULL` 

`created_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`discount_applications` 

`id int4 PK`   
`discount_id int4 FK` → `discounts.id`   
`enrollment_id int4 FK` → `enrollments.id`   
`discount_amount INTEGER NOT NULL`   
`applied_by int4 FK` → `users.id`   
`applied_at TIMESTAMPTZ` 

`pricing_seasons` 

`id int4 PK`   
`name TEXT -- "Verano 2026"`   
`price_class_b INTEGER NULL`   
`price_a2 INTEGER NULL`   
`start_date DATE`   
`end_date DATE`   
`active BOOLEAN DEFAULT false`   
`created_by int4 FK` → `users.id` 

`created_at TIMESTAMPTZ`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 25   
`notifications` 

`id int4 PK`   
`recipient_id int4 FK` → `users.id`   
`type TEXT -- 'email' | 'whatsapp' | 'system'`   
`subject TEXT`   
`message TEXT NOT NULL`   
`read BOOLEAN DEFAULT false`   
`sent_at TIMESTAMPTZ`   
`sent_ok BOOLEAN DEFAULT false`   
`send_error TEXT NULL`   
`reference_type TEXT NULL -- 'class_b' | 'professional_session' | 'document_expiry' | 'payment' |  'second_installment_charge'` 

`reference_id int4 NULL`   
`created_at TIMESTAMPTZ` 

`notification_templates` 

`id int4 PK`   
`name TEXT NOT NULL`   
`type TEXT -- 'email' | 'whatsapp' | 'system'`   
`subject TEXT`   
`body TEXT NOT NULL`   
`active BOOLEAN DEFAULT true`   
`created_at TIMESTAMPTZ` 

`alert_config` 

`id int4 PK`   
`alert_type TEXT NOT NULL -- 'technical_inspection' | 'soap' | 'insurance' | 'installment_charge' advance_days SMALLINT NOT NULL -- RF-024` 

`active BOOLEAN DEFAULT true`   
`branch_id int4 FK` → `branches.id NULL -- NULL = global` 

`audit_log` 

`id int4 PK`   
`user_id int4 FK` → `users.id NULL`   
`action TEXT NOT NULL`   
`entity TEXT NULL`   
`entity_id int4 NULL`   
`detail TEXT NULL`   
`ip TEXT NULL`   
`created_at TIMESTAMPTZ -- sin updated_at, inmutable` 

`service_catalog` 

RF-034 — Catálogo dinámico de servicios especiales (evolución del psicotécnico). Permite agregar nuevos servicios sin cambios de esquema. 

`id int4 PK`   
`name TEXT NOT NULL`   
 `-- 'Examen Psicotécnico' | 'Arriendo de Maquinaria Pesada' | 'Informe Psicotécnico Detallado' | ... description TEXT` 

`base_price INTEGER NOT NULL -- precio base en CLP`   
`active BOOLEAN DEFAULT true`   
`created_at TIMESTAMPTZ` 

`special_service_sales`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 26   
RF-034 — Registro de cada venta de servicio especial. Reemplaza a `psychotechnical_exams`. Los datos variables por tipo de servicio (resultado apto/no apto, fechas de validez, archivo adjunto) se almacenan en `metadata`. 

`id int4 PK`   
`student_id int4 FK` → `students.id`   
`service_id int4 FK` → `service_catalog.id`   
`sale_date DATE NOT NULL`   
`price INTEGER NOT NULL`   
`metadata JSONB NULL`   
 `-- Psicotécnico: { result: 'fit'|'unfit', valid_until: DATE, certificate_number: TEXT, file_url: TEXT }  -- Maquinaria: { machinery_description: TEXT, start_date: DATE, end_date: DATE }` 

 `-- Informe: { file_url: TEXT, delivery_date: DATE }`   
`registered_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`disciplinary_notes` 

`id int4 PK`   
`student_id int4 FK` → `students.id`   
`description TEXT NOT NULL`   
`date DATE NOT NULL`   
`recorded_by int4 FK` → `users.id`   
`created_at TIMESTAMPTZ` 

`secretary_observations` 

Bitácora interna de secretaria → Admin. Observaciones y recordatorios que la secretaria deja para el administrador. El Admin puede responder y marcar como resuelto. Solo Admin puede eliminar; la secretaria solo puede crear y leer. 

`id int4 PK`   
`type TEXT NOT NULL -- 'observation' | 'reminder' | 'urgent'`   
`message TEXT NOT NULL`   
`due_date DATE NULL -- fecha límite para recordatorios`   
`created_by int4 FK` → `users.id NOT NULL -- siempre rol = secretaria`   
`status TEXT DEFAULT 'pending'`   
 `-- 'pending'` → `no visto por el admin`   
 `-- 'seen'` → `admin lo leyó pero aún no resuelve`   
 `-- 'resolved'` → `admin marcó como resuelto`   
`admin_reply TEXT NULL -- respuesta del admin (opcional)`   
`seen_by int4 FK` → `users.id NULL`   
`seen_at TIMESTAMPTZ NULL`   
`created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` 

`class_book` 

RF-103 — Libro oficial de un curso dentro de una promoción profesional. Aplica exclusivamente a **Clase Profesional** (Conductores Chillán). Ciclo de vida: nace al crear la promoción (estado `'draft'`), se activa al iniciar el período, se puede editar hasta 1 semana después de que termina la promoción (`closes_at`), y luego se cierra definitivamente. El historial de libros cerrados (`status = 'closed'`) sirve para auditorías del MTT. La secretaria gestiona el libro mediante una vista tipo grilla: puede agregar/quitar alumnos (deserciones e incorporaciones tardías) y corregir datos antes del cierre definitivo. 

`id int4 PK`   
`branch_id int4 FK` → `branches.id -- siempre conductores-chillan`   
`promotion_course_id int4 FK` → `promotion_courses.id NOT NULL`   
 `-- Identifica el curso específico (A2/A3/A4/A5) y la promoción (período) a la que pertenece. period TEXT NOT NULL -- Código de la promoción, ej. "PROM-2026-01"` 

`pdf_url TEXT NULL -- PDF generado para envío al MTT`   
`generated_by int4 FK` → `users.id NULL`   
`generated_at TIMESTAMPTZ NULL`   
`status TEXT -- 'draft' | 'active' | 'in_review' | 'closed'`   
 `-- 'draft'` → `creado junto con la promoción; aún no se ha iniciado el período`   
 `-- 'active'` → `período en curso; la secretaria puede agregar/quitar alumnos y editar datos  -- 'in_review'` → `promoción finalizada; editable durante el período de gracia (hasta closes_at)`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 27   
 `-- 'closed'` → `cerrado definitivamente; solo lectura; pasa al historial de auditoría MTT closes_at TIMESTAMPTZ NULL` 

 `-- Fecha límite para ediciones: professional_promotions.end_date + 7 días.`   
 `-- NULL mientras status = 'draft' o 'active'. Se calcula al transitar a 'in_review'.`   
 `-- Al superar closes_at sin cierre manual, un job automático transita a 'closed'.`   
`closed_at TIMESTAMPTZ NULL -- cuándo se cerró definitivamente (manual o automático) closed_by int4 FK` → `users.id NULL -- quién ejecutó el cierre (NULL si fue automático) created_at TIMESTAMPTZ` 

`updated_at TIMESTAMPTZ -- registra la última corrección realizada dentro del período de gracia` 

**Nota de alcance:** Esta tabla aplica **exclusivamente a Clase Profesional** (sede Conductores Chillán, cursos A2/A3/A4/A5). La Clase B no genera `class_book`; su control de asistencia y progreso se gestiona directamente desde `class_b_sessions` y `class_b_practice_attendance`. 

`biometric_records` 

`id int4 PK`   
`student_id int4 FK` → `students.id`   
`class_b_session_id int4 FK` → `class_b_sessions.id NULL -- Clase B`   
`professional_session_id int4 FK` → `professional_practice_sessions.id NULL -- Profesional event_type TEXT -- 'entry' | 'exit'` 

`method TEXT -- 'fingerprint' | 'facial'`   
`gps POINT NULL`   
`timestamp TIMESTAMPTZ NOT NULL`   
`created_at TIMESTAMPTZ` 

`school_schedules` 

`id int4 PK`   
`branch_id int4 FK` → `branches.id`   
`day_of_week SMALLINT -- 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom`   
`opening_time TIME -- 08:00`   
`closing_time TIME -- 20:00 (L-V) | 13:00 (Sáb) | NULL (Dom)`   
`active BOOLEAN DEFAULT true`   
`-- Domingo (7): active = false (CERRADO)`   
`-- Lunes-Viernes (1-5): 08:00-20:00 (12 bloques de 1h)`   
`-- Sábado (6): 08:00-13:00 (5 bloques de 1h)` 

**4\. Diagrama ERD textual** 

`branches`   
■■`&lt; users &gt;`■`&lt; roles`   
■ ■■`&lt; professional_pre_registrations (potencial alumno; aún NO es student)` ■ ■ ■ `temp_user_id` → `users NOT NULL (cuenta temp: role_id=NULL, active=false)` 

■ ■ ■ `datos personales en users, NO duplicados aquí`   
■ ■ ■■ `converted_enrollment_id` → `enrollments (NULL hasta matrícula presencial)`   
■ ■■`&lt; students`   
■ ■ ■■`&lt; enrollments &gt;`■ `courses &gt;`■ `sence_codes`   
■ ■ ■ ■■ `[courses.type = 'class_b']` ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■ ■ ■ ■ ■■`&lt; class_b_sessions &gt;`■ `instructors &gt;`■ `vehicle_assignments &gt;`■ `vehicles` ■ ■ ■ ■ ■■`&lt; class_b_practice_attendance` ■ ■ ■ ■ ■■ `[courses.type = 'professional']` ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■ ■ ■ ■ ■■ `promotion_course_id` → `promotion_courses (NULL = pendiente asignación)` ■ ■ ■ ■ ■ ■ `(curso A2/A3/A4/A5 con su relator, dentro de la promoción)` ■ ■ ■ ■ ■ ■■ `promotion_id` → `professional_promotions (paraguas 30 días)` ■ ■ ■ ■ ■ ■■ `course_id` → `courses (A2/A3/A4/A5)` 

■ ■ ■ ■ ■ ■■ `lecturer_id` → `lecturers`   
■ ■ ■ ■ ■ ■■`&lt; professional_theory_sessions (Zoom por curso)` ■ ■ ■ ■ ■ ■ ■■`&lt; professional_theory_attendance &gt;`■ `absence_evidence` ■ ■ ■ ■ ■ ■■`&lt; professional_practice_sessions (práctica campo por curso)` ■ ■ ■ ■ ■ ■■`&lt; professional_practice_attendance &gt;`■ `absence_evidence` ■ ■ ■ ■ ■ ■■`&lt; session_machinery`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 28   
■ ■ ■ ■ ■■`&lt; professional_module_grades`   
■ ■ ■ ■ ■■ `professional_final_records`   
■ ■ ■ ■■`&lt; student_documents`   
■ ■ ■ ■■`&lt; payments &gt;`■ `sii_receipts`   
■ ■ ■ ■ ■■`&lt; payment_denominations (desglose billetes/monedas, solo si cash_amount&gt;0)` ■ ■ ■ ■■`&lt; discount_applications &gt;`■ `discounts` 

■ ■ ■ ■■`&lt; certificates &gt;`■ `certificate_batches`   
■ ■ ■ ■ ■■`&lt; certificate_issuance_log`   
■ ■ ■■`&lt; class_b_exam_scores (solo Clase B; ingreso manual)`   
■ ■ ■■`&lt; class_b_exam_attempts &gt;`■ `class_b_exam_catalog &gt;`■`&lt; class_b_exam_questions (solo Clase B;  online)` 

■ ■ ■■`&lt; special_service_sales &gt;`■ `service_catalog`   
■ ■ ■■`&lt; disciplinary_notes`   
■ ■ ■■`&lt; license_validations (solo Profesional)`   
■ ■ ■■`&lt; digital_contracts`   
■ ■■`&lt; instructors (solo Clase B)`   
■ ■ ■■`&lt; instructor_replacements`   
■ ■ ■■`&lt; instructor_monthly_hours`   
■ ■ ■■`&lt; instructor_advances`   
■ ■ ■■`&lt; instructor_monthly_payments (liquidación; descuenta instructor_advances)` ■ ■■`&lt; lecturers (solo Profesional)` 

■ ■ ■■`&lt; lecturer_monthly_hours`   
■ ■■`&lt; audit_log`   
■■`&lt; secretary_observations &gt;`■ `users (created_by = secretaria; seen_by = admin)`   
■■`&lt; vehicles (usado en Clase B)`   
■ ■■`&lt; vehicle_documents`   
■ ■■`&lt; maintenance_records`   
■ ■■`&lt; route_incidents`   
■■`&lt; professional_promotions (paraguas del período, máx 100 alumnos)`   
■ ■■`&lt; promotion_courses (uno por cada A2/A3/A4/A5, máx 25 c/u)`   
■ ■■ `template_id` → `professional_schedule_templates (horario fijo 30 días)`   
■ ■■`&lt; template_blocks (sesiones por semana/día/hora; genera T10)`   
■■ `alert_config` 

`-- Sesiones grupales (no ligadas a una matrícula individual, sí al curso dentro de la promoción) class_b_theory_sessions &gt;`■ `instructors (teóricas grupales Clase B)` 

■■`&lt; class_b_theory_attendance &gt;`■ `students` 

`-- Nota: professional_theory_sessions y professional_practice_sessions se muestran ya en el árbol -- de promotion_courses arriba; se repiten aquí por claridad:` 

`professional_theory_sessions &gt;`■ `promotion_courses &gt;`■ `professional_promotions (Zoom por curso)` ■■`&lt; professional_theory_attendance &gt;`■ `students / absence_evidence` 

`professional_practice_sessions &gt;`■ `promotion_courses (práctica campo por curso)` ■■`&lt; professional_practice_attendance &gt;`■ `students / absence_evidence` 

■■`&lt; session_machinery` 

`class_book &gt;`■ `promotion_courses (solo Clase Profesional, RF-103; status:  draft`→`active`→`in_review`→`closed; closes_at = end_date+7d)` 

`pricing_seasons (global / por sede)` 

`-- Repositorio DMS institucional (no ligado a alumno ni matrícula)`   
`school_documents &gt;`■ `branches (NULL = ambas sedes; solo Admin elimina, Secretaria CR)` 

`-- Cursos singulares grupales (SENCE, Grúa, Maquinaria, etc.) — sin agenda; solo datos/pagos/docs standalone_courses &gt;`■ `branches` 

■■`&lt; standalone_course_enrollments &gt;`■ `students`   
 ■■ `certificate_id` → `certificates (NULL hasta emitir)` 

**5\. Consideraciones especiales** 

**5.1 Row Level Security (RLS) — Supabase / PostgreSQL** 

**El rol** `lecturer` **no tiene acceso al sistema.** La columna Relator se omite; todas sus operaciones anteriores fueron absorbidas por Secretaria/Admin.

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 29 

| Tabla  | Admin  | Secretaria  | Instructor  | Alumno |
| ----- | :---- | :---- | :---- | :---- |
| `users`  | CRUD  | R (sin admin)  | R (sí mismo)  | R (sí mismo) |
| `enrollments`  | CRUD  | CRUD  | R  | R (sí mismo) |
| `class_b_sessions`  | CRUD  | CRUD  | CRU  | R (suyas) |
| `class_b_theory_ses sions` | CRUD  | CRUD  | CRU  | R |
| `promotion_courses`  | CRUD  | CRUD  | —  | R |
| `professional_theor y_sessions` | CRUD  | CRUD  | —  | R |
| `professional_pract ice_sessions` | CRUD  | CRUD  | —  | R (suyas) |
| `class_b_theory_att endance` | CRUD  | CRUD  | CRU  | R (suyas) |
| `class_b_practice_a ttendance` | CRUD  | CRUD  | CRU  | R (suyas) |
| `professional_theor y_attendance` | CRUD  | CRUD  | —  | R (suyas) |
| `professional_pract ice_attendance` | CRUD  | CRUD  | —  | R (suyas) |
| `professional_modul e_grades` | CRUD  | CRUD  | —  | R (suyas) |
| `professional_final _records` | CRUD  | CRUD  | —  | R (sí mismo) |
| `payments`  | CRUD  | CRUD  | —  | R (suyos) |
| `vehicles`  | CRUD  | R  | R  | — |
| `instructors`  | CRUD  | R  | R (sí mismo)  | R (instructor asignado) |
| `student_documents`  | CRUD  | CR  | R  | CRU (sí mismo) |
| `school_documents`  | CRUD  | CR  | —  | — |
| `digital_contracts`  | CRUD  | CR  | —  | R (sí mismo) |
| `document_templates`  | CRUD  | R  | R  | R |
| `audit_log`  | R  | —  | —  | — |
| `instructor_advance s` | CRUD  | CR  | R (sí mismo)  | — |
| `instructor_monthly _hours` | CRUD  | —  | R (sí mismo)  | — |
| `instructor_monthly _payments` | CRUD  | —  | R (sí mismo)  | — |
| `secretary_observat ions` | CRUD  | CR  | —  | — |
| `cash_closings`  | CRUD  | CR (abierto; solo últimos 2 días) | —  | — |

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 30

| Tabla  | Admin  | Secretaria  | Instructor  | Alumno |
| :---- | :---- | :---- | :---- | :---- |
| `payment_denominati ons` | CRUD  | CR  | —  | — |
| `expenses`  | CRUD  | CRUD  | —  | — |
| `absence_evidence`  | CRUD  | CRUD  | —  | CRU (sí mismo) |
| `class_book`  | CRUD  | CRU (status ≠ closed)  | —  | R |
| `class_b_exam_catal og` | CRUD  | R  | —  | R |
| `class_b_exam_quest ions` | CRUD  | R  | —  | R (solo durante intento activo) |
| `class_b_exam_attem pts` | CRUD  | R  | —  | CR (sí mismo) |
| `class_b_exam_score s` | CRUD  | CR  | CRU  | R (suyas) |

**Política** `instructors` **(Alumno):** Un alumno solo puede leer el instructor que tiene asignado en sus `class_b_sessions` activas: 

`CREATE POLICY student_read_assigned_instructor ON instructors`   
 `FOR SELECT TO alumno`   
 `USING (id IN (`   
 `SELECT cb.instructor_id FROM class_b_sessions cb`   
 `JOIN enrollments e ON e.id = cb.enrollment_id`   
 `WHERE e.student_id = (SELECT id FROM students WHERE user_id = auth.uid())`   
 `AND cb.status NOT IN ('cancelled')`   
 `));` 

**Política multi-sede:** Un usuario con `can_access_both_branches = false` solo ve registros donde `branch_id = user.branch_id`. 

**Política temporal** `cash_closings` **(Secretaria):** 

`-- Secretaria solo puede leer cuadraturas de los últimos 2 días calendario`   
`CREATE POLICY secretary_cash_closings_read ON cash_closings`   
 `FOR SELECT TO secretaria`   
 `USING (date &gt;= CURRENT_DATE - INTERVAL '2 days');` 

**Política** `instructor_monthly_hours` **y** `instructor_monthly_payments` **(Secretaria):** Sin acceso a ninguna de las dos. La secretaria puede ver anticipos individuales (`instructor_advances`) para saber cuánto cobra un instructor en un pago específico, pero **no** el acumulado mensual de horas ni la liquidación mensual. 

**5.2 Triggers recomendados** 

`-- T1: Recalcular pending_balance en enrollments al insertar/actualizar payments`   
`CREATE TRIGGER trg_update_balance`   
`AFTER INSERT OR UPDATE ON payments`   
`FOR EACH ROW EXECUTE FUNCTION recalculate_enrollment_balance();` 

`-- T2: Estado de vehicle_documents según expiry_date`   
`CREATE TRIGGER trg_vehicle_doc_status`   
`BEFORE INSERT OR UPDATE ON vehicle_documents`   
`FOR EACH ROW EXECUTE FUNCTION calculate_vehicle_document_status();` 

`-- T3: Log de auditoría automático en entidades críticas (RF-009)`   
`CREATE TRIGGER trg_audit_{entity}`   
`AFTER INSERT OR UPDATE OR DELETE ON {enrollments|payments|users|class_b_sessions|class_b_theory_sessions|promo  tion_courses|professional_theory_sessions|professional_practice_sessions|professional_module_grades|class_`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 31   
 `book}`   
`FOR EACH ROW EXECUTE FUNCTION log_change();` 

`-- T4: Alerta cuando license_expiry del instructor` ≤ `30 días`   
`CREATE TRIGGER trg_license_alert`   
`AFTER UPDATE OF license_expiry ON instructors`   
`FOR EACH ROW EXECUTE FUNCTION generate_license_alert();` 

`-- T5: Decrementar available_folios al emitir certificado`   
`CREATE TRIGGER trg_batch_folios`   
`AFTER INSERT ON certificates`   
`FOR EACH ROW EXECUTE FUNCTION decrement_batch_folio();` 

`-- T6a: Detectar 2 inasistencias prácticas consecutivas` → `deserción Clase B (RF-053) CREATE TRIGGER trg_class_b_dropout` 

`AFTER INSERT OR UPDATE ON class_b_practice_attendance`   
`FOR EACH ROW EXECUTE FUNCTION verify_class_b_dropout_rule();` 

`-- T6b: Detectar inasistencias en Profesional` → `semáforo rojo (RF-070)`   
`-- professional_theory_attendance referencia professional_theory_sessions (Zoom) CREATE TRIGGER trg_professional_attendance_flag` 

`AFTER INSERT OR UPDATE ON professional_theory_attendance`   
`FOR EACH ROW EXECUTE FUNCTION update_professional_attendance_flag();` 

`CREATE TRIGGER trg_professional_practice_flag`   
`AFTER INSERT OR UPDATE ON professional_practice_attendance`   
`FOR EACH ROW EXECUTE FUNCTION update_professional_attendance_flag();` 

`-- T7: Gatillo RF-082.4: class_b_sessions #12 completada + asistencia teórica 100% --` → `actualizar enrollments.certificate_enabled = true` 

`CREATE TRIGGER trg_enable_certificate_b`   
`AFTER UPDATE OF status ON class_b_sessions`   
`FOR EACH ROW WHEN (NEW.status = 'completed' AND NEW.class_number = 12)`   
`EXECUTE FUNCTION verify_class_b_certificate_enablement();` 

`-- T8: Gatillo RF-093 Profesional: 30 días cumplidos + asistencia OK + notas` ≥ `4.0 + saldo = 0 --` → `actualizar enrollments.certificate_enabled = true` 

`CREATE TRIGGER trg_enable_certificate_prof`   
`AFTER INSERT OR UPDATE ON professional_final_records`   
`FOR EACH ROW EXECUTE FUNCTION verify_professional_certificate_enablement();` 

`-- T9: Al insertar un promotion_courses con template_id definido, generar automáticamente -- todas las professional_theory_sessions y professional_practice_sessions del período de 30 días. -- Lee los template_blocks de la plantilla asignada y calcula las fechas reales a partir -- de professional_promotions.start_date.` 

`-- Fórmula de fecha: start_date + (week_number-1)*7 dias + (day_of_week-1) dias CREATE TRIGGER trg_generate_professional_course_sessions` 

`AFTER INSERT ON promotion_courses`   
`FOR EACH ROW WHEN (NEW.template_id IS NOT NULL)`   
`EXECUTE FUNCTION generate_sessions_from_template();` 

`-- T10: Validaciones de matrícula que requieren JOIN a courses`   
`-- - class_b no puede tener promotion_course_id (no aplica a Clase B)`   
`-- - draft solo permitido en class_b`   
`-- - professional: promotion_course_id puede ser NULL (asignación diferida) o con valor (asignación  directa)` 

`CREATE OR REPLACE FUNCTION trg_enrollment_validation_fn()`   
`RETURNS TRIGGER AS $$`   
`DECLARE`   
 `v_type TEXT;`   
`BEGIN`   
 `SELECT type INTO v_type FROM courses WHERE id = NEW.course_id;` 

 `IF v_type = 'class_b' AND NEW.promotion_course_id IS NOT NULL THEN`   
 `RAISE EXCEPTION 'Matrícula Clase B no puede tener promotion_course_id';` 

 `END IF;`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 32   
 `IF NEW.status = 'draft' AND v_type != 'class_b' THEN`   
 `RAISE EXCEPTION 'Estado draft solo aplica a Clase B';`   
 `END IF;` 

 `-- registration_channel: Profesional y SENCE son siempre presenciales`   
 `IF v_type = 'professional' AND NEW.registration_channel = 'online' THEN`   
 `RAISE EXCEPTION 'Matrícula Profesional debe ser presencial (in_person)';`   
 `END IF;`   
 `IF NEW.sence_code_id IS NOT NULL AND NEW.registration_channel = 'online' THEN  RAISE EXCEPTION 'Matrícula SENCE debe ser presencial (in_person)';` 

 `END IF;` 

 `RETURN NEW;`   
`END;`   
`$$ LANGUAGE plpgsql;` 

`CREATE TRIGGER trg_enrollment_validation`   
 `BEFORE INSERT OR UPDATE ON enrollments`   
 `FOR EACH ROW EXECUTE FUNCTION trg_enrollment_validation_fn();` 

`-- T11: Al transitar professional_promotions a 'finished',`   
`-- actualizar class_book.status` → `'in_review' y calcular closes_at = end_date + 7 días. -- Un CRON job diario verifica si closes_at &lt; NOW() y, si nadie cerró manualmente, -- transita class_book.status` → `'closed', registra closed_at = NOW(), closed_by = NULL. CREATE TRIGGER trg_class_book_lifecycle` 

`AFTER UPDATE OF status ON professional_promotions`   
`FOR EACH ROW WHEN (NEW.status = 'finished')`   
`EXECUTE FUNCTION update_class_book_to_in_review();` 

`-- T13: Al transitar enrollment de 'draft'` → `'pending_docs' (solo Clase B),`   
`-- verificar que exista al menos 1 class_b_sessions con status='scheduled'. -- Implementa la regla: "La secretaria no puede finalizar la matrícula sin -- asignar un bloque horario" (Módulo 7 — ultimos_cambios.md).` 

`CREATE OR REPLACE FUNCTION trg_draft_to_pending_validation_fn()`   
`RETURNS TRIGGER AS $$`   
`DECLARE`   
 `v_type TEXT;`   
 `v_count INT;`   
`BEGIN`   
 `-- Solo aplica a la transición draft` → `pending_docs`   
 `IF OLD.status != 'draft' OR NEW.status != 'pending_docs' THEN`   
 `RETURN NEW;`   
 `END IF;` 

 `SELECT type INTO v_type FROM courses WHERE id = NEW.course_id;` 

 `IF v_type = 'class_b' THEN`   
 `-- Validar que exista al menos 1 sesión práctica agendada`   
 `SELECT COUNT(*) INTO v_count`   
 `FROM class_b_sessions`   
 `WHERE enrollment_id = NEW.id AND status = 'scheduled';` 

 `IF v_count = 0 THEN`   
 `RAISE EXCEPTION 'Clase B: debe asignar al menos un bloque horario antes de avanzar la matrícula';  END IF;` 

 `END IF;` 

 `-- Para Profesional: promotion_course_id puede seguir NULL (asignación diferida válida)  -- La validación de cupo se hace en el UI antes de activar; no se bloquea aquí.` 

 `RETURN NEW;`   
`END;`   
`$$ LANGUAGE plpgsql;` 

`CREATE TRIGGER trg_draft_to_pending_validation`   
 `BEFORE UPDATE OF status ON enrollments`   
 `FOR EACH ROW EXECUTE FUNCTION trg_draft_to_pending_validation_fn();` 

`-- CRON JOB (Python): Cleanup de matrículas draft Clase B expiradas (cada 15 min) -- Solo aplica a matrículas en estado 'draft' (implícitamente Clase B, garantizado por T11). -- Implementar como tarea programada en Python (APScheduler, Celery, etc.) que ejecute: --`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 33   
`-- Pasos:`   
`-- 1) Cancelar las class_b_sessions asociadas (status` → `'cancelled', counts_as_taken = false) -- 2) Marcar la matrícula draft como 'cancelled' y limpiar expires_at` 

`-- Esto libera los slots del calendario para que otros alumnos puedan reservarlos. --` 

`-- SQL de referencia (ejecutado desde el job Python):`   
`--`   
`-- UPDATE class_b_sessions`   
`-- SET status = 'cancelled', counts_as_taken = false, cancelled_at = NOW()`   
`-- WHERE enrollment_id IN (`   
`-- SELECT id FROM enrollments`   
`-- WHERE status = 'draft'`   
`-- AND expires_at &lt; NOW()`   
`-- );`   
`--`   
`-- UPDATE enrollments`   
`-- SET status = 'cancelled', expires_at = NULL`   
`-- WHERE status = 'draft'`   
`-- AND expires_at &lt; NOW();` 

**5.3 Índices críticos** 

`-- Búsqueda frecuente por RUT (RF-081)`   
`CREATE UNIQUE INDEX idx_users_tax_id ON users(rut);` 

`-- Agenda Clase B: triple match instructor + vehículo + alumno`   
`CREATE INDEX idx_class_b_sessions_date_instructor ON class_b_sessions(instructor_id, scheduled_at)  WHERE status NOT IN ('cancelled');` 

`CREATE INDEX idx_class_b_sessions_date_vehicle ON class_b_sessions(vehicle_id, scheduled_at)  WHERE status NOT IN ('cancelled');` 

`-- Asignación activa de vehículo (una por vehículo a la vez)`   
`CREATE UNIQUE INDEX idx_active_vehicle_assignment`   
 `ON vehicle_assignments(vehicle_id) WHERE end_date IS NULL;` 

`-- Asistencia Clase B: verificar 2 inasistencias consecutivas (RF-053)`   
`CREATE INDEX idx_class_b_practice_attendance_student ON class_b_practice_attendance(student_id, recorded_at  DESC);` 

`-- Asistencia Profesional: cálculo de porcentaje por matrícula`   
`CREATE INDEX idx_professional_theory_attendance_enrollment ON professional_theory_attendance(enrollment_id,  theory_session_prof_id);` 

`CREATE INDEX idx_professional_practice_attendance_enrollment ON`   
 `professional_practice_attendance(enrollment_id, session_id);` 

`-- Documentos próximos a vencer (RF-021, RF-024)`   
`CREATE INDEX idx_vehicle_docs_expiry ON vehicle_documents(expiry_date, status);` 

`-- Auditoría: filtro por fecha y usuario (RF-010)`   
`CREATE INDEX idx_audit_log_time ON audit_log(created_at DESC);`   
`CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);` 

`-- Matrículas activas por sede y mes (tipo se obtiene JOIN courses)`   
`CREATE INDEX idx_enrollments_branch_date ON enrollments(branch_id, course_id, created_at)  WHERE status = 'active';` 

`-- Notificaciones no leídas`   
`CREATE INDEX idx_unread_notifications ON notifications(recipient_id)`   
 `WHERE read = false;` 

`-- Cursos dentro de una promoción (para mostrar los 4 cursos de una promoción)`   
`CREATE INDEX idx_promotion_courses_promotion ON promotion_courses(promotion_id);` 

`-- Bloques de una plantilla de horario profesional`   
`CREATE INDEX idx_template_blocks ON template_blocks(template_id, week_number, day_of_week);` 

`-- Sesiones prácticas profesional por curso de promoción y fecha`   
`CREATE INDEX idx_professional_sessions_course ON professional_practice_sessions(promotion_course_id, date); -- Clases teóricas Zoom profesional por curso de promoción y fecha`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 34   
`CREATE INDEX idx_professional_theory_sessions_course ON professional_theory_sessions(promotion_course_id,  date);` 

`-- Clases teóricas Zoom Clase B por sede y fecha (para agrupar alumnos de la misma sede)`   
`CREATE INDEX idx_class_b_theory_sessions_branch ON class_b_theory_sessions(branch_id, scheduled_at);` 

`-- Borradores expirados (para CRON job de cleanup; solo class_b puede estar en draft, garantizado por T11) CREATE INDEX idx_enrollments_expired_drafts` 

 `ON enrollments(expires_at)`   
 `WHERE status = 'draft';` 

**5.4 Constraints de negocio** 

`-- Edad mínima 17 años al matricular (RF-082)`   
`ALTER TABLE students ADD CONSTRAINT chk_minimum_age`   
 `CHECK (birth_date &lt;= CURRENT_DATE - INTERVAL '17 years');` 

`-- Pago con montos positivos`   
`ALTER TABLE payments ADD CONSTRAINT chk_positive_amount`   
 `CHECK (total_amount &gt; 0);` 

`-- Solo un instructor activo por vehículo simultáneo (RF-045)`   
`CREATE UNIQUE INDEX idx_unique_vehicle_assignment`   
 `ON vehicle_assignments(vehicle_id) WHERE end_date IS NULL;` 

`-- Sin solapamiento de clases para instructor en Clase B (RF-046)`   
`-- (implementar con exclusion constraint o trigger)` 

`-- Folio de certificado dentro del rango del lote`   
`-- (implementar en trigger T5 con verificación rango)` 

`-- Nota de módulo debe ser 1.0..7.0 (escala chilena)`   
`ALTER TABLE professional_module_grades ADD CONSTRAINT chk_grade_range`   
 `CHECK (grade BETWEEN 1.0 AND 7.0);` 

`-- Nota acta final también en escala chilena`   
`ALTER TABLE professional_final_records ADD CONSTRAINT chk_final_grade_range`   
 `CHECK (final_grade IS NULL OR final_grade BETWEEN 1.0 AND 7.0);` 

`-- Asistencia profesional: mínimo 75% teórica, 100% práctica (RF-069)`   
`-- (implementar como función de validación al generar professional_final_records)` 

`-- biometric_records: exactamente uno de class_b_session_id o professional_session_id`   
`ALTER TABLE biometric_records ADD CONSTRAINT chk_biometric_context`   
 `CHECK (`   
 `(class_b_session_id IS NOT NULL AND professional_session_id IS NULL) OR`   
 `(class_b_session_id IS NULL AND professional_session_id IS NOT NULL)`   
 `);` 

**5.5 Soft Delete**

| Tabla  | Campo/Estrategia |
| :---- | :---- |
| `users`  | `active = false` |
| `instructors`  | `active = false` \+ advertencia si `active_classes_count &gt; 0` (RF-043) |
| `vehicles`  | `status = 'out_of_service'` |
| `enrollments`  | `status = 'cancelled'` (incluye drafts expirados limpiados por CRON job) |
| `certificates`  | `status = 'cancelled'` |
| `discounts`  | `status = 'inactive'` |

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 35 

| Tabla  | Campo/Estrategia |
| :---- | :---- |
| `professional_promotions`  | `status = 'cancelled'` |
| `promotion_courses`  | `status = 'cancelled'` (puede cancelarse un curso sin cancelar la promoción completa) |
| `cash_closings`  | `closed = true` (bloquea, no elimina) |
| `professional_pre_registrations`  | `status = 'expired'` (job automático cuando `expires_at &lt; NOW()`) |
| `standalone_courses`  | `status = 'cancelled'` |
| `standalone_course_enrollments`  | no soft-delete; se elimina físicamente si se anula antes del inicio |
| `secretary_observations`  | `status = 'resolved'` (no se eliminan físicamente; solo Admin puede hacerlo) |

**5.6 Campos calculados / vistas recomendadas** 

`-- Vista: progreso académico alumno Clase B`   
`-- class_b_sessions = solo prácticas; class_b_theory_attendance referencia class_b_theory_sessions (grupal) CREATE VIEW v_student_progress_b AS` 

`SELECT`   
 `m.id AS enrollment_id,`   
 `s.id AS student_id,`   
 `COUNT(cb.id) FILTER (WHERE cb.status = 'completed') AS completed_practices, -- class_b_sessions solo  prácticas` 

 `ROUND(COUNT(cb.id) FILTER (WHERE cb.status = 'completed') / 12.0 * 100) AS pct_practices,`   
 `-- Asistencia teórica: cruzar alumno con class_b_theory_sessions Zoom de su sede`   
 `ROUND(`   
 `COUNT(at.id) FILTER (WHERE at.status = 'present') * 100.0 /`   
 `NULLIF(COUNT(at.id), 0)`   
 `) AS pct_theory_attendance,`   
 `MAX(cb.updated_at) AS last_practice_session`   
`FROM enrollments m`   
`JOIN courses c ON c.id = m.course_id`   
`JOIN students s ON s.id = m.student_id`   
`LEFT JOIN class_b_sessions cb ON cb.enrollment_id = m.id`   
`LEFT JOIN class_b_theory_sessions ctb ON ctb.branch_id = m.branch_id -- grupal: todas de la sede LEFT JOIN class_b_theory_attendance at ON at.theory_session_b_id = ctb.id AND at.student_id = s.id WHERE c.type = 'class_b'` 

`GROUP BY m.id, s.id;` 

`-- Vista: asistencia Clase Profesional por matrícula (semáforo RF-070)`   
`-- pta referencia professional_theory_sessions (Zoom); ppa referencia professional_practice_sessions (campo) -- Ambas tablas se filtran por promotion_course_id (= enrollments.promotion_course_id)` 

`CREATE VIEW v_professional_attendance AS`   
`SELECT`   
 `m.id AS enrollment_id,`   
 `s.id AS student_id,`   
 `cc.promotion_id, -- para joins rápidos con professional_promotions`   
 `cc.course_id, -- para saber si es A2/A3/A4/A5`   
 `ROUND(`   
 `COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /`   
 `NULLIF(COUNT(pta.id), 0)`   
 `) AS pct_theory,`   
 `ROUND(`   
 `COUNT(ppa.id) FILTER (WHERE ppa.status = 'present') * 100.0 /`   
 `NULLIF(COUNT(ppa.id), 0)`   
 `) AS pct_practice,`   
 `CASE`   
 `WHEN COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /`   
 `NULLIF(COUNT(pta.id), 0) &gt;= 75`   
 `AND COUNT(ppa.id) FILTER (WHERE ppa.status = 'present') * 100.0 /`   
 `NULLIF(COUNT(ppa.id), 0) = 100 THEN 'green'` 

 `WHEN COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 36   
 `NULLIF(COUNT(pta.id), 0) &gt;= 60 THEN 'yellow'`   
 `ELSE 'red'`   
 `END AS attendance_flag`   
`FROM enrollments m`   
`JOIN courses c ON c.id = m.course_id`   
`JOIN students s ON s.id = m.student_id`   
`-- Obtener el promotion_course del alumno (su grupo A2/A3/A4/A5 dentro de la promoción) JOIN promotion_courses cc ON cc.id = m.promotion_course_id` 

`-- Teoría: solo las clases Zoom de su curso específico`   
`LEFT JOIN professional_theory_sessions pts ON pts.promotion_course_id = m.promotion_course_id LEFT JOIN professional_theory_attendance pta` 

 `ON pta.theory_session_prof_id = pts.id AND pta.student_id = s.id`   
`-- Práctica: solo las sesiones de campo de su curso específico`   
`LEFT JOIN professional_practice_sessions pps ON pps.promotion_course_id = m.promotion_course_id LEFT JOIN professional_practice_attendance ppa` 

 `ON ppa.session_id = pps.id AND ppa.student_id = s.id`   
`WHERE c.type = 'professional'`   
 `AND m.promotion_course_id IS NOT NULL -- excluir alumnos aún no asignados a promoción GROUP BY m.id, s.id, cc.promotion_id, cc.course_id;` 

`-- Vista: DMS — documentos del alumno (unión student_documents + digital_contracts) -- Alimenta el tab "Documentos del Alumno" del Repositorio DMS (Módulo 12).` 

`-- 'source' permite distinguir el origen para la lógica de eliminación (solo admin) -- y para saber qué tabla consultar al obtener el archivo.` 

`CREATE VIEW v_dms_student_documents AS`   
 `SELECT`   
 `sd.id::TEXT AS id,`   
 `'student_document' AS source, -- tabla origen`   
 `e.student_id,`   
 `sd.enrollment_id,`   
 `sd.type, -- 'id_photo' | 'national_id' | 'driver_record' | ...  sd.file_name,` 

 `sd.storage_url AS file_url,`   
 `sd.status,`   
 `sd.uploaded_at AS document_at,`   
 `sd.reviewed_by AS managed_by`   
 `FROM student_documents sd`   
 `JOIN enrollments e ON e.id = sd.enrollment_id` 

`UNION ALL` 

 `SELECT`   
 `dc.id::TEXT AS id,`   
 `'digital_contract' AS source,`   
 `dc.student_id,`   
 `dc.enrollment_id,`   
 `'contract' AS type, -- tipo virtual para el DMS`   
 `dc.file_name,`   
 `dc.file_url,`   
 `CASE WHEN dc.file_url IS NOT NULL THEN 'approved' ELSE 'pending' END AS status,  dc.accepted_at AS document_at,` 

 `NULL::INT AS managed_by`   
 `FROM digital_contracts dc`   
 `WHERE dc.file_url IS NOT NULL; -- solo contratos con PDF generado` 

`-- Vista: disponibilidad horaria Clase B (triple match instructor + vehículo) -- Excluye slots ocupados por clases confirmadas Y por drafts no expirados.` 

`-- Un draft expirado (enrollments.expires_at &lt; NOW()) ya fue procesado por el CRON job, -- por lo que sus class_b_sessions estarán en estado 'cancelled' y no bloquean slots. CREATE VIEW v_class_b_schedule_availability AS` 

`SELECT`   
 `i.id AS instructor_id,`   
 `v.id AS vehicle_id,`   
 `generate_series(`   
 `CURRENT_DATE::TIMESTAMPTZ,`   
 `(CURRENT_DATE + INTERVAL '14 days')::TIMESTAMPTZ,`   
 `'1 hour'`   
 `) AS slot`   
`FROM instructors i`   
`JOIN users u ON u.id = i.user_id`   
`CROSS JOIN vehicles v` 

`WHERE u.branch_id = v.branch_id`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 37   
 `AND NOT EXISTS (`   
 `SELECT 1 FROM class_b_sessions cb`   
 `JOIN enrollments m ON m.id = cb.enrollment_id`   
 `WHERE cb.instructor_id = i.id`   
 `AND cb.vehicle_id = v.id`   
 `AND cb.status NOT IN ('cancelled')`   
 `-- Incluir slots de drafts ACTIVOS (no expirados) como bloqueados`   
 `AND (m.status != 'draft' OR m.expires_at &gt; NOW())`   
 `);` 

**6\. Dependencias entre módulos** 

**Tabla de dependencias** 

| Módulo  | Depende de  | Alimenta a |
| :---- | :---- | :---- |
| **M1** Usuarios/Sedes  | —  | Todos |
| **M2** Notificaciones  | M1  | M4, M5, M6, M7 |
| **M3** Contabilidad  | M1, M6-Matrículas  | M6-Certificados (bloqueo RF-076) |
| **M4** Clase B  | M1, M6, M7, instructors  | M3 (payments), Certificados B |
| **M5** Clase Profesional  | M1, M6, lecturers  | M3, Certificados Profesional |
| **M6** Matrícula/Expediente  | M1, M3, M10  | M4, M5, M8 |
| **M7** Flota  | M1  | M4 (vehicles en class\_b\_sessions) |
| **M8** Seguridad  | M1  | transversal |
| **M9** KPIs  | todos  | — |
| **M10** Reglas Negocio  | M1, M4, M5  | M3, M4, M5 |
| **M14** Biometría/SENCE  | M1, M4, M5  | M9 |

**Flujo principal de datos** 

`[Alumno llega presencialmente o por web]`   
 ■   
 ▼   
`Examen Psicotécnico (M3/RF-034)` ■■■ `Resultado fit/unfit`   
 ■   
 ▼   
`Identificación del alumno (M1-RF-001/002)`   
 ■■ `Validación RUT (M1-RF-002)`   
 ■■ `Búsqueda usuario existente o creación básica de cuenta`   
 ■■ `Selección curso` → `courses.type = 'class_b' | 'professional'`   
 ■   
 ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■   
 ■ `CLASE B` ■ `CLASE PROFESIONAL`   
 ▼ ▼ 

`Wizard paso 1: Datos personales (M6-RF-080) Wizard paso 1: Datos personales (M6-RF-080)`  ■■ `Mismos campos para online (/matricula-online)` ■■ `Ídem` 

 ■■ `¿Menor edad?` → `alerta notarial (RF-082.1)` ■■ `Validación cadena licencia (RF-062/063)`  ■ ■ 

 ▼ ▼   
`Wizard paso 2: Selección de horario Wizard paso 2: Selección de Curso y Promoción  enrollments.status = 'draft' Dos opciones (ambas soportadas):` 

 `enrollments.expires_at = NOW() + 24h A) Asignación directa: elige promotion_course_id`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 38   
 `class_b_sessions creadas en status 'scheduled' B) Asignación diferida: solo courses.license_class  vinculadas al draft y la secretaría asigna promotion_course_id  Slots bloqueados en v_class_b_schedule_availability desde la vista de promociones luego  Si expires_at &lt; NOW()` → `CRON job libera los slots` 

 `T12: impide avanzar si no hay al menos 1 sesión Profesional pasa directo a 'pending_docs'  agendada (no existe estado 'draft' en Profesional)`  ■ 

 ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■  ■ 

 ▼   
`Wizard paso 3: Documentos (M6-RF-082)`   
 ■■ `Clase B: id_photo (online sube foto carnet RF-082.4; presencial puede omitirse y subirse luego)`  ■ `notarial_authorization (solo menores, RF-082.1)` 

 ■■ `Profesional: national_id + driver_license (flexibles) + driver_record (HVC, BLOQUEANTE RF-082.2)`  ■ 

 ▼   
`Wizard paso 4: Pago inicial (M3-RF-026/027)`   
 ■■ `Aplicar descuento (discount_applications)`   
 ■■ `Emitir boleta SII (sii_receipts, RF-033)`   
 ■   
 ▼   
`Wizard paso 5: Contrato (M6-RF-083)` ← `paso OBLIGATORIO (Módulo 7 — ultimos_cambios)`  ■■ `Alumno acepta digitalmente` → `digital_contracts.accepted_at, content_hash, signature_ip`  ■■ `Genera PDF firmado` → `digital_contracts.file_url (visible en DMS como tipo 'contract')`  ■ 

 ▼   
`Wizard paso 6: Resumen / Confirmación`   
 ■■ `enrollments.status = 'pending_docs'` → `'active' (si docs OK y pago registrado)`  ■ 

 ▼   
`Matrícula ACTIVA` ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■  ■ ■ 

 ■■■■■■■■■■■■■■ ■   
 ▼ ▼ ■   
 `CLASE B PROFESIONAL` ■   
 ■ ■ ■   
 ▼ ▼ ■   
 `class_b_sessions professional_practice_sessions (teoria_zoom | practica_campo)` ■  ■ ■ ■ 

 ▼ ■■■ `professional_theory_attendance (relator marca Zoom)` ■  `class_b_theory_` ■■■ `professional_practice_attendance (relator marca campo)` ■  `attendance +` ■ 

 `class_b_practice_ module_grades (por módulo técnico)` ■   
 `attendance` ■ ■   
 ■ ▼ ■   
 ■ `75% teoría + 100% práctica + notas` ≥ `4.0` ■   
 ■ ■■■ `professional_final_records` ■   
 ■ ■   
 `class_b_sessions incluye` ■   
 `(KM + GPS + notas post-clase)` ■   
 ■ ■   
 `Clase #12 + 100% asistencia teórica` ■   
 ■■■ `certificate_enabled = true (RF-082.4)` ■   
 ■ ■   
 ▼ ■   
 `Certificado emitido` ■■■■■■■■■■■■■■■■■■■■■■■■ `pending_balance = 0 (RF-076)` ■■■  `(Clase B: PDF + QR)` 

 `(Profesional: Casa Moneda físico + QR RF-075)` 

**7\. Reglas de validación del agendamiento Clase B** 

Extraídas de `web/src/lib/ClassSequenceValidator.ts` y `mockAvailability.ts` **Validaciones obligatorias (RF-014, RF-015, RF-017)**

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 39 

| Regla  | Descripción  | Resultado si falla |
| :---- | :---- | :---- |
| Secuencia obligatoria  | Solo puede agendar clase N si la N-1 ya fue `counts_as_taken=true` | Error: "Debe completar la clase anterior" |
| Aviso 24h mínimo  | La reserva debe hacerse con ≥24h de anticipación | Error: bloqueado al agendar |
| Máximo 3 pendientes  | No más de 3 `class_b_sessions` con `status='scheduled'` simultáneamente | Error a la 4ta, Warning en la 3ra |
| Sin duplicado diario  | Solo 1 clase por día por alumno  | Error |
| Disponibilidad instructor  | Instructor sin otra `class_b_sessions` en ese slot | Error |
| Cancelación \<24h \= cuenta  | Si cancela con \<24h → `counts_as_taken = true` | Advertencia \+ consume 1 de 12 |
| Reagendamiento  | Solo con \>24h de antelación  | Error |

**Horarios de la escuela (mockAvailability.ts)** 

| Día  | Apertura  | Cierre  | Bloques |
| :---- | :---- | :---- | :---- |
| Lunes–Viernes  | 08:00  | 20:00  | 12 bloques de 1h |
| Sábado  | 08:00  | 13:00  | 5 bloques de 1h |
| Domingo  | —  | —  | Cerrado |

**Campos clave en** `class_b_sessions` **para estas reglas** 

`counts_as_taken BOOLEAN -- True si: status='cancelled' con &lt;24h, o status='no_show'`   
`cancelled_at TIMESTAMPTZ -- Para calcular diferencia con scheduled_at` 

`-- getNextClassNumber() = completed + (cancelled &amp; counts_as_taken) + 1`

Sistema Escuela de Conductores — Análisis de Base de Datos — Pág. 40 