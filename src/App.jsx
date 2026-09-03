// App routing - routes come straight from the handoff README.
//   /                → Landing
//   /dashboard       → Dashboard
//   /grades/:classId → ClassDetail
// Demo routes are wrapped in RequireAuth, which bounces to the landing
// page when no sample account has been opened.
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { hasDemo } from './data/api.js';
import { useSyncStatus } from './data/SyncProvider.jsx';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClassDetail from './pages/ClassDetail.jsx';
import Attendance from './pages/Attendance.jsx';
import Documents from './pages/Documents.jsx';
import GpaCalculator from './pages/GpaCalculator.jsx';
import Mail from './pages/Mail.jsx';
import MailDetail from './pages/MailDetail.jsx';
import Feedback from './pages/Feedback.jsx';
import Profile from './pages/Profile.jsx';

function RequireAuth({ children }) {
  const { status } = useSyncStatus();
  if (status === 'signedOut' && !hasDemo()) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/grades/:classId" element={<RequireAuth><ClassDetail /></RequireAuth>} />
      <Route path="/attendance" element={<RequireAuth><Attendance /></RequireAuth>} />
      <Route path="/documents" element={<RequireAuth><Documents /></RequireAuth>} />
      <Route path="/gpa-calculator" element={<RequireAuth><GpaCalculator /></RequireAuth>} />
      <Route path="/mail" element={<RequireAuth><Mail /></RequireAuth>} />
      <Route path="/mail/:mailId" element={<RequireAuth><MailDetail /></RequireAuth>} />
      <Route path="/feedback" element={<RequireAuth><Feedback /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
