import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';
import FloatingInput from '../components/FloatingInput';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminLoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
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
      const { data } = await authAPI.adminLogin(form);
      if (data.success) {
        login(data.token, data.user);
        toast.success(data.message, {
          style: { background: '#0f2223', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)' },
          iconTheme: { primary: '#00f2ff', secondary: '#0f2223' }
        });
        navigate('/admin/dashboard');
      }
    } catch (err) {
      const errData = err.response?.data;
      toast.error(errData?.message || 'Admin login failed');
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
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30">
                <span className="material-symbols-outlined text-amber-500 text-3xl">admin_panel_settings</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-3 tracking-tight">Admin Access</h1>
            <p className="text-slate-400 text-sm">Authorized personnel only</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FloatingInput
              id="email"
              label="Admin Email"
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

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 hover:border-amber-500/50"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span>Access Admin Panel</span>
                  <span className="material-symbols-outlined text-lg">shield</span>
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
              Not a doctor?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline decoration-primary/30 underline-offset-4 ml-1">
                Patient Login
              </Link>
            </p>
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
            <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-amber-400 transition-colors text-sm">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Back to Home</span>
            </Link>
          </motion.div>
        </GlassCard>
      </div>
    </main>
  );
};

export default AdminLoginPage;
