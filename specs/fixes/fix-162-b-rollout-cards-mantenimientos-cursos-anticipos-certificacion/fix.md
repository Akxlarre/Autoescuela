# Fix: Rollout de cards a Mantenimientos, Cursos Singulares, Anticipos y Certificación
> id: fix-162-b-rollout-cards-mantenimientos-cursos-anticipos-certificacion
> refs: fix-158-b-rediseno-cards-alumnos, fix-159-b-rollout-cards-alumnos-profesional-y-ex-alumnos, fix-160-b-guardrail-colores-hardcodeados-y-card-adhoc, fix-161-b-rollout-cards-instructores-relatores-promociones-flota
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Root Cause
Últimos 5 archivos del inventario de ARCH-25 (composición ad-hoc de card) que quedaban del
rollout de fix-158-b/159-b/161-b. A diferencia de los anteriores, estos 5 **ya usan el
vocabulario tipográfico y de badges correcto por dentro** (`.item-title`, `.micro-label`,
`app-badge`) — lo único ad-hoc es el contenedor exterior:

```
rounded-xl border overflow-hidden border-border-muted bg-surface
```

en vez de `.card`. Por eso este fix NO extrae componentes nuevos a `shared/` (a diferencia
de fix-158-b/159-b/161-b): cada card es de uso único en su archivo, no está duplicada en
ningún otro lugar, y su contenido interno ya está bien — extraer un componente acá sería
abstracción sin motivo (no hay reuso que ganar). El cambio es literalmente la clase del
contenedor.

Dos excepciones menores encontradas al revisar:
- `vehicle-maintenances.component.ts` usa `p-tag` para el estado de la mantención en vez de
  `app-badge` — se unifica de paso, mismo criterio que los fixes anteriores.
- `admin-contabilidad-anticipos.component.ts` usa `badgeClass()` (clases `.badge-pending`/
  `.badge-discounted` ad-hoc) para el estado del anticipo — **se deja intacto**: el mismo
  método se usa también en la tabla desktop (fuera de este scope), tocarlo ahí sería
  scope creep hacia una superficie que este fix no declara.

## ACs Afectados
- Ninguno — mejora visual sobre UI ya en producción, misma data y acciones.

## Cambio
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
  — wrapper → `.card p-0 overflow-hidden` (header/body/footer ya tienen su propio padding).
  `p-tag` → `app-badge` para el estado de la mantención (`completed`→success, si no→warning).
- **Archivo:** `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts`
  — mismo wrapper → `.card p-0 overflow-hidden`. Ya usaba `app-badge`, sin cambios ahí.
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts`
  — dos cards: cuenta corriente (wrapper → `.card p-0 overflow-hidden`, ya usa `app-badge`)
  e historial de anticipos (wrapper de una sola sección → `.card`, sin `p-0` porque no tiene
  sub-secciones con padding propio). `badgeClass()` intacto (ver Root Cause).
- **Archivo:** `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts`
  — wrapper de una sola sección → `.card`. Ya usaba `app-badge` para Generado/Pendiente y curso.
- **Archivo:** `src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts`
  — mismo cambio que la de Clase B (estructura idéntica).

## Fuera de este fix (verificado, no requieren cambio)
- `servicios-especiales-content.component.ts` — ya usa `.card` + `app-badge`, no aparece en
  el inventario de ARCH-25.
- `instructor-alumnos.component.ts` — usa una clase propia `.student-card` con diseño premium
  (accent gradient, avatar-ring) que no dispara el guard (no compone `bg-*`+`border`+`rounded-*`
  literalmente en el mismo atributo `class`). Fuera de scope: no es composición ad-hoc en el
  sentido que ataca ARCH-25, es un diseño custom intencional.

## Test de Regresión
- Verificación visual manual en `localhost:4210` — **confirmado con datos reales** en
  Vehicle-Maintenances (registré una mantención de prueba: badge "Completado" unificado),
  Cursos Singulares (badges "Part." + "Activo"), Anticipos/Cuenta Corriente (badge "Al día"
  + "Teórico y Práctico"), Certificación Clase B (badges "Pendiente" + "Clase B"). Anticipos/
  Historial y Certificación Profesional no tenían datos de seed para poblar esa vista
  específica (0 registros / sin promoción finalizada) — mismo código exacto que sus pares ya
  verificados, sin lógica nueva, riesgo residual mínimo.
- `npm run lint:arch` → **exit 0**.
- **ARCH-25: 130 → 124** (60 → 55 archivos), exactamente lo previsto.
- `npm run test:ci` → **2333/2333 tests, 0 fallos**.
