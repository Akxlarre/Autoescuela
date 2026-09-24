-- 20260916000000_repurpose_document_templates.sql
--
-- Spec 0016-m — Editor de plantillas para contratos y certificados generados por Edge Function.
--
-- Reestructura `document_templates` de "archivo descargable subido a mano" (tab "Plantillas" de
-- DMS, feature en desuso real — 0 filas en producción, confirmado 2026-09-16) a "contenido
-- editable por cláusula/sección que alimenta la generación de PDF" de contratos y certificados.
--
-- El texto de cada cláusula puede contener placeholders {{token}} para valores que se calculan en
-- código (montos, saldo, fechas, URL de política de privacidad, etc.) — ver
-- supabase/functions/_shared/template-tokens.ts y la tabla de tokens en
-- specs/specs/0016-m-editor-plantillas-documentos/plan.md §4.

-- ─── 1. Reestructurar columnas ──────────────────────────────────────────────────────────────

alter table document_templates
  drop column if exists file_url,
  drop column if exists format,
  drop column if exists version,
  drop column if exists download_count,
  drop column if exists active,
  drop column if exists category;

alter table document_templates
  add column if not exists branch_id int references branches(id),
  add column if not exists document_type text,
  add column if not exists content jsonb not null default '{}'::jsonb;

-- `drop ... if exists` antes de agregar: sin esto, correr la migración sobre una base donde ya
-- se aplicó aborta con `42710: constraint already exists` y corta el `db push` entero, dejando
-- sin correr todo lo que venga después (hotfix-058-b). Mismo patrón que las policies de abajo.
alter table document_templates
  drop constraint if exists document_templates_document_type_check;

alter table document_templates
  add constraint document_templates_document_type_check
  check (document_type in ('contract_b', 'contract_professional', 'certificate_b', 'certificate_professional'));

alter table document_templates
  alter column branch_id set not null,
  alter column document_type set not null;

alter table document_templates
  drop constraint if exists uq_document_templates_branch_type;

alter table document_templates
  add constraint uq_document_templates_branch_type unique (branch_id, document_type);

alter table document_templates enable row level security;

comment on table document_templates is 'Contenido editable por cláusula/sección de contratos y certificados generados vía Edge Function. Una fila por sede x tipo de documento. El texto puede contener placeholders {{token}} sustituidos en runtime por supabase/functions/_shared/template-tokens.ts — ver specs/specs/0016-m-editor-plantillas-documentos/plan.md.';

comment on column document_templates.content is
  'JSON con las claves de cláusula/sección editables de ese tipo de documento (ej. "primero", '
  '"segundo", ..., "quinto", "sexto"). Ver tabla de tokens disponibles por cláusula en el plan.';

-- ─── 2. RLS — el contenido pasa a ser sensible (texto legal) y sin consumidores fuera de admin ──

drop policy if exists select_document_templates on document_templates;
drop policy if exists insert_document_templates on document_templates;
drop policy if exists update_document_templates on document_templates;
drop policy if exists delete_document_templates on document_templates;

create policy select_document_templates on document_templates
  for select using (auth_user_role() = 'admin');

create policy insert_document_templates on document_templates
  for insert with check (auth_user_role() = 'admin');

create policy update_document_templates on document_templates
  for update using (auth_user_role() = 'admin');

-- Sin policy de DELETE: nunca se borran filas, siempre UPSERT sobre (branch_id, document_type).

-- ─── 3. Seed — texto hardcodeado actual, transcrito 1:1 desde el código fuente ──────────────────
--
-- Branch 1 = Autoescuela Chillán, Branch 2 = Conductores Chillán (branches.id confirmado contra
-- el ambiente real, 2026-09-16).
--
-- Los certificados hoy están hardcodeados para UNA sola sede (Conductores Chillán, vía la
-- constante SCHOOL en cada Edge Function) — bug preexistente. Por decisión del owner (2026-09-16),
-- la fila de Autoescuela Chillán se siembra con sus datos reales (nombre, RUT societario,
-- dirección, teléfono) en vez de heredar ese bug de branding.
--
-- El párrafo de identificación de partes del contrato (fecha/nombre/RUT/dirección/teléfono del
-- alumno) NO se migra acá — queda fuera del alcance editable (ver spec §4 Out of scope), sigue
-- hardcodeado en _shared/contract-pdf.ts.

-- ── Contrato Clase B ──

