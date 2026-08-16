# Resumen de cumplimiento — Ley 21.719

**Corrida:** 1 (primera) · **Fecha:** 16 de agosto de 2026 · **Commit:** `748d8874`
**Marco evaluado:** Ley 21.719 sobre Protección de Datos Personales
**Entra en vigencia:** 1 de diciembre de 2026 — **quedan 107 días**

**Sociedades evaluadas:**

| | Escuela de conductores | OTEC |
|---|---|---|
| Razón social | Sociedad Comercial Chillán Capacita Limitada | Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL |
| RUT | 77.940.120-0 | 76.007.217-6 |
| Domicilio | Carrera 74, Chillán | Maipón 418, Chillán |
| Contacto de datos | conductorchillan@gmail.com | otecchillan@gmail.com |
| Trabajadores | ~8 | ~6 |
| Documentos | `docs/conductores/` | `docs/otec/` |

Ambas son **responsables de datos independientes** ante la Agencia, aunque compartan sistema
informático y representante legal. Por eso cada una tiene su juego completo de 9 documentos.

---

## Postura actual

**Score Ley 21.719: 0,61 / 1,00** — 10 controles cumplidos, 8 parciales, 4 incumplidos, 1 sin verificar,
sobre 23 exigidos.

La lectura correcta de ese 0,61 es esta: **la base técnica está bien y la capa documental estaba en
cero.** El sistema ya tiene control de acceso por roles serio (371 reglas activas), registro de auditoría
inmutable con IP, cambio forzado de contraseña al primer ingreso, y el almacenamiento de documentos
cerrado correctamente (bucket privado + lectura restringida por rol + enlaces firmados con expiración).
Eso es más de lo que suele encontrarse. Lo que faltaba era todo el papel —que se generó en esta corrida—
más **dos agujeros técnicos concretos**.

> **Corrección respecto del borrador inicial de este informe.** La primera versión reportó como hallazgo
> crítico que el bucket `documents` estaba público. **Era un falso positivo.** La auditoría revisó las
> migraciones que crean el bucket (`20260307160000`, `20260310130000`, ambas con `public = true`) pero no
> la migración posterior `20260413000001_secure_documents_bucket.sql`, que lo cierra correctamente. El
> panel de Supabase lo confirma. Ver la sección "Lo que sí está bien resuelto".

---

## El factor que lo cambia todo: el sistema aún no se despliega

La app está en desarrollo avanzado y **no hay datos reales en producción**. La base empieza a poblarse el
día del despliegue. Eso convierte este trabajo en **preventivo y no correctivo**, que es una posición
mucho mejor:

- **No hay que recolectar consentimiento retroactivamente.** Si las casillas y su registro están en
  producción el día 1, ningún alumno queda sin evidencia. Regularizar consentimiento sobre una base ya
  poblada es el problema más caro y peor resuelto de casi toda adecuación — y aquí simplemente no existe.
- **La EIPD resulta genuinamente previa al tratamiento**, que es el estándar del Art. 15 ter y no lo que
  suele encontrarse.
- **No hay datos con retención vencida, ni brechas posibles, ni solicitudes de titulares pendientes.**

Se traduce en un criterio simple para todo lo que sigue: **la fecha límite real no es diciembre de 2026,
es el día del despliegue.**

---

## Lo urgente: 1 hallazgo técnico

### 🟠 No se registra el consentimiento

Los formularios actuales no separan el consentimiento de matrícula, el del certificado médico (que la ley
exige **expreso y por separado**, Art. 16) y el de marketing. Y no se guarda evidencia de qué aceptó cada
alumno, cuándo ni con qué versión de la política.

La ley pone **la carga de la prueba en la empresa** (Art. 12). Ante una fiscalización, la pregunta es
"muéstreme el consentimiento" — y hoy no hay nada que mostrar.

**Arreglo:** casillas separadas y no premarcadas, más una tabla que registre cada aceptación. Los textos
exactos ya están escritos en `21719-consentimiento.md` de cada sociedad.

**Es lo único que debe estar sí o sí antes de matricular al primer alumno real.**

### 🔵 Segundo factor de autenticación — riesgo aceptado, no pendiente

TOTP está desactivado (`supabase/config.toml` → `[auth.mfa.totp] enroll_enabled = false`). El
representante legal evaluó la medida el 16-08-2026 y **decidió no implementarla en esta etapa**.

Es una decisión defendible: la ley no exige MFA, sino medidas *proporcionales* (Art. 14 quinquies), y
el conjunto ya implementado —RLS por rol, almacenamiento privado con enlaces firmados, auditoría
inmutable con IP, cambio forzado de contraseña— sostiene esa proporcionalidad para una organización de
este tamaño. El costo, en cambio, es alto: facade, dos vistas, tres guards, migración de RLS y un flujo
de recuperación para cuando a una secretaria se le pierda el teléfono.

