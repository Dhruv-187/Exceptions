import { useCallback, useEffect, useState } from 'react';

const ParticleBackground = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const generated = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.3 + 0.05,
    }));
    setParticles(generated);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(0,242,255,0.08)_0%,_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,242,255,0.04)_0%,_transparent_40%)]" />
      
      {/* Animated gradient orbs */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse"
        style={{ background: 'rgba(0, 242, 255, 0.06)' }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse"
        style={{ background: 'rgba(0, 242, 255, 0.04)', animationDelay: '3s' }}
      />
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full blur-[100px]"
        style={{ background: 'rgba(0, 242, 255, 0.03)' }}
      />

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: '#00f2ff',
            opacity: p.opacity,
            animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 242, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 242, 255, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <style>{`
        @keyframes floatParticle {
          0%, 100% { 
            transform: translate(0, 0) scale(1); 
            opacity: ${0.1};
          }
          25% { 
            transform: translate(${Math.random() * 40 - 20}px, ${Math.random() * -60 - 20}px) scale(1.5); 
            opacity: ${0.3};
          }
          50% { 
            transform: translate(${Math.random() * 60 - 30}px, ${Math.random() * -40 - 10}px) scale(0.8); 
            opacity: ${0.15};
          }
          75% { 
            transform: translate(${Math.random() * 30 - 15}px, ${Math.random() * -80 - 10}px) scale(1.2); 
            opacity: ${0.25};
          }
        }
      `}</style>
    </div>
  );
};

export default ParticleBackground;
