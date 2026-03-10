import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { triageAPI } from '../services/api';

const TRIAGE_COLORS = {
  Critical: { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', glow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]' },
  Urgent: { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', glow: 'shadow-[0_0_30px_rgba(249,115,22,0.3)]' },
  Moderate: { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.3)]' },
  'Non Urgent': { text: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30', glow: 'shadow-[0_0_30px_rgba(74,222,128,0.3)]' },
};

const InputField = ({ label, required, ...props }) => (
  <div>
    <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold block mb-2">{label} {required && <span className="text-primary">*</span>}</label>
    <input {...props} className="w-full bg-black/50 border border-primary/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_10px_rgba(0,242,255,0.1)] transition-all duration-300" />
  </div>
);

const PatientIntakePage = () => {
  const [formData, setFormData] = useState({
    name: '', age: '', gender: 'Male', symptoms_text: '',
    heart_rate: '', blood_pressure: '', temperature: '',
    spo2: '', respiratory_rate: '', medical_history: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.symptoms_text) {
      toast.error("Please fill in required fields: Name, Age, and Symptoms");
      return;
    }
    
    setIsSubmitting(true);
    setResult(null);
    try {
      const payload = {
        name: formData.name,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        symptoms_text: formData.symptoms_text,
        heart_rate: formData.heart_rate ? parseFloat(formData.heart_rate) : null,
        blood_pressure: formData.blood_pressure || null,
        temperature: formData.temperature ? parseFloat(formData.temperature) : null,
        spo2: formData.spo2 ? parseFloat(formData.spo2) : null,
        respiratory_rate: formData.respiratory_rate ? parseFloat(formData.respiratory_rate) : null,
        medical_history: formData.medical_history ? formData.medical_history.split(',').map(m => m.trim()).filter(Boolean) : []
      };
      
      const res = await triageAPI.submitIntake(payload);
      const patientId = res.data.patient_id;
      
      const triageRes = await triageAPI.runTriage(patientId);
      setResult(triageRes.data);
      toast.success("Patient triaged successfully!");
      
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(`Validation error: ${detail.map(d => d.msg).join(', ')}`);
      } else {
        toast.error(typeof detail === 'string' ? detail : "Error during triage. Check backend logs.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const colors = result ? (TRIAGE_COLORS[result.triage_level] || TRIAGE_COLORS['Non Urgent']) : null;

  return (
    <main className="flex-1 p-4 lg:p-8 relative z-10 w-full flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-5xl space-y-6">
        
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Emergency Patient Intake</h1>
            <p className="text-slate-500 mt-1 text-sm tracking-wide">Enter patient vitals and symptoms for AI-powered triage assessment</p>
          </div>
          <Link
            to="/admin/login"
            className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 px-5 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            Admin Dashboard
          </Link>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* FORM — left side */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5">
              
              {/* Demographics */}
              <div>
                <h3 className="text-primary text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> Demographics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <InputField label="Full Name" required name="name" value={formData.name} onChange={handleChange} type="text" placeholder="Maria Santos" />
                  </div>
                  <InputField label="Age" required name="age" value={formData.age} onChange={handleChange} type="number" placeholder="62" />
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold block mb-2">Gender <span className="text-primary">*</span></label>
                    <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-black/50 border border-primary/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/60 transition-all duration-300">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <InputField label="Medical History" name="medical_history" value={formData.medical_history} onChange={handleChange} type="text" placeholder="Hypertension, Diabetes" />
                </div>
              </div>

              {/* Vital Signs */}
              <div>
                <h3 className="text-primary text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span> Vital Signs
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InputField label="Heart Rate (bpm)" name="heart_rate" value={formData.heart_rate} onChange={handleChange} type="number" placeholder="80" />
                  <InputField label="BP (Sys/Dia)" name="blood_pressure" value={formData.blood_pressure} onChange={handleChange} type="text" placeholder="120/80" />
                  <InputField label="Temperature (°C)" name="temperature" value={formData.temperature} onChange={handleChange} type="number" step="0.1" placeholder="37.0" />
                  <InputField label="SpO2 (%)" name="spo2" value={formData.spo2} onChange={handleChange} type="number" placeholder="98" />
                  <InputField label="Resp Rate (/min)" name="respiratory_rate" value={formData.respiratory_rate} onChange={handleChange} type="number" placeholder="16" />
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <h3 className="text-primary text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> Chief Complaint
                </h3>
                <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold block mb-2">Detailed symptoms <span className="text-primary">*</span></label>
                <textarea required name="symptoms_text" value={formData.symptoms_text} onChange={handleChange} rows="3" className="w-full bg-black/50 border border-primary/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_10px_rgba(0,242,255,0.1)] transition-all duration-300 resize-none" placeholder="Severe crushing chest pain radiating to left arm, shortness of breath, profuse sweating..."></textarea>
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] text-sm transition-all duration-300 ${
                  isSubmitting ? 'bg-primary/30 text-primary/50 cursor-not-allowed' : 'bg-gradient-to-r from-primary to-cyan-400 text-black hover:shadow-[0_0_30px_rgba(0,242,255,0.4)]'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="w-4 h-4 border-2 border-primary/50 border-t-primary rounded-full animate-spin"></span>
                    Running AI Triage Assessment...
                  </span>
                ) : 'Submit Patient for Triage'}
              </motion.button>
            </form>
          </motion.div>

          {/* RESULTS — right side */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`glass-card rounded-2xl p-6 space-y-5 border ${colors.border} ${colors.glow}`}
                >
                  {/* Triage Level Badge */}
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mb-2">AI Triage Classification</p>
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                      className={`inline-block ${colors.bg} ${colors.border} border rounded-2xl px-8 py-4`}
                    >
                      <p className={`text-4xl font-black tracking-tight ${colors.text}`}>{result.triage_level}</p>
                    </motion.div>
                  </div>

                  {/* Confidence Meter */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Model Confidence</span>
                      <span className="text-white font-mono font-bold text-lg">{result.confidence}%</span>
                    </div>
                    <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.confidence}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className={`h-full rounded-full bg-gradient-to-r from-primary to-cyan-400`}
                      />
                    </div>
                  </div>

                  {/* Clinical Reasoning */}
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-2">LLM Clinical Reasoning</p>
                    <p className="text-sm text-slate-300 bg-black/40 rounded-xl p-4 border border-white/5 leading-relaxed italic">
                      "{result.explanation}"
                    </p>
                  </div>

                  {/* SHAP Explanations */}
                  {result.explanations_shap?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-3">Top Risk Factors (SHAP)</p>
                      <div className="space-y-2">
                        {result.explanations_shap.map((exp, idx) => {
                          const maxImpact = Math.max(...result.explanations_shap.map(e => Math.abs(e.impact)));
                          const pct = (Math.abs(exp.impact) / maxImpact) * 100;
                          return (
                            <motion.div key={idx} initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} transition={{delay: 0.5 + idx*0.1}}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400 capitalize font-medium">{exp.feature.replace(/_/g, ' ')}</span>
                                <span className="text-white font-mono font-bold">{exp.impact.toFixed(3)}</span>
                              </div>
                              <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                                <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.8, delay:0.6+idx*0.1}} className="h-full rounded-full bg-gradient-to-r from-primary/80 to-cyan-400/80" />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* New Patient Button */}
                  <button
                    onClick={() => {
                      setResult(null);
                      setFormData({ name: '', age: '', gender: 'Male', symptoms_text: '', heart_rate: '', blood_pressure: '', temperature: '', spo2: '', respiratory_rate: '', medical_history: '' });
                    }}
                    className="w-full py-3 rounded-xl border border-primary/30 text-primary text-xs font-bold uppercase tracking-[0.2em] hover:bg-primary/10 transition-all duration-300"
                  >
                    Register New Patient
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] border border-dashed border-primary/10"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="text-slate-600 text-xs uppercase tracking-[0.2em] font-bold text-center">AI classification will<br/>appear here after submission</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
};

export default PatientIntakePage;
