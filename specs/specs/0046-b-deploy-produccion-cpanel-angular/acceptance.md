# Acceptance 0046-b — Despliegue a producción de la app Angular en cPanel (GitHub Actions + FTPS)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-10-01
> **Verifier:** Claude, con aprobaciones reales del owner (`Akxlarre`) en cada deploy

---

## Resumen

- ACs totales: **18** (11 + 7 edge cases)
- ACs cumplidos: **18**
- **Todo verificado contra el pipeline y el servidor reales**: GitHub Actions + environment
  `Production` + cPanel en `https://app.autoescuelachillan.cl`. No hubo mocks.
- La lógica de borrado (`scripts/lib/deploy-manifest.js`) también tiene micro-suite: 17 casos, que
  corren en cada build.

**Veredicto final:** ✅ **PASA**, con una configuración pendiente del owner que no bloquea: la
regla de tag `v*` en el environment (ver "Pendientes").

---

## Método y límites

- Las respuestas HTTP se verificaron con `fetch` desde el navegador integrado sobre el dominio
  real, porque el `bash-guard` del proyecto bloquea `curl`. Para los redirects (AC7) se abrió la
  URL `http://` y se observó la URL final.
- Durante la verificación se publicaron 7 versiones reales: `v0.1.0`, `v0.1.4`, `v0.1.5` y
  `v0.1.6`, más un rollback. `v0.1.1`/`v0.1.2` (frenados por el gate) y `v0.0.0-ace5` (prueba de
  AC-E5) se borraron. `v0.1.3` se rechazó a propósito.
- Producción queda en **`v0.1.5`**, restaurado por el rollback. Tiene el mismo código que `v0.1.6`.

---

## Verificación por AC

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| **AC1** Build y gate | ✅ | Run 36656473137 (`v0.1.0`): test:ci 208 files (85 s), lint:arch, micro-suite, build. El gate también **frenó de verdad** `v0.1.1`/`v0.1.2` (runs 36898512185 / 36898511692) por un test que dependía de la fecha, sin pedir aprobación. |
| **AC2** Aprobación | ✅ | Todo deploy quedó en `waiting` en `Production` hasta la aprobación de `Akxlarre` (`/actions/runs/{id}/approvals`). |
| **AC3** FTPS | ✅ | `lftp` con `ftp:ssl-force`, `ssl-protect-data` y `ssl:verify-certificate yes`. El 1er intento **rechazó** el certificado por el nombre del host; se corrigió `FTP_SERVER` al hostname del certificado (`rs7-va.serverhostgroup.com`, misma IP), sin desactivar la verificación. Credenciales solo en secrets del environment. |
| **AC4** Orden de subida | ✅ | Script generado (simulado en local y ejecutado en CI): `mirror` sin `--delete` → `put version.json` → `put index.html` → `rm` → manifiesto. Log del run: 541 "Transferring file" en el mirror. |
| **AC5** Fallback SPA | ✅ | `GET /app/admin/dashboard` → 200, `text/html`, contiene `<app-root`. |
| **AC6** Caché | ✅ | `index.html` y `version.json` → `no-cache`; `main-*.js` y `styles-*.css` → `public, max-age=31536000, immutable`. |
| **AC7** HTTPS | ✅ | `http://app…/login` → URL final `https://app…/login`. |
| **AC8** version.json | ✅ | `{tag, sha, builtAt, run}` coincide con cada run (ej. `v0.1.0` → `75ea92e2`). |
| **AC9** Rollback sin recompilar | ✅ | Dispatch `v0.1.5` (run 36902496717): `npm ci`, tests, lint y build en `skipped`; "Descargar el build publicado del tag" OK; preparación en **9 s**. Tras aprobar, `version.json` = `v0.1.5` con `builtAt 17:41:52` y `run 36900937462`, **los del build original**. El diseño anterior (recompilar) falló: ver D6. |
| **AC10** Dominio desacoplado | ✅ | `grep autoescuelachillan` en el workflow y en `public/.htaccess` → 0. El dominio vive solo en `vars.APP_DOMAIN`. |
| **AC11** Release por versión | ✅ | Release `v0.1.5` (y `v0.1.6`) con `site.zip` (3,8 MB, incluye `.htaccess`). El rollback y el deploy rechazado no crearon Release. |
| **AC-E1** Un deploy a la vez | ✅ (reescrito, D7) | `v0.1.3`/`v0.1.4` pusheados juntos: uno quedó `waiting` y el otro `pending` en cola, nunca en paralelo. GitHub no cancela el que espera, así que el aprobador rechaza el que sobra (`v0.1.3` rechazado). |
| **AC-E2** Sin configuración | ✅ | Run 36656473137, 1er intento: "Falta configurar en el environment Production: …. No se subió nada." Falló antes de instalar `lftp`. |
| **AC-E3** Limpieza | ✅ | 2º deploy (`v0.1.4`): 0 a borrar (gracia) y `main-LL72IEMR.js` de `v0.1.0` seguía en 200. 3er deploy (`v0.1.5`): "3 a borrar" (`main-LL72IEMR.js` y 2 chunks), que pasaron a 404. `.htaccess` intacto (403) y dashboard 200. |
| **AC-E4** Push sin tag | ✅ | `gh run list --commit 75ea92e2` vacío tras el push a `main`. Lo mismo con los commits posteriores. |
| **AC-E5** Tag fuera de main | ✅ | Tag sobre `d4676f18` (commit sin rama): `build` falla con "…que no está en main…", `deploy` skipped. |
| **AC-E6** Rollback sin Release | ✅ | Dispatch `v0.1.0` (run 36900860740): "No hay build publicado para v0.1.0 …". Falla en 16 s, sin pedir aprobación. |
| **Seguridad extra** | ✅ | `/.deploy-manifest.json` y `/.htaccess` → 403; un chunk inexistente → 404 real (no `index.html`). |

---

## Hallazgos durante la verificación

1. **Certificado del FTP del servidor compartido:** `FTP_SERVER` debe ser el hostname del
   certificado, no `ftp.<dominio>`. Quedó en `docs/DEPLOY.md` con el comando para redescubrirlo.
2. **Test que dependía de la fecha** en `executive-dashboard.facade.spec.ts` (spec 0044-b):
   reventó el 1-oct. Se arregló en `main` (1697d8b6). Además mostró la falla de diseño del
   rollback (D6).
3. **La cola de environments de GitHub** no cancela un deploy que espera aprobación (D7).
4. Un tag sobre un commit anterior al workflow **no genera run**, porque GitHub usa el workflow
   del commit del tag.

## Pendientes (no bloquean el cierre)

- [ ] **Owner:** agregar en *Environments → Production → Deployment branches and tags* **dos**
      reglas: rama `main` **y** tag `v*`. Es defensa en profundidad: el workflow ya exige tag
      `v*` ∈ `main`. ⚠️ Desde fix-177-b los botones corren el deploy con ref `main`, así que
      con solo la regla de tag quedarían bloqueados.
- [ ] **Owner, cuando el dominio se use con usuarios reales:** T-DOM-1 (Site URL / Redirect URLs de
      Supabase Auth) y T-DOM-2 (secret `APP_URL` de Edge Functions). Ver `docs/DEPLOY.md`
      § Cambiar de dominio.
