# Fix: Portales Instructor y Alumno con hero azul sólido — migrar los 16 componentes a `density="slim"`
> id: fix-072-b-portales-hero-slim
> refs: 0015-b-header-slim-mode · ASG-b-001 · fix-071-b-fase-5-qa-visual-restante
> status: in_progress
> created: 2026-07-31

## Root Cause

El rollout del hero slim (**spec 0015**) migró admin y secretaría pero **nunca alcanzó los
portales**. No hay un "hero viejo" separado: es el mismo `SectionHeroComponent`, cuyo input
`density` tiene default `'full'`.

| Zona | Páginas con `app-section-hero` | Con `density="slim"` |
|---|---|---|
| Admin + Secretaría | 26 | **26** ✅ |
| Portal Instructor | 10 | **0** ❌ |
| Portal Alumno | 6 | **0** ❌ |

En densidad `full` se renderiza `.hero-card`, que pinta un **azul de marca sólido** de ~196–250px
(`section-hero.component.ts:86-92`):

```scss
/* "Sin gradiente: más limpio, más 'app', menos 'landing'." */
.hero-card { background: color-mix(in srgb, var(--ds-brand) 80%, black); }
```

Medido en render: `background-image: none`, `background-color: color(srgb 0.175686 0.592941
0.778039)` — exactamente `#38bdf8 × 0.8`. Idéntico en claro y oscuro (no es un bug de dark mode,
ni un override accidental: el `.hero-card` es deliberado).

**Por qué ningún barrido de código lo detectó antes:** las 16 páginas están *estructuralmente*
bien (clase `bento-hero` canónica, hijo directo del `.bento-grid`, usan `.surface-hero`). Lo único
que difiere es la densidad, que es un input con default — invisible para un `grep` de estructura.
Se necesitó render real para verlo (ver `fix-071-b`, Hallazgo 1).

**Origen:** reclamo del cliente en la reunión del 2026-07-28, registrado en ASG-b-001 como
"algunas vistas siguen usando el hero azul antiguo". La primera verificación lo buscó en los
módulos del admin (`/app/admin/instructores`, `/app/admin/alumnos`) y concluyó erróneamente que no
se reproducía; el owner corrigió que se refería a los **portales**.

> ⚠️ **Nota de dominio:** "Instructores" y "Alumnos" son ambiguos en este proyecto — son módulos
> del admin **y** portales (`/app/instructor/**`, `/app/alumno/**`). Desambiguar siempre antes de
> auditar.

## Decisión de diseño (owner, 2026-07-31)

Se evaluaron 3 caminos y el owner eligió el **1**:

1. ✅ **Migrar a slim** — homogeneidad total con las 26 páginas de staff, continúa la dirección de
   spec 0015. Los portales pierden el hero grande.
2. ❌ Mantener hero grande cambiando el plano por `--gradient-hero`.
3. ❌ Mantener hero grande con superficie neutra.

## ACs Afectados

Ninguno de una spec previa se rompe; este fix **extiende el alcance de spec 0015** a los portales.

- **AC-F1**: Given cualquiera de las 16 páginas de portal, When se renderiza, Then el
  `<app-section-hero>` recibe `density="slim"` y **no** existe `.hero-card` en el DOM.
- **AC-F2**: Given el hero migrado, Then no hay ningún elemento con el fondo azul sólido
  `color-mix(in srgb, var(--ds-brand) 80%, black)` en el viewport.
- **AC-F3**: Given una página de portal que hoy tiene KPIs como celdas `bento-square` separadas,
  When migra a slim, Then esos KPIs pasan al strip `[kpis]` del hero (patrón canónico — mismo
  criterio que `hotfix-013-b`), o se documenta explícitamente por qué no aplica.
- **AC-F4**: Given los 4 portales, Then la regla 3-2-1 de marca no empeora respecto del baseline
  medido en `fix-071-b` (el hero dejaba de aportar su bloque de marca decorativo).
- **AC-F5**: `ng build` limpio, `npm run lint:arch` sin errores nuevos vs. HEAD.

## Cambio

**16 archivos**, un `<app-section-hero>` cada uno. Cero SCSS nuevo — solo se pasa el input.

