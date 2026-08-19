// Política de Privacidad y textos legales del punto de captura (spec 0009-m, Ley 21.719).
//
// ⚠️ ESTE ARCHIVO ES CONTENIDO LEGAL, NO COPY DE PRODUCTO.
// Los textos están transcritos de `.compliance/docs/{conductores,autoescuela}/`, que son los
// documentos que respaldan el expediente de cumplimiento. NO redactar, resumir ni "mejorar"
// nada acá: si un texto tiene que cambiar, se cambia primero en `.compliance/` y se sincroniza.
//
// Son DOS políticas, una por sociedad, y no una genérica: `Autoescuela Chillán` y
// `Conductores Chillán` son dos responsables distintos que responden por separado ante la
// Agencia de Protección de Datos Personales.

/**
 * Versión de la política vigente. Se persiste en `consents.policy_version` (AC-E4).
 *
 * Constante en código y no tabla: cambia una o dos veces por década, y así queda
 * versionada en git junto al texto que describe. **Al editar cualquier texto de este
 * archivo hay que subir esta fecha**, o los consentimientos nuevos quedarán apuntando a
 * una versión que ya no es la que el titular leyó.
 */
export const PRIVACY_POLICY_VERSION = '2026-08-17';

/**
 * País donde Supabase aloja la base de datos, tal como se le declara al titular.
 *
 * ⚠️ **`null` a propósito: al 2026-08-17 todavía no se decidió entre Brasil y Estados Unidos.**
 * Mientras siga en `null`, la política dice solo "fuera de Chile" — que es verdad — en vez de
 * afirmar un país que podría ser falso. Declararle al titular un destino equivocado es
 * exactamente el tipo de defecto que la Ley 21.719 sanciona, así que **no se rellena con una
 * suposición**.
 *
 * Al crear el proyecto de Supabase se elige la región: en ese momento hay que fijar este valor
 * y subir `PRIVACY_POLICY_VERSION`. `getPolicyPublishBlockers()` lo reporta hasta entonces.
 */
export const SUPABASE_HOSTING_COUNTRY: string | null = null;

/**
 * Datos que la política le declara al titular y que aún no están confirmados.
 *
 * Existe para que el pendiente sea consultable desde el código y desde un test, en vez de vivir
 * en la memoria de alguien. Devuelve `[]` cuando la política es publicable sin reservas.
 */
export function getPolicyPublishBlockers(): string[] {
  const blockers: string[] = [];
  if (!SUPABASE_HOSTING_COUNTRY) {
    blockers.push(
      'SUPABASE_HOSTING_COUNTRY sin definir: la política declara la transferencia internacional ' +
        'sin indicar el país de destino. Fijarlo al elegir la región del proyecto de Supabase.',
    );
  }
  return blockers;
}

/** Frase de transferencia internacional, honesta con lo que efectivamente se sabe hoy. */
function internationalTransferText(): string {
  const supabaseDestination = SUPABASE_HOSTING_COUNTRY
    ? `fuera de Chile, en ${SUPABASE_HOSTING_COUNTRY}`
    : 'fuera de Chile';
  return (
    `Supabase procesa datos ${supabaseDestination}. Google y Zoom procesan datos fuera de Chile, ` +
    'en Estados Unidos. Nuestro servidor de correo está alojado en Warrenton, Virginia, Estados ' +
    'Unidos, sobre infraestructura de OVH SAS. Todas esas transferencias se amparan en las ' +
    'Cláusulas Contractuales Modelo aprobadas por el Ministerio de Economía (Resolución ' +
    'RAEX202503748, Diario Oficial de 19-12-2025).'
  );
}

// ─── Estructura del documento ───

export interface PolicyParagraph {
  kind: 'paragraph';
  text: string;
}

export interface PolicyList {
  kind: 'list';
  items: string[];
}

export interface PolicyTable {
  kind: 'table';
  headers: string[];
  rows: string[][];
}

export type PolicyBlock = PolicyParagraph | PolicyList | PolicyTable;

export interface PolicySection {
  heading: string;
  blocks: PolicyBlock[];
}

