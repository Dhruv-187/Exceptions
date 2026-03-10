import { motion } from 'framer-motion';

const SocialButtons = () => {
  return (
    <div className="space-y-4">
      <div className="relative py-4 flex items-center">
        <div className="flex-grow border-t border-slate-700/50" />
        <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase tracking-widest">
          Or continue with
        </span>
        <div className="flex-grow border-t border-slate-700/50" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Google */}
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          className="btn-secondary py-3 rounded-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M12 5.04c1.74 0 3.12.66 3.91 1.41l2.91-2.91C17.06 1.95 14.76 1 12 1 7.35 1 3.41 3.65 1.5 7.5l3.41 2.64C5.75 7.31 8.61 5.04 12 5.04z" fill="#EA4335" />
            <path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.48-1.13 2.74-2.4 3.58l3.71 2.88c2.16-1.99 3.41-4.92 3.41-8.7z" fill="#4285F4" />
            <path d="M5.91 14.86c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31L2.5 7.6C1.56 9.41 1 11.41 1 13.5s.56 4.09 1.5 5.9l3.41-2.54z" fill="#FBBC05" />
            <path d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.71-2.88c-1.07.72-2.44 1.15-4.25 1.15-3.39 0-6.25-2.27-7.27-5.32L1.23 15.6C3.14 19.35 7.08 22 12 23z" fill="#34A853" />
          </svg>
        </motion.button>

        {/* GitHub */}
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          className="btn-secondary py-3 rounded-lg"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </motion.button>

        {/* Microsoft */}
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          className="btn-secondary py-3 rounded-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <rect x="1" y="1" width="10" height="10" fill="#F25022" />
            <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
            <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
            <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
};

export default SocialButtons;
