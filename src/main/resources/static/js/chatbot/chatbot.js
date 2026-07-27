(function() {
    const STORAGE_KEY = 'planslotChatbotMessages';
    const CLIENT_ID_KEY = 'planslotChatbotClientId';
    const MAX_QUESTION_LENGTH = 100;
    const HISTORY_ROUNDS = 5;
    const COOLDOWN_MS = 3000;
    const GREETING = '안녕하세요. 플랜슬롯 이용 방법이 궁금한가요? 로그인하지 않아도 일정, 모임, 게시판, 알림 등 사용 방법을 질문할 수 있어요.';

    let messages = [];
    let isRequesting = false;
    let typingRow = null;
    let cooldownTimer = null;

    function getToken() {
        return localStorage.getItem('jwtToken');
    }

    function getClientId() {
        let clientId = sessionStorage.getItem(CLIENT_ID_KEY);
        if (clientId && /^[A-Za-z0-9_-]{16,80}$/.test(clientId)) return clientId;

        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            clientId = window.crypto.randomUUID();
        } else {
            clientId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
        }
        sessionStorage.setItem(CLIENT_ID_KEY, clientId);
        return clientId;
    }

    function clearAuthToken() {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('memberId');
        document.cookie = 'jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }

    function loadMessages() {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : [];
            messages = Array.isArray(parsed) ? parsed.filter(isValidStoredMessage) : [];
        } catch (e) {
            messages = [];
            sessionStorage.removeItem(STORAGE_KEY);
        }
    }

    function isValidStoredMessage(message) {
        return message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' && message.content.trim();
    }

    function saveMessages() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        } catch (e) {
            trimOldestConversation();
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
            } catch (ignored) {
                sessionStorage.removeItem(STORAGE_KEY);
            }
        }
    }

    function trimOldestConversation() {
        if (messages.length <= 2) {
            messages = [];
            return;
        }
        let removeCount = 1;
        if (messages[0] && messages[0].role === 'user' && messages[1] && messages[1].role === 'assistant') {
            removeCount = 2;
        }
        messages.splice(0, removeCount);
    }

    function clearStoredMessages() {
        messages = [];
        sessionStorage.removeItem(STORAGE_KEY);
    }

    function createMessageRow(message) {
        const row = document.createElement('div');
        row.className = `chatbot-message-row ${message.role}`;
        if (message.type === 'error') row.classList.add('error');

        if (message.role === 'assistant') {
            const avatar = document.createElement('div');
            avatar.className = 'chatbot-avatar';
            avatar.textContent = '🤖';
            row.appendChild(avatar);
        }

        const bubble = document.createElement('div');
        bubble.className = 'chatbot-bubble';
        bubble.textContent = message.content;
        row.appendChild(bubble);
        return row;
    }

    function renderMessages() {
        const container = document.getElementById('chatbotMessages');
        if (!container) return;
        container.innerHTML = '';
        container.appendChild(createMessageRow({ role: 'assistant', type: 'guide', content: GREETING }));
        messages.forEach(message => container.appendChild(createMessageRow(message)));
        scrollToBottom();
    }

    function scrollToBottom() {
        const container = document.getElementById('chatbotMessages');
        if (container) container.scrollTop = container.scrollHeight;
    }

    function appendMessage(message) {
        messages.push(message);
        saveMessages();
        const container = document.getElementById('chatbotMessages');
        if (container) container.appendChild(createMessageRow(message));
        scrollToBottom();
    }

    function updateMessageType(index, type) {
        if (messages[index]) {
            messages[index].type = type;
            saveMessages();
        }
    }

    function showTyping() {
        const container = document.getElementById('chatbotMessages');
        if (!container) return;
        typingRow = document.createElement('div');
        typingRow.className = 'chatbot-message-row assistant';

        const avatar = document.createElement('div');
        avatar.className = 'chatbot-avatar';
        avatar.textContent = '🤖';

        const bubble = document.createElement('div');
        bubble.className = 'chatbot-bubble chatbot-typing';
        bubble.setAttribute('aria-label', '답변 작성 중');
        bubble.innerHTML = '<span></span><span></span><span></span>';

        typingRow.appendChild(avatar);
        typingRow.appendChild(bubble);
        container.appendChild(typingRow);
        scrollToBottom();
    }

    function hideTyping() {
        if (typingRow) typingRow.remove();
        typingRow = null;
    }

    function buildHistory() {
        const pairs = [];
        for (let i = 0; i < messages.length - 1; i++) {
            const user = messages[i];
            const assistant = messages[i + 1];
            if (user.role === 'user' && user.type === 'normal' && assistant.role === 'assistant' && assistant.type === 'normal') {
                pairs.push([
                    { role: 'user', content: user.content },
                    { role: 'assistant', content: assistant.content }
                ]);
                i++;
            }
        }
        return pairs.slice(-HISTORY_ROUNDS).flat();
    }

    function setRequestState(requesting) {
        isRequesting = requesting;
        const input = document.getElementById('chatbotInput');
        const sendButton = document.getElementById('chatbotSend');
        if (input) input.disabled = requesting;
        if (sendButton) sendButton.disabled = requesting || !input || !input.value.trim();
    }

    function startCooldown() {
        const input = document.getElementById('chatbotInput');
        const sendButton = document.getElementById('chatbotSend');
        if (sendButton) sendButton.disabled = true;
        clearTimeout(cooldownTimer);
        cooldownTimer = setTimeout(() => {
            if (sendButton && input) sendButton.disabled = !input.value.trim();
        }, COOLDOWN_MS);
    }

    function requestChatbot(message, history, token) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Chatbot-Client-Id': getClientId()
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        return fetch('/api/chatbot/message', {
            method: 'POST',
            headers,
            body: JSON.stringify({ message, history })
        });
    }

    async function sendMessage() {
        const input = document.getElementById('chatbotInput');
        if (!input || isRequesting) return;

        const text = input.value.trim();
        const length = Array.from(text).length;
        if (!text) return;
        if (length > MAX_QUESTION_LENGTH) {
            appendMessage({ role: 'assistant', type: 'error', content: `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요.`, createdAt: Date.now() });
            return;
        }

        const history = buildHistory();
        const userIndex = messages.length;
        appendMessage({ role: 'user', type: 'pending', content: text, createdAt: Date.now() });
        input.value = '';
        updateInputState();
        setRequestState(true);
        showTyping();

        try {
            const token = getToken();
            let response = await requestChatbot(text, history, token);
            if (response.status === 401 && token) {
                clearAuthToken();
                response = await requestChatbot(text, history, null);
            }

            let result = null;
            try {
                result = await response.json();
            } catch (e) {
                result = null;
            }

            hideTyping();
            if (!response.ok || !result || !result.success) {
                updateMessageType(userIndex, 'failed');
                appendMessage({
                    role: 'assistant',
                    type: 'error',
                    content: result && result.message ? result.message : '현재 답변을 불러올 수 없어요. 잠시 후 다시 질문해 주세요.',
                    createdAt: Date.now()
                });
                return;
            }

            updateMessageType(userIndex, 'normal');
            appendMessage({ role: 'assistant', type: 'normal', content: result.answer, createdAt: Date.now() });
        } catch (e) {
            hideTyping();
            updateMessageType(userIndex, 'failed');
            appendMessage({ role: 'assistant', type: 'error', content: '현재 답변을 불러올 수 없어요. 잠시 후 다시 질문해 주세요.', createdAt: Date.now() });
        } finally {
            hideTyping();
            setRequestState(false);
            startCooldown();
            if (input) input.focus();
        }
    }

    function updateInputState() {
        const input = document.getElementById('chatbotInput');
        const sendButton = document.getElementById('chatbotSend');
        if (!input) return;
        const length = Array.from(input.value).length;
        if (sendButton && !isRequesting) sendButton.disabled = !input.value.trim() || length > MAX_QUESTION_LENGTH;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 92)}px`;
    }

    function openChatbot() {
        const windowElement = document.getElementById('chatbotWindow');
        const toggle = document.getElementById('chatbotToggle');
        if (!windowElement || !toggle) return;
        windowElement.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        toggle.style.display = 'none';
        renderMessages();
        const input = document.getElementById('chatbotInput');
        if (input) input.focus();
    }

    function closeChatbot() {
        const windowElement = document.getElementById('chatbotWindow');
        const toggle = document.getElementById('chatbotToggle');
        if (!windowElement || !toggle) return;
        windowElement.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.style.display = 'flex';
    }

    function clearConversation() {
        if (!confirm('대화 기록을 모두 지울까요?')) return;
        clearStoredMessages();
        renderMessages();
    }

    function observeExistingAiWidget() {
        const shell = document.getElementById('chatbotShell');
        const aiWidget = document.getElementById('aiFloatingWidget');
        if (!shell || !aiWidget) return;

        const syncPosition = () => {
            const visible = getComputedStyle(aiWidget).display !== 'none';
            shell.classList.toggle('ai-widget-open', visible);
        };
        syncPosition();
        new MutationObserver(syncPosition).observe(aiWidget, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    function initialize() {
        const shell = document.getElementById('chatbotShell');
        if (!shell) return;

        shell.hidden = false;
        loadMessages();
        renderMessages();
        observeExistingAiWidget();

        document.getElementById('chatbotToggle')?.addEventListener('click', openChatbot);
        document.getElementById('chatbotClose')?.addEventListener('click', closeChatbot);
        document.getElementById('chatbotClear')?.addEventListener('click', clearConversation);
        document.getElementById('chatbotSend')?.addEventListener('click', sendMessage);
        document.getElementById('chatbotInput')?.addEventListener('input', updateInputState);
        document.getElementById('chatbotInput')?.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
        updateInputState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
