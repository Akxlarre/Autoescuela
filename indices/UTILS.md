# Registro de Utilidades (Functional Core)

> Funciones puras en `core/utils/` — sin estado ni inyección de Angular. Testeables sin framework.
> La sección Auto-Index es regenerada por `npm run indices:sync`. No editar entre los marcadores.

## Guía de uso

- Importar directamente desde la ruta del archivo (`@core/utils/...`)
- Nunca usar estas funciones en templates Angular — llamarlas desde el Facade o componente
- Si una util crece en responsabilidad, extraerla a un Facade propio

## Auto-Index — Utilidades detectadas por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Archivo | Exports |
|---------|---------|
| `src/app/core/utils/age.utils.ts` | `isInvalidDate`, `getAgeStatus`, `calcAge`, `isMinor` |
| `src/app/core/utils/agenda-week.utils.ts` | `addDaysToIso`, `isDateBeyondLimit`, `isNextWeekBeyondLimit` |
| `src/app/core/utils/auth-errors.utils.ts` | `mapAuthError` |
| `src/app/core/utils/avatar-palette.ts` | `AvatarPaletteEntry`, `AVATAR_PALETTES`, `avatarPalette` |
| `src/app/core/utils/branch-scope-ui.utils.ts` | `isSedeDisabled`, `isBothBranchesVisible`, `isBothBranchesDisabled` |
| `src/app/core/utils/branch-scope.utils.ts` | `NO_BRANCH_SCOPE`, `resolveBranchScope` |
| `src/app/core/utils/brand-text.utils.ts` | `resolveBrandText` |
| `src/app/core/utils/carnet-menu.util.ts` | `CarnetMenuState`, `buildCarnetMenu` |
| `src/app/core/utils/ciclo-select-groups.util.ts` | `CicloSelectGroup`, `groupCyclesByStatus` |
| `src/app/core/utils/class-b-session-overdue.utils.ts` | `isSessionOverdue`, `isFromPreviousDay` |
| `src/app/core/utils/class-b-session.utils.ts` | `VALID_CLASS_B_SESSION_STATUSES` |
| `src/app/core/utils/class-count.utils.ts` | `classCountFromPracticalHours` |
| `src/app/core/utils/class-schedule-timing.utils.ts` | `isClassStartOverdue` |
| `src/app/core/utils/consent-builder.utils.ts` | `ConsentBuilderInput`, `buildEnrollmentConsents`, `buildMedicalCertificateConsent`, `buildPsychTestConsent` |
| `src/app/core/utils/convalidation.utils.ts` | `fetchConvalidationMap` |
| `src/app/core/utils/course-colors.ts` | `COURSE_COLORS`, `getCourseColor` |
| `src/app/core/utils/course-resolution.utils.ts` | `findCourseByLicenseClass` |
| `src/app/core/utils/daily-schedule-timeline.utils.ts` | `filterRemainingBlocks`, `shouldShowEmptyDayState` |
| `src/app/core/utils/date.utils.ts` | `todayIso`, `monthsAgoIso`, `toISODate`, `isoToDate`, `to24hTime`, `addMinutesToTime`, `formatChileanDate`, `capitalize`, `buildDayLabel`, `formatCLP`, `getChileDateTimeRange` |
| `src/app/core/utils/db-error.utils.ts` | `toFriendlyDbMessage` |
| `src/app/core/utils/document-file-validation.util.ts` | `validateDocumentFile` |
| `src/app/core/utils/email.utils.ts` | `validateEmail`, `normalizeEmail` |
| `src/app/core/utils/epq-print.util.ts` | `EpqPrintOptions`, `buildEpqTestHtml` |
| `src/app/core/utils/epq-questions.const.ts` | `EPQ_QUESTIONS`, `EPQ_TOTAL`, `EPQ_PAGE_SIZE`, `EPQ_TOTAL_PAGES` |
| `src/app/core/utils/evaluaciones-landing.ts` | `PromotionLite`, `CourseLite`, `EnrollmentLite`, `GradeLite`, `buildCursoResumen`, `buildLanding`, `cursoPromedioAprueba` |
| `src/app/core/utils/excel.utils.ts` | `downloadExcel` |
| `src/app/core/utils/ficha-tecnica-print.util.ts` | `FichaTecnicaPrintOptions`, `buildFichaTecnicaPrintHtml` |
| `src/app/core/utils/gradebook-stats.ts` | `GradebookStats`, `countModulosCompletos`, `isFilaCompleta`, `computeGradebookStats` |
| `src/app/core/utils/image-optimizer.ts` | `OptimizeOptions`, `optimizeImage` |
| `src/app/core/utils/image.utils.ts` | `normalizePhoto` |
| `src/app/core/utils/instructor-doc-types.util.ts` | `INSTRUCTOR_DOC_TYPES` |
| `src/app/core/utils/kpi-display-value.util.ts` | `kpiDisplayValue` |
| `src/app/core/utils/kpi-es-cl-format.util.ts` | `formatKpiEsCl` |
| `src/app/core/utils/layout-tier.utils.ts` | `widthToTier`, `sliceByBudget`, `LoadMoreState`, `visibleWithLoadMore` |
| `src/app/core/utils/license-seniority.utils.ts` | `calcLicenseSeniority` |
| `src/app/core/utils/license-suffix.utils.ts` | `licenseClassToSuffix` |
| `src/app/core/utils/liquidaciones-avatar-colors.ts` | `LIQUIDACIONES_AVATAR_COLORS`, `getLiquidacionAvatarColor` |
| `src/app/core/utils/live-class-action.utils.ts` | `ClasePracticaActionRow`, `LiveClassActionPlan`, `resolveLiveClassActionPlan` |
| `src/app/core/utils/name.utils.ts` | `stripInvalidNameChars`, `validateName` |
| `src/app/core/utils/notification.utils.ts` | `mapReferenceToNotificationType`, `mapNotificationDtoToUi`, `groupNotifications` |
| `src/app/core/utils/odometer.utils.ts` | `OdometerFontTier`, `odometerDigitCount`, `odometerFontTier` |
| `src/app/core/utils/payment-concept.utils.ts` | `mapConcepto` |
| `src/app/core/utils/percentage.utils.ts` | `roundPercentagesTo100` |
| `src/app/core/utils/period-window.utils.ts` | `PeriodWindow`, `PERIOD_WINDOW_MONTHS`, `DEFAULT_PERIOD_WINDOW`, `periodCutoffIso`, `applyPeriodWindow` — ventana de período para listas históricas acumulativas (fix-147-b). Filtro de **renderizado**, no de query: el dataset completo se sigue trayendo de BD. ⚠️ `applyPeriodWindow` devuelve la lista completa cuando `hasActiveSearch` es `true` — regla no negociable de ASG-b-087: si el período atrapara a la búsqueda, buscar a alguien con matrícula vieja daría "0 resultados" y eso se lee como "no existe". Los registros sin fecha se conservan a propósito. Acepta `cutoffIso` explícito para tests deterministas. Consumido por `app-period-selector`. |
| `src/app/core/utils/phone.utils.ts` | `DialCode`, `DIAL_CODES`, `validatePhone`, `normalizePhone` |
| `src/app/core/utils/professional-access.utils.ts` | `BranchProfessionalFlag`, `canAccessProfessional`, `canUnlockProfessional`, `visibleNavGroups` |
| `src/app/core/utils/professional-modules.ts` | `GRADE_MIN`, `GRADE_MAX`, `GRADE_PASS`, `MODULE_COUNT`, `getModuleNames`, `getModuleShortLabel`, `isPassing`, `roundGrade`, `calcAverage` |
| `src/app/core/utils/professional-specializations.ts` | `SPEC_COLORS`, `SPEC_LABELS`, `SPECIALIZATION_OPTIONS`, `getSpecColor`, `getSpecLabel` |
| `src/app/core/utils/promotion-end-date.utils.ts` | `computePromotionEndDate` |
| `src/app/core/utils/reenrollment.utils.ts` | `EnrollmentStatus`, `ReenrollmentVerdict`, `BLOCKING_STATUSES`, `HISTORICAL_STATUSES`, `evaluateReenrollment` |
| `src/app/core/utils/reportes-contables.utils.ts` | `PaymentRow`, `ExpenseRow`, `SingularSaleReportDto`, `mapSingularSaleToPaymentRow`, `filterPaymentsByBranch`, `computeKpis`, `computeIngresosCategoria`, `computeGastosCategoria`, `computeEvolucionMensual`, `computeDetalleDiario`, `buildReporte` |
| `src/app/core/utils/request-guard.utils.ts` | `RequestGuard`, `createRequestGuard` |
| `src/app/core/utils/route-sheet-print.util.ts` | `RouteSheetPrintOptions`, `buildRouteSheetHtml` |
| `src/app/core/utils/rut.utils.ts` | `cleanRut`, `formatRut`, `normalizeRutForStorage`, `calculateRutDv`, `validateRut`, `autocompleteRutDv` |
| `src/app/core/utils/schedule-status.utils.ts` | `SessionStatus`, `StatusVisual`, `getStatusVisual`, `getStatusLabel`, `getDotStyle` |
| `src/app/core/utils/schedule-week-days.utils.ts` | `filterVisibleWeekDays` |
| `src/app/core/utils/search-filter.utils.ts` | `normalizeSearchText`, `matchesSearch`, `filterBySearch` |
| `src/app/core/utils/search-intents.ts` | `INTENT_ENTRIES`, `getActionResults` |
| `src/app/core/utils/sede-theme.utils.ts` | `SedeTheme`, `DEFAULT_SEDE_THEME`, `branchIdToTheme` |
| `src/app/core/utils/sparkline.utils.ts` | `getSparklinePoints` |
| `src/app/core/utils/student-home.ts` | `computeOverallProgress`, `computeSemaphore`, `computeAverageGrade`, `computeCertificateBlockingReason`, `deriveCertificateState` |
| `src/app/core/utils/student-name.util.ts` | `StudentNameParts`, `buildStudentDisplayName`, `sortByPaternalLastNameAsc` |
| `src/app/core/utils/subnav-tier.utils.ts` | `SubnavTier`, `pickSubnavTier` |
| `src/app/core/utils/task.utils.ts` | `canSendTo`, `isOverdue`, `canEditTask`, `canDeleteTask`, `canChangeStatus`, `formatTaskAge`, `mapTaskDtoToRow` |
| `src/app/core/utils/theory-cycle.ts` | `cycleStartMonday`, `cycleEnd`, `cycleClassDates`, `formatCycleLabel` |
| `src/app/core/utils/vehicle-doc-types.util.ts` | `VEHICLE_DOC_TYPES` |
| `src/app/core/utils/vehicle-document-status.utils.ts` | `resolveDocStatus`, `VehicleDocWarningInfo`, `VehicleDocWarning`, `shouldShowVehicleDocWarning`, `vehicleDocWarningLabel`, `vehicleDocWarningLabelGeneric`, `VehicleDocumentRow`, `buildVehicleDocWarningMap` |
| `src/app/core/utils/vehicle-status.utils.ts` | `resolveVehicleStatus` |

<!-- AUTO-GENERATED:END -->