export interface PrivacyPolicyContent {
  /** Coincide con `branches.slug`. Es el parámetro de la ruta pública. */
  branchSlug: string;
  /** Nombre comercial de la sede, para orientar al alumno. */
  branchName: string;
  /** Razón social del responsable del tratamiento. */
  legalName: string;
  rut: string;
  address: string;
  businessLine: string;
  /** Correo del canal de ejercicio de derechos. */
  rightsEmail: string;
  lastUpdated: string;
  effectiveFrom: string;
  sections: PolicySection[];
  /** Aviso del Art. 14 ter para el paso de datos personales de la matrícula. */
  enrollmentNotice: string;
  /** Aviso del Art. 14 ter para el formulario de preinscripción. */
  preEnrollmentNotice: string;
  /** Etiqueta de la casilla de declaración de lectura de la política (AC3). */
  policyCheckboxLabel: string;
  /** Etiqueta de la casilla de autorización expresa del Art. 16 (AC4). */
  medicalCertCheckboxLabel: string;
  /** Etiqueta de la casilla que otorga el representante legal de un menor (AC7). */
  representativeCheckboxLabel: string;
}

// ─── Bloques comunes ───
//
// Solo se comparte lo que es LITERALMENTE idéntico en ambos documentos de `.compliance/`.
// Todo lo demás está duplicado a propósito: las dos sociedades tienen tratamientos distintos
// (la OTEC rinde a SENCE e informa al empleador; la escuela de conductores informa a MTT y a
// la Municipalidad) y factorizar esas diferencias haría fácil equivocarse al editarlas.

/**
 * §5 comparte el cuerpo, pero no las excepciones: solo Conductores Chillán aplica el
 * cuestionario EPQ, porque los cursos profesionales son suyos.
 */
function retentionSection(extraRows: string[][] = []): PolicySection {
  const section = structuredClone(RETENTION_SECTION);
  const table = section.blocks.find((b) => b.kind === 'table');
  if (table?.kind === 'table') table.rows.push(...extraRows);
  return section;
}

const RETENTION_SECTION: PolicySection = {
  heading: '5. Por cuánto tiempo',
  blocks: [
    {
      kind: 'paragraph',
      text:
        'Conservamos tu información 5 años contados desde que egresas del curso o te das de baja. ' +
        'Vencido ese plazo, la eliminamos o la anonimizamos.',
    },
    { kind: 'paragraph', text: 'Excepciones:' },
    {
      kind: 'table',
      headers: ['Dato', 'Plazo', 'Motivo'],
      rows: [
        ['Documentación tributaria (boletas, pagos)', '6 años', 'Plazo del Código Tributario'],
        [
          'Grabaciones de las cámaras de seguridad',
          '30 días',
          'Plazo proporcional al fin de seguridad',
        ],
        [
          'Datos de preinscripción sin matrícula concretada',
          '12 meses',
          'No hay contrato que justifique conservarlos más',
        ],
        ['Registros técnicos de acceso (IP)', '2 años', 'Suficiente para investigar un incidente'],
      ],
    },
  ],
};

const AUTOMATED_DECISIONS_SECTION: PolicySection = {
  heading: '7. Decisiones automatizadas',
  blocks: [
    {
      kind: 'paragraph',
      text:
        'No tomamos decisiones automatizadas ni elaboramos perfiles con efectos jurídicos o ' +
        'significativos sobre ti. Todas las decisiones sobre tu curso, tus evaluaciones y tu ' +
        'certificación las toma una persona.',
    },
  ],
};

const SECURITY_SECTION: PolicySection = {
  heading: '9. Seguridad',
  blocks: [
    {
      kind: 'paragraph',
      text: 'Aplicamos medidas técnicas y organizativas proporcionales al riesgo:',
    },
    {
      kind: 'list',
      items: [
        'Cifrado en tránsito (HTTPS/TLS) en toda la aplicación.',
        'Control de acceso por roles a nivel de base de datos: cada usuario solo alcanza los datos que su rol permite.',
        'Contraseñas almacenadas con funciones de hash, nunca en texto plano, y cambio obligatorio en el primer ingreso.',
        'Registro de auditoría inmutable de las acciones realizadas sobre los datos.',
        'Acceso a tus documentos mediante enlaces temporales que expiran.',
        'Credenciales y secretos fuera del código fuente.',
      ],
    },
  ],
};

