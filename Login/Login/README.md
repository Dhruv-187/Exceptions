# NexusCore Authentication System

A modern, futuristic authentication system with Email OTP verification, glassmorphism UI, and animated particle backgrounds.

## Tech Stack

**Frontend:** React.js, Tailwind CSS, Framer Motion, Particles  
**Backend:** Node.js, Express.js, MongoDB  
**Auth:** JWT, bcrypt, Email OTP

## Features

- User Registration with Email OTP verification
- Secure Login with JWT authentication
- Password hashing (bcrypt, 12 salt rounds)
- Forgot Password via email OTP
- Rate limiting on OTP & login endpoints
- OTP expiry system (configurable)
- Protected routes & Dashboard
- Glassmorphism UI with particle animations
- Password strength indicator
- Animated OTP input boxes
- Real-time form validation
- Responsive mobile-friendly design

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally or a MongoDB Atlas URI
- Gmail account with App Password (for sending OTP emails)

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and email credentials
npm install
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Configure Email

In `backend/.env`, set:
```
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
```

To get a Gmail App Password:
1. Enable 2-Step Verification on your Google Account
2. Go to https://myaccount.google.com/apppasswords
3. Generate a new App Password for "Mail"

### 4. Access the App

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/api/health

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/verify-otp` | Verify email OTP |
| POST | `/api/auth/resend-otp` | Resend OTP (rate limited) |
| POST | `/api/auth/login` | Login (rate limited) |
| POST | `/api/auth/forgot-password` | Send password reset OTP |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/me` | Get current user (protected) |

## Project Structure

```
├── backend/
│   ├── controllers/authController.js
│   ├── middleware/auth.js
│   ├── middleware/rateLimiter.js
│   ├── models/User.js
│   ├── routes/authRoutes.js
│   ├── services/emailService.js
│   └── server.js
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── FloatingInput.jsx
│       │   ├── GlassCard.jsx
│       │   ├── LoadingSpinner.jsx
│       │   ├── Navbar.jsx
│       │   ├── OTPInput.jsx
│       │   ├── ParticleBackground.jsx
│       │   ├── PasswordStrength.jsx
│       │   ├── ProtectedRoute.jsx
│       │   └── SocialButtons.jsx
│       ├── context/AuthContext.jsx
│       ├── pages/
│       │   ├── DashboardPage.jsx
│       │   ├── ForgotPasswordPage.jsx
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── ResetPasswordPage.jsx
│       │   └── VerifyOTPPage.jsx
│       ├── services/api.js
│       ├── App.jsx
│       └── main.jsx
```
