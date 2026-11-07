# Hotfix: Eliminar una card sin confirmar y avisos de subida que parecen publicados
> id: hotfix-175-m-configuracion-web-eliminar-card-y-aviso-subida
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
- **L15 de `fix-485-m`:** "Eliminar" en una card de Cursos & Precios la borra al instante, sin
  confirmar. Un clic de más pierde descripción, duración y "qué incluye" de esa card.
- **J08:** al subir logo, favicon, imagen para redes o media del hero, el aviso dice "subido
  correctamente al storage". La imagen queda en el formulario, pero la web pública no cambia hasta
  presionar "Publicar Cambios"; el aviso hace creer que ya está en la web.

## Cambios
- **Archivo:** `features/admin/configuracion-web/tabs/cursos-tab.component.ts` — "Eliminar" pide
  confirmación (`ConfirmModalService`).
- **Archivos:** `tabs/general-tab.component.ts`, `tabs/hero-tab.component.ts` — los avisos de
  subida terminan con "Se verá en la web al presionar Publicar Cambios.".

## Verificación
- Navegador (2026-11-07, admin, sede 1): "Eliminar" en la card #1 abre "Eliminar card"; "Cancelar" deja las 2 cards.
- Los avisos de subida se revisaron en el código (subir un archivo real deja basura en el bucket). `ng build` OK.
