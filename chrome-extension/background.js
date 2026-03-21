chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'vkcoder-analyze',
    title: 'Analyze with VKCoder',
    contexts: ['page', 'selection', 'link', 'image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const serverUrl = 'http://localhost:3456';

  let message = '';
  if (info.selectionText) {
    message = `Analyze this text: ${info.selectionText}`;
  } else if (info.linkUrl) {
    message = `Analyze this URL: ${info.linkUrl}`;
  } else if (info.srcUrl) {
    message = `Analyze this image URL: ${info.srcUrl}`;
  } else {
    message = `Analyze this webpage: ${tab.url}\nTitle: ${tab.title}`;
  }

  // Open popup with the message
  chrome.storage.local.set({ pendingMessage: message, pageUrl: tab.url });
  chrome.action.openPopup();
});
