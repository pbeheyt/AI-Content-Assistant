chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.");
    chrome.contextMenus.create({
        id: "summarizeLinkedArticle",
        title: "Summarize linked article",
        contexts: ["link"]
    });

    chrome.contextMenus.create({
        id: "summarizeArticle",
        title: "Summarize article",
        contexts: ["page"]
    });

    chrome.commands.onCommand.addListener((command) => {
        if (command === "summarize-selected-text") {
            chrome.storage.local.set({ launchedViaContextMenu: false }, () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['article-content.js']
                    });
                });
            });
        }
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "summarizeLinkedArticle") {
        console.log(`Context menu item clicked in tab with ID: ${tab.id} and URL: ${info.linkUrl}`);
        chrome.storage.local.set({ launchedViaContextMenu: true }, () => {
            const url = info.linkUrl;
            chrome.tabs.create({ url, active: false }, (newTab) => {
                console.log(`Created new tab with ID: ${newTab.id} for URL: ${url}`);

                // Store the new tab ID immediately
                chrome.storage.local.set({ articleTabId: newTab.id }, () => {
                    console.log(`Stored articleTabId: ${newTab.id} in local storage`);
                });

                chrome.scripting.executeScript({
                    target: { tabId: newTab.id },
                    files: ['article-content.js']
                }, () => {
                    console.log(`Executed script in new tab with ID: ${newTab.id}`);
                });

                chrome.tabs.onUpdated.addListener(function articleTabListener(tabId, changeInfo, tab) {
                    if (tabId === newTab.id && changeInfo.status === 'complete') {
                        console.log(`Tab with ID: ${newTab.id} has completed loading`);
                        chrome.tabs.onUpdated.removeListener(articleTabListener);
                        // Optionally update or handle further actions here
                    }
                });
            });
        });
    } else if (info.menuItemId === "summarizeArticle") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['article-content.js']
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'log') {
        console.log(request.message);
    } else if (request.action === 'verifyStorage') {
        chrome.storage.local.get(['gptTabId', 'scriptInjected'], (storedData) => {
            if (chrome.runtime.lastError) {
                console.error("Error retrieving storage:", chrome.runtime.lastError);
            } else {
                console.log("Verified stored data:", storedData);
                if (!storedData.gptTabId || storedData.scriptInjected === undefined) {
                    console.warn("gptTabId or scriptInjected not set properly.", storedData);
                }
            }
        });
    } else if (request.action === 'openGPT') {
        fetch(chrome.runtime.getURL('config.json'))
            .then(response => response.json())
            .then(config => {
                const chatgptUrl = config.chatgptUrl;
                chrome.storage.local.get(['launchedViaContextMenu', 'articleTabId'], (result) => {
                    const { launchedViaContextMenu, articleTabId } = result;

                    if (launchedViaContextMenu && sender.tab.id === articleTabId) {
                        console.log(`Checking if article tab with ID: ${articleTabId} exists`);
                        // Check if the article tab exists before switching to it
                        chrome.tabs.get(articleTabId, (tab) => {
                            if (chrome.runtime.lastError || !tab) {
                                console.error(`Article tab with ID: ${articleTabId} does not exist. Error: ${chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No tab found'}`);
                                // Proceed with opening the ChatGPT tab even if the article tab does not exist
                                chrome.tabs.create({ url: chatgptUrl, active: false }, (gptTab) => {
                                    console.log(`Opening ChatGPT tab with ID: ${gptTab.id}`);
                                    chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false }, () => {
                                        chrome.tabs.update(gptTab.id, { active: true });
                                    });
                                });
                            } else {
                                console.log(`Switching to article tab with ID: ${articleTabId}`);
                                // Switch to the article tab before closing it
                                chrome.tabs.update(articleTabId, { active: true }, () => {
                                    console.log(`Article tab with ID: ${articleTabId} is now active`);
                                    // Close the article tab if it was opened via context menu
                                    chrome.tabs.remove(articleTabId, () => {
                                        if (chrome.runtime.lastError) {
                                            console.error(`Error closing article tab: ${chrome.runtime.lastError.message}`);
                                        } else {
                                            console.log(`Closed article tab with ID: ${articleTabId}`);
                                            // Check if the tab is really closed
                                            chrome.tabs.get(articleTabId, (tab) => {
                                                if (chrome.runtime.lastError || !tab) {
                                                    console.log(`Confirmed article tab with ID: ${articleTabId} is closed.`);
                                                } else {
                                                    console.error(`Article tab with ID: ${articleTabId} is still open.`);
                                                }
                                            });
                                            // Proceed to open the ChatGPT tab
                                            chrome.tabs.create({ url: chatgptUrl, active: false }, (gptTab) => {
                                                console.log(`Opening ChatGPT tab with ID: ${gptTab.id}`);
                                                chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false }, () => {
                                                    chrome.tabs.update(gptTab.id, { active: true });
                                                });
                                            });
                                        }
                                    });
                                });
                            }
                        });
                    } else {
                        console.log('Not closing current tab, opening ChatGPT', launchedViaContextMenu, sender.tab.id, articleTabId);
                        // Do not close the current tab, just open ChatGPT
                        chrome.tabs.create({ url: chatgptUrl, active: false }, (gptTab) => {
                            console.log(`Opening ChatGPT tab with ID: ${gptTab.id}`);
                            chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false }, () => {
                                chrome.tabs.update(gptTab.id, { active: true });
                            });
                        });
                    }
                });
            });
    }
    sendResponse();
});
