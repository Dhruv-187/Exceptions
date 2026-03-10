const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pulsepriority_auth';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ email: 'admin@pulsepriority.com' });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email: admin@pulsepriority.com');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    // Insert admin user
    const result = await usersCollection.insertOne({
      name: 'Admin',
      email: 'admin@pulsepriority.com',
      password: hashedPassword,
      isVerified: true,
      role: 'admin',
      createdAt: new Date()
    });

    console.log('Admin user created successfully!');
    console.log('Email: admin@pulsepriority.com');
    console.log('Password: Admin@123');
    console.log('Document ID:', result.insertedId);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seedAdmin();
