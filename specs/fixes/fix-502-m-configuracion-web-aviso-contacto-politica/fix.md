# Fix: Configuración web no avisa si el contacto difiere de la política de privacidad
> id: fix-502-m-configuracion-web-aviso-contacto-politica
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

N07 / V07 de `fix-485-m`. La dirección y el correo de contacto de la landing se editan libres en
Configuración web; la política de privacidad de cada sede tiene su dirección y su correo para
ejercer derechos fijos en `privacy-policy.model.ts`. Hoy coinciden, pero si alguien cambia el
contacto de la web nada lo advierte, y la web y la política quedan diciendo cosas distintas.

**Decisión de Matías (2026-11-07):** se siguen editando libres, con un aviso cuando no coinciden.

## ACs Afectados

- Ninguno de spec; decisión N07 de `fix-485-m`.

## Cambio

- `core/utils/website-config.utils.ts` (+ spec): `contactPolicyMismatch(contacto, política)` →
  campos que no coinciden (dirección: la de la web contenida en la de la política, sin
  distinguir mayúsculas ni tildes; correo: igual sin distinguir mayúsculas).
- `admin-configuracion-web.component.ts`: calcula la política de la sede vigente
  (`getPrivacyPolicy(slug)`) y la pasa a la pestaña Contacto.
- `tabs/contacto-tab.component.ts`: aviso bajo los datos de contacto si algo no coincide.

## Test de Regresión

- `website-config.utils.spec.ts > fix-502-m` ✓ (3 casos); con website-config y Configuración web 33/33. `ng build` OK.
- Navegador (2026-11-07, admin, sede 1): con los datos actuales no aparece el aviso; correo `otro@gmail.com` → "El correo de la web no coincide con el de la política…"; además dirección `Arauco 600, Chillán` → "La dirección y el correo de la web no coinciden…" (captura `c485-24-aviso-politica.png`). Sin publicar.
