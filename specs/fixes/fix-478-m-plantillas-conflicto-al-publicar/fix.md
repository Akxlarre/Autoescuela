# Fix: Publicar una plantilla avisa si otra persona la cambió mientras tanto
> id: fix-478-m-plantillas-conflicto-al-publicar
> refs: fix-447-m-testing-documentos-certificacion (Q03) · fix-469-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

`DocumentContentTemplatesFacade.publish()` hacía un UPSERT ciego sobre `document_templates`: si dos
admins editaban la misma sede y tipo, el segundo que publicaba pisaba al primero sin enterarse.
Decisión de Matías (2026-10-20): **avisar el conflicto y no pisar.**

## ACs Afectados

- AC propio — Si la plantilla cambió en la BD desde que se cargó, "Publicar" no escribe nada y
  muestra "Otra persona publicó esta plantilla mientras la editabas…". El borrador se conserva.
- AC propio — Si la plantilla no existía al cargar y otra persona la creó entre medio, mismo aviso.
- AC propio — Sin conflicto, publicar funciona igual que antes y una segunda publicación seguida
  (misma sesión) también.

## Cambio

- `DocumentContentTemplatesFacade`: `load()` guarda la versión (`updated_at`) publicada;
  `publish()` hace UPDATE condicionado a esa versión (0 filas = conflicto) o INSERT si no existía
  (`23505` = conflicto) y, si publica, guarda la versión nueva.

## Test de Regresión

- `document-content-templates.facade.spec.ts` — UPDATE con `eq('updated_at', versión)`; 0 filas →
  aviso y `false`, borrador intacto; sin fila → INSERT; INSERT con `23505` → aviso.

## Progreso

- [x] Tests rojos → verdes
- [x] Navegador: dos sesiones de admin, la segunda en publicar recibe el aviso

### Resultado (2026-10-20)

- Navegador contra la BD de dev (Autoescuela Chillán, Contrato Clase B): dos publicaciones seguidas
  del mismo contenido → "Plantilla publicada" ambas; tras simular otra publicación (solo
  `updated_at = now()` por SQL) → "Otra persona publicó esta plantilla", y la fila quedó intacta
  (mismo hash de `content` y mismo `updated_at`).
