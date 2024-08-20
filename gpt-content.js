(() => {
    const insertData = (data) => {
        const promptField = document.querySelector('#prompt-textarea');
        if (promptField) {
            promptField.value = data;
            const inputEvent = new Event('input', { bubbles: true });
            promptField.dispatchEvent(inputEvent);
        } else {
            console.error('Prompt textarea not found');
        }
    };

    const sendPrompt = () => {
        const sendButton = document.querySelector('[data-testid="send-button"]');
        if (sendButton) {
            sendButton.click();
        } else {
            console.error('Send button not found');
        }
    };

    const handleProcess = async (selectedText) => {
        insertData(selectedText);
        sendPrompt();
    };

    const init = async () => {
        try {
            const result = await chrome.storage.local.get(['selectedText']);
            const observer = new MutationObserver((mutations, observer) => {
                if (document.querySelector('#prompt-textarea')) {
                    handleProcess(result.selectedText);
                    observer.disconnect();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        } catch (error) {
            console.error("Error retrieving selected text from storage:", error);
        }
    };

    init();
})();
