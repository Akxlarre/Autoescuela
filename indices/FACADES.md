# Índice de Facades (Facades Index)

Este índice mantiene el registro de todas las Fachadas (Facades) del sistema.
Los Facades son el **único punto de entrada** permitido para que la UI interactúe con el dominio (base de datos) y su estado global.

## 📁 Facades Activos (`core/facades/`)

| Facade | Archivo | Responsabilidad (Dominio) |
|---|---|---|
| `AuthFacade` | `core/facades/auth.facade.ts` | Maneja el estado de la sesión del usuario actual, login, logout y persistencia con Supabase Auth. |
| `DashboardFacade` | `core/facades/dashboard.facade.ts` | Orquesta la carga de las métricas principales (KPIs), actividad reciente y alertas para la pantalla de inicio. |
| `EnrollmentFacade` | `core/facades/enrollment.facade.ts` | Orquestador principal del wizard de matrícula (6 pasos). Draft progresivo con expiración 24h. Maneja: upsert user+student (Step 1), instructores/slots/promociones (Step 2), generación y upload de contrato (Step 5), confirmación con número secuencial (Step 6). 15 signals privados, computed `canAdvance`, `studentSummary`, `sidebarSummary`. |
| `EnrollmentDocumentsFacade` | `core/facades/enrollment-documents.facade.ts` | Step 3 del wizard de matrícula: documentos y storage. Upload foto carnet (cámara/archivo), documentos profesionales (HVC, cédula, licencia), autorización notarial para menores. Validación antigüedad HVC (RF-082.3, max 30 días). Persistencia en Supabase Storage bucket `documents` + tabla `student_documents`. Computed `uploadedCount`, `allRequiredUploaded()`. Carga docs existentes para re-edición de drafts. |
| `EnrollmentPaymentFacade` | `core/facades/enrollment-payment.facade.ts` | Step 4 del wizard de matrícula: pagos y descuentos. `computePricing()` calcula desglose (base price, deposit 50%, amount due). `loadAvailableDiscounts()` carga descuentos activos desde tabla `discounts`. `applyPredefinedDiscount()` calcula monto (porcentaje o fijo). `recordPayment()` inserta en `payments`, registra en `discount_applications` si aplica, actualiza `enrollments` (payment_status, total_paid, pending_balance, discount). Computed `totalToPay`, `canConfirmPayment`. |
| `AdminAlumnosFacade` | `core/facades/admin-alumnos.facade.ts` | Base de Alumnos. `loadAlumnos()` — query `students!inner(users, enrollments(courses, student_documents))`. Mapea a `AlumnoTableRow` derivando `status` (active/draft/withdrawn/completed + payment_status + docs_complete), `expediente` (ci/foto/medico/semep por tipos en student_documents), `vencimiento` (días hasta expires_at). Computed: `totalAlumnos`, `activos`, `conDeuda`, `alumnosPorVencer` (threshold 7 días). Usado por `AdminAlumnosComponent` y `SecretariaAlumnosComponent`. |

> **Nota para los Agentes**:
> - NO inyectes repositorios o `SupabaseService` en la UI. Inyecta el Facade correspondiente.
> - Si creas un Facade nuevo, DEBES registrarlo en esta tabla.
> - Todo archivo aquí debe terminar en `.facade.ts`.
