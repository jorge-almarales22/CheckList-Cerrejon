import { WEBHOOK_TEAMS_URL } from '../data/constants';

export const notificarTeams = async (tipoAlerta, responsableEmail, mensaje, checklistNombre) => {
    if (!WEBHOOK_TEAMS_URL || WEBHOOK_TEAMS_URL === "AQUI_TU_URL_DE_POWER_AUTOMATE") return;
    try {
        await fetch(WEBHOOK_TEAMS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipoAlerta, responsableEmail, mensaje, checklistNombre })
        });
    } catch (error) {
        console.error("Fallo al enviar la notificaci\u00f3n a Teams:", error);
    }
};
