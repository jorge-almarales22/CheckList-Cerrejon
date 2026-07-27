import React from 'react';

// Footer institucional de Cerrejón: misma banda a todo el ancho que el panel de
// tortas (amarillo en claro, azul oscuro en dark), con el texto centrado.
const Footer = ({ theme }) => {
    const isDark = theme === 'dark';
    const anio = new Date().getFullYear();

    const fullBleed = {
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        background: isDark ? '#141d33' : '#ffc000',
        borderTop: isDark ? '4px solid #eab308' : 'none'
    };

    return (
        <footer style={fullBleed} className="mt-10 py-6 shadow-inner">
            <p className={`text-center text-xs md:text-sm font-bold px-4 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                © {anio} Cerrejón — Una empresa Glencore · Minería responsable · Todos los derechos reservados.
            </p>
        </footer>
    );
};

export default Footer;
