import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const LandingPage = () => {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl border border-primary/30 mb-6"
          >
            <span className="material-symbols-outlined text-primary text-4xl">emergency</span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            Pulse<span className="text-primary">Priority</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md mx-auto">
            AI-Powered Emergency Triage System for faster, smarter patient care
          </p>
        </motion.div>

        {/* Login Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Login Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Link to="/login" className="block">
              <div className="glass-card rounded-2xl p-8 h-full hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,242,255,0.15)] group">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/30 mb-5 group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-primary text-3xl">person</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Patient Portal</h2>
                  <p className="text-slate-400 text-sm mb-6">
                    Submit symptoms and vitals for AI-powered triage assessment
                  </p>
                  <div className="w-full py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold tracking-wide group-hover:bg-primary group-hover:text-black transition-all duration-300 flex items-center justify-center gap-2">
                    <span>Enter as Patient</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Admin/Doctor Login Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Link to="/admin/login" className="block">
              <div className="glass-card rounded-2xl p-8 h-full hover:border-amber-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] group">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30 mb-5 group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-amber-500 text-3xl">stethoscope</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Doctor Portal</h2>
                  <p className="text-slate-400 text-sm mb-6">
                    Access patient queue, analytics, and override triage decisions
                  </p>
                  <div className="w-full py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold tracking-wide group-hover:bg-amber-500 group-hover:text-black transition-all duration-300 flex items-center justify-center gap-2">
                    <span>Enter as Doctor</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-green-400">verified</span>
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary">psychology</span>
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-amber-400">speed</span>
              <span>Real-time Triage</span>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default LandingPage;
