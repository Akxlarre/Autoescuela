# Fix: El consentimiento informativo no ofrece revocación
> id: fix-311-m-consentimiento-informativo-no-ofrece-revocacion
> refs: ASG-i-024, 0009-m
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
El panel "Consentimientos" de la ficha (`AdminConsentimientosDrawerComponent`) muestra "Registrar
revocación" en toda fila con estado "Otorgado", sin mirar de qué tipo es. El tipo
`comunicaciones_operativas` es informativo (Art. 13 c): no es una elección del alumno, su propia
etiqueta dice "(informativo, no revocable)" y el modelo lo documenta así, pero el botón aparece
igual y la revocación se puede registrar. Encontrado al ejecutar `024b` N04 en `fix-264-m`, con
el alumno de prueba de la matrícula 0082. Es B48.

## ACs Afectados
- `0009-m` AC6: la revocación se ofrece solo para los consentimientos que el alumno puede revocar.
  "Comunicaciones operativas" no la ofrece ni la registra.
- Los demás tipos siguen igual: admin ve el botón en las filas otorgadas; secretaria no lo ve.

## Cambio
- **Archivo:** `src/app/core/models/ui/consent.model.ts` — `NON_REVOCABLE_CONSENT_TYPES`, la lista
  de tipos informativos, junto a las etiquetas que ya los describen.
- **Archivo:**
  `src/app/features/admin/alumno-detalle/consentimientos-drawer/admin-consentimientos-drawer.component.ts`
  — el botón y `onRevoke()` consultan esa lista.

## Test de Regresión
- `admin-consentimientos-drawer.component.spec.ts > consentimiento informativo (fix-311-m)`
  (3 tests) ✓

## Verificación
2026-10-05: los 12 tests del componente pasan y `tsc` no da errores. En navegador, en la ficha del
alumno de la matrícula 0082: "Comunicaciones operativas" ya no muestra "Registrar revocación"
(antes sí); "Tratamiento de datos de matrícula" sigue mostrando su revocación registrada.
