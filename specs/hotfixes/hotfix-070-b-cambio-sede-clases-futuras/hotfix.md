# Hotfix: Cambiar de sede a un instructor no avisa de sus clases ya agendadas
> id: hotfix-070-b-cambio-sede-clases-futuras
> refs: ASG-i-034 (caso E13, §5) — decisión del owner 2026-10-07: avisar, igual que al desactivar (fix-205-b)
> status: closed
> created: 2026-10-07

## Problema
En Editar instructor el admin puede cambiar la sede (o quitarle "Ambas"). Las clases ya agendadas no
se mueven: quedan en la sede anterior con un instructor que ya no es de esa sede, y nadie lo avisa.

## Cambios
- **Archivo:** `src/app/core/utils/instructor-deactivation.utils.ts` (+ spec) —
  `instructorBranchChangeNotice(futureClasses, scopeChanged, nowBothBranches)`: aviso solo si cambió
  la sede, el instructor no quedó en "Ambas" (si queda en "Ambas" sigue cubriendo la sede anterior)
  y tiene clases futuras.
- **Archivo:** `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts` —
  aviso bajo el selector de sede, con el conteo que ya carga fix-205-b. No bloquea.

## Verificación
- vitest de la util; `ng build`, `lint:arch`; e2e sin guardar (Instructor1, con clases futuras).

## Resultado (2026-10-07)
- util 6/6 (rojo → verde), `ng build` OK, `lint:arch` 0 errores (182).
- `e2e/instructores-cambio-sede.spec.ts` (sin guardar): Instructor1 sin cambios → sin aviso; sede 1 → Conductores Chillán → "Tiene N clases agendadas a futuro…"; marcar "Ambas" → el aviso desaparece. 1/1.
