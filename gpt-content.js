(() => {
    const insertData = (data) => {
        const promptField = document.querySelector('#prompt-textarea');
        if (promptField) {
            promptField.focus();  // Ensure focus on the textarea

            // Use execCommand to simulate user input
            document.execCommand('insertText', false, data);

            // Trigger the input event to notify the app of the change
            const inputEvent = new InputEvent('input', { bubbles: true });
            promptField.dispatchEvent(inputEvent);
        } else {
            console.error('Prompt textarea not found');
        }
    };

    const sendPrompt = () => {
        // Use MutationObserver to wait for the send button to appear
        const observer = new MutationObserver(() => {
            const sendButton = document.querySelector('[data-testid="send-button"]');
            if (sendButton && !sendButton.disabled && sendButton.offsetParent !== null) {
                console.log('Send button found, dispatching a simulated click event...');

                // Simulate a mouse click event
                const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                sendButton.dispatchEvent(event);
                observer.disconnect();  // Stop observing after the button is found and clicked
            } else if (!sendButton) {
                console.error('Send button not found');
            }
        });

        // Observe changes in the body for when the send button gets added to the DOM
        observer.observe(document.body, { childList: true, subtree: true });
    };

    const handleProcess = async (selectedText) => {
        insertData(selectedText);
        sendPrompt();  // Call sendPrompt to handle clicking the button
    };

    const init = async () => {
        try {
            const result = await chrome.storage.local.get(['selectedText']);
            const observer = new MutationObserver((mutations, observer) => {
                if (document.querySelector('#prompt-textarea')) {
                    handleProcess(result.selectedText);
                    observer.disconnect();  // Stop observing after the textarea is found
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        } catch (error) {
            console.error("Error retrieving selected text from storage:", error);
        }
    };

    init();
})();
