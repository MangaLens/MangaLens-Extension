/**
 * Background service worker for OCR extension.
 *
 * Handles:
 * - Offscreen document management for CORS bypass
 * - Image fetching with Pixiv support
 * - Message routing between content scripts and offscreen documents
 *
 * @author AnythingTranslate OCR
 * @version 1.0.0
 */

// Offscreen document creation promise tracker
let offscreenCreating = null;

/**
 * Set up offscreen document for canvas-based image processing.
 * Ensures only one offscreen document exists at a time.
 *
 * @returns {Promise<void>}
 */
async function setupOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    if (offscreenCreating) {
        await offscreenCreating;
    } else {
        offscreenCreating = chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['DOM_SCRAPING'],
            justification: 'Process images for OCR with CORS bypass'
        });
        await offscreenCreating;
        offscreenCreating = null;
    }
}

/**
 * Message handler for content script and offscreen document communication
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle Pixiv image fetching with fallback URLs
    if (message.type === 'FETCH_IMAGE_OFFSCREEN') {
        (async () => {
            try {
                console.log('[Background] Fetching Pixiv image:', message.url.substring(0, 100));

                // declarativeNetRequest automatically adds Referer header
                let imageBlob = null;
                let successUrl = null;

                // First attempt: Original URL
                try {
                    const response = await fetch(message.url, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'omit',
                        cache: 'no-cache'
                    });

                    if (response.ok) {
                        imageBlob = await response.blob();
                        successUrl = message.url;
                        console.log('[Background] ✓ Original URL succeeded:', imageBlob.size, 'bytes');
                    } else {
                        console.log('[Background] Original URL failed:', response.status);
                    }
                } catch (err) {
                    console.log('[Background] Original URL error:', err.message);
                }

                // Second attempt: webp → jpg
                if (!imageBlob && message.url.includes('_webp/')) {
                    const altUrl = message.url.replace('_webp/', '/').replace('.webp', '.jpg');
                    console.log('[Background] Trying JPG:', altUrl.substring(0, 100));

                    try {
                        const response = await fetch(altUrl, {
                            method: 'GET',
                            mode: 'cors',
                            credentials: 'omit',
                            cache: 'no-cache'
                        });

                        if (response.ok) {
                            imageBlob = await response.blob();
                            successUrl = altUrl;
                            console.log('[Background] ✓ JPG succeeded:', imageBlob.size, 'bytes');
                        }
                    } catch (err) {
                        console.log('[Background] JPG error:', err.message);
                    }
                }

                // Third attempt: webp → png
                if (!imageBlob && message.url.includes('_webp/')) {
                    const altUrl = message.url.replace('_webp/', '/').replace('.webp', '.png');
                    console.log('[Background] Trying PNG:', altUrl.substring(0, 100));

                    try {
                        const response = await fetch(altUrl, {
                            method: 'GET',
                            mode: 'cors',
                            credentials: 'omit',
                            cache: 'no-cache'
                        });

                        if (response.ok) {
                            imageBlob = await response.blob();
                            successUrl = altUrl;
                            console.log('[Background] ✓ PNG succeeded:', imageBlob.size, 'bytes');
                        }
                    } catch (err) {
                        console.log('[Background] PNG error:', err.message);
                    }
                }

                if (!imageBlob || imageBlob.size === 0) {
                    console.error('[Background] All fetch attempts failed');
                    sendResponse({ success: false, error: 'Failed to fetch image from all URLs' });
                    return;
                }

                // Convert Blob to Data URL
                const reader = new FileReader();
                reader.onloadend = async () => {
                    console.log('[Background] Blob converted to data URL, size:', reader.result.length);

                    // Send to offscreen document for canvas processing
                    await setupOffscreenDocument();

                    const offscreenResponse = await chrome.runtime.sendMessage({
                        type: 'PROCESS_IMAGE_DATA',
                        dataUrl: reader.result
                    });

                    console.log('[Background] Offscreen result:', offscreenResponse?.success ? 'Success' : 'Failed');
                    sendResponse(offscreenResponse);
                };

                reader.onerror = () => {
                    console.error('[Background] FileReader error');
                    sendResponse({ success: false, error: 'FileReader error' });
                };

                reader.readAsDataURL(imageBlob);

            } catch (error) {
                console.error('[Background] Error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // Handle standard image fetching
    if (message.type === 'FETCH_IMAGE') {
        (async () => {
            try {
                console.log('[Background] Fetching:', message.url.substring(0, 100));

                const response = await fetch(message.url, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    cache: 'no-cache'
                });

                if (!response.ok) {
                    console.error('[Background] Fetch failed:', response.status);
                    sendResponse({ success: false, error: `HTTP ${response.status}` });
                    return;
                }

                const blob = await response.blob();
                console.log('[Background] Blob size:', blob.size);

                const reader = new FileReader();
                reader.onloadend = () => {
                    console.log('[Background] ✓ Success');
                    sendResponse({
                        success: true,
                        dataUrl: reader.result,
                        size: blob.size
                    });
                };

                reader.onerror = () => {
                    console.error('[Background] FileReader error');
                    sendResponse({ success: false, error: 'FileReader error' });
                };

                reader.readAsDataURL(blob);

            } catch (error) {
                console.error('[Background] Error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        return true;
    }
});
