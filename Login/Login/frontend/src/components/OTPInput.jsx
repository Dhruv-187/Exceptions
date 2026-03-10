import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const OTPInput = ({ length = 6, value, onChange, disabled = false }) => {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    if (value) {
      const otpArr = value.split('').slice(0, length);
      while (otpArr.length < length) otpArr.push('');
      setOtp(otpArr);
    }
  }, [value, length]);

  const handleChange = (element, index) => {
    const val = element.value.replace(/[^0-9]/g, '');
    if (!val) return;

    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);
    onChange(newOtp.join(''));

    // Move to next input
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      if (newOtp[index]) {
        newOtp[index] = '';
        setOtp(newOtp);
        onChange(newOtp.join(''));
      } else if (index > 0) {
        newOtp[index - 1] = '';
        setOtp(newOtp);
        onChange(newOtp.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length);
    if (pasted) {
      const newOtp = pasted.split('');
      while (newOtp.length < length) newOtp.push('');
      setOtp(newOtp);
      onChange(newOtp.join(''));
      const focusIdx = Math.min(pasted.length, length - 1);
      inputRefs.current[focusIdx]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2">
      {otp.map((digit, index) => (
        <motion.input
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e.target, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          whileFocus={{ scale: 1.1, borderColor: '#00f2ff' }}
          className={`w-12 h-14 text-center text-xl font-bold bg-white/5 border rounded-lg 
            text-primary focus:ring-2 focus:ring-primary focus:border-primary outline-none 
            transition-all duration-200 disabled:opacity-50
            ${digit ? 'border-primary/40 shadow-[0_0_10px_rgba(0,242,255,0.15)]' : 'border-primary/20'}
          `}
        />
      ))}
    </div>
  );
};

export default OTPInput;
