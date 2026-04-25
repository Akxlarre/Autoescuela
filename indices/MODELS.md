# Índice de Modelos (Models Index)

Este índice mantiene el registro de los modelos del sistema, divididos rigurosamente entre DTOs de base de datos y modelos de Interfaz de Usuario (UI).

## 📁 DTO — Data Transfer Objects (`core/models/dto/`)
Interfaces que mapean 1:1 las tablas y vistas de Supabase. Son estructuras de datos puros, sin comportamiento ni lógica de negocio.

| Modelo | Archivo | Descripción |
|---|---|---|
| `User` | `user.model.ts` | Entidad base de Supabase Auth (AppUser), contiene el id, email y el rol del usuario (ADMIN, RECEPCION, etc.) |

## 📁 Interfaz de Usuario (`core/models/ui/`)
Estructuras de datos puramente visuales, consumidas por los componentes para su renderización.

| Modelo | Archivo | Descripción |
|---|---|---|
| `Notification` | `notification.model.ts` | Estructura para los banners/toasts del sistema (tipo, mensaje, icono) |
| `KpiItem` | `dashboard.model.ts` | Estructura visual para las tarjetas de indicadores principales (kpi-card) |
| `ActivityItem` | `dashboard.model.ts` | Elemento de la lista de actividad reciente del dashboard |
| `QuickActionItem` | `dashboard.model.ts` | Definición de configuración para los botones de acceso rápido |
| `SystemStatusItem` | `dashboard.model.ts` | Datos para el panel de estado de servicios del sistema |
| `EnrollmentPersonalData` | `enrollment-personal-data.model.ts` | Paso 1 del Wizard de Matrícula: datos personales (RUT, nombres, email, teléfono, fecha nacimiento, sexo, dirección, región, comuna), selección de categoría y tipo de curso, campos profesionales (licencia actual, convalidación A2+A4, libro habilitado) |
| `AgeValidation` | `enrollment-personal-data.model.ts` | Resultado de validación de edad del alumno: status (ok / under-17 / requires-authorization / none), edad calculada y mensaje UI |
| `LicenseValidation` | `enrollment-personal-data.model.ts` | Resultado de validación de licencia previa para cursos profesionales: validez, mensaje y antigüedad en años (RF-062) |
| `RegionOption`, `CommuneOption` | `enrollment-personal-data.model.ts` | Opciones para dropdowns de región y comuna |
| `SingularCourseOption`, `SenceCodeOption` | `enrollment-personal-data.model.ts` | Opciones para selects de cursos singulares y códigos SENCE |
| `HistoricalPromotion` | `enrollment-personal-data.model.ts` | Resultado de búsqueda de promoción histórica para convalidación A2+A4 (RF-064) |
| `EnrollmentWizardState` | `enrollment-wizard.model.ts` | Estado global del Wizard de 6 pasos: paso actual, configuración de steps (`StepConfig[]`), resumen lateral (`SidebarSummary`), flags de navegación |
| `CourseSummary` | `enrollment-wizard.model.ts` | Datos del panel lateral derecho: tipo de curso, duración, horas prácticas/teóricas, valor total |
| `Requirement` | `enrollment-wizard.model.ts` | Requisito del curso con flag `fulfilled` para el panel lateral |
| `StepConfig` | `enrollment-wizard.model.ts` | Configuración de cada paso del wizard: número, label, status (pending / active / completed / error). Constante: `ENROLLMENT_STEPS` |
| `EnrollmentAssignmentData` | `enrollment-assignment.model.ts` | Paso 2 del Wizard: modelo compuesto con vista condicional (class-b / professional / singular), modalidad de pago, instructor, slots seleccionados, promoción |
| `StudentSummaryBanner` | `enrollment-assignment.model.ts` | Banner resumen del alumno: iniciales, nombre completo, etiqueta del curso seleccionado |
| `PaymentModeOption` | `enrollment-assignment.model.ts` | Opción de modalidad de pago (full / deposit) con cantidad de clases prácticas asociadas |
| `InstructorOption` | `enrollment-assignment.model.ts` | Instructor disponible para asignación: nombre, vehículo, patente |
| `TimeSlot`, `ScheduleGrid` | `enrollment-assignment.model.ts` | Grilla semanal de disponibilidad del instructor: slots por hora/día con status (available / selected / occupied) |
| `SlotSelection` | `enrollment-assignment.model.ts` | Estado de selección de horarios: IDs seleccionados, cantidad requerida vs actual, flag isComplete |
| `PromotionOption`, `PromotionGroup` | `enrollment-assignment.model.ts` | Promociones abiertas/finalizadas para cursos profesionales: código, inscritos/capacidad, agrupadas por status |
| `SingularFeature` | `enrollment-assignment.model.ts` | Características incluidas/excluidas del curso singular (informativo) |
| `EnrollmentDocumentsData` | `enrollment-documents.model.ts` | Paso 3 del Wizard: modelo compuesto con vista condicional (class-b / professional), foto carnet, documentos profesionales, autorización notarial para menores |
| `CarnetPhoto` | `enrollment-documents.model.ts` | Foto para carnet: fuente (camera/upload), dataUrl y nombre de archivo |
| `UploadedDocument` | `enrollment-documents.model.ts` | Documento subido: tipo, File, nombre y fecha de emisión opcional |
| `HvcValidation` | `enrollment-documents.model.ts` | Validación de Hoja de Vida del Conductor: expiración >30 días (RF-082.3) |
| `DocumentRequirement` | `enrollment-documents.model.ts` | Config de un documento requerido: tipo, label, hint, obligatoriedad, formatos, tamaño máx. Constante: `PROFESSIONAL_DOCUMENTS` |
| `EnrollmentPaymentData` | `enrollment-payment.model.ts` | Paso 4 del Wizard: modelo compuesto con pricing breakdown (precio base, depósito/completo según paso 2), descuento opcional (monto + motivo), total a pagar, método de pago seleccionado, alerta de curso singular |
| `PricingBreakdown` | `enrollment-payment.model.ts` | Desglose de precio: label del curso, clases prácticas incluidas, precio base, flag isDeposit (mitad o completo según paso 2), monto a pagar ahora |
| `DiscountData` | `enrollment-payment.model.ts` | Datos del descuento: habilitado, monto CLP, motivo (queda en log de auditoría) |
| `PaymentMethodOption` | `enrollment-payment.model.ts` | Opción de método de pago: efectivo, transferencia, tarjeta, pendiente. Constante: `PAYMENT_METHODS` con iconos Lucide |
| `SingularPaymentAlert` | `enrollment-payment.model.ts` | Alerta informativa para cursos singulares que requieren pago total obligatorio |
| `EnrollmentContractData` | `enrollment-contract.model.ts` | Paso 5 del Wizard: modelo compuesto con generación de contrato PDF, upload del contrato firmado digitalizado, flag canAdvance |
| `ContractGeneration` | `enrollment-contract.model.ts` | Estado de generación del borrador PDF: status (pending / generating / generated / error), URL del PDF, timestamp |
| `SignedContractUpload` | `enrollment-contract.model.ts` | Estado del upload del contrato firmado: status (empty / uploading / uploaded / error), File, nombre, tamaño. Constantes: `CONTRACT_ACCEPTED_FORMATS`, `CONTRACT_MAX_SIZE_MB` |
| `EnrollmentConfirmationData` | `enrollment-confirmation.model.ts` | Paso 6 del Wizard: modelo compuesto con número de matrícula generado, resumen del alumno (nombre, RUT, email, teléfono), resumen del curso (label, método de pago, fecha, descuento, total), próximos pasos con variante (regular / singular), alerta de documentos pendientes |
| `EnrollmentStudentSummary` | `enrollment-confirmation.model.ts` | Resumen del alumno para la confirmación: nombre completo, RUT, email, teléfono |
| `EnrollmentCourseSummary` | `enrollment-confirmation.model.ts` | Resumen del curso para la confirmación: label, método de pago, fecha matrícula, descuento aplicado, total pagado |
| `NextStep` | `enrollment-confirmation.model.ts` | Paso siguiente post-matrícula: texto descriptivo y segmentos a resaltar en bold |
| `PendingDocumentsAlert` | `enrollment-confirmation.model.ts` | Alerta de documentos opcionales pendientes: visibilidad y mensaje (ej: certificado médico psicosensométrico) |

