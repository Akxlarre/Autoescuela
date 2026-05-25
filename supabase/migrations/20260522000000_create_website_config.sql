-- Migración para crear la tabla de configuración dinámica de los sitios web (website_config)
-- Fase 2 de Integración de Landing Pages

CREATE TABLE IF NOT EXISTS public.website_config (
  id SERIAL PRIMARY KEY,
  branch_id INT UNIQUE NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.website_config ENABLE ROW LEVEL SECURITY;

-- Trigger para mantener actualizado el campo updated_at
CREATE OR REPLACE TRIGGER trg_website_config_updated_at
  BEFORE UPDATE ON public.website_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger de auditoría para registrar cambios con diff en español (log_change)
DROP TRIGGER IF EXISTS trg_audit_website_config ON public.website_config;
CREATE TRIGGER trg_audit_website_config
  AFTER INSERT OR UPDATE OR DELETE ON public.website_config
  FOR EACH ROW EXECUTE FUNCTION log_change();

-- Políticas RLS
-- 1. Permiso de lectura público (tanto anon como authenticated) para que la landing pueda consumir los precios
CREATE POLICY select_website_config ON public.website_config
  FOR SELECT USING (true);

-- 2. Permiso de creación para administradores y secretarias autorizadas por sede
CREATE POLICY insert_website_config ON public.website_config
  FOR INSERT TO authenticated WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );

-- 3. Permiso de actualización para administradores y secretarias autorizadas por sede
CREATE POLICY update_website_config ON public.website_config
  FOR UPDATE TO authenticated USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );

-- 4. Permiso de eliminación para administradores y secretarias autorizadas por sede
CREATE POLICY delete_website_config ON public.website_config
  FOR DELETE TO authenticated USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );

