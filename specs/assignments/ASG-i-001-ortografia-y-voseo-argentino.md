# Asignación ASG-i-001 — Revisar ortografía y voseo argentino

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-08-20
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-08-25
> **resulting_track:** fix-215-m-ortografia-voseo-app

---

## Contexto / Objetivo

Revisar toda la ortografía del proyecto (textos en UI, mensajes, labels) y **eliminar** el voseo
argentino residual (vos/tenés/podés/hacé) que haya quedado mezclado con el tuteo (tú/tienes/
puedes/haz), que es la convención real y correcta del proyecto en todos los textos visibles de
la aplicación.

> ⚠️ **Corrección (2026-08-25):** la redacción original de esta sección decía "verificar el uso
> correcto del voseo argentino... en vez de tú/tienes/puedes", lo cual sugería —al leerlo
> literal— que el voseo era la forma a imponer. Es lo opuesto: el precedente `ASG-b-021` /
> `fix-002-i-voseo-configuracion-web` corrigió voseo → tuteo, no al revés, y el dueño de negocio
> confirmó esa dirección al reclamarse esta asignación como `fix-215-m-ortografia-voseo-app`.

## Alcance sugerido

- Recorrer templates (`.html`), mensajes de toasts/notificaciones y labels de formularios en
  busca de errores ortográficos.
- Detectar y corregir formas de voseo argentino (vos/tenés/podés/hacé) que hayan quedado
  mezcladas, reemplazándolas por tuteo (tú/tienes/puedes/haz).
- Ya existe precedente relacionado: `ASG-b-021-fix-h006-voseo-config-web.md` — revisar ese
  fix antes de arrancar para no duplicar criterio ni retrabajar lo ya corregido ahí.

## Referencias

- `ASG-b-021-fix-h006-voseo-config-web.md` (fix previo de voseo en Configuración Web)

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado

## Notas para quien la reclame

- ...
