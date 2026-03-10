import axios from 'axios';

const API_BASE = '/api/auth';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Attach token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pulsepriority_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pulsepriority_token');
      localStorage.removeItem('pulsepriority_user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/register', data),
  login: (data) => api.post('/login', data),
  adminLogin: (data) => api.post('/admin/login', data),
  verifyOTP: (data) => api.post('/verify-otp', data),
  resendOTP: (data) => api.post('/resend-otp', data),
  forgotPassword: (data) => api.post('/forgot-password', data),
  resetPassword: (data) => api.post('/reset-password', data),
  getMe: () => api.get('/me'),
};

const triageApiInstance = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' }
});

export const triageAPI = {
  submitIntake: (data) => triageApiInstance.post('/patient-intake', data),
  submitCriticalEmergency: (data) => triageApiInstance.post('/critical-emergency', data),
  runTriage: (patientId) => triageApiInstance.post(`/triage?patient_id=${patientId}`),
  getPatients: (includeCompleted = false) => triageApiInstance.get(`/patients?include_completed=${includeCompleted}`),
  getPatientDetail: (patientId) => triageApiInstance.get(`/patient/${patientId}`),
  overrideTriage: (data) => triageApiInstance.post('/override-triage', data),
  updateStatus: (data) => triageApiInstance.post('/update-status', data),
  getDoctors: () => triageApiInstance.get('/doctors'),
  getRecommendedDoctor: (patientId) => triageApiInstance.get(`/doctors/recommend/${patientId}`),
  assignDoctor: (patientId, doctorId) => triageApiInstance.post('/assign-doctor', { patient_id: patientId, doctor_id: doctorId }),
  startTreatment: (patientId) => triageApiInstance.post('/start-treatment', { patient_id: patientId }),
  completeTreatment: (patientId) => triageApiInstance.post('/complete-treatment', { patient_id: patientId }),
  deletePatient: (patientId) => triageApiInstance.delete(`/patient/${patientId}`),
  markCritical: (patientId) => triageApiInstance.post('/mark-critical', { patient_id: patientId }),
  getActivityLogs: (limit = 50) => triageApiInstance.get(`/activity-logs?limit=${limit}`),
  getAnalytics: () => triageApiInstance.get('/analytics'),
  
  // Patient Profiles
  getProfiles: (search = '') => triageApiInstance.get(`/patient-profiles?search=${encodeURIComponent(search)}`),
  getProfile: (profileId) => triageApiInstance.get(`/patient-profiles/${profileId}`),
  createProfile: (data) => triageApiInstance.post('/patient-profiles', data),
  updateProfile: (profileId, data) => triageApiInstance.put(`/patient-profiles/${profileId}`, data),
  deleteProfile: (profileId) => triageApiInstance.delete(`/patient-profiles/${profileId}`),
  recordProfileVisit: (profileId) => triageApiInstance.post(`/patient-profiles/${profileId}/record-visit`),
};

export default api;
