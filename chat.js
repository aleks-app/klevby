const chatHTML = `
    <div id="klevby-chat-container">
        <div id="chat-window" class="hidden">
            <div id="chat-header">
                <span>Чат Рыбаков</span>
                <button id="close-chat" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">×</button>
            </div>
            <div id="chat-messages"></div>
            <div id="chat-input-area">
                <input type="text" id="message-input" placeholder="Напиши мужикам...">
                <button id="send-btn">-></button>
            </div>
        </div>
        <div id="chat-trigger">
            <span style="font-size: 30px;">💬</span>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', chatHTML);

const chatTrigger = document.getElementById('chat-trigger');
const chatWindow = document.getElementById('chat-window');
const closeBtn = document.getElementById('close-chat');

chatTrigger.onclick = () => chatWindow.classList.toggle('hidden');
closeBtn.onclick = () => chatWindow.classList.add('hidden');