**Lo que importa es que quedó documentada como decisión evaluada y no como omisión** — la diferencia
exacta que mira un fiscalizador. El fundamento completo, los controles compensatorios y las condiciones
de re-evaluación están en la §4.1 de cada EIPD.

**Riesgo asumido:** una credencial comprometida de admin o secretaría permite leer el padrón completo.
La auditoría permite detectarlo, no impedirlo.

**A cambio, cuatro medidas de costo cero que hay que instruir antes del despliegue:** cuentas
nominativas sin compartir, revocación de acceso el mismo día del término del vínculo, contraseñas únicas,
y revisión del `audit_log` ante sospecha (`INSTRUCTIVO.md` §H).

---

## Lo que sí está bien resuelto

Vale dejarlo por escrito, porque es lo que se muestra en una fiscalización y porque evita que una próxima
auditoría lo vuelva a marcar por error:

| Control | Evidencia |
|---|---|
| **Almacenamiento de documentos cerrado** | [`20260413000001_secure_documents_bucket.sql`](../supabase/migrations/20260413000001_secure_documents_bucket.sql): bucket privado, eliminada la policy de lectura pública incondicional, reemplazada por `documents_authenticated_read` restringida a `admin`/`secretary`, y URLs absolutas migradas a rutas relativas para forzar enlaces firmados. Ninguna re-ejecución de migraciones lo revierte |
| **Acceso por enlaces temporales** | Todas las Facades usan `createSignedUrl` con TTL de 1 hora. Con el bucket privado, este es el mecanismo correcto |
| **Control de acceso por roles** | 371 policies RLS sobre 13 tablas, con `auth_user_role()` y segmentación por `branch_id` |
| **Auditoría** | `audit_log` inmutable, con `user_id`, `action`, `entity`, `ip` y `created_at`; triggers en tres migraciones; lectura solo admin |
| **Contraseñas** | Hashing de Supabase Auth. La contraseña inicial derivada del RUT está mitigada por el cambio forzado en el primer ingreso, con tres guards que lo hacen cumplir |
| **Cifrado en tránsito** | HTTPS/TLS en toda la aplicación |
| **Secretos** | Credenciales SMTP en variables de entorno. La `anonKey` expuesta en `environment.ts` es pública por diseño y está protegida por RLS |

### Dos observaciones menores de higiene

Ninguna es un incumplimiento de la ley, pero conviene anotarlas:

1. **El historial de migraciones del bucket es confuso.** Dos migraciones lo crean con `public = true` y
   una tercera, un mes después, lo cierra. Además, el comentario de `20260310130000` cita a
   `20260413000001`, que es posterior — es decir, se editó un archivo de migración ya aplicado. Funciona,
   pero es exactamente lo que hizo que esta auditoría llegara a una conclusión equivocada leyendo el
   repo. Vale una nota en `indices/DOMAIN-GOTCHAS.md` para quien lea esas migraciones a futuro.
2. **El bucket `assets` es público, con MIME `Any` y 50 MB.** Hoy solo guarda el logo que usa
   `generate-class-book-pdf`, así que no hay exposición de datos personales. Restringir sus MIME types a
   imágenes evita que alguien suba ahí un documento de alumno por error.

---

## Brechas documentales y de gestión

| Brecha | Estado | Acción |
|---|---|---|
| **Ningún contrato de tratamiento (DPA) firmado** | ❌ | Quien mantiene el sistema tiene acceso a producción sin contrato escrito, lo que el Art. 15 bis exige. Modelos listos en `21719-dpa.md` |
| **La OTEC no tiene DPA con sus empresas clientes** | ❌ | Cuando una empresa envía trabajadores a capacitarse, la OTEC actúa como **encargada** de esos datos. Sin contrato, ese tratamiento no tiene marco. Modelo B en `docs/otec/21719-dpa.md` |
| **Transferencias al extranjero sin mecanismo** | ❌ | Supabase, Google y Zoom procesan fuera de Chile. Falta incorporar las cláusulas modelo del Ministerio de Economía |
| **Sin proceso de depuración a los 5 años** | ❌ | La retención está definida pero nada la ejecuta. Los datos se acumulan indefinidamente |
| **Política de privacidad sin publicar** | ⚠️ | Redactada. Falta subirla y enlazarla desde el formulario público y la matrícula |
| **Canal de derechos sin operar** | ⚠️ | Los correos existen y el procedimiento está escrito. Falta designar quién los revisa a diario |
| **Backups sin verificar** | ❓ | No se puede saber desde el código. Confirmar en el panel de Supabase y probar una restauración |
| **Responsable de datos sin nominar** | ⚠️ | Se resolvió designando **el cargo** de secretaría (porque la persona rota) con el representante legal como suplente. Falta anotar quién lo ocupa hoy |

---

## Lo que se resolvió solo en esta corrida

No quedó nada pendiente de decisión legal. Estas preguntas se respondieron con el texto de la ley:

