/**
 * Popup UI controller for OCR extension settings.
 *
 * Handles:
 * - Server health check
 * - Extension enable/disable toggle
 * - Target language selection
 *
 * @author AnythingTranslate OCR
 * @version 1.0.0
 */

const statusDiv = document.getElementById('status');
const toggleBtn = document.getElementById('toggle');
const targetLangSelect = document.getElementById('targetLang');

/**
 * Check if the OCR server is running
 */
async function checkServer() {
    try {
        const response = await fetch('http://127.0.0.1:5000/health');
        const data = await response.json();

        if (data.status === 'ok') {
            statusDiv.textContent = '✓ Server is running';
            statusDiv.className = 'status ok';
        } else {
            throw new Error('Server not ready');
        }
    } catch (error) {
        statusDiv.textContent = '❌ Server not running. Run: python server.py';
        statusDiv.className = 'status error';
    }
}

/**
 * Toggle extension enabled/disabled state
 */
toggleBtn.addEventListener('click', async () => {
    const { enabled } = await chrome.storage.sync.get(['enabled']);
    await chrome.storage.sync.set({ enabled: !enabled });
    updateButton();
});

/**
 * Update button text based on enabled state
 */
async function updateButton() {
    const { enabled } = await chrome.storage.sync.get(['enabled']);
    toggleBtn.textContent = enabled ? 'Disable' : 'Enable';
}

/**
 * Save selected target language
 */
targetLangSelect.addEventListener('change', async () => {
    const targetLang = targetLangSelect.value;
    await chrome.storage.sync.set({ targetLang });
    console.log('[Popup] Target language changed to:', targetLang);
});

/**
 * Load saved target language
 */
async function loadTargetLanguage() {
    const { targetLang } = await chrome.storage.sync.get(['targetLang']);
    if (targetLang) {
        targetLangSelect.value = targetLang;
    } else {
        // Default to Korean
        targetLangSelect.value = 'Korean';
        await chrome.storage.sync.set({ targetLang: 'Korean' });
    }
}

// Initialize
checkServer();
updateButton();
loadTargetLanguage();