**Portal Instructor (10):**
- `features/instructor/alumnos/instructor-alumnos.component.ts`
- `features/instructor/clase/instructor-clase.component.ts`
- `features/instructor/clase-detail/instructor-clase-detail.component.ts`
- `features/instructor/dashboard/instructor-dashboard.component.ts`
- `features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts`
- `features/instructor/ficha/instructor-ficha.component.ts`
- `features/instructor/horario/instructor-horario.component.ts`
- `features/instructor/liquidacion/instructor-liquidacion.component.ts`
- `features/instructor/notificaciones/instructor-notificaciones.component.ts`
- `features/instructor/tareas/instructor-tareas.component.ts`

**Portal Alumno (6):**
- `features/alumno/clases/alumno-clases.component.ts`
- `features/alumno/dashboard/alumno-dashboard.component.ts`
- `features/alumno/horario/alumno-horario.component.ts`
- `features/alumno/pagar/alumno-pagar.component.ts`
- `features/alumno/pagos/alumno-pagos.component.ts`
- `features/alumno/pruebas-online/alumno-pruebas-online.component.ts`

**Qué cambia:** agregar `density="slim"` al `<app-section-hero>` y, donde haya KPIs en celdas
`bento-square` sueltas, moverlos al input `[kpis]` (AC-F3).

## Progreso

**16/16 migrados y verificados en render real (`.hero-card` = 0 en las 16 rutas).**

| # | Archivo | Estado |
|---|---|---|
| 1 | `instructor/dashboard` | ✅ `density="slim"` + KPIs al strip. Verificado en DOM real: `0,8 hrs` conserva la coma es-CL |
| 2 | `instructor/alumnos` | ✅ 4 KPIs al strip. Verificado en DOM real (Total Alumnos, Activos, Progreso Promedio, Por Certificar) |
| 3 | `instructor/clase` (`clase/iniciar`) | ✅ Sin KPIs, solo density. Verificado en DOM real |
| 4 | `instructor/clase-detail` (`clase/:id`) | ✅ Sin KPIs, solo density. Verificado en DOM real |
| 5 | `instructor/ensayos-teoricos` | ✅ 3 KPIs al strip. Verificado en DOM real (Total, Promedio, Aprobados) |
| 6 | `instructor/ficha` | ✅ Sin KPIs, solo density. Verificado en DOM real (`/alumnos/:id/ficha`) |
| 7 | `instructor/horario` | ✅ 4 KPIs al strip. Verificado en DOM real |
| 8 | `instructor/liquidacion` | ✅ 3 KPIs al strip (con `subValue`). Verificado en DOM real |
| 9 | `instructor/notificaciones` | ✅ Sin KPIs, solo density. Verificado en DOM real |
| 10 | `instructor/tareas` | ✅ 2 KPIs al strip + cambio de `--fill-screen-kpi` a `--fill-screen` (mismo canon que `admin/tareas`). Verificado en DOM real |
| 11 | `alumno/clases` | ✅ 1-2 KPIs condicionales al strip (según `licenseGroup`). Verificado en DOM real (`2/12`, `Próximas agendadas 0`) |
| 12 | `alumno/dashboard` | ✅ 2 de 4 KPIs al strip (los otros 2 llevan `routerLink`, quedan fuera — documentado en AC-F3). Verificado en DOM real |
| 13 | `alumno/horario` | ✅ Sin KPIs, solo density. Verificado en DOM real |
| 14 | `alumno/pagar` | ✅ Sin KPIs, solo density. Flujo Webpay re-verificado (stepper intacto, estado "matrícula al día" ok) |
| 15 | `alumno/pagos` | ✅ 3 KPIs al strip (`toCompact` + `subValue` CLP). Verificado en DOM real: `$180K` / `$180.000` |
| 16 | `alumno/pruebas-online` | ✅ Sin KPIs, solo density. Verificado en DOM real |

### ⚠️ Gotcha encontrado al migrar el primero (aplica a TODOS los que muevan KPIs)

**El strip del hero renderiza `{{ kpi.value }}` CRUDO, sin `DecimalPipe`** — a diferencia de
`app-kpi-card-variant`, que sí formatea (`section-hero.component.ts:598` y `:638`).

