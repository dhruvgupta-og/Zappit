const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zappit')
.then(() => console.log('Connected to MongoDB (Database Layer)'))
.catch(err => console.error('MongoDB connection error:', err));

module.exports = mongoose;
