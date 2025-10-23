# YouTube Custom Speed Control

A Chrome extension that adds custom playback speed controls to YouTube, allowing speeds from 0.2x up to 10x.

## Features

✨ **Custom Speed Button** - Adds a button directly in the YouTube player controls
🎯 **Organized Presets** - 12 speeds grouped into 3 clear categories (Slow, Normal, Fast)
📊 **Smart Layout** - Visual hierarchy makes finding the right speed instant
🎚️ **Visual Slider** - Color-filled slider for precise control (0.2x to 10x)
💾 **Persistent Settings** - Your speed preference is saved and auto-applied
🔄 **Smart Detection** - Automatically reapplies speed after ads and video changes
📱 **Fully Responsive** - Adapts to any screen size, even small mobile views
🎨 **YouTube-Styled UI** - Seamlessly matches YouTube's dark theme
⌨️ **Keyboard Accessible** - Full keyboard navigation support
🔌 **Popup Fallback** - Alternative control panel in the extension popup
🎬 **Playlist Support** - Persists across playlist navigation and fresh browser loads

## Installation

### Option 1: Install from Chrome Web Store
*(Coming soon)*

### Option 2: Install as Unpacked Extension (Development)

1. **Load the Extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the extension folder

2. **Start Using**
   - Go to any YouTube video
   - Look for the speed control button (double arrow icon) in the player controls
   - Click it to open the speed panel, or use the extension popup

## Usage

### In-Player Controls

1. **Access the Panel**: Click the speed button (⏩) next to the settings button in the YouTube player
2. **Choose Your Speed**: Select from organized categories:
   - **Slow** (0.25x, 0.5x, 0.75x): For learning, complex content
   - **Normal** (1x, 1.25x, 1.5x, 1.75x, 2x): Standard YouTube speeds
   - **Fast** (3x, 4x, 5x, 10x): Power user speeds
3. **Custom Speed**: Use the color-filled slider for precise control (0.2x to 10x in 0.2x steps)
   - The blue fill shows your speed intensity visually
   - Drag the knob or click anywhere on the track
4. **Current Speed**: Always displayed at the top of the panel
5. **Reset**: Click "Reset to 1x" button or press 'R' key
6. **Close Panel**: Click outside, press Escape, or click the X button

### Popup Controls

1. Click the extension icon in your browser toolbar
2. Use the same controls as the in-player panel
3. Keyboard shortcuts available:
   - **Arrow Up/Down**: Adjust speed by ±0.2x
   - **R**: Reset to 1x
   - **Number keys**: Quick access to first 9 presets

## Features in Detail

### Persistent Speed
- Your selected speed is automatically saved
- Speed persists across:
  - Different videos
  - Browser sessions
  - Tab navigation
  - Playlist playback

### Ad Handling
- The extension automatically detects when YouTube resets the speed (e.g., after ads)
- Your custom speed is instantly reapplied

### DOM Observer
- Monitors YouTube's dynamic page updates
- Automatically re-injects controls when needed
- Works with YouTube's Single Page Application navigation
- Listens for YouTube's custom navigation events (`yt-navigate-finish`)
- Handles playlists, fresh loads, and random player rebuilds

### Fullscreen Support
- Panel automatically repositions in fullscreen mode
- All controls remain accessible

### Responsive Design
- **Dynamic sizing**: Panel adapts to player dimensions in real-time
- **Mobile-friendly**: Works on small screens with adjusted layouts
- **Smart positioning**: Automatically positions above progress bar
- **Flexible grids**: Button layouts adapt to available space
- **Readable text**: Font sizes adjust for smaller screens

## File Structure

```
chrome-youtube-extension/
├── manifest.json          # Extension configuration
├── content.js            # YouTube page integration
├── content.css           # Styling for in-player controls
├── popup.html            # Extension popup interface
├── popup.js              # Popup logic
├── icons/
│   ├── speed-icon.svg   # SVG icon for in-player button
│   ├── icon.svg         # Extension icon (SVG source)
│   └── icon.png         # Extension icon (PNG)
├── plan.md              # Original feature plan
└── README.md            # This file
```

