import React from 'react';
import { calcularSPI, getSPIStatus } from '../utils/calculations';

// Semaforo del SPI (Real / Esperado): rojo <90, amarillo 90-94, verde >=95.
const ESTILOS = {
    malo: 'bg-red-500/15 border-red-500/50 text-red-700 dark:text-red-400',
    advertencia: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-800 dark:text-yellow-400',
    ok: 'bg-green-500/15 border-green-500/50 text-green-800 dark:text-green-400'
};

const SPIBadge = ({ real, esperado, showValue = true }) => {
    const spi = calcularSPI(real, esperado);
    const estado = getSPIStatus(spi);

    return (
        <span
            className={`inline-flex items-center gap-1 border px-1.5 py-0.5 rounded font-black text-[10px] whitespace-nowrap ${ESTILOS[estado.nivel]}`}
            title={`SPI ${spi}% — Real ${real}% / Esperado ${esperado}% — ${estado.texto}`}
        >
            <span aria-hidden="true">{estado.icono}</span>
            {showValue ? <span>SPI {spi}%</span> : <span>{estado.texto}</span>}
        </span>
    );
};

export default SPIBadge;
