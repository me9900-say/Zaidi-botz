const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const P = require('pino');

const SESSION_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// Store active pairing sockets so we can clean them up
const pairingSockets = new Map();

router.get('/', async (req, res) => {
    let { number } = req.query;
    if (!number) return res.status(400).json({ code: 'Please provide a number' });

    number = number.replace(/[^0-9]/g, '');
    if (number.length < 10) return res.status(400).json({ code: 'Invalid number' });

    // Clean up any existing pairing socket for this number
    if (pairingSockets.has(number)) {
        try { pairingSockets.get(number).ws.close(); } catch (e) {}
        pairingSockets.delete(number);
    }

    // Use a temp session folder for pairing, separate from main session
    const tempDir = path.join(SESSION_DIR, `tmp_${number}`);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Safari'),
            logger: P({ level: 'silent' })
        });

        pairingSockets.set(number, sock);

        // Request pairing code
        await new Promise(r => setTimeout(r, 3000));

        let code;
        try {
            code = await sock.requestPairingCode(number);
            code = code?.match(/.{1,4}/g)?.join('-') || code;
        } catch (err) {
            console.error('Pairing code error:', err.message);
            return res.status(500).json({ code: 'Failed to get pairing code. Try again.' });
        }

        // Listen for successful connection to save creds to main session
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                try {
                    // Copy session files to main sessions folder
                    const files = fs.readdirSync(tempDir);
                    for (const file of files) {
                        fs.copyFileSync(
                            path.join(tempDir, file),
                            path.join(SESSION_DIR, file)
                        );
                    }
                    console.log(`✅ Session saved for ${number}. Starting bot...`);

                    // Clean up temp dir
                    try {
                        files.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
                        fs.rmdirSync(tempDir);
                    } catch (e) {}

                    // Close pairing socket
                    pairingSockets.delete(number);

                    // Start the main bot connection
                    const { connectToWA } = require('./index');
                    setTimeout(() => connectToWA().catch(console.error), 2000);

                } catch (err) {
                    console.error('Error saving session:', err.message);
                }
            } else if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    // Cleanup on unexpected close during pairing
                }
                pairingSockets.delete(number);
                try {
                    const files = fs.readdirSync(tempDir);
                    files.forEach(f => { try { fs.unlinkSync(path.join(tempDir, f)); } catch (e) {} });
                    fs.rmdirSync(tempDir);
                } catch (e) {}
            }
        });

        res.json({ code });

    } catch (err) {
        console.error('Pair error:', err.message);
        // Cleanup
        try {
            const files = fs.readdirSync(tempDir);
            files.forEach(f => { try { fs.unlinkSync(path.join(tempDir, f)); } catch (e) {} });
            fs.rmdirSync(tempDir);
        } catch (e) {}
        res.status(500).json({ code: 'Service Unavailable. Try again.' });
    }
});

module.exports = router;
