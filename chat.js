// Используем свое имя для базы, чтобы не конфликтовать с index.html
const CHAT_SUPABASE_URL = 'https://oecdshvozssadztcokog.supabase.co';
const CHAT_SUPABASE_KEY = 'sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS';
const chatDb = window.supabase.createClient(CHAT_SUPABASE_URL, CHAT_SUPABASE_KEY);

const chatHTML = `
    <div id="klevby-chat-modal" class="hidden">
        <div id="chat-window">
            <div id="chat-header">
                <span>Чат Рыбаков 🎣</span>
                <button id="close-chat">×</button>
            </div>
            <div id="chat-messages" style="height: 300px; overflow-y: auto; padding: 10px; background: #0a1217; border-radius: 8px; margin-bottom: 10px;"></div>
            <div id="chat-input-area" style="display: flex; gap: 8px;">
                <input type="text" id="message-input" placeholder="Напиши мужикам..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff;">
                <button id="send-btn" style="padding: 10px 15px; border-radius: 8px; background: #42d986; color: #000; border: none; font-weight: bold; cursor: pointer;">-></button>
            </div>
        </div>
    </div>
    <div id="chat-desktop-btn" class="hidden-on-mobile" style="position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px; background: #42d986; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; z-index: 9999; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">💬</div>
`;

document.body.insertAdjacentHTML('beforeend', chatHTML);

const chatModal = document.getElementById('klevby-chat-modal');
const closeBtn = document.getElementById('close-chat');
const navChatBtn = document.getElementById('nav-chat');
const desktopBtn = document.getElementById('chat-desktop-btn');
const messagesContainer = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Функция открытия/закрытия
const toggleChat = () => chatModal.classList.toggle('hidden');

// Привязываем кнопки
if (navChatBtn) navChatBtn.onclick = toggleChat;
if (desktopBtn) desktopBtn.onclick = toggleChat;
if (closeBtn) closeBtn.onclick = toggleChat;

// Функция отрисовки сообщения
function addMessageToScreen(data) {
    if (!messagesContainer) return;
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom: 8px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; font-size: 14px;';
    div.innerHTML = `<span style="color: #42d986; font-weight: bold;">${data.user_name || 'Рыбак'}:</span> <span style="color: rgba(244,251,247,0.82);">${data.content}</span>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Отправка сообщения
async function sendMessage() {
    const content = messageInput.value.trim();
    if (content) {
        // Берем имя из памяти браузера (которое вводили при создании объявления), если нет — Аноним
        const savedName = localStorage.getItem('klevby_author_name') || 'Аноним';
        await chatDb.from('messages').insert([{ user_name: savedName, content: content }]);
        messageInput.value = '';
    }
}

if (sendBtn) sendBtn.onclick = sendMessage;
if (messageInput) {
    messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
}

// Подписка на новые сообщения в реальном времени
chatDb
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        addMessageToScreen(payload.new);
    })
    .subscribe();

// Загрузка старых сообщений при открытии
async function loadHistory() {
    const { data, error } = await chatDb.from('messages').select('*').order('created_at', { ascending: true }).limit(30);
    if (data) {
        data.forEach(addMessageToScreen);
    }
}

loadHistory();const style = document.createElement('style');
style.innerHTML = '@media (max-width: 900px) { #chat-desktop-btn { display: none !important; } }';
document.head.appendChild(style);