const CHANGES_SECTION: PolicySection = {
  heading: '10. Cambios',
  blocks: [
    {
      kind: 'paragraph',
      text:
        'Podemos actualizar esta política. Publicaremos siempre la versión vigente con su fecha, y ' +
        'si el cambio te afecta de forma relevante te lo informaremos por correo.',
    },
  ],
};

const COMPLAINTS_SECTION: PolicySection = {
  heading: '11. Reclamos',
  blocks: [
    {
      kind: 'paragraph',
      text:
        'Si consideras que no hemos respetado tus derechos, puedes reclamar ante la Agencia de ' +
        'Protección de Datos Personales de Chile.',
    },
  ],
};

/** §6 es idéntico salvo el correo y el ejemplo de dato que no se puede eliminar antes de tiempo. */
function rightsSection(rightsEmail: string, retentionExample: string): PolicySection {
  return {
    heading: '6. Tus derechos',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, portabilidad ' +
          `y bloqueo, y retirar tu consentimiento en cualquier momento, escribiendo a ${rightsEmail}.`,
      },
      {
        kind: 'paragraph',
        text:
          'Respondemos dentro de 30 días corridos, prorrogables una sola vez por hasta 30 días ' +
          'corridos más, avisándote si necesitamos la prórroga.',
      },
      {
        kind: 'paragraph',
        text:
          'La rectificación, la supresión y la oposición son siempre gratuitas. El acceso es ' +
          'gratuito al menos una vez por trimestre.',
      },
      {
        kind: 'paragraph',
        text:
          'Ten presente que algunos datos no podemos eliminarlos antes de tiempo porque una ley nos ' +
          `obliga a conservarlos (por ejemplo, ${retentionExample}). Si es tu caso, te lo ` +
          'explicaremos indicando la norma concreta.',
      },
      { kind: 'paragraph', text: 'No te enviamos publicidad.' },
      {
        kind: 'paragraph',
        text:
          'No enviamos correos promocionales ni publicidad. Los correos que recibes son siempre ' +
          'sobre tu curso: enlaces de clase, certificados y avisos operacionales. Tampoco cedemos ' +
          'tus datos a terceros con fines publicitarios.',
      },
    ],
  };
}

// ─── Conductores Chillán (escuela de conducción) ───

