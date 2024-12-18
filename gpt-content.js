(() => {
    console.log("ChatGPT content script loaded");

    function insertText(text) {
        const editorElement = document.querySelector('#prompt-textarea.ProseMirror');
        if (!editorElement) {
            console.error('ChatGPT editor element not found');
            return false;
        }

        try {
            // Clear existing content
            editorElement.innerHTML = '';
            
            // Split the text into paragraphs and create p elements
            const paragraphs = text.split('\n');
            paragraphs.forEach((paragraph, index) => {
                if (paragraph.trim() === '') {
                    // Add empty paragraph with break
                    const p = document.createElement('p');
                    p.appendChild(document.createElement('br'));
                    editorElement.appendChild(p);
                } else {
                    // Add text paragraph
                    const p = document.createElement('p');
                    p.textContent = paragraph;
                    editorElement.appendChild(p);
                }
            });

            // Remove placeholder class if it exists
            const placeholderP = editorElement.querySelector('p.placeholder');
            if (placeholderP) {
                placeholderP.classList.remove('placeholder');
            }

            // Focus the editor
            editorElement.focus();

            // Dispatch input event
            const inputEvent = new Event('input', { bubbles: true });
            editorElement.dispatchEvent(inputEvent);

            // Find and click the send button
            setTimeout(() => {
                const sendButton = document.querySelector('button[data-testid="send-button"]:not(:disabled)');
                if (sendButton) {
                    console.log('Send button found, clicking...');
                    
                    // Create and dispatch multiple events for better compatibility
                    ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                        const event = new MouseEvent(eventType, {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                            buttons: 1
                        });
                        sendButton.dispatchEvent(event);
                    });
                } else {
                    console.error('Send button not found or disabled');
                }
            }, 1000);

            return true;
        } catch (error) {
            console.error('Error inserting text:', error);
            return false;
        }
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
                const editorElement = document.querySelector('#prompt-textarea.ProseMirror');
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