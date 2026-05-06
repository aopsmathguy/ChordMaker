const columns = document.getElementById('columns');
const maxWidth = document.getElementById('maxWidth');
const theme0 = document.getElementById('theme0');
const theme1 = document.getElementById('theme1');
const theme2 = document.getElementById('theme2');
const preferFlats = document.getElementById('preferFlats');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

const SETTING_KEYS = ['columns', 'maxWidth', 'theme0', 'theme1', 'theme2', 'preferFlats'];
const DEFAULTS = {
    columns: 2,
    maxWidth: 50,
    theme0: '#ffffff',
    theme1: '#000000',
    theme2: '#ff0000',
    preferFlats: false,
};

function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    let bigint = parseInt(hex, 16);
    return [
        (bigint >> 16) & 255,
        (bigint >> 8) & 255,
        bigint & 255
    ];
}

function currentData() {
    return {
        columns: parseInt(columns.value),
        maxWidth: parseInt(maxWidth.value),
        theme: [hexToRgb(theme0.value), hexToRgb(theme1.value), hexToRgb(theme2.value)],
        preferFlats: preferFlats.checked,
    };
}

function showPreview(pdfDataUrl) {
    preview.src = pdfDataUrl;
    status.textContent = '';
}

function sendMessage(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            status.textContent = 'No active tab.';
            return;
        }
        const activeTabId = tabs[0].id;
        status.textContent = 'Rendering…';
        chrome.runtime.sendMessage(
            { action, data: currentData(), tabId: activeTabId },
            (response) => {
                if (chrome.runtime.lastError) {
                    status.textContent = chrome.runtime.lastError.message;
                    return;
                }
                if (!response) {
                    status.textContent = 'No response from page.';
                    return;
                }
                if (response.error) {
                    status.textContent = response.error;
                    return;
                }
                if (response.pdfDataUrl) showPreview(response.pdfDataUrl);
            }
        );
    });
}

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
        columns.value = stored.columns;
        maxWidth.value = stored.maxWidth;
        theme0.value = stored.theme0;
        theme1.value = stored.theme1;
        theme2.value = stored.theme2;
        preferFlats.checked = !!stored.preferFlats;

        const persistAndPreview = (el, key) => {
            el.addEventListener('change', () => {
                chrome.storage.sync.set({ [key]: el.value });
                sendMessage('preview');
            });
        };
        persistAndPreview(columns, 'columns');
        persistAndPreview(maxWidth, 'maxWidth');
        persistAndPreview(theme0, 'theme0');
        persistAndPreview(theme1, 'theme1');
        persistAndPreview(theme2, 'theme2');
        preferFlats.addEventListener('change', () => {
            chrome.storage.sync.set({ preferFlats: preferFlats.checked });
            sendMessage('preview');
        });

        sendMessage('preview');
    });
});

document.getElementById('increase').addEventListener('click', () => {
    sendMessage('increase');
});

document.getElementById('decrease').addEventListener('click', () => {
    sendMessage('decrease');
});

document.getElementById('openTab').addEventListener('click', () => {
    sendMessage('openTab');
});
