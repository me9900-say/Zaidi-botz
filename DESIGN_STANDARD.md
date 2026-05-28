# Bot Response Design Standard

All bot responses must follow this format for consistency:

## Standard Text Response
```
*BOT_NAME*
━━━━━━━━━━━━━━━━━━
Field: Value
Field: Value
━━━━━━━━━━━━━━━━━━
> Footer / description
```

## Success Response
```
✅ *Action done*
Details here
> Powered by BOT_NAME
```

## Error Response
```
❌ Error message
Usage: .command <args>
```

## Rules
- Use *bold* for labels and section titles
- Use ━━━ as the divider (not ┃, ║, or fancy boxes)
- Always end with `> DESCRIPTION` footer
- No complex Unicode box art (they break on some devices)
- Keep messages short and readable
- Emoji at start of line for status: ✅ ❌ ⚡ 👑
