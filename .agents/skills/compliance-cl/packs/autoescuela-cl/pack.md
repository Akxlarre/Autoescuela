# Pack: Autoescuela-CL — Escuelas de Conductores (Chile)

> Normativa **sectorial ya vigente** (no hay fecha de entrada en vigor futura, a diferencia de la
> 21.719). Fiscalizan **Carabineros de Chile** (control de funcionamiento) y el **Ministerio de
> Transportes y Telecomunicaciones (MTT)** o la **Municipalidad** respectiva (reconocimiento oficial),
> según la clase de escuela. Aplica a toda escuela de conductores, sin importar tamaño.
>
> **Estado de las fuentes:** el contenido de este pack fue verificado contra la **consulta XML oficial
> de LeyChile** (`obtxml?opt=7`) para cada norma — no inventado — pero, igual que advierte
> `sources/FUENTES.md` para el resto del corpus, **ese XML es abreviado**. Los archivos aún no están
> descargados a `sources/` en este repo (el entorno de esta sesión bloqueó las descargas por política
> de seguridad de red); ver la sección **Fuentes** al final con los comandos para completar el corpus
> offline. Hasta que eso se haga, cualquier cifra fina (UF exactas, plazos en días, números de artículo
> de detalle) debe tratarse con `[verificar contra fuente oficial]` antes de usarse en una fiscalización
> real.

## Controles que exige (ver `references/controls.md`)
`auto-reconocimiento`, `auto-instructores`, `auto-flota`, `auto-seguro-flota`, `auto-curricula`,
`auto-infraestructura`, `auto-registro-alumnos`, `auto-fiscalizacion`, `cons-contrato`,
`trib-clasificacion`. Además, por manejar datos personales de alumnos e instructores (RUN, licencia,
domicilio, y potencialmente antecedentes de salud/aptitud psicotécnica — dato **sensible**), se propagan
los controles `data-*` y `sec-*` del pack `ley-21719` — **no se duplican aquí**, se activa ese pack en
paralelo.

## 1. Marco legal y quién regula qué

| Norma | idNorma (LeyChile) | Qué regula |
|---|---|---|
| **Ley 18.290**, Título II | 29708 | Define las escuelas Clase A (profesionales/no profesionales) y Clase B (licencias no profesionales B/C, especial D); quién autoriza (Municipalidad para Clase B) y causales de revocación del reconocimiento. |
| **DS 39/1985** (MTT) | 7993 | Reglamento de Escuelas de Conductores **Clase B** (no profesionales): instructores, flota, horas mínimas, infraestructura, currícula, vigencia de la autorización. |
| **DS 251/1999** (MTT) | 131534 | Reglamento de Escuelas de Conductores **Clase A** (profesionales): mismos ejes, exigencias mayores (más horas, instructores por especialidad, simuladores). |
| **Ley 19.496** | 61438 | Protección al Consumidor — aplica al contrato de matrícula como a cualquier prestador de servicios. |
| **DL 825** (Ley de IVA), Art. 13 | 6369 | Exención de IVA a "establecimientos de educación" por su actividad docente propiamente tal — alcance **ambiguo** para escuelas de conductores, ver §5. |

## 2. Obligaciones clave — operación de la escuela (DS 39 para Clase B / DS 251 para Clase A)

**Reconocimiento oficial (Art. 31 bis Ley 18.290):** Clase B la autoriza la **Municipalidad**; Clase A
requiere reconocimiento del **MTT** vía Secretaría Regional Ministerial. Sin reconocimiento vigente no
se puede operar ni emitir certificados válidos para trámite de licencia.

**Instructores:**
- Clase B (DS 39, Art. 13): licencia de conducir del tipo a enseñar con **antigüedad ≥ 7 años**,
  idoneidad moral (reevaluada cada 2 años), escolaridad mínima 4° medio, certificación en tránsito y
  mecánica, examen sensorial cada 2 años. Instructor teórico: examen de conocimientos + licencia de su
  especialidad.
- Clase A (DS 251, Art. 17): instructores de especialidad con título profesional/técnico + ≥2 años de
  experiencia; instructores de conducción con licencia ≥5 años de antigüedad, idoneidad moral, ≥3 años
  conduciendo el vehículo específico, y **curso de formación pedagógica de al menos 120 horas**.
  Instructores de simulador requieren curso adicional.

**Flota:**
- Clase B (DS 39, Art. 4-8): mínimo 2 vehículos de 4 ruedas (excepción: ciudades <50.000 habitantes,
  1 vehículo); **doble comando** (freno/embrague/acelerador operables por el instructor); antigüedad
  máxima **8 años** desde facturación; letrero triangular "EN PRÁCTICA"; **seguro de riesgos a
  terceros** por vehículo; **revisión técnica semestral**.
- Clase A (DS 251, Art. 10-11): especificaciones por tipo de vehículo enseñado (taxi, transporte
  escolar, bus, camión articulado), con antigüedades máximas distintas por categoría (5 a 10 años).
  `[verificar contra fuente oficial]` el detalle exacto por subcategoría antes de auditar una escuela
  Clase A real.

