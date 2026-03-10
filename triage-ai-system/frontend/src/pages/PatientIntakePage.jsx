import { useState, useEffect } from 'react';
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

// Common symptoms for quick selection
const COMMON_SYMPTOMS = [
  'Chest pain', 'Shortness of breath', 'Headache', 'Dizziness', 'Nausea', 'Vomiting',
  'Fatigue', 'Fever', 'Cough', 'Abdominal pain', 'Back pain', 'Joint pain',
  'Numbness', 'Weakness', 'Confusion', 'Palpitations', 'Sweating', 'Anxiety',
  'Blurred vision', 'Difficulty speaking', 'Loss of consciousness', 'Seizure',
  'Swelling', 'Rash', 'Bleeding', 'Difficulty breathing', 'Wheezing', 'Sore throat'
];

// Common medical history conditions
const COMMON_CONDITIONS = [
  'Hypertension', 'Diabetes', 'Heart Disease', 'Asthma', 'COPD', 'Stroke',
  'Cancer', 'Kidney Disease', 'Liver Disease', 'Thyroid Disorder', 'Arthritis',
  'Depression', 'Anxiety Disorder', 'Epilepsy', 'HIV/AIDS', 'Obesity'
];

// Preset symptom combinations for common emergencies
const SYMPTOM_PRESETS = [
  {
    name: 'Heart Attack',
    color: 'red',
    symptoms: ['Crushing chest pain', 'Pain radiating to left arm', 'Shortness of breath', 'Profuse sweating', 'Nausea', 'Anxiety']
  },
  {
    name: 'Stroke',
    color: 'purple',
    symptoms: ['Sudden severe headache', 'Facial drooping', 'Arm weakness', 'Difficulty speaking', 'Confusion', 'Vision problems']
  },
  {
    name: 'Asthma Attack',
    color: 'blue',
    symptoms: ['Severe shortness of breath', 'Wheezing', 'Chest tightness', 'Rapid breathing', 'Difficulty speaking', 'Cyanosis']
  },
  {
    name: 'Allergic Reaction',
    color: 'orange',
    symptoms: ['Swelling of face/throat', 'Difficulty breathing', 'Hives/rash', 'Itching', 'Nausea', 'Dizziness']
  },
  {
    name: 'Diabetic Emergency',
    color: 'yellow',
    symptoms: ['Confusion', 'Excessive thirst', 'Frequent urination', 'Fruity breath odor', 'Weakness', 'Nausea']
  },
  {
    name: 'Respiratory Infection',
    color: 'cyan',
    symptoms: ['Fever', 'Cough', 'Sore throat', 'Body aches', 'Fatigue', 'Congestion']
  }
];

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
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  
  // Patient profiles state
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Critical Emergency state
  const [showCriticalModal, setShowCriticalModal] = useState(false);
  const [criticalName, setCriticalName] = useState('');
  const [criticalDescription, setCriticalDescription] = useState('');
  const [isSubmittingCritical, setIsSubmittingCritical] = useState(false);
  const [criticalResult, setCriticalResult] = useState(null);

  // Handle critical emergency submission
  const handleCriticalEmergency = async () => {
    if (!criticalName.trim()) {
      toast.error('Please enter patient name');
      return;
    }
    
    setIsSubmittingCritical(true);
    try {
      const res = await triageAPI.submitCriticalEmergency({
        name: criticalName.trim(),
        brief_description: criticalDescription.trim() || undefined
      });
      
      setCriticalResult(res.data);
      
      let message = `🚨 CRITICAL: ${criticalName} registered as emergency patient!`;
      if (res.data.auto_assigned_doctor) {
        message += `\n\nDoctor Assigned: ${res.data.auto_assigned_doctor}`;
        if (res.data.unassigned_from) {
          message += ` (Reassigned from ${res.data.unassigned_from})`;
        }
      } else if (res.data.warning) {
        toast.error(res.data.warning, { duration: 5000 });
      }
      
      toast.success(message, { duration: 6000 });
      
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to register critical emergency');
    } finally {
      setIsSubmittingCritical(false);
    }
  };

  // Reset critical modal
  const resetCriticalModal = () => {
    setShowCriticalModal(false);
    setCriticalName('');
    setCriticalDescription('');
    setCriticalResult(null);
  };

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async (search = '') => {
    try {
      const res = await triageAPI.getProfiles(search);
      setProfiles(res.data.profiles || []);
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    }
  };

  // Search profiles with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProfiles(profileSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [profileSearch]);

  // Select a profile and populate form
  const selectProfile = (profile) => {
    setSelectedProfile(profile);
    setFormData({
      name: profile.name || '',
      age: profile.age?.toString() || '',
      gender: profile.gender || 'Male',
      symptoms_text: '',
      heart_rate: '',
      blood_pressure: '',
      temperature: '',
      spo2: '',
      respiratory_rate: '',
      medical_history: profile.medical_history?.join(', ') || ''
    });
    setSelectedConditions(profile.medical_history || []);
    setSelectedSymptoms([]);
    setShowProfilePanel(false);
    toast.success(`Loaded profile: ${profile.name}`);
  };

  // Clear form for new patient
  const startNewPatient = () => {
    setSelectedProfile(null);
    setFormData({
      name: '', age: '', gender: 'Male', symptoms_text: '',
      heart_rate: '', blood_pressure: '', temperature: '',
      spo2: '', respiratory_rate: '', medical_history: ''
    });
    setSelectedSymptoms([]);
    setSelectedConditions([]);
    setResult(null);
    setShowProfilePanel(false);
  };

  // Save current patient as profile
  const saveAsProfile = async () => {
    if (!formData.name || !formData.age) {
      toast.error('Name and age required to save profile');
      return;
    }
    setIsSavingProfile(true);
    try {
      const profileData = {
        name: formData.name,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        medical_history: selectedConditions.length > 0 
          ? selectedConditions 
          : formData.medical_history.split(',').map(m => m.trim()).filter(Boolean),
        notes: ''
      };
      
      if (selectedProfile) {
        // Update existing profile
        await triageAPI.updateProfile(selectedProfile.profile_id, profileData);
        toast.success('Profile updated!');
      } else {
        // Create new profile
        await triageAPI.createProfile(profileData);
        toast.success('Profile saved!');
      }
      fetchProfiles();
    } catch (err) {
      toast.error('Failed to save profile');
      console.error(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Delete a profile
  const deleteProfile = async (profileId, profileName, e) => {
    e.stopPropagation(); // Prevent selecting the profile
    if (!confirm(`Delete profile for "${profileName}"? This cannot be undone.`)) return;
    
    try {
      await triageAPI.deleteProfile(profileId);
      toast.success(`Profile deleted: ${profileName}`);
      if (selectedProfile?.profile_id === profileId) {
        setSelectedProfile(null);
      }
      fetchProfiles();
    } catch (err) {
      toast.error('Failed to delete profile');
      console.error(err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Toggle a symptom selection
  const toggleSymptom = (symptom) => {
    setSelectedSymptoms(prev => {
      const newSymptoms = prev.includes(symptom) 
        ? prev.filter(s => s !== symptom) 
        : [...prev, symptom];
      // Update the symptoms_text field
      setFormData(fd => ({ ...fd, symptoms_text: newSymptoms.join(', ') }));
      return newSymptoms;
    });
  };

  // Apply a preset (replaces current symptoms)
  const applyPreset = (preset) => {
    setSelectedSymptoms(preset.symptoms);
    setFormData(fd => ({ ...fd, symptoms_text: preset.symptoms.join(', ') }));
  };

  // Toggle a medical condition
  const toggleCondition = (condition) => {
    setSelectedConditions(prev => {
      const newConditions = prev.includes(condition)
        ? prev.filter(c => c !== condition)
        : [...prev, condition];
      // Update the medical_history field
      setFormData(fd => ({ ...fd, medical_history: newConditions.join(', ') }));
      return newConditions;
    });
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
      
      // Record visit if using saved profile
      if (selectedProfile) {
        try {
          await triageAPI.recordProfileVisit(selectedProfile.profile_id);
        } catch (err) {
          console.error('Failed to record profile visit:', err);
        }
      }
      
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
          <div className="flex gap-3">
            {/* Critical Emergency Button */}
            <button
              onClick={() => setShowCriticalModal(true)}
              className="flex items-center gap-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 border-2 border-red-500 hover:border-red-400 px-5 py-3 rounded-xl text-sm font-black tracking-wide transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse hover:animate-none"
            >
              🚨 CRITICAL EMERGENCY
            </button>
            <Link
              to="/admin/login"
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 px-5 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              Admin Dashboard
            </Link>
          </div>
        </motion.header>

        {/* Critical Emergency Modal */}
        <AnimatePresence>
          {showCriticalModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && !criticalResult && resetCriticalModal()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-lg bg-gradient-to-b from-red-950/90 to-slate-950 border-2 border-red-500 rounded-2xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.4)]"
              >
                {!criticalResult ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="text-6xl mb-3 animate-bounce">🚨</div>
                      <h2 className="text-2xl font-black text-red-400 uppercase tracking-widest">Critical Emergency</h2>
                      <p className="text-slate-400 text-sm mt-2">Quick registration - Patient will be marked as highest priority</p>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Patient Name - Required */}
                      <div>
                        <label className="text-[10px] text-red-400 uppercase tracking-[0.2em] font-bold block mb-2">
                          Patient Name <span className="text-white">*</span>
                        </label>
                        <input
                          type="text"
                          value={criticalName}
                          onChange={(e) => setCriticalName(e.target.value)}
                          placeholder="Enter patient name"
                          className="w-full bg-black/50 border-2 border-red-500/50 focus:border-red-500 rounded-xl px-4 py-4 text-white text-lg placeholder:text-slate-600 focus:outline-none transition-all"
                          autoFocus
                        />
                      </div>
                      
                      {/* Brief Description - Optional */}
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold block mb-2">
                          Brief Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={criticalDescription}
                          onChange={(e) => setCriticalDescription(e.target.value)}
                          placeholder="e.g., Unconscious, Chest pain, Accident..."
                          className="w-full bg-black/50 border border-red-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-red-500/60 transition-all"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={resetCriticalModal}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCriticalEmergency}
                        disabled={isSubmittingCritical || !criticalName.trim()}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                      >
                        {isSubmittingCritical ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                            Registering...
                          </span>
                        ) : (
                          '🚨 REGISTER CRITICAL'
                        )}
                      </button>
                    </div>
                    
                    <p className="text-slate-500 text-[10px] text-center mt-4 uppercase tracking-wider">
                      Patient will be auto-assigned to available doctor and moved to top of queue
                    </p>
                  </>
                ) : (
                  /* Success State */
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="text-6xl mb-4"
                    >
                      ✅
                    </motion.div>
                    <h2 className="text-2xl font-black text-green-400 uppercase tracking-widest mb-2">Critical Patient Registered</h2>
                    <p className="text-white text-xl font-bold mb-4">{criticalResult.name}</p>
                    
                    <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-4 mb-4 text-left space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">Patient ID:</span>
                        <span className="text-white font-mono font-bold">#{criticalResult.patient_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">Triage Level:</span>
                        <span className="text-red-400 font-bold uppercase">{criticalResult.triage_level}</span>
                      </div>
                      {criticalResult.auto_assigned_doctor && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Assigned Doctor:</span>
                          <span className="text-purple-400 font-bold">{criticalResult.auto_assigned_doctor}</span>
                        </div>
                      )}
                      {criticalResult.doctor_specialty && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Specialty:</span>
                          <span className="text-slate-300">{criticalResult.doctor_specialty}</span>
                        </div>
                      )}
                      {criticalResult.unassigned_from && (
                        <div className="mt-2 pt-2 border-t border-red-500/20">
                          <p className="text-amber-400 text-xs">
                            ⚠️ Doctor reassigned from: {criticalResult.unassigned_from}
                          </p>
                        </div>
                      )}
                      {criticalResult.warning && (
                        <div className="mt-2 pt-2 border-t border-red-500/20">
                          <p className="text-amber-400 text-xs">
                            ⚠️ {criticalResult.warning}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-green-400 text-sm font-medium mb-4">
                      Patient is now at the TOP of the queue with highest priority!
                    </p>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={resetCriticalModal}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => { resetCriticalModal(); setShowCriticalModal(true); }}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                      >
                        + Another Emergency
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Patient Profile Selection Panel */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass-card rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-primary text-xs font-black uppercase tracking-[0.25em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> 
              Patient Profile
              {selectedProfile && (
                <span className="text-green-400 text-[10px] normal-case tracking-normal ml-2">
                  (Using: {selectedProfile.name})
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowProfilePanel(!showProfilePanel)}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                {showProfilePanel ? 'Hide' : 'Select Patient'}
              </button>
              <button
                type="button"
                onClick={startNewPatient}
                className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                + New Patient
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {showProfilePanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {/* Search Box */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={profileSearch}
                    onChange={(e) => setProfileSearch(e.target.value)}
                    placeholder="Search saved patients..."
                    className="w-full bg-black/50 border border-primary/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-all"
                  />
                </div>
                
                {/* Profile List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {profiles.length === 0 ? (
                    <div className="col-span-full text-center py-4 text-slate-500 text-sm">
                      {profileSearch ? 'No matching profiles found' : 'No saved profiles yet'}
                    </div>
                  ) : (
                    profiles.map((profile) => (
                      <div
                        key={profile.profile_id}
                        className={`p-3 rounded-xl text-left transition-all border relative group cursor-pointer ${
                          selectedProfile?.profile_id === profile.profile_id
                            ? 'bg-primary/20 border-primary/50 shadow-[0_0_10px_rgba(0,242,255,0.15)]'
                            : 'bg-black/30 border-white/10 hover:border-primary/30 hover:bg-black/50'
                        }`}
                        onClick={() => selectProfile(profile)}
                      >
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => deleteProfile(profile.profile_id, profile.name, e)}
                          className="absolute top-1 right-1 w-5 h-5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="Delete profile"
                        >
                          ×
                        </button>
                        
                        <div className="flex items-start justify-between pr-4">
                          <div>
                            <p className="text-white font-bold text-sm">{profile.name}</p>
                            <p className="text-slate-500 text-xs">
                              {profile.age}yo • {profile.gender}
                            </p>
                          </div>
                          {profile.visit_count > 0 && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                              {profile.visit_count} visits
                            </span>
                          )}
                        </div>
                        {profile.medical_history?.length > 0 && (
                          <p className="text-slate-600 text-[10px] mt-1 truncate">
                            {profile.medical_history.slice(0, 3).join(', ')}
                            {profile.medical_history.length > 3 && '...'}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

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
                </div>
              </div>

              {/* Medical History - Enhanced with clickable chips */}
              <div>
                <h3 className="text-primary text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> Medical History
                </h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] mb-3">Tap conditions to select (or type custom)</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COMMON_CONDITIONS.map((condition) => (
                    <button
                      key={condition}
                      type="button"
                      onClick={() => toggleCondition(condition)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        selectedConditions.includes(condition)
                          ? 'bg-primary/30 text-primary border border-primary/50 shadow-[0_0_10px_rgba(0,242,255,0.2)]'
                          : 'bg-black/30 text-slate-400 border border-white/10 hover:border-primary/30 hover:text-primary/80'
                      }`}
                    >
                      {selectedConditions.includes(condition) && <span className="mr-1">✓</span>}
                      {condition}
                    </button>
                  ))}
                </div>
                <InputField label="Additional conditions (comma-separated)" name="medical_history" value={formData.medical_history} onChange={handleChange} type="text" placeholder="Or type additional conditions..." />
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

              {/* Symptoms - Enhanced with clickable chips and presets */}
              <div>
                <h3 className="text-primary text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> Chief Complaint
                </h3>
                
                {/* Quick Presets */}
                <div className="mb-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] mb-2">Quick Presets (tap to apply)</p>
                  <div className="flex flex-wrap gap-2">
                    {SYMPTOM_PRESETS.map((preset) => {
                      const colorMap = {
                        red: 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30',
                        purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400 hover:bg-purple-500/30',
                        blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400 hover:bg-blue-500/30',
                        orange: 'bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30',
                        yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30',
                        cyan: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30',
                      };
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all duration-200 ${colorMap[preset.color]}`}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Common Symptoms Chips */}
                <div className="mb-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] mb-2">Tap symptoms to add</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-black/20 rounded-xl border border-white/5">
                    {COMMON_SYMPTOMS.map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => toggleSymptom(symptom)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                          selectedSymptoms.includes(symptom)
                            ? 'bg-primary/30 text-primary border border-primary/50'
                            : 'bg-black/40 text-slate-400 border border-white/10 hover:border-primary/30 hover:text-slate-300'
                        }`}
                      >
                        {selectedSymptoms.includes(symptom) && <span className="mr-1">✓</span>}
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected count */}
                {selectedSymptoms.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-primary uppercase tracking-widest">{selectedSymptoms.length} symptom(s) selected</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedSymptoms([]); setFormData(fd => ({ ...fd, symptoms_text: '' })); }}
                      className="text-[10px] text-red-400 hover:text-red-300 uppercase tracking-widest"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold block mb-2">Detailed symptoms <span className="text-primary">*</span></label>
                <textarea required name="symptoms_text" value={formData.symptoms_text} onChange={handleChange} rows="3" className="w-full bg-black/50 border border-primary/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_10px_rgba(0,242,255,0.1)] transition-all duration-300 resize-none" placeholder="Selected symptoms appear here, or type custom symptoms..."></textarea>
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

                  {/* Save as Profile Button */}
                  {!selectedProfile && (
                    <button
                      type="button"
                      onClick={saveAsProfile}
                      disabled={isSavingProfile}
                      className="w-full py-3 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-3 h-3 border-2 border-green-500/50 border-t-green-500 rounded-full animate-spin"></span>
                          Saving...
                        </span>
                      ) : (
                        '💾 Save as Returning Patient Profile'
                      )}
                    </button>
                  )}
                  
                  {selectedProfile && (
                    <div className="w-full py-3 rounded-xl border border-primary/20 bg-primary/5 text-center">
                      <p className="text-primary text-xs font-medium">
                        ✓ Using saved profile: <span className="font-bold">{selectedProfile.name}</span>
                      </p>
                      <button
                        type="button"
                        onClick={saveAsProfile}
                        disabled={isSavingProfile}
                        className="text-[10px] text-slate-500 hover:text-primary mt-1 uppercase tracking-wider transition-colors"
                      >
                        {isSavingProfile ? 'Updating...' : 'Update profile with current info'}
                      </button>
                    </div>
                  )}

                  {/* New Patient Button */}
                  <button
                    onClick={() => {
                      setResult(null);
                      setSelectedSymptoms([]);
                      setSelectedConditions([]);
                      setSelectedProfile(null);
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
