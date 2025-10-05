import { useState } from 'react';
import {
  Card, CardContent, CardHeader, CardActions,
  TextField, Button, Alert, Stack
} from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';

export default function WorkoutGenerator({ onGenerated, userId = 'anon' }) {
  const [text, setText] = useState('I want an arms workout');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId }),
      });
      
      const data = await res.json();

      // If the response is not OK, throw an error with the message from the backend
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to generate');
      }

      // The request was successful. The 'data' is the workout object.
      // Hand the saved workout back to the parent (Home).
      onGenerated?.(data);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={<FitnessCenterIcon color="primary" />}
        title="Generate a Workout"
        subheader='Describe your goal, e.g. "I want an arms workout"'
      />
      <CardContent>
        <Stack spacing={2}>
          <TextField
            label="Your request"
            value={text}
            onChange={(e) => setText(e.target.value)}
            fullWidth
            multiline
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button variant="contained" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate & Save'}
        </Button>
      </CardActions>
    </Card>
  );
}