insert into document_templates (branch_id, document_type, name, content)
values
  (
    2,
    'contract_b',
    'Contrato Clase B — Conductores Chillán',
    jsonb_build_object(
      'primero',
      'El Alumno se compromete por este acto a asistir al 100% de las 12 clases prácticas de '
      'conducción (una hora pedagógica cada clase, normado por Decreto 39/1985) con el objetivo '
      'de adquirir las habilidades necesarias para optar a obtener Licencia Clase B. Si el '
      'alumno falta a dos clases seguidas, estas horas se perderán y se desprogramará el '
      'calendario siguiente pactado. Para recuperar las clases perdidas, se deberá cancelar '
      '$9.000 por cada una.',
      'segundo',
      'Las {{claseTeoricas}} clases teóricas serán vía Zoom desde las 19:00 a 21:00 hrs. En caso '
      'de no poder estar presente en la clase, esta se debe solicitar vía correo electrónico, y '
      'se podrá acceder al taller de psicotécnico las veces que necesite.',
      'tercero',
      'Conductores Chillán proporcionará el vehículo para rendir el examen práctico sólo en la '
      'Dirección de Tránsito de Chillán, para la fecha y hora solicitada por ésta, no '
      'pudiéndose repetir este proceso ante un fracaso en el examen práctico.',
      'cuarto',
      'Conductores Chillán se reserva el derecho de cambio del instructor o vehículo, si '
      'concurren para ello motivos que lo avalen. De igual manera el Alumno podrá solicitar '
      'cambio de instructor, quedando sujeto a la aprobación del director de la Escuela.',
      'quinto',
      'El valor acordado del curso es de {{valorCurso}}{{textoDescuento}}, que el Alumno paga en '
      'este acto la cantidad de {{montoPagado}}, quedando un saldo de {{saldoPendiente}}, que se '
      'deberá pagar en la SEXTA CLASE. Si se llegase a poner término anticipado a este contrato, '
      'de lo abonado se descontarán las clases realizadas ($10.000 por clase práctica). Ante '
      'cualquier retraso o pago fuera de los plazos, facultará a Conductores Chillán para '
      'ejercer los derechos de cobranza que estime conveniente.',
      'sexto',
      'Los datos personales del Alumno serán tratados por Sociedad Comercial Chillán Capacita '
      'Ltda. conforme a la Ley N° 21.719 sobre protección de datos personales, con la finalidad '
      'de ejecutar este contrato de matrícula y cumplir las obligaciones legales asociadas '
      '(libro de registro de alumnos, acreditación de horas e informes a la autoridad). Se '
      'conservarán por 5 años desde el egreso o baja del Alumno. El Alumno puede ejercer sus '
      'derechos de acceso, rectificación, cancelación, oposición y portabilidad escribiendo a '
      '{{emailContacto}}. El detalle completo del tratamiento está en la Política de Privacidad, '
      'disponible en {{politicaPrivacidadUrl}}.'
    )
  ),
  (
    1,
    'contract_b',
    'Contrato Clase B — Autoescuela Chillán',
    jsonb_build_object(
      'primero',
      'El Alumno se compromete por este acto a asistir al 100% de las 12 clases prácticas de '
      'conducción (una hora pedagógica cada clase, normado por Decreto 39/1985) con el objetivo '
      'de adquirir las habilidades necesarias para optar a obtener Licencia Clase B. Si el '
      'alumno falta a dos clases seguidas, estas horas se perderán y se desprogramará el '
      'calendario siguiente pactado. Para recuperar las clases perdidas, se deberá cancelar '
      '$9.000 por cada una.',
      'segundo',
      'Las {{claseTeoricas}} clases teóricas serán vía Zoom desde las 19:00 a 21:00 hrs. En caso '
      'de no poder estar presente en la clase, esta se debe solicitar vía correo electrónico, y '
      'se podrá acceder al taller de psicotécnico las veces que necesite.',
      'tercero',
      'Autoescuela Chillán proporcionará el vehículo para rendir el examen práctico sólo en la '
      'Dirección de Tránsito de Chillán, para la fecha y hora solicitada por ésta, no '
      'pudiéndose repetir este proceso ante un fracaso en el examen práctico.',
      'cuarto',
      'Autoescuela Chillán se reserva el derecho de cambio del instructor o vehículo, si '
      'concurren para ello motivos que lo avalen. De igual manera el Alumno podrá solicitar '
      'cambio de instructor, quedando sujeto a la aprobación del director de la Escuela.',
      'quinto',
      'El valor acordado del curso es de {{valorCurso}}{{textoDescuento}}, que el Alumno paga en '
      'este acto la cantidad de {{montoPagado}}, quedando un saldo de {{saldoPendiente}}, que se '
      'deberá pagar en la SEXTA CLASE. Si se llegase a poner término anticipado a este contrato, '
      'de lo abonado se descontarán las clases realizadas ($10.000 por clase práctica). Ante '
      'cualquier retraso o pago fuera de los plazos, facultará a Autoescuela Chillán para '
      'ejercer los derechos de cobranza que estime conveniente.',
      'sexto',
      'Los datos personales del Alumno serán tratados por Jorge Enrique Pérez Godoy '
      'Capacitación y Servicios EIRL conforme a la Ley N° 21.719 sobre protección de datos '
      'personales, con la finalidad de ejecutar este contrato de matrícula y cumplir las '
      'obligaciones legales asociadas (libro de registro de alumnos, acreditación de horas e '
      'informes a la autoridad). Se conservarán por 5 años desde el egreso o baja del Alumno. El '
      'Alumno puede ejercer sus derechos de acceso, rectificación, cancelación, oposición y '
      'portabilidad escribiendo a {{emailContacto}}. El detalle completo del tratamiento está en '
      'la Política de Privacidad, disponible en {{politicaPrivacidadUrl}}.'
    )
  )
