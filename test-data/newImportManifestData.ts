function getTodayDate(): string {
  const today = new Date();

  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `${day}-${month}-${year}`;
}

function buildNewImportManifestData() {
  return {
    transportCompany: 'الخطوط الجويه العربيه السعوديه',
    flightNumber: `SV${Date.now().toString().slice(-5)}`,
    loadingCountry: 'مصر',
    loadingPort: 'القاهره',

    departureDate: getTodayDate(),
    arrivalDate: getTodayDate(),
    unloadingDate: getTodayDate(),

    totalNumberOfBills: '1',
    shippingAgentType: '1',
    finalAirportText: 'جمرك مطار الملك خالد الدولي',
  };
}

export const newImportManifestData = buildNewImportManifestData();

//flightNumber is derived from Date.now(), so the module-level newImportManifestData constant above is only unique
//per process/import - fine for single-test runs, but every test in a run that shares one process (e.g. running a
//whole spec file at once) would reuse the same flightNumber and collide server-side. Call this to get a fresh one:
export function createNewImportManifestData() {
  return buildNewImportManifestData();
}