const CONDUCTORES: PrivacyPolicyContent = {
  branchSlug: 'conductores-chillan',
  branchName: 'Conductores Chillán',
  legalName: 'Sociedad Comercial Chillán Capacita Limitada',
  rut: '77.940.120-0',
  address: 'Carrera 74, Chillán, Región de Ñuble',
  businessLine: 'Educación extraescolar — Escuela de conducción',
  rightsEmail: 'conductorchillan@gmail.com',
  lastUpdated: '16 de agosto de 2026',
  effectiveFrom: '1 de diciembre de 2026 (vigencia de la Ley 21.719)',

  enrollmentNotice:
    'Al matricularte, Sociedad Comercial Chillán Capacita Limitada tratará tus datos de ' +
    'identificación, contacto, académicos, de pago y los documentos de tu expediente para ' +
    'impartirte el curso, certificar tu egreso y cumplir las obligaciones que la normativa de ' +
    'escuelas de conductores nos impone (libro de registro de alumnos, acreditación de horas ' +
    'mínimas e informes a la autoridad). Conservamos tu información 5 años desde tu egreso o baja.',
  preEnrollmentNotice:
    'Los datos que nos entregas (nombre, RUT, correo y teléfono) los trata Sociedad Comercial ' +
    'Chillán Capacita Limitada, RUT 77.940.120-0, para contactarte y gestionar tu preinscripción ' +
    'en el curso que elegiste. Si no concretas la matrícula, los eliminamos a los 12 meses. Puedes ' +
    'ejercer tus derechos escribiendo a conductorchillan@gmail.com.',
  policyCheckboxLabel:
    'Declaro haber leído la Política de Privacidad de Sociedad Comercial Chillán Capacita Limitada.',
  medicalCertCheckboxLabel:
    'Autorizo expresamente que Sociedad Comercial Chillán Capacita Limitada trate mi certificado ' +
    'médico, que es un dato de salud, con el único fin de acreditar mi aptitud para cursar y ' +
    'obtener la licencia, conforme lo exige la normativa de escuelas de conductores. Entiendo que ' +
    'no se usará para ninguna otra finalidad ni se compartirá con terceros distintos de la ' +
    'autoridad competente.',
  representativeCheckboxLabel:
    'En mi calidad de padre/madre/representante legal del alumno, autorizo el tratamiento de sus ' +
    'datos personales en los términos de la Política de Privacidad, y autorizo expresamente el ' +
    'tratamiento de su certificado médico.',

  sections: [
    {
      heading: '1. Responsable del tratamiento',
      blocks: [
        {
          kind: 'paragraph',
          text:
            'Sociedad Comercial Chillán Capacita Limitada, RUT 77.940.120-0, con domicilio en ' +
            'Carrera 74, Chillán, Región de Ñuble. Giro: Educación extraescolar — Escuela de conducción.',
        },
        {
          kind: 'paragraph',
          text: 'Contacto para todo lo relativo a datos personales: conductorchillan@gmail.com',
        },
      ],
    },
    {
      heading: '2. Qué datos tratamos',
      blocks: [
        {
          kind: 'list',
          items: [
            'Datos de identificación y contacto: nombres y apellidos, RUT, correo electrónico, teléfono, domicilio, fecha de nacimiento y género.',
            'Datos académicos: curso en que te matriculaste, asistencia, horas teóricas y prácticas cursadas, evaluaciones, observaciones de tu instructor y resultado del curso.',
            'Documentos de tu expediente: cédula de identidad, fotografía, Hoja de Vida del Conductor y certificado médico.',
            'Datos de pago: monto, medio de pago, número de boleta y estado de tu cuenta.',
            'Datos técnicos: dirección IP y registro de tus accesos al sistema, con fines de seguridad.',
            'Imágenes: nuestras instalaciones cuentan con cámaras de seguridad, debidamente señalizadas.',
            'Evaluación psicológica (solo cursos profesionales): si te preinscribes en línea a un curso profesional, las respuestas que das al cuestionario EPQ y el resultado de su evaluación.',
          ],
        },
        { kind: 'paragraph', text: 'Datos sensibles' },
        {
          kind: 'paragraph',
          text: 'Tratamos dos datos sensibles, ambos solo con tu autorización expresa y para nada más:',
        },
        {
          kind: 'paragraph',
          text:
            'El certificado médico es un dato de salud. Lo tratamos únicamente porque la normativa ' +
            'de escuelas de conductores exige acreditar tu aptitud para conducir. No lo usamos para ' +
            'ninguna otra finalidad ni lo compartimos con terceros distintos de la autoridad competente.',
        },
        {
          kind: 'paragraph',
          text:
            'El cuestionario psicológico EPQ de los cursos profesionales es un dato de salud ' +
            'psíquica. Conservamos tus respuestas porque un profesional debe poder revisarlas una ' +
            'por una para evaluarte, y porque puede necesitar volver sobre ellas si pides una nueva ' +
            'evaluación. La decisión de aptitud la toma siempre una persona: ningún programa puntúa ' +
            'ni interpreta tus respuestas automáticamente. Si prefieres no responderlo en línea, ' +
            'puedes rendirlo en papel, presencialmente en la escuela, y en ese caso no guardamos ' +
            'ninguna respuesta en el sistema.',
        },
        { kind: 'paragraph', text: 'Menores de edad' },
        {
          kind: 'paragraph',
          text:
            'Si eres menor de edad, tu matrícula requiere la autorización notarial de tu padre, ' +
            'madre o representante legal, quien también ejerce tus derechos sobre estos datos. ' +
            'Tratamos los datos de menores con especial resguardo.',
        },
      ],
    },
    {
      heading: '3. Finalidad y base de licitud',
      blocks: [
        {
          kind: 'table',
          headers: ['Finalidad', 'Base de licitud'],
          rows: [
            [
              'Matricularte, ejecutar el contrato e impartir el curso',
              'Ejecución del contrato de matrícula',
            ],
            [
              'Llevar el libro de clases, el registro de alumnos y acreditar las horas mínimas',
              'Obligación legal (normativa de escuelas de conductores)',
            ],
            [
              'Tratar tu certificado médico',
              'Tu consentimiento expreso (Art. 16) y la exigencia normativa de acreditar aptitud',
            ],
            [
              'Aplicar y evaluar el cuestionario psicológico EPQ (cursos profesionales)',
              'Tu consentimiento expreso (Art. 16)',
            ],
            ['Emitir certificados y documentación de licencia', 'Obligación legal'],
            [
              'Cobrar y emitir documentos tributarios',
              'Ejecución del contrato y obligación legal tributaria',
            ],
            [
              'Informar a MTT, la Municipalidad y SENCE lo que exige la normativa',
              'Obligación legal',
            ],
            [
              'Comunicarnos contigo sobre tu curso (correos, enlaces de clase, certificados)',
              'Ejecución del contrato',
            ],
            [
              'Videovigilancia de nuestras instalaciones',
              'Interés legítimo en la seguridad de personas y bienes',
            ],
            [
              'Registrar accesos al sistema para detectar usos indebidos',
              'Interés legítimo en la seguridad, y nuestro deber legal de seguridad',
            ],
            [
              'Encuestas de satisfacción una vez egresado',
              'Tu consentimiento — participar es voluntario',
            ],
          ],
        },
      ],
    },
    {
      heading: '4. Con quién compartimos los datos',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Proveedores que tratan datos por cuenta nuestra (encargados):',
        },
        {
          kind: 'list',
          items: [
            'Supabase Inc. — infraestructura de base de datos, almacenamiento de archivos y autenticación.',
            'OVH SAS — la infraestructura que aloja nuestro sitio web y nuestro servidor de correo (cPanel), desde el que te llegan nuestros correos: certificados, enlaces de clase y avisos.',
            'Google — la casilla de correo por la que nos escribes para ejercer tus derechos.',
            'Zoom — clases en línea, cuando el curso las contempla.',
          ],
        },
        {
          kind: 'paragraph',
          text: internationalTransferText(),
        },
        { kind: 'paragraph', text: 'Organismos públicos a los que informamos por mandato legal:' },
        {
          kind: 'list',
          items: [
            'Ministerio de Transportes y Telecomunicaciones (MTT) — respecto de los cursos profesionales.',
            'Municipalidad — en lo relativo al reconocimiento oficial y la fiscalización de la escuela.',
            'SENCE — respecto de los cursos con financiamiento o franquicia.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'No vendemos tus datos personales, ni los cedemos con fines publicitarios a terceros.',
        },
      ],
    },
    retentionSection([
      [
        'Respuestas del cuestionario psicológico EPQ',
        '12 meses si no te matriculas; 5 años si te matriculas',
        'Mismo plazo que la preinscripción o el expediente que lo contiene',
      ],
    ]),
    rightsSection(
      'conductorchillan@gmail.com',
      'el libro de registro de alumnos y la documentación tributaria',
    ),
    AUTOMATED_DECISIONS_SECTION,
    {
      heading: '8. Origen de los datos',
      blocks: [
        {
          kind: 'paragraph',
          text:
            'Los datos nos los entregas tú directamente al preinscribirte o matricularte. Si eres ' +
            'menor de edad, los entrega además tu representante legal. No obtenemos datos tuyos ' +
            'desde fuentes de terceros.',
        },
      ],
    },
    SECURITY_SECTION,
    CHANGES_SECTION,
    COMPLAINTS_SECTION,
  ],
};

