/**
 * CONFIDENCE RESET COMPANION — VERCEL BACKEND PROXY
 * Routes:
 * POST /api/chat
 * POST /api/speak
 * GET  /api/health
 */

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();

app.use(express.json({ limit: '1mb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'localhost:3000')
  .split(',')
  .map(origin => origin.trim());

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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const CONFIDENCE_SYSTEM_PROMPT = `You are Jules, a compassionate coach specializing in nervous system reset and confidence rebuilding.

The user is checking in with how they're feeling. Your role is to:
1. Meet them exactly where they are — no judgment
2. Validate their experience
3. Offer a grounding technique or reframe
4. Keep responses under 150 words
5. Use warm, human language, not corporate
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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Confidence Reset Companion Proxy'
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, messages, type = 'confidence', moodState, systemPrompt } = req.body;

    const selectedSystemPrompt =
      systemPrompt ||
      (type === 'manifestation'
        ? MANIFESTATION_SYSTEM_PROMPT
        : CONFIDENCE_SYSTEM_PROMPT);

    let claudeMessages;

    if (Array.isArray(messages)) {
      claudeMessages = messages
        .map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: String(msg.content || '')
        }))
        .filter(msg => msg.content.trim());
    } else if (message && typeof message === 'string') {
      let userMessage = message;

      if (moodState) {
        userMessage = `[Current mood: ${moodState}]\n\n${message}`;
      }

      claudeMessages = [
        {
          role: 'user',
          content: userMessage
        }
      ];
    } else {
      return res.status(400).json({ error: 'Invalid message' });
    }

  const response = await anthropic.messages.create({
 model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: selectedSystemPrompt,
  messages: claudeMessages
});

    const reply =
      response.content?.[0]?.type === 'text'
        ? response.content[0].text
        : 'I appreciate you sharing. Let me help you with that.';

    res.json({
      reply,
      type,
   model: 'claude-haiku-4-5-20251001'
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error.message
    });
  }
});

app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long, max 5000 characters' });
    }

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

    const audioBuffer = await elevenLabsResponse.arrayBuffer();
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

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

module.exports = app;
