import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx'; // Changed from './pages/Home'
import Tracker from './pages/Tracker.jsx'; // Changed from './pages/Tracker'
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
  // ...existing code...
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tracker" element={<Tracker />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;