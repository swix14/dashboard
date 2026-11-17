import React, { useRef } from 'react';
import { Camera, FileText, Upload, X } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters.js';

export const COMPROBANTE_MAX_MB = 5;
export const COMPROBANTE_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Campo del comprobante de un movimiento.
 * En computador: un botón para subir la imagen o el PDF.
 * En celular o tablet (pantalla táctil): "Tomar foto" abre la cámara trasera directo
 * y "Subir" deja elegir de la galería o de los archivos.
 */
export function ComprobanteInput({ archivo, onSeleccion, onQuitar, vacio, obligatorio = false }) {
  const camaraRef = useRef(null);
  const archivoRef = useRef(null);

  const elegir = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (file) onSeleccion(file);
  };

  return (
    <div className="cmp">
      <div className="cmp-head">
        <span className="cmp-label" id="cmp-label">Comprobante de respaldo</span>
        {obligatorio && <span className="cmp-obligatorio">* Obligatorio para egresos</span>}
      </div>

      <div className="cmp-fila">
        <div className="vtf-input cmp-archivo" aria-live="polite">
          {archivo ? (
            <>
              <FileText size={15} aria-hidden="true" />
              <span className="cmp-nombre" title={archivo.name}>{archivo.name}</span>
              <span className="cmp-peso">{formatFileSize(archivo.size)}</span>
              <button type="button" className="cmp-quitar" aria-label="Quitar archivo" onClick={onQuitar}>
                <X size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <span className="cmp-vacio">{vacio}</span>
          )}
        </div>

        <div className="cmp-botones">
          {/* Solo en pantallas táctiles (CSS pointer: coarse) */}
          <button type="button" className="cmp-btn cmp-btn-camara" onClick={() => camaraRef.current?.click()}>
            <Camera size={15} aria-hidden="true" /> Tomar foto
          </button>
          <button type="button" className="cmp-btn" onClick={() => archivoRef.current?.click()}>
            <Upload size={15} aria-hidden="true" />
            <span className="cmp-txt-pc">Adjuntar</span>
            <span className="cmp-txt-movil">Subir</span>
          </button>
        </div>

        <input ref={camaraRef} type="file" accept="image/*" capture="environment" hidden onChange={elegir} aria-labelledby="cmp-label" />
        <input ref={archivoRef} type="file" accept={COMPROBANTE_TIPOS.join(',')} hidden onChange={elegir} aria-labelledby="cmp-label" />
      </div>
    </div>
  );
}

export default ComprobanteInput;
