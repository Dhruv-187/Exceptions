import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';
import FloatingInput from '../components/FloatingInput';
import LoadingSpinner from '../components/LoadingSpinner';

const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid email format';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await authAPI.login(form);
      if (data.success) {
        login(data.token, data.user);
        toast.success(data.message, {
          style: { background: '#0f2223', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)' },
          iconTheme: { primary: '#00f2ff', secondary: '#0f2223' }
        });
        navigate('/dashboard');
      }
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.needsVerification) {
        toast.error('Please verify your email first');
        navigate('/verify-otp', { state: { userId: errData.userId, email: form.email, purpose: 'verification' } });
      } else {
        toast.error(errData?.message || 'Login failed');
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-10"
          >
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/30">
                <span className="material-symbols-outlined text-primary text-3xl">person</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-3 tracking-tight">Patient Login</h1>
            <p className="text-slate-400 text-sm">Enter your credentials to access the patient portal</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FloatingInput
              id="email"
              label="Email Address"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              error={errors.email}
              icon="alternate_email"
              delay={0.1}
            />

            <FloatingInput
              id="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              error={errors.password}
              delay={0.15}
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-between text-xs sm:text-sm"
            >
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800/40 text-primary focus:ring-primary/30 w-4 h-4"
                />
                <span className="text-slate-400 group-hover:text-slate-300 transition-colors">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-primary hover:underline font-medium decoration-primary/30 underline-offset-4"
              >
                Forgot password?
              </Link>
            </motion.div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="btn-primary flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span>Log In</span>
                  <span className="material-symbols-outlined text-lg">login</span>
                </>
              )}
            </motion.button>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center space-y-4"
          >
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary font-bold hover:underline decoration-primary/30 underline-offset-4 ml-1">
                Sign up
              </Link>
            </p>
            <div className="gradient-line"></div>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-base">stethoscope</span>
              <span>Doctor / Admin Login</span>
            </Link>
          </motion.div>
        </GlassCard>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-col items-center gap-4"
        >
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Back to Home</span>
          </Link>
          <div className="flex justify-center gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Contact Support</a>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default LoginPage;
