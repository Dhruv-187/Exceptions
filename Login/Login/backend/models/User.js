const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  otp: {
    code: { type: String, select: false },
    expiresAt: { type: Date, select: false },
    purpose: { type: String, enum: ['verification', 'reset'], select: false }
  },
  otpRequestCount: {
    type: Number,
    default: 0,
    select: false
  },
  otpLastRequestAt: {
    type: Date,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function(purpose = 'verification') {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000),
    purpose
  };
  this.otpRequestCount = (this.otpRequestCount || 0) + 1;
  this.otpLastRequestAt = new Date();
  return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function(code, purpose) {
  if (!this.otp || !this.otp.code) return false;
  if (this.otp.purpose !== purpose) return false;
  if (new Date() > this.otp.expiresAt) return false;
  return this.otp.code === code;
};

// Clear OTP
userSchema.methods.clearOTP = function() {
  this.otp = undefined;
  this.otpRequestCount = 0;
};

module.exports = mongoose.model('User', userSchema);
