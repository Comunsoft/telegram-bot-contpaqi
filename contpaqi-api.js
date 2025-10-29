import axios from 'axios';

export class ContpaqiAPI {
  constructor({ baseURL, apiKey }) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey,
        'x-await-response': 'true',
        'Content-Type': 'application/json'
      }
    });
  }

  async buscarDocumentos(tipo, params) {
    const documentoModelo = this.getDocumentoModelo(tipo);
    
    const payload = {
      $command: 'BuscarDocumentosRequest',
      model: {
        DocumentoModelo: documentoModelo,
        Limite: params.limite || 5
      },
      options: {}
    };

    if (params.clienteCodigo) {
      payload.model.clienteCodigo = params.clienteCodigo;
    }
    if (params.clienteRazonSocial) {
      payload.model.clienteRazonSocial = params.clienteRazonSocial;
    }
    if (params.incluirCancelados) {
      payload.model.IncluirCancelados = params.incluirCancelados;
    }

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error buscando ${tipo}s: conexión con sistema`);
    }
  }

  async crearCotizacion(params) {
    // Obtener información del cliente para usar su moneda
    let moneda = { id: 2, nombre: 'DOLAR AMERICANO' }; // Default
    try {
      const clienteInfo = await this.buscarClientes({ codigo: params.clienteCodigo });
      if (clienteInfo?.data?.model?.clientes?.[0]?.moneda) {
        moneda = clienteInfo.data.model.clientes[0].moneda;
      }
    } catch (error) {
      console.log('No se pudo obtener moneda del cliente, usando default');
    }

    const movimientos = params.productos.map(producto => ({
      id: 0,
      producto: {
        id: 0,
        codigo: producto.codigo,
        nombre: '',
        tipo: 'Producto',
        controlExistencias: 'Ninguno',
        unidadMedida: null,
        claveSat: '',
        datosExtra: {}
      },
      almacen: {
        id: 0,
        codigo: producto.almacenCodigo || '1',
        nombre: '',
        datosExtra: {}
      },
      unidades: producto.unidades,
      precio: producto.precio,
      subtotal: 0,
      descuentos: {
        descuento1: { tasa: 0, importe: 0 },
        descuento2: { tasa: 0, importe: 0 },
        descuento3: { tasa: 0, importe: 0 },
        descuento4: { tasa: 0, importe: 0 },
        descuento5: { tasa: 0, importe: 0 }
      },
      impuestos: {
        impuesto1: { tasa: 16, importe: 0 },
        impuesto2: { tasa: 0, importe: 0 },
        impuesto3: { tasa: 0, importe: 0 }
      },
      retenciones: null,
      total: 0,
      referencia: '',
      observaciones: '',
      seriesCapas: [],
      datosExtra: {}
    }));

    const payload = {
      $command: 'CrearDocumentoRequest',
      model: {
        documento: {
          id: 0,
          concepto: {
            id: 0,
            codigo: '0150'
          },
          serie: '',
          folio: 0,
          fecha: new Date().toISOString().split('T')[0],
          cliente: {
            id: 0,
            codigo: params.clienteCodigo,
            razonSocial: '',
            rfc: '',
            tipo: 0,
            usoCfdi: null,
            regimenFiscal: null,
            direccionFiscal: null,
            datosExtra: {}
          },
          moneda: moneda,
          tipoCambio: 1,
          agente: {
            id: 0,
            codigo: params.agenteCodigo || '19',
            nombre: '',
            tipo: 'VentasCobro',
            datosExtra: {}
          },
          referencia: params.referencia || '',
          observaciones: params.observaciones || '',
          total: 0,
          formaPago: null,
          metodoPago: null,
          movimientos: movimientos,
          direccionFiscal: {
            id: 0,
            tipoCatalogo: 0,
            tipo: 'Fiscal',
            calle: 'Calle 4',
            numeroExterior: '419 Y 421',
            numeroInterior: '',
            colonia: 'Mercado de Abastos Jalisco',
            ciudad: 'Guadalajara',
            estado: 'Jalisco',
            codigoPostal: '44530',
            pais: 'México',
            datosExtra: {}
          },
          folioDigital: {
            id: 0,
            uuid: '',
            datosExtra: {}
          },
          datosExtra: {}
        }
      },
      options: {
        usarFechaDelDia: true,
        buscarSiguienteFolio: true,
        crearActualizarCatalogos: false,
        crearActualizarCliente: false,
        crearActualizarAgente: false,
        crearActualizarProducto: false,
        crearActualizarUnidadMedida: false,
        crearActualizarAlmacen: false,
        cargarDatosExtra: false
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error creando cotización: verifique los datos`);
    }
  }

  async crearPedido(params) {
    const payload = await this.buildDocumentPayload('0250', params);
    
    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error creando pedido: verifique los datos`);
    }
  }

  async crearFactura(params) {
    const payload = await this.buildDocumentPayload('0450', params);
    payload.model.documento.formaPago = '03';
    payload.model.documento.metodoPago = 'PPD';
    payload.options.generarDocumentosDigitales = true;
    payload.options.generarPdf = true;
    
    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error creando factura: verifique los datos`);
    }
  }

  async buscarClientes(params) {
    let whereExpression = '';
    
    if (params.whereExpression) {
      whereExpression = params.whereExpression;
    } else if (params.codigo) {
      whereExpression = `cCodigoCliente = "${params.codigo}"`;
    } else if (params.razonSocial) {
      whereExpression = `cRazonSocial.Contains("${params.razonSocial}")`;
    } else if (params.rfc) {
      whereExpression = `cRFC = "${params.rfc}"`;
    }

    const payload = {
      $command: 'BuscarClientesRequest',
      model: {
        whereExpression: whereExpression
      },
      options: {
        cargarDatosExtra: params.cargarDatosExtra || false
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error buscando clientes: verifique los parámetros`);
    }
  }

  async buscarProductos(params) {
    const payload = {
      $command: 'BuscarProductosRequest',
      model: {},
      options: {
        cargarDatosExtra: params.cargarDatosExtra !== undefined ? params.cargarDatosExtra : true
      }
    };

    if (params.whereExpression) {
      payload.model.whereExpression = params.whereExpression;
    } else if (params.codigo) {
      payload.model.codigo = params.codigo;
    } else if (params.nombre) {
      payload.model.nombre = params.nombre;
    }

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error buscando productos: verifique el código`);
    }
  }

  async consultarExistencias(params) {
    const payload = {
      $command: 'BuscarExistenciasProductoRequest',
      model: {
        codigoProducto: params.codigoProducto,
        codigoAlmacen: params.codigoAlmacen || '1',
        fecha: params.fecha || new Date().toISOString().split('T')[0]
      },
      options: {
        cargarDatosExtra: params.cargarDatosExtra !== undefined ? params.cargarDatosExtra : true
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error consultando existencias: verifique el producto`);
    }
  }

  async buscarAlmacenes(params = {}) {
    let whereExpression = 'cCodigoAlmacen != "(Ninguno)"';
    
    if (params.whereExpression) {
      whereExpression = params.whereExpression;
    } else if (params.codigo) {
      whereExpression = `cCodigoAlmacen = "${params.codigo}"`;
    }

    const payload = {
      $command: 'BuscarAlmacenesRequest',
      model: {
        whereExpression: whereExpression
      },
      options: {}
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error buscando almacenes: conexión con sistema`);
    }
  }

  async generarPDF(params) {
    const payload = {
      $command: 'GenerarDocumentoDigitalRequest',
      model: {
        llaveDocumento: {
          conceptoCodigo: params.conceptoCodigo,
          serie: params.serie,
          folio: params.folio
        }
      },
      options: {
        tipo: 1
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error generando PDF: verifique el documento`);
    }
  }

  async generarXML(params) {
    const payload = {
      $command: 'GenerarDocumentoDigitalRequest',
      model: {
        llaveDocumento: {
          conceptoCodigo: params.conceptoCodigo,
          serie: params.serie,
          folio: params.folio
        }
      },
      options: {
        tipo: 0
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error generando XML: verifique el documento`);
    }
  }

  async reporteVentas(params) {
    const payload = {
      $command: 'ReporteVentasRequest',
      model: {
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
        codClienteInicio: params.codClienteInicio || '',
        codClienteFin: params.codClienteFin || '',
        codAgenteInicio: params.codAgenteInicio || '',
        codAgenteFin: params.codAgenteFin || '',
        codProductoInicio: params.codProductoInicio || '',
        codProductoFin: params.codProductoFin || ''
      },
      options: {
        cargarDatosExtra: params.cargarDatosExtra || false
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      console.log('Reporte generado exitosamente');
      return response.data || { error: 'No data returned', payload };
    } catch (error) {
      console.error('Reporte error: conexión con sistema');
      throw new Error(`Error generando reporte de ventas: verifique los parámetros`);
    }
  }

  async generarXMLyPDF(params) {
    const payload = {
      $command: 'GenerarDocumentoDigitalRequest',
      model: {
        llaveDocumento: {
          conceptoCodigo: params.conceptoCodigo,
          serie: params.serie,
          folio: params.folio
        }
      },
      options: {
        tipo: 2
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error generando XML y PDF: verifique el documento`);
    }
  }

  async crearFacturaAvanzada(params) {
    // Obtener información del cliente para usar su moneda
    let moneda = { id: 1, nombre: 'PESO' }; // Default para facturas
    try {
      const clienteInfo = await this.buscarClientes({ codigo: params.clienteCodigo });
      if (clienteInfo?.data?.model?.clientes?.[0]?.moneda) {
        moneda = clienteInfo.data.model.clientes[0].moneda;
      }
    } catch (error) {
      console.log('No se pudo obtener moneda del cliente, usando default');
    }

    const movimientos = params.movimientos.map(mov => ({
      id: 0,
      producto: {
        id: 0,
        codigo: mov.productoCodigo,
        nombre: '',
        tipo: 'Producto',
        controlExistencias: 'Ninguno',
        unidadMedida: null,
        claveSat: '',
        datosExtra: {}
      },
      almacen: {
        id: 0,
        codigo: mov.almacenCodigo || '1',
        nombre: '',
        datosExtra: {}
      },
      unidades: mov.unidades,
      precio: mov.precio,
      subtotal: 0,
      descuentos: {
        descuento1: { tasa: 0, importe: 0 },
        descuento2: { tasa: 0, importe: 0 },
        descuento3: { tasa: 0, importe: 0 },
        descuento4: { tasa: 0, importe: 0 },
        descuento5: { tasa: 0, importe: 0 }
      },
      impuestos: {
        impuesto1: { tasa: mov.tasaImpuesto || 16, importe: 0 },
        impuesto2: { tasa: 0, importe: 0 },
        impuesto3: { tasa: 0, importe: 0 }
      },
      retenciones: null,
      total: 0,
      referencia: '',
      observaciones: '',
      seriesCapas: [],
      datosExtra: {}
    }));

    const payload = {
      $command: 'CrearDocumentoRequest',
      model: {
        documento: {
          id: 0,
          concepto: {
            id: 0,
            codigo: params.conceptoCodigo || '0450'
          },
          serie: '',
          folio: 0,
          fecha: new Date().toISOString().split('T')[0],
          cliente: {
            id: 0,
            codigo: params.clienteCodigo,
            razonSocial: '',
            rfc: '',
            tipo: 0,
            usoCfdi: null,
            regimenFiscal: null,
            direccionFiscal: null,
            datosExtra: {}
          },
          moneda: moneda,
          tipoCambio: 1,
          agente: {
            id: 0,
            codigo: params.agenteCodigo || '1',
            nombre: '',
            tipo: 'VentasCobro',
            datosExtra: {}
          },
          referencia: params.referencia || '',
          observaciones: params.observaciones || '',
          total: 0,
          formaPago: params.formaPago,
          metodoPago: params.metodoPago,
          movimientos: movimientos,
          direccionFiscal: {
            id: 0,
            tipoCatalogo: 0,
            tipo: 'Fiscal',
            calle: 'Calle Principal',
            numeroExterior: '123',
            numeroInterior: '',
            colonia: 'Centro',
            ciudad: 'Ciudad',
            estado: 'Estado',
            codigoPostal: '00000',
            pais: 'México',
            datosExtra: { 'CREGIMFISC': '612' }
          },
          folioDigital: { id: 0, uuid: '', datosExtra: {} },
          datosExtra: {}
        }
      },
      options: {
        generarDocumentosDigitales: params.generarXml !== false,
        generarPdf: params.generarPdf !== false,
        usarFechaDelDia: true,
        buscarSiguienteFolio: true,
        crearActualizarCatalogos: false,
        crearActualizarCliente: false,
        crearActualizarAgente: false,
        crearActualizarProducto: false,
        crearActualizarUnidadMedida: false,
        crearActualizarAlmacen: false,
        cargarDatosExtra: false
      }
    };

    try {
      const response = await this.client.post('/api/comercial', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Error creando factura avanzada: verifique los datos`);
    }
  }

  async obtenerRespuestaPorId(responseId) {
    try {
      const response = await this.client.get(`/api/comercial/${responseId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Error obteniendo respuesta por ID: ID no encontrado`);
    }
  }

  getDocumentoModelo(tipo) {
    switch (tipo.toLowerCase()) {
      case 'cotizacion':
        return 1;
      case 'pedido':
        return 2;
      case 'factura':
        return 4;
      default:
        return 1;
    }
  }

  async buildDocumentPayload(concepto, params) {
    // Obtener información del cliente para usar su moneda
    let moneda = { id: 2, nombre: 'DOLAR AMERICANO' }; // Default
    try {
      const clienteInfo = await this.buscarClientes({ codigo: params.clienteCodigo });
      if (clienteInfo?.data?.model?.clientes?.[0]?.moneda) {
        moneda = clienteInfo.data.model.clientes[0].moneda;
      }
    } catch (error) {
      console.log('No se pudo obtener moneda del cliente, usando default');
    }

    // Soportar tanto 'productos' como 'movimientos'
    const productos = params.productos || params.movimientos || [];
    const movimientos = productos.map(producto => ({
      id: 0,
      producto: {
        id: 0,
        codigo: producto.codigo || producto.productoCodigo,
        nombre: '',
        tipo: 'Producto',
        controlExistencias: 'Ninguno',
        unidadMedida: null,
        claveSat: '',
        datosExtra: {}
      },
      almacen: {
        id: 0,
        codigo: producto.almacenCodigo || '1',
        nombre: '',
        datosExtra: {}
      },
      unidades: producto.unidades,
      precio: producto.precio,
      subtotal: 0,
      descuentos: {
        descuento1: { tasa: 0, importe: 0 },
        descuento2: { tasa: 0, importe: 0 },
        descuento3: { tasa: 0, importe: 0 },
        descuento4: { tasa: 0, importe: 0 },
        descuento5: { tasa: 0, importe: 0 }
      },
      impuestos: {
        impuesto1: { tasa: producto.tasaImpuesto || 16, importe: 0 },
        impuesto2: { tasa: 0, importe: 0 },
        impuesto3: { tasa: 0, importe: 0 }
      },
      retenciones: null,
      total: 0,
      referencia: '',
      observaciones: '',
      seriesCapas: [],
      datosExtra: {}
    }));

    return {
      $command: 'CrearDocumentoRequest',
      model: {
        documento: {
          id: 0,
          concepto: {
            id: 0,
            codigo: concepto
          },
          serie: '',
          folio: 0,
          fecha: new Date().toISOString().split('T')[0],
          cliente: {
            id: 0,
            codigo: params.clienteCodigo,
            razonSocial: '',
            rfc: '',
            tipo: 0,
            usoCfdi: null,
            regimenFiscal: null,
            direccionFiscal: null,
            datosExtra: {}
          },
          moneda: moneda,
          tipoCambio: 1,
          agente: {
            id: 0,
            codigo: params.agenteCodigo || '19',
            nombre: '',
            tipo: 'VentasCobro',
            datosExtra: {}
          },
          referencia: params.referencia || '',
          observaciones: params.observaciones || '',
          total: 0,
          formaPago: null,
          metodoPago: null,
          movimientos: movimientos,
          direccionFiscal: {
            id: 0,
            tipoCatalogo: 0,
            tipo: 'Fiscal',
            calle: 'Calle 4',
            numeroExterior: '419 Y 421',
            numeroInterior: '',
            colonia: 'Mercado de Abastos Jalisco',
            ciudad: 'Guadalajara',
            estado: 'Jalisco',
            codigoPostal: '44530',
            pais: 'México',
            datosExtra: {}
          },
          folioDigital: {
            id: 0,
            uuid: '',
            datosExtra: {}
          },
          datosExtra: {}
        }
      },
      options: {
        usarFechaDelDia: true,
        buscarSiguienteFolio: true,
        crearActualizarCatalogos: false,
        crearActualizarCliente: false,
        crearActualizarAgente: false,
        crearActualizarProducto: false,
        crearActualizarUnidadMedida: false,
        crearActualizarAlmacen: false,
        cargarDatosExtra: false
      }
    };
  }
}