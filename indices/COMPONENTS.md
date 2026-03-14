# Registro de Componentes (Atomic Design)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de sistema (escritura de archivos) para agregar los nuevos componentes a estas tablas. Solo si el entorno no los soporta, usa el bloque `<memory_update>` para que el humano lo copie.

## Átomos (Atoms)
*Elementos UI básicos e indivisibles (botones, inputs, badges).*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `skeleton-block` | Loading | `variant` (`rect`, `circle`, `text`), `width`, `height` | `shared/components/skeleton-block/skeleton-block.component.ts` | ✅ Estable |
| `app-icon` | Ícono (Lucide) | `name` (requerido, kebab-case), `size` (default 16), `color` (default currentColor), `ariaHidden` (default true) | `shared/components/icon/icon.component.ts` | ✅ Estable |
| `app-email-input` | Input de email con validación | `value` (string, req), `id` (string, 'email'), `label` (string, 'Email'), `required` (boolean, false), `placeholder` (string). Output: `valueChange` (string). Muestra feedback en tiempo real: borde rojo + mensaje de error si el email es inválido, borde verde + confirmación si es válido. Usa `validateEmail()` de `core/utils/email.utils.ts`. | `shared/components/email-input/email-input.component.ts` | ✅ Estable |
| `app-async-btn` | Botón con loading state | `label` (string, req), `icon` (string\|null, kebab-case Lucide), `loading` (boolean, false), `disabled` (boolean, false), `loadingLabel` (string, 'Procesando...'). Muestra spinner `loader` giratorio + `loadingLabel` cuando `loading=true`. Cursor pointer activo, `cursor-not-allowed` + `opacity-50` en estado disabled/loading. Usar `(click)` nativo del host. | `shared/components/async-btn/async-btn.component.ts` | ✅ Estable |

## Moléculas (Molecules)
*Agrupación de átomos que forman una unidad funcional simple (search bar, card preview).*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-kpi-card` | KPI / Métrica | `value` (number, req), `label` (string, req), `suffix` (''), `prefix` (''), `trend` (number|undefined), `trendLabel` (''), `accent` (false), `icon` (string|undefined), `size` ('lg'|'md'|'sm', default 'lg'), `color` ('default'|'success'|'warning'|'error', default 'default') | `shared/components/kpi-card/kpi-card.component.ts` | ✅ Estable |
| `app-kpi-card-variant` | KPI / Métrica con Carga | Igual a `app-kpi-card` pero recibe un input `loading` (boolean signal) para renderizar su propio skeleton usando Single-Component Skeleton pattern sin CLS. | `shared/components/kpi-card/kpi-card-variant.component.ts` | ✅ Estable |
| `app-action-kpi-card` | KPI / Métrica Interactiva | Variante de KPI con soporte para interacción (hover GSAP, cursor pointer), colores semánticos, pulso opcional en ícono y slot para footer. **Alineado con Dashboard:** `bento-card`, `[loading]` con skeleton integrado (mismo layout que kpi-card-variant). | `shared/components/kpi-card/action-kpi-card.component.ts` | ✅ Estable |

## Moléculas — Feedback
*Comunicación de estados del sistema al usuario.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-empty-state` | Estado vacío | `message` (string, req), `subtitle` (string), `icon` (Lucide kebab-case), `actionLabel` (string), `actionIcon` (default 'plus'), `(action)` output | `shared/components/empty-state/empty-state.component.ts` | ✅ Estable |
| `app-alert-card` | Alerta / Feedback | `title` (string, req), `severity` ('error'|'warning'|'info'|'success', default 'info'), `actionLabel` (string), `dismissible` (boolean), `(action)` output, `(dismissed)` output. Body via `ng-content`. | `shared/components/alert-card/alert-card.component.ts` | ✅ Estable |

