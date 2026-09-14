const Modal = {
  show({ title, body, confirmText, cancelText = "Cancel", variant, onConfirm, onCancel }) {
    const root = document.getElementById("modal-root");
    const previousFocus = this._previousFocus?.isConnected
      ? this._previousFocus
      : document.activeElement;
    this._previousFocus = previousFocus;
    this._busy = false;
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
      <div class="modal-header" id="modal-title">${App.escapeHtml(title)}</div>
      <div class="modal-body">${body}<p class="modal-error" role="alert" hidden></p></div>
      <div class="modal-footer">${cancelText !== false ? `<button class="btn btn-ghost" onclick="Modal.close()">${App.escapeHtml(cancelText)}</button>` : ""}
      ${confirmText ? `<button class="btn btn-${variant === "danger" ? "danger" : "success"}" data-confirm onclick="Modal.confirm()">${App.escapeHtml(confirmText)}</button>` : ""}</div>
    </div></div>`;
    root.classList.remove("hidden");
    this._onConfirm = onConfirm;
    this._onCancel = onCancel;
    this._backdrop = root.firstElementChild;
    document.removeEventListener("keydown", this._keyHandler);
    document.addEventListener("keydown", this._keyHandler);
    // Associate older form labels as well as newly authored forms.
    root.querySelectorAll("label:not([for])").forEach((label) => {
      const control = label.parentElement.querySelector("input,select,textarea");
      if (control?.id) label.htmlFor = control.id;
    });
    root.querySelectorAll("pre").forEach((pre) => {
      pre.tabIndex = 0;
    });
    (root.querySelector("input,select,textarea,button") || root.querySelector(".modal")).focus();
  },
  _keyHandler(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      Modal.close();
    }
    if (event.key !== "Tab") return;
    const nodes = [
      ...document.querySelectorAll(
        "#modal-root button:not(:disabled),#modal-root input:not(:disabled),#modal-root select:not(:disabled),#modal-root textarea:not(:disabled),#modal-root [tabindex='0']",
      ),
    ].filter((el) => !el.hidden);
    if (!nodes.length) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === nodes[0]) {
      event.preventDefault();
      nodes.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
      event.preventDefault();
      nodes[0].focus();
    }
  },
  async confirm() {
    if (this._busy) return;
    const backdrop = this._backdrop;
    const handler = this._onConfirm;
    this._busy = true;
    backdrop.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    try {
      const result = handler ? await handler() : undefined;
      if (this._backdrop === backdrop && result !== false) {
        this._busy = false;
        this._onCancel = null;
        this.close();
      }
    } catch (error) {
      if (this._backdrop === backdrop) {
        const alert = backdrop.querySelector(".modal-error");
        alert.textContent = error.message;
        alert.hidden = false;
      }
    } finally {
      if (this._backdrop === backdrop) {
        this._busy = false;
        backdrop.querySelectorAll("button").forEach((button) => {
          button.disabled = false;
        });
      }
    }
  },
  close() {
    if (this._busy) return;
    const root = document.getElementById("modal-root");
    root.classList.add("hidden");
    root.innerHTML = "";
    this._onCancel?.();
    document.removeEventListener("keydown", this._keyHandler);
    this._onConfirm = null;
    this._onCancel = null;
    this._backdrop = null;
    this._previousFocus?.focus();
    this._previousFocus = null;
  },
};
