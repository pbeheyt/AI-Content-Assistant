chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.log("Tab updated:", tabId, changeInfo.status);
    
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const { selectedText, prePrompt, useClaudeAI } = await chrome.storage.local.get([
                'selectedText',
                'prePrompt',
                'useClaudeAI'
            ]);

            // Only proceed if we have text to process
            if (!selectedText || !prePrompt) {
                return;
            }

            const isAIService = (useClaudeAI && tab.url.includes('claude.ai')) || 
                              (!useClaudeAI && tab.url.includes('chatgpt.com'));

            if (isAIService) {
                console.log("Injecting AI script for tab:", tabId);
                
                // Inject the content script
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: [useClaudeAI ? 'claude-content.js' : 'gpt-content.js']
                });

                // Clear the storage right after injecting the script
                await chrome.storage.local.remove(['selectedText', 'prePrompt']);
            }
        } catch (error) {
            console.error('Error in tab update listener:', error);
        }
    }
});

chrome.runtime.onInstalled.addListener(async () => {
    const { useClaudeAI } = await chrome.storage.local.get(['useClaudeAI']);
    if (useClaudeAI === undefined) {
        await chrome.storage.local.set({ useClaudeAI: true });
    }
});