## Moléculas — Shell / Topbar
*Dropdowns y paneles del shell de la aplicación.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-notifications-panel` | Dropdown / Panel | `notifications` (Notification[], req), `unreadCount` (number, 0) — outputs: `markRead` (string), `markAllRead` (void). Dumb: sin servicios. Entrada animada con `[appAnimateIn]` desde TopbarComponent. | `shared/components/notifications-panel/notifications-panel.component.ts` | ✅ Estable |
| `app-search-panel` | Dropdown / Buscador global | Sin inputs. outputs: `queryChange` (string), `closed` (void). Dumb: query es estado local (`signal`). Autofocus al montar. Escape emite `closed`. Entrada animada con `[appAnimateIn]`. | `shared/components/search-panel/search-panel.component.ts` | ✅ Estable |
| `app-user-panel` | Dropdown / Panel | `user` (User, req) — outputs: `action` (string), `logout` (void). Dumb: sin servicios. Menú desplegable para opciones de usuario desde TopbarComponent animado con `[appAnimateIn]`. | `shared/components/user-panel/user-panel.component.ts` | ✅ Estable |

## Organismos (Organisms)
*Secciones complejas y autónomas compuestas por moléculas y átomos.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-agenda-semanal` | Organismo / Agenda (Dumb) | `weekData` (`AgendaWeekData\|null`), `filteredDays` (`AgendaDayColumn[]`), `timeRows` (`string[]`), `isLoading` (boolean), `isCurrentWeek` (boolean), `instructors` (`AgendaInstructorFilter[]`), `selectedInstructorId` (`number\|null`) — outputs: `weekNext`, `weekPrev`, `weekToday`, `instructorFilterChange` (number\|null), `slotClick` (AgendaSlot). Hero con semana, 4 KPI cards, toolbar nav + filtro instructor, CSS grid de calendario Lun-Vie, leyenda. **Master View (todos):** celdas condensadas con dots de color por estado + texto resumen ("X disp · Y ocup"), click expande inline con `appAnimateIn`. **Filtered View (1 instructor):** slots compactos sin nombre redundante. GSAP: `animateSkeletonToContent` (effect), `animateHero`, `appCardHover`. Mobile: day tabs + scroll horizontal. | `shared/components/agenda-semanal/agenda-semanal.component.ts` | ✅ Estable |
| `app-agenda-slot` | Átomo / Agenda (Dumb) | `slot` (`AgendaSlot`, req), `compact` (boolean, false) — output: `slotClicked` (AgendaSlot). Renderiza un bloque individual del calendario: available (dashed, clickeable), scheduled/in_progress (brand), completed (success), cancelled/no_show (muted). **Compact mode:** oculta nombre instructor en available, reduce padding/min-height, opacity 0.65 con hover→1. | `shared/components/agenda-semanal/agenda-slot.component.ts` | ✅ Estable |
| `app-agenda-schedule-drawer` | Smart / Agenda Drawer | Cargado via `NgComponentOutlet` en LayoutDrawer. Inyecta `AgendaFacade`. Muestra slot seleccionado (readonly), selector p-select de alumnos con cupo (filterable), detalle del alumno seleccionado, botón confirmar + cancel. `ngOnInit` dispara `loadAgendableStudents()`. | `features/agenda/agenda-schedule-drawer.component.ts` | ✅ Estable |
| `app-drawer` | Overlay / Drawer | `isOpen` (boolean signal, req), `title` (string, req), `icon` (string), `hasFooter` (boolean) — outputs: `closed`. Dumb: animaciones con GSAP, content project. | `shared/components/drawer/drawer.component.ts` | ✅ Estable |
| `app-section-hero` | Organismo / Hero | `title` (req), `contextLine`, `subtitle`, `chips`, `actions` (req). Output `actionClick`. Cabecera de sección reutilizable (Dashboard, Alumnos). Ver `docs/SECTION-HERO-PATTERN.md`. | `shared/components/section-hero/section-hero.component.ts` | ✅ Estable |
| `app-alumnos-list-content` | Organismo / Tabla (Dumb) | `basePath` (string, req), `alumnos` (`AlumnoTableRow[]`, []), `isLoading` (boolean, false), `alumnosPorVencer` (`AlumnoTableRow[]`, []) — Lista de alumnos con `app-section-hero`, bento KPIs (`app-kpi-card-variant` x3 + `app-action-kpi-card` "Por Vencer"), búsqueda, filtros de curso/estado/expediente (RF-085), tabla PrimeNG con paginación, exportar ficha (RF-086). Drawer "Por Vencer". La data real la pasa el padre smart (`AdminAlumnosComponent` / `SecretariaAlumnosComponent`) vía `AdminAlumnosFacade`. | `shared/components/alumnos-list-content/alumnos-list-content.component.ts` | ✅ Estable |
| `app-personal-data-step` | Organismo / Matricula | `data` (input req): `EnrollmentPersonalData` — incluye `courses: CourseOption[]`. **2-level selector:** `selectedCategory = signal<CourseCategory\|null>()` + `effect()` para sincronizar en re-edición; `availableCategories` muestra siempre las 3 categorías (non-professional/professional/singular); `filteredCourses computed` filtra `data().courses` por categoría activa. `canAdvance` requiere curso dentro de `filteredCourses`. Computed: `courseMeta`, `coursePriceLabel`, `rutValid`, `ageStatus`. | `shared/components/matricula-steps/personal-data/personal-data.component.ts` | ✅ Estable |
| `app-assignment-step` | Organismo / Matricula | `data` (input req): `EnrollmentAssignmentData` — incluye `instructors[]`, `scheduleGrid`, `scheduleLoading`, `promotionGroups: PromotionGroup[]`, `totalSessions` (12 para Clase B). **Clase B:** selector instructor + semana + slots. Navegación de semanas: `currentWeekIndex`, `weeks` (agrupa `daysFromGrid()` por lunes vía `getMondayKey()`), `prevWeek/nextWeek`. Counter `X/N` = `requiredCount` (12 full, 6 deposit). **Restricción:** máx 1 clase por día. Descripciones de modalidad de pago dinámicas (`totalSessions` / `totalSessions/2`). **Profesional:** itera `promotionGroups[]` → `@for (group)` → `@for (option)` — vacío muestra estado empty; opción `status=finished` deshabilitada. **Singular:** panel informativo. | `shared/components/matricula-steps/assignment/assignment.component.ts` | ✅ Estable |
| `app-documents-step` | Organismo / Matricula | `data` (input signal req) — Paso 3. Outputs: `fileSelected` (`{ type: string; file: File }`), `next`, `back`. Sin `dataChange` — subida delegada al Smart padre vía `fileSelected`. Detecta cargas con `isUploaded(type)` interno. | `shared/components/matricula-steps/documents/documents.component.ts` | ✅ Estable |
| `app-payment-step` | Organismo / Matricula | `data` (input req): `EnrollmentPaymentData` — Paso 4. **Descuentos predefinidos:** `@for (disc of data().availableDiscounts)` → chips toggleables via `selectPredefinedDiscount(id)` (toggle: si ya seleccionado → null). **Descuento manual:** `discountAmountInput`/`discountReason` signals locales → `applyManualDiscount()` limpia `selectedDiscountId`. **Método "pendiente"** deshabilitado cuando `data().isSingularCourse`. Botón continuar usa `data().canAdvance` (pricing + method). Outputs: `dataChange`, `next`, `back`. | `shared/components/matricula-steps/payment/payment.component.ts` | ✅ Estable |
| `app-contract-step` | Organismo / Matricula | `data` (input req): `EnrollmentContractData`. **Flujo físico:** 1) Generar PDF (Edge Fn), 2) Imprimir+firmar físicamente, 3) Subir escaneado. Indicador de 3 pasos visual. `onFileSelected()` valida tipo/tamaño. `clearUpload()` resetea. `canAdvance` = `!!signedContract.file`. Outputs: `dataChange`, `generateContract`, `next`, `back`. Sin `FormsModule` — no hay firma electrónica en UI. | `shared/components/matricula-steps/contract/contract.component.ts` | ✅ Estable |
| `app-confirmation-step` | Organismo / Matricula | `data` (input signal) — Paso 6 del wizard de matrícula. | `shared/components/matricula-steps/confirmation/confirmation.component.ts` | ✅ Refactored (Signals/Control Flow) |
| `app-draft-list` | Organismo / Matricula | `drafts` (input req): `DraftSummary[]` — Lista de borradores con mini-stepper (paso activo en `bg-brand`, completados en `bg-brand-muted`), botones `Retomar` (`btn-primary`) y `Descartar` (hover danger). CTA `+ Nueva matrícula` prominente abajo (ancho completo, borde dashed). Outputs: `resume` (enrollmentId), `discard` (enrollmentId — el padre maneja confirmación vía `ConfirmModalService`), `startNew` (void). | `shared/components/matricula-steps/draft-list/draft-list.component.ts` | ✅ Estable |

