MÓDULO 1: GESTIÓN DE USUARIOS, ROLES Y SEDES 
● RF-001: Crear cuentas para Secretarias e Instructores con: nombre, RUT, email, 
fono, clave y rol. 
● RF-002: Validación de formato RUT chileno (Módulo 11) y unicidad de email/RUT en 
la base de datos. 
● RF-003: Edición de perfiles de usuario(estudiantes) con registro histórico de cambios 
realizados. 
● RF-005: Definición de permisos por Rol: Admin (Total), Secretaria (Ventas/Pagos), 
Instructor B. 
● RF-006: Sistema de Login seguro mediante correo electrónico y contraseña 
encriptada. 
● RF-007: Recuperación de contraseña mediante envío de enlace temporal al correo 
registrado. 
● RF-008: Validación de permisos en cada carga de página (Middleware) con 
redirección a "Acceso Denegado". 
● RF-009: Log de auditoría automático: registrar fecha, hora, usuario y acción (crear, 
editar, eliminar) de secretarias. 
● RF-010: Interfaz de visualización de Logs con filtros por fecha, usuario, acción y 
módulo. 
● RF-011: Gestión de sesiones mediante tokens seguros (JWT/Cookies) con 
expiración configurable. 
● RF-012: Separación de datos por sede: Autoescuela Chillán y Conductores 
Chillán. 
● RF-013: Capacidad del Admin para autorizar a una secretaria a operar en ambas 
sedes simultáneamente. 
● RF-014: Registro de intentos fallidos de inicio de sesión para detección de ataques 
de fuerza bruta. 
● RF-015: Obligación de cambio de contraseña en el primer inicio de sesión del 
usuario. 
MÓDULO 2: NOTIFICACIONES Y COMUNICACIÓN 
● RF-016: Envío automático de enlace de Zoom para clases teóricas de Clase B 
según calendario. 
● RF-017: Envío automático de link Zoom para clases teóricas de Clase Profesional. 
● RF-018: Notificación de cobro: aviso de pago de 2da cuota antes de la 7ma clase 
(Clase B). 
● RF-019: Sistema de correos masivos filtrados por: Sede, Curso o Promoción 
específica. 
● RF-020: Sistema de correos individuales para comunicación directa con un alumno. 
● RF-021: Alerta de vencimiento de documentos críticos de flota (Revisión Técnica 
cada 6 meses, Seguros). 
● RF-022: Notificación inmediata al Admin cuando ingresa una matrícula vía formulario 
web (Clase B). 
● RF-023: Notificación de encuesta: aviso al terminar curso para evaluar al instructor. 
● RF-024: Configuración de días de anticipación para alertas de vencimiento (Flota y 
Alumnos). 
● RF-025: Confirmación de recepción de documentos digitales al alumno. 
MÓDULO 3: CONTABILIDAD Y CUADRATURA 
● RF-026: Módulo de ingresos: Registro detallado de entradas de efectivo. 
● RF-027: Módulo de ingresos: Registro de pagos vía Voucher, Transferencia o 
Cheque con N° de documento. 
● RF-028: Módulo de egresos: Registro de gastos categorizados (Bencina, Arriendo, 
Aseo, etc.). 
● RF-029: Cálculo automático de balance de efectivo diario (Ingresos Cash - Gastos 
Cash). 
● RF-030: Reporte contable mensual exportable a PDF y Excel con resumen de 
secciones. 
● RF-031: Cálculo de Total Neto (Ingresos Totales - Gastos Totales) por rango de 
fechas. 
● RF-032: Generación de Cuadratura Diaria: resumen por concepto (B, Profesional, 
Psicotécnico) para SII. 
● RF-033: Indicador de "Falta Boleta" para pagos recibidos online pendientes de 
facturación oficial. 
● RF-034: Registro de servicios psicotécnicos externos ($40.000) con resultado 
Apto/No Apto.*** 
● RF-035: Gestión de cobro de cursos singulares (SENCE, Grúa, Retroexcavadora) de 
forma simplificada. 
● RF-036: Generación de comprobante de pago interno para el alumno tras cada 
abono. 
● RF-037: Bloqueo de edición de registros contables una vez realizada la cuadratura 
del día. 
● RF-038: Registro de anticipos otorgados a instructores asociados a su cuenta 
corriente interna. 
● RF-039: Alerta de morosidad en el dashboard de secretaría. 
● RF-040: Visualización de rentabilidad estimada por curso (Ingreso - Gastos directos). 
MÓDULO 4: GESTIÓN ACADÉMICA CLASE B (AUTOESCUELA CHILLÁN) 
● RF-041: Registro de instructores Clase B con fecha de vencimiento de licencia y 
teléfono. 
● RF-042: Edición de ficha de instructor e historial de asignaciones de vehículos. 
● RF-043: Desactivación de instructores con advertencia si tiene clases pendientes 
agendadas. 
● RF-044: Gestión de reemplazos: registrar instructor real vs original en la clase. 
● RF-045: Asignación dinámica de vehículo a instructor para control de disponibilidad. 
● RF-046: Vista de Horario Instructor: calendario personal con estado de clases. 
● RF-047: Cálculo de horas mensuales trabajadas por instructor (Clases 
completadas). 
● RF-048: Inicio/Cierre de clase sincronizado: la secretaria puede cerrar si el instructor 
olvida. 
● RF-049: Ficha técnica pos-clase: notas de desempeño y registro de KM recorridos. 
● RF-050: Firma digital del alumno capturada en el dispositivo al finalizar la clase B. 
● RF-051: Registro automático de asistencia "Asistió" al marcar clase como 
completada. 
● RF-052: Registro manual de inasistencias con motivo. 
● RF-053: Regla de deserción: eliminación automática de agenda tras 2 inasistencias 
consecutivas. 
● RF-054: Control de asistencia a clases teóricas (Zoom) Clase B. 
● RF-055: Dashboard de progreso del alumno: % clases prácticas (de 12) y % 
teóricas. 
● RF-056: Historial completo de clases del alumno con notas técnicas visibles para 
Admin/Secretaria. 
● RF-057: Registro de puntajes en ensayos teóricos (preparación examen municipal). 
MÓDULO 5: GESTIÓN CLASE PROFESIONAL (CONDUCTORES 
CHILLÁN) 
● RF-058: Registro de Relatores Profesionales con especialidad (A2, A3, A4, A5). 
● RF-059: Definición de Promoción: duración 30 días, inicio lunes c/2 semanas, max 
100 alumnos. 
● RF-060: Vista de Horario Relator: todas sus promociones asignadas y lista de curso. 
● RF-061: Configuración de fechas: sugerir lunes disponible y gestionar clases en 
feriados. 
● RF-062: Validación automática de edad (>20 años) y antigüedad licencia (>2 años B) 
para A2/A4. 
● RF-063: Validación de cadena de licencias para A3/A5 (Exigir A2 o A4 previa de 2 
años). 
● RF-064: Gestión de Convalidación: Reducción a 60 horas para programas 
simultáneos (A2+A4). 
● RF-065: Control de libros duales en convalidación: el 2do libro abre 2 semanas 
después. 
● RF-066: Convalidación Histórica: vincular alumno a promociones de hasta 6 años 
atrás. 
● RF-067: Registro de asistencia semanal presencial para teoría online (Firma física 
obligatoria). 
● RF-068: Registro de asistencia presencial diaria para bloques prácticos 
profesionales. 
● RF-069: Cálculo de % asistencia: Mínimo 75% teoría y 100% práctica para aprobar. 
● RF-070: Semáforo académico: Verde (OK), Amarillo (Límite), Rojo (Reprobado por 
falta). 
● RF-071: Registro de evidencias: adjuntar licencias médicas para justificar 
inasistencias. 
● RF-072: Ingreso de notas por módulo técnico utilizando plantillas de pruebas. 
● RF-073: Registro de maquinaria profesional utilizada (Propia / Arrendada) por 
sesión. 
● RF-074: Acta final de curso: ingreso de concepto Aprobado/Reprobado tras examen 
práctico. 
● RF-075: Generación de Certificado Final PDF con código QR de verificación. 
● RF-076: Bloqueo de certificación: el sistema impide generar PDF si hay deuda 
contable. 
● RF-077: Archivo histórico: consulta de asistencias y notas de promociones 
finalizadas. 
● RF-078: Registro de asistencia teoría Zoom (marcado manual por el relator). 
● RF-079: Dashboard de avance de promoción (Día X de 30). 
MÓDULO 6: GESTIÓN DE MATRÍCULA Y EXPEDIENTE DIGITAL 
● RF-080: Formulario de matrícula online para Clase B con carga de documentos. 
● RF-081: Buscador de alumnos por RUT, Nombre o N° de Expediente. 
● RF-082: Repositorio digital: Carga de Foto, Cédula de Identidad y Certificado 
Médico. 
● RF-082.1: [MENORES DE EDAD] El sistema debe detectar si el alumno tiene < 18 
años y bloquear el avance de la matrícula si no se carga el archivo "Autorización 
Notarial de Padres/Tutores". 
● RF-082.2: [PROFESIONAL - BLOQUEO] El sistema debe impedir el estado 
"Matriculado" en Clase Profesional si no se han cargado obligatoriamente: Hoja de 
Vida del Conductor (actualizada) y Resultado del Examen Psicológico Interno. 
● RF-082.3: [HOJA DE VIDA] El sistema debe permitir registrar la fecha de emisión 
de la Hoja de Vida del Conductor y alertar si tiene más de 30 días de antigüedad al 
momento de la matrícula. 
● RF-082.4: [GATILLO CLASE B] Al marcar la clase N° 12 como "Completada" y 
verificar asistencia teórica al 100%, el sistema debe habilitar automáticamente el 
botón "Generar Certificado B". 
● RF-093: [GATILLO PROFESIONAL] El certificado profesional se habilitará solo 
cuando: 
○ Se cumplan los 30 días de la promoción. 
○ La asistencia sea ≥ 75% (Teoría) y 100% (Práctica). 
○ Todas las notas de los módulos sean ≥ 4.0 (o el estándar definido). 
○ El estado contable sea "Pagado Total". 
● RF-083: Registro de contrato digital aceptado por el alumno. 
● RF-096: [HISTORIAL DE EMISIÓN] Registro de cada vez que se descarga o envía 
un certificado (Log de impresión). 
● RF-084: Carga de Certificado SEMEP (Psicotécnico municipal) para el expediente. 
● RF-085: Estado de Expediente: marcador visual de "Documentación Completa". 
● RF-086: Exportación de ficha de matrícula en formato PDF para firma física. 
MÓDULO 7: LOGÍSTICA DE FLOTA Y RECURSOS 
● RF-087: Registro de Vehículos: Patente, Marca, Modelo, Año y Sede asignada. 
● RF-088: Calendario de disponibilidad de vehículos para evitar tope de clases. 
● RF-089: Registro de mantenimiento: fecha y descripción de arreglos realizados. 
● RF-090: Alerta de kilometraje (informativa basada en fichas de clase). 
● RF-091: Hoja de ruta diaria: listado de clases y alumnos por cada vehículo. 
MÓDULO 8: SEGURIDAD Y ADMINISTRACIÓN DE SISTEMA 
● RF-092: Backup automático diario de la base de datos en nube/servidor externo. 
● RF-093: Encriptación de datos sensibles (RUT y Contraseñas). 
● RF-094: Timeout de sesión: cierre automático tras 30 min de inactividad. 
● RF-095: Panel de configuración global: nombres de sedes, precios base y días de 
feriados. 
● RF-096: Validación de formato de patentes chilenas. 
● RF-097: Bloqueo de inyección SQL y ataques XSS en formularios. 
● RF-098: Exportación de base de datos de alumnos a CSV (Solo Admin). 
MÓDULO 9: CALIDAD Y REPORTABILIDAD (KPIs) 
● RF-099: KPI Dashboard: Total recaudado hoy vs ayer. 
● RF-100: KPI Dashboard: Alumnos matriculados este mes por categoría. 
● RF-101: Reporte de tasa de aprobación municipal de los alumnos egresados. 
● RF-102: Encuesta de satisfacción post-curso automatizada. 
● RF-103: Generación de Libro de Clases oficial PDF (formato MTT). 
● RF-104: Reporte de productividad de instructores (clases realizadas vs canceladas). 
● RF-105: Listado de alumnos próximos a vencer su plazo de curso (Clase B). 
MÓDULO 10: REGLAS DE NEGOCIO Y VALIDACIONES TÉCNICAS 
(PIZARRA) 
● RF-106: Bloqueo de firmas retroactivas en el sistema (solo el Admin puede 
autorizar). 
● RF-107: Validación de "Doble Firma": el sistema exige firma de instructor y alumno 
para cerrar sesión B. 
● RF-108: Alerta de "Maquinaria Arrendada": avisar a secretaria si una promoción 
requiere arriendo de equipo. 
● RF-109: Registro de observaciones disciplinarias en el perfil del alumno. 
● RF-110: Gestión de "Temporadas": cambio masivo de precios por fechas especiales. 
● RF-111: Registro de "Incidentes en Ruta" asociado al vehículo y al instructor. 
● RF-112: Verificación de "Certificado Casa de Moneda" (Stock) para entrega física en 
Profesional. 
MÓDULO 14: CUMPLIMIENTO NORMATIVO Y BIOMETRÍA 
● RF-126: [CONTROL BIOMÉTRICO MTT] Si la normativa local exige huellero o 
reconocimiento facial, el sistema debe tener un módulo de integración (API) para 
registrar la entrada y salida de alumnos de clases teóricas en tiempo real, 
vinculándolos al attendance_record. 
● RF-127: [LIBRO DE CLASES DIGITAL - MODO AUDITORÍA] Una vista "Sólo 
Lectura" para fiscalizadores donde se vea la trazabilidad de las firmas digitales y la 
ubicación GPS (si se tomó la asistencia por móvil) para validar que la clase ocurrió 
realmente. 
● RF-128: [EXPORT LRE - SENCE] Para los cursos con franquicia SENCE, generar 
el archivo plano o Excel con el formato exacto que pide el Libro de Remuneraciones 
Electrónico o los portales de asistencia SENCE. 