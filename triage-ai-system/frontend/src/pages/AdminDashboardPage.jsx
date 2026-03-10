import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const AdminDashboardPage = () => {
  const { user } = useAuth();

  return (
    <main className="flex-1 p-6 lg:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Admin Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/30">
              <span className="material-symbols-outlined text-amber-500 text-2xl">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold">
                Admin <span className="text-amber-400">Dashboard</span>
              </h1>
              <p className="text-slate-400">Welcome, {user?.name}</p>
            </div>
          </div>
        </motion.div>

        {/* Placeholder Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {[
            { title: 'Total Users', icon: 'group', value: '—', color: '#00f2ff' },
            { title: 'Active Sessions', icon: 'sensors', value: '—', color: '#22c55e' },
            { title: 'System Health', icon: 'monitor_heart', value: '—', color: '#8b5cf6' },
          ].map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className="glass-card rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${card.color}15`, border: `1px solid ${card.color}30` }}
                >
                  <span className="material-symbols-outlined" style={{ color: card.color }}>
                    {card.icon}
                  </span>
                </div>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{card.title}</p>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Placeholder Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-8"
        >
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30 mx-auto mb-6">
              <span className="material-symbols-outlined text-amber-500 text-4xl">construction</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Admin Panel Under Construction</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              This admin dashboard is a placeholder. Additional admin features and management tools will be added here.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {['User Management', 'Analytics', 'Settings', 'Logs'].map((feature, i) => (
                <span
                  key={i}
                  className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 text-sm"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default AdminDashboardPage;
