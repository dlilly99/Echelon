import React from 'react';
import { Box, Button } from '@mui/material';
import RepCounter from '../components/RepCounter';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

export default function RepCounterPage() {
  const navigate = useNavigate(); // Initialize navigate function

  const handleEndWorkout = () => {
    navigate('/'); // Navigate to the home page
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <RepCounter />
      <Button 
        variant="contained" 
        color="secondary" 
        onClick={handleEndWorkout}
        sx={{ mt: 2 }}
      >
        End Workout
      </Button>
    </Box>
  );
}