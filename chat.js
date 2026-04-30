const chatHTML = `
    <div id="klevby-chat-modal" class="hidden">
        <div id="chat-window">
            <div id="chat-header">
                <span>Чат Рыбаков</span>
                <button id="close-chat">×</button>
            </div>
            <div id="chat-messages"></div>
            <div id="chat-input-area">
                <input type="text" id="message-input" placeholder="Напиши мужикам...">
                <button id="send-btn">-></button>
            </div>
        </div>
    </div>
    <div id="chat-desktop-btn" class="hidden-on-mobile">💬</div>
`;

document.body.insertAdjacentHTML('beforeend', chatHTML);

const chatModal = document.getElementById('klevby-chat-modal');
const closeBtn = document.getElementById('close-chat');
const navChatBtn = document.getElementById('nav-chat');
const desktopBtn = document.getElementById('chat-desktop-btn');

// Функция открытия
const openChat = () => chatModal.classList.remove('hidden');

// Привязываем ко всему, что нашли
if (navChatBtn) navChatBtn.onclick = openChat;
if (desktopBtn) desktopBtn.onclick = openChat;

closeBtn.onclick = () => chatModal.classList.add('hidden');
