/**
 * MENU PLUGIN - Fixed event listener leak
 * Uses a global handler map instead of per-call listeners
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { cmd, commands } = require('../command');
const { runtime } = require('../lib/functions');
const os = require('os');

const CATEGORY_MAP = {
    'ai':           { section: 'ai' },
    'ai-tools':     { section: 'ai' },
    'download':     { section: 'download' },
    'downloader':   { section: 'download' },
    'audio':        { section: 'download' },
    'media':        { section: 'download' },
    'group':        { section: 'group' },
    'admin':        { section: 'group' },
    'security':     { section: 'group' },
    'fun':          { section: 'fun' },
    'owner':        { section: 'owner' },
    'image':        { section: 'image' },
    'image-tools':  { section: 'image' },
    'img_edit':     { section: 'image' },
    'sticker':      { section: 'image' },
    'maker':        { section: 'image' },
    'logo':         { section: 'image' },
    'wallpapers':   { section: 'image' },
    'anime':        { section: 'anime' },
    'tools':        { section: 'tools' },
    'convert':      { section: 'tools' },
    'converter':    { section: 'tools' },
    'utilities':    { section: 'tools' },
    'utility':      { section: 'tools' },
    'main':         { section: 'main' },
    'info':         { section: 'main' },
    'information':  { section: 'main' },
    'other':        { section: 'other' },
    'misc':         { section: 'other' },
    'privacy':      { section: 'other' },
    'whatsapp':     { section: 'other' },
    'settings':     { section: 'other' },
    'news':         { section: 'other' },
    'search':       { section: 'other' },
    'stalker':      { section: 'other' },
    'env':          { section: 'other' },
    'menu':         { section: 'skip' },
    'menu3':        { section: 'skip' },
};

const SECTION_ORDER = ['main','download','group','fun','owner','ai','image','anime','tools','other','new'];

const SECTION_META = {
    main:     { emoji: '🏠', label: 'MAIN' },
    download: { emoji: '📥', label: 'DOWNLOAD' },
    group:    { emoji: '👥', label: 'GROUP' },
    fun:      { emoji: '😄', label: 'FUN' },
    owner:    { emoji: '👑', label: 'OWNER' },
    ai:       { emoji: '🤖', label: 'AI TOOLS' },
    image:    { emoji: '🖼️', label: 'IMAGE/STICKER' },
    anime:    { emoji: '🎎', label: 'ANIME' },
    tools:    { emoji: '🛠️', label: 'TOOLS' },
    other:    { emoji: '📌', label: 'OTHER' },
    new:      { emoji: '⚡', label: 'ALL COMMANDS' },
};

// Cache the command map so we don't re-read plugin files on every .menu call
let _cachedSections = null;
let _cacheTime = 0;
const CACHE_TTL = 60000; // rebuild every 60s

function buildCommandMap() {
    if (_cachedSections && Date.now() - _cacheTime < CACHE_TTL) return _cachedSections;

    const pluginsDir = path.join(__dirname);
    const sections = {};
    const addTo = (section, pattern) => {
        if (!sections[section]) sections[section] = [];
        if (!sections[section].includes(pattern)) sections[section].push(pattern);
    };

    let files;
    try { files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js')); } catch (e) { return sections; }

    for (const file of files) {
        let src;
        try { src = fs.readFileSync(path.join(pluginsDir, file), 'utf-8'); } catch { continue; }
        const cmdBlockRegex = /cmd\s*\(\s*\{([\s\S]*?)\}\s*,/g;
        let blockMatch;
        while ((blockMatch = cmdBlockRegex.exec(src)) !== null) {
            const block = blockMatch[1];
            const patMatch = block.match(/pattern\s*:\s*['"`]([^'"`]+)['"`]/);
            if (!patMatch) continue;
            const pattern = patMatch[1].trim();
            const catMatch = block.match(/category\s*:\s*['"`]([^'"`]+)['"`]/);
            const rawCat = catMatch ? catMatch[1].trim().toLowerCase() : '';
            const mapped = CATEGORY_MAP[rawCat];
            if (mapped) {
                if (mapped.section !== 'skip') addTo(mapped.section, pattern);
            } else {
                addTo('new', pattern);
            }
        }
    }

    _cachedSections = sections;
    _cacheTime = Date.now();
    return sections;
}

function buildFullMenu(sections, botName, ownerName, prefix, mode, uptime, ramUsed) {
    const total = Object.values(sections).reduce((a, b) => a + b.length, 0);
    const ordered = SECTION_ORDER.filter(k => sections[k]?.length > 0);
    const numEmojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

    let text = `*${botName}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Owner: ${ownerName}\n`;
    text += `Prefix: ${prefix} | Mode: ${mode}\n`;
    text += `Uptime: ${uptime}\n`;
    text += `RAM: ${ramUsed} MB | Commands: ${total}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `*Menu Sections*\n`;
    text += `────────────────────\n`;
    ordered.forEach((k, i) => {
        const meta = SECTION_META[k];
        text += `${numEmojis[i] || '🔹'} ${meta.emoji} ${meta.label} [${sections[k].length}]\n`;
    });
    text += `────────────────────\n`;
    text += `_Reply with a number to view commands_\n\n`;

    ordered.forEach(k => {
        const meta = SECTION_META[k];
        text += `*${meta.emoji} ${meta.label}*\n`;
        text += `────────────────────\n`;
        sections[k].forEach(c => { text += `• ${prefix}${c}\n`; });
        text += `\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `> ${config.DESCRIPTION || 'Powered by ' + botName}`;
    return text;
}

function buildSubMenu(sectionKey, cmds, botName, prefix) {
    const meta = SECTION_META[sectionKey] || { emoji: '🔹', label: sectionKey.toUpperCase() };
    let text = `*${botName}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*${meta.emoji} ${meta.label}*\n`;
    text += `Commands: ${cmds.length}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    cmds.forEach(c => { text += `• ${prefix}${c}\n`; });
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `> ${config.DESCRIPTION || 'Powered by ' + botName}`;
    return text;
}

// ── GLOBAL session map (fixes the listener leak) ──
// Key: messageID, Value: { sections, orderedSections, botName, ownerName, prefix, from, expiry }
const menuSessions = new Map();

// ONE global handler registered once at module load
// (The real conn is available when this handler runs because it's imported later)
function setupGlobalMenuHandler(conn) {
    conn.ev.on('messages.upsert', async (msgData) => {
        try {
            if (menuSessions.size === 0) return;

            const receivedMsg = msgData.messages[0];
            if (!receivedMsg?.message || !receivedMsg.key?.remoteJid) return;

            const stanzaId = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId;
            if (!stanzaId || !menuSessions.has(stanzaId)) return;

            const session = menuSessions.get(stanzaId);
            if (Date.now() > session.expiry) {
                menuSessions.delete(stanzaId);
                return;
            }

            const receivedText = (
                receivedMsg.message.conversation ||
                receivedMsg.message.extendedTextMessage?.text || ''
            ).trim();

            const numToSection = {};
            session.orderedSections.forEach((k, i) => { numToSection[String(i + 1)] = k; });
            const sectionKey = numToSection[receivedText];

            if (sectionKey && session.sections[sectionKey]) {
                const subText = buildSubMenu(sectionKey, session.sections[sectionKey], session.botName, session.prefix);
                const senderID = receivedMsg.key.remoteJid;
                try {
                    if (session.imageUrl) {
                        await conn.sendMessage(senderID, {
                            image: { url: session.imageUrl },
                            caption: subText,
                        }, { quoted: receivedMsg });
                    } else {
                        await conn.sendMessage(senderID, { text: subText }, { quoted: receivedMsg });
                    }
                } catch {
                    await conn.sendMessage(senderID, { text: subText }, { quoted: receivedMsg });
                }
                conn.sendMessage(senderID, { react: { text: '✅', key: receivedMsg.key } }).catch(() => {});
            }
        } catch (e) {}
    });
}

let globalHandlerSetup = false;

cmd({
    pattern: "menu",
    alias: ["amenu", "help"],
    desc: "Show bot command menu",
    category: "menu",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        // Setup global handler once
        if (!globalHandlerSetup) {
            setupGlobalMenuHandler(conn);
            globalHandlerSetup = true;
        }

        const uptime    = runtime(process.uptime());
        const ramUsed   = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const botName   = config.BOT_NAME   || 'BOT';
        const ownerName = config.OWNER_NAME || 'Owner';
        const prefix    = config.PREFIX     || '.';
        const mode      = config.MODE       || 'public';

        const sections = buildCommandMap();
        const orderedSections = SECTION_ORDER.filter(k => sections[k]?.length > 0);
        const menuText = buildFullMenu(sections, botName, ownerName, prefix, mode, uptime, ramUsed);

        const imageUrl = config.MENU_IMAGE_URL || null;

        let sentMsg;
        try {
            if (imageUrl) {
                sentMsg = await conn.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: menuText,
                }, { quoted: mek });
            } else {
                sentMsg = await conn.sendMessage(from, { text: menuText }, { quoted: mek });
            }
        } catch (e) {
            sentMsg = await conn.sendMessage(from, { text: menuText }, { quoted: mek });
        }

        // Register session (auto-expires in 5 minutes)
        menuSessions.set(sentMsg.key.id, {
            sections,
            orderedSections,
            botName,
            ownerName,
            prefix,
            imageUrl,
            from,
            expiry: Date.now() + 300000
        });

        // Clean up expired sessions
        setTimeout(() => menuSessions.delete(sentMsg.key.id), 300000);

    } catch (e) {
        console.error('[Menu Error]:', e.message);
        reply('Error loading menu. Please try again.');
    }
});

cmd({
    pattern: "setmenuvideo",
    alias: ["vidmenu"],
    use: '.setmenuvideo <url>',
    desc: "Set menu video URL (owner only)",
    category: "owner",
    react: "🎥",
    filename: __filename
}, async (conn, mek, m, { args, isOwner, reply }) => {
    if (!isOwner) return reply("Owner only command.");
    const url = args[0];
    if (!url) return reply("Usage: .setmenuvideo <url>");
    config.MENU_VIDEO_URL = url;
    reply(`Menu video set.\nURL: ${url}`);
});

cmd({
    pattern: "setmenuimage",
    alias: ["imgmenu"],
    use: '.setmenuimage <url>',
    desc: "Set menu image URL (owner only)",
    category: "owner",
    react: "🖼️",
    filename: __filename
}, async (conn, mek, m, { args, isOwner, reply }) => {
    if (!isOwner) return reply("Owner only command.");
    const url = args[0];
    if (!url) return reply("Usage: .setmenuimage <url>");
    config.MENU_IMAGE_URL = url;
    reply(`Menu image set.\nURL: ${url}`);
});
