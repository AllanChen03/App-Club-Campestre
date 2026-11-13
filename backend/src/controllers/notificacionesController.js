const { supabaseAdmin: supabase } = require('../config/supabaseAdmin');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true para 465, false para 587
  family: 4,     // <--- FUERZA IPv4 Y EVITA EL ERROR ECONNREFUSED
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Evita problemas con certificados autofirmados en local
  }
});

// Obtener todas las plantillas
const obtenerPlantillas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('plantillas')
      .select('*')
      .order('id_plantilla', { ascending: true });
    if (error) {
      console.error('Error de Supabase en plantillas:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (error) {
    console.error('Error crítico en obtenerPlantillas:', error);
    res.status(500).json({ error: error.message });
  }
};

// Actualizar una plantilla existente
const actualizarPlantilla = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, asunto, contenido, estado } = req.body;

    const cambios = { 
      nombre, 
      tipo: tipo || 'General', 
      asunto, 
      contenido, 
      fecha_actualizacion: new Date().toISOString() 
    };
    if (estado) cambios.estado = estado;

    const { data, error } = await supabase
      .from('plantillas')
      .update(cambios)
      .eq('id_plantilla', id)
      .select()
      .single();

    if (error) {
      console.error('Error de Supabase al actualizar plantilla:', error);
      throw error;
    }
    res.json({ mensaje: 'Plantilla actualizada exitosamente', plantilla: data });
  } catch (error) {
    console.error('Error crítico en actualizarPlantilla:', error);
    res.status(500).json({ error: error.message });
  }
};

// Enviar notificación: registra, envía el correo y actualiza el estado
const enviarNotificacion = async (req, res) => {
  let idNotificacion = null;
  try {
    // Recogemos también asunto y contenido si el usuario los modificó en el modal
    const { id_usuario, id_plantilla, variables, asunto: asuntoEditado, contenido: contenidoEditado } = req.body;

    const { data: plantilla, error: errPlantilla } = await supabase
      .from('plantillas').select('*').eq('id_plantilla', id_plantilla).single();
    if (errPlantilla || !plantilla) throw new Error('Plantilla no encontrada');

    const { data: authData, error: errAuth } = await supabase.auth.admin.getUserById(id_usuario);
    if (errAuth || !authData?.user?.email) throw new Error('El usuario no tiene correo registrado');
    const correo = authData.user.email;

    // Usar el texto editado del frontend si existe, o el de la plantilla original
    let asuntoFinal = asuntoEditado || plantilla.asunto;
    let contenidoFinal = contenidoEditado || plantilla.contenido;

    if (variables) {
      for (const key in variables) {
        const marca = `{{${key}}}`;
        contenidoFinal = contenidoFinal.split(marca).join(variables[key]);
        asuntoFinal = asuntoFinal.split(marca).join(variables[key]);
      }
    }

    // 1) Registrar como Pendiente
    const { data: creada, error: errInsert } = await supabase
      .from('notificaciones')
      .insert([{ id_usuario, id_plantilla, asunto: asuntoFinal, contenido: contenidoFinal, estado: 'Pendiente' }])
      .select()
      .single();
    if (errInsert) throw errInsert;
    idNotificacion = creada.id_notificacion;

    // 2) Enviar el correo con Nodemailer
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Club Valle Alto" <no-reply@club.com>',
      to: correo,
      subject: asuntoFinal,
      text: contenidoFinal
    });

    // 3) Marcar como Enviada
    const { data: enviada, error: errUpdate } = await supabase
      .from('notificaciones')
      .update({ estado: 'Enviada', fecha_envio: new Date().toISOString() })
      .eq('id_notificacion', idNotificacion)
      .select()
      .single();
    if (errUpdate) throw errUpdate;

    res.json({ mensaje: 'Notificación enviada y registrada', notificacion: enviada });
  } catch (error) {
    console.error('Error crítico en enviarNotificacion:', error);
    if (idNotificacion) {
      await supabase.from('notificaciones').update({ estado: 'Fallida' }).eq('id_notificacion', idNotificacion);
    }
    res.status(500).json({ error: error.message });
  }
};

// Historial con datos del usuario y de la plantilla
const obtenerHistorialNotificaciones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*, usuarios(nombre_completo), plantillas(nombre)')
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('Error de Supabase en notificaciones:', error);
      return res.status(500).json({ error: error.message });
    }

    const ids = [...new Set(data.map((n) => n.id_usuario).filter(Boolean))];
    const correos = {};
    await Promise.all(
      ids.map(async (id) => {
        const { data: u } = await supabase.auth.admin.getUserById(id);
        correos[id] = u?.user?.email ?? null;
      })
    );

    const resultado = data.map((n) => ({
      ...n,
      usuarios: n.usuarios ? { ...n.usuarios, correo: correos[n.id_usuario] } : null
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Error crítico en obtenerHistorialNotificaciones:', error);
    res.status(500).json({ error: error.message });
  }
};
// En tu notificacionesController.js
const obtenerUsuarios = async (req, res) => {
  try {
    // Obtenemos los perfiles de la tabla usuarios
    const { data: usuariosDB, error } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre_completo');
    
    if (error) throw error;
    res.json(usuariosDB);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: error.message });
  }
};

// No olvides exportarlo en module.exports junto con los demás
module.exports = {
  obtenerPlantillas,
  actualizarPlantilla,
  enviarNotificacion,
  obtenerHistorialNotificaciones,
  obtenerUsuarios
};