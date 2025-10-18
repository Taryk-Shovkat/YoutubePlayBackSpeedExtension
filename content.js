// YouTube Custom Speed Control - Content Script

const PRESET_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 5, 10];
const MIN_SPEED = 0.2;
const MAX_SPEED = 10.0;
const SPEED_STEP = 0.2;

let currentSpeed = 1.0;
let speedPanel = null;
let speedButton = null;
let observer = null;
let isSliderActive = false; // Flag to prevent interference while using slider
let saveSpeedTimeout = null; // Debounce timer for saving speed

// Load saved speed from storage
async function loadSavedSpeed() {
  try {
    const result = await chrome.storage.local.get(['playbackSpeed']);
    if (result.playbackSpeed) {
      currentSpeed = result.playbackSpeed;
    }
  } catch (error) {
    console.error('Error loading saved speed:', error);
  }
}

// Save speed to storage
function saveSpeed(speed) {
  // Validate speed value
  if (typeof speed !== 'number' || isNaN(speed) || speed < MIN_SPEED || speed > MAX_SPEED) {
    console.warn('Invalid speed value:', speed);
    return;
  }
  
  if (!chrome.storage || !chrome.storage.local) {
    console.warn('Chrome storage API not available');
    return;
  }
  
  chrome.storage.local.set({ playbackSpeed: speed }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving speed:', chrome.runtime.lastError);
    } else {
      // Optional: log success for debugging
      // console.log('Speed saved:', speed);
    }
  });
}

// Apply speed to video element
function applySpeed(speed, skipSave = false) {
  const video = document.querySelector('video');
  if (video) {
    video.playbackRate = speed;
    currentSpeed = speed;
    if (!skipSave) {
      // Debounce saving to prevent rapid saves during slider movement
      if (saveSpeedTimeout) {
        clearTimeout(saveSpeedTimeout);
      }
      saveSpeedTimeout = setTimeout(() => {
        saveSpeed(speed);
      }, 300); // Save after 300ms of no changes
    }
    updateSpeedDisplay();
  }
}

// Get current video element
function getVideo() {
  return document.querySelector('video');
}

// Monitor video for speed resets (e.g., after ads)
function monitorVideoSpeed() {
  const video = getVideo();
  if (!video) return;

  // Reapply speed when video element changes
  video.addEventListener('loadedmetadata', () => {
    setTimeout(() => applySpeed(currentSpeed), 100);
  });

  video.addEventListener('play', () => {
    // Check if speed was reset
    if (Math.abs(video.playbackRate - currentSpeed) > 0.01) {
      applySpeed(currentSpeed);
    }
  });

  // Periodic check for speed resets
  setInterval(() => {
    // Don't interfere while user is actively using the slider
    if (isSliderActive) return;
    
    const video = getVideo();
    if (video && Math.abs(video.playbackRate - currentSpeed) > 0.01) {
      video.playbackRate = currentSpeed;
    }
  }, 1000);
}

// Create speed control button
function createSpeedButton() {
  const button = document.createElement('button');
  button.className = 'ytp-button yt-custom-speed-button';
  button.setAttribute('title', 'Custom Speed Control');
  button.setAttribute('aria-label', 'Custom Speed Control');
  
  // Add SVG icon (double arrow representing speed)
  button.innerHTML = `
    <svg height="100%" version="1.1" viewBox="0 0 24 24" width="100%">
      <g fill="white">
        <polygon points="13,7 13,17 18,12"/>
        <polygon points="6,7 6,17 11,12"/>
      </g>
    </svg>
  `;
  
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSpeedPanel();
  });
  
  return button;
}

