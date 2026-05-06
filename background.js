chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = request.tabId;
    if (!tabId) {
        console.error("No valid tab ID in sender.");
        return;
    }

    if (['increase', 'decrease', 'download', 'preview'].includes(request.action)) {
        const data = request.data;
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        }, () => {
            chrome.tabs.sendMessage(
                tabId,
                { action: request.action, data },
                (response) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ error: chrome.runtime.lastError.message });
                        return;
                    }
                    sendResponse(response);
                }
            );
        });
        return true; // keep the message channel open for async sendResponse
    }
});
