// Простейшее подключение без импортов
const SUPABASE_URL = 'https://oecdshvozssadztcokog.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS';
// Подтягиваем базу из того, что уже загружено в index.html
const chatDb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const chatHTML = `
    <div id="klevby-chat-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10001; align-items: center; justify-content: center;">
        <div style="width: 90%; max-width: 400px; background: #1a1a1a; border-radius: 15px; border: 1px solid #333; overflow: hidden;">
            <div style="padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #fff; font-weight: bold;">Чат Рыбаков 🎣</span>
                <button id="close-chat" style="background: none; border: none; color: #888; cursor: pointer; font-size: 30px;">&times;</button>
            </div>
            <div id="chat-messages" style="height: 300px; overflow-y: auto; padding: 10px; background: #0a1217;"></div>
            <div style="padding: 10px; display: flex; gap: 8px;">
                <input type="text" id="message-input" placeholder="Напиши..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #111; color: #fff;">
                <button id="send-btn" style="padding: 10px 15px; border-radius: 8px; background: #42d986; border: none; font-weight: bold;">></button>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', chatHTML);

const modal = document.getElementById('klevby-chat-modal');
const messagesDiv = document.getElementById('chat-messages');

// Ловим клик по твоим кнопкам (nav-chat и другие)
document.addEventListener('click', function(e) {
    if (e.target.closest('#nav-chat') || e.target.closest('#nav-chat-btn') || e.target.closest('#chat-desktop-btn')) {
        e.preventDefault();
        modal.style.display = 'flex';
    }
    if (e.target.id === 'close-chat') {
        modal.style.display = 'none';
    }
});

function renderMsg(data) {
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom: 10px; color: #fff; font-size: 14px;';
    div.innerHTML = '<b style="color: #42d986;">' + (data.user_name || 'Рыбак') + ':</b> ' + data.content;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function send() {
    const input = document.getElementById('message-input');
    const val = input.value.trim();
    if (val) {
        await chatDb.from('messages').insert([{ user_name: 'Рыбак', content: val }]);
        input.value = '';
    }
}

document.getElementById('send-btn').onclick = send;

async function start() {
    const res = await chatDb.from('messages').select('*').order('created_at', { ascending: true });
    if (res.data) res.data.forEach(renderMsg);

    chatDb.channel('messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function(payload) {
        renderMsg(payload.new);
    }).subscribe();
}

start();
