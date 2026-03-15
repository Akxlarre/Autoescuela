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