## Technical Details

- **Manifest Version**: 3 (MV3)
- **Permissions**: 
  - `storage` - Save speed preferences
  - `scripting` - Inject controls into YouTube
- **Host Permissions**: `https://www.youtube.com/*`
- **Compatible With**: Chrome, Edge, and other Chromium-based browsers

## Troubleshooting

### Button doesn't appear
- **New YouTube UI**: If you just updated to the latest YouTube version, make sure you're using extension version 1.3.1 or later
- **Most common fix**: Refresh the YouTube page - the extension should auto-inject within 1-2 seconds
- Check if the extension is enabled in `chrome://extensions/`
- Make sure you're on a YouTube video page (not homepage or search results)
- Wait a few seconds - the extension retries injection automatically
- If on a playlist, try navigating to the next video
- **Last resort**: Reload the extension in `chrome://extensions/` (click the refresh icon)

### Speed resets after ads
- The extension should automatically reapply your speed within 1 second
- If it doesn't, the extension monitors every second and will reapply
- Avoid dragging the slider during ad playback

### Slider jumps or acts erratically
- This has been fixed in the latest version
- If you still experience issues, reload the extension
- Make sure you're using the latest version

### Panel gets cut off on small screens
- The panel automatically resizes based on player dimensions
- If cut off, try resizing your browser window - it should adapt
- On very small screens (< 380px), the panel uses full width

### Controls look wrong
- Clear your browser cache and reload YouTube
- Disable other YouTube-modifying extensions that might conflict
- Try updating Chrome to the latest version
- Check if YouTube's interface has been updated (report as an issue)

## Privacy

This extension:
- ✅ Only runs on YouTube.com
- ✅ Stores preferences locally on your device
- ✅ Does not collect or transmit any data
- ✅ Does not require any personal information
- ✅ Does not track your viewing habits

## Development

### Building from Source
1. Clone the repository
2. Load as unpacked extension in Chrome

### Making Changes
- `content.js` - Modify YouTube page integration
- `content.css` - Adjust in-player styling
- `popup.html/popup.js` - Modify popup interface
- `manifest.json` - Update permissions or configuration

## Recent Improvements (Latest Version)

### Version 1.3.1 - YouTube UI Compatibility Update
✅ **Updated for new YouTube UI** - Fixed button not appearing after recent YouTube player updates  
✅ **Enhanced selector fallbacks** - Multiple fallback selectors ensure compatibility with UI changes  
✅ **More resilient injection** - Improved detection of player controls across different YouTube versions  
✅ **Better reliability** - Works with both old and new YouTube player structures  

### Previous Improvements
✅ **Fixed slider glitch** - No more erratic jumping or uncontrollable slider behavior  
✅ **Visual slider feedback** - Blue color fill shows speed intensity  
✅ **Fully responsive** - Adapts to any screen size automatically  
✅ **Better navigation** - Works consistently across playlists, fresh loads, and page changes  
✅ **Debounced saving** - Smooth slider performance without lag  
✅ **Smart positioning** - Panel never overlaps the progress bar  

## Future Enhancements

Potential features for future versions:
- More preset slots (customizable)
- Speed memory per channel/video
- Keyboard shortcuts for in-player controls (increase/decrease with hotkeys)
- Speed increment customization
- Dark/light theme toggle
- Per-video speed profiles

## License

MIT License - Feel free to use, modify, and distribute.

## Credits

Created with ❤️ for YouTube power users who want more control over playback speed.

## Support

If you encounter any issues or have suggestions:
1. Check the Troubleshooting section
2. Review existing issues on GitHub
3. Open a new issue with details about your problem

---

**Enjoy watching YouTube at your own pace! 🚀**

# YoutubePlayBackSpeedExtension
