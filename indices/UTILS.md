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
| `src/app/core/utils/alumno-profesional-status.utils.ts` | `SemaforoInfo`, `moduloPct`, `getSemaforo`, `getSemaforoBadgeVariant` |
| `src/app/core/utils/alumno-status.utils.ts` | `ExpedienteStatus`, `TagSeverity`, `BadgeVariant`, `getExpedienteStatus`, `isAlumnoCursando`, `getAlumnoStatusSeverity`, `tagSeverityToBadgeVariant`, `getAlumnoStatusBadgeVariant` |
| `src/app/core/utils/alumnos-export.utils.ts` | `buildAlumnosExcelTable`, `alumnosPdfColumnWeights`, `buildAlumnosPdfTable` |
| `src/app/core/utils/alumnos-hero-actions.utils.ts` | `buildAlumnosHeroActions` |
| `src/app/core/utils/alumnos-list-navigation.utils.ts` | `isReturningFromFicha` |
| `src/app/core/utils/alumnos-profesional-export.utils.ts` | `buildAlumnosProfesionalExcelTable`, `ALUMNOS_PROFESIONAL_PDF_COLUMN_WEIGHTS`, `buildAlumnosProfesionalPdfTable` |
| `src/app/core/utils/alumnos-profesional-sort.utils.ts` | `AlumnoProfesionalSortField`, `AlumnoProfesionalListSort`, `ALUMNO_PROFESIONAL_SORT_OPTIONS`, `sortAlumnosProfesional` |
| `src/app/core/utils/alumnos-sort.utils.ts` | `ALUMNO_SORT_OPTIONS`, `sortAlumnos`, `nextAlumnoSort`, `toggleAlumnoSortDirection` |
| `src/app/core/utils/announcement-recipients.utils.ts` | `ANNOUNCEMENT_BATCH_SIZE`, `ANNOUNCEMENT_MAX_RECIPIENTS`, `ANNOUNCEMENT_WARN_RECIPIENTS`, `AnnouncementBatch`, `AnnouncementDraftError`, `AnnouncementDraftValidation`, `ExclusionCounts`, `buildBatches`, `validateAnnouncementDraft`, `countExclusions` |
| `src/app/core/utils/announcement-template.utils.ts` | `TemplateDraftError`, `TemplateDraftValidation`, `renderTemplate`, `extractUsedVariables`, `isScheduledForValid`, `InsertionResult`, `insertAtCursor`, `validateTemplateDraft` |
| `src/app/core/utils/archive-confirmation.utils.ts` | `ARCHIVE_CONFIRMATION_WORD`, `buildFutureClassesBlockMessage`, `CLASE_B_ARCHIVE_WARNING`, `isArchiveConfirmationText` |
| `src/app/core/utils/auth-errors.utils.ts` | `PASSWORD_MIN_LENGTH`, `mapAuthError` |
| `src/app/core/utils/avatar-palette.ts` | `AvatarPaletteEntry`, `AVATAR_PALETTES`, `avatarPalette` |
| `src/app/core/utils/branch-scope-ui.utils.ts` | `isSedeDisabled`, `isBothBranchesVisible`, `isBothBranchesDisabled` |
| `src/app/core/utils/branch-scope.utils.ts` | `NO_BRANCH_SCOPE`, `resolveBranchScope`, `canChooseBranch` |
| `src/app/core/utils/brand-text.utils.ts` | `resolveBrandText` |
| `src/app/core/utils/carnet-menu.util.ts` | `CarnetMenuState`, `buildCarnetMenu` |
| `src/app/core/utils/ciclo-select-groups.util.ts` | `CicloSelectGroup`, `groupCyclesByStatus` |
| `src/app/core/utils/class-b-session-overdue.utils.ts` | `isSessionOverdue`, `isFromPreviousDay` |
| `src/app/core/utils/class-b-session.utils.ts` | `VALID_CLASS_B_SESSION_STATUSES` |
| `src/app/core/utils/class-count.utils.ts` | `classCountFromPracticalHours` |
| `src/app/core/utils/class-schedule-timing.utils.ts` | `isClassStartOverdue` |
| `src/app/core/utils/consent-builder.utils.ts` | `ConsentBuilderInput`, `buildEnrollmentConsents`, `buildMedicalCertificateConsent`, `buildPsychTestConsent`, `CommunicationsConsentInput`, `buildCommunicationsConsents` |
| `src/app/core/utils/convalidation-book.utils.ts` | `CONVALIDATION_BOOKS`, `getConvalidationBookName`, `buildConvalidationBookId`, `getConvalidationModuleNames`, `selectConvalidationDates`, `buildBookOptions`, `parseBookKey` |
| `src/app/core/utils/convalidation.utils.ts` | `fetchConvalidationMap` |
| `src/app/core/utils/course-colors.ts` | `COURSE_COLORS`, `getCourseColor` |
| `src/app/core/utils/course-filter-options.utils.ts` | `CourseFilterOption`, `buildCourseFilterOptions` |
| `src/app/core/utils/course-resolution.utils.ts` | `findCourseByLicenseClass` |
| `src/app/core/utils/cuadratura-hero-kpis.utils.ts` | `CuadraturaHeroKpiInput`, `buildCuadraturaHeroKpis` |
| `src/app/core/utils/cuadratura-medio-pago.utils.ts` | `medioDePagoLabel` |
| `src/app/core/utils/daily-schedule-timeline.utils.ts` | `filterRemainingBlocks`, `shouldShowEmptyDayState` |
| `src/app/core/utils/date.utils.ts` | `todayIso`, `monthsAgoIso`, `toISODate`, `formatDayMonthYear`, `isoToDate`, `to24hTime`, `addMinutesToTime`, `formatChileanDate`, `capitalize`, `buildDayLabel`, `formatCLP`, `getChileDateTimeRange` |
| `src/app/core/utils/db-error.utils.ts` | `toFriendlyDbMessage` |
| `src/app/core/utils/document-clause-limits.util.ts` | `ClauseCharacterStatus`, `getClauseCharacterStatus` |
| `src/app/core/utils/document-clause-tokens.util.ts` | `getTokenDescription` |
| `src/app/core/utils/document-file-validation.util.ts` | `validateDocumentFile` |
| `src/app/core/utils/drawer-navigation.utils.ts` | `isRouteChange` |
| `src/app/core/utils/edge-function-error.utils.ts` | `EdgeFunctionError`, `readEdgeFunctionError`, `edgeFunctionUserMessage` |
| `src/app/core/utils/egresado-status.utils.ts` | `EgresadoAccountStatus`, `getEgresadoAccountStatus` |
| `src/app/core/utils/egresados-export.utils.ts` | `ExportTable`, `buildEgresadosExcelTable`, `EGRESADOS_PDF_COLUMN_WEIGHTS`, `buildEgresadosPdfTable` |
| `src/app/core/utils/egresados-sort.utils.ts` | `EgresadoSortField`, `EgresadoListSort`, `egresadoSortOptions`, `sortEgresados` |
| `src/app/core/utils/egreso-confirmation.utils.ts` | `buildMarcarExAlumnoMessage` |
| `src/app/core/utils/email.utils.ts` | `validateEmail`, `normalizeEmail`, `isSameEmail` |
| `src/app/core/utils/enrollment-unsaved.utils.ts` | `hasUnsavedPersonalData` |
| `src/app/core/utils/epq-questions.const.ts` | `EPQ_QUESTIONS`, `EPQ_TOTAL`, `EPQ_PAGE_SIZE`, `EPQ_TOTAL_PAGES` |
| `src/app/core/utils/evaluaciones-landing.ts` | `PromotionLite`, `CourseLite`, `EnrollmentLite`, `GradeLite`, `buildCursoResumen`, `buildLanding`, `cursoPromedioAprueba` |
| `src/app/core/utils/excel.utils.ts` | `downloadExcel` |
| `src/app/core/utils/executive-dashboard.utils.ts` | `resolvePresetRange`, `isValidRange`, `pickerDatesToRange`, `previousRange`, `yoyRange`, `computeDelta`, `deltaTone`, `formatDeltaLabel`, `marginPct`, `safeRatePct`, `formatMinutesAsHours`, `monthShortLabel`, `describeRange`, `buildMonthlySeries`, `seriesCurrentMonth`, `chileTodayIso`, `mapKpiSummary`, `mapStageCounts`, `mapReceivables`, `mapInstructorHours`, `buildExecKpiCards`, `toHeroKpi`, `mapTodayOps` |
| `src/app/core/utils/ficha-enrollment.utils.ts` | `FichaEnrollmentCandidate`, `buildEnrollmentTabLabel`, `parseEnrollmentParam`, `pickFichaEnrollment` |
| `src/app/core/utils/ficha-pagos.utils.ts` | `formatPaymentConcept`, `canRegistrarPago` |
| `src/app/core/utils/file-download.utils.ts` | `downloadBlob` |
| `src/app/core/utils/filter-options.utils.ts` | `withAllOption` |
| `src/app/core/utils/gradebook-stats.ts` | `GradebookStats`, `countModulosCompletos`, `isFilaCompleta`, `computeGradebookStats` |
| `src/app/core/utils/html.utils.ts` | `escapeHtml` |
| `src/app/core/utils/image-optimizer.ts` | `OptimizeOptions`, `optimizeImage` |
| `src/app/core/utils/image.utils.ts` | `normalizePhoto` |
| `src/app/core/utils/inasistencia.utils.ts` | `canJustificarInasistencia` |
| `src/app/core/utils/instructor-create-branch.utils.ts` | `InstructorCreateBranch`, `resolveInstructorCreateBranch` |
| `src/app/core/utils/instructor-doc-types.util.ts` | `INSTRUCTOR_DOC_TYPES` |
| `src/app/core/utils/kpi-display-value.util.ts` | `kpiDisplayValue` |
| `src/app/core/utils/kpi-es-cl-format.util.ts` | `formatKpiEsCl` |
| `src/app/core/utils/kpi-trend.utils.ts` | `kpiTrendColor`, `TrendView`, `trendView`, `formatTrendDisplay` |
| `src/app/core/utils/layout-drawer-size.utils.ts` | `LAYOUT_DRAWER_MOBILE_BREAKPOINT`, `isLayoutDrawerMobile`, `layoutDrawerDesktopWidth` |
| `src/app/core/utils/layout-tier.utils.ts` | `widthToTier`, `sliceByBudget`, `LoadMoreState`, `visibleWithLoadMore` |
| `src/app/core/utils/license-seniority.utils.ts` | `requiredPriorLicenseLabel`, `licenseClassFromCourseType`, `calcLicenseSeniority` |
| `src/app/core/utils/license-status.utils.ts` | `LICENSE_EXPIRING_SOON_DAYS`, `licenseStatusFromExpiry`, `expiredLicenseNotice` |
| `src/app/core/utils/license-suffix.utils.ts` | `licenseClassToSuffix` |
| `src/app/core/utils/line-chart.utils.ts` | `niceMax`, `niceTickCount`, `yTicks`, `pointY`, `pointX`, `buildLinePath`, `formatCompactNumber` |
| `src/app/core/utils/liquidaciones-avatar-colors.ts` | `LIQUIDACIONES_AVATAR_COLORS`, `getLiquidacionAvatarColor` |
| `src/app/core/utils/live-class-action.utils.ts` | `ClasePracticaActionRow`, `LiveClassActionPlan`, `resolveLiveClassActionPlan` |
| `src/app/core/utils/name.utils.ts` | `stripInvalidNameChars`, `validateName` |
| `src/app/core/utils/notification.utils.ts` | `mapReferenceToNotificationType`, `mapNotificationDtoToUi`, `groupNotifications` |
| `src/app/core/utils/odometer.utils.ts` | `OdometerFontTier`, `odometerDigitCount`, `odometerFontTier` |
| `src/app/core/utils/payment-concept.utils.ts` | `mapConcepto` |
| `src/app/core/utils/payment-status.utils.ts` | `enrollmentPaymentStatusLabel`, `enrollmentPaymentStatusVariant` |
| `src/app/core/utils/percentage.utils.ts` | `roundPercentagesTo100` |
| `src/app/core/utils/period-window.utils.ts` | `PeriodWindow`, `PERIOD_WINDOW_MONTHS`, `DEFAULT_PERIOD_WINDOW`, `periodCutoffIso`, `PeriodWindowOptions`, `applyPeriodWindow` |
| `src/app/core/utils/phone.utils.ts` | `DialCode`, `DIAL_CODES`, `validatePhone`, `hasMinimumPhoneLength`, `normalizePhone` |
| `src/app/core/utils/professional-access.utils.ts` | `BranchProfessionalFlag`, `canAccessProfessional`, `canUnlockProfessional`, `visibleNavGroups` |
| `src/app/core/utils/professional-modules.ts` | `GRADE_MIN`, `GRADE_MAX`, `GRADE_PASS`, `MODULE_COUNT`, `getModuleNames`, `getModuleShortLabel`, `isPassing`, `roundGrade`, `calcAverage` |
| `src/app/core/utils/professional-specializations.ts` | `SPEC_COLORS`, `SPEC_LABELS`, `SPECIALIZATION_OPTIONS`, `getSpecColor`, `getSpecLabel` |
| `src/app/core/utils/promotion-code.utils.ts` | `PROMOTION_CADENCE_ANCHOR`, `PROMOTION_CODE_MAX_AHEAD`, `isValidPromotionCode`, `maxPromotionCode`, `suggestNextPromotionCode`, `promotionCodeError`, `promotionNameForCode`, `promotionLabel`, `promotionOptionStatus`, `sortPromotionGroupsByStart`, `isCadenceDate`, `promotionWriteErrorMessage` |
| `src/app/core/utils/promotion-end-date.utils.ts` | `computePromotionEndDate`, `promotionHolidayYears`, `holidaysOfYear` |
| `src/app/core/utils/reagendamiento.utils.ts` | `isRazonReagendamientoCompleta`, `slotChocaConClases` |
| `src/app/core/utils/recipient-filter.utils.ts` | `BulkAction`, `filterRecipients`, `includedCount`, `applyBulkAction`, `onlyExcluded` |
| `src/app/core/utils/reenrollment.utils.ts` | `EnrollmentStatus`, `ReenrollmentVerdict`, `BLOCKING_STATUSES`, `HISTORICAL_STATUSES`, `evaluateReenrollment` |
| `src/app/core/utils/reportes-contables.utils.ts` | `PaymentRow`, `ExpenseRow`, `SingularSaleReportDto`, `mapSingularSaleToPaymentRow`, `filterPaymentsByBranch`, `computeKpis`, `computeIngresosCategoria`, `computeGastosCategoria`, `computeEvolucionMensual`, `computeEvolucionRange`, `computeRentabilidadCursos`, `buildReporte` |
| `src/app/core/utils/request-guard.utils.ts` | `RequestGuard`, `createRequestGuard` |
| `src/app/core/utils/rut.utils.ts` | `cleanRut`, `formatRut`, `normalizeRutForStorage`, `calculateRutDv`, `validateRut`, `autocompleteRutDv` |
| `src/app/core/utils/schedule-status.utils.ts` | `SessionStatus`, `StatusVisual`, `getStatusVisual`, `getStatusLabel`, `getDotStyle` |
| `src/app/core/utils/schedule-week-days.utils.ts` | `filterVisibleWeekDays` |
| `src/app/core/utils/search-filter.utils.ts` | `normalizeSearchText`, `matchesSearch`, `filterBySearch`, `matchesSearchTokens`, `filterBySearchTokens` |
| `src/app/core/utils/search-intents.ts` | `INTENT_ENTRIES`, `getActionResults` |
| `src/app/core/utils/sede-theme.utils.ts` | `SedeTheme`, `DEFAULT_SEDE_THEME`, `branchIdToTheme` |
| `src/app/core/utils/sparkline.utils.ts` | `getSparklinePoints` |
| `src/app/core/utils/student-home.ts` | `computeOverallProgress`, `computeSemaphore`, `computeAverageGrade`, `computeCertificateBlockingReason`, `deriveCertificateState` |
| `src/app/core/utils/student-name.util.ts` | `StudentNameParts`, `buildStudentDisplayName`, `sortByPaternalLastNameAsc` |
| `src/app/core/utils/subnav-tier.utils.ts` | `SubnavTier`, `pickSubnavTier`, `canUseIconTier` (el tier "solo ícono" exige que todas las pestañas tengan ícono) |
| `src/app/core/utils/table-sort.utils.ts` | `SortDirection`, `TableSort`, `SortKey`, `textSortKey`, `dateSortKey`, `rutSortKey`, `sortRows`, `nextSort`, `toggleSortDirection`, `ariaSortOf`, `sortIconOf` |
| `src/app/core/utils/task.utils.ts` | `canSendTo`, `isOverdue`, `canEditTask`, `canDeleteTask`, `canChangeStatus`, `formatTaskAge`, `mapTaskDtoToRow` |
| `src/app/core/utils/theory-cycle.ts` | `cycleStartMonday`, `cycleEnd`, `cycleClassDates`, `formatCycleLabel` |
| `src/app/core/utils/vehicle-doc-types.util.ts` | `VEHICLE_DOC_TYPES` |
| `src/app/core/utils/vehicle-document-status.utils.ts` | `resolveDocStatus`, `VehicleDocWarningInfo`, `VehicleDocWarning`, `shouldShowVehicleDocWarning`, `vehicleDocWarningLabel`, `vehicleDocWarningLabelGeneric`, `VehicleDocumentRow`, `buildVehicleDocWarningMap` |
| `src/app/core/utils/vehicle-status.utils.ts` | `resolveVehicleStatus` |

<!-- AUTO-GENERATED:END -->
