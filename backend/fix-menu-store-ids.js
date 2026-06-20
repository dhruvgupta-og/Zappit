const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Store = require('./models/Store');
const MenuItem = require('./models/MenuItem');

async function fixMenu() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all stores
    const stores = await Store.find();
    
    // Get all menu items where store_id is a string (not a valid ObjectId)
    // Actually, let's just get all menu items
    const menuItems = await MenuItem.find();
    
    let updatedCount = 0;

    for (let item of menuItems) {
      if (item.store_id && item.store_id.length !== 24) { // Not a valid MongoDB ObjectId
        console.log(`Found menu item with invalid store_id: ${item.store_id} (Item: ${item.name})`);
        
        // Try to find the matching store by name, or name + college
        let matchingStore = stores.find(s => 
          s.name === item.store_id || 
          `${s.name} (${s.college_name})` === item.store_id ||
          item.store_id.includes(s.name)
        );

        // Special case for typo in "Nesafe"
        if (item.store_id === "Nesafe (ITM GOI)") {
          matchingStore = stores.find(s => s.name === "Nescafe");
        }

        if (matchingStore) {
          console.log(`  -> Mapping to store: ${matchingStore.name} (ID: ${matchingStore._id})`);
          item.store_id = matchingStore._id.toString();
          await item.save();
          updatedCount++;
        } else {
          console.log(`  -> NO MATCHING STORE FOUND for ${item.store_id}`);
        }
      }
    }
    
    console.log(`\nSuccessfully updated ${updatedCount} menu items!`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixMenu();
