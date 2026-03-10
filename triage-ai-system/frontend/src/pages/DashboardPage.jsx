import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { label: 'System Status', value: 'Online', icon: 'check_circle', color: '#22c55e' },
    { label: 'Security Level', value: 'Maximum', icon: 'shield', color: '#00f2ff' },
    { label: 'Encryption', value: 'AES-256', icon: 'lock', color: '#8b5cf6' },
    { label: 'Uptime', value: '99.97%', icon: 'trending_up', color: '#f59e0b' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <main className="flex-1 p-6 lg:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold mb-2">
                Welcome back, <span className="text-primary">{user?.name}</span>
              </h1>
              <p className="text-slate-400">Your PulsePriority dashboard is active and secured.</p>
            </div>
            <div className="glass-card rounded-xl px-6 py-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">System Time</p>
              <p className="text-primary font-mono text-lg font-bold">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </p>
              <p className="text-slate-500 text-xs">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.03, y: -5 }}
              className="glass-card rounded-xl p-6 group cursor-pointer transition-all hover:border-primary/30"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}
                >
                  <span className="material-symbols-outlined" style={{ color: stat.color }}>
                    {stat.icon}
                  </span>
                </div>
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: stat.color }}
                />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* User Info & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card rounded-xl p-6 lg:col-span-1"
          >
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">User Profile</h3>
            <div className="flex flex-col items-center text-center mb-6">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mb-4"
              >
                <span className="text-3xl font-bold text-primary">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </motion.div>
              <h4 className="text-lg font-bold text-white">{user?.name}</h4>
              <p className="text-slate-400 text-sm">{user?.email}</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-primary/5">
                <span className="text-slate-500">Status</span>
                <span className="text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Verified
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-primary/5">
                <span className="text-slate-500">Role</span>
                <span className="text-slate-300">User</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Member Since</span>
                <span className="text-slate-300">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : 'Today'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Activity Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card rounded-xl p-6 lg:col-span-2"
          >
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">System Console</h3>
            <div className="bg-black/30 rounded-lg p-4 font-mono text-xs space-y-2 min-h-[250px]">
              {[
                { time: '00:00:01', msg: 'System boot sequence initiated...', color: 'text-slate-500' },
                { time: '00:00:02', msg: 'Loading PulsePriority kernel modules...', color: 'text-slate-500' },
                { time: '00:00:03', msg: '[OK] Authentication service online', color: 'text-green-400' },
                { time: '00:00:04', msg: '[OK] Database connection established', color: 'text-green-400' },
                { time: '00:00:05', msg: '[OK] Encryption protocols active (AES-256)', color: 'text-green-400' },
                { time: '00:00:06', msg: `[OK] User ${user?.email} authenticated`, color: 'text-primary' },
                { time: '00:00:07', msg: '[OK] Dashboard modules loaded', color: 'text-green-400' },
                { time: '00:00:08', msg: 'All systems operational. Welcome to PulsePriority.', color: 'text-primary' },
              ].map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.15 }}
                  className="flex gap-3"
                >
                  <span className="text-slate-600">[{line.time}]</span>
                  <span className={line.color}>{line.msg}</span>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 2.5 }}
                className="text-primary mt-2"
              >
                █
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Decorative side element */}
        <div className="hidden lg:block fixed bottom-12 right-12 opacity-40 z-0">
          <div className="flex flex-col gap-4">
            <div className="h-32 w-1 bg-gradient-to-b from-primary to-transparent rounded-full ml-auto" />
            <div className="text-primary font-mono text-xs tracking-tighter text-right">
              SYS_STATUS: OPTIMAL<br />
              SEC_LEVEL: MAXIMUM<br />
              ENCRYPTION: AES-256
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;
