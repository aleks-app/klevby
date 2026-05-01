/* ================================
   Klevby Chat — calls
   ================================ */

.klevby-call-panel {
  padding: 12px 14px;
  background:
    radial-gradient(circle at 10% 0%, rgba(87, 230, 178, 0.14), transparent 40%),
    rgba(255, 255, 255, 0.045);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.klevby-call-title {
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
}

.klevby-call-status {
  margin-top: 3px;
  color: rgba(244, 251, 247, 0.58);
  font-size: 12px;
  font-weight: 600;
}

.klevby-call-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.klevby-call-accept,
.klevby-call-reject {
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.klevby-call-accept {
  background: linear-gradient(135deg, #57e6b2, #28c990);
  color: #03150c;
  box-shadow: 0 10px 24px rgba(87, 230, 178, 0.18);
}

.klevby-call-reject {
  background: rgba(228, 88, 88, 0.92);
  color: #ffffff;
}

.chat-call-btn {
  margin-top: 8px;
  min-height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: rgba(87, 230, 178, 0.14);
  color: #c8ffe0;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.my-message .chat-call-btn {
  display: none;
}

@media (max-width: 768px) {
  .klevby-call-panel {
    align-items: flex-start;
    flex-direction: column;
  }

  .klevby-call-actions {
    width: 100%;
  }

  .klevby-call-accept,
  .klevby-call-reject {
    flex: 1;
  }
}
