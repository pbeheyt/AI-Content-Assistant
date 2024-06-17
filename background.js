chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
        id: "summarizeLinkedPage",
        title: "Summarize page",
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

    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    await chrome.storage.local.set({ gptConfig: config });
});


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    let configKey = "";
    if (info.menuItemId === "summarizeSelectedText") {
        configKey = "chatgptSummaryUrl";
    } else if (info.menuItemId === "exploreSelectedText") {
        configKey = "chatgptExplorerUrl";
    }

    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    const gptUrl = config[configKey];

    await chrome.storage.local.set({ gptUrl });

    if (info.menuItemId === "summarizeLinkedPage") {
        await chrome.storage.local.set({ launchedViaContextMenu: true });
        const url = info.linkUrl;
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
    } else if (["summarizePage", "summarizeSelectedText", "exploreSelectedText"].includes(info.menuItemId)) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
        });
        chrome.runtime.sendMessage({ action: 'openGPT' });
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('chatgpt.com')) {
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
    }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'openGPT') {
        const result = await chrome.storage.local.get(['gptUrl', 'launchedViaContextMenu', 'contentTabId']);
        const { gptUrl, launchedViaContextMenu, contentTabId } = result;

        if (launchedViaContextMenu && sender.tab.id === contentTabId) {
            chrome.tabs.get(contentTabId, async (tab) => {
                if (!tab) {
                    const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
                    await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
                    await chrome.tabs.update(gptTab.id, { active: true });
                } else {
                    await chrome.tabs.update(contentTabId, { active: true });
                    await chrome.tabs.remove(contentTabId);
                    chrome.tabs.get(contentTabId, async (tab) => {
                        if (!tab) {
                            const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
                            await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
                            await chrome.tabs.update(gptTab.id, { active: true });
                        }
                    });
                }
            });
        } else {
            const gptTab = await chrome.tabs.create({ url: gptUrl, active: false });
            await chrome.storage.local.set({ gptTabId: gptTab.id, scriptInjected: false });
            await chrome.tabs.update(gptTab.id, { active: true });
        }
    }
    sendResponse();
});
