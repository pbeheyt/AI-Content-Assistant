(() => {
    /**
     * Configuration constants for DOM selectors and timing
     */
    const CONFIG = {
        SELECTORS: {
            PROMPT_TEXTAREA: '#prompt-textarea',
            SEND_BUTTON: '[data-testid="send-button"]'
        },
        TIMING: {
            SEND_DELAY: 500,
            RETRY_DELAY: 1000,
            MAX_RETRIES: 3
        }
    };

    /**
     * Custom error class for handling DOM element not found scenarios
     */
    class ElementNotFoundError extends Error {
        constructor(elementName) {
            super(`Element not found: ${elementName}`);
            this.name = 'ElementNotFoundError';
        }
    }

    /**
     * Safely queries the DOM for an element, with retry mechanism
     * @param {string} selector - The CSS selector to find the element
     * @param {number} retries - Number of retries remaining
     * @returns {Promise<Element>} - The found DOM element
     * @throws {ElementNotFoundError} - If element is not found after retries
     */
    const getElement = async (selector, retries = CONFIG.TIMING.MAX_RETRIES) => {
        const element = document.querySelector(selector);
        if (element) return element;
        
        if (retries <= 0) {
            throw new ElementNotFoundError(selector);
        }

        await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.RETRY_DELAY));
        return getElement(selector, retries - 1);
    };

    /**
     * Inserts data into the prompt textarea and triggers input event
     * @param {string} data - The text to insert
     * @returns {Promise<void>}
     */
    const insertData = async (data) => {
        try {
            const promptField = await getElement(CONFIG.SELECTORS.PROMPT_TEXTAREA);
            promptField.value = data;
            promptField.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (error) {
            console.error('Failed to insert data:', error);
            throw error;
        }
    };

    /**
     * Triggers the send button click with proper validation
     * @returns {Promise<void>}
     */
    const sendPrompt = async () => {
        try {
            const sendButton = await getElement(CONFIG.SELECTORS.SEND_BUTTON);
            await new Promise(resolve => setTimeout(resolve, CONFIG.TIMING.SEND_DELAY));
            sendButton.click();
        } catch (error) {
            console.error('Failed to send prompt:', error);
            throw error;
        }
    };

    /**
     * Handles the process of inserting and sending the prompt
     * @param {string} selectedText - The text to process
     * @returns {Promise<void>}
     */
    const handleProcess = async (selectedText) => {
        if (!selectedText?.trim()) {
            console.warn('No valid text provided for processing');
            return;
        }

        try {
            await insertData(selectedText);
            await sendPrompt();
        } catch (error) {
            console.error('Process handling failed:', error);
        }
    };

    /**
     * Initializes the content script functionality
     * @returns {Promise<void>}
     */
    const init = async () => {
        try {
            const { selectedText } = await chrome.storage.local.get(['selectedText']);
            
            const observer = new MutationObserver((mutations, observer) => {
                if (document.querySelector(CONFIG.SELECTORS.PROMPT_TEXTAREA)) {
                    observer.disconnect();
                    handleProcess(selectedText).catch(error => {
                        console.error('Failed to handle process after DOM ready:', error);
                    });
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    };

    // Start the initialization process
    init();
})();
