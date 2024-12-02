chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Ensure the sender.tab is defined
    const tabId = request.tabId;
    if (!tabId) {
        console.error("No valid tab ID in sender.");
        return;
    }

    if (['increase', 'decrease', 'download'].includes(request.action)) {
        const data = request.data;
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        }, () => {
            // After injecting, send the message again to trigger the action
            chrome.tabs.sendMessage(tabId, { action: request.action, data });
        });
    }
});
