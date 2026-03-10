import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triageAPI } from '../services/api';
import { toast } from 'react-hot-toast';

const AdminDashboardPage = () => {
  const [queue, setQueue] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [newTriage, setNewTriage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "WAITING", "ASSIGNED", "IN_TREATMENT", "COMPLETED"
  const [doctorName, setDoctorName] = useState("");

  const STATUS_COLORS = {
    "WAITING": { text: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" },
    "ASSIGNED": { text: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
    "IN_TREATMENT": { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
    "COMPLETED": { text: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
  };

  const fetchData = async () => {
    try {
      const includeCompleted = statusFilter === "COMPLETED" || statusFilter === "all";
      const qRes = await triageAPI.getPatients(includeCompleted);
      setQueue(qRes.data);
      const aRes = await triageAPI.getAnalytics();
      setAnalytics(aRes.data);
    } catch (e) {
      console.error(e);
      // Fail silently on interval, loud on user action
    }
  };

  const handleAssignDoctor = async (patientId) => {
    try {
      await triageAPI.assignDoctor({ patient_id: patientId, doctor_name: doctorName || "Unspecified" });
      toast.success("Doctor assigned successfully");
      setDoctorName("");
      fetchData();
      if (selectedPatient?.patient?.id === patientId) {
        handlePatientClick(patientId);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to assign doctor");
    }
  };

  const handleStartTreatment = async (patientId) => {
    try {
      await triageAPI.startTreatment(patientId);
      toast.success("Treatment started");
      fetchData();
      if (selectedPatient?.patient?.id === patientId) {
        handlePatientClick(patientId);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start treatment");
    }
  };

  const handleCompleteTreatment = async (patientId) => {
    try {
      await triageAPI.completeTreatment(patientId);
      toast.success("Treatment completed - Patient can now submit new triage if needed");
      fetchData();
      if (selectedPatient?.patient?.id === patientId) {
        handlePatientClick(patientId);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to complete treatment");
    }
  };

  const handleStatusChange = async (patientId, newStatus) => {
    try {
      await triageAPI.updateStatus({ patient_id: patientId, status: newStatus });
      toast.success(`Patient status updated to ${newStatus}`);
      fetchData();
      if (selectedPatient?.patient?.id === patientId) {
        handlePatientClick(patientId); // refresh selected
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update status");
    }
  };

  const filteredQueue = statusFilter === "all" 
    ? queue 
    : queue.filter(p => p.status === statusFilter);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 5000); // 5s refresh
    return () => clearInterval(timer);
  }, []);

  const handlePatientClick = async (id) => {
    try {
      const res = await triageAPI.getPatientDetail(id);
      setSelectedPatient(res.data);
      setNewTriage(res.data.triage?.triage_level || "Unknown");
    } catch (e) {
      toast.error("Failed to load patient details");
    }
  };

  const handleOverride = async () => {
    if (!overrideReason) {
      toast.error("Please provide a reason for the override");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await triageAPI.overrideTriage({
        patient_id: selectedPatient.patient.id,
        new_triage: newTriage,
        reason: overrideReason
      });
      toast.success("Triage level successfully overridden");
      setOverrideReason("");
      fetchData();
      handlePatientClick(selectedPatient.patient.id); // refresh selected
    } catch (e) {
      toast.error("Failed to override triage");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-1 p-6 lg:p-12 relative z-10 w-full overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Analytics Top Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl text-center">
            <p className="text-slate-400 text-xs tracking-widest uppercase mb-2">Total Patients</p>
            <p className="text-3xl font-bold text-white">{analytics?.total_patients || 0}</p>
          </div>
          <div className="glass-card p-4 rounded-xl text-center">
            <p className="text-slate-400 text-xs tracking-widest uppercase mb-2">Critical %</p>
            <p className="text-3xl font-bold text-red-400">{analytics?.critical_percentage || 0}%</p>
          </div>
          <div className="glass-card p-4 rounded-xl text-center">
            <p className="text-slate-400 text-xs tracking-widest uppercase mb-2">Override Rate</p>
            <p className="text-3xl font-bold text-yellow-400">{analytics?.override_frequency_percentage || 0}%</p>
          </div>
          <div className="glass-card p-4 rounded-xl text-center flex gap-3 items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            <p className="text-green-400 font-mono text-sm tracking-widest font-bold">LIVE QUEUE<br/><span className="text-[10px] text-slate-500">5S REFRESH</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
          {/* Patient Queue */}
          <div className="lg:col-span-2 glass-card p-6 rounded-xl min-h-[500px]">
            <div className="flex items-center justify-between mb-6 border-b border-primary/20 pb-2">
              <h2 className="text-xl font-bold tracking-widest text-primary">Active Triage Queue</h2>
              
              {/* Status Filter */}
              <div className="flex gap-2">
                {["all", "Waiting", "In Treatment", "Discharged"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-lg border transition-colors ${
                      statusFilter === filter
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-primary/20 text-slate-400 hover:border-primary/50"
                    }`}
                  >
                    {filter === "all" ? "All" : filter}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredQueue.map((p) => {
                const statusStyle = STATUS_COLORS[p.status] || STATUS_COLORS["Waiting"];
                return (
                  <motion.div
                    key={p.patient_id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => handlePatientClick(p.patient_id)}
                    className={`bg-black/40 border p-4 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                      selectedPatient?.patient?.id === p.patient_id ? 'border-primary' : 'border-primary/20 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-white font-bold">{p.name} <span className="text-slate-400 text-sm font-normal">({p.age} {p.gender})</span></h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border`}>
                          {p.status || "Waiting"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono tracking-widest">
                        <span>Wait: {p.waiting_minutes}m</span>
                        {p.registration_time && <span>Reg: {new Date(p.registration_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block w-16">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Priority</p>
                        <p className="text-white font-mono font-bold text-lg">{p.priority_score}</p>
                      </div>
                      <div className="text-right w-24">
                        <p className={`font-bold ${
                          p.triage_level === 'Critical' ? 'text-red-500' :
                          p.triage_level === 'Urgent' ? 'text-orange-500' :
                          p.triage_level === 'Moderate' ? 'text-yellow-400' : 'text-green-400'
                        }`}>{p.triage_level}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Conf: {p.confidence}%</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredQueue.length === 0 && <p className="text-center text-slate-500 py-10 tracking-widest uppercase">No patients in queue.</p>}
            </div>
          </div>

          {/* Patient Detail Panel */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selectedPatient ? (
                <motion.div
                  key={selectedPatient.patient.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-card p-6 rounded-xl flex flex-col gap-6"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-2xl font-bold text-white">{selectedPatient.patient.name}</h2>
                      <span className={`text-xs px-3 py-1 rounded-full uppercase tracking-widest font-bold ${
                        STATUS_COLORS[selectedPatient.patient.status]?.bg || STATUS_COLORS["Waiting"].bg
                      } ${
                        STATUS_COLORS[selectedPatient.patient.status]?.text || STATUS_COLORS["Waiting"].text
                      } ${
                        STATUS_COLORS[selectedPatient.patient.status]?.border || STATUS_COLORS["Waiting"].border
                      } border`}>
                        {selectedPatient.patient.status || "Waiting"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{selectedPatient.patient.age} y/o {selectedPatient.patient.gender}</p>
                  </div>

                  {/* Status Update Buttons */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-primary mb-2">Update Status</h3>
                    <div className="flex gap-2">
                      {["Waiting", "In Treatment", "Discharged"].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(selectedPatient.patient.id, status)}
                          disabled={selectedPatient.patient.status === status}
                          className={`flex-1 text-[10px] uppercase tracking-widest py-2 px-2 rounded-lg border transition-all ${
                            selectedPatient.patient.status === status
                              ? `${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].border} ${STATUS_COLORS[status].text} cursor-default`
                              : "border-primary/20 text-slate-400 hover:border-primary/50 hover:text-white"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timing Information */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-primary mb-2">Timeline</h3>
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Registration:</span>
                        <span className="text-white font-mono">{selectedPatient.patient.registration_time ? new Date(selectedPatient.patient.registration_time).toLocaleTimeString() : '-'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Triage Complete:</span>
                        <span className="text-white font-mono">{selectedPatient.patient.triage_time ? new Date(selectedPatient.patient.triage_time).toLocaleTimeString() : '-'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Treatment Started:</span>
                        <span className="text-white font-mono">{selectedPatient.patient.treatment_start_time ? new Date(selectedPatient.patient.treatment_start_time).toLocaleTimeString() : '-'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Discharged:</span>
                        <span className="text-white font-mono">{selectedPatient.patient.discharge_time ? new Date(selectedPatient.patient.discharge_time).toLocaleTimeString() : '-'}</span>
                      </div>
                    </div>
                  </div>

                  {selectedPatient.triage && (
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
                      <div className="flex justify-between items-center mb-3 relative z-10">
                        <span className="text-xs uppercase tracking-widest text-slate-400">AI Assessment</span>
                        <span className={`font-bold text-xl drop-shadow-lg ${
                          selectedPatient.triage.triage_level === 'Critical' ? 'text-red-500' :
                          selectedPatient.triage.triage_level === 'Urgent' ? 'text-orange-500' : 'text-yellow-400'
                        }`}>
                          {selectedPatient.triage.triage_level}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 italic mb-2 relative z-10">"{selectedPatient.triage.llm_reasoning}"</p>
                      
                      {selectedPatient.triage.doctor_override === "YES" && (
                        <div className="mt-3 py-1 px-3 bg-yellow-500/20 text-xs text-yellow-500 font-bold tracking-widest flex items-center justify-center gap-2 rounded border border-yellow-500/30">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span> 
                          DOCTOR OVERRIDDEN
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-primary mb-2">Reported Symptoms</h3>
                    <p className="text-sm text-slate-300 bg-black/40 p-3 rounded-lg border border-white/5">{selectedPatient.patient.symptoms_text}</p>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-primary mb-2">Vital Signs</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="text-slate-400 text-xs uppercase tracking-widest">HR: <span className="text-white text-base ml-1 font-mono">{selectedPatient.vitals.heart_rate || '-'}</span></div>
                      <div className="text-slate-400 text-xs uppercase tracking-widest">BP: <span className="text-white text-base ml-1 font-mono">{selectedPatient.vitals.blood_pressure || '-'}</span></div>
                      <div className="text-slate-400 text-xs uppercase tracking-widest">SpO2: <span className="text-white text-base ml-1 font-mono">{selectedPatient.vitals.spo2 ? selectedPatient.vitals.spo2+'%' : '-'}</span></div>
                      <div className="text-slate-400 text-xs uppercase tracking-widest">Resp: <span className="text-white text-base ml-1 font-mono">{selectedPatient.vitals.respiratory_rate || '-'}</span></div>
                      <div className="text-slate-400 text-xs uppercase tracking-widest col-span-2">Temp: <span className="text-white text-base ml-1 font-mono">{selectedPatient.vitals.temperature ? selectedPatient.vitals.temperature+'°C' : '-'}</span></div>
                    </div>
                  </div>

                  {/* Doctor Override Section */}
                  <div className="border-t border-primary/20 pt-5 mt-auto">
                    <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Clinical Override</h3>
                    <div className="space-y-3">
                      <select 
                        value={newTriage}
                        onChange={(e) => setNewTriage(e.target.value)}
                        className="w-full bg-black/40 border border-primary/20 rounded-lg p-3 text-white focus:border-primary focus:outline-none transition-colors"
                      >
                        <option value="Critical">Critical</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Non Urgent">Non Urgent</option>
                      </select>
                      
                      <input 
                        type="text" 
                        placeholder="Reason for override..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full bg-black/40 border border-primary/20 rounded-lg p-3 text-white focus:border-primary focus:outline-none transition-colors" 
                      />
                      
                      <button 
                        onClick={handleOverride}
                        disabled={isSubmitting || newTriage === selectedPatient.triage?.triage_level}
                        className={`w-full font-bold tracking-widest uppercase text-xs p-4 rounded-xl transition-all border ${
                          isSubmitting || newTriage === selectedPatient.triage?.triage_level
                          ? 'bg-transparent border-primary/20 text-primary/50 cursor-not-allowed'
                          : 'bg-primary/10 hover:bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                        }`}
                      >
                        {isSubmitting ? 'Processing...' : 'Confirm Override'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-6 rounded-xl flex items-center justify-center h-full min-h-[500px] border-dashed border-2 border-primary/10 bg-transparent"
                >
                  <p className="text-slate-500 tracking-widest uppercase text-xs">Select a patient for details</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AdminDashboardPage;
