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
| `src/app/core/utils/auth-errors.utils.ts` | `mapAuthError` |
| `src/app/core/utils/branch-scope.utils.ts` | `NO_BRANCH_SCOPE`, `resolveBranchScope` |
| `src/app/core/utils/carnet-menu.util.ts` | `CarnetMenuState`, `buildCarnetMenu` |
| `src/app/core/utils/date.utils.ts` | `todayIso`, `toISODate`, `isoToDate`, `to24hTime`, `formatChileanDate`, `capitalize`, `buildDayLabel`, `formatCLP`, `getChileDateTimeRange` |
| `src/app/core/utils/db-error.utils.ts` | `toFriendlyDbMessage` |
| `src/app/core/utils/email.utils.ts` | `validateEmail`, `normalizeEmail` |
| `src/app/core/utils/epq-print.util.ts` | `EpqPrintOptions`, `buildEpqTestHtml` |
| `src/app/core/utils/epq-questions.const.ts` | `EPQ_QUESTIONS`, `EPQ_TOTAL`, `EPQ_PAGE_SIZE`, `EPQ_TOTAL_PAGES` |
| `src/app/core/utils/evaluaciones-landing.ts` | `PromotionLite`, `CourseLite`, `EnrollmentLite`, `GradeLite`, `buildCursoResumen`, `buildLanding`, `cursoPromedioAprueba` |
| `src/app/core/utils/excel.utils.ts` | `downloadExcel` |
| `src/app/core/utils/gradebook-stats.ts` | `GradebookStats`, `countModulosCompletos`, `isFilaCompleta`, `computeGradebookStats` |
| `src/app/core/utils/image-optimizer.ts` | `OptimizeOptions`, `optimizeImage` |
| `src/app/core/utils/image.utils.ts` | `normalizePhoto` |
| `src/app/core/utils/kpi-display-value.util.ts` | `kpiDisplayValue` |
| `src/app/core/utils/name.utils.ts` | `stripInvalidNameChars`, `validateName` |
| `src/app/core/utils/notification.utils.ts` | `mapReferenceToNotificationType`, `mapNotificationDtoToUi` |
| `src/app/core/utils/phone.utils.ts` | `DialCode`, `DIAL_CODES`, `validatePhone`, `normalizePhone` |
| `src/app/core/utils/professional-access.utils.ts` | `BranchProfessionalFlag`, `canAccessProfessional` |
| `src/app/core/utils/professional-modules.ts` | `GRADE_MIN`, `GRADE_MAX`, `GRADE_PASS`, `MODULE_COUNT`, `getModuleNames`, `getModuleShortLabel`, `isPassing`, `roundGrade`, `calcAverage` |
| `src/app/core/utils/professional-specializations.ts` | `SPEC_COLORS`, `SPEC_LABELS`, `SPECIALIZATION_OPTIONS`, `getSpecColor`, `getSpecLabel` |
| `src/app/core/utils/reenrollment.utils.ts` | `EnrollmentStatus`, `ReenrollmentVerdict`, `BLOCKING_STATUSES`, `HISTORICAL_STATUSES`, `evaluateReenrollment` |
| `src/app/core/utils/reportes-contables.utils.ts` | `PaymentRow`, `ExpenseRow`, `SingularSaleReportDto`, `mapSingularSaleToPaymentRow`, `filterPaymentsByBranch`, `computeKpis`, `computeIngresosCategoria`, `computeGastosCategoria`, `computeEvolucionMensual`, `computeDetalleDiario`, `buildReporte` |
| `src/app/core/utils/rut.utils.ts` | `cleanRut`, `formatRut`, `normalizeRutForStorage`, `validateRut` |
| `src/app/core/utils/schedule-status.utils.ts` | `SessionStatus`, `StatusVisual`, `getStatusVisual`, `getStatusLabel`, `getDotStyle` |
| `src/app/core/utils/search-intents.ts` | `INTENT_ENTRIES`, `getActionResults` |
| `src/app/core/utils/sede-theme.utils.ts` | `SedeTheme`, `DEFAULT_SEDE_THEME`, `branchIdToTheme` |
| `src/app/core/utils/sparkline.utils.ts` | `getSparklinePoints` |
| `src/app/core/utils/student-home.ts` | `computeOverallProgress`, `computeSemaphore`, `computeAverageGrade`, `computeCertificateBlockingReason`, `deriveCertificateState` |
| `src/app/core/utils/task.utils.ts` | `canSendTo`, `isOverdue`, `canEditTask`, `canDeleteTask`, `canChangeStatus`, `formatTaskAge`, `mapTaskDtoToRow` |

<!-- AUTO-GENERATED:END -->
