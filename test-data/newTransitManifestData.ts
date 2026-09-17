function getTodayDate(): string {
  const today = new Date();

  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `${day}-${month}-${year}`;
}

function buildNewTransitManifestData() {
  return {
    finalCountry: 'مصر',
    finalPort: 'القاهره',
    finalPortCodeType: '4', // مخرج جوي (air exit)
    transitType: '3', // دولي (international)
    transportCompany: 'الخطوط الجويه العربيه السعوديه',
    flightNumber: `TR${Date.now().toString().slice(-5)}`,
    departureDate: getTodayDate(),
    viaAirportText: 'جمرك مطار الملك خالد الدولي',
  };
}

export const newTransitManifestData = buildNewTransitManifestData();

//flightNumber is derived from Date.now(), so the module-level newTransitManifestData constant above is only
//unique per process/import - fine for single-test runs, but every test in a run that shares one process (e.g.
//running a whole spec file at once) would reuse the same flightNumber and collide server-side. Call this to get a
//fresh one:
export function createNewTransitManifestData() {
  return buildNewTransitManifestData();
}
