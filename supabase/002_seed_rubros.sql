-- =====================================================================
--  CATÁLOGO MULTINEGOCIO — Plantillas de rubro iniciales
--  Ejecutar DESPUÉS de 001_schema.sql
--  Son solo el punto de partida: cada dueño puede apagar, reordenar
--  o agregar secciones/módulos después de registrarse.
-- =====================================================================

-- Secciones comunes (cada plantilla las enciende/apaga distinto)
-- type: hero | featured | categories | products | promos | hours | location | faq | policies | social | custom

insert into public.rubro_templates (key, name, description, sort, config_base, categories_base, faqs_base) values

-- ---------------------------------------------------------------------
('general', 'General', 'Plantilla neutra para cualquier rubro', 0,
'{
  "theme":   {"style":"editorial","accent":"#FF6B35","mode":"auto"},
  "modules": {"stock":false,"peso":false,"delivery":true,"horario":true,"promos":true,"bot":true,"pedidos":true,"cotizacion":false,"qr":true,"analitica":true},
  "sections":[
    {"id":"hero","type":"hero","enabled":true,"order":0,"props":{}},
    {"id":"featured","type":"featured","enabled":true,"order":1,"props":{"title":"Destacados"}},
    {"id":"categories","type":"categories","enabled":true,"order":2,"props":{}},
    {"id":"products","type":"products","enabled":true,"order":3,"props":{"layout":"grid"}},
    {"id":"promos","type":"promos","enabled":false,"order":4,"props":{}},
    {"id":"hours","type":"hours","enabled":true,"order":5,"props":{}},
    {"id":"location","type":"location","enabled":false,"order":6,"props":{}},
    {"id":"faq","type":"faq","enabled":true,"order":7,"props":{}},
    {"id":"policies","type":"policies","enabled":false,"order":8,"props":{}},
    {"id":"social","type":"social","enabled":true,"order":9,"props":{}}
  ],
  "checkout":{"ask_name":true,"ask_phone":false,"ask_address":true,"allow_pickup":true,"allow_delivery":true,
              "message_header":"Hola, quiero hacer este pedido:","payment_methods":[]},
  "bot":{"enabled":true,"name":"Lu","greeting":"Hola, soy Lu. ¿Qué estás buscando hoy?","tone":"cercano"}
}',
'["Productos"]',
'[]'),

-- ---------------------------------------------------------------------
('ferreteria', 'Ferretería', 'Herramientas, materiales, pinturas; venta por unidad/metro/kg y cotización', 1,
'{
  "theme":   {"style":"industrial","accent":"#F5B700","mode":"auto"},
  "modules": {"stock":true,"peso":true,"delivery":true,"horario":true,"promos":true,"bot":true,"pedidos":true,"cotizacion":true,"qr":true,"analitica":true},
  "sections":[
    {"id":"hero","type":"hero","enabled":true,"order":0,"props":{}},
    {"id":"categories","type":"categories","enabled":true,"order":1,"props":{}},
    {"id":"featured","type":"featured","enabled":true,"order":2,"props":{"title":"Más pedidos"}},
    {"id":"products","type":"products","enabled":true,"order":3,"props":{"layout":"list"}},
    {"id":"promos","type":"promos","enabled":false,"order":4,"props":{}},
    {"id":"hours","type":"hours","enabled":true,"order":5,"props":{}},
    {"id":"location","type":"location","enabled":true,"order":6,"props":{}},
    {"id":"faq","type":"faq","enabled":true,"order":7,"props":{}},
    {"id":"policies","type":"policies","enabled":false,"order":8,"props":{}},
    {"id":"social","type":"social","enabled":true,"order":9,"props":{}}
  ],
  "checkout":{"ask_name":true,"ask_phone":true,"ask_address":true,"allow_pickup":true,"allow_delivery":true,
              "message_header":"Hola, quiero cotizar/pedir lo siguiente:","payment_methods":[]},
  "bot":{"enabled":true,"name":"Lu","greeting":"Hola, ¿qué material o herramienta necesitas?","tone":"directo"}
}',
'["Herramientas","Construcción","Pinturas","Electricidad","Gasfitería","Tornillería"]',
'[
  {"question":"¿Hacen cortes a medida?","keywords":["corte","medida","cortar"],"answer":"Consúltanos por WhatsApp con las medidas exactas y te confirmamos."},
  {"question":"¿Venden al por mayor?","keywords":["mayor","mayorista","cantidad","volumen"],"answer":"Sí, para pedidos grandes te enviamos una cotización especial por WhatsApp."}
]'),

