const { supabaseAdmin } = require('../config/supabaseAdmin');
const PDFDocument = require('pdfkit');

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

// 2. Consulta de estado de cuenta
// 2. Consulta de estado de cuenta corregida para mapear id_usuario -> id_socio
const consultarEstadoCuenta = async (req, res) => {
  try {
    const { id_socio: paramId } = req.params;

    let idSocioReal = paramId;

    // 1. Intentar buscar si el ID recibido corresponde al id_usuario de un socio
    const { data: socioPorUsuario } = await supabase
      .from('socios')
      .select('id_socio')
      .eq('id_usuario', paramId)
      .maybeSingle();

    if (socioPorUsuario) {
      idSocioReal = socioPorUsuario.id_socio;
    } else {
      // 2. Si no, verificar si ya es un id_socio válido
      const { data: socioPorId } = await supabase
        .from('socios')
        .select('id_socio')
        .eq('id_socio', paramId)
        .maybeSingle();
      
      if (socioPorId) {
        idSocioReal = socioPorId.id_socio;
      }
    }

    // Obtener cargos usando el id_socio correcto
    const { data: cargos, error: errCargos } = await supabase
      .from('cargos')
      .select('*')
      .eq('id_socio', idSocioReal)
      .order('fecha_emision', { ascending: false });

    if (errCargos) throw errCargos;

    // Obtener pagos de forma segura
    let pagos = [];
    const { data: pagosData, error: errPagos } = await supabase
      .from('pagos')
      .select('*')
      .eq('id_socio', idSocioReal);

    if (!errPagos && pagosData) {
      pagos = pagosData;
    }

    // Calcular saldo pendiente total
    const saldoTotal = (cargos || [])
      .filter(c => c.estado === 'Pendiente' || c.estado === 'Parcial' || c.estado === 'Vencido')
      .reduce((acc, curr) => acc + Number(curr.monto || 0), 0);

    res.json({ cargos: cargos || [], pagos, saldoTotal });
  } catch (error) {
    console.error('Error en consultarEstadoCuenta:', error);
    res.status(500).json({ error: error.message });
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

// 5. Generación de PDF de Estado de Cuenta Profesional
const generarPdfEstadoCuenta = async (req, res) => {
  try {
    const { id_socio } = req.params;

    const { data: socio, error: errSocio } = await supabase
      .from('socios')
      .select('numero_socio, usuarios(nombre_completo, cedula)')
      .eq('id_socio', id_socio)
      .single();

    if (errSocio) throw errSocio;

    const { data: cargos, error: errCargos } = await supabase
      .from('cargos')
      .select('*')
      .eq('id_socio', id_socio);

    if (errCargos) throw errCargos;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=estado-cuenta-${id_socio}.pdf`);
    doc.pipe(res);

    // --- Encabezado ---
    doc.fontSize(16).fillColor('#1f4d3d').text('Club Valle Alto', { continued: true });
    doc.fontSize(10.5).fillColor('#555555').text(`Emitido el ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(0.5);

    doc.fontSize(20).fillColor('#111827').text('Estado de cuenta, octubre 2026');
    doc.moveDown(1);

    // --- Información del Socio ---
    doc.fontSize(11).fillColor('#333333');
    doc.text(`Socio: ${socio.usuarios.nombre_completo}`);
    doc.text(`Cédula: ${socio.usuarios.cedula}`);
    doc.text(`Membresía: Familiar  •  Socio N.º ${socio.numero_socio}`);
    doc.moveDown(1.5);

    // --- Línea divisoria superior de tabla ---
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.moveDown(0.8);

    // --- Cabecera de la Tabla ---
    const startX = 50;
    let currentY = doc.y;

    doc.fontSize(10).fillColor('#6b7280');
    doc.text('Concepto', startX, currentY, { width: 250, continued: false });
    doc.text('Fecha límite', startX + 260, currentY, { width: 100, align: 'left' });
    doc.text('Monto', startX + 370, currentY, { width: 125, align: 'right' });
    
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.moveDown(0.8);

    // --- Filas de Cargos ---
    let totalPendiente = 0;
    if (cargos && cargos.length > 0) {
      cargos.forEach(c => {
        const rowY = doc.y;
        totalPendiente += Number(c.monto);

        doc.fontSize(10).fillColor('#111827');
        doc.text(c.concepto || c.descripcion || 'Cargo', startX, rowY, { width: 250 });
        doc.text(c.fecha_vencimiento || '25/10/2026', startX + 260, rowY, { width: 100 });
        doc.text(`₡${Number(c.monto).toLocaleString()}`, startX + 370, rowY, { width: 125, align: 'right' });
        doc.moveDown(1);
      });
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('No hay cargos registrados.', startX, doc.y);
      doc.moveDown(1);
    }

    // --- Línea y Total Pendiente ---
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.moveDown(0.8);

    const totalY = doc.y;
    doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold');
    doc.text('Total pendiente', startX, totalY);
    doc.text(`₡${totalPendiente.toLocaleString()}`, startX + 370, totalY, { width: 125, align: 'right' });
    doc.font('Helvetica');

    doc.moveDown(2);

    // --- Pie de página informativo ---
    doc.fontSize(9).fillColor('#6b7280').text(
      'Los pagos se realizan en la administración del club. Este documento es un resumen informativo.',
      startX,
      doc.y,
      { align: 'left', width: 450 }
    );

    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

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
      facturado += monto;

      let estadoActual = c.estado; // 'Pendiente', 'Pagado', 'Parcial'
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
        saldo: estadoActual === 'Pagado' ? 0 : monto,
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