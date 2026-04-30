import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Твой проект klevby.com
const chatDb = createClient(
    'https://oecdshvozssadztcokog.supabase.co', 
    'sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS'
)

const chatHTML = `
    <div id="klevby-chat-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10001; align-items: center; justify-content: center;">
        <div style="width: 90%; max-width: 400px; background: #1a1212; border-radius: 24px; border: 1px solid #333; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
            <div style="padding: 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background: #1a1a1a;">
                <span style="color: #fff; font-weight: bold; font-family: Montserrat, sans-serif;">Чат Рыбаков 🎣</span>
                <button id="close-chat" style="background: none; border: none; color: #888; cursor: pointer; font-size: 28px;">&times;</button>
            </div>
            <div id="chat-messages" style="height: 350px; overflow-y: auto; padding: 15px; background: #0a1217; display: flex; flex-direction: column;"></div>
            <div style="padding: 15px; display: flex; gap: 10px; border-top: 1px solid #333; background: #1a1a1a;">
                <input type="text" id="message-input" placeholder="Напиши мужикам..." style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid #333; background: #111; color: #fff; outline: none; font-family: Montserrat, sans-serif;">
                <button id="send-btn" style="padding: 12px 20px; border-radius: 12px; background: #42d986; border: none; cursor: pointer; color: #000; font-weight: bold;">></button>
            </div>
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

const openChat = () => { chatModal.style.display = 'flex'; };
const closeChat = () => { chatModal.style.display = 'none'; };

// Слушаем клик по твоей кнопке "Чат" из основного кода
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#nav-chat') || e.target.closest('#nav-chat-btn');
    if (btn) {
        e.preventDefault();
        openChat();
    }
});

if (closeBtn) closeBtn.onclick = closeChat;

function addMessageToScreen(data) {
    if (!messagesContainer) return;
    const div = document.createElement('div');
    div.id = 'msg-' + data.id;
    div.style.cssText = 'margin-bottom: 12px; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; font-size: 14px; position: relative; font-family: Montserrat, sans-serif;';
    div.innerHTML = `
        <span style="color: #42d986; font-weight: bold;">${data.user_name || 'Рыбак'}:</span> 
        <span style="color: rgba(244,251,247,0.9);">${data.content}</span>
        <span onclick="deleteMsg('${data.id}')" style="cursor: pointer; position: absolute; right: 8px; top: 8px; font-size: 14px; opacity: 0.5;">🗑️</span>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

window.deleteMsg = async function(messageId) {
    const pass = prompt("Код админа:");
    if (pass === "1234") {
        await chatDb.from('messages').delete().eq('id', messageId);
        document.getElementById('msg-' + messageId)?.remove();
    }
};

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
