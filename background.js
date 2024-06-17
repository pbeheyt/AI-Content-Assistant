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
            try {
                const newTab = await chrome.tabs.create({ url, active: false });
                await chrome.storage.local.set({ contentTabId: newTab.id });
                await chrome.scripting.executeScript({
                    target: { tabId: newTab.id },
                    files: ['content.js']
                });

                chrome.tabs.onUpdated.addListener(function contentTabListener(tabId, changeInfo) {
                    if (tabId === newTab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(contentTabListener);
                    }
                });
            } catch (error) {
                console.error('Error creating or interacting with tab:', error);
            }
        } else if (["summarizePage", "summarizeSelectedText", "exploreSelectedText"].includes(info.menuItemId)) {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs.length > 0) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    });
                    chrome.runtime.sendMessage({ action: 'openGPT' });
                } else {
                    console.error('No active tab found.');
                }
            } catch (error) {
                console.error('Error executing script:', error);
            }
        }
    } catch (error) {
        console.error('Error handling context menu click:', error);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('chatgpt.com')) {
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
                    const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
                    await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
                    await chrome.tabs.update(gptTab.id, { active: true });
                } else {
                    await chrome.tabs.update(contentTabId, { active: true });
                    await chrome.tabs.remove(contentTabId);
                    const updatedTab = await safeGetTab(contentTabId);
                    if (!updatedTab) {
                        const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
                        await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
                        await chrome.tabs.update(gptTab.id, { active: true });
                    }
                }
            } else {
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