(function() {
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

    const selectedText = window.getSelection().toString().trim();
    const textToProcesss = selectedText || getVisibleText();

    if (textToProcesss) {
        chrome.storage.local.set({ selectedText: textToProcesss }, () => {
            console.log('Text to summarize saved:', textToProcesss);
            chrome.runtime.sendMessage({
                action: 'openGPT'
            });
        });
    } else {
        alert('No text found on the page.');
    }
})();
