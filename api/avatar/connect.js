const { RunwayML } = require('@runwayml/sdk');

const client = new RunwayML(); // uses RUNWAYML_API_SECRET env var

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
};
