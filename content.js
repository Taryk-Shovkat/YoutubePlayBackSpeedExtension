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
let lastManualSpeedChange = 0; // Timestamp of last manual speed change
let lastVideoSpeedChange = 0; // Timestamp when video speed last changed (by anyone)
let previousVideoSpeed = 1.0; // Track previous video speed
let temporarySpeed = null; // Track if there's a temporary speed active (e.g., 2x from hold feature)

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
  // Get video from the main player
  const mainPlayer = document.querySelector('#movie_player');
  const video = mainPlayer ? mainPlayer.querySelector('video') : document.querySelector('video');
  
  if (!video) {
    console.log('[YT Speed] No video element found to apply speed');
    return;
  }
  
  // Check if video is ready to accept playback rate changes
  if (video.readyState < 1) {
    console.log('[YT Speed] Video not ready (readyState:', video.readyState + '), will retry when ready');
    // Wait for video to be ready
    const applyWhenReady = () => {
      if (video.readyState >= 1) {
        console.log('[YT Speed] Video now ready, applying speed:', speed);
        video.playbackRate = speed;
        currentSpeed = speed;
        previousVideoSpeed = speed;
        lastManualSpeedChange = Date.now();
        if (!skipSave) {
          if (saveSpeedTimeout) clearTimeout(saveSpeedTimeout);
          saveSpeedTimeout = setTimeout(() => saveSpeed(speed), 300);
        }
        updateSpeedDisplay();
      }
    };
    video.addEventListener('loadedmetadata', applyWhenReady, { once: true });
    video.addEventListener('canplay', applyWhenReady, { once: true });
    // Also try after a delay as fallback
    setTimeout(() => {
      if (video.readyState >= 1) applyWhenReady();
    }, 500);
    return;
  }
  
  // Video is ready, apply immediately
  video.playbackRate = speed;
  currentSpeed = speed;
  previousVideoSpeed = speed; // Keep tracking in sync
  lastManualSpeedChange = Date.now(); // Mark when we manually changed speed
  console.log('[YT Speed] Speed applied:', speed, 'readyState:', video.readyState);
  
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

// Get current video element (prefer main player)
function getVideo() {
  const mainPlayer = document.querySelector('#movie_player');
  return mainPlayer ? mainPlayer.querySelector('video') : document.querySelector('video');
}

