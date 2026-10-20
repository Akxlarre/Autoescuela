# Fix: Si el DMS no carga, las listas lo dicen en vez de "Sin documentos aún"
> id: fix-473-m-dms-carga-fallida-sin-estado-vacio
> refs: fix-447-m-testing-documentos-certificacion (A07) · fix-455-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

fix-455-m agregó el toast "Error al cargar documentos" cuando falla la primera carga, pero las
listas siguen mostrando sus estados vacíos ("Sin documentos aún", "Sin documentos recientes",
"Sin instructores", "Sin documentos institucionales"). Verificado en navegador con
`v_dms_student_documents` y `students` cortados: el toast desaparece a los segundos y queda una
pantalla que dice que no hay documentos (caso A07: "no 'Sin documentos aún'").

## ACs Afectados

- AC propio (A07) — Si la primera carga del DMS falla, las 4 listas muestran "No se pudieron
  cargar los documentos" con el motivo y un botón "Reintentar", en vez de su estado vacío.
- AC propio — "Reintentar" vuelve a cargar con skeleton; si funciona, las listas vuelven.
- AC propio — Un refresco silencioso (SWR) que falla con datos ya cargados no cambia las listas.

## Cambio

- `DmsFacade`: signal `listsError` (solo la primera carga lo fija; una carga correcta lo limpia) y
  `reload()`.
- `DmsListContentComponent`: input `loadError`, output `retryRequested`; estado de error en las 4
  listas.
- `AdminDocumentosComponent` y `SecretariaDocumentosComponent`: conectan ambos.

## Test de Regresión

- `dms.facade.spec.ts` — primera carga fallida → `listsError`; `reload()` correcto lo limpia;
  refresco silencioso fallido no lo fija.

## Progreso

- [x] Tests rojos → verdes
- [x] `/verify` con la red cortada (A07)
