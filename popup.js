// YouTube Custom Speed Control - Popup Script

const PRESET_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 5, 10];
let currentSpeed = 1.0;
let isYouTubeTab = false;

// DOM Elements
const currentSpeedEl = document.getElementById('currentSpeed');
const speedSlider = document.getElementById('speedSlider');
const errorMessageEl = document.getElementById('errorMessage');
const resetBtn = document.getElementById('resetBtn');
const presetButtons = document.querySelectorAll('.preset-btn');

// Check if current tab is YouTube
async function checkYouTubeTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
      isYouTubeTab = true;
      errorMessageEl.classList.remove('show');
      return tab;
    } else {
      isYouTubeTab = false;
      errorMessageEl.classList.add('show');
      return null;
    }
  } catch (error) {
    console.error('Error checking tab:', error);
    return null;
  }
}

// Get current speed from content script
async function getCurrentSpeed() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) return;
    
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getSpeed' 
    });
    
    if (response && response.currentSpeed) {
      currentSpeed = response.currentSpeed;
      updateDisplay(currentSpeed);
    }
  } catch (error) {
    // If content script not loaded, try to get from storage
    try {
      const result = await chrome.storage.local.get(['playbackSpeed']);
      if (result.playbackSpeed) {
        currentSpeed = result.playbackSpeed;
        updateDisplay(currentSpeed);
      }
    } catch (storageError) {
      console.error('Error loading speed:', storageError);
    }
  }
}

// Send speed change to content script
async function setSpeed(speed) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      // Still update display and save to storage
      currentSpeed = speed;
      updateDisplay(currentSpeed);
      await chrome.storage.local.set({ playbackSpeed: speed });
      return;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'setSpeed',
        speed: speed
      });
      
      if (response && response.success) {
        currentSpeed = response.currentSpeed;
        updateDisplay(currentSpeed);
        return;
      }
    } catch (messageError) {
      console.log('Content script not responding, saving to storage:', messageError);
    }
    
    // If message fails, still update display and save to storage
    // The content script will pick it up when it loads
    currentSpeed = speed;
    updateDisplay(currentSpeed);
    await chrome.storage.local.set({ playbackSpeed: speed });
  } catch (error) {
    console.error('Error setting speed:', error);
    // Still update display and save to storage
    currentSpeed = speed;
    updateDisplay(currentSpeed);
    try {
      await chrome.storage.local.set({ playbackSpeed: speed });
    } catch (storageError) {
      console.error('Error saving to storage:', storageError);
    }
  }
}

// Update display with current speed
function updateDisplay(speed) {
  currentSpeedEl.textContent = `${speed.toFixed(1)}x`;
  speedSlider.value = speed;
  updateActivePreset(speed);
  updateSliderTooltip(speed);
}

// Update slider tooltip
function updateSliderTooltip(speed) {
  const tooltip = document.getElementById('sliderTooltip');
  if (!tooltip) return;
  
  tooltip.textContent = `${speed.toFixed(1)}x`;
  
  // Calculate position based on slider value
  const percent = ((speed - 0.2) / (10.0 - 0.2)) * 100;
  const thumbWidth = 18;
  const offset = (thumbWidth / 2) * (1 - 2 * percent / 100);
  tooltip.style.left = `calc(${percent}% + ${offset}px)`;
}

// Update active preset button
function updateActivePreset(speed) {
  presetButtons.forEach(btn => {
    const btnSpeed = parseFloat(btn.dataset.speed);
    if (Math.abs(btnSpeed - speed) < 0.01) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Event Listeners

// Preset buttons
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const speed = parseFloat(btn.dataset.speed);
    setSpeed(speed);
  });
});

// Slider
const sliderTooltip = document.getElementById('sliderTooltip');

speedSlider.addEventListener('input', (e) => {
  const speed = parseFloat(e.target.value);
  setSpeed(speed);
});

speedSlider.addEventListener('mouseenter', () => {
  sliderTooltip.style.opacity = '1';
  sliderTooltip.style.visibility = 'visible';
});

speedSlider.addEventListener('mouseleave', () => {
  sliderTooltip.style.opacity = '0';
  sliderTooltip.style.visibility = 'hidden';
});

speedSlider.addEventListener('mousemove', () => {
  updateSliderTooltip(currentSpeed);
});

// Reset button
resetBtn.addEventListener('click', () => {
  setSpeed(1.0);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (!isYouTubeTab) return;
  
  // Arrow keys to adjust speed
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const newSpeed = Math.min(10.0, currentSpeed + 0.2);
    setSpeed(parseFloat(newSpeed.toFixed(1)));
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const newSpeed = Math.max(0.2, currentSpeed - 0.2);
    setSpeed(parseFloat(newSpeed.toFixed(1)));
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    setSpeed(1.0);
  }
  
  // Number keys for presets
  const numKey = parseInt(e.key);
  if (numKey >= 1 && numKey <= PRESET_SPEEDS.length) {
    e.preventDefault();
    setSpeed(PRESET_SPEEDS[numKey - 1]);
  }
});

// Initialize popup
(async function init() {
  await checkYouTubeTab();
  
  if (isYouTubeTab) {
    await getCurrentSpeed();
  } else {
    // Still load from storage to show last used speed
    try {
      const result = await chrome.storage.local.get(['playbackSpeed']);
      if (result.playbackSpeed) {
        currentSpeed = result.playbackSpeed;
        updateDisplay(currentSpeed);
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
  }
})();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.playbackSpeed) {
    currentSpeed = changes.playbackSpeed.newValue;
    updateDisplay(currentSpeed);
  }
});

