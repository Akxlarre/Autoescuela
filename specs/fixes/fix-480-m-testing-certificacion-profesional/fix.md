# Fix: Testing — Certificación Profesional en el piloto
> id: fix-480-m-testing-certificacion-profesional
> refs: ASG-m-011
> status: done
> closed: 2026-10-22
> created: 2026-10-22

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> No hay checklist previo en `specs/testing-piloto/` para este módulo: los casos salen del
> alcance de la ASG (abajo) y se registran en "Resultados".

## Root Cause

[Heredado de ASG-m-011, a confirmar]: Certificados Prof. estuvo bloqueado en el piloto hasta
`fix-465-m` (2026-10-19), así que quedó fuera de `ASG-i-025` (Clase Profesional) y de `ASG-i-033`
(lo excluyó a propósito). Solo se revisó en el navegador una vez: la ruta carga, las columnas son
las correctas y "Generar" se deshabilita cuando falta el pago. Nunca se generó un certificado
Profesional de punta a punta. Es un documento con valor legal: si sale con datos incorrectos o se
emite a quien no corresponde, el problema es serio.

**Clasificación:** Funcional (con integración en la generación del PDF) · dificultad Media ·
rutas: `/app/admin/clase-profesional/certificados`, `/app/secretaria/profesional/certificados`.

### Alcance

1. **Elegibilidad en el piloto** — secretaria: solo depende del pago; admin: siempre elegible
   (`fix-465-m`). Promoción finalizada (`fix-467-m`). Sin columnas ni motivos académicos
   (teoría, práctica, nota).
2. **Emisión** — generar uno, "Generar pendientes" en lote, confirmación previa (`fix-466-m`),
   regenerar (`fix-464-m`), folio correlativo sin duplicados (`fix-461-m`), historial de emisiones
   y envío masivo.
3. **PDF** — plantilla "Certificado Profesional" del editor (sede 2). Datos interpolados: nombre,
   RUT, clase/categoría, convalidación, promoción, fechas y sede. Editar la plantilla y comprobar
   que el próximo PDF la use.
4. **Notificaciones** — con el portal del alumno en piloto, al alumno no le llega nada
   (`fix-465-m`, `fix-448-m`).
5. **Documentos** — el certificado emitido aparece en el DMS de la matrícula (`fix-470-m`) y en
   la ficha del alumno.
6. **Transversal** — admin vs secretaria, aislamiento por sede (RLS + Storage; secretaria de otra
   sede), modo oscuro y claro, 375 / 768 / 1280 / 1440 px y app-like.
7. **Pendiente heredado de `fix-447-m` (S4):** `export-certificates-zip` sigue aceptando
   `type: 'professional'`; ahora que Profesional está habilitado, revisar que respete sede y rol.

Los hallazgos se corrigen en la misma sesión, cada uno en su propio fix/hotfix.

### Fuera de alcance

- Archivo Profesional (ya probado en `ASG-i-025` / `fix-319-m`, D3a).
- Relatores, Asistencia, Evaluaciones y Pre-inscritos (siguen bloqueados en el piloto).

## Progreso

- [x] Revisión en código: elegibilidad, emisión, folio, edge functions del PDF/envío/ZIP
- [x] Datos de prueba: promoción finalizada en sede 2 con alumnos pagados y no pagados
- [x] Casos en navegador (admin y secretaria)
- [x] PDF: datos interpolados y cambio de plantilla
- [x] DMS de la matrícula y ficha del alumno
- [x] Aislamiento por sede
- [x] Modos claro/oscuro, anchos y app-like
- [x] Fixes derivados (481–484, hotfix-167) cerrados y commiteados
- [x] Test de regresión del track
- [x] `/fix-close` (2026-10-22)

## Resultados

### Datos de prueba (2026-10-22)

Sembrados en la promoción 277 (id 14, finalizada, sede 2) con Nº real (`get_next_enrollment_number`):

