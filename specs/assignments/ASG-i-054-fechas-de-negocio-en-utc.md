# Asignación ASG-i-054 — Fechas de negocio calculadas en UTC (lo hecho de noche cae al día siguiente)

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-10-08
> **resulting_track:** 0024-m-fechas-de-negocio-en-hora-de-chile

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). En ~19 lugares la fecha de
negocio se calcula con `new Date().toISOString().slice(0, 10)` o equivalentes, que devuelven la
fecha **UTC**. En Chile (UTC-3/-4), todo lo que se hace desde ~20:00–21:00 queda registrado o
filtrado con la fecha del día siguiente: pagos, ventas, anticipos, egresos, "Clases hoy",
fecha de ingreso de la matrícula, nombres de archivos exportados. Resultado: la Caja de hoy no
muestra lo cobrado esa noche, reportes que no cuadran por día y KPIs corridos.

El inventario completo (archivo:línea y qué fecha de negocio afecta) está en
`specs/testing-piloto/037-transversal-multisede-shell.md` §1.

## Alcance sugerido

- **Paso 1, confirmar**: registrar un pago de prueba después de las 21:00 hora Chile y revisar
  en qué día aparece en Caja y Reportes.
- Crear una util única de "fecha de hoy en Chile" / conversión a fecha local (revisar si ya existe
  algo en `core/utils/date.utils.ts`; el dashboard ejecutivo ya recibe `today` en hora de Chile) y
  reemplazar cada ocurrencia del inventario.
- Revisar también las edge functions y los cron (hora de corte del `no_show`).
- Tests con fechas fijas a las 22:00 y 23:59 hora Chile, incluido el cambio de horario.

## Referencias

- `specs/testing-piloto/037-transversal-multisede-shell.md` §1 (inventario de fechas UTC)
- `024a` S9 · `028` S4 · `029` · `030` · `031` (casos puntuales)

## Archivos involucrados (opcional, para detectar solapes)

- Ver el inventario; toca muchos facades y componentes.

## Notas para quien la reclame

- Tamaño spec por la cantidad de archivos; conviene la util primero y después reemplazar por tandas.
- **Nota de b (2026-10-06, fix-190-b / ASG-i-037): el "Paso 1, confirmar" ya está hecho.** Se
  confirmó en vivo contra el build de producción, sin escribir datos: con `timezoneId:
  America/Santiago` y el reloj del navegador fijado al 6-oct, "Registrar anticipo" propone
  **06/10/2026 a las 15:00** (control) y **07/10/2026 a las 23:30** (bug). El test ya existe:
  `e2e/transversal-shell.spec.ts`, casos `T02` (rama `fix/190-b-testing-transversal`); el de las
  23:30 está marcado `knownBug('ASG-i-054 …')`. Al terminar el fix, quitar esa marca y correr
  `npx playwright test e2e/transversal-shell.spec.ts -g T02` contra el build de producción: los
  dos deben pasar. El inventario de §1.8 del checklist 037 sigue vigente (grep de
  `toISOString().slice/split` en `src/app`: ~40 ocurrencias el 2026-10-06).
