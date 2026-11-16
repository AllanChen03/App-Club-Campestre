const { supabaseAdmin } = require('../config/supabaseAdmin');
const PDFDocument = require('pdfkit');
const { construirEstadoCuenta, estadoDePeriodo } = require('../services/estadoCuenta');
const { ErrorHttp } = require('../utils/ErrorHttp');

// Definimos este alias para que todas las llamadas existentes a 'supabase' funcionen correctamente
const supabase = supabaseAdmin;

// 1. Generación de cargos
const generarCargo = async (req, res) => {
  try {
    const { id_socio, concepto, descripcion, monto, fecha_vencimiento } = req.body;
    
    const { data, error } = await supabase
      .from('cargos')
      .insert([{ id_socio, concepto, descripcion, monto, fecha_vencimiento, estado: 'Pendiente' }])
      .select();

    if (error) throw error;
    res.status(201).json({ mensaje: 'Cargo generado exitosamente', cargo: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Consulta de estado de cuenta (acepta id_socio o id_usuario)
const consultarEstadoCuenta = async (req, res) => {
  try {
    res.json(await construirEstadoCuenta(req.params.id_socio));
  } catch (error) {
    if (error instanceof ErrorHttp) return res.status(error.status).json({ mensaje: error.message });
    console.error('Error en consultarEstadoCuenta:', error);
    res.status(500).json({ mensaje: 'No se pudo consultar el estado de cuenta' });
  }
};

// 3. Registro y confirmación de pagos manuales
const registrarPagoManual = async (req, res) => {
  try {
    let { id_socio, id_administrador, monto_total, itemsPagos } = req.body; 

    // Traducir id_usuario a id_socio si viene como UUID
    let idSocioReal = id_socio;
    if (typeof id_socio === 'string' && id_socio.includes('-')) {
      const { data: socioData } = await supabase
        .from('socios')
        .select('id_socio')
        .eq('id_usuario', id_socio)
        .maybeSingle();
      if (socioData) idSocioReal = socioData.id_socio;
    }

    // Resolver id_administrador de forma segura
    let adminId = id_administrador || req.usuario?.id_usuario || req.usuario?.id || req.user?.id;
    if (!adminId) {
      const { data: adminUser } = await supabase
        .from('usuarios')
        .select('id_usuario')
        .limit(1)
        .maybeSingle();
      
      if (adminUser) {
        adminId = adminUser.id_usuario;
      }
    }

    // Insertar el pago principal (id_administrador es requerido por esquema de BD)
    const { data: pagoData, error: pagoError } = await supabase
      .from('pagos')
      .insert([{ 
        id_socio: idSocioReal, 
        id_administrador: adminId, 
        monto_total 
      }])
      .select()
      .single();

    if (pagoError) throw pagoError;
    const id_pago = pagoData.id_pago;

    // Registrar detalles y actualizar cargos
    for (let item of itemsPagos) {
      await supabase.from('detalle_pagos').insert([{
        id_pago,
        id_cargo: item.id_cargo,
        monto_aplicado: item.monto_aplicado
      }]);

      const { data: cargoObj } = await supabase
        .from('cargos')
        .select('monto')
        .eq('id_cargo', item.id_cargo)
        .single();

      const montoCargo = cargoObj ? Number(cargoObj.monto) : 0;
      const nuevoEstado = item.monto_aplicado >= montoCargo ? 'Pagado' : 'Parcial';

      await supabase
        .from('cargos')
        .update({ estado: nuevoEstado })
        .eq('id_cargo', item.id_cargo);
    }

    res.status(201).json({ mensaje: 'Pago registrado exitosamente', id_pago });
  } catch (error) {
    console.error('Error detallado en registrarPagoManual:', error);
    res.status(500).json({ error: error.message });
  }
};

// 4. Control de morosidad
const obtenerMorosos = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('cargos')
      .select(`
        *,
        socios (
          id_socio,
          numero_socio,
          usuarios (nombre_completo, telefono, id_usuario, cedula)
        )
      `)
      .in('estado', ['Pendiente', 'Parcial'])
      .lt('fecha_vencimiento', today);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Generación de PDF del estado de cuenta (periodo actual o ?periodo=YYYY-MM)
const generarPdfEstadoCuenta = async (req, res) => {
  try {
    const estado = await estadoDePeriodo(req.params.id_socio, req.query.periodo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename=estado-cuenta-${estado.socio.numero_socio}-${estado.periodo}.pdf`);
    escribirPdfEstadoCuenta(estado, res);
  } catch (error) {
    if (error instanceof ErrorHttp) return res.status(error.status).json({ mensaje: error.message });
    console.error('Error generando PDF:', error);
    res.status(500).json({ mensaje: 'No se pudo generar el PDF' });
  }
};

// La fuente incorporada del PDF no tiene el símbolo ₡, así que se usa el código de moneda
const colones = (n) => `CRC ${Math.round(Number(n)).toLocaleString('en-US').replace(/,/g, ' ')}`;
const fechaCorta = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');

function escribirPdfEstadoCuenta(estado, salida) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(salida);

  const verde = '#1f4d3d';
  const gris = '#6b7280';
  const hoy = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica' }).format(new Date());

  // Encabezado
  const yTitulo = doc.y;
  doc.fontSize(16).fillColor(verde).text('Club Valle Alto', 50, yTitulo);
  doc.fontSize(10.5).fillColor(gris).text(`Emitido el ${hoy}`, 50, yTitulo + 4, { width: 495, align: 'right' });
  doc.moveDown(1);
  doc.x = 50;
  doc.fontSize(20).fillColor('#111827').text(`Estado de cuenta, ${estado.nombre_periodo}`);
  doc.moveDown(0.8);

  // Socio
  doc.fontSize(11).fillColor('#333333');
  doc.text(`Socio: ${estado.socio.nombre_completo}`);
  doc.text(`Cédula: ${estado.socio.cedula}`);
  doc.text(`Membresía: ${estado.socio.membresia}  •  Socio N.º ${estado.socio.numero_socio}`);
  doc.moveDown(1.2);

  // Tabla
  const col = { concepto: 50, limite: 280, estado: 370, monto: 445 };
  const linea = () => {
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.moveDown(0.6);
  };

  linea();
  let y = doc.y;
  doc.fontSize(10).fillColor(gris);
  doc.text('Concepto', col.concepto, y, { width: 220 });
  doc.text('Fecha límite', col.limite, y, { width: 85 });
  doc.text('Estado', col.estado, y, { width: 70 });
  doc.text('Monto', col.monto, y, { width: 100, align: 'right' });
  doc.moveDown(0.4);
  linea();

  if (estado.cargos.length === 0) {
    doc.fontSize(10).fillColor(gris).text('No hay cargos en este periodo.', 50, doc.y);
    doc.moveDown(1);
  }

  estado.cargos.forEach((c) => {
    y = doc.y;
    doc.fontSize(10).fillColor('#111827');
    doc.text(c.concepto || c.descripcion || 'Cargo', col.concepto, y, { width: 220 });
    const alto = doc.y - y;
    doc.text(fechaCorta(c.fecha_vencimiento), col.limite, y, { width: 85 });
    doc.fillColor(c.estado_actual === 'Pagado' ? '#1f6b45' : c.estado_actual === 'Vencido' ? '#b3261e' : '#8a5a00')
      .text(c.estado_actual, col.estado, y, { width: 70 });
    doc.fillColor('#111827').text(colones(c.monto), col.monto, y, { width: 100, align: 'right' });
    doc.y = y + Math.max(alto, 14) + 8;
  });

  linea();

  // Totales
  const fila = (texto, valor, negrita = false) => {
    y = doc.y;
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(negrita ? 11 : 10)
      .fillColor(negrita ? '#111827' : '#333333');
    doc.text(texto, 50, y, { width: 300 });
    doc.text(valor, col.monto - 45, y, { width: 145, align: 'right' });
    doc.y = y + (negrita ? 18 : 15);
  };

  fila('Total del periodo', colones(estado.resumen.facturado));
  fila('Pagado', colones(estado.resumen.pagado));
  if (estado.resumen.vencido > 0) fila('Vencido', colones(estado.resumen.vencido));
  fila('Total pendiente', colones(estado.resumen.saldo), true);
  doc.font('Helvetica');

  if (estado.proxima_fecha_limite && estado.resumen.saldo > 0) {
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor(gris).text(`Próxima fecha límite de pago: ${fechaCorta(estado.proxima_fecha_limite)}`, 50);
  }

  doc.moveDown(1.5);
  doc.fontSize(9).fillColor(gris).text(
    'Los pagos se realizan en la administración del club. Este documento es un resumen informativo.',
    50, doc.y, { width: 450 }
  );

  doc.end();
}

// 6. Obtener resumen financiero general y estados de cuenta para el dashboard
const obtenerResumenFinanciero = async (req, res) => {
  try {
    const { data: cargos, error } = await supabase
      .from('cargos')
      .select(`
        *,
        socios (
          id_socio,
          numero_socio,
          usuarios (nombre_completo, cedula)
        )
      `)
      .order('fecha_emision', { ascending: false });

    if (error) throw error;

    let facturado = 0;
    let pagado = 0;
    let pendiente = 0;
    let vencido = 0;

    const today = new Date().toISOString().split('T')[0];

    const listaEstados = (cargos || []).map(c => {
      const monto = Number(c.monto) || 0;
      const anulado = c.estado === 'Anulado';
      // Un cargo anulado no se factura ni deja saldo
      if (!anulado) facturado += monto;

      let estadoActual = c.estado; // 'Pendiente', 'Pagado', 'Parcial', 'Anulado'
      if (estadoActual === 'Pendiente' || estadoActual === 'Parcial') {
        if (c.fecha_vencimiento && c.fecha_vencimiento < today) {
          vencido += monto;
          estadoActual = 'Vencido';
        } else {
          pendiente += monto;
        }
      } else if (estadoActual === 'Pagado') {
        pagado += monto;
      }

      return {
        id: c.id_cargo,
        socio: c.socios?.usuarios?.nombre_completo || 'Socio general',
        detalle: c.concepto || c.descripcion || 'Cargo',
        vence: c.fecha_vencimiento || '—',
        saldo: estadoActual === 'Pagado' || anulado ? 0 : monto,
        estado: estadoActual === 'Pagado' ? 'Al día' : estadoActual
      };
    });

    res.json({
      resumen: { facturado, pagado, pendiente, vencido, totalCargos: cargos.length },
      estadosCuenta: listaEstados
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  generarCargo,
  consultarEstadoCuenta,
  registrarPagoManual,
  obtenerMorosos,
  generarPdfEstadoCuenta,
  obtenerResumenFinanciero
};