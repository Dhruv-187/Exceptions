import { useState } from 'react';
import { motion } from 'framer-motion';
import { HiEye, HiEyeOff } from 'react-icons/hi';

const FloatingInput = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  icon,
  delay = 0,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative group"
    >
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder=" "
        className={`glass-input peer pr-12 ${error ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30' : ''}`}
        autoComplete={isPassword ? 'current-password' : type === 'email' ? 'email' : 'off'}
      />
      <label
        htmlFor={id}
        className={`floating-label ${error ? 'text-red-400' : ''}`}
      >
        {label}
      </label>

      {/* Right icon / password toggle */}
      <div className="absolute right-4 top-4">
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-slate-500 hover:text-primary transition-colors focus:outline-none"
          >
            {showPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
          </button>
        ) : icon ? (
          <span className={`material-symbols-outlined text-xl transition-colors ${isFocused ? 'text-primary' : 'text-slate-500'}`}>
            {icon}
          </span>
        ) : null}
      </div>

      {/* Focus glow effect */}
      {isFocused && (
        <motion.div
          layoutId="inputGlow"
          className="absolute inset-0 rounded-lg border border-primary/20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ boxShadow: '0 0 15px rgba(0, 242, 255, 0.1)' }}
        />
      )}

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-400 text-xs mt-1.5 ml-1"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
};

export default FloatingInput;