## Layout (Shell)
*Componentes estructurales del shell de la aplicación — no son páginas enrutables.*

| Componente | Tipo | Propósito | Ubicación | Estado |
|------------|------|-----------|-----------|--------|
| `AppShellComponent` | Smart | Layout principal: sidebar + topbar + router-outlet; drawer animado en mobile. Renderiza el modal global de `ConfirmModalService` (z-70, `surface-glass`). Sin View Transitions ni animatePageEnter (evitar race conditions). | `layout/app-shell.component.ts` | ✅ Estable |
| `SidebarComponent` | Smart | Sidebar de navegación con grupos (`NavGroup[]`): headers de sección + pills GSAP, theme toggle y avatar de usuario | `layout/sidebar.component.ts` | ✅ Estable |
| `TopbarComponent` | Smart | Barra superior: selector DEV de rol (ROL dropdown), búsqueda global (Ctrl+K), cambio de tema, badge notificaciones (`animateBell`), avatar de usuario | `layout/topbar.component.ts` | ✅ Estable |
| `LayoutDrawerComponent` | Smart (Adaptativo) | Panel lateral dinámico. **Desktop (≥768px):** layout-shift (empuja el contenido). **Mobile (<768px):** fullscreen fixed + backdrop GSAP + scroll lock. Renderiza componentes via `NgComponentOutlet`. Controlado por `LayoutDrawerService` (usa `LayoutDrawerFacadeService` desde UI). | `layout/layout-drawer.component.ts` | ✅ Estable |