// Create floating speed panel
function createSpeedPanel() {
  const panel = document.createElement('div');
  panel.className = 'yt-custom-speed-panel';
  panel.style.display = 'none';
  
  panel.innerHTML = `
    <div class="speed-panel-header">
      <span>Playback Speed</span>
      <button class="speed-panel-close" aria-label="Close">&times;</button>
    </div>
    
    <div class="speed-section">
      <div class="speed-section-label">Slow</div>
      <div class="speed-presets speed-group-slow">
        <button class="speed-preset-btn" data-speed="0.25">0.25x</button>
        <button class="speed-preset-btn" data-speed="0.5">0.5x</button>
        <button class="speed-preset-btn" data-speed="0.75">0.75x</button>
      </div>
    </div>
    
    <div class="speed-section">
      <div class="speed-section-label">Normal</div>
      <div class="speed-presets speed-group-normal">
        <button class="speed-preset-btn" data-speed="1">1x</button>
        <button class="speed-preset-btn" data-speed="1.25">1.25x</button>
        <button class="speed-preset-btn" data-speed="1.5">1.5x</button>
        <button class="speed-preset-btn" data-speed="1.75">1.75x</button>
        <button class="speed-preset-btn" data-speed="2">2x</button>
      </div>
    </div>
    
    <div class="speed-section">
      <div class="speed-section-label">Fast</div>
      <div class="speed-presets speed-group-fast">
        <button class="speed-preset-btn" data-speed="3">3x</button>
        <button class="speed-preset-btn" data-speed="4">4x</button>
        <button class="speed-preset-btn" data-speed="5">5x</button>
        <button class="speed-preset-btn" data-speed="10">10x</button>
      </div>
    </div>
    
    <div class="speed-slider-container">
      <div class="speed-current-display">
        <span class="speed-current-value">${currentSpeed.toFixed(1)}x</span>
      </div>
      <div class="speed-section-label">Custom</div>
      <div class="speed-slider-wrapper">
        <input 
          type="range" 
          class="speed-slider" 
          min="${MIN_SPEED}" 
          max="${MAX_SPEED}" 
          step="${SPEED_STEP}" 
          value="${currentSpeed}"
        />
        <div class="speed-slider-tooltip">${currentSpeed.toFixed(1)}x</div>
      </div>
      <div class="speed-slider-labels">
        <span>${MIN_SPEED}x</span>
        <span>${MAX_SPEED}x</span>
      </div>
    </div>
    
    <div class="speed-actions">
      <button class="speed-reset-btn">Reset to 1x</button>
    </div>
  `;
  
  // Event listeners
  panel.querySelector('.speed-panel-close').addEventListener('click', () => {
    hideSpeedPanel();
  });
  
  // Preset buttons
  panel.querySelectorAll('.speed-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      applySpeed(speed);
      updateSlider(speed);
      updateActivePreset(speed);
    });
  });
  
  // Slider
  const slider = panel.querySelector('.speed-slider');
  const tooltip = panel.querySelector('.speed-slider-tooltip');
  
  // Initialize slider fill
  updateSliderFill(slider, currentSpeed);
  
  // Mark slider as active when user starts interacting
  slider.addEventListener('mousedown', () => {
    isSliderActive = true;
  });
  
  slider.addEventListener('mouseup', () => {
    isSliderActive = false;
  });
  
  // Also handle touch events for mobile
  slider.addEventListener('touchstart', () => {
    isSliderActive = true;
  });
  
  slider.addEventListener('touchend', () => {
    isSliderActive = false;
  });
  
  slider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    applySpeed(speed, false); // Allow debounced saving
    updateActivePreset(speed);
    updateSliderFill(e.target, speed);
    updateSliderTooltip(speed, e.target);
  });
  
  slider.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
  });
  
  slider.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
  });
  
  slider.addEventListener('mousemove', (e) => {
    // Use the actual slider value, not currentSpeed
    const speed = parseFloat(e.target.value);
    updateSliderTooltip(speed, e.target);
  });
  
  // Reset button
  const resetBtn = panel.querySelector('.speed-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applySpeed(1.0);
      updateSlider(1.0);
      updateActivePreset(1.0);
    });
  }
  
  // Keyboard accessibility
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideSpeedPanel();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      applySpeed(1.0);
      updateSlider(1.0);
      updateActivePreset(1.0);
    }
  });
  
  return panel;
}

// Update speed display in panel
function updateSpeedDisplay() {
  if (!speedPanel) return;
  const currentValueEl = speedPanel.querySelector('.speed-current-value');
  if (currentValueEl) {
    currentValueEl.textContent = `${currentSpeed.toFixed(1)}x`;
  }
}

// Update slider value
function updateSlider(speed) {
  if (!speedPanel) return;
  const slider = speedPanel.querySelector('.speed-slider');
  if (slider) {
    slider.value = speed;
    updateSliderFill(slider, speed);
  }
  updateSliderTooltip(speed, slider);
}

// Update slider fill (for webkit browsers)
function updateSliderFill(slider, speed) {
  if (!slider) return;
  
  const percent = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
  
  // Create gradient that fills from left to the current position
  slider.style.background = `linear-gradient(to right, #3ea6ff 0%, #5eb8ff ${percent}%, rgba(255, 255, 255, 0.1) ${percent}%, rgba(255, 255, 255, 0.1) 100%)`;
}

// Update slider tooltip position and value
function updateSliderTooltip(speed, slider) {
  if (!speedPanel || !slider) return;
  const tooltip = speedPanel.querySelector('.speed-slider-tooltip');
  if (!tooltip) return;
  
  tooltip.textContent = `${speed.toFixed(1)}x`;
  
  // Calculate position based on slider value
  const percent = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
  const thumbWidth = 16;
  const offset = (thumbWidth / 2) * (1 - 2 * percent / 100) + 1;
  tooltip.style.left = `calc(${percent}% + ${offset}px)`;
}

