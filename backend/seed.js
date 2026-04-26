const { db } = require('./firebase');

const stores = [
  {
    name: 'Campus Bites',
    rating: 4.8,
    delivery_time_mins: 15,
    tags: ['Snacks', 'Beverages'],
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    is_open: true
  },
  {
    name: 'Healthy Hub',
    rating: 4.5,
    delivery_time_mins: 20,
    tags: ['Salads', 'High-Protein'],
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    is_open: true
  }
];

const menus = {
  'Campus Bites': [
    { name: 'Peri Peri Fries', price: 90, desc: 'Crispy fries tossed in spicy peri peri mix', category: 'Snacks', isVeg: true, image: 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80' },
    { name: 'Cold Coffee', price: 120, desc: 'Classic cold coffee with vanilla ice cream', category: 'Beverages', isVeg: true, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80' }
  ],
  'Healthy Hub': [
    { name: 'Chicken Salad', price: 180, desc: 'Fresh greens with grilled chicken', category: 'Salads', isVeg: false, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80' }
  ]
};

async function seedData() {
  console.log('Seeding data to Firestore...');
  try {
    for (const store of stores) {
      const storeRef = await db.collection('stores').add(store);
      console.log(`Added store: ${store.name} with ID: ${storeRef.id}`);

      const storeMenus = menus[store.name];
      if (storeMenus) {
        for (const item of storeMenus) {
          await db.collection('stores').doc(storeRef.id).collection('menu').add(item);
          console.log(`  Added menu item: ${item.name}`);
        }
      }
    }
    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seedData();
