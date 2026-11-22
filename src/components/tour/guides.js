// Guías por sección. Cada paso apunta a un elemento con data-tour="…".
// `target` puede listar varios selectores separados por coma: se usa el primero visible.
// Sin target → tarjeta centrada.
export const GUIDES = {
  inicio: [
    { title: 'Bienvenido a tu panel', text: 'Desde aquí manejas todo tu catálogo: productos, pedidos, diseño y tu asistente. Te mostramos lo importante en pocos pasos.' },
    { target: '[data-tour="checklist"]', title: 'Deja tu catálogo listo', text: 'Esta lista te dice qué te falta. Lo necesario para recibir pedidos es tu WhatsApp y al menos un producto.' },
    { target: '[data-tour="link"]', title: 'Tu enlace', text: 'Este es el enlace de tu catálogo. Cópialo y compártelo en tus estados, grupos y redes.' },
    { target: '[data-tour="menu"], .bottom2', title: 'El menú', text: 'Las secciones están agrupadas: tu tienda, diseño, clientes y ajustes. En el celular, lo demás está en "Más".' },
    { target: '[data-tour="plan"], .plan-chip', title: 'Tu plan', text: 'Aquí ves cuántos días le quedan a tu plan. Cuando falte poco, te aparece el botón para renovar.' },
  ],
  productos: [
    { title: 'Tus productos', text: 'Aquí cargas lo que vendes. Cada producto puede tener fotos, varias opciones (tamaños, medidas, presentaciones) y su precio.' },
    { target: '[data-tour="nuevo-producto"]', title: 'Agrega un producto', text: 'Toca aquí para crear uno. Al subir las fotos puedes moverlas y acercarlas para que se vea lo que quieres.' },
    { target: '[data-tour="tabs-productos"]', title: 'Categorías', text: 'Ordena tus productos por categorías. En el catálogo aparecen como una barra para filtrar.' },
    { target: '[data-tour="lista-productos"]', title: 'Cambios rápidos', text: 'Desde la lista puedes ocultar un producto o marcarlo como destacado sin abrirlo.' },
  ],
  pedidos: [
    { title: 'Tus pedidos', text: 'Cada vez que un cliente envía su pedido por WhatsApp desde tu catálogo, queda guardado aquí con un código.' },
    { target: '[data-tour="filtros-pedidos"]', title: 'Filtra por estado', text: 'Pendiente, confirmado, enviado, entregado. Los pendientes sin movimiento por 48 horas pasan solos a "No concretado".' },
    { target: '[data-tour="lista-pedidos"]', title: 'Abre un pedido', text: 'Al abrirlo ves los productos, los datos del cliente, cambias el estado y registras el pago.' },
  ],
  apariencia: [
    { title: 'Tu catálogo a tu gusto', text: 'Cambia colores, letras y secciones. A la derecha ves cómo queda al instante.' },
    { target: '[data-tour="color"]', title: 'Color principal', text: 'Se usa en botones y precios. Si un color no se leería bien, lo ajustamos solos.' },
    { target: '[data-tour="estilos"]', title: 'Estilo', text: 'Cada estilo trae sus tipografías y forma de tarjetas. Pruébalos: la vista previa cambia al toque.' },
    { target: '[data-tour="preview"]', title: 'Vista previa', text: 'Pruébala en claro y en oscuro con los botones de abajo. Es exactamente lo que verán tus clientes.' },
    { target: '.savebar', title: 'No olvides guardar', text: 'Si sales sin guardar, todo vuelve a como estaba.' },
  ],
  qr: [
    { title: 'Tu QR', text: 'Imprímelo y ponlo en tu mostrador, bolsas o tarjetas. Siempre lleva a tu catálogo, aunque cambies tu enlace.' },
    { target: '[data-tour="qr-formato"]', title: 'Elige un formato', text: 'Sticker, tarjeta para imprimir, historia para WhatsApp o solo el código.' },
    { target: '[data-tour="qr-descargar"]', title: 'Descárgalo', text: 'Se descarga en alta calidad, listo para imprimir.' },
  ],
  bot: [
    { title: 'Tu asistente', text: 'Responde solo a tus clientes con lo que cargaste: productos, precios, horario, delivery y pagos.' },
    { target: '[data-tour="bot-tabs"]', title: 'Enséñale más', text: 'En "Preguntas frecuentes" agregas respuestas. En "Sin respuesta" ves lo que no supo contestar para responderlo una vez.' },
  ],
  analitica: [
    { title: 'Cómo va tu catálogo', text: 'Visitas, escaneos de tu QR, productos más vistos y pedidos. Úsalo para saber qué destacar.' },
    { target: '[data-tour="rango"]', title: 'Periodo', text: 'Cambia entre 7, 30 y 90 días.' },
  ],
  configuracion: [
    { title: 'Datos de tu negocio', text: 'Aquí va todo lo que tus clientes necesitan saber: contacto, horario, entrega y pagos.' },
    { target: '[data-tour="config-tabs"]', title: 'Por partes', text: 'Ve pestaña por pestaña. Lo más importante: tu WhatsApp en "Negocio", porque ahí te llegan los pedidos.' },
  ],
}

export function guideForPath(pathname) {
  if (pathname === '/panel' || pathname === '/panel/') return 'inicio'
  const m = pathname.match(/^\/panel\/([a-z]+)/)
  return m && GUIDES[m[1]] ? m[1] : null
}