// Check if we should allow speed changes (for YouTube's native features)
function shouldAllowSpeedChange(videoSpeed) {
  // If we just manually changed the speed, don't allow overriding it
  if (Date.now() - lastManualSpeedChange < 500) {
    return false;
  }
  
  // If there's a temporary speed active (YouTube's hold feature)
  // and the current video speed matches it, allow it
  if (temporarySpeed !== null && Math.abs(videoSpeed - temporarySpeed) < 0.01) {
    return true;
  }
  
  // If the video speed just changed (within last 1 second), allow it
  if (Date.now() - lastVideoSpeedChange < 1000) {
    return true;
  }
  
  return false;
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
    const videoSpeed = video.playbackRate;
    
    // Allow speed changes if this matches temporary speed or recently changed
    if (shouldAllowSpeedChange(videoSpeed)) return;
    
    // Check if speed was reset on play
    if (Math.abs(videoSpeed - currentSpeed) > 0.01) {
      applySpeed(currentSpeed);
    }
  });

  // Listen for rate changes directly - this detects when YouTube changes the speed
  video.addEventListener('ratechange', () => {
    // Don't track changes from our own slider
    if (isSliderActive) return;
    
    const videoSpeed = video.playbackRate;
    
    // Check if this is a change we made
    if (Date.now() - lastManualSpeedChange < 300) {
      // We just changed it, update tracking and clear temporary speed
      previousVideoSpeed = videoSpeed;
      temporarySpeed = null;
      return;
    }
    
    // Check if speed actually changed
    if (Math.abs(videoSpeed - previousVideoSpeed) > 0.01) {
      // Speed changed and it wasn't us - mark the time
      lastVideoSpeedChange = Date.now();
      
      const matchesSavedSpeed = Math.abs(videoSpeed - currentSpeed) < 0.01;
      const wasTemporary = temporarySpeed !== null;
      
      if (!matchesSavedSpeed) {
        // Speed changed to something other than our saved speed
        
        if (wasTemporary && Math.abs(videoSpeed - temporarySpeed) > 0.01) {
          // We were in temporary mode and speed changed to yet another value
          // This likely means YouTube ended temporary mode and reset to 1x
          // Clear temporary and schedule a restoration
          temporarySpeed = null;
          setTimeout(() => {
            const vid = getVideo();
            if (vid && Math.abs(vid.playbackRate - currentSpeed) > 0.01) {
              applySpeed(currentSpeed);
            }
          }, 100);
        } else {
          // Entering temporary speed mode (e.g., hold to 2x)
          temporarySpeed = videoSpeed;
        }
      } else {
        // Speed returned to our saved speed - clear temporary speed
        temporarySpeed = null;
      }
      
      previousVideoSpeed = videoSpeed;
    }
  });

  // Periodic check for speed resets (backup for when ratechange doesn't fire)
  setInterval(() => {
    // Don't interfere while user is actively using the slider
    if (isSliderActive) return;
    
    const video = getVideo();
    if (!video) return;
    
    const videoSpeed = video.playbackRate;
    
    // Don't interfere if this matches temporary speed or recently changed
    if (shouldAllowSpeedChange(videoSpeed)) return;
    
    // Normal check for speed resets (e.g., after ads)
    if (Math.abs(videoSpeed - currentSpeed) > 0.01) {
      // Speed is wrong and not protected - reset it
      video.playbackRate = currentSpeed;
      previousVideoSpeed = currentSpeed;
      temporarySpeed = null;
      lastManualSpeedChange = Date.now();
    }
  }, 1000); // Check every second as a backup
}

