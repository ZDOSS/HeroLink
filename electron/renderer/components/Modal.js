const Modal = {
  show({ title, body, confirmText, cancelText, variant, onConfirm, onCancel }) {
    const root = document.getElementById("modal-root");
    const confirmBtn = confirmText
      ? `<button class="btn btn-${variant === "danger" ? "danger" : "success"}" onclick="Modal.confirm()">${confirmText}</button>`
      : "";
    const cancelBtn = cancelText !== false
      ? `<button class="btn btn-ghost" onclick="Modal.close()">${cancelText || "Cancel"}</button>`
      : "";

    root.innerHTML = `
      <div class="modal-backdrop" onclick="if(event.target===this) Modal.close()">
        <div class="modal" role="dialog">
          <div class="modal-header">${title}</div>
          <div class="modal-body">${body}</div>
          <div class="modal-footer">
            ${cancelBtn}
            ${confirmBtn}
          </div>
        </div>
      </div>
    `;
    root.classList.remove("hidden");

    this._onConfirm = onConfirm || null;
    this._onCancel = onCancel || null;
    this._backdrop = root.querySelector(".modal-backdrop");

    document.removeEventListener("keydown", this._keyHandler);
    document.addEventListener("keydown", this._keyHandler);
  },

  _keyHandler(e) {
    if (e.key === "Escape") Modal.close();
  },

  async confirm() {
    if (this._onConfirm) await this._onConfirm();
    this._onCancel = null;
    if (document.contains(this._backdrop)) this.close();
  },

  close() {
    const root = document.getElementById("modal-root");
    root.classList.add("hidden");
    root.innerHTML = "";
    if (this._onCancel) this._onCancel();
    document.removeEventListener("keydown", this._keyHandler);
    this._onConfirm = null;
    this._onCancel = null;
  },
};