**Horas mínimas de currícula (aprobada previamente por el MTT):**
- Clase B (DS 39, Art. 17-18): Clase B ≈ 8 h teóricas + 12 h prácticas; Clase C ≈ 8 h + 10 h; Clase D ≈
  7 h + 7 h. Máximo 1 sesión práctica diaria (1 hora pedagógica). Modalidad e-learning permitida solo
  para el componente teórico (Art. 18 bis).
- Clase A (DS 251, Art. 12): 150 horas totales (A1/A2/A4) o 132 horas (A3/A5); asistencia mínima 80%
  teóricas / 100% prácticas; nota mínima aprobatoria 75%.

**Infraestructura:** sala teórica con maqueta/láminas de situaciones de tránsito, set de señalética
réplica, material audiovisual, instrumentos optométricos certificados (Clase B, Art. 9); para Clase A
además laboratorio sensométrico/psicomático, taller mecánico a ≤5 km, sala de simulador si aplica
(Art. 9 DS 251).

**Registro y fiscalización:** libro de registro de alumnos **foliado y visado por la Municipalidad**
(DS 39 Art. 21); libros de reclamos/asistencia/fiscalizaciones foliados y timbrados regionalmente
(DS 251); **Carabineros de Chile** fiscaliza con acceso a recintos, vehículos y documentación en
cualquier momento (DS 39 Art. 20).

**Vigencia de la autorización:** se **suspende** (falta temporal de requisitos) o se **revoca**
(pérdida definitiva), y mientras esté suspendida no se puede solicitar otra autorización (DS 39 Art.
14); para Clase A se agrega causal de **inactividad >12 meses** sin dictar los cursos ofrecidos
(DS 251 Art. 8).

## 3. Protección al consumidor (Ley 19.496) — el contrato de matrícula

El alumno de una autoescuela **no** queda cubierto por el retracto especial de "servicios educacionales
de nivel superior" (Art. 3 ter — pensado para CFT/IP/universidades ligadas al proceso de admisión), pero
sí por las reglas **generales** de protección al consumidor: información veraz de precio y condiciones
antes de contratar (Art. 3, Art. 12), prohibición de cobrar por servicios no prestados o cambiar
unilateralmente lo pactado, y responsabilidad del proveedor por incumplimiento o negligencia (Art. 23).
El **retracto general de 10 días (Art. 3 bis)** solo aplica si la matrícula se contrató **a distancia o
por medios electrónicos**, no en la venta presencial. `[verificar contra fuente oficial]` antes de
afirmar esto en un caso concreto — es una distinción con jurisprudencia asociada, no solo texto de ley.

## 4. Datos personales (cruce con `ley-21719`)

Una autoescuela trata RUN, licencia de conducir, domicilio, y en varios casos certificado o examen de
aptitud psicotécnica/médica (**dato sensible — salud**, Art. 16 Ley 21.719 vía el pack `ley-21719`). El
libro de registro de alumnos exigido por DS 39 Art. 21 es, en sí mismo, una base de datos personales que
debe seguir las reglas de seguridad y retención del pack de datos. Activar ambos packs juntos.

## 5. Tratamiento tributario (SII) — punto abierto, no resuelto por esta skill

El Art. 13 del DL 825 exime de IVA a "establecimientos de educación" por su **actividad docente
propiamente tal**, en lenguaje general que **no menciona explícitamente** escuelas de conductores,
academias ni institutos de capacitación. No se encontró un oficio del SII específico para escuelas de
conductores en las fuentes consultadas. **Esto no se puede resolver self-service**: la clasificación
correcta (exenta vs. afecta a IVA) depende de cómo esté clasificada la actividad económica de la escuela
ante el SII y puede requerir una **consulta administrativa (oficio) al SII** o confirmación de un
contador. Marcar siempre `[ABOGADO/CONTADOR]` en el documento generado — no asumir un régimen por
defecto.

## Documentos a generar (`templates/` → `<repo>/.compliance/docs/` con prefijo `autoescuela-`)
`reglamento-interno.md`, `ficha-cumplimiento-ds39-251.md`, `contrato-matricula.md`,
`nota-tributaria-iva.md`, `checklist-fiscalizacion.md`.

## Fuentes (pendiente de completar el corpus offline)

Comandos de descarga (mismo patrón que `sources/FUENTES.md`; ejecutar en una terminal con acceso de
red — este pack se armó con la política de red de la sesión bloqueando `curl`, así que **falta
correrlos y agregar el SHA-256 real a FUENTES.md**):

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36"
curl -L -A "$UA" "https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=29708"  -o ley-18290-transito.xml
curl -L -A "$UA" "https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=7993"   -o ds-39-1985-escuelas-clase-b.xml
curl -L -A "$UA" "https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=131534" -o ds-251-1999-escuelas-clase-a.xml
curl -L -A "$UA" "https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=61438"  -o ley-19496-consumidor.xml
curl -L -A "$UA" "https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=6369"   -o dl-825-iva.xml
sha256sum *.xml
```
