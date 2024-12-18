document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup initialized');

    try {
        // Load config first
        const config = await fetch(chrome.runtime.getURL('config.json')).then(r => r.json());
        
        // Load saved preference
        const { useClaudeAI = false } = await chrome.storage.local.get('useClaudeAI');
        document.getElementById('aiToggle').checked = useClaudeAI;
        console.log('Loaded AI preference:', useClaudeAI);

        // Save preference when changed
        document.getElementById('aiToggle').addEventListener('change', (e) => {
            chrome.storage.local.set({ useClaudeAI: e.target.checked });
            console.log('AI preference changed to:', e.target.checked);
        });

        async function handleButtonClick(type) {
            console.log('Button clicked:', type);
            
            try {
                // Get active tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (!tab) {
                    throw new Error('No active tab found');
                }
                console.log('Active tab:', tab.id);

                // Inject content script manually if needed
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    console.log('Content script injected');
                } catch (error) {
                    console.log('Content script already present or injection failed:', error);
                }

                const useClaudeAI = document.getElementById('aiToggle').checked;
                const aiUrl = useClaudeAI ? config.claudeUrl : config.chatgptUrl;
                const prePrompt = type === 'summarize' ? config.prePromptSummary : config.prePromptExplorer;

                // Send message to content script
                console.log('Sending getText message to content script');
                const response = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'getText' }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });

                console.log('Received response:', response);

                if (!response?.text) {
                    throw new Error('No text found on the page');
                }

                // Store data
                await chrome.storage.local.set({
                    prePrompt,
                    selectedText: response.text,
                    scriptInjected: false,
                    useClaudeAI
                });
                console.log('Data stored in local storage');

                // Open new tab
                await chrome.tabs.create({ url: aiUrl });
                window.close();
            } catch (error) {
                console.error('Error in handleButtonClick:', error);
                alert(`Error: ${error.message}`);
            }
        }

        // Button listeners
        document.getElementById('summarizeBtn').addEventListener('click', () => handleButtonClick('summarize'));
        document.getElementById('exploreBtn').addEventListener('click', () => handleButtonClick('explore'));

    } catch (error) {
        console.error('Error loading config:', error);
        alert('Error loading extension configuration');
    }
});