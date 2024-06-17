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
    const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
    if (sendButton) {
        sendButton.click();
    } else {
        console.error('Send button not found');
    }
};

const scrollToTopOfLastElement = () => {
    try {
        let elements = document.querySelectorAll('[data-testid^="conversation-turn"]');
        if (elements.length > 0) {
            let lastElement = elements[elements.length - 1];
            lastElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            console.error("No conversation elements found to scroll");
        }
    } catch (error) {
        console.error("Error scrolling to top of last element:", error);
    }
};

const handleProcess = async (selectedText) => {
    insertData(selectedText);
    sendPrompt();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                scrollToTopOfLastElement();
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        observer.disconnect();
    }, 5000);
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