on conflict (branch_id, document_type) do nothing;

-- ── Contrato Clase Profesional ──
--
-- Solo Conductores Chillán (branch_id=2) dicta cursos profesionales (A2/A3/A4/A5) — confirmado
-- contra `courses` real, 2026-09-16: 0 cursos profesionales en Autoescuela Chillán (branch_id=1).
-- No se siembra fila para branch_id=1: ese documento nunca se genera para esa sede.

insert into document_templates (branch_id, document_type, name, content)
values
  (
    2,
    'contract_professional',
    'Contrato Profesional — Conductores Chillán',
    jsonb_build_object(
      'primero',
      'El Sr(a). {{nombreAlumno}} se matricula en este acto en Conductores Chillán, en el Curso '
      'de Conducción para optar a la Licencia Profesional Clase {{claseLicencia}} tal como lo '
      'determina el Artículo N°16, Inciso N°7, del Decreto N°251/98.',
      'segundo',
      'El alumno se compromete a asistir al curso enunciado precedentemente, que tiene una '
      'duración de {{horasCurso}} horas, según consta en Resolución N°467 de fecha 27/12/2013 '
      'del Ministerio de Transporte y Telecomunicaciones, Artículo N°7 del Decreto N°251/98. La '
      'concurrencia no puede ser inferior a un 80% de las clases teóricas y un 100% a las clases '
      'prácticas. El curso se aprobará con un 75% de calificación general como mínimo.',
      'tercero',
      'En este acto el Alumno presenta en ORIGINAL los siguientes documentos, dejando una copia '
      'de cada uno: Certificado de Antecedentes y Hoja de Vida del Conductor. En FOTOCOPIA, '
      'Cédula de Identidad y Licencia de Conducir por ambos lados. Además, debe haber aprobado '
      'el examen sicológico (Test EPQ-R) previamente realizado.',
      'cuarto',
      'Al término del curso, previa aprobación de todos los módulos (mínimo un 75%) y '
      'cumplimiento de los porcentajes de asistencia señalados en la cláusula SEGUNDO, se le '
      'otorgará por ÚNICA VEZ un certificado nominativo e intransferible, foliado y emitido por '
      'la Casa de Moneda de Chile. En caso de extravío deberá dar aviso al Ministerio de '
      'Transporte y Telecomunicaciones, mediante carta certificada explicando los motivos de la '
      'pérdida. Paralelamente deberá comunicar el extravío en un diario de la región.',
      'quinto',
      'El valor acordado del curso es de {{valorCurso}}{{textoDescuento}}, que el Alumno paga en '
      'este acto la cantidad de {{montoPagado}}, quedando un saldo de {{saldoPendiente}}, que se '
      'deberá pagar en la SEXTA CLASE. Si se llegase a poner término anticipado a este contrato, '
      'de lo abonado se descontarán las clases realizadas ($10.000 por clase práctica). Ante '
      'cualquier retraso o pago fuera de los plazos, facultará a Conductores Chillán para '
      'ejercer los derechos de cobranza que estime conveniente.',
      'sexto',
      'Los datos personales del Alumno serán tratados por Sociedad Comercial Chillán Capacita '
      'Ltda. conforme a la Ley N° 21.719 sobre protección de datos personales, con la finalidad '
      'de ejecutar este contrato de matrícula y cumplir las obligaciones legales asociadas '
      '(libro de registro de alumnos, acreditación de horas e informes a la autoridad). Se '
      'conservarán por 5 años desde el egreso o baja del Alumno. El Alumno puede ejercer sus '
      'derechos de acceso, rectificación, cancelación, oposición y portabilidad escribiendo a '
      '{{emailContacto}}. El detalle completo del tratamiento está en la Política de Privacidad, '
      'disponible en {{politicaPrivacidadUrl}}.'
    )
  )