// Create speed control button
function createSpeedButton() {
  const button = document.createElement('button');
  button.className = 'ytp-button yt-custom-speed-button';
  button.setAttribute('title', 'Custom Speed Control');
  button.setAttribute('aria-label', 'Custom Speed Control');
  
  // Add SVG icon (double arrow representing speed)
  button.innerHTML = `
    <svg version="1.1" viewBox="0 0 24 24">
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
  console.log('[YT Speed] adjustPanelResponsiveness() called');
  
  if (!speedPanel) {
    console.log('[YT Speed] No speedPanel to adjust');
    return;
  }
  
  // Get the main player
  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) {
    console.log('[YT Speed] No #movie_player found for sizing');
    return;
  }
  
  const playerRect = playerContainer.getBoundingClientRect();
  const playerWidth = playerRect.width;
  const playerHeight = playerRect.height;
  
  console.log('[YT Speed] Player dimensions for panel sizing:', playerWidth + 'x' + playerHeight);
  
  // If player dimensions are invalid (0 or very small), don't adjust yet
  if (playerWidth < 100 || playerHeight < 100) {
    console.log('[YT Speed] Player dimensions too small, skipping adjustment');
    // Set default sizing as fallback
    speedPanel.style.minWidth = '320px';
    speedPanel.style.maxWidth = '320px';
    speedPanel.style.right = '50px';
    speedPanel.style.left = 'auto';
    speedPanel.style.bottom = '75px';
    speedPanel.style.maxHeight = '700px';
    return;
  }
  
  // Remove existing responsive classes
  speedPanel.classList.remove('panel-compact', 'panel-mini', 'panel-full');
  
  // Apply size adjustments based on player dimensions
  if (playerWidth < 380) {
    // Very small - full width
    console.log('[YT Speed] Applying panel-full class');
    speedPanel.classList.add('panel-full');
    speedPanel.style.minWidth = `${playerWidth - 20}px`;
    speedPanel.style.maxWidth = `${playerWidth - 20}px`;
    speedPanel.style.left = '10px';
    speedPanel.style.right = '10px';
    speedPanel.style.bottom = '70px'; // Higher to avoid progress bar
  } else if (playerWidth < 500) {
    // Small - compact
    console.log('[YT Speed] Applying panel-compact class (small)');
    speedPanel.classList.add('panel-compact');
    speedPanel.style.minWidth = '260px';
    speedPanel.style.maxWidth = '260px';
    speedPanel.style.right = '8px';
    speedPanel.style.left = 'auto';
    speedPanel.style.bottom = '75px'; // Higher to avoid progress bar
  } else if (playerWidth < 768) {
    // Medium
    console.log('[YT Speed] Applying panel-compact class (medium)');
    speedPanel.classList.add('panel-compact');
    speedPanel.style.minWidth = '280px';
    speedPanel.style.maxWidth = '280px';
    speedPanel.style.right = '10px';
    speedPanel.style.left = 'auto';
    speedPanel.style.bottom = '75px'; // Consistent positioning
  } else {
    // Large - default
    console.log('[YT Speed] Applying default (large) sizing');
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
  
  console.log('[YT Speed] Panel styled - minWidth:', speedPanel.style.minWidth, 'maxWidth:', speedPanel.style.maxWidth);
}

// Show speed panel
function showSpeedPanel() {
  if (!speedPanel) return;
  
  console.log('[YT Speed] showSpeedPanel() called');
  
  // Make panel visible first
  speedPanel.style.display = 'block';
  console.log('[YT Speed] Panel set to display: block');
  
  // Adjust sizing (now that it's visible, dimensions should calculate correctly)
  adjustPanelResponsiveness();
  
  // Check actual rendered dimensions
  const panelRect = speedPanel.getBoundingClientRect();
  console.log('[YT Speed] Panel actual dimensions after adjustment:', panelRect.width + 'x' + panelRect.height);
  console.log('[YT Speed] Panel computed styles - width:', window.getComputedStyle(speedPanel).width, 'minWidth:', window.getComputedStyle(speedPanel).minWidth);
  
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
  console.log('[YT Speed] injectSpeedControls() called');
  
  // CRITICAL: Only inject into the MAIN video player (#movie_player)
  // YouTube has preview players (#c4-player, etc.) that we should ignore
  const mainPlayer = document.querySelector('#movie_player');
  console.log('[YT Speed] Main player (#movie_player) found:', !!mainPlayer);
  
  if (!mainPlayer) {
    console.log('[YT Speed] Main video player not found, skipping injection');
    return false;
  }
  
  // Check if player is actually initialized (not in a hidden/unstarted state)
  // The player should have proper dimensions and the controls should be visible
  const playerRect = mainPlayer.getBoundingClientRect();
  const hasValidDimensions = playerRect.width > 100 && playerRect.height > 100;
  console.log('[YT Speed] Player dimensions:', playerRect.width + 'x' + playerRect.height, 'valid:', hasValidDimensions);
  
  if (!hasValidDimensions) {
    console.log('[YT Speed] Player not properly sized yet, waiting...');
    return false;
  }
  
  // Find the right controls container WITHIN the main player
  let rightControls = findRightControls(mainPlayer);
  console.log('[YT Speed] rightControls in main player found:', !!rightControls);
  
  // If not found, try alternative approach: find any controls container with buttons
  if (!rightControls) {
    console.log('[YT Speed] Trying alternative approach to find controls...');
    
    // Look for controls bar
    const controlsBar = mainPlayer.querySelector('.ytp-chrome-controls');
    if (controlsBar) {
      console.log('[YT Speed] Found controls bar, looking for button containers...');
      // Try to find any div with buttons inside the controls
      const buttonContainers = controlsBar.querySelectorAll('div[class*="controls"]');
      console.log('[YT Speed] Found', buttonContainers.length, 'button containers');
      
      // Find one that contains buttons (likely the right controls)
      for (const container of buttonContainers) {
        const buttons = container.querySelectorAll('button');
        if (buttons.length > 0) {
          console.log('[YT Speed] Found container with', buttons.length, 'buttons, class:', container.className);
          // Check if this looks like the right controls (has settings or fullscreen button)
          const hasSettingsOrFullscreen = Array.from(buttons).some(btn => 
            btn.className.includes('settings') || 
            btn.className.includes('fullscreen') ||
            btn.getAttribute('aria-label')?.toLowerCase().includes('settings') ||
            btn.getAttribute('aria-label')?.toLowerCase().includes('fullscreen')
          );
          if (hasSettingsOrFullscreen) {
            rightControls = container;
            console.log('[YT Speed] Using this container as rightControls');
            break;
          }
        }
      }
    }
  }
  
  if (!rightControls) {
    console.log('[YT Speed] Controls not found in main player, waiting...');
    return false;
  }
  
  // Verify the video element exists and is ready
  const video = mainPlayer.querySelector('video');
  console.log('[YT Speed] Video element found:', !!video, 'readyState:', video ? video.readyState : 'N/A');
  
  if (!video || video.readyState < 1) {
    console.log('[YT Speed] Video not ready yet, waiting...');
    return false;
  }
  
  // Check if already injected and still valid
  const existingButton = document.querySelector('.yt-custom-speed-button');
  console.log('[YT Speed] existingButton:', !!existingButton, 'speedButton:', !!speedButton);
  
  if (existingButton && speedButton && existingButton === speedButton) {
    // Already properly injected
    console.log('[YT Speed] Already injected');
    return true;
  }
  
  // Remove any orphaned buttons/panels
  const orphanedButtons = document.querySelectorAll('.yt-custom-speed-button');
  const orphanedPanels = document.querySelectorAll('.yt-custom-speed-panel');
  console.log('[YT Speed] Removing orphans - buttons:', orphanedButtons.length, 'panels:', orphanedPanels.length);
  orphanedButtons.forEach(el => el.remove());
  orphanedPanels.forEach(el => el.remove());
  
  // Create button
  console.log('[YT Speed] Creating speed button...');
  speedButton = createSpeedButton();
  console.log('[YT Speed] Button created:', !!speedButton);
  
  // Insert the button safely
  console.log('[YT Speed] v1.3.3 - Attempting safe button insertion...');
  
  // YouTube's new UI has sub-containers: ytp-right-controls-left and ytp-right-controls-right
  // We want to insert into the right side container (where settings/fullscreen buttons are)
  let targetContainer = rightControls.querySelector('.ytp-right-controls-right');
  
  if (!targetContainer) {
    // Fallback to main container if sub-container doesn't exist
    targetContainer = rightControls;
    console.log('[YT Speed] Using main rightControls as target (no sub-container found)');
  } else {
    console.log('[YT Speed] Found ytp-right-controls-right sub-container');
  }
  
  try {
    // Try to insert before the first button in the target container (settings button)
    const firstButton = targetContainer.querySelector('button');
    if (firstButton && firstButton.parentElement === targetContainer) {
      targetContainer.insertBefore(speedButton, firstButton);
      console.log('[YT Speed] Button inserted before first button in container');
    } else {
      // Fallback: prepend to the target container
      targetContainer.insertBefore(speedButton, targetContainer.firstChild);
      console.log('[YT Speed] Button prepended to container');
    }
  } catch (error) {
    // Final fallback: just append
    console.warn('[YT Speed] Insert failed, appending instead:', error);
    targetContainer.appendChild(speedButton);
    console.log('[YT Speed] Button appended to container');
  }
  
  // Verify button was actually added to DOM
  const buttonInDom = document.querySelector('.yt-custom-speed-button');
  console.log('[YT Speed] Button in DOM after insert:', !!buttonInDom);
  console.log('[YT Speed] Button parent:', buttonInDom ? buttonInDom.parentElement : 'none');
  
  // Create and add panel to main player container (like YouTube's native menus)
  console.log('[YT Speed] Creating speed panel...');
  speedPanel = createSpeedPanel();
  console.log('[YT Speed] Panel created:', !!speedPanel);
  
  // Append to the main player (we already verified it exists at the start of this function)
  mainPlayer.appendChild(speedPanel);
  console.log('[YT Speed] Panel appended to main player (#movie_player)');
  
  // Verify panel was actually added to DOM
  const panelInDom = document.querySelector('.yt-custom-speed-panel');
  console.log('[YT Speed] Panel in DOM after append:', !!panelInDom);
  console.log('[YT Speed] Panel parent:', panelInDom ? panelInDom.parentElement : 'none');
  console.log('[YT Speed] Panel parent ID:', panelInDom && panelInDom.parentElement ? panelInDom.parentElement.id : 'none');
  
  // Adjust panel responsiveness after a tiny delay to ensure DOM is fully updated
  // This prevents the panel from being a thin stripe
  setTimeout(() => {
    adjustPanelResponsiveness();
    console.log('[YT Speed] Panel responsiveness adjusted (delayed)');
  }, 50);
  
  console.log('[YT Speed] Controls injected successfully at speed:', currentSpeed);
  return true;
}

// Wait for YouTube player to load
function waitForPlayer() {
  let attempts = 0;
  const maxAttempts = 100; // 50 seconds total (increased)
  
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

// Helper function to find right controls with fallbacks
function findRightControls(mainPlayer) {
  if (!mainPlayer) return null;
  
  // Try primary selector
  let rightControls = mainPlayer.querySelector('.ytp-right-controls');
  
  // Try alternate selectors for newer YouTube versions
  if (!rightControls) {
    rightControls = mainPlayer.querySelector('.ytp-chrome-controls .ytp-right-controls');
  }
  if (!rightControls) {
    rightControls = mainPlayer.querySelector('[class*="right-controls"]');
  }
  
  // Debug: Log what we found
  if (rightControls) {
    console.log('[YT Speed] Found rightControls with class:', rightControls.className);
    console.log('[YT Speed] rightControls children count:', rightControls.children.length);
    console.log('[YT Speed] rightControls children classes:', Array.from(rightControls.children).map(c => c.className).join(', '));
  } else {
    // If still not found, log available controls structures for debugging
    const allControls = mainPlayer.querySelectorAll('[class*="controls"]');
    console.warn('[YT Speed] Could not find right-controls. Available control elements:', 
      Array.from(allControls).map(el => el.className).join(', '));
  }
  
  return rightControls;
}

// Check if we're on a video page
function isVideoPage() {
  return window.location.pathname === '/watch' || window.location.href.includes('/watch?');
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
    if (!video) return;
    
    const videoSpeed = video.playbackRate;
    
    // Don't interfere if this matches temporary speed or recently changed
    if (shouldAllowSpeedChange(videoSpeed)) return;
    
    if (Math.abs(videoSpeed - currentSpeed) > 0.01) {
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
  
  // Re-attach panel to the main player
  const mainPlayer = document.querySelector('#movie_player');
  if (mainPlayer && !mainPlayer.contains(speedPanel)) {
    mainPlayer.appendChild(speedPanel);
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

// Persistent checker to ensure controls are always injected on video pages
function startPersistentChecker() {
  let checkCount = 0;
  console.log('[YT Speed] Starting persistent checker');
  
  // More aggressive checking initially (every 500ms for first 30 seconds)
  // Then back off to every 3 seconds
  const checker = setInterval(() => {
    checkCount++;
    
    if (isVideoPage() && !document.querySelector('.yt-custom-speed-button')) {
      const mainPlayer = document.querySelector('#movie_player');
      const rightControls = findRightControls(mainPlayer);
      const video = mainPlayer ? mainPlayer.querySelector('video') : null;
      
      if (checkCount <= 5 || checkCount % 10 === 0) {
        console.log('[YT Speed] Check #' + checkCount + ': mainPlayer=' + !!mainPlayer + ', rightControls=' + !!rightControls + ', video=' + !!video);
      }
      
      // Only try to inject if the MAIN player controls are actually present
      if (mainPlayer && rightControls && video) {
        console.log('[YT Speed] Found main player controls, injecting...');
        injectSpeedControls();
        
        // Apply saved speed if not already applied
        if (Math.abs(video.playbackRate - currentSpeed) > 0.01) {
          applySpeed(currentSpeed);
        }
        
        // Setup monitoring if not already done
        if (!observer) {
          setupMutationObserver();
        }
      }
    }
    
    // After 30 seconds (60 checks at 500ms), switch to slower checking
    if (checkCount === 60) {
      console.log('[YT Speed] Switching to slower checking interval');
      clearInterval(checker);
      // Continue with less frequent checks
      setInterval(() => {
        if (isVideoPage() && !document.querySelector('.yt-custom-speed-button')) {
          const mainPlayer = document.querySelector('#movie_player');
          const rightControls = findRightControls(mainPlayer);
          const video = mainPlayer ? mainPlayer.querySelector('video') : null;
          
          if (mainPlayer && rightControls && video) {
            injectSpeedControls();
            if (Math.abs(video.playbackRate - currentSpeed) > 0.01) {
              applySpeed(currentSpeed);
            }
            if (!observer) {
              setupMutationObserver();
            }
          }
        }
      }, 3000);
    }
  }, 500); // Check every 500ms initially
}

// Wait for body to exist before setting up observers
function ensureBodyExists(callback) {
  if (document.body) {
    callback();
  } else {
    // Wait for body to be available
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        bodyObserver.disconnect();
        callback();
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true });
  }
}

// Initialize
(async function init() {
  console.log('[YT Speed] Extension loading...');
  console.log('[YT Speed] Current URL:', window.location.href);
  console.log('[YT Speed] Document state:', document.readyState);
  
  await loadSavedSpeed();
  console.log('[YT Speed] Loaded saved speed:', currentSpeed);
  
  // Function to start watching for player
  function startWatching() {
    // Only start watching if we're on a video page
    if (isVideoPage()) {
      console.log('[YT Speed] On video page, starting to watch for player');
      waitForPlayer();
    } else {
      console.log('[YT Speed] Not on video page, URL:', window.location.href);
    }
  }
  
  // Function to set up all observers and listeners
  function setupObserversAndListeners() {
    // Listen for YouTube's SPA navigation events
    // YouTube fires these custom events when navigating between videos
    document.addEventListener('yt-navigate-finish', () => {
      if (isVideoPage()) {
        handleYouTubeNavigation();
      }
    });
    
    document.addEventListener('yt-page-data-updated', () => {
      if (isVideoPage()) {
        handleYouTubeNavigation();
      }
    });
    
    // Listen for when YouTube app becomes ready (fires on initial load)
    document.addEventListener('yt-navigate-start', () => {
      if (isVideoPage()) {
        // Wait a bit for the player to load
        setTimeout(startWatching, 1000);
      }
    });
    
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
    
    // Additional listener: Watch for video element and controls being added
    let videoCheckTimeout = null;
    const videoObserver = new MutationObserver((mutations) => {
      // Check if controls appeared in the MAIN player
      if (isVideoPage() && !document.querySelector('.yt-custom-speed-button')) {
        const mainPlayer = document.querySelector('#movie_player');
        const rightControls = findRightControls(mainPlayer);
        const video = mainPlayer ? mainPlayer.querySelector('video') : null;
        
        if (mainPlayer && rightControls && video) {
          // Both main player, controls and video exist, inject immediately
          if (injectSpeedControls()) {
            applySpeed(currentSpeed);
            monitorVideoSpeed();
            if (!observer) {
              setupMutationObserver();
            }
          }
        } else if (mainPlayer && video && !speedButton && !videoCheckTimeout) {
          // Main player and video exist but controls don't yet, wait a bit
          videoCheckTimeout = setTimeout(() => {
            waitForPlayer();
            videoCheckTimeout = null;
          }, 500); // Reduced from 1000ms to 500ms
        }
      }
    });
    
    videoObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
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
  }
  
  // Ensure body exists before proceeding
  ensureBodyExists(() => {
    // Start watching for player immediately
    startWatching();
    
    // Start the persistent checker (safety net)
    startPersistentChecker();
    
    // Set up all observers and listeners
    setupObserversAndListeners();
    
    // Wait for page to be fully ready (additional safety)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startWatching);
    }
    
    // Also try when window fully loads (for fresh browser starts)
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        setTimeout(startWatching, 500);
      });
    }
    
    // Try again after a short delay (helps with fresh browser starts)
    setTimeout(startWatching, 2000);
    setTimeout(startWatching, 4000);
  });
})();

