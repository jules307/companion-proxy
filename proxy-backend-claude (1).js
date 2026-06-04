/**
 * CONFIDENCE RESET COMPANION — INDEPENDENT BACKEND PROXY
 * Using Claude API (Anthropic)
 * 
 * Deploy to: Vercel, Railway, AWS Lambda, or your own server
 * Environment variables needed:
 *   - ANTHROPIC_API_KEY (from https://console.anthropic.com)
 *   - ELEVENLABS_API_KEY (from https://elevenlabs.io)
 *   - ALLOWED_ORIGINS (comma-separated list of domains calling this API)
 */

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// CORS configuration — restrict to your domains
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
}));

// ============================================================
// SYSTEM PROMPTS — Customize these for your brand
// ============================================================

const CONFIDENCE_SYSTEM_PROMPT = `You are Jules, a compassionate coach specializing in nervous system reset and confidence rebuilding.

The user is checking in with how they're feeling. Your role is to:
1. Meet them exactly where they are — no judgment
2. Validate their experience
3. Offer a grounding technique or reframe
4. Keep responses under 150 words
5. Use warm, human language (not corporate)
6. Be supportive, not clinical

Remember: This is a daily companion, not a therapist. Your goal is to help them feel less alone and more resourced.`;

const MANIFESTATION_SYSTEM_PROMPT = `You are Jules, a manifestation coach who helps people align with their desires.

The user is sharing what they want to manifest or blocks they're experiencing. Your role is to:
1. Listen deeply to their desire and any resistance
2. Help them identify limiting beliefs
3. Offer a reframe or energy-shifting perspective
4. Suggest an alignment practice
5. Keep responses under 150 words
6. Use warm, empowering language

Remember: Manifestation is about energy alignment and belief shifts, not wishful thinking. Help them feel resourced and aligned.`;

// ============================================================
// POST /api/chat — AI Response Endpoint
// ============================================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message, type = 'confidence', moodState } = req.body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' });
    }

    // Select system prompt based on companion type
    const systemPrompt = type === 'manifestation' 
      ? MANIFESTATION_SYSTEM_PROMPT 
      : CONFIDENCE_SYSTEM_PROMPT;

    // Build user message with context
    let userMessage = message;
    if (moodState) {
      userMessage = `[Current mood: ${moodState}]\n\n${message}`;
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    // Extract text response
    const reply = response.content[0].type === 'text' 
      ? response.content[0].text 
      : 'I appreciate you sharing. Let me help you with that.';

    res.json({
      reply,
      type,
      model: 'claude-3-5-sonnet-20241022'
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error.message
    });
  }
});

// ============================================================
// POST /api/speak — Text-to-Speech Endpoint (ElevenLabs)
// ============================================================

app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text' });
    }

    // Limit text length (ElevenLabs has limits)
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 characters)' });
    }

    // Call ElevenLabs API
    const elevenLabsResponse = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/IltQT4bhJ2GOKnEFTJKn',
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!elevenLabsResponse.ok) {
      const error = await elevenLabsResponse.json();
      throw new Error(`ElevenLabs error: ${error.detail?.message || 'Unknown error'}`);
    }

    // Get audio buffer
    const audioBuffer = await elevenLabsResponse.arrayBuffer();

    // Convert to base64 for inline playback
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    res.json({
      audioUrl,
      voiceId: 'IltQT4bhJ2GOKnEFTJKn'
    });

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error.message
    });
  }
});

// ============================================================
// Health Check Endpoint
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Confidence Reset Companion Proxy'
  });
});

// ============================================================
// Error Handler
// ============================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ============================================================
// Start Server
// ============================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Companion proxy running on port ${PORT}`);
  console.log(`✓ Claude API: ${process.env.ANTHROPIC_API_KEY ? 'configured' : 'NOT SET'}`);
  console.log(`✓ ElevenLabs API: ${process.env.ELEVENLABS_API_KEY ? 'configured' : 'NOT SET'}`);
});

module.exports = app;
