chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (['increase', 'decrease', 'openTab', 'preview', 'setKey'].includes(request.action)) {
        const tabId = request.tabId;
        if (!tabId) {
            sendResponse({ error: 'No valid tab ID.' });
            return;
        }
        chrome.tabs.sendMessage(
            tabId,
            { action: request.action, data: request.data, targetKey: request.targetKey },
            (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ error: chrome.runtime.lastError.message });
                    return;
                }
                sendResponse(response);
            }
        );
        return true;
    }
});
