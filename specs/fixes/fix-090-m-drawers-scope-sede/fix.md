# Fix: Drawers muestran datos de todas las sedes en vez de una

> id: fix-090-m-drawers-scope-sede
> refs: ASG-b-043
> status: open
> created: 2026-07-30

## Root Cause

[Heredado de ASG-b-043, a confirmar]: Anotación de la reunión con el cliente (2026-07-28):
"Corrección Drawers respecto a la información que muestran de las sedes." Aclarado con el
owner: los drawers muestran datos de todas las sedes cuando deberían mostrar los de una sola.

Qué drawers exactamente están afectados es parte del entregable — hay que auditar los
drawers de la app y determinar cuáles no están respetando el scope de sede. Sospecha
principal (sin confirmar): un Facade Branch-Scoped resuelve `selectedBranchId() === null`
para una secretaria (que no debería tener ese caso) o para un drawer abierto en un contexto
donde correspondía filtrar, y por la regla `null` = "Admin ve todas" termina sin filtro.

El patrón canónico ya existe (`.claude/rules/facades.md` § "Facades Multi-Sede") y ya se
aplicó una vez en fix-027 (Base Alumnos B e Instructores, vía `resolveBranchScope()` /
`getActiveBranchId()`) — reusar ese helper, no escribir uno nuevo. Ojo con la regresión
inversa: fix-002-b fue filtrar de más y hacer desaparecer instructores que sí correspondía
mostrar.

## ACs Afectados

- Por definir tras la auditoría (pendiente completar este fix.md con el alcance real).

## Cambio

- Pendiente — completar tras auditar todos los drawers de la app en los dos escenarios:
  secretaria, y admin con sede seleccionada.

## Test de Regresión

- Pendiente.
