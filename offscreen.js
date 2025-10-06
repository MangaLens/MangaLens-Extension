const canvas = document.getElementById('processingCanvas');
const ctx = canvas.getContext('2d');

console.log('[Offscreen] OCR processor initialized');

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
        return true;
    }
});

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
                    // Canvas에 그리기
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;

                    console.log('[Offscreen] Image size:', canvas.width, 'x', canvas.height);

                    ctx.drawImage(img, 0, 0);

                    // Data URL로 변환 (PNG로 재인코딩)
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
