# Fix: "Actividad reciente" descarta el detalle real en DELETE y usa título genérico "Registro"
> id: fix-105-m-actividad-reciente-eliminados-genericos
> refs: fix-102-m-auditoria-diccionario-columnas-completo
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

`DashboardFacade.mapAuditLogToActivity()` (`src/app/core/facades/dashboard.facade.ts:465-470`)
para `action === 'DELETE'` **descarta `log.detail`** (que `log_change()` ya llena con
`'Eliminado: ' || v_entity_label`, ej. `"Eliminado: Juan Perez - Clase Profesional A2
($800.000)"`) y lo reemplaza por un mensaje genérico:

```ts
} else if (log.action === 'DELETE') {
  title = `${entityLabel} eliminad${artO}`;
  desc = `Eliminad${artO} por ${userName}`;   // ← ignora log.detail por completo
  ...
}
```

Esto produce exactamente lo reportado: "Registro eliminado / Eliminado por Sistema /
Online" — no dice QUÉ se eliminó, solo que algo se eliminó y quién (o "Sistema / Online" si
la atribución también falló, ver fix-103-m). El caso UPDATE de la misma función sí usa
`log.detail` (limpiando el prefijo `[Entidad]`); DELETE es la única rama que lo tira.

Además, el diccionario `entityNames` de esa misma función (líneas 422-432) solo cubre 9 de
las ~23 tablas auditadas (`enrollments`, `payments`, `users`, `students`, `class_b_sessions`,
`vehicles`, `professional_pre_registrations`, `standalone_course_enrollments`,
`special_service_sales`) — el mismo patrón de "cobertura parcial hardcodeada" que
`DG-041`/`DG-044` documentaron para el backend, mismo problema en el frontend. Cualquier
DELETE/INSERT/UPDATE sobre `student_documents`, `certificates`, `vehicle_documents`,
`maintenance_records`, `class_b_theory_sessions`, `promotion_courses`, `class_book`,
`professional_theory_sessions`, `professional_practice_sessions`,
`professional_module_grades` o `website_config` cae al fallback genérico `'Registro'` —
coincide con las capturas del dueño ("Registro eliminado").

## ACs Afectados
- Ninguno — fix autónomo (reportado por el dueño viendo capturas de "Actividad reciente").

## Cambio
- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
- **Qué cambia:**
  1. Rama `DELETE` de `mapAuditLogToActivity()`: usa `log.detail` (quitando el prefijo
     `"Eliminado: "`) para armar la descripción — `"{userName} eliminó: {label}"` — en vez
     de descartarlo. Si `log.detail` viene vacío, conserva el mensaje genérico como fallback.
  2. `entityNames`: se completa con las 11 tablas que faltaban, alineado con las ramas de
     `entity_label` que ya existen en `log_change()` (`student_documents`, `certificates`,
     `vehicle_documents`, `maintenance_records`, `class_b_theory_sessions`,
     `promotion_courses`, `class_book`, `professional_theory_sessions`,
     `professional_practice_sessions`, `professional_module_grades`, `website_config`).
- **Test:** `src/app/core/facades/dashboard.facade.spec.ts` — nuevo `describe('fetchActivityHistory')`
  con casos para DELETE (detalle visible, no genérico) y una tabla antes ausente del
  diccionario (título ya no cae a "Registro").

## Test de Regresión — VERIFICADO 2026-08-02
`npx vitest run src/app/core/facades/dashboard.facade.spec.ts` → **11/11 tests pasan**
(8 preexistentes + 3 nuevos de `fetchActivityHistory (fix-105-m)`):
- `DELETE conserva el detalle real en vez de un mensaje genérico` ✓
- `DELETE sin detalle cae al mensaje genérico como fallback` ✓
- `usa el nombre de entidad correcto para tablas antes ausentes del diccionario` ✓

`npm run lint:arch` sin advertencias nuevas.
