const fs = require('fs');
const path = require('path');

const indicatorId = 'dropout_girls';
const period = '2023-Q4';
const geoKey = `${period}_MH`;

const payload = {
  [indicatorId]: {
    [geoKey]: {
      headline: 'Dropout for girls stalled after earlier gains; targeted basics can flip the curve',
      body: 'State-wide dropout for girls is at 14.2%, roughly flat from last quarter and 2.1 pp better than two years ago. The sharpest pockets remain in Nandurbar, Gadchiroli, and Palghar where weak toilets and teacher gaps coincide. Quick wins: deploy bridge-courses in the 50 worst upper-primary schools, finish toilet repairs before monsoon, and ring-fence transport stipends for tribal blocks.',
      calloutDistricts: ['NANP','GAD','PAL'],
      actions: [
        'Approve Rs 3.2 Cr for accelerated toilet repairs in 12 blocks',
        'Post 120 temporary instructors in Nandurbar and Gadchiroli for 90 days',
        "Scale the 'stay-in-school' stipend pilot to 8 tribal clusters"
      ]
    }
  }
};

const outPath = path.join(__dirname, '..', 'data', 'precomputed_narratives.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log('Wrote', outPath);
