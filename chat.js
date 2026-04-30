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
`;

document.body.insertAdjacentHTML('beforeend', chatHTML);

// Привязываемся к твоему новому облачку в меню
const navChatBtn = document.getElementById('nav-chat');
const chatModal = document.getElementById('klevby-chat-modal');
const closeBtn = document.getElementById('close-chat');

if (navChatBtn) {
    navChatBtn.onclick = () => {
        chatModal.classList.remove('hidden'); // Открываем чат
    };
}

closeBtn.onclick = () => {
    chatModal.classList.add('hidden'); // Закрываем чат
};

// Удаляем зелёную кнопку, если она вдруг осталась в памяти
const oldTrigger = document.getElementById('chat-trigger');
if (oldTrigger) oldTrigger.remove();
