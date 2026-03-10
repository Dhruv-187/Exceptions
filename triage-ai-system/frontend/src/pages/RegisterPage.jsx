import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';
import FloatingInput from '../components/FloatingInput';
import PasswordStrength from '../components/PasswordStrength';
import LoadingSpinner from '../components/LoadingSpinner';

const RegisterPage = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!form.name || form.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid email format';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Minimum 6 characters';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await authAPI.register({
        name: form.name,
        email: form.email,
        password: form.password
      });
      if (data.success) {
        toast.success(data.message, {
          duration: 5000,
          style: { background: '#0f2223', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)' },
          iconTheme: { primary: '#00f2ff', secondary: '#0f2223' }
        });
        navigate('/verify-otp', {
          state: { userId: data.userId, email: form.email, purpose: 'verification' }
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
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
      <div className="w-full max-w-[500px]">
        <GlassCard>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-slate-400 text-sm">Join the next generation of enterprise SaaS.</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FloatingInput
              id="name"
              label="Full Name"
              value={form.name}
              onChange={handleChange('name')}
              error={errors.name}
              icon="person"
              delay={0.1}
            />

            <FloatingInput
              id="email"
              label="Email Address"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              error={errors.email}
              icon="alternate_email"
              delay={0.15}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingInput
                id="password"
                label="Password"
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                error={errors.password}
                delay={0.2}
              />
              <FloatingInput
                id="confirmPassword"
                label="Confirm"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                error={errors.confirmPassword}
                delay={0.25}
              />
            </div>

            <PasswordStrength password={form.password} />

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
                  <span>Initialize Registration</span>
                  <span className="material-symbols-outlined text-lg">bolt</span>
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
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4 ml-1">
                Log in
              </Link>
            </p>
          </motion.div>
        </GlassCard>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[10px] uppercase tracking-[0.2em] text-slate-600 font-bold"
        >
          <a href="#" className="hover:text-primary transition-colors">Privacy Protocol</a>
          <a href="#" className="hover:text-primary transition-colors">Service Terms</a>
          <a href="#" className="hover:text-primary transition-colors">Compliance</a>
        </motion.div>
      </div>
    </main>
  );
};

export default RegisterPage;