| Nº | Matrícula | Alumno | Curso | Situación |
|---|---|---|---|---|
| 0097 | 8554 | E2E-CertPagado José Aguilera Núñez | A2 (pc 46) | pagado |
| 0098 | 8555 | E2E-CertDeuda José Bravo Núñez | A4 (pc 47) | saldo $50.000 |
| 0099 | 8556 | E2E-CertConv José Contreras Núñez | A5 (pc 48) | pagado, convalida A3 |

En el curso A2 ya estaba Samuel José Merino (Nº 0031, seed, saldo $90.000): no se le emitió.

### Revisión en código

| Caso | Resultado | Evidencia |
|---|---|---|
| Elegibilidad en el piloto | ✅ | `elegible = pagoCorrecto`; columnas académicas tras `academicoVisible` (`fix-465-m`) |
| Promoción finalizada | ✅ | lista: `finished` o `end_date = hoy`; edge function `checkPromotionFinished` |
| Folio | ✅ | `issue_certificate` (lock + único por matrícula y tipo); regenerar conserva el folio |
| Sede y rol en generar / email / ZIP | ✅ | `requireStaff` + `denyIfEnrollmentOutOfScope` / `resolveBranchScope` |
| S4 heredado de `fix-447-m` (ZIP `professional`) | ✅ cerrado | ahora Profesional está habilitado y el ZIP filtra sede |
| Regenerar (`fix-464-m`) | ❌ | solo se hizo para Clase B: el facade Profesional no tiene `regenerarCertificado` y la fila "Generado" solo ofrece Ver/Email |
| Storage | ✅ | `certificates_prof/` está en la lista blanca por sede (`20261001200000`) |

### Seguridad por API (`api1.mjs`)

| Caso | Resultado |
|---|---|
| Secretaria sede 1 genera para matrícula de sede 2 | ✅ 403 |
| Generar con promoción en curso (279), secretaria y admin | ✅ 400 `PROMOCION_EN_CURSO` |
| Secretaria sede 1 lee `professional_promotions` / matrículas del curso | ✅ 0 filas |
| Secretaria sede 1 pide el ZIP de sede 2 | ✅ 403 |
| Secretaria sede 1 envía email de sede 2 | ✅ 403 |

### Navegador (admin, 1440 px)

| Caso | Resultado | Evidencia |
|---|---|---|
| Sin columnas académicas, Pago visible | ✅ | captura `c480-03-a2.png` |
| Generar uno (pagado) | ✅ | folio 6; abre el visor; sin modal (no hay avisos, decisión de `fix-466-m`) |
| PDF | ✅ | nombre con tildes, RUT, "Licencia Profesional Clase A2", fechas de la promoción 24-08-2026 al 29-09-2026, encabezado de la sede, fecha de hoy en hora Chile |
| Generar con deuda (lista) | ✅ | modal "Certificado con deuda" con motivo obligatorio (409 esperado); cancelado (alumno del seed) |
| Generar con deuda (ficha) | ✅ | motivo → habilitación registrada y aviso a admins; queda "Ver Certificado" |
| "Generar Pendientes" sin elegibles | ✅ | el drawer explica "con saldo pendiente — emítelos uno a uno" |
| "Generar Pendientes" en lote | ✅ | A5: folio 7 (correlativo), toast "1 certificado generado" |
| Badge "Convalida A3" | ✅ | lista y tarjeta |
| Enviar email | ✅ | modal con el correo → "Email enviado"; el botón pasa a "Reenviar" |
| Enviar Emails Masivo (2026-10-22, tras el cierre) | ✅ | drawer "1 alumno recibirá su certificado por correo" con nombre y correo → "1 email enviado"; la fila pasa a "Reenviar" y el botón masivo desaparece |
| Exportar todos (ZIP, admin y secretaria sede 2) | ✅ | 200, `certificados-profesional-2026-10-22.zip` con `CERT-PROF-2026-0006_…` y `…0007_…`, ambos PDF válidos (`zip.mjs`) |
| Historial | ⚠️ | muestra solo el curso elegido, pero dice "1 registro de emisión de certificados Clase Profesional" |
| Notificación al alumno | ✅ | 0 filas en `notifications` para los alumnos de prueba |
| DMS de la matrícula | ✅ | `v_dms_student_documents` trae `certificado_profesional` de 8554 y 8556 |
| Ficha | ⚠️ | "Ver Certificado" queda cortado ("Ver Certifi…"); el panel central dice que el certificado Profesional "no está disponible en esta etapa" |
| Tabla a 1440 px | ❌ | sin Nº de matrícula; la columna Promoción repite el selector; RUT, "Al día" y "Convalida A3" se parten en dos líneas |
| Etiquetas de selectores | ⚠️ | "278 — Promoción 278 (…)" y "Profesional A2 (A2)" repiten datos; cursos en orden A3, A2, A4, A5 |
| Secretaria sede 2 | ✅ | misma vista y acciones |
| Secretaria sede 1 | ✅ | la ruta la devuelve al inicio |
| Modo oscuro, 1280 / 768 / 375 | ✅ | sin scroll de documento ni horizontal |

