import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Подключение к твоей базе klevby.com
const chatDb = createClient(
    'https://oecdshvozssadztcokog.supabase.co', 
    'sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS'
)

const chatHTML = `
    <div id="klevby-chat-modal" class="hidden" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 400px; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; z-index: 10001; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: sans-serif;">
        <div style="padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #fff; font-weight: bold;">Чат Рыбаков 🎣</span>
            <button id="close-chat" style="background: none; border: none; color: #888; cursor: pointer; font-size: 24px;">&times;</button>
        </div>
        <div id="chat-messages" style="height: 300px; overflow-y: auto; padding: 10px; background: #0a1217; display: flex; flex-direction: column;"></div>
        <div style="padding: 10px; display: flex; gap: 8px; border-top: 1px solid #333;">
            <input type="text" id="message-input" placeholder="Напиши мужикам..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #111; color: #fff; outline: none;">
            <button id="send-btn" style="padding: 10px 15px; border-radius: 8px; background: #42d986; border: none; cursor: pointer; color: #000; font-weight: bold;">></button>
        </div>
    </div>
`;

if (!document.getElementById('klevby-chat-modal')) {
    document.body.insertAdjacentHTML('beforeend', chatHTML);
}

const chatModal = document.getElementById('klevby-chat-modal');
const messagesContainer = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const closeBtn = document.getElementById('close-chat');

const toggleChat = () => chatModal.classList.toggle('hidden');

// ИСПРАВЛЕНО: Ловим все варианты ID кнопок, включая твой nav-chat
document.addEventListener('click', (e) => {
    if (
        e.target.closest('#nav-chat') || 
        e.target.closest('#nav-chat-btn') || 
        e.target.closest('#chat-desktop-btn')
    ) {
        toggleChat();
    }
});

if (closeBtn) closeBtn.onclick = toggleChat;

function addMessageToScreen(data) {
    if (!messagesContainer) return;
    const div = document.createElement('div');
    div.id = 'msg-' + data.id;
    div.style.cssText = 'margin-bottom: 8px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; font-size: 14px; position: relative;';
    div.innerHTML = `
        <span style="color: #42d986; font-weight: bold;">${data.user_name || 'Рыбак'}:</span> 
        <span style="color: rgba(244,251,247,0.82);">${data.content}</span>
        <span onclick="deleteMsg('${data.id}')" style="cursor: pointer; position: absolute; right: 8px; top: 8px; font-size: 12px; opacity: 0.4;">🗑️</span>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Удаление по пин-коду (для теста пока 1234)
window.deleteMsg = async function(messageId) {
    const pass = prompt("Пин-код админа:");
    if (pass === "1234") {
        const { error } = await chatDb.from('messages').delete().eq('id', messageId);
        if (!error) document.getElementById('msg-' + messageId)?.remove();
    }
};

async function sendMessage() {
    const content = messageInput.value.trim();
    if (content) {
        const savedName = localStorage.getItem('klevby_author_name') || 'Аноним';
        const { error } = await chatDb.from('messages').insert([{ user_name: savedName, content: content }]);
        if (error) {
            console.error('Ошибка:', error.message);
        } else {
            messageInput.value = '';
        }
    }
}

if (sendBtn) sendBtn.onclick = sendMessage;
if (messageInput) messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

async function initChat() {
    const { data, error } = await chatDb.from('messages').select('*').order('created_at', { ascending: true });
    if (error) {
        console.error('Ошибка загрузки:', error.message);
        return;
    }
    if (data) {
        messagesContainer.innerHTML = '';
        data.forEach(msg => addMessageToScreen(msg));
    }

    chatDb.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        addMessageToScreen(payload.new);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        document.getElementById('msg-' + payload.old.id)?.remove();
    })
    .subscribe();
}

initChat();
