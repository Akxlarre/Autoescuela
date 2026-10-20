# Hotfix: Documentos y Certificados de la secretaria recargan al cambiar de sede
> id: hotfix-161-m-secretaria-multisede-recarga-documentos-y-certificados
> refs: fix-447-m-testing-documentos-certificacion (S25) · fix-195-b · fix-288-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
Una secretaria con acceso a ambas sedes tiene selector de sede, y los facades ya filtran por él
(`resolveBranchScope` con `canAccessBothBranches`). Pero `secretaria-documentos`,
`secretaria-certificados` y `secretaria-profesional-certificados` cargaban una sola vez en
`ngOnInit`: al cambiar de sede seguían mostrando la anterior. Las páginas del admin ya recargan con
un `effect()` sobre `selectedBranchId()`.

## Cambios
- **Archivo:** `src/app/features/secretaria/documentos/secretaria-documentos.component.ts` —
  `effect()` sobre `selectedBranchId()` que llama `initialize()` (igual que `AdminDocumentosComponent`).
- **Archivo:** `src/app/features/secretaria/certificados/secretaria-certificados.component.ts` —
  `initialize()` la primera vez y `reload()` cuando cambia la sede (igual que `AdminCertificacionComponent`).
- **Archivo:** `src/app/features/secretaria/profesional-certificados/secretaria-profesional-certificados.component.ts` —
  ídem (igual que `AdminProfesionalCertificadosComponent`).
