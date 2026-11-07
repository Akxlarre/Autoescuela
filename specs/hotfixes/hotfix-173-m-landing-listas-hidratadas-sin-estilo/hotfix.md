# Hotfix: Las listas que arma la hidratación de la landing pierden su estilo
> id: hotfix-173-m-landing-listas-hidratadas-sin-estilo
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
Visto en el testing de la landing (`fix-485-m`, Q06/Q07): en "Qué incluye" de cada card el ✓
queda en una línea y el texto en la siguiente. La hidratación (`LandingLayout.astro`) vacía y
vuelve a armar tres listas en cada carga — "Qué incluye", horarios y redes sociales — con
`createElement`. Los estilos de esos componentes son *scoped* de Astro: solo aplican a elementos
con el atributo `data-astro-cid-*`, que los nodos creados a mano no tienen. Resultado: los ítems
quedan sin el `display: flex` / colores / espaciado de su sección.

## Cambios
- **Archivo:** `webs/src/layouts/LandingLayout.astro` — helper `adoptScope(container, node)` que
  copia los `data-astro-cid-*` del contenedor al nodo creado y a sus hijos; se usa en las tres
  listas.

## Verificación
- Navegador (2026-11-07, sitio compilado con `astro build` + `astro preview`): los ítems de "Qué incluye" y de horarios quedan con `display: flex` y el color de su sección, las redes con el estilo de `.social-links`; el ✓ y el texto en la misma línea (captura `c485-22-incluye.png`). Consola sin errores.
