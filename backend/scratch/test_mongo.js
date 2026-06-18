const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/zappit')
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
