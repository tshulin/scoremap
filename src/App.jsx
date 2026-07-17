// App routing — routes come straight from the handoff README.
//   /                → Landing
//   /signup          → GetStarted
//   /signup/google   → SignupGoogle
//   /login           → Login
//   /dashboard       → Dashboard
//   /grades/:classId → ClassDetail
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Landing from './pages/Landing.jsx';
import GetStarted from './pages/GetStarted.jsx';
import SignupGoogle from './pages/SignupGoogle.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClassDetail from './pages/ClassDetail.jsx';
import Attendance from './pages/Attendance.jsx';
import Documents from './pages/Documents.jsx';
import Mail from './pages/Mail.jsx';
import MailDetail from './pages/MailDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<GetStarted />} />
      <Route path="/signup/google" element={<SignupGoogle />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/grades/:classId" element={<ClassDetail />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/mail" element={<Mail />} />
      <Route path="/mail/:mailId" element={<MailDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
