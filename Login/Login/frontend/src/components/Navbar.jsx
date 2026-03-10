import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between px-6 py-6 lg:px-12 relative z-50"
    >
      <Link to="/" className="flex items-center gap-3 group">
        <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 group-hover:border-primary/40 transition-colors">
          <svg className="text-primary w-6 h-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-xl font-black tracking-tight uppercase">
          Pulse<span className="text-primary">Priority</span>
        </h2>
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-sm text-slate-400 hidden sm:block">
              Welcome, <span className={user.role === 'admin' ? 'text-amber-400 font-medium' : 'text-primary font-medium'}>{user.name}</span>
              {user.role === 'admin' && <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">Admin</span>}
            </span>
            <button
              onClick={logout}
              className={`${user.role === 'admin' ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30'} border px-5 py-2 rounded-lg text-sm font-bold transition-all`}
            >
              Logout
            </button>
          </>
        ) : (
          <div className="flex gap-3">
            {location.pathname !== '/login' && location.pathname !== '/admin/login' && (
              <Link
                to="/login"
                className="text-slate-400 hover:text-primary text-sm font-medium transition-colors px-4 py-2"
              >
                Login
              </Link>
            )}
            {location.pathname !== '/admin/login' && (
              <Link
                to="/admin/login"
                className="text-slate-400 hover:text-amber-400 text-sm font-medium transition-colors px-4 py-2"
              >
                Admin
              </Link>
            )}
            {location.pathname !== '/register' && (
              <Link
                to="/register"
                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-5 py-2 rounded-lg text-sm font-bold transition-all"
              >
                Sign Up
              </Link>
            )}
          </div>
        )}
      </div>
    </motion.header>
  );
};

export default Navbar;
