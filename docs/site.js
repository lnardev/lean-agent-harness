"use strict";

/** Adds a copy button beside every command. Without a clipboard the commands stay as plain text. */
(() => {
  const clipboard = navigator.clipboard;
  if (!clipboard) return;
  const RESET_MS = 2000;
  for (const block of document.querySelectorAll("pre[data-copy]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy";
    button.textContent = "Copy";
    button.setAttribute("aria-live", "polite");
    const show = (/** @type {string} */ label) => {
      button.textContent = label;
      setTimeout(() => {
        button.textContent = "Copy";
      }, RESET_MS);
    };
    button.addEventListener("click", () => {
      clipboard.writeText((block.textContent ?? "").trim()).then(
        () => show("Copied"),
        () => show("Select and copy"),
      );
    });
    block.parentElement?.append(button);
  }
})();
