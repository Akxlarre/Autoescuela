# Fix: Testing — Tareas/observaciones, notificaciones y comunicados
> id: fix-230-b-testing-tareas-notificaciones-comunicados
> refs: ASG-i-035
> status: in_progress
> created: 2026-10-20

## Root Cause
[Heredado de ASG-i-035, a confirmar]: todo lo que comunica al equipo o al alumno — tareas/observaciones
internas, notificaciones en tiempo real (disparadas por triggers SQL y facades) y comunicados masivos a
alumnos por email e in-app con consentimiento (Ley 21.719). Depende de Realtime, que ya falló 2 veces en
silencio porque las tablas no estaban publicadas (`fix-031-i`, `fix-227-m`).

Track de **testing**: se ejecuta el checklist `specs/testing-piloto/035-tareas-notificaciones-comunicados.md`
y se recorre `indices/NOTIFICATIONS-MAP.md` completo. Regla de la tanda: **cada bug encontrado va a su
propio fix/hotfix**; acá solo se registra el resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-035). Criterios propios:

- **T1:** las sospechas del checklist quedan confirmadas (con su track), descartadas o como decisión.
- **T2:** ninguna prueba envía correos reales ni deja datos: lo que escribe usa alumnos E2E- (los limpia
  el harness) o cuentas de prueba restauradas al final; los envíos de correo se interceptan.
- **T3:** los casos automatizables quedan en `e2e/`.

## Cambio
- `e2e/*.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- Los tests nuevos de este track, contra `localhost:4200`.

## Primera tanda — tareas (2026-10-20)

`e2e/comunicacion-tareas.spec.ts`: **8/8 en verde** después de los fixes. Crea tareas E2E- entre
las cuentas de prueba y al final borra tareas, respuestas y notificaciones generadas. Las tareas
eliminadas desde la app quedan con `deleted_at` (la RLS no deja borrarlas por API) y se anotan para
limpieza manual.

| Casos | Resultado |
|---|---|
| B01, E01, F01, I01, D01–D03, E02, I03 | ✅ admin → tarea a secretaria: le llega en vivo (lista + campana +1 + "Nueva tarea: <asunto>"); el emisor no ve Iniciar/Completar; la secretaria la inicia y completa; el admin lo ve sin recargar y recibe "Tarea completada" (ella no) |
| **B12, D17 (S9)** | ❌ → `hotfix-100-b` (#328): "hoy" se guardaba como medianoche UTC → "Vence <ayer>" y "Vencida" desde que se creaba. Ahora 23:59 de Chile |
| **C03 (S10)** | ❌ → `hotfix-100-b` (#328): una completada con fecha pasada seguía "Vencida" |
| **C06 (S8)** | ❌ → `hotfix-101-b` (#329): el admin con sede A no veía lo que le mandaba la secretaria de B |
| **D04 (S11)** | ❌ → `fix-231-b` (#331): abrir una observación la completaba y avisaba "Tarea completada". Ahora queda "Vista" y avisa "Observación vista" (decisión del owner) |
| **D05, D06, I02 (S23, nuevo)** | ❌ → `hotfix-102-b` (#330): la secretaria no veía en ninguna pestaña lo que le mandaba al admin (no podía leer la respuesta ni cerrar la consulta). Pestaña "Enviadas" (decisión del owner). Tras el fix: la respuesta la pasa a "En curso" y avisa "Nueva respuesta · Respondieron en: <asunto>"; cerrada queda en solo lectura |
| **D13, E04 (S14)** | ❌ → `hotfix-104-b` (#333): la tarea eliminada seguía del lado del destinatario. Ahora desaparece en vivo (broadcast) |
| **G07 (S16)** | ❌ → `hotfix-103-b` (#332): `/notificaciones` de admin y secretaria eran una maqueta "PLANO". Redirigen al inicio (decisión del owner) |
| B02 | ✅ la observación no guarda fecha límite |

## Segunda tanda — campana, panel e historial (2026-10-20)

`e2e/comunicacion-notificaciones.spec.ts`: **6/6 en verde** después del fix. Siembra notificaciones
E2E- para `secretaria@test.com` y las borra al terminar; "Eliminar todas" restaura en `finally` las
que la cuenta tenía activas (verificado: 9 activas / 1 eliminada antes y después). Efecto que queda:
"Marcar todo como leído" deja leídas las notificaciones reales de esa cuenta de prueba.

| Casos | Resultado |
|---|---|
| F01, F02, F03, H02 | ✅ llega en vivo (badge +1 y toast), aparece primera en el panel; al hacer clic queda leída y navega a `/app/secretaria/observaciones` |
| F05 | ✅ 3 no leídas del mismo tipo el mismo día → "3 certificados listos"; se expande con las 3; "marcar grupo leído" baja el badge en 3 |
| F04 | ✅ "Marcar todo como leído" → badge 0 y persiste al recargar |
| **G05, G04 (S17)** | ❌ → `hotfix-105-b` (#335): con el historial abierto, "marcar todo como leído" no lo actualizaba y una notificación nueva no aparecía. Corregido |
| F07, F09, F10, G01 | ✅ eliminar una → no vuelve al recargar; "Eliminar todas" con confirmación → panel vacío con "Ver todas"; en el historial siguen las dos |
| F15 | ✅ cerrar sesión y entrar con otra cuenta en el mismo navegador: no se ven las notificaciones de la anterior |

S17, resto: el badge cuenta sobre las últimas 50 y el historial trae 200 (límite aceptable para el
piloto); el historial no distingue eliminadas ni navega al clic **por diseño** (decisión del owner
2026-09-04). S15: la pre-inscripción ya no navega a una ruta bloqueada desde `fix-328-m`; los tipos
sin ruta solo cierran el panel (H06/H07, por diseño). H03: "Nueva matrícula" usa el `studentId`, la
ruta correcta de la ficha.