// ─── Autoescuela Chillán (OTEC) ───

const AUTOESCUELA: PrivacyPolicyContent = {
  branchSlug: 'autoescuela-chillan',
  branchName: 'Autoescuela Chillán',
  legalName: 'Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL',
  rut: '76.007.217-6',
  address: 'Maipón 418, Chillán, Región de Ñuble',
  businessLine: 'Educación extraescolar — Escuela de conducción',
  rightsEmail: 'otecchillan@gmail.com',
  lastUpdated: '16 de agosto de 2026',
  effectiveFrom: '1 de diciembre de 2026 (vigencia de la Ley 21.719)',

  enrollmentNotice:
    'Al matricularte, Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL tratará tus datos de ' +
    'identificación, contacto, académicos, de pago y los documentos de tu expediente para ' +
    'impartirte el curso, certificar tu egreso y cumplir las obligaciones que la normativa nos ' +
    'impone, incluida la rendición ante SENCE cuando corresponda. Conservamos tu información 5 ' +
    'años desde tu egreso o baja.',
  preEnrollmentNotice:
    'Los datos que nos entregas (nombre, RUT, correo y teléfono) los trata Jorge Enrique Pérez ' +
    'Godoy Capacitación y Servicios EIRL, RUT 76.007.217-6, para contactarte y gestionar tu ' +
    'preinscripción en el curso que elegiste. Si no concretas la matrícula, los eliminamos a los ' +
    '12 meses. Puedes ejercer tus derechos escribiendo a otecchillan@gmail.com.',
  policyCheckboxLabel:
    'Declaro haber leído la Política de Privacidad de Jorge Enrique Pérez Godoy Capacitación y ' +
    'Servicios EIRL.',
  medicalCertCheckboxLabel:
    'Autorizo expresamente que Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL trate mi ' +
    'certificado médico, que es un dato de salud, con el único fin de acreditar mi aptitud para ' +
    'cursar, conforme lo exige la normativa aplicable al curso. Entiendo que no se usará para ' +
    'ninguna otra finalidad ni se compartirá con terceros distintos de la autoridad competente.',
  representativeCheckboxLabel:
    'En mi calidad de padre/madre/representante legal del alumno, autorizo el tratamiento de sus ' +
    'datos personales en los términos de la Política de Privacidad, y autorizo expresamente el ' +
    'tratamiento de su certificado médico.',

  sections: [
    {
      heading: '1. Responsable del tratamiento',
      blocks: [
        {
          kind: 'paragraph',
          text:
            'Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL, RUT 76.007.217-6, con ' +
            'domicilio en Maipón 418, Chillán, Región de Ñuble. Giro: Educación extraescolar — Escuela de conducción.',
        },
        {
          kind: 'paragraph',
          text: 'Contacto para todo lo relativo a datos personales: otecchillan@gmail.com',
        },
      ],
    },
    {
      heading: '2. Qué datos tratamos',
      blocks: [
        {
          kind: 'list',
          items: [
            'Datos de identificación y contacto: nombres y apellidos, RUT, correo electrónico, teléfono, domicilio, fecha de nacimiento y género.',
            'Datos académicos: curso en que te matriculaste, asistencia, horas cursadas, evaluaciones, observaciones de tu relator o instructor y resultado del curso.',
            'Documentos de tu expediente: cédula de identidad, fotografía, Hoja de Vida del Conductor y certificado médico, según el curso de que se trate.',
            'Datos de pago: monto, medio de pago, número de boleta y estado de tu cuenta.',
            'Datos técnicos: dirección IP y registro de tus accesos al sistema, con fines de seguridad.',
            'Imágenes: nuestras instalaciones cuentan con cámaras de seguridad, debidamente señalizadas.',
          ],
        },
        {
          kind: 'paragraph',
          text:
            'Si te capacitas a través de tu empleador: además tratamos el nombre de la empresa y tu ' +
            'cargo, datos que nos entrega tu empleador para gestionar tu participación en el curso.',
        },
        { kind: 'paragraph', text: 'Datos sensibles' },
        {
          kind: 'paragraph',
          text:
            'El certificado médico es un dato sensible de salud. Lo tratamos únicamente porque la ' +
            'normativa sectorial exige acreditar tu aptitud, y solo con tu autorización expresa. No ' +
            'lo usamos para ninguna otra finalidad ni lo compartimos con terceros distintos de la ' +
            'autoridad competente.',
        },
        { kind: 'paragraph', text: 'Menores de edad' },
        {
          kind: 'paragraph',
          text:
            'Si eres menor de edad, tu matrícula requiere la autorización de tu padre, madre o ' +
            'representante legal, quien también ejerce tus derechos sobre estos datos. Tratamos los ' +
            'datos de menores con especial resguardo.',
        },
      ],
    },
    {
      heading: '3. Finalidad y base de licitud',
      blocks: [
        {
          kind: 'table',
          headers: ['Finalidad', 'Base de licitud'],
          rows: [
            [
              'Matricularte, ejecutar el contrato e impartir el curso',
              'Ejecución del contrato de matrícula',
            ],
            [
              'Llevar el libro de clases y acreditar tu asistencia y horas cursadas',
              'Obligación legal',
            ],
            [
              'Tratar tu certificado médico',
              'Tu consentimiento expreso (Art. 16) y la exigencia normativa de acreditar aptitud',
            ],
            ['Emitir tus certificados de aprobación', 'Obligación legal y ejecución del contrato'],
            [
              'Cobrar y emitir documentos tributarios',
              'Ejecución del contrato y obligación legal tributaria',
            ],
            [
              'Rendir e informar a SENCE los cursos con franquicia o financiamiento',
              'Obligación legal',
            ],
            [
              'Informar a tu empleador tu asistencia y resultado, cuando él financia el curso',
              'Ejecución del contrato entre tu empleador y nosotros',
            ],
            [
              'Comunicarnos contigo sobre tu curso (correos, enlaces de clase)',
              'Ejecución del contrato',
            ],
            [
              'Videovigilancia de nuestras instalaciones',
              'Interés legítimo en la seguridad de personas y bienes',
            ],
            [
              'Registrar accesos al sistema para detectar usos indebidos',
              'Interés legítimo en la seguridad, y nuestro deber legal de seguridad',
            ],
            [
              'Encuestas de satisfacción una vez egresado',
              'Tu consentimiento — participar es voluntario',
            ],
          ],
        },
      ],
    },
    {
      heading: '4. Con quién compartimos los datos',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Proveedores que tratan datos por cuenta nuestra (encargados):',
        },
        {
          kind: 'list',
          items: [
            'Supabase Inc. — infraestructura de base de datos, almacenamiento de archivos y autenticación.',
            'OVH SAS — la infraestructura que aloja nuestro sitio y nuestro servidor de correo (cPanel), desde el que te llegan nuestros correos: certificados, enlaces de clase y avisos.',
            'Google — la casilla de correo por la que nos escribes para ejercer tus derechos.',
            'Zoom — clases en línea, cuando el curso las contempla.',
          ],
        },
        {
          kind: 'paragraph',
          text: internationalTransferText(),
        },
        { kind: 'paragraph', text: 'Organismos y terceros a los que informamos:' },
        {
          kind: 'list',
          items: [
            'SENCE — respecto de los cursos con financiamiento o franquicia tributaria, por mandato legal.',
            'Tu empleador — si él financió tu curso, le informamos tu asistencia y tu resultado, que es lo que necesita para rendir la capacitación. No le entregamos tu certificado médico ni datos ajenos al curso.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'No vendemos tus datos personales, ni los cedemos con fines publicitarios a terceros.',
        },
      ],
    },
    RETENTION_SECTION,
    rightsSection(
      'otecchillan@gmail.com',
      'el respaldo de las rendiciones a SENCE y la documentación tributaria',
    ),
    AUTOMATED_DECISIONS_SECTION,
    {
      heading: '8. Origen de los datos',
      blocks: [
        {
          kind: 'paragraph',
          text:
            'Normalmente los datos nos los entregas tú al preinscribirte o matricularte. Si te ' +
            'capacitas a través de tu empleador, es él quien nos entrega tu nombre, RUT, correo y ' +
            'cargo para inscribirte en el curso que contrató.',
        },
      ],
    },
    SECURITY_SECTION,
    CHANGES_SECTION,
    COMPLAINTS_SECTION,
  ],
};

/** Las dos políticas, indexadas por `branches.slug`. */
export const PRIVACY_POLICIES: Record<string, PrivacyPolicyContent> = {
  [CONDUCTORES.branchSlug]: CONDUCTORES,
  [AUTOESCUELA.branchSlug]: AUTOESCUELA,
};

/** Devuelve la política de una sede, o `null` si el slug no corresponde a ninguna. */
export function getPrivacyPolicy(
  branchSlug: string | null | undefined,
): PrivacyPolicyContent | null {
  if (!branchSlug) return null;
  return PRIVACY_POLICIES[branchSlug] ?? null;
}