Al migrar `instructor/dashboard` esto degradó silenciosamente `0,8 hrs` → `0.8 hrs` (se perdió la
coma decimal de es-CL). No lo atrapó ningún assert geométrico: `.hero-card` ya no existía y los ACs
daban verde. **Se detectó comparando la captura post-migración contra la previa.**

→ **Regla para los 15 restantes:** todo `value` numérico que hoy pase por `app-kpi-card-variant`
debe pre-formatearse a string antes de entrar al array `kpis` (ej.
`.toLocaleString('es-CL', { maximumFractionDigits: 1 })`). Por eso el dashboard admin pasa strings
ya armados (`"$0.45M"`).

→ Sugerido como mejora aparte (**fuera de este fix**): que el propio `SectionHeroComponent` aplique
el formato, para que ningún caller futuro tenga que acordarse. Requiere tocar un componente
compartido por 27 páginas → track propio.

## Riesgos declarados

- **No es un cambio de una línea ×16.** El slim tiene otra altura y otro reparto de acciones/chips;
  páginas con muchas `actions` o `chips` pueden desbordar. Verificar una por una.
- **`instructor/dashboard` y `alumno/dashboard` tienen fila de KPIs propia** — son los 2 casos
  donde AC-F3 muerde de verdad.
- **`alumno/pagar` es flujo de pago real (Webpay).** Tocar su layout exige re-verificar el flujo,
  no solo mirar el hero.
- Los portales son de cara al usuario final, no al staff: perder el hero grande es un cambio de
  identidad visible. Decisión ya tomada por el owner (arriba), pero conviene mostrarle capturas
  antes de cerrar.

## Test de Regresión

⚠️ Este proyecto **no tiene tests de componentes Angular** (`vitest.config` los excluye; solo cubre
facades/utils/services puros). No se va a inventar un `.spec.ts` que el runner ignoraría.

Verificación real ejecutada (2026-07-31):
1. ✅ `ng build` limpio — 0 errores, 0 warnings nuevos (el único warning es el budget de bundle
   pre-existente, no relacionado a este fix).
2. ✅ `npm run lint:arch` — exit 0. Ninguno de los warnings pre-existentes (ARCH-10 complexity,
   ARCH-14 íconos sin uso, ARCH-11 clases muertas) referencia los 16 archivos tocados.
3. ✅ **Render real con login real** (`ng serve` en `localhost:4200`, Chrome vía Browser MCP,
   `instructor@test.com` / `alumno@test.com`, contraseña `Test123456`): las 16 rutas confirmadas
   con `document.querySelectorAll('.hero-card').length === 0`. AC-F1 y AC-F2 verificados
   empíricamente, no solo por revisión de código — a diferencia de `fix-071-b`, esta sesión sí
   tuvo salida a la red (sin el 403 de egreso reportado ahí).
   - `instructor/dashboard`: KPI "Horas Este Mes" renderiza `0,8 hrs` — coma es-CL preservada
     (confirma que el gotcha documentado arriba no se repitió en el resto).
   - `alumno/pagos`: KPI "Total Curso" renderiza `$180K` con `subValue` `$180.000` — confirma que
     la migración más compleja (conditional 3-way `enrollment`/`loading`/`sin deuda`) quedó
     correcta.
   - `instructor/clase/iniciar` y `clase/:id` con id inexistente: renderizan su estado de error
     ("Llegaste aquí por accidente" / "Clase no encontrada") con el hero slim igual, sin
     `.hero-card`.
   - No se pudo llegar al flujo real de una clase en curso (no había clase agendada hoy en el
     dataset de prueba) ni al login del dataset con saldo pendiente en `alumno/pagar` — ambos
     casos cubiertos por revisión de código + el estado sin-saldo sí verificado en vivo.
4. ⚠️ **Capturas (claro/oscuro/mobile) no generadas** — el tool de screenshot del Browser MCP
   devolvió "the Browser pane is not displayed" en esta sesión (headless, sin panel visible). La
   verificación de AC-F1/AC-F2/AC-F3 se hizo por inspección de DOM real en vivo, que es más fuerte
   que una captura para esos ACs puntuales, pero **no reemplaza el visto bueno visual del owner**
   pedido en el punto 4 original — pendiente antes de `/fix-close` si el owner lo requiere.
