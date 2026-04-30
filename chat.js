import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Твои данные подключения
const chatDb = createClient(
    'https://oecdshvozssadztcokog.supabase.co', 
    'sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS'
)

const chatHTML = `
    <div id="klevby-chat-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10001; align-items: center; justify-content: center;">
        <div style="width: 95%; max-width: 400px; background: #1a1212; border-radius: 20px; border: 1px solid #333; overflow: hidden; display: flex; flex-direction: column;">
            <div style="padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background: #1a1a1a;">
                <span style="color: #fff; font-weight: bold;">Чат Рыбаков 🎣</span>
                <button id="close-chat" style="background: none; border: none; color: #888; cursor: pointer; font-size: 30px;">&times;</button>
            </div>
            <div id="chat-messages" style="height: 300px; overflow-y: auto; padding: 15px; background: #0a1217; display: flex; flex-direction: column;"></div>
            <div style="padding: 10px; display: flex; gap: 8px; border-top: 1px solid #333;">
                <input type="text" id="message-input" placeholder="Напиши..." style="flex: 1; padding: 10px; border-radius: 10px; border: 1px solid #333; background: #111; color: #fff; outline: none;">
                <button id="send-btn" style="padding: 10px 15px; border-radius: 10px; background: #42d986; border: none; cursor: pointer; color: #000; font-weight: bold;">></button>
            </div>
        </div>
    </div>
`;

// Вставляем чат прямо в Body
document.body.insertAdjacentHTML('beforeend', chatHTML);

const modal = document.getElementById('klevby-chat-modal');
const messagesDiv = document.getElementById('chat-messages');
const input = document.getElementById('message-input');

// Самый надежный способ поймать клик по ЛЮБОЙ кнопке с твоими ID
document.addEventListener('click', (e) => {
    const isChatBtn = e.target.closest('#nav-chat') || e.target.closest('#nav-chat-btn') || e.target.closest('#chat-desktop-btn');
    if (isChatBtn) {
        e.preventDefault();
        modal.style.display = 'flex';
    }
    if (e.target.id === 'close-chat') {
        modal.style.display = 'none';
    }
});

// Рисуем сообщения с корзинкой
function renderMsg(data) {
    const div = document.createElement('div');
    div.id = 'msg-' + data.id;
    div.style.cssText = 'margin-bottom: 10px; color: #fff; font-size: 14px; position: relative; padding-right: 30px;';
    div.innerHTML = `
        <b style="color: #42d986;">${data.user_name || 'Рыбак'}:</b> ${data.content}
        <span onclick="deleteMsg('${data.id}')" style="position: absolute; right: 0; top: 0; cursor: pointer; opacity: 0.5;">🗑️</span>
    `;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Удаление по ПИНу
window.deleteMsg = async function(id) {
    if (prompt("Код:") === "1234") {
        await chatDb.from('messages').delete().eq('id', id);
        document.getElementById('msg-' + id)?.remove();
    }
};

// Отправка
async function send() {
    const val = input.value.trim();
    if (val) {
        await chatDb.from('messages').insert([{ user_name: 'Админ', content: val }]);
        input.value = '';
    }
}

document.getElementById('send-btn').onclick = send;
input.onkeypress = (e) => { if (e.key === 'Enter') send(); };

// Загрузка
async function start() {
    const { data } = await chatDb.from('messages').select('*').order('created_at', { ascending: true });
    if (data) data.forEach(renderMsg);

    chatDb.channel('messages').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
        if (payload.eventType === 'INSERT') renderMsg(payload.new);
        if (payload.eventType === 'DELETE') document.getElementById('msg-' + payload.old.id)?.remove();
    }).subscribe();
}

start();
