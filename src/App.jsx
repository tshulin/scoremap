// App routing — routes come straight from the handoff README.
//   /                → Landing
//   /signup          → GetStarted
//   /signup/google   → SignupGoogle
//   /login           → Login
//   /dashboard       → Dashboard
//   /grades/:classId → ClassDetail
// Signed-in routes are wrapped in RequireAuth, which bounces to /login when
// there is no backend session token (including after expiry mid-use).
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { hasToken } from './data/api.js';
import { useSyncStatus } from './data/SyncProvider.jsx';
import Landing from './pages/Landing.jsx';
import GetStarted from './pages/GetStarted.jsx';
import SignupGoogle from './pages/SignupGoogle.jsx';
import Login from './pages/Login.jsx';
import Privacy from './pages/Privacy.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClassDetail from './pages/ClassDetail.jsx';
import Attendance from './pages/Attendance.jsx';
import Documents from './pages/Documents.jsx';
import Mail from './pages/Mail.jsx';
import MailDetail from './pages/MailDetail.jsx';

function RequireAuth({ children }) {
  const { status } = useSyncStatus();
  if (status === 'signedOut' && !hasToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<GetStarted />} />
      <Route path="/signup/google" element={<SignupGoogle />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/grades/:classId" element={<RequireAuth><ClassDetail /></RequireAuth>} />
      <Route path="/attendance" element={<RequireAuth><Attendance /></RequireAuth>} />
      <Route path="/documents" element={<RequireAuth><Documents /></RequireAuth>} />
      <Route path="/mail" element={<RequireAuth><Mail /></RequireAuth>} />
      <Route path="/mail/:mailId" element={<RequireAuth><MailDetail /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
