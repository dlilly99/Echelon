import { useState, useRef, useEffect, useCallback } from "react"; // Import useEffect
import { Link as RouterLink } from "react-router-dom";
import {
  AppBar, Toolbar, Container, Box, Stack, Typography, Button,
  Card, CardContent, Grid, Chip, Link
} from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";

import WorkoutGenerator from "../components/WorkoutGenerator.jsx";
import CalendarCard from "../components/CalendarCard.jsx";
import WorkoutsListCard from "../components/WorkoutsListCard.jsx";
import { API_BASE } from "../lib/api.js"; // Import API_BASE

export default function Home() {
  const [workouts, setWorkouts] = useState([]);
  const [latestWorkoutFromGeneration, setLatestWorkoutFromGeneration] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const generatorRef = useRef(null);

  const fetchWorkouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/workouts`);
      if (!res.ok) throw new Error('Failed to fetch workouts');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'API error');
      setWorkouts(data.workouts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const handleWorkoutGenerated = (newWorkout) => {
    setLatestWorkout(newWorkout);
    // --- NEW ---
    // Refresh the list of all workouts after generating a new one
    fetchWorkouts(); 
  };

  // Get the most recent workout from the list
  const latestWorkout = workouts.length > 0 ? workouts[0] : null;

  // Function to scroll to the workout generator
  const scrollToGenerator = () => {
    generatorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      {/* Top bar */}
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{ backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <FitnessCenterIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Echelon
          </Typography>

          <Button color="inherit" component={RouterLink} to="/">Home</Button>
          <Button color="inherit" component={RouterLink} to="/tracker">Rep Counter</Button>
        </Toolbar>
      </AppBar>

      {/* Hero */}
      <Box
        sx={{
          position: "relative",
          py: { xs: 10, md: 14 },
          background:
            "radial-gradient(1200px 600px at 10% -10%, rgba(109,94,252,0.35), transparent 60%), radial-gradient(1200px 600px at 90% 0%, rgba(0,229,168,0.25), transparent 60%)",
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12}>
              <Stack spacing={3} alignItems="flex-start">
                <Chip label="AI-powered training" color="primary" variant="outlined" />
                <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  The smart way to build and track your workouts.
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 820 }}>
                  Generate personalized workout plans with AI, count your reps in real-time using your camera, and monitor your progress.
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button size="large" variant="contained" onClick={scrollToGenerator}>
                    Generate a Workout
                  </Button>
                  <Button size="large" variant="outlined" component={RouterLink} to="/tracker">
                    Go to Rep Counter
                  </Button>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Main content */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={3} alignItems="stretch">
          {/* --- MODIFIED --- */}
          <Grid item xs={12} md={6} ref={generatorRef}>
            <WorkoutGenerator onGenerated={handleWorkoutGenerated} />
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent sx={{ flex: 1 }}>
                <Stack spacing={2}>
                  <Typography variant="overline" color="text.secondary">
                    Latest generated workout
                  </Typography>

                  {!latestWorkout ? (
                    <Typography color="text.secondary">
                      Nothing yet. Generate a workout on the left to see it here.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Saved • {new Date(latestWorkout.createdAt).toLocaleString()}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {latestWorkout.prompt}
                      </Typography>

                      {/* Pretty list of exercises */}
                      <Stack spacing={1.25} sx={{ mt: 1 }}>
                        {latestWorkout.exercises.map((ex) => (
                          <Box
                            key={ex.index}
                            sx={{
                              p: 1.5,
                              borderRadius: 1.5,
                              border: "1px solid rgba(255,255,255,0.08)",
                              bgcolor: "background.paper",
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                              <Chip size="small" color="primary" label={`#${ex.index}`} />
                              <Typography fontWeight={700}>{ex.name}</Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {ex.description}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              <strong>Equipment:</strong> {ex.equipment || 'EMPTY'}{' • '}
                              <strong>Reps:</strong> {ex.reps}{' • '}
                              <strong>Sets:</strong> {ex.sets ?? '—'}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>

                      {/* --- Add this button --- */}
                      <Button
                        variant="contained"
                        color="success"
                        component={RouterLink}
                        to="/tracker"
                        fullWidth
                        sx={{ mt: 2, py: 1.5 }}
                      >
                        Start Workout in Tracker
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Row 2 — side by side: Calendar + Previous Workouts */}
          <Grid item xs={12} md={6}>
            <CalendarCard workouts={workouts} />
          </Grid>

          <Grid item xs={12} md={6}>
            <WorkoutsListCard workouts={workouts} isLoading={isLoading} error={error} />
          </Grid>
        </Grid>
      </Container>

      {/* Footer */}
      <Box component="footer" sx={{ py: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
          >
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Echelon
            </Typography>
            <Stack direction="row" spacing={3}>
              <Link component={RouterLink} to="/" color="inherit" underline="hover">Home</Link>
              <Link component={RouterLink} to="/tracker" color="inherit" underline="hover">Rep Counter</Link>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}

// This is your example - I'm keeping it as a comment for reference
/*
import React from "react";
import { Link } from "react-router-dom";



function Home() {
  return (
    <div
      style={{
        textAlign: "center",
        backgroundColor: "#111",
        color: "white",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <h1>🏠 Welcome to Echelon</h1>
      <p>Your intelligent workout assistant</p>

      <Link to="/tracker">
        <button
          style={{
            backgroundColor: "limegreen",
            color: "#111",
            fontWeight: "bold",
            fontSize: "1.2rem",
            padding: "1rem 2rem",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            marginTop: "1rem",
          }}
        >
          Start Rep Counter 💪
        </button>
      </Link>
    </div>
  );
}

export default Home;
*/