-- ---------------------------------------------------------------------
('abarrotes', 'Abarrotes / Bodega', 'Productos de consumo diario, venta por unidad o peso', 2,
'{
  "theme":   {"style":"fresco","accent":"#2BB673","mode":"auto"},
  "modules": {"stock":true,"peso":true,"delivery":true,"horario":true,"promos":true,"bot":true,"pedidos":true,"cotizacion":false,"qr":true,"analitica":true},
  "sections":[
    {"id":"hero","type":"hero","enabled":true,"order":0,"props":{}},
    {"id":"promos","type":"promos","enabled":true,"order":1,"props":{"title":"Ofertas de la semana"}},
    {"id":"categories","type":"categories","enabled":true,"order":2,"props":{}},
    {"id":"products","type":"products","enabled":true,"order":3,"props":{"layout":"grid-compact"}},
    {"id":"featured","type":"featured","enabled":false,"order":4,"props":{}},
    {"id":"hours","type":"hours","enabled":true,"order":5,"props":{}},
    {"id":"location","type":"location","enabled":true,"order":6,"props":{}},
    {"id":"faq","type":"faq","enabled":true,"order":7,"props":{}},
    {"id":"policies","type":"policies","enabled":false,"order":8,"props":{}},
    {"id":"social","type":"social","enabled":false,"order":9,"props":{}}
  ],
  "checkout":{"ask_name":true,"ask_phone":false,"ask_address":true,"allow_pickup":true,"allow_delivery":true,
              "message_header":"Hola, quiero pedir:","payment_methods":[]},
  "bot":{"enabled":true,"name":"Lu","greeting":"Hola, ¿qué te falta en casa hoy?","tone":"cercano"}
}',
'["Abarrotes","Bebidas","Lácteos","Limpieza","Cuidado personal","Snacks"]',
'[
  {"question":"¿Tienen pedido mínimo para delivery?","keywords":["minimo","mínimo","monto"],"answer":"Escríbenos por WhatsApp y te confirmamos el mínimo para tu zona."}
]'),

-- ---------------------------------------------------------------------
('perfumeria', 'Perfumería', 'Perfumes, decants y cosméticos con variantes por ml', 3,
'{
  "theme":   {"style":"glamour","accent":"#C9A96E","mode":"dark"},
  "modules": {"stock":true,"peso":false,"delivery":true,"horario":false,"promos":true,"bot":true,"pedidos":true,"cotizacion":false,"qr":true,"analitica":true},
  "sections":[
    {"id":"hero","type":"hero","enabled":true,"order":0,"props":{}},
    {"id":"featured","type":"featured","enabled":true,"order":1,"props":{"title":"Los más deseados"}},
    {"id":"categories","type":"categories","enabled":true,"order":2,"props":{}},
    {"id":"products","type":"products","enabled":true,"order":3,"props":{"layout":"editorial"}},
    {"id":"promos","type":"promos","enabled":false,"order":4,"props":{}},
    {"id":"hours","type":"hours","enabled":false,"order":5,"props":{}},
    {"id":"location","type":"location","enabled":false,"order":6,"props":{}},
    {"id":"faq","type":"faq","enabled":true,"order":7,"props":{}},
    {"id":"policies","type":"policies","enabled":true,"order":8,"props":{"title":"Originalidad y cambios"}},
    {"id":"social","type":"social","enabled":true,"order":9,"props":{}}
  ],
  "checkout":{"ask_name":true,"ask_phone":false,"ask_address":true,"allow_pickup":false,"allow_delivery":true,
              "message_header":"Hola, me interesa:","payment_methods":[]},
  "bot":{"enabled":true,"name":"Lu","greeting":"Hola, ¿buscas algo fresco, dulce o intenso?","tone":"elegante"}
}',
'["Para ella","Para él","Unisex","Decants","Sets de regalo"]',
'[
  {"question":"¿Los perfumes son originales?","keywords":["original","originales","replica","réplica","falso"],"answer":"Escríbenos por WhatsApp y te contamos el origen de cada producto."},
  {"question":"¿Qué es un decant?","keywords":["decant","muestra","pequeño"],"answer":"Es una porción del perfume original en un frasco pequeño, ideal para probar antes de comprar el tamaño completo."}
]'),