-- Insertar datos semilla (Seeds) para Branch 1 (Azul) y Branch 2 (Roja)
-- Usamos $$ para evitar tener que escapar comillas simples en el objeto JSON
INSERT INTO public.website_config (branch_id, config)
VALUES (
  1,
  $$
{
  "brand": {
    "name": "Autoescuela Chillán",
    "shortName": "Autoescuela",
    "slogan": "Tu licencia en Chillán, más cerca y fácil que nunca",
    "theme": "azul",
    "domain": "autoescuelachillan.cl",
    "logo": "/azul/logo.svg",
    "ogImage": "/azul/og-image.jpg",
    "branchId": 1
  },
  "hero": {
    "headline": "Aprende a conducir con confianza en Chillán",
    "subheadline": "Escuela de conductores autorizada por el Ministerio de Transportes. Cursos prácticos y teóricos online diseñados para que apruebes tu licencia de conducir Clase B a la primera.",
    "cta": {
      "text": "Consultar Cursos por WhatsApp",
      "whatsapp": "+56912345678"
    },
    "features": [
      {
        "icon": "🚗",
        "text": "Flota Moderna de Vehículos"
      },
      {
        "icon": "📝",
        "text": "Teórico Online Interactivo"
      },
      {
        "icon": "🎓",
        "text": "Instructores Certificados SEMT"
      }
    ]
  },
  "courses": [
    {
      "name": "Curso de Manejo Clase B (Estándar)",
      "description": "El curso más solicitado para obtener tu licencia de conducir particular. Prepárate con instructores profesionales en las calles de Chillán.",
      "price": 350000,
      "priceNote": "Paga en cuotas y con facilidades de pago",
      "licenseClass": "B",
      "duration": "4 a 6 semanas",
      "includes": [
        "12 clases prácticas individuales de 45 minutos",
        "Clases teóricas ilimitadas por plataforma online",
        "Material de estudio digital (Libro Nuevo Conductor)",
        "Examen psicotécnico de control preventivo",
        "Facilidad de vehículo para rendir examen práctico municipal"
      ],
      "highlighted": true,
      "badge": "El más popular"
    },
    {
      "name": "Curso Clase B Intensivo",
      "description": "Diseñado para quienes disponen de poco tiempo y necesitan acelerar su aprendizaje práctico sin perder calidad en la enseñanza.",
      "price": 420000,
      "priceNote": "Cupos semanales limitados",
      "licenseClass": "B",
      "duration": "2 a 3 semanas",
      "includes": [
        "12 clases prácticas en bloques dobles diarios",
        "Acceso preferente a plataforma teórica 24/7",
        "Evaluaciones simuladas del examen teórico municipal",
        "Práctica de estacionamiento en zonas céntricas de Chillán",
        "Préstamo de auto para rendir examen municipal"
      ],
      "highlighted": false
    },
    {
      "name": "Curso Teórico Premium Online",
      "description": "Perfecto si ya sabes manejar pero necesitas dominar el complejo examen teórico municipal y psicotécnico de la Dirección de Tránsito.",
      "price": 90000,
      "priceNote": "100% online y flexible",
      "licenseClass": "B",
      "duration": "Flexible (1 mes de acceso)",
      "includes": [
        "Acceso ilimitado a simulador de examen municipal 2026",
        "Clases teóricas en vivo grabadas por profesores expertos",
        "Talleres específicos para vencer los nervios del examen",
        "Soporte y resolución de dudas por WhatsApp"
      ],
      "highlighted": false
    }
  ],
  "whyUs": [
    {
      "icon": "🛡️",
      "title": "Confianza y Respaldo",
      "description": "Somos una escuela de conducir conservadora con años de tradición en la Región de Ñuble, actualizando constantemente nuestras metodologías tecnológicas."
    },
    {
      "icon": "🎯",
      "title": "Alta Tasa de Aprobación",
      "description": "Nuestros métodos de enseñanza teórico-práctica están alineados con las exigencias directas del examen práctico en Chillán."
    },
    {
      "icon": "📍",
      "title": "Cerca del Examen Municipal",
      "description": "Nuestras clases de conducción cubren los recorridos y calles de examen habituales cerca de la Dirección de Tránsito de Chillán (Maipón 277)."
    },
    {
      "icon": "📆",
      "title": "Horarios Flexibles",
      "description": "Programamos tus horas prácticas de lunes a sábado en bloques que se acomodan a tus estudios, trabajo o responsabilidades."
    },
    {
      "icon": "🚗",
      "title": "Seguridad Primero",
      "description": "Nuestros autos cuentan con doble comando homologado de pedalera, asegurando el control absoluto del instructor en todo momento."
    },
    {
      "icon": "💳",
      "title": "Facilidades de Pago",
      "description": "Ofrecemos pie inicial flexible, pagos con transferencia electrónica, tarjetas de débito/crédito (Webpay) o cuotas directas."
    }
  ],
  "faqs": [
    {
      "question": "¿Cuáles son los requisitos mínimos para inscribirme al curso Clase B?",
      "answer": "Para inscribirte solo necesitas tu cédula de identidad chilena vigente (o pasaporte), tener al menos 17 años cumplidos (para licencia con autorización notarial de padres) o 18 años, y haber aprobado mínimo el 8° año de educación básica (certificado de estudios)."
    },
    {
      "question": "¿Cómo es el examen teórico de conducir en la Municipalidad de Chillán?",
      "answer": "El examen consta de 35 preguntas seleccionadas aleatoriamente de un banco de más de 800. Se aprueba con un mínimo de 33 de un máximo de 38 puntos totales (3 preguntas tienen puntaje doble sobre velocidad, alcohol/drogas y sistemas de retención). Tienes un tiempo máximo de 45 minutos."
    },
    {
      "question": "¿La escuela me presta el auto para dar el examen práctico municipal?",
      "answer": "¡Sí! Nuestros cursos Clase B estándar e intensivos incluyen la facilidad de préstamo del mismo vehículo en el que practicaste para rendir tu examen práctico en la Municipalidad de Chillán (Maipón 277). Esto disminuye notablemente el estrés del alumno."
    },
    {
      "question": "¿Cómo se solicitan las horas de examen en Chillán?",
      "answer": "Las horas de examen psicotécnico y práctico se solicitan de forma online directamente en el portal municipal de la Ilustre Municipalidad de Chillán (municipalidadchillan.cl). Generalmente el sistema abre las agendas el día 25 de cada mes a las 08:00 AM."
    },
    {
      "question": "¿Ofrecen clases prácticas los fines de semana?",
      "answer": "Sí, programamos clases prácticas los días sábados en jornada mañana y tarde para aquellos alumnos que por razones de trabajo o estudios universitarios no pueden asistir de lunes a viernes."
    }
  ],
  "contact": {
    "address": "Av. Libertad 123 (Plaza de Armas)",
    "city": "Chillán",
    "region": "Ñuble",
    "phone": "+56 42 222 3344",
    "whatsapp": "+56912345678",
    "email": "contacto@autoescuelachillan.cl",
    "mapEmbedUrl": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3202.9734674751433!2d-72.1054366!3d-36.6067094!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9668d7db5421f5fb%3A0xc3cf9c9b1abfa6a7!2sPlaza%20de%20Armas%20de%20Chill%C3%A1n!5e0!3m2!1ses!2scl!4v1716300000000!5m2!1ses!2scl",
    "geo": {
      "lat": -36.606709,
      "lng": -72.105436
    }
  },
  "hours": [
    {
      "days": "Lunes a Jueves",
      "time": "09:00 - 18:30"
    },
    {
      "days": "Viernes",
      "time": "09:00 - 17:30"
    },
    {
      "days": "Sábado",
      "time": "09:00 - 13:30"
    }
  ],
  "promo": {
    "active": true,
    "title": "¡Promo Especial de Temporada!",
    "description": "Inscríbete hoy en el Curso Clase B Estándar con un pie de solo $50.000 y obtén acceso gratuito a los talleres psicotécnicos especiales. ¡Cupos de preventa limitados para este mes!",
    "badge": "🔥 Oferta del Mes"
  },
  "testimonials": [
    {
      "name": "María José Orellana",
      "text": "Excelente experiencia. Los instructores tienen mucha paciencia para enseñar, especialmente a quienes partimos con miedo. Aprobé mi examen práctico en la Municipalidad de Chillán en el primer intento.",
      "rating": 5,
      "course": "Clase B Estándar"
    },
    {
      "name": "Carlos Valenzuela S.",
      "text": "El simulador de exámenes teóricos online me ayudó muchísimo a entender las preguntas con trampas del examen. El auto doble comando estaba impecable y muy cómodo de conducir.",
      "rating": 5,
      "course": "Clase B Estándar"
    },
    {
      "name": "Francisca Muñoz R.",
      "text": "Tomé el curso intensivo y en dos semanas ya estaba lista. Me prestaron el mismo auto para dar el examen y eso me dio toda la seguridad. ¡Totalmente recomendados en Chillán!",
      "rating": 5,
      "course": "Clase B Intensivo"
    }
  ],
  "social": {
    "facebook": "https://facebook.com/autoescuelachillan",
    "instagram": "https://instagram.com/autoescuelachillan"
  }
}
$$
),
(
  2,
  $$
{
  "brand": {
    "name": "Conductores Chillán",
    "shortName": "Conductores",
    "slogan": "Formamos profesionales de la conducción en Ñuble",
    "theme": "roja",
    "domain": "conductoreschillan.cl",
    "logo": "/roja/logo.svg",
    "ogImage": "/roja/og-image.jpg",
    "branchId": 2
  },
  "hero": {
    "headline": "Tu Licencia de Conducir Clase B y Profesional en Chillán",
    "subheadline": "La escuela líder en formación de conductores profesionales y particulares de la Región de Ñuble. Acreditados y equipados con camiones, buses y vehículos de última generación.",
    "cta": {
      "text": "Escríbenos por WhatsApp",
      "whatsapp": "+56987654321"
    },
    "features": [
      {
        "icon": "🚛",
        "text": "Buses y Camiones Modernos"
      },
      {
        "icon": "💼",
        "text": "Alta Inserción Laboral"
      },
      {
        "icon": "🏢",
        "text": "Acreditación Ministerial Completa"
      }
    ]
  },
  "courses": [
    {
      "name": "Curso Licencia Profesional Clase A2/A3",
      "description": "Curso profesional habilitante para la conducción de taxis, ambulancias, transporte escolar y transporte público mayor (buses). Multiplica tus opciones laborales.",
      "price": 800000,
      "priceNote": "Consulta convenios y código SENCE disponible",
      "licenseClass": "A2 y A3",
      "duration": "10 a 12 semanas",
      "includes": [
        "Clases teóricas completas presenciales u online",
        "Prácticas en simulador de inmersión avanzada",
        "Horas de conducción real en buses y vehículos de transporte público",
        "Material normativo y reglamentación de tránsito profesional",
        "Preparación intensiva para el examen municipal teórico y práctico"
      ],
      "highlighted": true,
      "badge": "El más cotizado"
    },
    {
      "name": "Curso Licencia Profesional Clase A4/A5",
      "description": "Formación experta para conducir camiones simples (A4) y camiones articulados/de carga de gran tonelaje (A5). Formación de alto estándar industrial.",
      "price": 850000,
      "priceNote": "Facilidades de financiamiento directo",
      "licenseClass": "A4 y A5",
      "duration": "10 a 12 semanas",
      "includes": [
        "Módulos avanzados de estiba, carga y distribución de pesos",
        "Prácticas de conducción real con camiones pesados en Chillán",
        "Simulaciones de frenado de emergencia y maniobras complejas",
        "Normativa legal sobre transporte de carga en carretera",
        "Material de estudio profesional del nuevo conductor de carga"
      ],
      "highlighted": false
    },
    {
      "name": "Curso de Manejo Clase B (Particular)",
      "description": "Curso tradicional para autos particulares, impartido bajo la metodología de alto rigor y seguridad vial de nuestra escuela profesional.",
      "price": 350000,
      "priceNote": "Paga en cuotas fijas",
      "licenseClass": "B",
      "duration": "4 a 6 semanas",
      "includes": [
        "12 clases prácticas individuales en vías urbanas de Chillán",
        "Acceso completo a nuestra aula virtual de teoría",
        "Material del Nuevo Conductor digital incluido",
        "Evaluación psicotécnica preventiva e informe de aptitud",
        "Acompañamiento del instructor con auto al examen práctico"
      ],
      "highlighted": false
    }
  ],
  "whyUs": [
    {
      "icon": "🚛",
      "title": "Flota Profesional Propia",
      "description": "Contamos con camiones modernos de carga y buses acondicionados especialmente con doble comando pedagógico homologado para tu seguridad."
    },
    {
      "icon": "💼",
      "title": "Bolsa de Trabajo Activa",
      "description": "Mantenemos alianzas con empresas de transporte y logística locales en Ñuble, facilitando la contratación rápida de nuestros egresados."
    },
    {
      "icon": "🛡️",
      "title": "Enfoque de Seguridad Vial",
      "description": "Más que pasar el examen, formamos conductores responsables y defensivos para reducir la siniestralidad vial en carreteras chilenas."
    },
    {
      "icon": "🎯",
      "title": "Simuladores de Alta Gama",
      "description": "Entrenamos en simuladores profesionales que replican condiciones de lluvia, niebla y fallas mecánicas de forma totalmente segura."
    },
    {
      "icon": "📝",
      "title": "Soporte Teórico Avanzado",
      "description": "Acompañamiento personalizado en la preparación del riguroso examen teórico profesional de Conaset ante la Dirección de Tránsito."
    },
    {
      "icon": "💳",
      "title": "Financiamiento Directo",
      "description": "Opciones de pago flexibles, cuotas con tarjeta de crédito bancaria y financiamiento directo adaptado a trabajadores."
    }
  ],
  "faqs": [
    {
      "question": "¿Cuáles son los requisitos para obtener la licencia profesional Clase A2 o A3?",
      "answer": "Para optar a una licencia profesional en Chile debes tener mínimo 20 años de edad, poseer una licencia Clase B vigente con al menos 2 años de antigüedad, y haber aprobado un curso en una Escuela de Conductores Profesionales reconocida por el Estado, como la nuestra."
    },
    {
      "question": "¿Qué vehículos puedo conducir con la licencia Clase A4 y A5?",
      "answer": "La licencia Clase A4 permite conducir camiones simples destinados al transporte de carga sobre 3.500 kg de peso bruto. La Clase A5 autoriza la conducción de todo tipo de camiones articulados (camión con rampla, tractocamión, etc.) de carga nacional e internacional."
    },
    {
      "question": "¿Cuentan con código SENCE para empresas?",
      "answer": "Sí, nuestros cursos de licencias profesionales cuentan con registro de asistencia y código SENCE activo para que las empresas de transportes y logística puedan capacitar a sus colaboradores aprovechando la franquicia tributaria."
    },
    {
      "question": "¿Cómo es el examen práctico para licencias profesionales en la municipalidad?",
      "answer": "El examen práctico es riguroso. Deberás conducir el tipo de vehículo correspondiente (bus o camión) ante el examinador municipal de la Dirección de Tránsito (Maipón 277). Evaluará maniobras de retroceso, estacionamiento en andén, frenado, conducción en ruta urbana, etc."
    },
    {
      "question": "¿Tienen facilidades para alumnos de comunas aledañas a Chillán?",
      "answer": "Sí, recibimos muchos alumnos de Coihueco, Bulnes, San Carlos, Yungay y Quillón. Adaptamos los horarios prácticos en bloques continuos o de fin de semana para que optimicen sus traslados."
    }
  ],
  "contact": {
    "address": "Maipón 999 (a cuadras del Terminal de Buses)",
    "city": "Chillán",
    "region": "Ñuble",
    "phone": "+56 42 288 8899",
    "whatsapp": "+56987654321",
    "email": "contacto@conductoreschillan.cl",
    "mapEmbedUrl": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3202.83681423405!2d-72.1032483!3d-36.6080512!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzbCsDM2JzI5LjAiUyA3MsKwMDYnMTEuNyJX!5e0!3m2!1ses!2scl!4v1716300000000!5m2!1ses!2scl",
    "geo": {
      "lat": -36.608051,
      "lng": -72.103248
    }
  },
  "hours": [
    {
      "days": "Lunes a Viernes",
      "time": "08:30 - 18:30"
    },
    {
      "days": "Sábado",
      "time": "09:00 - 14:00"
    }
  ],
  "promo": {
    "active": true,
    "title": "Cursos Profesionales con Descuento",
    "description": "Obtén un 10% de descuento en tu matrícula para cursos Clase A3 o A5 pagando al contado. ¡Asegura tu cupo e intégrate a la industria del transporte con alta demanda!",
    "badge": "🚛 Matrículas Abiertas"
  },
  "testimonials": [
    {
      "name": "Héctor Tapia G.",
      "text": "Un curso excelente. Aprendí a conducir camiones articulados Clase A5 desde cero. La paciencia de los instructores en carretera es insuperable. Conseguí trabajo en una empresa forestal de Ñuble a las dos semanas de egresar.",
      "rating": 5,
      "course": "Clase A5 Profesional"
    },
    {
      "name": "Patricia Riquelme",
      "text": "Hice el curso Clase A2 para conducir furgón escolar. Las clases en el simulador me dieron mucha tranquilidad para luego tomar el bus real. Un trato muy profesional y ordenado.",
      "rating": 5,
      "course": "Clase A2 Profesional"
    },
    {
      "name": "Sebastián Castro V.",
      "text": "Saqué mi licencia Clase B con ellos y todo impecable. El ambiente de la escuela es muy serio y centrado en la seguridad. Los recomiendo totalmente.",
      "rating": 5,
      "course": "Clase B Particular"
    }
  ],
  "social": {
    "facebook": "https://facebook.com/conductoreschillan",
    "instagram": "https://instagram.com/conductoreschillan"
  }
}
$$
);