// Update active preset button
function updateActivePreset(speed) {
  if (!speedPanel) return;
  
  speedPanel.querySelectorAll('.speed-preset-btn').forEach(btn => {
    const btnSpeed = parseFloat(btn.dataset.speed);
    if (Math.abs(btnSpeed - speed) < 0.01) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Toggle speed panel visibility
function toggleSpeedPanel() {
  if (!speedPanel) return;
  
  if (speedPanel.style.display === 'none') {
    showSpeedPanel();
  } else {
    hideSpeedPanel();
  }
}

// Adjust panel size based on player dimensions
function adjustPanelResponsiveness() {
  if (!speedPanel) return;
  
  const playerContainer = document.querySelector('.html5-video-player');
  if (!playerContainer) return;
  
  const playerRect = playerContainer.getBoundingClientRect();
  const playerWidth = playerRect.width;
  const playerHeight = playerRect.height;
  
  // Remove existing responsive classes
  speedPanel.classList.remove('panel-compact', 'panel-mini', 'panel-full');
  
  // Apply size adjustments based on player dimensions
  if (playerWidth < 380) {
    // Very small - full width
    speedPanel.classList.add('panel-full');
    speedPanel.style.minWidth = `${playerWidth - 20}px`;
    speedPanel.style.maxWidth = `${playerWidth - 20}px`;
    speedPanel.style.left = '10px';
    speedPanel.style.right = '10px';
    speedPanel.style.bottom = '70px'; // Higher to avoid progress bar
  } else if (playerWidth < 500) {
    // Small - compact
    speedPanel.classList.add('panel-compact');
    speedPanel.style.minWidth = '260px';
    speedPanel.style.maxWidth = '260px';
    speedPanel.style.right = '8px';
    speedPanel.style.left = 'auto';
    speedPanel.style.bottom = '75px'; // Higher to avoid progress bar
  } else if (playerWidth < 768) {
    // Medium
    speedPanel.classList.add('panel-compact');
    speedPanel.style.minWidth = '280px';
    speedPanel.style.maxWidth = '280px';
    speedPanel.style.right = '10px';
    speedPanel.style.left = 'auto';
    speedPanel.style.bottom = '75px'; // Consistent positioning
  } else {
    // Large - default
    speedPanel.style.minWidth = '320px';
    speedPanel.style.maxWidth = '320px';
    speedPanel.style.right = '50px';
    speedPanel.style.left = 'auto';
    speedPanel.style.bottom = '75px';
  }
  
  // Adjust max height based on player height (override bottom if needed)
  if (playerHeight < 400) {
    speedPanel.style.maxHeight = `${playerHeight * 0.45}px`;
    speedPanel.style.bottom = '65px'; // Higher for small height
  } else if (playerHeight < 600) {
    speedPanel.style.maxHeight = `${playerHeight * 0.5}px`;
    speedPanel.style.bottom = '70px'; // Slightly higher
  } else {
    speedPanel.style.maxHeight = '700px';
    // Keep bottom from width-based adjustments
  }
}

// Show speed panel
function showSpeedPanel() {
  if (!speedPanel) return;
  
  adjustPanelResponsiveness();
  speedPanel.style.display = 'block';
  updateSlider(currentSpeed); // This will also update the fill
  updateActivePreset(currentSpeed);
  updateSpeedDisplay();
  
  // Focus first button for accessibility
  setTimeout(() => {
    const firstBtn = speedPanel.querySelector('.speed-preset-btn');
    if (firstBtn) firstBtn.focus();
  }, 50);
}

// Hide speed panel
function hideSpeedPanel() {
  if (!speedPanel) return;
  speedPanel.style.display = 'none';
}

// Position panel above the button
function positionSpeedPanel() {
  if (!speedPanel || !speedButton) return;
  
  // Panel is positioned via CSS relative to the player container
  // No need to calculate position dynamically
  // The absolute positioning within the player handles it automatically
}

// Inject custom controls into YouTube player
function injectSpeedControls() {
  // Find the right controls container
  const rightControls = document.querySelector('.ytp-right-controls');
  
  if (!rightControls) {
    return false;
  }
  
  // Check if already injected and still valid
  const existingButton = document.querySelector('.yt-custom-speed-button');
  if (existingButton && speedButton && existingButton === speedButton) {
    // Already properly injected
    return true;
  }
  
  // Remove any orphaned buttons/panels
  document.querySelectorAll('.yt-custom-speed-button').forEach(el => el.remove());
  document.querySelectorAll('.yt-custom-speed-panel').forEach(el => el.remove());
  
  // Create button
  speedButton = createSpeedButton();
  
  // Insert before the settings button (or at the beginning)
  const settingsButton = rightControls.querySelector('.ytp-settings-button');
  if (settingsButton) {
    rightControls.insertBefore(speedButton, settingsButton);
  } else {
    rightControls.insertBefore(speedButton, rightControls.firstChild);
  }
  
  // Create and add panel to player container (like YouTube's native menus)
  speedPanel = createSpeedPanel();
  const playerContainer = document.querySelector('.html5-video-player');
  if (playerContainer) {
    playerContainer.appendChild(speedPanel);
  } else {
    // Fallback to body if player container not found
    document.body.appendChild(speedPanel);
  }
  
  return true;
}

// Wait for YouTube player to load
function waitForPlayer() {
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds total
  
  const checkInterval = setInterval(() => {
    attempts++;
    
    if (injectSpeedControls()) {
      clearInterval(checkInterval);
      
      // Apply saved speed to video
      const video = getVideo();
      if (video) {
        applySpeed(currentSpeed);
      }
      
      // Monitor for speed resets
      monitorVideoSpeed();
      
      // Setup mutation observer for DOM changes (only once)
      if (!observer) {
        setupMutationObserver();
      }
    }
    
    // Stop checking after max attempts
    if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
    }
  }, 500);
}

// Re-inject controls (called on navigation)
function reinjectControls() {
  // Remove old references
  speedButton = null;
  speedPanel = null;
  
  // Wait a bit for YouTube to rebuild the player
  setTimeout(() => {
    waitForPlayer();
  }, 500);
}

// Setup mutation observer to handle YouTube DOM updates
function setupMutationObserver() {
  if (observer) {
    return; // Only set up once
  }
  
  let reinjectTimeout = null;
  
  observer = new MutationObserver((mutations) => {
    // Throttle re-injection checks
    if (!document.querySelector('.yt-custom-speed-button') && !reinjectTimeout) {
      reinjectTimeout = setTimeout(() => {
        injectSpeedControls();
        reinjectTimeout = null;
      }, 1000);
    }
    
    // Don't interfere while user is actively using the slider
    if (isSliderActive) return;
    
    // Check if video changed, reapply speed
    const video = getVideo();
    if (video && Math.abs(video.playbackRate - currentSpeed) > 0.01) {
      setTimeout(() => applySpeed(currentSpeed), 100);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Handle fullscreen changes
function handleFullscreenChange() {
  if (!speedPanel) return;
  
  // Re-attach panel to the correct container
  const playerContainer = document.querySelector('.html5-video-player');
  if (playerContainer && !playerContainer.contains(speedPanel)) {
    playerContainer.appendChild(speedPanel);
  }
}

// Handle clicks outside panel to close it
function handleOutsideClick(e) {
  if (!speedPanel || !speedButton) return;
  
  if (speedPanel.style.display !== 'none' && 
      !speedPanel.contains(e.target) && 
      !speedButton.contains(e.target)) {
    hideSpeedPanel();
  }
}

// Handle window resize
function handleResize() {
  // Adjust panel responsiveness when window/player size changes
  if (speedPanel && speedPanel.style.display !== 'none') {
    adjustPanelResponsiveness();
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setSpeed') {
    applySpeed(request.speed);
    updateSlider(request.speed);
    updateActivePreset(request.speed);
    sendResponse({ success: true, currentSpeed: currentSpeed });
  } else if (request.action === 'getSpeed') {
    sendResponse({ currentSpeed: currentSpeed });
  }
  return true;
});

// Listen for storage changes from popup
chrome.storage.onChanged.addListener((changes, area) => {
  // Don't interfere while user is actively using the slider
  if (isSliderActive) return;
  
  if (area === 'local' && changes.playbackSpeed) {
    const newSpeed = changes.playbackSpeed.newValue;
    if (newSpeed && Math.abs(newSpeed - currentSpeed) > 0.01) {
      applySpeed(newSpeed, true); // Skip additional save since it came from storage
      updateSlider(newSpeed);
      updateActivePreset(newSpeed);
    }
  }
});

// Handle YouTube navigation
function handleYouTubeNavigation() {
  // YouTube fires this event when navigation completes
  reinjectControls();
}

// Initialize
(async function init() {
  await loadSavedSpeed();
  
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForPlayer);
  } else {
    waitForPlayer();
  }
  
  // Listen for YouTube's SPA navigation events
  // YouTube fires these custom events when navigating between videos
  document.addEventListener('yt-navigate-finish', handleYouTubeNavigation);
  document.addEventListener('yt-page-data-updated', handleYouTubeNavigation);
  
  // Also listen for URL changes (backup method)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Only reinject if we're on a watch page
      if (currentUrl.includes('/watch')) {
        reinjectControls();
      }
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Event listeners
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('click', handleOutsideClick);
  window.addEventListener('resize', handleResize);
  
  // Global mouseup/touchend to ensure slider flag is cleared even if released outside
  document.addEventListener('mouseup', () => {
    if (isSliderActive) {
      isSliderActive = false;
    }
  });
  
  document.addEventListener('touchend', () => {
    if (isSliderActive) {
      isSliderActive = false;
    }
  });
})();

