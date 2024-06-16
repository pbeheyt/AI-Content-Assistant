chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "summarizeLinkedContent",
        title: "Summarize page",
        contexts: ["link"]
    });

    chrome.contextMenus.create({
        id: "summarizeContent",
        title: "Summarize page",
        contexts: ["page"]
    });

    chrome.contextMenus.create({
        id: "summarizeSelectedText",
        title: "Summarize",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "exploreSelectedText",
        title: "Explore",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "summarizeLinkedContent") {
        chrome.storage.local.set({ launchedViaContextMenu: true }, () => {
            const url = info.linkUrl;
            chrome.tabs.create({ url, active: false }, (newTab) => {
                chrome.storage.local.set({ contentTabId: newTab.id });

                chrome.scripting.executeScript({
                    target: { tabId: newTab.id },
                    files: ['content.js']
                });

                chrome.tabs.onUpdated.addListener(function contentTabListener(tabId, changeInfo) {
                    if (tabId === newTab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(contentTabListener);
                    }
                });
            });
        });
    } else if (info.menuItemId === "summarizeContent" || info.menuItemId === "summarizeSelectedText" || info.menuItemId === "exploreSelectedText") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js']
            }, () => {
                let configKey = "";
                if (info.menuItemId === "summarizeSelectedText") {
                    configKey = "chatgptSummaryUrl";
                } else if (info.menuItemId === "exploreSelectedText") {
                    configKey = "chatgptExplorerUrl";
                }

                fetch(chrome.runtime.getURL('config.json'))
                    .then(response => response.json())
                    .then(config => {
                        const gptUrl = config[configKey];
                        chrome.storage.local.set({ gptUrl }, () => {
                            chrome.runtime.sendMessage({ action: 'openGPT' });
                        });
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
                const gptUrls = [
                    config.chatgptSummaryUrl,
                    config.chatgptExplorerUrl
                ];

                if (gptUrls.some(url => tab.url.includes(url))) {
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openGPT') {
        chrome.storage.local.get(['gptUrl', 'launchedViaContextMenu', 'contentTabId'], (result) => {
            const { gptUrl, launchedViaContextMenu, contentTabId } = result;
            if (launchedViaContextMenu && sender.tab.id === contentTabId) {
                chrome.tabs.get(contentTabId, (tab) => {
                    if (!tab) {
                        chrome.tabs.create({ url: gptUrl, active: false }, (gptTab) => {
                            chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false }, () => {
                                chrome.tabs.update(gptTab.id, { active: true });
                            });
                        });
                    } else {
                        chrome.tabs.update(contentTabId, { active: true }, () => {
                            chrome.tabs.remove(contentTabId, () => {
                                chrome.tabs.get(contentTabId, (tab) => {
                                    if (!tab) {
                                        chrome.tabs.create({ url: gptUrl, active: false }, (gptTab) => {
                                            chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false }, () => {
                                                chrome.tabs.update(gptTab.id, { active: true });
                                            });
                                        });
                                    }
                                });
                            });
                        });
                    }
                });
            } else {
                chrome.tabs.create({ url: gptUrl, active: false }, (gptTab) => {
                    chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false }, () => {
                        chrome.tabs.update(gptTab.id, { active: true });
                    });
                });
            }
        });
    }
    sendResponse();
});

