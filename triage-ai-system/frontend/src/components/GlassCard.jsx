import { motion } from 'framer-motion';

const GlassCard = ({ children, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-card rounded-xl p-8 lg:p-10 shadow-2xl relative overflow-hidden ${className}`}
    >
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-primary/20 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-primary/20 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-primary/20 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-primary/20 rounded-br-xl" />
      
      {children}
    </motion.div>
  );
};

export default GlassCard;
