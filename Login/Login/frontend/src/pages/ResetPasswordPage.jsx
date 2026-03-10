import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';
import FloatingInput from '../components/FloatingInput';
import OTPInput from '../components/OTPInput';
import PasswordStrength from '../components/PasswordStrength';
import LoadingSpinner from '../components/LoadingSpinner';

const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, email } = location.state || {};

  const [otp, setOtp] = useState('');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!userId || !email) navigate('/forgot-password');
  }, [userId, email, navigate]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const validate = () => {
    const newErrors = {};
    if (otp.length !== 6) newErrors.otp = 'Please enter the 6-digit OTP';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Minimum 6 characters';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      const { data } = await authAPI.resendOTP({ email, purpose: 'reset' });
      if (data.success) {
        toast.success('New OTP sent to your email!', {
          style: { background: '#0f2223', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)' },
          iconTheme: { primary: '#00f2ff', secondary: '#0f2223' }
        });
        setCooldown(60);
        setOtp('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await authAPI.resetPassword({
        userId,
        otp,
        newPassword: form.password
      });

      if (data.success) {
        toast.success('Password reset successful! Please login with your new password.', {
          duration: 5000,
          style: { background: '#0f2223', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)' },
          iconTheme: { primary: '#00f2ff', secondary: '#0f2223' }
        });
        navigate('/login');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Reset failed. Please try again.';
      toast.error(message);
      if (message.includes('expired') || message.includes('Invalid')) {
        setOtp('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-[450px]">
        <GlassCard>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mb-8"
          >
            <span className="material-symbols-outlined text-primary text-4xl">password</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
            <p className="text-slate-400 text-sm">
              Enter the OTP sent to <span className="text-primary font-medium">{email}</span> and your new password.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* OTP Input */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-300">Verification Code</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {resending ? (
                    <LoadingSpinner size="sm" />
                  ) : cooldown > 0 ? (
                    `Resend in ${cooldown}s`
                  ) : (
                    <>
                      Resend OTP
                      <span className="material-symbols-outlined text-sm">send</span>
                    </>
                  )}
                </button>
              </div>
              <OTPInput
                length={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  if (errors.otp) setErrors({ ...errors, otp: '' });
                }}
                disabled={loading}
              />
              {errors.otp && (
                <p className="text-red-400 text-xs mt-2">{errors.otp}</p>
              )}
            </motion.div>

            <div className="border-t border-slate-700/30 my-6" />

            <FloatingInput
              id="newPassword"
              label="New Password"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              error={errors.password}
              delay={0.25}
            />

            <FloatingInput
              id="confirmNewPassword"
              label="Confirm Password"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              error={errors.confirmPassword}
              delay={0.3}
            />

            <PasswordStrength password={form.password} />

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span>Reset Password</span>
                  <span className="material-symbols-outlined text-lg">lock</span>
                </>
              )}
            </motion.button>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <Link
              to="/login"
              className="text-slate-400 hover:text-primary text-sm transition-colors inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Login
            </Link>
          </motion.div>
        </GlassCard>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
