//bumped on every buildHouseAirwayBillData() call so two house bills created in the same run (same millisecond)
//still get distinct رقم بوليصة الشحن الجوية الداخلية values - the portal rejects a duplicate.
let hawbCounter = 0;

//weight/quantity default to 50 (half the master bill's 100/100). Pass amount to take the whole bill (100).
function buildHouseAirwayBillData(amount = '50') {
  hawbCounter += 1;
  return {
    //رقم بوليصة الشحن الجوية الداخلية - A-Z / 0-9 only, max 10 chars. Date.now() + a per-call counter so each
    //call is unique even within the same millisecond.
    hawbNumber: `H${Date.now().toString().slice(-7)}${hawbCounter}`,
    totalWeight: amount,
    totalQuantity: amount,

    consigneeNameEn: 'Final Consignee',
    consigneeNameAr: 'المستلم النهائي',
    consigneeAddress: 'Riyadh KSA',

    shipperNameEn: 'Test Shipper',
    shipperNameAr: 'الشاحن التجريبي',
    shipperAddress: 'Cairo Egypt',
  };
}

export const houseAirwayBillData = buildHouseAirwayBillData();

//hawbNumber is Date.now()-based so the module-level constant is only unique per process/import - call this for a
//fresh one when several tests in one run each create their own house bill. amount = the total weight/quantity
//('50' for a half split, '100' for a single house bill taking the whole master bill).
export function createHouseAirwayBillData(amount = '50') {
  return buildHouseAirwayBillData(amount);
}

//item + warehouse steps of the house bill wizard. buildHouseBillAmounts(amount) keeps the item weight/quantity
//and warehouse quantity in step with the house bill's own total.
export function buildHouseBillAmounts(amount = '50') {
  return {
    item: {
      packageType: '1',
      itemWeight: amount,
      itemQuantity: amount,
      itemDescAr: 'وصف تجريبي',
      itemDescEn: 'Test description',
      itemMarks: 'MARK1',
    },
    warehouse: {
      warehouseCode: 'WH1',
      warehouseQuantity: amount,
    },
  };
}

export const houseBillItemData = buildHouseBillAmounts('50').item;
export const houseBillWarehouseData = buildHouseBillAmounts('50').warehouse;
