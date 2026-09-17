function getTodayDate(): string {
  const today = new Date();

  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `${day}-${month}-${year}`;
}

function buildMasterBillData() {
  return {
    transportCompany: 'الخطوط الجويه العربيه السعوديه',
    billNo: `9${Date.now().toString().slice(-7)}`,
    billDate: getTodayDate(),
    billType: '1',
    billCategory: '1',
    totalOriginalWeight: '100',
    totalOriginalQuantity: '100',

    ownerNameEn: 'Test Owner',
    ownerNameAr: 'مالك تجريبي',
    calculationMethod: 'CC',
    currency: 'ريال سعودي',
    transferFees: '100',
    paymentMethod: '0',
  };
}

export const masterBillData = buildMasterBillData();

//billNo is derived from Date.now(), so the module-level masterBillData constant above is only unique per
//process/import - fine for single-test runs, but every test in a run that shares one process (e.g. running this
//whole spec file at once) would reuse the same billNo and collide server-side. Call this to get a fresh one:
export function createMasterBillData() {
  return buildMasterBillData();
}

export const airwayBillData = {
  deliveredWeight: '100',
  deliveredQuantity: '100',
  manifestType: '1',
};

export const billItemData = {
  packageType: '1',
  itemWeight: '100',
  itemQuantity: '100',
  itemDescAr: 'وصف تجريبي',
  itemDescEn: 'Test description',
};

export const warehouseData = {
  warehouseCode: 'WH1',
  warehouseQuantity: '100',
};
