# Hotfix: "Publicar en producción" falla con exit 141 si hay más de 60 commits sin publicar
> id: hotfix-108-b-publicar-produccion-sigpipe
> status: done
> closed: 2026-10-29
> created: 2026-10-28

## Problema
El paso *Calcular versión* arma el resumen del run con `git log ... "$LAST..HEAD" | head -60` bajo
`set -euo pipefail`. Con más de 60 commits desde el último Release, `head` cierra el pipe, `git log`
muere por SIGPIPE y `pipefail` tumba el paso con exit 141 (run 40797007191: 352 commits desde
`v0.2.1`). Nunca había aparecido porque las publicaciones anteriores tenían menos de 60 commits.

## Cambios
- **Archivo:** `.github/workflows/publicar-produccion.yml` — `git log -n 60 ...` en vez de
  `git log ... | head -60`: el límite lo aplica `git log` y no hay pipe que cortar.

## Verificación
- Reproducción local del bug y del fix con `bash -c 'set -o pipefail; ...'` sobre `v0.2.1..origin/main`.
- Lanzar "Publicar en producción" desde `main` tras mergear.
