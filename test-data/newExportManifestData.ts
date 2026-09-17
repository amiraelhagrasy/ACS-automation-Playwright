function getTodayDate(): string {
    const today = new Date();

    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    return `${day}-${month}-${year}`;
}

function buildNewExportManifestData() {
    return {
        exportPort: '23', //مطار الملك خالد الدولي
        transportCompany: 'الخطوط الجويه العربيه السعوديه',
        flightNumber: `SV${Date.now().toString().slice(-5)}`,
        departureDate: getTodayDate(),
        issueDate: getTodayDate(),
        shippingAgentType: '1',
        shippingAgentNumber: '1',
    };
}

export const newExportManifestData = buildNewExportManifestData();

//flightNumber is derived from Date.now(), so the module-level newExportManifestData constant above is only unique
//per process/import - call this to get a fresh one when a spec file runs multiple tests in one process:
export function createNewExportManifestData() {
    return buildNewExportManifestData();
}
