# Hotfix: historial de comunicados que no recarga, filas que parecen clicables y compositor sin la sede elegida
> id: hotfix-106-b-historial-y-compositor-de-comunicados
> refs: ASG-i-035 (checklist 035, S18 · S19 · N02, N05, J14)
> status: done
> created: 2026-10-20

## Problema
Confirmado en el código:
- **S18 (N02):** cada fila del historial de comunicados tenía cursor de mano, `role="button"`,
  `tabindex` y emitía `announcementClicked`, pero nadie escuchaba ese evento: parecía abrir algo y no
  pasaba nada.
- **S18 (N05):** al cambiar de sede, el admin recargaba solo las tareas; con la pestaña "Comunicados a
  alumnos" abierta, el historial seguía mostrando la sede anterior.
- **S19 (J14):** el compositor del admin arrancaba en "Todas las sedes" aunque tuviera una sede
  elegida arriba. (La otra mitad de S19, volver a "Todas", ya la resolvió la spec 0022-m.)

## Cambios
- **Archivo:** `src/app/shared/components/announcements-content/announcements-content.component.ts`:
  las filas dejan de presentarse como clicables (sin cursor, rol, `tabindex` ni el output sin uso).
  Un detalle por comunicado sería una funcionalidad nueva, no un arreglo.
- **Archivo:** `src/app/features/admin/tareas/admin-tareas.component.ts`: el `effect` de sede también
  recarga el historial si la pestaña de comunicados está abierta.
- **Archivo:** `src/app/features/comunicados/announcement-composer-drawer.component.ts`: el admin
  arranca con la sede elegida arriba.

## Verificación
- [x] `tsc` sin errores; `lint:arch` sin errores.
- [x] e2e `comunicacion-comunicados.spec.ts` (10/10): compositor del admin con sede elegida arranca en esa sede.
