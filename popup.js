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
let columns = document.getElementById('columns').value;
let maxWidth = document.getElementById('maxWidth').value;
document.getElementById('columns').addEventListener('change', (event) => {
    columns = event.target.value;
});
document.getElementById('maxWidth').addEventListener('change', (event) => {
    maxWidth = event.target.value;
});
document.getElementById('download').addEventListener('click', () => {
    sendMessage('download', { columns, maxWidth });
});