-- ---------------------------------------------------------------------
('floreria', 'Florería', 'Arreglos, ramos y detalles; pedidos con fecha de entrega', 4,
'{
  "theme":   {"style":"suave","accent":"#E86A92","mode":"light"},
  "modules": {"stock":false,"peso":false,"delivery":true,"horario":true,"promos":true,"bot":true,"pedidos":true,"cotizacion":true,"qr":true,"analitica":true},
  "sections":[
    {"id":"hero","type":"hero","enabled":true,"order":0,"props":{}},
    {"id":"featured","type":"featured","enabled":true,"order":1,"props":{"title":"Favoritos"}},
    {"id":"categories","type":"categories","enabled":true,"order":2,"props":{}},
    {"id":"products","type":"products","enabled":true,"order":3,"props":{"layout":"grid"}},
    {"id":"promos","type":"promos","enabled":false,"order":4,"props":{}},
    {"id":"hours","type":"hours","enabled":true,"order":5,"props":{}},
    {"id":"location","type":"location","enabled":false,"order":6,"props":{}},
    {"id":"faq","type":"faq","enabled":true,"order":7,"props":{}},
    {"id":"policies","type":"policies","enabled":false,"order":8,"props":{}},
    {"id":"social","type":"social","enabled":true,"order":9,"props":{}}
  ],
  "checkout":{"ask_name":true,"ask_phone":true,"ask_address":true,"allow_pickup":true,"allow_delivery":true,
              "ask_date":true,"ask_dedication":true,
              "message_header":"Hola, quiero encargar:","payment_methods":[]},
  "bot":{"enabled":true,"name":"Lu","greeting":"Hola, ¿para qué ocasión buscas flores?","tone":"cálido"}
}',
'["Ramos","Arreglos","Cumpleaños","Aniversario","Condolencias","Eventos"]',
'[
  {"question":"¿Con cuánta anticipación debo pedir?","keywords":["anticipacion","anticipación","antes","dias","días","urgente"],"answer":"Te recomendamos pedir con al menos un día de anticipación. Para urgencias, escríbenos por WhatsApp."},
  {"question":"¿Puedo agregar una dedicatoria?","keywords":["dedicatoria","tarjeta","mensaje","nota"],"answer":"Sí, al hacer tu pedido puedes escribir la dedicatoria y la incluimos en una tarjeta."}
]'),

-- ---------------------------------------------------------------------
('streaming', 'Streaming / Digital', 'Cuentas y perfiles digitales con variantes por duración', 5,
'{
  "theme":   {"style":"neon","accent":"#FF6B35","mode":"dark"},
  "modules": {"stock":false,"peso":false,"delivery":false,"horario":false,"promos":true,"bot":true,"pedidos":true,"cotizacion":false,"qr":true,"analitica":true},
  "sections":[
    {"id":"hero","type":"hero","enabled":true,"order":0,"props":{}},
    {"id":"promos","type":"promos","enabled":true,"order":1,"props":{"title":"Combos"}},
    {"id":"categories","type":"categories","enabled":true,"order":2,"props":{}},
    {"id":"products","type":"products","enabled":true,"order":3,"props":{"layout":"grid"}},
    {"id":"featured","type":"featured","enabled":false,"order":4,"props":{}},
    {"id":"hours","type":"hours","enabled":false,"order":5,"props":{}},
    {"id":"location","type":"location","enabled":false,"order":6,"props":{}},
    {"id":"faq","type":"faq","enabled":true,"order":7,"props":{}},
    {"id":"policies","type":"policies","enabled":true,"order":8,"props":{"title":"Garantía"}},
    {"id":"social","type":"social","enabled":false,"order":9,"props":{}}
  ],
  "checkout":{"ask_name":true,"ask_phone":false,"ask_address":false,"allow_pickup":false,"allow_delivery":false,
              "message_header":"Hola, quiero comprar:","payment_methods":[]},
  "bot":{"enabled":true,"name":"Lu","greeting":"Hola, ¿qué plataforma te interesa?","tone":"cercano"}
}',
'["Video","Música","Herramientas","Combos"]',
'[
  {"question":"¿Cuánto demora la entrega?","keywords":["demora","entrega","rapido","rápido","cuando","cuándo"],"answer":"La entrega es rápida una vez confirmado el pago por WhatsApp."},
  {"question":"¿Tiene garantía?","keywords":["garantia","garantía","falla","cae","reemplazo"],"answer":"Sí, todas las cuentas tienen garantía durante el tiempo contratado."}
]');

-- =====================================================================
--  CONVERTIRTE EN SUPERADMIN
--  1) Regístrate en la app (o crea el usuario en Authentication → Users)
--  2) Reemplaza el correo y ejecuta esta línea:
-- =====================================================================
-- update public.profiles set role = 'superadmin'
--  where id = (select id from auth.users where email = 'TU_CORREO@gmail.com');