### Decisiones (Matías, 2026-10-22)

- **D1** — El certificado de un alumno con convalidación (A5 + A3) solo decía "Clase A5". Decidido:
  **lo menciona**, con texto editable en Plantillas (Matías preguntó cómo se editaría). Redacción
  inicial elegida en la sesión: "… Clase A5 con convalidación de Clase A3" → `fix-483-m`.

### Bugs derivados

| Hallazgo | Track | Estado |
|---|---|---|
| Falta "Regenerar" en Profesional | `fix-481-m` | ✅ `7f81443d` |
| Tabla: Nº de matrícula, columna Promoción, cortes de línea (y desborde a 1280 px con Regenerar) | `fix-482-m` | ✅ `20c9c140` |
| Ficha, historial (además: no se recargaba al cambiar de curso) y etiquetas de selectores | `hotfix-167-m` | ✅ `820b007d` |
| D1: convalidación en el certificado, editable en Plantillas | `fix-483-m` | ✅ `fb59d3f7` (migración y función por Matías) |
| Certificación B tampoco mostraba el Nº de matrícula (visto al comparar) | `fix-484-m` | ✅ `d82241d2` |

### Descartados

- El selector de Curso "se reabre" tras elegir: era la herramienta (Playwright MCP con las
  animaciones lentas). A velocidad normal se cierra (`P05` lo comprueba).
- "Generar Pendientes (0)" activo sin elegibles: el drawer explica por qué (saldo pendiente).
- El PDF no imprime el folio: tampoco Clase B; replican el documento real.
- Edición de la plantilla probada por API (cierre cambiado y restaurado) y con el campo nuevo de
  `fix-483-m` en el editor; el editor en sí se probó en `fix-447-m` (casos J).

### Datos de prueba que quedan

Los tres alumnos sembrados (Nº 0097–0099, matrículas 8554–8556, promoción 277) se dejan como datos
de prueba de Profesional, con Nº real. 0097 y 0099 tienen certificado (folios 6 y 7); a 0098 se le
borró el certificado al probar la limpieza, pero conserva su habilitación de deuda
(`enrollment_payment_overrides`, la RLS no deja borrarla).

### Test de regresión

`e2e/certificacion-profesional.spec.ts` (4 tests, siembra y limpia sus propios alumnos E2E-):
P01/P02 generar y regenerar conservan el folio, Nº de matrícula en la fila y en el buscador · P03 con
deuda pide motivo (secretaria sede 2) · P04 secretaria de otra sede: ruta y API 403 · P05 selectores,
cierre del desplegable e historial del curso. Junto con `documentos-certificacion` 1 y 2: 19/19
(2026-10-22).

## Fix

No aplica: cada hallazgo va a su propio track.

## Test de regresión

`e2e/certificacion-profesional.spec.ts` — ver "Resultados → Test de regresión": verde 2026-10-22.
