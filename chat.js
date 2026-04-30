(function() {
    const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
    const SUPABASE_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

    // Ждем полсекунды, чтобы всё прогрузилось
    const initInterval = setInterval(() => {
        if (window.supabase) {
            clearInterval(initInterval);
            const chatDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            setupChat(chatDb);
        }
    }, 500);

    function setupChat(chatDb) {
        const chatHTML = `
            <div id="klevby-chat-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10001; align-items: center; justify-content: center;">
                <div style="width: 90%; max-width: 400px; background: #1a1a1a; border-radius: 20px; border: 1px solid #333; overflow: hidden; display: flex; flex-direction: column;">
                    <div style="padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #fff; font-weight: bold;">Чат Рыбаков 🎣</span>
                        <button id="close-chat" style="background: none; border: none; color: #888; cursor: pointer; font-size: 30px;">&times;</button>
                    </div>
                    <div id="chat-messages" style="height: 300px; overflow-y: auto; padding: 10px; background: #0a1217;"></div>
                    <div style="padding: 10px; display: flex; gap: 8px; border-top: 1px solid #333;">
                        <input type="text" id="message-input" placeholder="Напиши мужикам..." style="flex: 1; padding: 10px; border-radius: 10px; border: 1px solid #333; background: #111; color: #fff; outline: none;">
                        <button id="send-btn" style="padding: 10px 15px; border-radius: 10px; background: #42d986; border: none; font-weight: bold;">></button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
        const modal = document.getElementById('klevby-chat-modal');
        const messagesContainer = document.getElementById('chat-messages');

        // Открытие по кнопке nav-chat
        document.addEventListener('click', (e) => {
            if (e.target.closest('#nav-chat')) {
                modal.style.display = 'flex';
            }
            if (e.target.id === 'close-chat') {
                modal.style.display = 'none';
            }
        });

        async function send() {
            const input = document.getElementById('message-input');
            const val = input.value.trim();
            if (val) {
                await chatDb.from('messages').insert([{ user_name: 'Рыбак', content: val }]);
                input.value = '';
            }
        }

        document.getElementById('send-btn').onclick = send;
        document.getElementById('message-input').onkeypress = (e) => { if (e.key === 'Enter') send(); };

        // Загрузка сообщений
        chatDb.from('messages').select('*').order('created_at', { ascending: true }).then(({ data }) => {
            if (data) data.forEach(msg => {
                const div = document.createElement('div');
                div.style.cssText = 'margin-bottom: 8px; color: #fff; font-size: 14px;';
                div.innerHTML = `<b style="color: #42d986;">${msg.user_name || 'Рыбак'}:</b> ${msg.content}`;
                messagesContainer.appendChild(div);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });

        // Слушаем новые сообщения
        chatDb.channel('messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
            const div = document.createElement('div');
            div.style.cssText = 'margin-bottom: 8px; color: #fff; font-size: 14px;';
            div.innerHTML = `<b style="color: #42d986;">${p.new.user_name || 'Рыбак'}:</b> ${p.new.content}`;
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }).subscribe();
    }
})();