## Moléculas — Auth
*Formularios y flujos de autenticación.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-login-card` | Auth / Form | `mode` ('login'|'reset'), `loading` (false), `errorMsg` (''), `successMsg` ('') — outputs: `modeChange`, `formSubmit` (LoginFormData). Sin `@if` para layout: contraseña y mensajes siempre en DOM, GSAP anima `height`+`opacity` vía `effect()` + `viewChild`. `LoginFormData`: `{ email, password }`. | `shared/components/login-card/login-card.component.ts` | ✅ Estable |

## Páginas / Vistas (Pages)
*Componentes enrutables (Smart components) que consumen Servicios.*

| Ruta / Componente | Propósito | Servicios Inyectados | Ubicación | Estado |
|-------------------|-----------|-----------------------|-----------|--------|
| `/app/admin/dashboard` — `DashboardComponent` | Dashboard principal (referencia canónica del DS). Usa `app-section-hero` (bento-hero), `app-kpi-card-variant` x4, actividad reciente y alertas. Hero con acciones rápidas (abre wizard matrícula vía `LayoutDrawerFacadeService`). | `DashboardFacade`, `LayoutDrawerFacadeService` | `features/dashboard/dashboard.component.ts` | ✅ Estable |
| `/login` — `LoginComponent` | Login y reset de contraseña. Orbs decorativos + `surface-glass` card. Entrada con `GsapAnimationsService.animateHero()`. Botón dev `isDevMode()`. | `AuthFacade`, `GsapAnimationsService` | `features/auth/login/login.component.ts` | ✅ Estable |
| `/**` — `NotFoundComponent` | Página 404 | — | `features/not-found/not-found.component.ts` | ✅ Estable |
| **— PORTAL ADMIN (24 stubs) —** | | | | |
| `/app/admin/alumnos/ex-alumnos` — `AdminExAlumnosComponent` | **Gestión de Ex-Alumnos (Admin)** — Inyecta `ExAlumnosFacade`. Header con botones "Exportar" / "Activos". 4 KPIs (`app-kpi-card-variant`): total, Clase B, Profesional, con abono pendiente. Búsqueda por nombre/RUT/cert + 3 filtros (año, licencia, estado) con `computed()` client-side. Tabla custom HTML con 6 columnas: EGRESADO, LICENCIA (badge de color por tipo), AÑO, SEDE, N° CERT, ESTADO CUENTA (badge naranja "Debe CLP X" o verde "Al día"). Skeleton de 5 filas con `app-skeleton-block`. Sección inferior mockeada: barras de progreso (85% municipal, 92% psicotécnico) + Resumen Anual + panel de comentarios con avatares de iniciales y estrellas. | `ExAlumnosFacade` | `features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` | ✅ UI Ready |
| `/app/admin/alumnos` | **Base de Alumnos** — Implementación calco del mockup. Reutiliza `AlumnosListContentComponent`. | — | `features/admin/alumnos/admin-alumnos.component.ts` | ✅ UI Ready |
| `/app/admin/alumnos/:id` | **Ficha del Alumno** — Inyecta `AdminAlumnoDetalleFacade`. Lee `:id` de `ActivatedRoute` → `loadDetalle(id)` en `ngOnInit`. **3 estados:** skeleton, error card, vista principal. **Datos reales:** Info Personal, barras de progreso, Inasistencias (`facade.inasistencias()`), Ficha Técnica (`facade.clasesPracticas()` — 12 filas), Historial de Pagos (`facade.historialPagos()`; totales desde `alumno.totalPagado`/`alumno.saldoPendiente`). Botón "Editar" → `editDrawerOpen.set(true)`; botón "+ Registrar inasistencia" → `drawerOpen.set(true)`. Handlers `onInasistenciaGuardada()` y `onPerfilActualizado()` recargan `loadDetalle`. | `AdminAlumnoDetalleFacade` | `features/admin/alumno-detalle/admin-alumno-detalle.component.ts` | ✅ Estable |
| `AdminInasistenciaDrawerComponent` | Smart / Drawer — Registrar inasistencia | `isOpen` (boolean, req) — outputs: `closed`, `saved`. Inyecta `AdminAlumnoDetalleFacade` para leer `alumno().enrollmentId` y llamar `insertAbsenceEvidence()`. Formulario reactivo: `document_date` (date, req), `document_type` (select, req), `description` (textarea), file input simulado. Valida con `markAllAsTouched()`. Resetea y emite `saved`+`closed` al guardar con éxito. | `AdminAlumnoDetalleFacade` | `features/admin/alumno-detalle/inasistencia-drawer/admin-inasistencia-drawer.component.ts` | ✅ Estable |
| `AdminEditarPerfilDrawerComponent` | Smart / Drawer — Editar perfil del alumno | `isOpen` (boolean, req) — outputs: `closed`, `saved`. `effect()` hace `patchValue` desde `facade.alumno()` al abrir. Formulario: `first_names` (req), `paternal_last_name` (req), `maternal_last_name`, `email` (req + email validator), `phone`. Llama `facade.actualizarPerfilAlumno(userId, data)` → `.update()` en tabla `users`. Muestra banner éxito inline y auto-cierra tras 1.2s; emite `saved` para que el padre recargue la ficha. | `AdminAlumnoDetalleFacade` | `features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts` | ✅ Estable |
| `/app/admin/agenda` | **Agenda Semanal** — Smart wrapper de `app-agenda-semanal`. Inyecta `AgendaFacade` + `LayoutDrawerFacadeService`. `ngOnInit` llama `initialize()`. Abre `AgendaScheduleDrawerComponent` al clicar slot disponible. | `AgendaFacade`, `LayoutDrawerFacadeService` | `features/admin/agenda/admin-agenda.component.ts` | ✅ UI Ready |
| `/app/admin/asistencia` | Stub PLANO | — | `features/admin/asistencia/admin-asistencia.component.ts` | 🚧 Stub |
| `/app/admin/matricula` | **Wizard 6 Pasos (Nueva Matrícula)** — Thin wrapper que reutiliza `SecretariaMatriculaComponent`. Pasos: Datos Personales, Adscripción, Documentos, Pago/Descuentos, Contrato (RF-083), Confirmación. | — | `features/admin/matricula/admin-matricula.component.ts` | ✅ UI Ready |
| `/app/admin/pagos` | Stub PLANO | — | `features/admin/pagos/admin-pagos.component.ts` | 🚧 Stub |
| `/app/admin/contabilidad/reportes` | Stub PLANO | — | `features/admin/contabilidad-reportes/admin-contabilidad-reportes.component.ts` | 🚧 Stub |
| `/app/admin/contabilidad/cuadratura` | Stub PLANO | — | `features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.ts" | 🚧 Stub |
| `/app/admin/contabilidad/anticipos` | Stub PLANO | — | `features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts` | 🚧 Stub |
| `/app/admin/contabilidad/cursos` | Stub PLANO | — | `features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts` | 🚧 Stub |
| `/app/admin/flota` | Stub PLANO | — | `features/admin/flota/admin-flota.component.ts` | 🚧 Stub |
| `/app/admin/instructores` | Stub PLANO | — | `features/admin/instructores/admin-instructores.component.ts` | 🚧 Stub |
| `/app/admin/certificacion` | Stub PLANO | — | `features/admin/certificacion/admin-certificacion.component.ts` | 🚧 Stub |
| `/app/admin/documentos` | Stub PLANO | — | `features/admin/documentos/admin-documentos.component.ts` | 🚧 Stub |
| `/app/admin/usuarios` | Stub PLANO | — | `features/admin/usuarios/admin-usuarios.component.ts` | 🚧 Stub |
| `/app/admin/secretarias` | Stub PLANO | — | `features/admin/secretarias/admin-secretarias.component.ts` | 🚧 Stub |
| `/app/admin/tareas` | Stub PLANO | — | `features/admin/tareas/admin-tareas.component.ts` | 🚧 Stub |
| `/app/admin/libro-de-clases` | Stub PLANO | — | `features/admin/libro-de-clases/admin-libro-de-clases.component.ts` | 🚧 Stub |
| `/app/admin/psicotecnico` | Stub PLANO | — | `features/admin/psicotecnico/admin-psicotecnico.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/relatores` | Stub PLANO | — | `features/admin/profesional-relatores/admin-profesional-relatores.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/promociones` | Stub PLANO | — | `features/admin/profesional-promociones/admin-profesional-promociones.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/certificados` | Stub PLANO | — | `features/admin/profesional-certificados/admin-profesional-certificados.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/archivo` | Stub PLANO | — | `features/admin/profesional-archivo/admin-profesional-archivo.component.ts` | 🚧 Stub |
| `/app/admin/auditoria` | Stub PLANO | — | `features/admin/auditoria/admin-auditoria.component.ts` | 🚧 Stub |
| `/app/admin/notificaciones` | Stub PLANO | — | `features/admin/notificaciones/admin-notificaciones.component.ts` | 🚧 Stub |
| **— PORTAL SECRETARIA (23 stubs) —** | | | | |
| `/app/secretaria/dashboard` | Stub PLANO | — | `features/secretaria/dashboard/secretaria-dashboard.component.ts` | 🚧 Stub |
| `/app/secretaria/alumnos` | **Base de Alumnos** — Implementación calco del mockup. Reutiliza `AlumnosListContentComponent`. | — | `features/secretaria/alumnos/secretaria-alumnos.component.ts` | ✅ UI Ready |
| `/app/secretaria/agenda` | **Agenda Semanal** — Thin wrapper idéntico a admin-agenda. Reutiliza `app-agenda-semanal` + `AgendaFacade`. | `AgendaFacade`, `LayoutDrawerFacadeService` | `features/secretaria/agenda/secretaria-agenda.component.ts` | ✅ UI Ready |
| `/app/secretaria/asistencia` | Stub PLANO | — | `features/secretaria/asistencia/secretaria-asistencia.component.ts` | 🚧 Stub |
| `/app/secretaria/matricula` | **Wizard 6 Pasos (Nueva Matrícula)** — PrimeNG Stepper (`.stepper-premium`). Smart component orquesta 3 facades + AuthFacade. **Paso 4:** `effect()` llama `computePricing()` reactivo al `paymentMode`; `onStep3Next()` dispara `loadAvailableDiscounts()`; `onStep4DataChange` rutar descuento predefinido (`applyPredefinedDiscount`) vs manual (`setDiscount`); `canAdvance` con guard en `onStep4Next()`. **Paso 5 (Físico):** `_signedContractUpload = signal<SignedContractUpload|null>()`; `step5Data.canAdvance = !!upload?.file || contractAccepted()`; `onStep5Next()` solo llama `uploadSignedContract(file)` (ruta física única). **DEV mocks (eliminar con BD real):** `generateDevScheduleGrid()` — 4 semanas × 5 días × 7 slots, ocupación variada por semana. `requiredCount` derivado de `practicalHours × 60 / 45` (fallback: 12). Máx 1 clase por día. | `EnrollmentFacade`, `EnrollmentDocumentsFacade`, `EnrollmentPaymentFacade`, `AuthFacade` | `features/secretaria/matricula/secretaria-matricula.component.ts` | ✅ Estable |
| `/app/secretaria/pagos` | Stub PLANO | — | `features/secretaria/pagos/secretaria-pagos.component.ts" | 🚧 Stub |
| `/app/secretaria/contabilidad/cuadratura` | Stub PLANO | — | `features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component.ts" | 🚧 Stub |
| `/app/secretaria/contabilidad/reportes` | Stub PLANO | — | `features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component.ts" | 🚧 Stub |
| `/app/secretaria/certificados` | Stub PLANO | — | `features/secretaria/certificados/secretaria-certificados.component.ts" | 🚧 Stub |
| `/app/secretaria/documentos` | Stub PLANO | — | `features/secretaria/documentos/secretaria-documentos.component.ts" | 🚧 Stub |
| `/app/secretaria/instructores` | Stub PLANO | — | `features/secretaria/instructores/secretaria-instructores.component.ts" | 🚧 Stub |
| `/app/secretaria/comunicaciones` | Stub PLANO | — | `features/secretaria/comunicaciones/secretaria-comunicaciones.component.ts" | 🚧 Stub |
| `/app/secretaria/observaciones` | Stub PLANO | — | `features/secretaria/observaciones/secretaria-observaciones.component.ts" | 🚧 Stub |
| `/app/secretaria/psicotecnico` | Stub PLANO | — | `features/secretaria/psicotecnico/secretaria-psicotecnico.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/relatores` | Stub PLANO | — | `features/secretaria/profesional-relatores/secretaria-profesional-relatores.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/promociones` | Stub PLANO | — | `features/secretaria/profesional-promociones/secretaria-profesional-promociones.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/notas` | Stub PLANO | — | `features/secretaria/profesional-notas/secretaria-profesional-notas.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/certificados` | Stub PLANO | — | `features/secretaria/profesional-certificados/secretaria-profesional-certificados.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/archivo` | Stub PLANO | — | `features/secretaria/profesional-archivo/secretaria-profesional-archivo.component.ts" | 🚧 Stub |
| `/app/secretaria/notificaciones` | Stub PLANO | — | `features/secretaria/notificaciones/secretaria-notificaciones.component.ts" | 🚧 Stub |
| `/app/secretaria/libro-de-clases` | Stub PLANO — mockup: `libro-de-clases.astro` (raíz) | — | `features/secretaria/libro-de-clases/secretaria-libro-de-clases.component.ts" | 🚧 Stub |
| `/app/secretaria/ex-alumnos` | Stub PLANO | — | `features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts" | 🚧 Stub |
| `/app/secretaria/servicios-especiales` | Stub PLANO | — | `features/secretaria/servicios-especiales/secretaria-servicios-especiales.component.ts" | 🚧 Stub |
| **— PORTAL INSTRUCTOR (9 stubs) —** | | | | |
| `/app/instructor/dashboard` | Stub PLANO | — | `features/instructor/dashboard/instructor-dashboard.component.ts" | 🚧 Stub |
| `/app/instructor/alumnos` | Stub PLANO | — | `features/instructor/alumnos/instructor-alumnos.component.ts" | 🚧 Stub |
| `/app/instructor/clase/iniciar` | Stub PLANO | — | `features/instructor/clase/instructor-clase.component.ts" | 🚧 Stub |
| `/app/instructor/horario` | Stub PLANO | — | `features/instructor/horario/instructor-horario.component.ts" | 🚧 Stub |
| `/app/instructor/ensayos-teoricos` | Stub PLANO | — | `features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts" | 🚧 Stub |
| `/app/instructor/liquidacion` | Stub PLANO | — | `features/instructor/liquidacion/instructor-liquidacion.component.ts" | 🚧 Stub |
| `/app/instructor/notificaciones` | Stub PLANO | — | `features/instructor/notificaciones/instructor-notificaciones.component.ts" | 🚧 Stub |
| `/app/instructor/asistencia` | Stub PLANO | — | `features/instructor/asistencia/instructor-asistencia.component.ts" | 🚧 Stub |
| `/app/instructor/ayuda` | Stub PLANO | — | `features/instructor/ayuda/instructor-ayuda.component.ts" | 🚧 Stub |
| **— PORTAL ALUMNO (12 stubs) —** | | | | |
| `/app/alumno/dashboard` | Stub PLANO | — | `features/alumno/dashboard/alumno-dashboard.component.ts" | 🚧 Stub |
| `/app/alumno/clases` | Stub PLANO | — | `features/alumno/clases/alumno-clases.component.ts" | 🚧 Stub |
| `/app/alumno/agendar` | Stub PLANO | — | `features/alumno/agendar/alumno-agendar.component.ts" | 🚧 Stub |
| `/app/alumno/notas` | Stub PLANO | — | `features/alumno/notas/alumno-notas.component.ts" | 🚧 Stub |
| `/app/alumno/certificado` | Stub PLANO | — | `features/alumno/certificado/alumno-certificado.component.ts" | 🚧 Stub |
| `/app/alumno/pagos` | Stub PLANO | — | `features/alumno/pagos/alumno-pagos.component.ts" | 🚧 Stub |
| `/app/alumno/notificaciones` | Stub PLANO | — | `features/alumno/notificaciones/alumno-notificaciones.component.ts" | 🚧 Stub |
| `/app/alumno/asistencia` | Stub PLANO | — | `features/alumno/asistencia/alumno-asistencia.component.ts" | 🚧 Stub |
| `/app/alumno/horario` | Stub PLANO | — | `features/alumno/horario/alumno-horario.component.ts" | 🚧 Stub |
| `/app/alumno/progreso` | Stub PLANO | — | `features/alumno/progreso/alumno-progreso.component.ts" | 🚧 Stub |
| `/app/alumno/pruebas-online` | Stub PLANO | — | `features/alumno/pruebas-online/alumno-pruebas-online.component.ts" | 🚧 Stub |
| `/app/alumno/ayuda` | Stub PLANO | — | `features/alumno/ayuda/alumno-ayuda.component.ts" | 🚧 Stub |
| **— PORTAL RELATOR (6 stubs) —** | | | | |
| `/app/relator/dashboard` | Stub PLANO | — | `features/relator/dashboard/relator-dashboard.component.ts" | 🚧 Stub |
| `/app/relator/alumnos` | Stub PLANO | — | `features/relator/alumnos/relator-alumnos.component.ts" | 🚧 Stub |
| `/app/relator/asistencia` | Stub PLANO | — | `features/relator/asistencia/relator-asistencia.component.ts" | 🚧 Stub |
| `/app/relator/notas` | Stub PLANO | — | `features/relator/notas/relator-notas.component.ts" | 🚧 Stub |
| `/app/relator/maquinaria` | Stub PLANO | — | `features/relator/maquinaria/relator-maquinaria.component.ts" | 🚧 Stub |
| `/app/relator/acta-final` | Stub PLANO | — | `features/relator/acta-final/relator-acta-final.component.ts" | 🚧 Stub |

