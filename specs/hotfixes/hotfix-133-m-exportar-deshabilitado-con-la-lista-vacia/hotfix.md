# Hotfix: "Exportar" de la Base de Alumnos B se deshabilita con la lista vacía
> id: hotfix-133-m-exportar-deshabilitado-con-la-lista-vacia
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Problema
En la Base de Alumnos B el botón "Exportar" sigue habilitado cuando la lista no tiene filas y
descarga un Excel vacío. Ex-Alumnos B y las dos listas profesionales ya lo deshabilitan. Es B24 de
la 2ª pasada de `fix-264-m`.

## Cambios
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` —
  pasa `[disabled]="sortedAlumnos().length === 0"` a `app-export-menu`, igual que las otras listas.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test de B24 pierde la marca `knownBug`.
