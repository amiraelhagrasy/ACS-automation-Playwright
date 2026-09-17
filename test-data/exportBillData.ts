function getTodayDate(): string {
    const today = new Date();

    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    return `${day}-${month}-${year}`;
}

function buildExportBillData() {
    return {
        transportCompany: 'الخطوط الجويه العربيه السعوديه',
        billNo: `9${Date.now().toString().slice(-7)}`,
        billDate: getTodayDate(),
        totalWeight: '100',
        totalQuantity: '1',
        destinationCountry: 'مصر',
        destinationPort: 'القاهره',
        ownerNameAr: 'مالك تجريبي',
        ownerNameEn: 'Test Owner',
    };
}

export const exportBillData = buildExportBillData();

//billNo is derived from Date.now(), so the module-level exportBillData constant above is only unique per
//process/import - call this to get a fresh one when a spec file runs multiple tests in one process:
export function createExportBillData() {
    return buildExportBillData();
}

export const exportBillItemData = {
    packageType: '1',
    itemWeight: '100',
    itemQuantity: '1',
    itemDescAr: 'وصف تجريبي',
    itemDescEn: 'Test description',
    itemMarks: 'TEST MARKS',
};
