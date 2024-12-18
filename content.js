(function() {
    console.log("Content script loaded!"); // Debug log

    function getVisibleText() {
        let bodyText = '';
        function extractText(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.trim().length > 0) {
                    return node.textContent;
                }
                return '';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                const excludedTags = ['script', 'style', 'img', 'svg', 'footer', 'nav', 'noscript'];
                if (excludedTags.includes(tagName)) {
                    return '';
                }
                const style = window.getComputedStyle(node);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    let text = '';
                    node.childNodes.forEach(child => {
                        text += extractText(child);
                    });
                    return text;
                }
                return '';
            }
            return '';
        }
        document.body.childNodes.forEach(child => {
            bodyText += extractText(child);
        });
        return bodyText.trim();
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Message received in content script:", request); // Debug log
        if (request.action === 'getText') {
            const selectedText = window.getSelection().toString().trim();
            const textToProcess = selectedText || getVisibleText();
            console.log("Text found:", textToProcess.substring(0, 100) + "..."); // Debug log
            if (textToProcess) {
                sendResponse({ text: textToProcess });
            } else {
                sendResponse({ error: 'No text found on page' });
            }
        }
        return true;
    });
})();