# Acceptance 0024-m — Fechas de negocio en hora de Chile

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Estado (2026-10-09):** ✅ PASA. Matías aplicó las tres migraciones y desplegó las 18 edge
> functions el 2026-10-09. Verificado después contra el sistema en uso (ver "Verificación
> posterior a la aplicación"). Quedan dos observaciones que solo se pueden hacer de noche y no
> bloquean el cierre: una corrida real del corte de inasistencias a las 21:00 y un PDF generado
> entre las 21:00 y la medianoche.

## Verificación posterior a la aplicación (2026-10-09, 02:10 hora Chile)

| Qué | Resultado |
|---|---|
| `supabase/tests/timezone/0024-m-business-day.sql` contra la BD real, fuera de transacción | Pasa sin fallos (AC9, AC10, AC11, AC12 y el contrato de las tres funciones) |
| Objetos aplicados | Existen `chile_today`, `chile_date`, `chile_day_start` y `run_class_b_absences_cutoff`; el job `mark-end-of-day-class-b-absences` quedó en `0 0,1 * * *` llamando al envoltorio |
| Vista `v_class_b_schedule_availability` | 4.368 filas, las mismas que antes de migrar |
| Edge functions desplegadas | Las 18 figuran actualizadas el 2026-10-09 entre las 05:04 y las 05:06 UTC (`supabase functions list`) |
| `generate-cash-closing-report` (Excel y PDF), `generate-financial-report`, `generate-cash-history-report`, `generate-payroll-report`, invocadas como admin | Las cuatro responden 200 e imprimen `09-10-2026, 02:10`: la hora de Chile (en UTC habrían sido las 05:10) |

Lo que esta verificación no cubre: a las 02:10 el día de Chile y el de UTC coinciden, así que el
"hoy" por defecto y las fechas que escriben las funciones (`issued_date`, `registration_date`)
no se pudieron distinguir contra el sistema en uso; la hora impresa sí. Las otras 14 funciones
no se invocaron (crean o modifican datos, o necesitan un alumno o certificado concreto).

## Cómo se verificó

| Verificación | Comando | Resultado |
|---|---|---|
| Suite unitaria completa en tres zonas | `node scripts/test-tz.mjs src/app` | 3.745 tests en verde en `UTC`, `Asia/Tokyo` y `America/Santiago` |
| Guardrail y lint | `npm run lint:arch` | 0 errores; ARCH-27/ARCH-28 con backlog 0 |
| Guardrail (sus propios casos) | `node scripts/lib/date-discipline.test.mjs` | Todos los casos pasan |
| Util de edge functions | `deno test --allow-read supabase/functions/_shared/chile-time.test.ts` | 11 tests, mismos vectores que la app |
| Otros módulos puros de `_shared` | `deno test` de `holidays`, `class-book-calendar`, `enrollment-sheet-format` | 35 tests en verde en total |
| Navegador real, reloj fijado | `npx playwright test e2e/transversal-shell.spec.ts -g T02` | 15:00 y 23:30 en verde (dev y build de producción) |
| Build de producción | `ng build --configuration production` | Compila |
| Migraciones y test SQL | Ensayo en una transacción revertida contra la BD de dev | Las tres aplican, `supabase/tests/timezone/0024-m-business-day.sql` pasa, la vista devuelve las mismas 4.368 filas; no quedó nada aplicado |
| Revisión visual | Playwright MCP como admin, 1280×800 | Auditoría, Agenda y Liquidaciones muestran fechas y horas de Chile; consola sin errores |

No se pudo correr `deno check` sobre las edge functions: en este equipo faltan las dependencias
npm de Deno (`pdf-lib`, `supabase-js`), igual que antes de esta spec. Se reemplazó por un chequeo
de sintaxis y de nombres sin definir con `tsc --noResolve`. Ninguna función se probó desplegada.

## Resultado por AC

| AC | Estado | Evidencia |
|---|---|---|
| AC1 | ✅ | `T02` sin `knownBug`, verde a las 23:30. Los formularios usan `todayIso()` → `chileToday()` |
| AC2 | ✅ | `core/facades/hora-chile.facades.spec.ts`: pago de matrícula, pago de pre-inscripción y alta de relator a las 23:30 guardan el día D |
| AC3 | ✅ | Tests de rango en `cuadratura`, `dashboard`, `reportes-contables`, `auditoria`, `asistencia-clase-b`, `flota`, `instructores`, `instructor-clases` e `instructor-horas`: 23:30 de D entra, 00:10 de D+1 no |
| AC4 | ✅ | `toChileDate()` en los cortes sobre instantes; tests en `period-window.utils`, `reportes-contables.utils`, `ex-alumnos.facade` (egreso a las 23:30 del 31 de diciembre) y `date.utils` |
| AC5 | ✅ | Fin de mes a las 23:30 en `servicios-especiales`, `instructor-horas` (meta y registro del mes) y `reportes-contables.model.spec.ts` |
| AC6 | ✅ | La suite completa, no solo las utils, pasa igual en las tres zonas |
| AC7 | ✅ | `chileToday()` en `create-instructor`, `update-instructor`, certificados B y Profesional y en los defaults de cierre de caja, historial, financiero y sueldos. Desplegado; `chileToday()` probado a las 23:30 en el test Deno con los vectores compartidos. Sin observar de noche contra el sistema en uso |
| AC8 | ✅ | Fechas de generación y de cada registro vía `formatChilePattern` / `formatChileDate`; cero ocurrencias de ARCH-27 en `supabase/functions`. Cuatro reportes desplegados imprimen la hora de Chile |
| AC9 | ✅ | 7 funciones, 1 policy y 1 vista redefinidas con `chile_today()`. Test SQL verde contra la BD migrada |
| AC10 | ✅ | `information_schema.columns` de la BD vigente: ninguna columna `timestamp without time zone` en `public` |
| AC11 | ✅ | `select_cash_closings` cuenta la ventana desde `(SELECT public.chile_today()) - 2`. Aplicada; el test SQL lo confirma |
| AC12 | ✅ | Job a las 00:00 y 01:00 UTC con `run_class_b_absences_cutoff()`, que exige hora Chile = 21; el test comprueba que cada día cae exactamente una corrida a las 21:00, en verano, en invierno y en los dos días de cambio de horario. "Una sola vez y con el día D" lo garantiza la función existente (solo toca `status = 'scheduled'` y compara por día de Chile). Aplicado. Sin observar todavía una corrida real: la primera es el 2026-10-09 a las 21:00 hora Chile |
| AC13 | ✅ | ARCH-27 y ARCH-28 en `npm run lint:arch`; el mensaje nombra la función a usar. Se agregó la regla `ms-day-diff` (contar días restando instantes) |
| AC14 | ✅ | Línea base en 0. Excepciones declaradas en `scripts/lib/date-discipline.allowlist.json` (5, cada una con su motivo) y el CHECK `students.chk_minimum_age` en la migración y en el test SQL |
| AC-E1 | ✅ | Vectores de los días de 23 y 25 horas de 2026 y 2027; test de contigüidad sobre 200 días seguidos, en la app y en Deno; `chile_day_start()` con la medianoche inexistente en el test SQL |
| AC-E2 | ✅ | Vectores `00:00:00.000` y `23:59:59.999`; rangos semiabiertos (`.gte` / `.lt`) en todos los facades y en las tres edge functions con rango |
| AC-E3 | ✅ | `chileYear()` y `chileMonth()` a las 23:30 del 31 de diciembre, en la app y en Deno. Folios y nombres de archivo de las edge functions usan `chileYear()`; desplegado |
| AC-E4 | ✅ | Una fecha pura no pasa por ninguna zona: tests de `formatChileDate`, `formatChilePattern`, `calcAge`, `resolveDocStatus`, `isoToCalendarDate` en las tres zonas |

## Excepciones declaradas

| Qué | Por qué |
|---|---|
| CHECK `students.chk_minimum_age` usa la fecha de la sesión | Un CHECK no debe depender de una función no inmutable; el desfase posible es de horas sobre 17 años |
| `_shared/enrollment-sheet-format.ts` y `_shared/ficha-tecnica-pdf.ts` no usan el módulo común | Ya fijan `America/Santiago`; arman el texto por partes por una limitación de la fuente del PDF y tienen tests propios |
| 10 funciones SQL con `AT TIME ZONE 'America/Santiago'` escrito a mano | Ya eran correctas; no se redefinieron para no tocar los RPC del dashboard ejecutivo sin necesidad |
| `ms-day-diff` en `admin-pre-inscritos.facade`, `task.utils`, `license-seniority.utils` | Duraciones reales entre instantes, o fechas puras restadas en UTC |
| `local-date-parts` en los dos componentes de Asistencia B | Es `facade.setDate(fechaIso)`, no `Date.setDate` |

## Observaciones pendientes (no bloquean)

1. Confirmar que el corte de inasistencias corrió a las 21:00 hora Chile: en
   `cron.job_run_details`, la corrida de las 00:00 UTC (horario de verano) debe haber ejecutado
   el corte y la de las 01:00 UTC no.
2. Generar un cierre de caja o un certificado entre las 21:00 y la medianoche y revisar que la
   fecha impresa y la guardada sean las del día de Chile.

El histórico con el día corrido no se corrige (decisión de Matías del 2026-10-08).
