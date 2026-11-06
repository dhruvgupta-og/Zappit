require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : val.toString();
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');
  const db = mongoose.connection.db;

  const sqlStatements = [];
  sqlStatements.push('-- Seed data generated from MongoDB Atlas');

  // 1. Colleges & Blocks
  console.log('Exporting colleges...');
  const colleges = await db.collection('colleges').find().toArray();
  const validCollegeIds = new Set();
  const defaultCollegeId = colleges[0]?._id?.toString() || '6a365fad3a6db6e97aeb55e7';

  for (const col of colleges) {
    const id = col._id.toString();
    validCollegeIds.add(id);
    const name = col.name || 'Campus';
    const city = col.city || null;
    const isActive = col.isActive !== false;
    const createdAt = col.createdAt ? new Date(col.createdAt) : new Date();
    const updatedAt = col.updatedAt ? new Date(col.updatedAt) : new Date();

    sqlStatements.push(
      `INSERT OR REPLACE INTO "College" ("id", "name", "city", "isActive", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(name)}, ${sqlEscape(city)}, ${sqlEscape(isActive)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
    );

    if (Array.isArray(col.blocks)) {
      for (const b of col.blocks) {
        const blockId = b._id ? b._id.toString() : `block_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const bName = b.name || 'Block';
        const dFee = Number(b.deliveryFee || 0);
        sqlStatements.push(
          `INSERT OR REPLACE INTO "Block" ("id", "collegeId", "name", "deliveryFee") VALUES (${sqlEscape(blockId)}, ${sqlEscape(id)}, ${sqlEscape(bName)}, ${sqlEscape(dFee)});`
        );
      }
    }
  }

  // 2. Stores
  console.log('Exporting stores...');
  const stores = await db.collection('stores').find().toArray();
  const validStoreIds = new Set();
  for (const st of stores) {
    const id = st._id.toString();
    validStoreIds.add(id);
    let collegeId = st.college_id ? st.college_id.toString() : defaultCollegeId;
    if (!validCollegeIds.has(collegeId)) {
      collegeId = defaultCollegeId;
    }
    const name = st.name || 'Store';
    const desc = st.description || null;
    const image = st.image || null;
    const rating = Number(st.rating || 4.0);
    const dTime = st.delivery_time_mins || '15-20';
    const isOpen = st.is_open !== false;
    const tags = Array.isArray(st.tags) ? JSON.stringify(st.tags) : (st.tags || '[]');
    const createdAt = st.createdAt ? new Date(st.createdAt) : new Date();
    const updatedAt = st.updatedAt ? new Date(st.updatedAt) : new Date();

    sqlStatements.push(
      `INSERT OR REPLACE INTO "Store" ("id", "collegeId", "name", "description", "image", "rating", "deliveryTimeMins", "isOpen", "tags", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(collegeId)}, ${sqlEscape(name)}, ${sqlEscape(desc)}, ${sqlEscape(image)}, ${sqlEscape(rating)}, ${sqlEscape(dTime)}, ${sqlEscape(isOpen)}, ${sqlEscape(tags)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
    );
  }

  // 3. MenuItems
  console.log('Exporting menuitems...');
  const menuitems = await db.collection('menuitems').find().toArray();
  for (const item of menuitems) {
    const id = item._id.toString();
    const storeId = item.store_id ? item.store_id.toString() : null;
    if (!storeId || !validStoreIds.has(storeId)) {
      console.warn(`Skipping menuItem ${item.name} (${id}): invalid storeId ${storeId}`);
      continue;
    }
    const name = item.name || 'Item';
    const price = Number(item.price || 0);
    const desc = item.desc || null;
    const category = item.category || 'Other';
    const isVeg = item.isVeg !== false;
    const image = item.image || null;
    const isAvailable = item.is_available !== false;
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    const updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();

    sqlStatements.push(
      `INSERT OR REPLACE INTO "MenuItem" ("id", "storeId", "name", "price", "desc", "category", "isVeg", "image", "isAvailable", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(storeId)}, ${sqlEscape(name)}, ${sqlEscape(price)}, ${sqlEscape(desc)}, ${sqlEscape(category)}, ${sqlEscape(isVeg)}, ${sqlEscape(image)}, ${sqlEscape(isAvailable)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
    );
  }

  // 4. Coupons
  console.log('Exporting coupons...');
  const coupons = await db.collection('coupons').find().toArray();
  for (const cp of coupons) {
    const id = cp._id.toString();
    const code = (cp.code || '').toUpperCase().trim();
    if (!code) continue;
    const discountPercent = Number(cp.discount_percent || cp.discount || 0);
    const discount = discountPercent;
    const type = cp.type || 'percent';
    const minOrder = Number(cp.minOrder || 0);
    const maxUses = cp.maxUses ? Number(cp.maxUses) : null;
    const usedCount = Number(cp.usedCount || 0);
    const collegeId = cp.college_id ? cp.college_id.toString() : 'all';
    const oncePerUser = cp.once_per_user !== false;
    const active = cp.active !== false;
    const createdAt = cp.createdAt ? new Date(cp.createdAt) : new Date();
    const updatedAt = cp.updatedAt ? new Date(cp.updatedAt) : new Date();

    sqlStatements.push(
      `INSERT OR REPLACE INTO "Coupon" ("id", "code", "discountPercent", "discount", "type", "minOrder", "maxUses", "usedCount", "collegeId", "oncePerUser", "active", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(code)}, ${sqlEscape(discountPercent)}, ${sqlEscape(discount)}, ${sqlEscape(type)}, ${sqlEscape(minOrder)}, ${sqlEscape(maxUses)}, ${sqlEscape(usedCount)}, ${sqlEscape(collegeId)}, ${sqlEscape(oncePerUser)}, ${sqlEscape(active)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
    );
  }

  // 5. Banners
  console.log('Exporting banners...');
  const banners = await db.collection('banners').find().toArray();
  for (const bn of banners) {
    const id = bn._id.toString();
    const imageUrl = bn.image || bn.imageUrl || '';
    const couponCode = bn.coupon_code || bn.couponCode || null;
    const collegeId = bn.college_id || bn.collegeId || 'all';
    const active = bn.active !== false;
    const createdAt = bn.createdAt ? new Date(bn.createdAt) : new Date();
    const updatedAt = bn.updatedAt ? new Date(bn.updatedAt) : new Date();

    sqlStatements.push(
      `INSERT OR REPLACE INTO "Banner" ("id", "imageUrl", "couponCode", "collegeId", "active", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(imageUrl)}, ${sqlEscape(couponCode)}, ${sqlEscape(collegeId)}, ${sqlEscape(active)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
    );
  }

  // 6. Configs
  console.log('Exporting configs...');
  const configs = await db.collection('configs').find().toArray();
  for (const cfg of configs) {
    const key = cfg._id.toString();
    const copy = { ...cfg };
    delete copy._id;
    delete copy.__v;
    const valStr = JSON.stringify(copy);
    const updatedAt = new Date();

    sqlStatements.push(
      `INSERT OR REPLACE INTO "Config" ("key", "value", "updatedAt") VALUES (${sqlEscape(key)}, ${sqlEscape(valStr)}, ${sqlEscape(updatedAt)});`
    );
  }

  // 7. Users
  console.log('Exporting users...');
  const users = await db.collection('users').find().toArray();
  const validUserIds = new Set();
  for (const u of users) {
    const id = u._id.toString();
    validUserIds.add(id);
    const name = u.name || null;
    const email = u.email || null;
    const phone = u.phone || null;
    const role = u.role || 'user';
    let collegeId = u.college_id ? u.college_id.toString() : null;
    if (collegeId && !validCollegeIds.has(collegeId)) collegeId = null;
    const collegeName = u.college_name || u.college || null;
    const address = u.address || null;
    const expoPushToken = u.expoPushToken || null;
    const fcmToken = u.fcmToken || null;
    const usedCoupons = Array.isArray(u.used_coupons) ? JSON.stringify(u.used_coupons) : (u.usedCoupons || '[]');
    const isBlocked = u.blocked === true || u.isBlocked === true;
    const createdAt = u.createdAt ? new Date(u.createdAt) : new Date();
    const updatedAt = u.updatedAt ? new Date(u.updatedAt) : new Date();

    sqlStatements.push(
      `INSERT OR REPLACE INTO "User" ("id", "name", "email", "phone", "role", "collegeId", "collegeName", "address", "expoPushToken", "fcmToken", "usedCoupons", "isBlocked", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(name)}, ${sqlEscape(email)}, ${sqlEscape(phone)}, ${sqlEscape(role)}, ${sqlEscape(collegeId)}, ${sqlEscape(collegeName)}, ${sqlEscape(address)}, ${sqlEscape(expoPushToken)}, ${sqlEscape(fcmToken)}, ${sqlEscape(usedCoupons)}, ${sqlEscape(isBlocked)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
    );
  }

  // 8. Staffs
  console.log('Exporting staff...');
  const staffCollections = ['staffs', 'staff'];
  const seenStaff = new Set();
  for (const colName of staffCollections) {
    const staffs = await db.collection(colName).find().toArray();
    for (const st of staffs) {
      const id = st._id.toString();
      if (seenStaff.has(id)) continue;
      seenStaff.add(id);

      const email = (st.email && st.email.trim()) ? st.email.trim() : `${id}@zappit.shop`;
      const role = st.role || 'store_owner';
      const name = st.name || null;
      const phone = st.phone || null;
      const rawStoreId = st.store_id ? st.store_id.toString().trim() : null;
      const storeId = rawStoreId && validStoreIds.has(rawStoreId) ? rawStoreId : null;
      const rawCollegeId = st.college_id ? st.college_id.toString().trim() : null;
      const collegeId = rawCollegeId && validCollegeIds.has(rawCollegeId) ? rawCollegeId : null;
      const createdAt = st.createdAt ? new Date(st.createdAt) : new Date();
      const updatedAt = st.updatedAt ? new Date(st.updatedAt) : new Date();

      sqlStatements.push(
        `INSERT OR REPLACE INTO "Staff" ("id", "email", "role", "name", "phone", "storeId", "collegeId", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(email)}, ${sqlEscape(role)}, ${sqlEscape(name)}, ${sqlEscape(phone)}, ${sqlEscape(storeId)}, ${sqlEscape(collegeId)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
      );
    }
  }

  // 9. Orders
  console.log('Exporting orders...');
  const orders = await db.collection('orders').find().toArray();
  let migratedOrders = 0;
  for (const o of orders) {
    const id = o._id.toString();
    const userId = o.user_id ? o.user_id.toString() : null;
    const storeId = o.store_id ? o.store_id.toString() : null;
    let collegeId = o.college_id ? o.college_id.toString() : null;
    if (!collegeId || !validCollegeIds.has(collegeId)) {
      collegeId = defaultCollegeId;
    }

    // Only migrate orders with valid foreign keys for user and store
    if (!userId || !validUserIds.has(userId) || !storeId || !validStoreIds.has(storeId)) {
      continue;
    }

    const userName = o.userName || o.user_name || null;
    const userPhone = o.userPhone || o.user_phone || null;
    const storeName = o.storeName || o.store_name || null;
    const collegeName = o.collegeName || o.college_name || null;
    const items = typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []);
    const totalAmount = Number(o.total_amount || 0);
    const discountAmount = Number(o.discount_amount || 0);
    const couponApplied = o.coupon_applied || null;
    const address = o.address || 'Campus';
    const deliveryFee = Number(o.delivery_fee || 0);
    const paymentStatus = o.payment_status || 'pending';
    const orderStatus = o.order_status || 'pending';
    const additionalNote = o.additional_note || null;
    const deliveryOtp = o.delivery_otp ? String(o.delivery_otp) : '0000';
    const razorpayOrderId = o.razorpay_order_id || null;
    const razorpayPaymentId = o.razorpay_payment_id || null;
    const createdAt = o.created_at ? new Date(o.created_at) : (o.createdAt ? new Date(o.createdAt) : new Date());
    const updatedAt = o.updatedAt ? new Date(o.updatedAt) : createdAt;

    sqlStatements.push(
      `INSERT OR REPLACE INTO "Order" ("id", "userId", "userName", "userPhone", "collegeId", "collegeName", "storeId", "storeName", "items", "totalAmount", "discountAmount", "couponApplied", "address", "deliveryFee", "paymentStatus", "orderStatus", "additionalNote", "deliveryOtp", "razorpayOrderId", "razorpayPaymentId", "createdAt", "updatedAt") VALUES (${sqlEscape(id)}, ${sqlEscape(userId)}, ${sqlEscape(userName)}, ${sqlEscape(userPhone)}, ${sqlEscape(collegeId)}, ${sqlEscape(collegeName)}, ${sqlEscape(storeId)}, ${sqlEscape(storeName)}, ${sqlEscape(items)}, ${sqlEscape(totalAmount)}, ${sqlEscape(discountAmount)}, ${sqlEscape(couponApplied)}, ${sqlEscape(address)}, ${sqlEscape(deliveryFee)}, ${sqlEscape(paymentStatus)}, ${sqlEscape(orderStatus)}, ${sqlEscape(additionalNote)}, ${sqlEscape(deliveryOtp)}, ${sqlEscape(razorpayOrderId)}, ${sqlEscape(razorpayPaymentId)}, ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)});`
    );
    migratedOrders++;
  }
  console.log(`Prepared ${migratedOrders}/${orders.length} orders`);

  const outPath = path.resolve(__dirname, '../../backend-edge/migrations/seed_data.sql');
  fs.writeFileSync(outPath, sqlStatements.join('\n'), 'utf8');
  console.log(`Successfully generated ${sqlStatements.length} SQL statements to ${outPath}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration export error:', err);
  process.exit(1);
});
