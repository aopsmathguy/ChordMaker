
const columns = document.getElementById('columns');
const maxWidth = document.getElementById('maxWidth');
const theme0 = document.getElementById('theme0');
const theme1 = document.getElementById('theme1');
const theme2 = document.getElementById('theme2');
document.addEventListener('DOMContentLoaded', () => {
  
    // Load saved settings (if any)
    columns.value = (localStorage.getItem('columns')) || 2;
    maxWidth.value = (localStorage.getItem('maxWidth')) || 50;
    theme0.value = localStorage.getItem('theme0') || "#ffffff";
    theme1.value = localStorage.getItem('theme1') || "#000000";
    theme2.value = localStorage.getItem('theme2') || "#ff0000";  
  
    // Listen for changes and save to localStorage
    columns.addEventListener('change', () => {
      localStorage.setItem('columns', columns.value);
    });
  
    maxWidth.addEventListener('change', () => {
      localStorage.setItem('maxWidth', maxWidth.value);
    });

    theme0.addEventListener('change', () => {
        localStorage.setItem('theme0', theme0.value);
    });
    theme1.addEventListener('change', () => {
        localStorage.setItem('theme1', theme1.value);
    });
    theme2.addEventListener('change', () => {
        localStorage.setItem('theme2', theme2.value);
    });
});
function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    let bigint = parseInt(hex, 16);
    return [
        (bigint >> 16) & 255,
        (bigint >> 8) & 255,
        bigint & 255
    ]
}

function sendMessage(action, data) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.error("No active tab found.");
            return;
        }

        const activeTabId = tabs[0].id;

        // Send the action and tabId to the background script
        chrome.runtime.sendMessage({ action: action, data : data, tabId: activeTabId });
    });
}

document.getElementById('increase').addEventListener('click', () => {
    sendMessage('increase');
});

document.getElementById('decrease').addEventListener('click', () => {
    sendMessage('decrease');
});
document.getElementById('download').addEventListener('click', () => {
    const theme = [hexToRgb(theme0.value), hexToRgb(theme1.value), hexToRgb(theme2.value)];
    const data = { columns: parseInt(columns.value), maxWidth : parseInt(maxWidth.value), theme: theme }
    sendMessage('download', data);
});