import React from 'react';

// Footer institucional de Cerrejón: misma banda a todo el ancho que el panel de
// tortas (amarillo en claro, azul oscuro en dark), con el texto centrado.
const Footer = ({ theme }) => {
    const isDark = theme === 'dark';
    const anio = new Date().getFullYear();

    const bandStyle = {
        background: isDark ? '#141d33' : '#ffc000',
        borderTop: isDark ? '4px solid #eab308' : 'none'
    };

    return (
        <footer style={bandStyle} className="w-full shrink-0 py-4 shadow-inner">
            <p className={`text-center text-xs md:text-sm font-bold px-4 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                © {anio} Cerrejón — Una empresa Glencore · Minería responsable · Todos los derechos reservados.
            </p>
        </footer>
    );
};

export default Footer;