| Pregunta | Respuesta | Fundamento |
|---|---|---|
| ¿Necesitan un DPO (delegado de protección de datos)? | **No** | Art. 50: solo organismos públicos o datos sensibles a gran escala. Tratan datos sensibles, pero no a gran escala. Basta el responsable interno designado |
| ¿Necesitan una Evaluación de Impacto (EIPD)? | **Sí, obligatoria** | Art. 15 ter: doble gatillo verificado en el código — certificados médicos (sensibles) y alumnos menores de edad. **Ya está hecha**, en `21719-eipd.md` |
| ¿Les aplica la gracia MIPYME? | **Sí** | Art. sexto transitorio. Ambas son empresa de menor tamaño (Ley 20.416). Los primeros 12 meses la Agencia puede amonestar en vez de multar |
| ¿Cómo se resuelve que la secretaria rote? | Designación **por cargo**, no por persona | El correo del canal es estable y no cambia al rotar quien lo atiende |
| ¿Un solo juego de documentos o dos? | **Dos** | Cada RUT responde por separado ante la Agencia |
| ¿Qué mecanismo para las transferencias? | Cláusulas Contractuales Modelo | Resolución RAEX202503748, D.O. 19-12-2025 |

---

## Plan de acción priorizado

El corte no es diciembre: es **el día del despliegue**.

### 🚧 Bloqueantes de despliegue — no matricular al primer alumno sin esto

1. **Casillas de consentimiento separadas + tabla `consents`** (matrícula y certificado médico Art. 16),
   en los dos flujos, público y secretaría.
2. **Aviso del Art. 14 ter** en el primer paso que captura datos, en ambos flujos.
3. **Publicar la política de privacidad** en la ruta `/politica-privacidad` y enlazarla desde las casillas.
4. **Instruir las 4 medidas compensatorias** de `INSTRUCTIVO.md` §H (reemplazan al MFA).
5. **Designar por escrito** quién ocupa el cargo de encargada de datos y quién revisa el correo del canal.

### 📄 Papeles — en paralelo, no dependen de desarrollo

6. Firmar el **DPA con quien mantiene el sistema** y con el contador.
7. La OTEC: **Modelo B con cada empresa cliente**, antes del primer curso a empresa.
8. **Incorporar las cláusulas modelo** con Supabase, Google y Zoom, y archivar la constancia.
9. **Confirmar la región del proyecto Supabase** — define el país de destino en el anexo.
10. **Instalar la señalética de videovigilancia**, si no está.
11. **Verificar los backups** en el panel y probar una restauración.
12. **Capacitar a las secretarias** con el `INSTRUCTIVO.md`.

### 🕓 Diferido — con fundamento, no por olvido

13. **Rutina de depuración a los 5 años** y eliminación de la imagen del certificado médico al cerrar
    expediente. El primer vencimiento posible está a 5 años del primer egreso posterior al despliegue:
    hay que dejarla definida, no construida.
14. **Enforcement de MFA por rol.** Riesgo aceptado y fundado (§4.1 de las EIPD). Se revisa según las
    condiciones ahí establecidas.
15. **Flujo automatizado de derechos ARCO.** Al volumen de estas escuelas, los 30 días se cumplen a mano
    con el procedimiento de `21719-canal-derechos.md`. La ley no exige automatizarlo.
16. **Re-correr esta auditoría** al desplegar, para confirmar que el score subió y que no apareció drift.

---

## Cambios vs. la corrida anterior

No aplica — **esta es la primera corrida**. La próxima comparará control a control contra este
`state.json` y mostrará avances y retrocesos.

---

## Lo que esta skill NO cubre

Para que quede claro qué queda fuera:

- **Representación ante una fiscalización** de la Agencia. Es el único escenario donde conviene un
  abogado; la representación es reservada por ley. El material que pediría la Agencia ya está en esta
  carpeta.
- **Monitoreo en tiempo real de filtraciones.** Esta corrida deja el plan de respuesta listo, no
  vigilancia 24/7.
- **Ley 21.595 (delitos económicos)**, ya vigente, y **normativa sectorial de escuelas de conductores
  (DS 39 / DS 251)**. No se activaron en esta corrida. Ambos son candidatos claros para la siguiente
  —sobre todo el sectorial, que es el que fiscaliza la Municipalidad y el MTT.

---

## Siguiente paso

**Implementar el consentimiento** (tabla `consents` + casillas separadas + aviso del Art. 14 ter + ruta
`/politica-privacidad`). Es el único bloqueante real de despliegue y la única pieza que, si no entra
antes del primer alumno, después cuesta diez veces más.

Todo lo demás de la lista se puede hacer en paralelo, sin desarrollo, o está diferido con fundamento.

---
*Generado con compliance-cl (pack ley-21719). No constituye asesoría legal; es un informe fundado en la normativa chilena vigente y en la evidencia del propio repositorio.*
