const mongoose = require('mongoose');
require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('SUCCESS! Successfully connected to MongoDB.');
    process.exit(0);
  })
  .catch(err => {
    console.error('CONNECTION FAILED:', err.message);
    process.exit(1);
  });
