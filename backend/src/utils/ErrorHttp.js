class ErrorHttp extends Error {
    constructor(status, mensaje, extra = {}) {
        super(mensaje);
        this.status = status;
        this.extra = extra;
    }
}

module.exports = { ErrorHttp };

function responderError(res, error, contexto, mensajeGenerico, statusGenerico = 500) {
    if (error instanceof ErrorHttp) {
        return res.status(error.status).json({ mensaje: error.message, ...error.extra });
    }

    console.error(`${contexto}:`, error.message);

    return res.status(statusGenerico).json({ mensaje: mensajeGenerico });
}

module.exports.responderError = responderError;