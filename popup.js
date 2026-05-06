const columns = document.getElementById('columns');
const maxWidth = document.getElementById('maxWidth');
const theme0 = document.getElementById('theme0');
const theme1 = document.getElementById('theme1');
const theme2 = document.getElementById('theme2');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

let currentPreviewUrl = null;

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
    };
}

function base64ToBlob(b64, type) {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type });
}

function showPreview(pdfBase64) {
    const blob = base64ToBlob(pdfBase64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    preview.src = url;
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = url;
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
                if (response.pdfBase64) showPreview(response.pdfBase64);
            }
        );
    });
}

document.addEventListener('DOMContentLoaded', () => {
    columns.value = localStorage.getItem('columns') || 2;
    maxWidth.value = localStorage.getItem('maxWidth') || 50;
    theme0.value = localStorage.getItem('theme0') || "#ffffff";
    theme1.value = localStorage.getItem('theme1') || "#000000";
    theme2.value = localStorage.getItem('theme2') || "#ff0000";

    const persistAndPreview = (el, key) => {
        el.addEventListener('change', () => {
            localStorage.setItem(key, el.value);
            sendMessage('preview');
        });
    };
    persistAndPreview(columns, 'columns');
    persistAndPreview(maxWidth, 'maxWidth');
    persistAndPreview(theme0, 'theme0');
    persistAndPreview(theme1, 'theme1');
    persistAndPreview(theme2, 'theme2');

    sendMessage('preview');
});

document.getElementById('increase').addEventListener('click', () => {
    sendMessage('increase');
});

document.getElementById('decrease').addEventListener('click', () => {
    sendMessage('decrease');
});

document.getElementById('download').addEventListener('click', () => {
    sendMessage('download');
});