> **Nota para los Agentes**: Al crear una interfaz nueva que defina la estructura de una tabla, ponla en `dto/`. Si es un formato de datos para que un componente se dibuje, ponla en `ui/`. Actualiza esta tabla al agregar un modelo.

## Auto-Index — Modelos detectados por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Interfaces | Categoría | Archivo |
|-----------|----------|---------|
| `AbsenceEvidence` | `dto` | `src/app/core/models/dto/absence-evidence.model.ts` |
| `AlertConfig` | `dto` | `src/app/core/models/dto/alert-config.model.ts` |
| `AuditLog` | `dto` | `src/app/core/models/dto/audit-log.model.ts` |
| `BiometricRecord` | `dto` | `src/app/core/models/dto/biometric-record.model.ts` |
| `Branch` | `dto` | `src/app/core/models/dto/branch.model.ts` |
| `CashClosing` | `dto` | `src/app/core/models/dto/cash-closing.model.ts` |
| `CertificateBatch` | `dto` | `src/app/core/models/dto/certificate-batch.model.ts` |
| `CertificateIssuanceLog` | `dto` | `src/app/core/models/dto/certificate-issuance-log.model.ts` |
| `Certificate` | `dto` | `src/app/core/models/dto/certificate.model.ts` |
| `ClassBExamAttempt` | `dto` | `src/app/core/models/dto/class-b-exam-attempt.model.ts` |
| `ClassBExamCatalog` | `dto` | `src/app/core/models/dto/class-b-exam-catalog.model.ts` |
| `ClassBExamQuestion` | `dto` | `src/app/core/models/dto/class-b-exam-question.model.ts` |
| `ClassBExamScore` | `dto` | `src/app/core/models/dto/class-b-exam-score.model.ts` |
| `ClassBPracticeAttendance` | `dto` | `src/app/core/models/dto/class-b-practice-attendance.model.ts` |
| `ClassBSession` | `dto` | `src/app/core/models/dto/class-b-session.model.ts` |
| `ClassBTheoryAttendance` | `dto` | `src/app/core/models/dto/class-b-theory-attendance.model.ts` |
| `ClassBTheorySession` | `dto` | `src/app/core/models/dto/class-b-theory-session.model.ts` |
| `ClassBook` | `dto` | `src/app/core/models/dto/class-book.model.ts` |
| `Course` | `dto` | `src/app/core/models/dto/course.model.ts` |
| `DigitalContract` | `dto` | `src/app/core/models/dto/digital-contract.model.ts` |
| `DisciplinaryNote` | `dto` | `src/app/core/models/dto/disciplinary-note.model.ts` |
| `DiscountApplication` | `dto` | `src/app/core/models/dto/discount-application.model.ts` |
| `Discount` | `dto` | `src/app/core/models/dto/discount.model.ts` |
| `DocumentTemplate` | `dto` | `src/app/core/models/dto/document-template.model.ts` |
| `Enrollment` | `dto` | `src/app/core/models/dto/enrollment.model.ts` |
| `Expense` | `dto` | `src/app/core/models/dto/expense.model.ts` |
| `InstructorAdvance` | `dto` | `src/app/core/models/dto/instructor-advance.model.ts` |
| `InstructorMonthlyHour` | `dto` | `src/app/core/models/dto/instructor-monthly-hour.model.ts` |
| `InstructorMonthlyPayment` | `dto` | `src/app/core/models/dto/instructor-monthly-payment.model.ts` |
| `InstructorReplacement` | `dto` | `src/app/core/models/dto/instructor-replacement.model.ts` |
| `Instructor` | `dto` | `src/app/core/models/dto/instructor.model.ts` |
| `LecturerMonthlyHour` | `dto` | `src/app/core/models/dto/lecturer-monthly-hour.model.ts` |
| `Lecturer` | `dto` | `src/app/core/models/dto/lecturer.model.ts` |
| `LicenseValidation` | `dto` | `src/app/core/models/dto/license-validation.model.ts` |
| `LoginAttempt` | `dto` | `src/app/core/models/dto/login-attempt.model.ts` |
| `MaintenanceRecord` | `dto` | `src/app/core/models/dto/maintenance-record.model.ts` |
| `NotificationTemplate` | `dto` | `src/app/core/models/dto/notification-template.model.ts` |
| `Notification` | `dto` | `src/app/core/models/dto/notification.model.ts` |
| `PaymentAttemptStatus`, `PaymentAttempt` | `dto` | `src/app/core/models/dto/payment-attempt.model.ts` |
| `PaymentDenomination` | `dto` | `src/app/core/models/dto/payment-denomination.model.ts` |
| `Payment` | `dto` | `src/app/core/models/dto/payment.model.ts` |
| `PricingSeason` | `dto` | `src/app/core/models/dto/pricing-season.model.ts` |
| `ProfessionalFinalRecord` | `dto` | `src/app/core/models/dto/professional-final-record.model.ts` |
| `ProfessionalModuleGrade` | `dto` | `src/app/core/models/dto/professional-module-grade.model.ts` |
| `ProfessionalPracticeAttendance` | `dto` | `src/app/core/models/dto/professional-practice-attendance.model.ts` |
| `ProfessionalPracticeSession` | `dto` | `src/app/core/models/dto/professional-practice-session.model.ts` |
| `PsychTestStatus`, `PsychTestResult`, `PreRegistrationStatus`, `RegistrationChannel`, `ProfessionalPreRegistration` | `dto` | `src/app/core/models/dto/professional-pre-registration.model.ts` |
| `ProfessionalPromotion` | `dto` | `src/app/core/models/dto/professional-promotion.model.ts` |
| `ProfessionalScheduleTemplate` | `dto` | `src/app/core/models/dto/professional-schedule-template.model.ts` |
| `ProfessionalTheoryAttendance` | `dto` | `src/app/core/models/dto/professional-theory-attendance.model.ts` |
| `ProfessionalTheorySession` | `dto` | `src/app/core/models/dto/professional-theory-session.model.ts` |
| `PromotionCourseLecturer` | `dto` | `src/app/core/models/dto/promotion-course-lecturer.model.ts` |
| `PromotionCourse` | `dto` | `src/app/core/models/dto/promotion-course.model.ts` |
| `Role` | `dto` | `src/app/core/models/dto/role.model.ts` |
| `RouteIncident` | `dto` | `src/app/core/models/dto/route-incident.model.ts` |
| `SchoolDocument` | `dto` | `src/app/core/models/dto/school-document.model.ts` |
| `SchoolSchedule` | `dto` | `src/app/core/models/dto/school-schedule.model.ts` |
| `SecretaryObservation` | `dto` | `src/app/core/models/dto/secretary-observation.model.ts` |
| `SenceCode` | `dto` | `src/app/core/models/dto/sence-code.model.ts` |
| `ServiceCatalog` | `dto` | `src/app/core/models/dto/service-catalog.model.ts` |
| `SessionMachinery` | `dto` | `src/app/core/models/dto/session-machinery.model.ts` |
| `SiiReceipt` | `dto` | `src/app/core/models/dto/sii-receipt.model.ts` |
| `SlotHold` | `dto` | `src/app/core/models/dto/slot-hold.model.ts` |
| `SpecialServiceSale` | `dto` | `src/app/core/models/dto/special-service-sale.model.ts` |
| `StandaloneCourseEnrollment` | `dto` | `src/app/core/models/dto/standalone-course-enrollment.model.ts` |
| `StandaloneCourse` | `dto` | `src/app/core/models/dto/standalone-course.model.ts` |
| `StudentDocument` | `dto` | `src/app/core/models/dto/student-document.model.ts` |
| `Student` | `dto` | `src/app/core/models/dto/student.model.ts` |
| `TemplateBlock` | `dto` | `src/app/core/models/dto/template-block.model.ts` |
| `User` | `dto` | `src/app/core/models/dto/user.model.ts` |
| `VehicleAssignment` | `dto` | `src/app/core/models/dto/vehicle-assignment.model.ts` |
| `VehicleDocument` | `dto` | `src/app/core/models/dto/vehicle-document.model.ts` |
| `Vehicle` | `dto` | `src/app/core/models/dto/vehicle.model.ts` |
| `AgendaWeekKpis`, `AgendaSlotStatus`, `AgendaSlot`, `AgendaDayColumn`, `AgendaWeekData`, `AgendableStudent`, `AgendaInstructorFilter` | `ui` | `src/app/core/models/ui/agenda.model.ts` |
| `AlumnoDetalleUI`, `PagoUI`, `InasistenciaUI`, `ClasePracticaUI`, `ProgresoUI` | `ui` | `src/app/core/models/ui/alumno-detalle.model.ts` |
| `AlumnoStatus`, `AlumnoExpediente`, `AlumnoTableRow` | `ui` | `src/app/core/models/ui/alumno-table-row.model.ts` |
| `AuditAction`, `AuditLogRow` | `ui` | `src/app/core/models/ui/audit-log-row.model.ts` |
| `BranchOption`, `BranchCoursePrice` | `ui` | `src/app/core/models/ui/branch.model.ts` |
| `IngresoRow`, `EgresoRow`, `EgresoFormData`, `CierrePayload` | `ui` | `src/app/core/models/ui/cuadratura.model.ts` |
| `DashboardModel`, `HeroModel`, `KpiModel`, `ActivityModel`, `AlertModel`, `QuickActionModel`, `SystemStatusModel` | `ui` | `src/app/core/models/ui/dashboard.model.ts` |
| `DmsTab`, `TemplateCategory`, `TemplateCategoryFilter`, `StudentWithDocsRow`, `DmsStudentDocRow`, `SchoolDocRow`, `TemplateCard`, `DmsKpis`, `UploadStudentDocPayload`, `UploadSchoolDocPayload`, `UploadTemplatePayload`, `DmsViewerDocument` | `ui` | `src/app/core/models/ui/dms.model.ts` |
| `EgresadoTableRow` | `ui` | `src/app/core/models/ui/egresado-table.model.ts` |
| `StudentSummaryBanner`, `PaymentMode`, `PaymentModeOption`, `InstructorOption`, `SlotStatus`, `TimeSlot`, `WeekDay`, `WeekRange`, `ScheduleGrid`, `SlotSelection`, `PromotionStatus`, `PromotionOption`, `PromotionGroup`, `SingularFeature`, `AssignmentView`, `EnrollmentAssignmentData` | `ui` | `src/app/core/models/ui/enrollment-assignment.model.ts` |
| `EnrollmentStudentSummary`, `EnrollmentCourseSummary`, `NextStep`, `NextStepsVariant`, `PendingDocumentsAlert`, `EnrollmentConfirmationData` | `ui` | `src/app/core/models/ui/enrollment-confirmation.model.ts` |
| `ContractStatus`, `ContractGeneration`, `UploadStatus`, `SignedContractUpload`, `EnrollmentContractData` | `ui` | `src/app/core/models/ui/enrollment-contract.model.ts` |
| `PhotoSource`, `PhotoTab`, `CameraState`, `CarnetPhoto`, `DocumentType`, `UploadedDocument`, `HvcValidation`, `DocumentRequirement`, `DocumentsView`, `EnrollmentDocumentsData` | `ui` | `src/app/core/models/ui/enrollment-documents.model.ts` |
| `PaymentMethod`, `PaymentMethodOption`, `PricingBreakdown`, `DiscountData`, `AvailableDiscount`, `SingularPaymentAlert`, `EnrollmentPaymentData` | `ui` | `src/app/core/models/ui/enrollment-payment.model.ts` |
| `Gender`, `CourseCategory`, `CourseType`, `SingularCourseCode`, `CurrentLicenseType`, `ValidationBook`, `AgeAlertStatus`, `SingularCourseOption`, `CourseOption`, `SenceCodeOption`, `HistoricalPromotion`, `EnrollmentPersonalData`, `AgeValidation`, `LicenseValidation` | `ui` | `src/app/core/models/ui/enrollment-personal-data.model.ts` |
| `EnrollmentWizardStep`, `StepStatus`, `StepConfig`, `CourseSummary`, `Requirement`, `SidebarSummary`, `EnrollmentWizardState`, `DraftSummary` | `ui` | `src/app/core/models/ui/enrollment-wizard.model.ts` |
| `HistorialCierre`, `HistorialFiltro` | `ui` | `src/app/core/models/ui/historial-cuadraturas.model.ts` |
| `InstructorDashboardData`, `InstructorDashboardKpis`, `InstructorClassRow`, `InstructorStudentCard`, `InstructorStudentDetail`, `FichaTecnicaRow`, `EvaluationFormData`, `EvaluationChecklistItem`, `ScheduleBlock`, `WeekScheduleKpis`, `ScheduleDay`, `DaySchedule`, `WeekSchedule`, `MonthlyHoursRow`, `LiquidacionKpis`, `SessionDetailRow`, `ExamScoreRow`, `RegisterExamPayload`, `AttendanceClassRow`, `UpcomingDay` | `ui` | `src/app/core/models/ui/instructor-portal.model.ts` |
| `InstructorType`, `LicenseStatus`, `InstructorTableRow`, `VehicleOption`, `VehicleAssignmentHistory` | `ui` | `src/app/core/models/ui/instructor-table.model.ts` |
| `LiquidacionRow`, `LiquidacionesKpis`, `PagoInstructorPayload` | `ui` | `src/app/core/models/ui/liquidaciones.model.ts` |
| `NotificationType`, `NotificationFilter`, `NotificationReferenceType`, `Notification` | `ui` | `src/app/core/models/ui/notification.model.ts` |
| `RentabilidadCurso`, `AlumnoDeudor`, `PagoReciente`, `MetodoPago`, `EstadoCuentaResumen`, `EstadoCuentaHistorialItem` | `ui` | `src/app/core/models/ui/pagos.model.ts` |
| `PromocionCursoRow`, `PromocionCursoRelator`, `PromocionTableRow`, `PromocionStatus`, `RelatorOption`, `CrearPromocionCursoPayload`, `CrearPromocionPayload`, `PromocionAlumno`, `EditarPromocionPayload` | `ui` | `src/app/core/models/ui/promocion-table.model.ts` |
| `RelatorCursoAsignado`, `RelatorTableRow` | `ui` | `src/app/core/models/ui/relator-table.model.ts` |
| `SecretariaTableRow` | `ui` | `src/app/core/models/ui/secretaria-table.model.ts` |
| `SectionHeroChip`, `SectionHeroAction` | `ui` | `src/app/core/models/ui/section-hero.model.ts` |
| `SesionTipo`, `SesionStatus`, `AsistenciaStatus`, `SesionProfesional`, `SesionAlumnoAsistencia`, `PromocionOption`, `CursoOption`, `ResumenAlumnoAsistencia`, `WeekDay` | `ui` | `src/app/core/models/ui/sesion-profesional.model.ts` |
| `LicenseGroup`, `CertificateState`, `AttendanceSemaphore`, `StudentHomeHero`, `StudentHomeProgress`, `StudentHomeAttendance`, `StudentHomeGrades`, `StudentHomeCertificate`, `StudentHomeSideWidgets`, `StudentHomeSnapshot` | `ui` | `src/app/core/models/ui/student-home.model.ts` |
| `UserRole`, `User` | `ui` | `src/app/core/models/ui/user.model.ts` |
| `MaintenanceRow`, `MaintenanceKpis`, `ScheduledMaintenance`, `VehicleAgendaSlot` | `ui` | `src/app/core/models/ui/vehicle-detail.model.ts` |
| `VehicleType`, `VehicleStatus`, `DocStatus`, `VehicleDocSummary`, `VehicleTableRow`, `FlotaKpis` | `ui` | `src/app/core/models/ui/vehicle-table.model.ts` |

<!-- AUTO-GENERATED:END -->
