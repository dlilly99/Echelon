// server/index.js
// Run: node server/index.js  (Node 18+)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Add these lines to handle file paths in ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------- App & Middleware ---------------------------
const app = express();

const DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/postman
    if (DEV_ORIGINS.has(origin) || /^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    return cb(null, true); // dev: permissive; tighten for prod
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// --- Add this line to serve static files from the 'dist' folder ---
app.use(express.static(path.join(__dirname, '../dist')));

// Tiny request logger (helps debugging)
app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// --------------------------- Mongo ---------------------------
if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'workouts_db' });
  console.log('✅ Mongo connected');
} catch (e) {
  console.error('❌ Mongo connection failed:', e.message);
  process.exit(1);
}

// Embedded exercise schema
const exerciseSchema = new mongoose.Schema(
  {
    index: Number,
    name: String,
    description: String,
    equipment: String, // "EMPTY" if none
    reps: String,      // "8-10", "AMRAP", etc.
    sets: Number,
  },
  { _id: false }
);

// Workout document
const workoutSchema = new mongoose.Schema(
  {
    userId: { type: String, default: 'anon' },
    prompt: { type: String, required: true },
    rawText: { type: String, required: true }, // raw delimited Gemini output
    exercises: { type: [exerciseSchema], default: [] },
  },
  { timestamps: true }
);
const Workout = mongoose.model('Workout', workoutSchema);

// --------------------------- Prompt + Parsing ---------------------------
function buildPrompt(userText) {
  return `You are my personal trainer.
Build a safe, beginner-friendly workout for: ${userText}

OUTPUT RULES (VERY IMPORTANT):
- Return ONLY one exercise per line.
- Each line must be wrapped in braces and use "!" as field separators.
- ABSOLUTELY NO extra text before or after the lines. No markdown. No code fences.
- Use exactly this field order:

{!Excercise#<number>!ExerciceName!ExerciceDescription!ExerciceEquipmentName(ifNecessary else EMPTY)!ExcerciceNumberOfrepetition!ExerciceNumberOfSets!}

Examples:
{!Excercise#1!Dumbbell Curl!Classic biceps curl focusing on control!Dumbbells!10-12!3!}
{!Excercise#2!Hammer Curl!Neutral grip curl to hit brachialis!Dumbbells!10!3!}
{!Excercise#3!Diamond Push-ups!Close-hand push-ups for triceps!EMPTY!AMRAP!3!}`;
}

// Parse lines like: {!Excercise#1!Dumbbell Curl!Desc!Dumbbells!10-12!3!}
function parseDelimited(text) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    if (!line.startsWith('{!') || !line.endsWith('}')) continue;
    const inner = line.slice(1, -1); // remove { }
    const parts = inner.split('!').filter(Boolean); // split on !
    if (parts.length < 6) continue;

    const idxMatch = parts[0].match(/#(\d+)/);
    items.push({
      index: idxMatch ? Number(idxMatch[1]) : items.length + 1,
      name: parts[1],
      description: parts[2],
      equipment: parts[3],
      reps: String(parts[4]),
      sets: Number(String(parts[5]).replace(/[^\d]/g, '')) || null,
    });
  }
  return items;
}

// --------------------------- Gemini helpers (auto-fallback) ---------------------------
if (!process.env.GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

const STATIC_MODELS = [
  process.env.GEMINI_MODEL,          // respect .env if set
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-pro',
].filter(Boolean);

// prefer v1, then v1beta, but allow override via .env
const BASES = [...new Set([process.env.GEMINI_BASE, 'v1', 'v1beta'].filter(Boolean))];

function stripPrefix(name) {
  return String(name || '').replace(/^models\//, '');
}

async function listModelNames() {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1/models', {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    });
    const data = await r.json();
    const arr = Array.isArray(data?.models) ? data.models : [];
    return arr
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => stripPrefix(m.name));
  } catch {
    return [];
  }
}

async function callGemini(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 },
  };

  // Build candidate list: .env → listed models → static fallbacks
  const listed = await listModelNames();
  const candidates = [...new Set([
    ...STATIC_MODELS,
    ...listed.filter(n => /1\.5.*flash/.test(n)),
    ...listed.filter(n => /1\.5.*pro/.test(n)),
    ...listed,
  ])];

  const tried = [];

  for (const base of BASES) {
    for (const model of candidates) {
      const url = `https://generativelanguage.googleapis.com/${base}/models/${model}:generateContent`;
      tried.push(`${base}:${model}`);
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify(body),
        });
        const txt = await r.text();
        if (!r.ok) {
          if (r.status === 404) continue; // try next model
          throw new Error(`${base}/${model} -> ${r.status}: ${txt}`);
        }
        const data = JSON.parse(txt);
        const out = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        if (out) return out;
      } catch (e) {
        if (!String(e.message).includes('404')) throw e; // only swallow NOT_FOUND
      }
    }
  }
  throw new Error(`No compatible Gemini model found for this key. Tried: ${tried.join(', ')}`);
}

// --------------------------- Routes ---------------------------

// Health + echo
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/echo', (req, res) => res.json({ ok: true, youSent: req.body || null }));

// List models your key can use
app.get('/api/models', async (_req, res) => {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1/models', {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Generate workout, parse, save, return saved doc
app.post('/api/generate-and-save', async (req, res) => {
  try {
    const { text = '', userId = 'anon' } = req.body || {};
    const clean = text.trim();
    if (!clean) return res.status(400).json({ ok: false, error: 'Missing text' });

    const rawText = await callGemini(buildPrompt(clean));
    const exercises = parseDelimited(rawText);
    if (!exercises.length) {
      return res.status(422).json({ ok: false, error: 'Unexpected model output' });
    }

    const workout = await Workout.create({ userId, prompt: clean, rawText, exercises });
    res.json({ ok: true, workout });
  } catch (e) {
    console.error('Generate error:', e.message);
    res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
});

// List workouts (optionally by userId)
app.get('/api/workouts', async (req, res) => {
  const userId = req.query.userId || 'anon';
  const docs = await Workout.find({ userId }).sort({ createdAt: -1 }).limit(50);
  res.json({ ok: true, workouts: docs });
});

// Get one workout
app.get('/api/workouts/:id', async (req, res) => {
  const doc = await Workout.findById(req.params.id);
  if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, workout: doc });
});

// --- Add this catch-all route to serve the React app for any other request ---
// This must be AFTER all your API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// --------------------------- Start ---------------------------
const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}`);
});
