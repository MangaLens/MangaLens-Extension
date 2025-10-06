const statusDiv = document.getElementById('status');
const toggleBtn = document.getElementById('toggle');

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

toggleBtn.addEventListener('click', async () => {
    const { enabled } = await chrome.storage.sync.get(['enabled']);
    await chrome.storage.sync.set({ enabled: !enabled });
    updateButton();
});

async function updateButton() {
    const { enabled } = await chrome.storage.sync.get(['enabled']);
    toggleBtn.textContent = enabled ? 'Disable' : 'Enable';
}

checkServer();
updateButton();
