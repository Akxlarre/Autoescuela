# Fix: Matrícula activa sin consentimiento y casilla promocional que se arrastra
> id: fix-046-i-matricula-activa-sin-consentimiento
> refs: ASG-i-050
> status: done
> closed: 2026-10-12
> created: 2026-10-11

## Root Cause

[Heredado de ASG-i-050, **confirmado en vivo** el 2026-10-11 con tres matrículas de prueba en el
piloto, ya borradas]:

1. **Matrícula activa sin consentimiento**: `EnrollmentFacade.confirmEnrollment()` pide el número
   (`get_next_enrollment_number`), pasa la matrícula a `active` y **recién después** registra el
   consentimiento (Ley 21.719). Si el consentimiento falla, muestra "No se pudo registrar el
   consentimiento del alumno. La matrícula no se confirmó." y corta, pero la matrícula ya quedó
   activa, con número y con sus 12 clases en `reserved` (invisibles en la agenda). Confirmado:
   matrícula C quedó `active`, número 0086, 12 reservadas, 0 consentimientos. Un reintento pide
   **otro** número: la función toma el último numerado (0086) y devuelve 0087.
2. **Casilla promocional que se arrastra**: `reset()` no limpia `_promotionalConsentAccepted` (ni
   `_privacyConsentAccepted`). El componente del paso 5 arranca con la casilla desmarcada, pero el
   Facade conserva el valor de la matrícula anterior y lo registra. Confirmado: matrícula A marcó
   promociones; B la dejó desmarcada en pantalla y quedó `comunicaciones_promocionales = true`.
   La de privacidad no es un riesgo real (la pantalla obliga a marcarla en cada matrícula), pero
   se limpia igual.

## ACs Afectados

Ninguno — fix autónomo (originado de ASG-i-050).

- AC-1: si el registro del consentimiento falla, la matrícula sigue en borrador (sin número, sin
  `active`, clases sin tocar) y el mensaje dice la verdad.
- AC-2: reintentar la confirmación de una matrícula que ya tiene número reusa ese número.
- AC-3: un reintento no duplica los consentimientos ya registrados para esa matrícula.
- AC-4: `reset()` deja las dos casillas de consentimiento en `false`; una matrícula nueva solo
  registra "acepta promociones" si se marcó en ella.

## Cambio

- `enrollment.facade.ts` → `confirmEnrollment()`: registrar el consentimiento **antes** de pedir
  número y activar; si la matrícula ya tiene número, reusarlo; si ya hay consentimientos de esa
  matrícula, no volver a insertarlos.
- `enrollment.facade.ts` → `reset()`: limpia `_privacyConsentAccepted` y
  `_promotionalConsentAccepted`.
- Sin migración. Alternativa descartada por ahora: mover todo a una RPC transaccional (solapa con
  la RPC de confirmación endurecida en `fix-363-m`).

## Test de Regresión

- `enrollment.facade.spec.ts`: consentimiento que falla → sin `update` a `active` ni RPC de número;
  matrícula con número → no se pide otro; consentimientos existentes → no se insertan de nuevo;
  `reset()` → casillas en `false`.

## Progreso

- [x] Confirmar (1) y (2) en vivo (matrículas de prueba A/B/C en el piloto, ya borradas)
- [x] Tests primero (TDD): 5 nuevos en `enrollment.facade.spec.ts`, en rojo antes del cambio
- [x] Código
- [x] `npm run lint:arch` y `npm run test:ci` (3855 ✅, `tsc` limpio)
- [x] `/verify` en vivo con el arreglo (matrículas D/E en el piloto, ver Evidencia; borradas después)
- [x] Índices sincronizados (FACADES)
- [x] `/fix-close` (2026-10-12, con visto bueno de Ignacio). Gotcha: DG-108.

## Evidencia de Verificación

### Reproducción en vivo — piloto, 2026-10-11 (Playwright como secretaria + SQL de Ignacio)

| Matrícula | Qué se hizo | Resultado en BD |
|---|---|---|
| A (#0084) | Privacidad ✓, promociones ✓ | `comunicaciones_promocionales = true` (correcto) |
| B (#0085) | Privacidad ✓, promociones **sin marcar** en pantalla | `comunicaciones_promocionales = true` ❌ |
| C (#0086) | `POST /consents` bloqueado al confirmar | "La matrícula no se confirmó" en pantalla, pero `active`, número 0086, 12 clases `reserved`, 0 consentimientos ❌ |

### Verificación con el arreglo — piloto, 2026-10-12 (Playwright como secretaria + SQL de Ignacio)

| Matrícula | Qué se hizo | Pantalla | Resultado en BD |
|---|---|---|---|
| D | Privacidad ✓, promociones ✓; 1er intento con `POST /consents` bloqueado | "La matrícula no se confirmó", sigue en paso 5 | — |
| D | Reintento con la red de vuelta, misma pantalla | "Matrícula Exitosa" **#0084**, 1 solo `POST /consents` | `active`, 12 agendadas, **3** consentimientos (sin duplicar), promocional `true` ✅ |
| E | Privacidad ✓, promociones **sin marcar** | "Matrícula Exitosa" #0085 | promocional **`false`** ✅ |

El número #0084 confirma que el intento fallido no consumió número ni activó la matrícula (tras borrar
A/B/C, el último numerado era 0083).

## Notes

- Originado de Asignación ASG-i-050 (`specs/assignments/ASG-i-050-matricula-activa-sin-consentimiento.md`).
- `confirmEnrollment()` la llaman `markContractSigned()` (firma digital) y la subida del contrato
  escaneado: el arreglo cubre los dos caminos. La matrícula pública online está bloqueada en el
  piloto (su Facade tiene su propio flujo de consentimiento).
