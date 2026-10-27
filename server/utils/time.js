function getISTParts(d) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return fmt.formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
}

function ledgerTimestamp() {
  const p = getISTParts(new Date());
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

module.exports = { getISTParts, ledgerTimestamp };
