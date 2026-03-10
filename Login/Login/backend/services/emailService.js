const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendOTPEmail = async (email, otp, purpose = 'verification') => {
  const transporter = createTransporter();
  
  const subjects = {
    verification: 'Verify Your NexusCore Account',
    reset: 'Reset Your NexusCore Password'
  };

  const headings = {
    verification: 'Email Verification',
    reset: 'Password Reset'
  };

  const messages = {
    verification: 'Use the following OTP to verify your email address and activate your NexusCore account.',
    reset: 'Use the following OTP to reset your password. If you did not request this, please ignore this email.'
  };

  const htmlTemplate = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f2223; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0, 242, 255, 0.15);">
      <div style="height: 3px; background: linear-gradient(to right, transparent, #00f2ff, transparent);"></div>
      <div style="padding: 40px 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Nexus<span style="color: #00f2ff;">Core</span></h1>
          <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 3px; margin-top: 5px;">${headings[purpose]}</p>
        </div>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; text-align: center;">${messages[purpose]}</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: rgba(0, 242, 255, 0.1); border: 1px solid rgba(0, 242, 255, 0.3); border-radius: 12px; padding: 20px 40px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #00f2ff;">${otp}</span>
          </div>
        </div>
        <p style="color: #64748b; font-size: 12px; text-align: center;">This OTP expires in <strong style="color: #00f2ff;">${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong></p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(0, 242, 255, 0.1); text-align: center;">
          <p style="color: #475569; font-size: 11px;">If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #334155; font-size: 10px; margin-top: 10px;">© 2024 NexusCore Technologies. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"NexusCore" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subjects[purpose],
    html: htmlTemplate
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error.message);
    return false;
  }
};

module.exports = { sendOTPEmail };
