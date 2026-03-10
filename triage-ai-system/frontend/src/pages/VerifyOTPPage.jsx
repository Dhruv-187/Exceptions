import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';
import OTPInput from '../components/OTPInput';
import LoadingSpinner from '../components/LoadingSpinner';

const VerifyOTPPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { userId, email, purpose = 'verification' } = location.state || {};

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!userId || !email) {
      navigate('/login');
    }
  }, [userId, email, navigate]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.verifyOTP({ userId, otp, purpose });
      if (data.success) {
        toast.success(data.message, {
          style: { background: '#0f2223', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)' },
          iconTheme: { primary: '#00f2ff', secondary: '#0f2223' }
        });

        if (purpose === 'verification') {
          login(data.token, data.user);
          navigate('/dashboard');
        } else if (purpose === 'reset') {
          navigate('/reset-password', { state: { userId, token: data.token } });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;

    setResending(true);
    try {
      const { data } = await authAPI.resendOTP({ email, purpose });
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

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-[450px]">
        <GlassCard>
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mb-8"
          >
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="material-symbols-outlined text-primary text-4xl"
            >
              {purpose === 'reset' ? 'lock_reset' : 'mark_email_read'}
            </motion.span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-bold mb-2">
              {purpose === 'reset' ? 'Verify Reset Code' : 'Verify Your Email'}
            </h1>
            <p className="text-slate-400 text-sm">
              We've sent a 6-digit code to <br />
              <span className="text-primary font-medium">{email}</span>
            </p>
          </motion.div>

          <div className="space-y-6">
            {/* OTP Input */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-slate-300">Enter Verification Code</p>
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
                onChange={setOtp}
                disabled={loading}
              />
            </div>

            {/* Progress indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary/60"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: 'linear' }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Verifying...</span>
                </div>
              </motion.div>
            )}

            <motion.button
              type="button"
              onClick={handleVerify}
              disabled={loading || otp.length !== 6}
              whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span>Verify Code</span>
                  <span className="material-symbols-outlined text-lg">verified</span>
                </>
              )}
            </motion.button>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-slate-500 text-xs mt-6"
          >
            Didn't receive the code? Check your spam folder
          </motion.p>
        </GlassCard>
      </div>
    </main>
  );
};

export default VerifyOTPPage;
