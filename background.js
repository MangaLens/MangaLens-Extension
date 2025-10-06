// 매우 간단한 background - CORS 우회 fetch만 처리

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_IMAGE') {
        (async () => {
            try {
                console.log('[Background] Fetching:', message.url.substring(0, 100));

                // ⭐ Pixiv 특수 처리
                const isPixiv = message.url.includes('pximg.net');

                const headers = {
                    'Referer': message.referer || message.url
                };

                // ⭐ Pixiv는 특수 Referer 필요
                if (isPixiv) {
                    headers['Referer'] = 'https://www.pixiv.net/';
                }

                console.log('[Background] Headers:', headers);

                const response = await fetch(message.url, { headers });

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
