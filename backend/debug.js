require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Staff = mongoose.model('Staff', new mongoose.Schema({}, { strict: false }));
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  
  const staffs = await Staff.find({});
  const users = await User.find({});
  
  const deliveryStaff = staffs.filter(s => s.role === 'delivery' || s.email.includes('delivery'));
  const deliveryUsers = users.filter(u => (u.role === 'delivery' || (u.email && u.email.includes('delivery'))));
  
  console.log("=== Delivery Staff ===");
  console.log(JSON.stringify(deliveryStaff, null, 2));
  
  console.log("=== Delivery Users ===");
  console.log(JSON.stringify(deliveryUsers, null, 2));
  
  process.exit(0);
});