on conflict (branch_id, document_type) do nothing;

-- ── Certificado Clase B ──

insert into document_templates (branch_id, document_type, name, content)
values
  (
    2,
    'certificate_b',
    'Certificado Clase B — Conductores Chillán',
    jsonb_build_object(
      'encabezado_nombre', 'CONDUCTORES CHILLAN',
      'encabezado_subtitulo', 'ESCUELA DE CONDUCTORES NO PROFESIONALES',
      'encabezado_direccion', 'CARRERA 74 FONO 2244030 WWW.CONDUCTORESCHILLAN.CL',
      'intro',
      'JORGE ENRIQUE PEREZ GODOY representante legal, de CONDUCTORES CHILLAN Escuela de '
      'Conductores No Profesional Clase B Rut: 77.940.120-0, mediante el presente documento '
      'certifica que:',
      'cuerpo',
      'Realizó el Curso de Conducción Clase B, Conocimiento Teórico del Tránsito y Mecánica '
      'Básica en Nuestra Escuela entre los días {{fechaInicio}} al {{fechaFin}} aprobando '
      'satisfactoriamente.',
      'cierre', 'Se extiende el presente certificado para acreditar curso.',
      'firma_nombre', 'VICTORIA NAVARRETE UTRERAS',
      'firma_cargo', 'ENCARGADA DE MATRICULA'
    )
  ),
  (
    1,
    'certificate_b',
    'Certificado Clase B — Autoescuela Chillán',
    jsonb_build_object(
      'encabezado_nombre', 'AUTOESCUELA CHILLAN',
      'encabezado_subtitulo', 'ESCUELA DE CONDUCTORES NO PROFESIONALES',
      'encabezado_direccion', 'MAIPON 418 FONO 2327800 WWW.AUTOESCUELACHILLAN.CL',
      'intro',
      'JORGE ENRIQUE PEREZ GODOY representante legal, de AUTOESCUELA CHILLAN Escuela de '
      'Conductores No Profesional Clase B Rut: 76.007.217-6, mediante el presente documento '
      'certifica que:',
      'cuerpo',
      'Realizó el Curso de Conducción Clase B, Conocimiento Teórico del Tránsito y Mecánica '
      'Básica en Nuestra Escuela entre los días {{fechaInicio}} al {{fechaFin}} aprobando '
      'satisfactoriamente.',
      'cierre', 'Se extiende el presente certificado para acreditar curso.',
      'firma_nombre', 'VICTORIA NAVARRETE UTRERAS',
      'firma_cargo', 'ENCARGADA DE MATRICULA'
    )
  )
on conflict (branch_id, document_type) do nothing;

-- ── Certificado Clase Profesional ──
--
-- Solo Conductores Chillán (branch_id=2) dicta cursos profesionales — misma razón que Contrato
-- Profesional arriba. No se siembra fila para branch_id=1.

insert into document_templates (branch_id, document_type, name, content)
values
  (
    2,
    'certificate_professional',
    'Certificado Profesional — Conductores Chillán',
    jsonb_build_object(
      'encabezado_nombre', 'CONDUCTORES CHILLAN',
      'encabezado_subtitulo', 'ESCUELA DE CONDUCTORES PROFESIONALES',
      'encabezado_direccion', 'CARRERA 74 FONO 2244030 WWW.CONDUCTORESCHILLAN.CL',
      'intro',
      'JORGE ENRIQUE PEREZ GODOY representante legal, de CONDUCTORES CHILLAN Escuela de '
      'Conductores Profesionales Rut: 77.940.120-0, mediante el presente documento certifica '
      'que:',
      'cuerpo',
      'Realizó el Curso de {{cursoLabel}} en Nuestra Escuela entre los días {{fechaInicio}} al '
      '{{fechaFin}} aprobando satisfactoriamente.',
      'cierre', 'Se extiende el presente certificado para acreditar curso.',
      'firma_nombre', 'VICTORIA NAVARRETE UTRERAS',
      'firma_cargo', 'ENCARGADA DE MATRICULA'
    )
  )
on conflict (branch_id, document_type) do nothing;
