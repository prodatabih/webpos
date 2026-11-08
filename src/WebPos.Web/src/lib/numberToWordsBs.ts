const ONES = ['', 'jedna', 'dvije', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet'];
const TEENS = [
  'deset',
  'jedanaest',
  'dvanaest',
  'trinaest',
  'četrnaest',
  'petnaest',
  'šesnaest',
  'sedamnaest',
  'osamnaest',
  'devetnaest',
];
const TENS = ['', 'deset', 'dvadeset', 'trideset', 'četrdeset', 'pedeset', 'šezdeset', 'sedamdeset', 'osamdeset', 'devedeset'];
const HUNDREDS = ['', 'sto', 'dvjesto', 'tristo', 'četiristo', 'petsto', 'šeststo', 'sedamsto', 'osamsto', 'devetsto'];

function convertHundreds(n: number): string {
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  const t = Math.floor(remainder / 10);
  const o = remainder % 10;

  const parts: string[] = [];
  if (h > 0) parts.push(HUNDREDS[h] || '');
  if (t === 1) {
    parts.push(TEENS[o] || '');
  } else {
    if (t > 1) parts.push(TENS[t] || '');
    if (o > 0) parts.push(ONES[o] || '');
  }
  return parts.filter(Boolean).join(' ');
}

export function amountToWordsBs(amountStr: string): string {
  const parts = amountStr.split('.');
  const wholePart = parseInt(parts[0] || '0', 10);
  const decimalPart = (parts[1] || '00').slice(0, 2).padEnd(2, '0');

  if (Number.isNaN(wholePart) || wholePart === 0) {
    return `nula KM i ${decimalPart}/100`;
  }

  const thousands = Math.floor(wholePart / 1000);
  const remainder = wholePart % 1000;

  const words: string[] = [];
  if (thousands > 0) {
    if (thousands === 1) {
      words.push('jedna hiljada');
    } else if (thousands >= 2 && thousands <= 4) {
      words.push(`${convertHundreds(thousands)} hiljade`);
    } else {
      words.push(`${convertHundreds(thousands)} hiljada`);
    }
  }

  if (remainder > 0) {
    words.push(convertHundreds(remainder));
  }

  return `${words.join(' ')} KM i ${decimalPart}/100`;
}
