(() => {
    console.log("Claude content script loaded");

    function insertText(text) {
        let editorElement = document.querySelector('p[data-placeholder="How can Claude help you today?"]');
        
        if (!editorElement) {
            editorElement = document.querySelector('[contenteditable="true"]');
        }
        
        if (!editorElement) {
            console.error('Claude editor element not found');
            return false;
        }

        // Clear existing content
        editorElement.innerHTML = '';
        
        // Split the text into lines and create paragraphs
        const lines = text.split('\n');
        lines.forEach((line, index) => {
            const p = document.createElement('p');
            p.textContent = line;
            editorElement.appendChild(p);
            
            if (index < lines.length - 1) {
                editorElement.appendChild(document.createElement('br'));
            }
        });

        // Trigger input event
        editorElement.dispatchEvent(new Event('input', { bubbles: true }));

        // Click send button
        setTimeout(() => {
            const sendButton = 
                document.querySelector('button[aria-label="Send message"]') ||
                document.querySelector('button[aria-label="Send Message"]') ||
                document.querySelector('button svg path[d*="M208.49,120.49"]')?.closest('button');

            if (sendButton) {
                console.log('Send button found, clicking...');
                sendButton.click();
            } else {
                console.error('Send button not found');
            }
        }, 1000);

        return true;
    }

    async function init() {
        try {
            const { prePrompt, selectedText } = await chrome.storage.local.get(['prePrompt', 'selectedText']);
            
            if (!prePrompt || !selectedText) {
                console.log('No text to process found in storage');
                return;
            }

            const fullText = `${prePrompt}\n\n${selectedText}`;
            console.log('Attempting to insert text');
            
            // Wait for editor to be available
            const checkInterval = setInterval(() => {
                const editorElement = document.querySelector('[contenteditable="true"]');
                if (editorElement) {
                    clearInterval(checkInterval);
                    insertText(fullText);
                }
            }, 500);

            // Stop checking after 10 seconds
            setTimeout(() => clearInterval(checkInterval), 10000);

        } catch (error) {
            console.error('Error in initialization:', error);
        }
    }

    // Start initialization when the script loads
    init();
})();