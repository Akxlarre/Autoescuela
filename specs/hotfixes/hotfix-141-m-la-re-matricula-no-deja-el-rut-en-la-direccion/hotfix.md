# Hotfix: La re-matrícula no deja el RUT en la dirección
> id: hotfix-141-m-la-re-matricula-no-deja-el-rut-en-la-direccion
> refs: ASG-i-024, fix-020
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Problema
"Re-matricular" (en las cuatro pantallas de Ex-Alumnos) le pasa el RUT del egresado al wizard de
matrícula agregando `?rut=…` a la dirección de la página, y después abre el wizard como panel.
Cuando el panel se cierra, terminado o cancelado, nadie quita ese parámetro: la dirección de
Ex-Alumnos queda con el RUT de un alumno, y si se recarga o se comparte esa dirección el RUT viaja
con ella. Visto al ejecutar `024b` W08 en `fix-264-m`.

## Cambios
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` — al
  cerrarse, el wizard abierto como panel quita de la dirección el `rut` que usó para precargar.
  Un solo lugar para las cuatro pantallas. Como página propia (`/app/<rol>/matricula?rut=…`) no
  toca nada.

## Verificación
- `secretaria-matricula.component.spec.ts > RUT de la re-matrícula en la dirección (hotfix-141-m)`
  (3 tests) ✓
- `e2e/alumnos-b-ficha.spec.ts > W05` ✓: con el wizard abierto la dirección lleva `rut`; tras
  cerrarlo queda en `/app/admin/ex-alumnos`, sin parámetros.

El RUT se anota al abrirse el wizard y no al precargar el Paso 1: en la primera versión W05 seguía
fallando porque en esa sede el wizard abre en la lista de borradores y se cerraba sin haber
precargado nada.

2026-10-05: 21 tests del componente en verde; en navegador pasan W01 · W02, W03 · W04, W05, O02,
O03 (parcial) y O04.
