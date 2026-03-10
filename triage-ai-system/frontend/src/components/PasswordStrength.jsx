import { useMemo } from 'react';
import { motion } from 'framer-motion';

const PasswordStrength = ({ password }) => {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
      { score: 0, label: '', color: '', width: '0%' },
      { score: 1, label: 'Weak', color: '#ef4444', width: '20%' },
      { score: 2, label: 'Fair', color: '#f97316', width: '40%' },
      { score: 3, label: 'Good', color: '#eab308', width: '60%' },
      { score: 4, label: 'Strong', color: '#22c55e', width: '80%' },
      { score: 5, label: 'Excellent', color: '#00f2ff', width: '100%' },
    ];

    return levels[score] || levels[0];
  }, [password]);

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2"
    >
      <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-500">
        <span>Password Strength</span>
        <motion.span
          key={strength.label}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ color: strength.color }}
        >
          {strength.label}
        </motion.span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: strength.width }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ 
            backgroundColor: strength.color,
            boxShadow: `0 0 10px ${strength.color}40`
          }}
        />
      </div>
    </motion.div>
  );
};

export default PasswordStrength;
