# Quick Reference: Rich Media & Theme Toggle

## 🌙 Theme Toggle
- **Location:** Header navigation (between journal link and auth button)
- **Icon:** 🌙 (dark mode) or ☀️ (light mode)
- **Storage:** Automatically saved in browser
- **System Preference:** Respects your OS theme on first visit

## 📱 Supported Embeds

### Video
| Platform | Example URL | Notes |
|----------|------------|-------|
| YouTube | `youtube.com/watch?v=...` | Also supports youtu.be and shorts |
| Vimeo | `vimeo.com/...` | Private option available |
| Instagram | `instagram.com/p/...` | Posts and reels |

### Audio
| Platform | Example URL | Notes |
|----------|------------|-------|
| Spotify | `open.spotify.com/track/...` | Tracks, albums, playlists |
| SoundCloud | `soundcloud.com/artist/track` | Any public track |
| Bandcamp | `bandcamp.com/track/...` | Tracks and albums |

### Media
| Type | How to Add | Features |
|------|-----------|----------|
| Photos | Click 📷 icon | Add captions, fullscreen viewer |
| Links | Click 🔗 icon, paste URL | Auto-detects domain |

## 🔐 Privacy
✓ No tracking until you click "Load"
✓ Embeds don't connect until explicitly enabled
✓ Safe for private notes

## 📊 Limits
- Max 8 attachments per note
- Max 200 characters for link titles
- Max 500 characters for photo captions

## 🎨 How Themes Work

### Light Mode (Default)
- Clean white background
- Dark text for readability
- Light gray accents
- Perfect for daytime use

### Dark Mode
- Dark background (#0f0f0f)
- Light text for eye comfort
- Perfect for nighttime reading
- Smooth transitions between themes

## ✅ Tested Embed Sources
- ✅ YouTube (all video types)
- ✅ Vimeo
- ✅ Instagram (posts & reels)
- ✅ Spotify
- ✅ SoundCloud
- ✅ Bandcamp
- ✅ Direct image URLs
- ✅ Generic web links

## ⚙️ Technical Notes
- Theme state stored in `localStorage` under key `theme`
- CSS uses CSS custom properties (variables) for easy theming
- Embeds use `iframe` with sandbox for security
- Instagram uses `blockquote` with async script injection
- All styles transition smoothly (200ms)

---

**Happy journaling with colors and rich media!** 🎨📔
