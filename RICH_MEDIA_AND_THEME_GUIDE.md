# Rich Media Notes & Theme Toggle - Implementation Guide

## ✨ New Features Added

### 1. **Dark Mode / Theme Toggle** 🌙☀️
A beautiful theme toggle button has been added to the header navigation that allows users to switch between light and dark modes.

**How it works:**
- Click the moon (🌙) icon to switch to dark mode
- Click the sun (☀️) icon to switch back to light mode
- Your preference is saved in `localStorage` and persists across sessions
- The theme automatically respects your system preference on first visit

**Changes made:**
- Updated `src/components/Header.jsx` to add theme toggle state and persistence
- Modified `src/index.css` to define dark mode color variables:
  - Canvas: `#0f0f0f` (dark background)
  - Ink: `#e8e8e8` (light text)
  - Muted: `#999999` (secondary text)
  - Line: `#333333` (borders)
  - Paper: `#1a1a18` (secondary backgrounds)
  - Danger: `#dd6b6b` (error/alert color)
- All transitions are smooth (200ms) for a polished experience

### 2. **Rich Media Support** 🎬🎵📸

The note editor now supports embedding content from multiple platforms:

#### **Video Platforms:**
- **YouTube** - Full support for regular videos, shorts, and live streams
  - Use standard YouTube URLs: `https://www.youtube.com/watch?v=...`
  - Short URLs: `https://youtu.be/...`
  - Shorts: `https://www.youtube.com/shorts/...`
- **Vimeo** - Privacy-focused video hosting
  - Use standard Vimeo URLs: `https://vimeo.com/...`
- **Instagram** - Reels and single posts
  - Use Instagram post/reel URLs: `https://instagram.com/p/...` or `https://instagram.com/reel/...`

#### **Audio Platforms:**
- **Spotify** - Tracks, albums, playlists, episodes, and shows
  - Use Spotify share links: `https://open.spotify.com/track/...`
- **SoundCloud** - Any SoundCloud track
  - Use SoundCloud track URLs: `https://soundcloud.com/artist/track`
- **Bandcamp** - Music artist pages
  - Use Bandcamp track/album URLs: `https://bandcamp.com/...`

#### **Image & Media:**
- **Photos** - Upload directly or link to external images
  - Add descriptions/captions to photos
  - Browse gallery with arrow keys in fullscreen viewer
- **Links** - Any HTTP/HTTPS URL
  - Add custom titles to links
  - Automatic domain detection

### 3. **Long-Form Content Support** 📖
The text editor already supports:
- Long stories and narratives
- Multiple paragraphs
- Auto-expanding textarea (grows as you type)
- Combinations of text + media in a single note

### 4. **Flexible Note Composition** 🎨
Create rich, multimedia notes by combining:
- Text stories
- YouTube/Vimeo videos
- Spotify/SoundCloud/Bandcamp audio
- Instagram posts/reels
- Photos with captions
- External links
- All in a single note!

## 🎯 How to Use

### Adding a Note with Rich Media:

1. **Open The Journal** - Click "The journal" in the header
2. **Write Your Story** - Type your narrative or thoughts in the text area
3. **Add Media** - Use the toolbar to:
   - **Upload Photos** - Click the image icon to upload from your device
   - **Add Links/Embeds** - Click the link icon and paste a URL from:
     - YouTube
     - Spotify
     - Instagram
     - Vimeo
     - SoundCloud
     - Bandcamp
     - Any website

4. **Add Multiple Items** - You can add up to 8 attachments per note
5. **Set Privacy** - Choose whether the note is public or private
6. **Set Mood** - Pick your mood for that day
7. **Submit** - Click "Keep" to save your note

### Switching Themes:

Simply click the **🌙 or ☀️** button in the header navigation to toggle between light and dark modes. Your preference will be remembered!

## 🔒 Privacy-First Embedding

All embeds are **privacy-first**:
- Embeds are NOT loaded until you click on them
- A preview button shows what will be loaded
- External services (YouTube, Spotify, Instagram, etc.) only connect when you explicitly choose to load them
- No tracking cookies are sent until you interact with the embed

## 📝 Examples

### Example 1: A Music Discovery Note
```
Title: Discovered this amazing track today!
Text: Found this song while walking through the market. It perfectly captures the essence of...
Audio Embed: https://open.spotify.com/track/...
```

### Example 2: A Visual Story
```
Text: My day at the beach
Photos: [3 photos with captions]
Instagram Post: https://instagram.com/p/...
```

### Example 3: A Mixed Media Note
```
Text: A whole story about watching this film...
Video: https://www.youtube.com/watch?v=...
Link: https://example.com/article-about-film
Photos: [behind the scenes photos]
```

## 🎨 Technical Implementation Details

### New/Modified Files:
1. **src/components/Header.jsx** - Added theme toggle state and localStorage persistence
2. **src/index.css** - Added dark mode variables and theme-aware styling
3. **shared/attachments.js** - Extended `getEmbed()` to support Instagram, Bandcamp
4. **src/components/NoteMedia.jsx** - Enhanced to handle Instagram blockquotes properly

### CSS Variables (Light Mode Default):
```css
--color-canvas: #ffffff    /* Main background */
--color-ink: #191919       /* Main text */
--color-muted: #626262     /* Secondary text */
--color-line: #d6d6d6      /* Borders */
--color-paper: #f5f5f3     /* Secondary backgrounds */
--color-danger: #922f2f    /* Error colors */
```

### CSS Variables (Dark Mode):
```css
--color-canvas: #0f0f0f    /* Main background */
--color-ink: #e8e8e8       /* Main text */
--color-muted: #999999     /* Secondary text */
--color-line: #333333      /* Borders */
--color-paper: #1a1a18     /* Secondary backgrounds */
--color-danger: #dd6b6b    /* Error colors */
```

## ✅ What You Can Do Now

✨ **Before these updates**, the site was limited to:
- Black and white design only
- Text and static images only

🎉 **Now you can:**
- ✅ Use beautiful dark mode
- ✅ Embed YouTube videos
- ✅ Embed Spotify tracks, albums, playlists
- ✅ Embed Instagram posts and reels
- ✅ Embed SoundCloud tracks
- ✅ Embed Bandcamp music
- ✅ Embed Vimeo videos
- ✅ Upload and display images with captions
- ✅ Add custom link titles
- ✅ Combine all of the above in a single note
- ✅ Write long-form stories
- ✅ Privacy-first embeds (nothing loads until you click)
- ✅ Persistent theme preference

## 🚀 Next Steps (Optional Enhancements)

Future improvements could include:
- Twitter/X embed support
- TikTok embed support
- Custom color themes
- Theme scheduling (auto-switch at sunset)
- Embed lazy-loading optimization
- Audio upload support
- Video upload support

---

**Enjoy creating rich, beautiful journal entries!** 📔✨
