# Fix: los buscadores de las listas no muestran cuándo tienen el foco
> id: fix-358-m-los-buscadores-de-las-listas-muestran-el-foco
> refs: fix-319-m-testing-clase-profesional-piloto (U08) · ASG-i-025
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
El campo "Buscar…" de las listas está escrito a mano en 10 pantallas con la misma cadena de
utilities, que incluye `outline-none` y ningún estilo de foco: al llegar con Tab (o al hacer clic)
el campo no cambia en nada. Los campos de formulario sí lo muestran (`.field-input:focus`, borde y
halo de marca); el buscador de las listas nunca recibió un equivalente.

Visto el 2026-10-07 en Promociones (bloque 5 de `fix-319-m`); la misma cadena está en la Base B, la
Base Profesional, Promociones, Relatores, Certificación B y Profesional, Ex-Alumnos B y
Profesional, Pre-inscritos y los comentarios de Ex-Alumnos.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- `src/styles/components/_form-fields.scss` — clase `.list-search-input`: solo el estado de foco
  (borde y halo de marca, iguales a `.field-input:focus`). No cambia tamaño ni colores en reposo.
- Los 10 buscadores reciben la clase (el resto de sus utilities queda igual).
- `indices/STYLES.md` — se documenta la clase.

## Test de Regresión
Navegador: en Promociones y en la Base Profesional, el buscador con foco cambia el color del borde
y muestra el halo; sin foco, sus estilos calculados son los mismos que antes.

## Progreso
- [x] Clase en el design system (`input.list-search-input:focus`; con el selector de solo clase el
  halo aparecía pero se quiso asegurar el borde frente a la utility del borde).
- [x] Aplicada a los 10 buscadores (10 archivos). `tsc` sin errores, `lint:arch` 0 errores,
  unitarios 3473 en verde.
- [x] Revisión en navegador (admin, 1440 px): en Promociones, con foco, el buscador muestra borde
  y halo de marca (captura); en la Base Profesional y la Base B el halo calculado es el mismo. En
  reposo, borde, sombra y alto (36 px) iguales a antes. Las otras 7 pantallas usan la misma clase
  y no se revisaron una por una (varias están bloqueadas en el piloto).
