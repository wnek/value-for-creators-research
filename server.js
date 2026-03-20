require('dotenv').config();
const express = require('express');
const { RunwayML } = require('@runwayml/sdk');
const path = require('path');

const app = express();
const PORT = 3000;

const client = new RunwayML(); // uses RUNWAYML_API_SECRET env var

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/avatar/connect', async (req, res) => {
  const { avatarId } = req.body;

  try {
    const { id: sessionId } = await client.realtimeSessions.create({
      model: 'gwm1_avatars',
      avatar: { type: 'custom', avatarId: avatarId },
    });

    const deadline = Date.now() + 30_000;
    let sessionKey;
    while (Date.now() < deadline) {
      const session = await client.realtimeSessions.retrieve(sessionId);
      if (session.status === 'READY') {
        sessionKey = session.sessionKey;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!sessionKey) {
      return res.status(504).json({ error: 'Session creation timed out' });
    }

    // Consume the session to get LiveKit credentials
    const consumeRes = await fetch(
      `https://api.dev.runwayml.com/v1/realtime_sessions/${sessionId}/consume`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionKey}`,
        },
      }
    );

    if (!consumeRes.ok) {
      const err = await consumeRes.text();
      return res.status(consumeRes.status).json({ error: err });
    }

    const { url, token, roomName } = await consumeRes.json();
    res.json({ sessionId, serverUrl: url, token, roomName });
  } catch (err) {
    console.error('Avatar session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
