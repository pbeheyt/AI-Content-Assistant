chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
        id: "summarizeLinkedPage",
        title: "Summarize linked page",
        contexts: ["link"]
    });

    chrome.contextMenus.create({
        id: "summarizePage",
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

    try {
        const response = await fetch(chrome.runtime.getURL('config.json'));
        const config = await response.json();
        await chrome.storage.local.set({ gptConfig: config });
    } catch (error) {
        console.error('Error fetching or setting config:', error);
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    let configKey = "";
    if (info.menuItemId === "summarizeSelectedText") {
        configKey = "chatgptSummaryUrl";
    } else if (info.menuItemId === "exploreSelectedText") {
        configKey = "chatgptExplorerUrl";
    }

    try {
        const response = await fetch(chrome.runtime.getURL('config.json'));
        const config = await response.json();
        const gptUrl = config[configKey];
        await chrome.storage.local.set({ gptUrl });

        if (info.menuItemId === "summarizeLinkedPage") {
            await chrome.storage.local.set({ launchedViaContextMenu: true });
            const url = info.linkUrl;
            // console.log('Opening URL in new tab:', url);
            const newTab = await chrome.tabs.create({ url, active: false });
            await chrome.storage.local.set({ contentTabId: newTab.id });

            // Listen for URL changes
            const tabListener = async (tabId, changeInfo, tab) => {
                if (tabId === newTab.id && changeInfo.status === 'complete') {
                    // console.log('Page loaded:', tab.url);

                    // Check if the URL has changed due to redirection
                    if (tab.url !== url) {
                        // console.log('Final URL after redirection:', tab.url);
                        chrome.tabs.onUpdated.removeListener(tabListener);
                        await chrome.scripting.executeScript({
                            target: { tabId: newTab.id },
                            files: ['content.js']
                        }).catch(err => console.error('Error executing script:', err));
                    }
                }
            };

            chrome.tabs.onUpdated.addListener(tabListener);

            // Set a timeout to handle no redirection case
            setTimeout(async () => {
                const updatedTab = await chrome.tabs.get(newTab.id);
                if (updatedTab.status === 'complete') {
                    // console.log('No redirection detected, executing script on URL:', updatedTab.url);
                    chrome.scripting.executeScript({
                        target: { tabId: newTab.id },
                        files: ['content.js']
                    }).catch(err => console.error('Error executing script:', err));
                }
            }, 2000);
        } else if (["summarizePage", "summarizeSelectedText", "exploreSelectedText"].includes(info.menuItemId)) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                // console.log('Executing script on active tab URL:', tabs[0].url);
                await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content.js']
                });
                chrome.runtime.sendMessage({ action: 'openGPT' });
            } else {
                console.error('No active tab found.');
            }
        }
    } catch (error) {
        console.error('Error handling context menu click:', error);
    }
});



chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('chatgpt.com')) {
        console.log('Tab updated with URL:', tab.url); // Log the URL
        try {
            const { gptConfig } = await chrome.storage.local.get('gptConfig');
            const gptUrls = [
                gptConfig.chatgptSummaryUrl,
                gptConfig.chatgptExplorerUrl
            ];

            if (gptUrls.some(url => tab.url.includes(url))) {
                const result = await chrome.storage.local.get(['gptTabId', 'scriptInjected']);
                if (tabId === result.gptTabId && !result.scriptInjected) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['gpt-content.js']
                    });
                    await chrome.storage.local.set({ scriptInjected: true });
                }
            }
        } catch (error) {
            console.error('Error injecting script:', error);
        }
    }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'openGPT') {
        try {
            const result = await chrome.storage.local.get(['gptUrl', 'launchedViaContextMenu', 'contentTabId']);
            const { gptUrl, launchedViaContextMenu, contentTabId } = result;

            if (launchedViaContextMenu && sender.tab.id === contentTabId) {
                const tab = await safeGetTab(contentTabId);
                if (!tab) {
                    console.log('Creating new GPT tab with URL:', gptUrl); // Log the URL
                    const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
                    await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
                    await chrome.tabs.update(gptTab.id, { active: true });
                } else {
                    await chrome.tabs.update(contentTabId, { active: true });
                    await chrome.tabs.remove(contentTabId);
                    const updatedTab = await safeGetTab(contentTabId);
                    if (!updatedTab) {
                        console.log('Recreating new GPT tab with URL:', gptUrl); // Log the URL
                        const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
                        await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
                        await chrome.tabs.update(gptTab.id, { active: true });
                    }
                }
            } else {
                console.log('Creating GPT tab with URL:', gptUrl); // Log the URL
                const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
                await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
                await chrome.tabs.update(gptTab.id, { active: true });
            }
        } catch (error) {
            console.error('Error handling openGPT message:', error);
        }
    }
    sendResponse();
});

const handleRuntimeError = () => {
    const error = chrome.runtime.lastError;
    if (error) {
        throw new Error(error.message);
    }
};

const safeGetTab = async (tabId) => {
    try {
        const tab = await chrome.tabs.get(parseInt(tabId));
        handleRuntimeError();
        return tab;
    } catch (e) {
        console.log('safeGetTab', e.message);
        return null;
    }
};
