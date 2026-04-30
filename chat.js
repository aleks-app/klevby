import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Настройки подключения
const SUPABASE_URL = 'https://oecdshvozssadztcokog.supabase.co'
const SUPABASE_KEY = 'sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS'
// В шестой строке ниже теперь всё четко:
const chatDb = createClient(SUPABASE_URL, SUPABASE_KEY)

const chatHTML = `
    <div id="klevby-chat-modal" class="hidden" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 400px; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; z-index: 10001; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #fff; font-weight: bold;">Чат Рыбаков 🎣</span>
            <button id="close-chat" style="background: none; border: none; color: #888; cursor: pointer; font-size: 20px;">×</button>
        </div>
        <div id="chat-messages" style="height: 300px; overflow-y: auto; padding: 10px; background: #0a1217;"></div>
        <div style="padding: 10px; display: flex; gap: 8px;">
            <input type="text" id="message-input" placeholder="Напиши мужикам..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #111; color: #fff;">
            <button id="send-btn" style="padding: 10px 15px; border-radius: 8px; background: #42d986; border: none; cursor: pointer;">→</button>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', chatHTML);

const chatModal = document.getElementById('klevby-chat-modal');
const messagesContainer = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const closeBtn = document.getElementById('close-chat');

// Открытие/закрытие
const toggleChat = () => chatModal.classList.toggle('hidden');
if (closeBtn) closeBtn.onclick = toggleChat;

const navChatBtn = document.getElementById('nav-chat-btn');
const desktopBtn = document.getElementById('chat-desktop-btn');
if (navChatBtn) navChatBtn.onclick = toggleChat;
if (desktopBtn) desktopBtn.onclick = toggleChat;

// Отрисовка с корзиной
function addMessageToScreen(data) {
    if (!messagesContainer) return;
    const div = document.createElement('div');
    div.id = 'msg-' + data.id;
    div.style.cssText = 'margin-bottom: 8px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; font-size: 14px; position: relative;';
    div.innerHTML = `
        <span style="color: #42d986; font-weight: bold;">${data.user_name || 'Рыбак'}:</span> 
        <span style="color: rgba(244,251,247,0.82);">${data.content}</span>
        <span onclick="deleteMsg('${data.id}')" style="cursor: pointer; position: absolute; right: 8px; top: 8px; font-size: 14px; opacity: 0.5;">🗑️</span>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Удаление (Пароль: 1234)
window.deleteMsg = async function(messageId) {
    const pass = prompt("Пин-код для удаления:");
    if (pass === "1234") {
        await chatDb.from('messages').delete().eq('id', messageId);
        const msgElement = document.getElementById('msg-' + messageId);
        if (msgElement) msgElement.remove();
        alert("Удалено!");
    } else if (pass !== null) {
        alert("Неверный код!");
    }
}

async function sendMessage() {
    const content = messageInput.value.trim();
    if (content) {
        const savedName = localStorage.getItem('klevby_author_name') || 'Аноним';
        await chatDb.from('messages').insert([{ user_name: savedName, content: content }]);
        messageInput.value = '';
    }
}

if (sendBtn) sendBtn.onclick = sendMessage;
if (messageInput) messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

async function initChat() {
    const { data } = await chatDb.from('messages').select('*').order('created_at', { ascending: true });
    if (data) data.forEach(msg => addMessageToScreen(msg));

    chatDb.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        addMessageToScreen(payload.new);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        const msgElement = document.getElementById('msg-' + payload.old.id);
        if (msgElement) msgElement.remove();
    })
    .subscribe();
}

initChat();
