require('dotenv').config();
const admin = require('./node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

const seedColleges = async () => {
  const colleges = [
    { name: 'IIT Delhi', city: 'New Delhi' },
    { name: 'IIT Bombay', city: 'Mumbai' },
    { name: 'NIT Trichy', city: 'Tiruchirappalli' },
    { name: 'BITS Pilani', city: 'Pilani' },
    { name: 'VIT Vellore', city: 'Vellore' },
    { name: 'IIIT Hyderabad', city: 'Hyderabad' },
    { name: 'Manipal University', city: 'Manipal' },
    { name: 'SRM University', city: 'Chennai' },
  ];

  const batch = db.batch();
  for (const c of colleges) {
    const ref = db.collection('colleges').doc();
    batch.set(ref, c);
  }
  await batch.commit();
  console.log('✅ Colleges seeded successfully');
  process.exit(0);
};

seedColleges().catch(e => { console.error(e); process.exit(1); });
