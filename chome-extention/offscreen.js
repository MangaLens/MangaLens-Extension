/**
 * Offscreen document for image processing with CORS bypass.
 *
 * This document runs in an isolated context that can:
 * - Access canvas API for image manipulation
 * - Bypass CORS restrictions for certain operations
 * - Re-encode images to ensure they can be processed by OCR server
 *
 * @author AnythingTranslate OCR
 * @version 1.0.0
 */

const canvas = document.getElementById('processingCanvas');
const ctx = canvas.getContext('2d');

console.log('[Offscreen] OCR processor initialized');

/**
 * Message handler for image processing requests from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Offscreen] Message received:', message.type);

    if (message.type === 'PROCESS_IMAGE_DATA') {
        handleImageData(message.dataUrl).then(result => {
            console.log('[Offscreen] Result:', result.success ? 'Success' : 'Failed');
            sendResponse(result);
        }).catch(err => {
            console.error('[Offscreen] Error:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep message channel open for async response
    }
});

/**
 * Process image data by loading, drawing to canvas, and re-encoding.
 * This helps bypass CORS issues and ensures consistent image format.
 *
 * @param {string} dataUrl - Base64 encoded image data URL
 * @returns {Promise<Object>} Object with success status, dataUrl, and size
 */
async function handleImageData(dataUrl) {
    try {
        console.log('[Offscreen] Processing image data...');

        const img = new Image();

        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Image load timeout'));
            }, 10000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    // Draw to canvas
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;

                    console.log('[Offscreen] Image size:', canvas.width, 'x', canvas.height);

                    ctx.drawImage(img, 0, 0);

                    // Convert to Data URL (re-encode as PNG)
                    const outputDataUrl = canvas.toDataURL('image/png', 0.95);
                    console.log('[Offscreen] ✓ Image converted to PNG');

                    resolve({
                        success: true,
                        dataUrl: outputDataUrl,
                        size: outputDataUrl.length
                    });
                } catch (err) {
                    console.error('[Offscreen] Canvas error:', err);
                    reject(err);
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                console.error('[Offscreen] Image load error');
                reject(new Error('Failed to load image'));
            };

            img.src = dataUrl;
        });

        return result;

    } catch (error) {
        console.error('[Offscreen] Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
