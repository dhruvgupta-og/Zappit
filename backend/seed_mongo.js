require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('./models/Store');
const MenuItem = require('./models/MenuItem');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zappit');
    console.log('Connected to MongoDB');

    await Store.deleteMany({});
    await MenuItem.deleteMany({});

    const store1 = await Store.create({
      name: 'Campus Bites',
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
      rating: 4.8,
      delivery_time_mins: '10-15',
      tags: ['Snacks', 'Beverages']
    });

    const store2 = await Store.create({
      name: 'Healthy Hub',
      image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80',
      rating: 4.5,
      delivery_time_mins: '20-25',
      tags: ['Salads', 'Juices']
    });

    await MenuItem.insertMany([
      { store_id: store1._id, name: 'Peri Peri Fries', price: 90, desc: 'Crispy fries tossed in spicy peri peri mix', category: 'Snacks', isVeg: true, image: 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?auto=format&fit=crop&w=200&q=80' },
      { store_id: store1._id, name: 'Cold Coffee', price: 120, desc: 'Classic cold coffee', category: 'Beverages', isVeg: true, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=200&q=80' },
      { store_id: store2._id, name: 'Caesar Salad', price: 150, desc: 'Fresh lettuce with caesar dressing', category: 'Salads', isVeg: true, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80' },
    ]);

    console.log('Database Seeded Successfully');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();
