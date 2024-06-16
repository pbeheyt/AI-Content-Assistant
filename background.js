chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.");
    chrome.contextMenus.create({
        id: "openLinkAndPerformScript",
        title: "Summarize selected text",
        contexts: ["page"]
    });

    chrome.commands.onCommand.addListener((command) => {
        if (command === "summarize-selected-text") {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['article-content.js']
                });
            });
        }
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "openLinkAndPerformScript") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['article-content.js']
            });
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openGPT') {
        fetch(chrome.runtime.getURL('config.json'))
            .then(response => response.json())
            .then(config => {
                const chatgptUrl = config.chatgptUrl;
                chrome.tabs.create({ url: chatgptUrl, active: false }, (gptTab) => {
                    chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false }, () => {
                        chrome.tabs.update(gptTab.id, { active: true });
                    });
                });
            });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        fetch(chrome.runtime.getURL('config.json'))
            .then(response => response.json())
            .then(config => {
                if (tab.url.includes(config.chatgptUrl)) {
                    chrome.storage.local.get(['gptTabId', 'scriptInjected'], (result) => {
                        if (tabId === result.gptTabId && !result.scriptInjected) {
                            chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                files: ['gpt-content.js']
                            }, () => {
                                chrome.storage.local.set({ scriptInjected: true });
                            });
                        }
                    });
                }
            });
    }
});
