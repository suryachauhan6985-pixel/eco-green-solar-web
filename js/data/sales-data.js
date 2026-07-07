// js/data/sales-data.js
// Shared in-memory "database" for Project Sales + Sale Register.
// Mirrors what the desktop app's stock_ledger table gives for sales queries.

window.SalesData = (function () {
  const challans = [
    {
      challanNo: 'CH-2026-118',
      date: '30-06-2026',
      customer: 'Patel Residence',
      orderNo: 'NP-88231',
      category: 'Solar Panel',
      brand: 'Waaree',
      qty: 12,
      invoice: 'SI-6621',
      edited: 'No',
      serials: ['SN00998821', 'SN00998822']
    },
    {
      challanNo: 'CH-2026-117',
      date: '29-06-2026',
      customer: 'Shah Enterprises',
      orderNo: 'NP-88109',
      category: 'Inverter',
      brand: 'Adani',
      qty: 3,
      invoice: 'SI-6608',
      edited: 'No',
      serials: ['SN00990011']
    }
  ];

  return {
    getAll: function() { return challans; },
    addChallan: function(record) {
      challans.unshift(record);
    }
  };
})();