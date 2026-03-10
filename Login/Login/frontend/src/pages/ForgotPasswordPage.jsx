import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';
import FloatingInput from '../components/FloatingInput';
import LoadingSpinner from '../components/LoadingSpinner';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword({ email });
      toast.success('If a matching account exists, an OTP has been sent.', {
        duration: 5000,
        style: { background: '#0f2223', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)' },
        iconTheme: { primary: '#00f2ff', secondary: '#0f2223' }
      });
      if (data.userId) {
        navigate('/reset-password', {
          state: { userId: data.userId, email }
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
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
            <span className="material-symbols-outlined text-primary text-4xl">lock_reset</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-bold mb-2">Forgot Password?</h1>
            <p className="text-slate-400 text-sm">
              Enter your email address and we'll send you a verification code to reset your password.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FloatingInput
              id="email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              error={error}
              icon="alternate_email"
              delay={0.2}
            />

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span>Send Reset Code</span>
                  <span className="material-symbols-outlined text-lg">send</span>
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

export default ForgotPasswordPage;
