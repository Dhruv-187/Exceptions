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
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [recommendedDoctor, setRecommendedDoctor] = useState(null);

  const STATUS_COLORS = {
    "WAITING": { text: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" },
    "ASSIGNED": { text: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
    "IN_TREATMENT": { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
    "COMPLETED": { text: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
  };

  const fetchDoctors = async () => {
    try {
      const res = await triageAPI.getDoctors();
      setDoctors(res.data.doctors || []);
    } catch (e) {
      console.error("Failed to fetch doctors", e);
    }
  };

  const fetchData = async () => {
    try {
      const includeCompleted = statusFilter === "COMPLETED" || statusFilter === "all";
      const qRes = await triageAPI.getPatients(includeCompleted);
      setQueue(qRes.data);
      const aRes = await triageAPI.getAnalytics();
      setAnalytics(aRes.data);
      // Refresh doctors list to update availability status
      const dRes = await triageAPI.getDoctors();
      setDoctors(dRes.data.doctors || []);
    } catch (e) {
      console.error(e);
      // Fail silently on interval, loud on user action
    }
  };

  const fetchRecommendedDoctor = async (patientId) => {
    try {
      const res = await triageAPI.getRecommendedDoctor(patientId);
      setRecommendedDoctor(res.data);
      setSelectedDoctorId(res.data.recommended_doctor.id);
    } catch (e) {
      console.error("Failed to fetch recommended doctor", e);
      setRecommendedDoctor(null);
    }
  };

  const handleAssignDoctor = async (patientId) => {
    try {
      await triageAPI.assignDoctor(patientId, selectedDoctorId);
      const doctor = doctors.find(d => d.id === selectedDoctorId);
      toast.success(`Assigned to ${doctor?.name || 'Doctor'} (${doctor?.specialty || 'Specialist'})`);
      setSelectedDoctorId("");
      setRecommendedDoctor(null);
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

  const handleDeletePatient = async (patientId, patientName) => {
    if (!window.confirm(`Are you sure you want to delete ${patientName}'s record? This action cannot be undone.`)) {
      return;
    }
    try {
      await triageAPI.deletePatient(patientId);
      toast.success(`Patient record deleted successfully`);
      setSelectedPatient(null);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete patient record");
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
    fetchDoctors(); // Fetch doctors list on mount
    fetchData();
    const timer = setInterval(fetchData, 5000); // 5s refresh
    return () => clearInterval(timer);
  }, [statusFilter]);

  const handlePatientClick = async (id) => {
    try {
      const res = await triageAPI.getPatientDetail(id);
      setSelectedPatient(res.data);
      setNewTriage(res.data.triage?.triage_level || "Unknown");
      
      // Fetch recommended doctor if patient is WAITING
      if (res.data.patient.status === "WAITING") {
        fetchRecommendedDoctor(id);
      } else {
        setRecommendedDoctor(null);
        setSelectedDoctorId("");
      }
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
              <div className="flex gap-2 flex-wrap">
                {["all", "WAITING", "ASSIGNED", "IN_TREATMENT", "COMPLETED"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-lg border transition-colors ${
                      statusFilter === filter
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-primary/20 text-slate-400 hover:border-primary/50"
                    }`}
                  >
                    {filter === "all" ? "All" : filter.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredQueue.map((p) => {
                const statusStyle = STATUS_COLORS[p.status] || STATUS_COLORS["WAITING"];
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
                          {(p.status || "WAITING").replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono tracking-widest">
                        <span>Wait: {p.waiting_minutes}m</span>
                        {p.assigned_doctor && (
                          <span className="text-purple-400">
                            {p.assigned_doctor}{p.assigned_specialty ? ` (${p.assigned_specialty})` : ''}
                          </span>
                        )}
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
                        STATUS_COLORS[selectedPatient.patient.status]?.bg || STATUS_COLORS["WAITING"].bg
                      } ${
                        STATUS_COLORS[selectedPatient.patient.status]?.text || STATUS_COLORS["WAITING"].text
                      } ${
                        STATUS_COLORS[selectedPatient.patient.status]?.border || STATUS_COLORS["WAITING"].border
                      } border`}>
                        {(selectedPatient.patient.status || "WAITING").replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{selectedPatient.patient.age} y/o {selectedPatient.patient.gender}</p>
                    {selectedPatient.patient.assigned_doctor && (
                      <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-xs text-slate-400">Assigned to:</p>
                        <p className="text-sm text-purple-400 font-medium">{selectedPatient.patient.assigned_doctor}</p>
                        {selectedPatient.patient.assigned_specialty && (
                          <p className="text-xs text-slate-500">{selectedPatient.patient.assigned_specialty}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Workflow Actions */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-primary mb-3">Workflow Actions</h3>
                    <div className="space-y-3">
                      {/* Assign Doctor - Only for WAITING status */}
                      {selectedPatient.patient.status === "WAITING" && (
                        <div className="bg-black/40 p-4 rounded-lg border border-purple-500/20">
                          <p className="text-[10px] uppercase tracking-widest text-purple-400 mb-3">Assign Doctor</p>
                          
                          {/* Recommended Doctor */}
                          {recommendedDoctor && (
                            <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <p className="text-[10px] uppercase tracking-widest text-green-400 mb-1">AI Recommendation</p>
                              <p className="text-sm text-white font-medium">{recommendedDoctor.recommended_doctor.name}</p>
                              <p className="text-xs text-slate-400">{recommendedDoctor.recommended_doctor.specialty}</p>
                              <p className="text-[10px] text-slate-500 mt-1 italic">{recommendedDoctor.reason}</p>
                              {doctors.find(d => d.id === recommendedDoctor.recommended_doctor.id && !d.available) && (
                                <p className="text-[10px] text-red-400 mt-1">⚠️ Currently treating another patient</p>
                              )}
                            </div>
                          )}
                          
                          {/* Doctor Dropdown */}
                          <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full bg-black/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none mb-2"
                          >
                            <option value="">Select a doctor...</option>
                            {doctors.map((doctor) => (
                              <option 
                                key={doctor.id} 
                                value={doctor.id}
                                disabled={!doctor.available}
                                className={!doctor.available ? 'text-red-400' : ''}
                              >
                                {doctor.name} - {doctor.specialty} {!doctor.available ? `(Busy - treating ${doctor.current_patient})` : '✓ Available'}
                              </option>
                            ))}
                          </select>
                          
                          <button
                            onClick={() => handleAssignDoctor(selectedPatient.patient.id)}
                            disabled={!selectedDoctorId}
                            className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                              selectedDoctorId 
                                ? "bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400"
                                : "bg-slate-800/50 border border-slate-700 text-slate-500 cursor-not-allowed"
                            }`}
                          >
                            Assign Selected Doctor
                          </button>
                        </div>
                      )}
                      
                      {/* Start Treatment - For WAITING or ASSIGNED status */}
                      {(selectedPatient.patient.status === "WAITING" || selectedPatient.patient.status === "ASSIGNED") && (
                        <button
                          onClick={() => handleStartTreatment(selectedPatient.patient.id)}
                          className="w-full py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                        >
                          Start Treatment
                        </button>
                      )}
                      
                      {/* Complete Treatment - Only for IN_TREATMENT status */}
                      {selectedPatient.patient.status === "IN_TREATMENT" && (
                        <button
                          onClick={() => handleCompleteTreatment(selectedPatient.patient.id)}
                          className="w-full py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                        >
                          Complete Treatment
                        </button>
                      )}
                      
                      {/* COMPLETED status message */}
                      {selectedPatient.patient.status === "COMPLETED" && (
                        <div className="text-center py-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400 text-xs uppercase tracking-widest font-bold">Visit Completed</p>
                          <p className="text-slate-500 text-[10px] mt-1">Patient can submit new triage if needed</p>
                        </div>
                      )}
                      
                      {/* Delete Record Button */}
                      <button
                        onClick={() => handleDeletePatient(selectedPatient.patient.id, selectedPatient.patient.name)}
                        className="w-full py-3 mt-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                      >
                        Delete Record
                      </button>
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
                        <span>Doctor Assigned:</span>
                        <span className="text-white font-mono">{selectedPatient.patient.assigned_time ? new Date(selectedPatient.patient.assigned_time).toLocaleTimeString() : '-'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Treatment Started:</span>
                        <span className="text-white font-mono">{selectedPatient.patient.treatment_start_time ? new Date(selectedPatient.patient.treatment_start_time).toLocaleTimeString() : '-'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Completed:</span>
                        <span className="text-white font-mono">{selectedPatient.patient.completed_time ? new Date(selectedPatient.patient.completed_time).toLocaleTimeString() : '-'}</span>
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
