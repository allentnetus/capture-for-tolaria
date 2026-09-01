import { mountOptions } from "./App.js";
import { createOptionsRuntime } from "./native-config.js";

function mount(): void {
  const container = document.querySelector<HTMLElement>("#app");
  if (container) {
    mountOptions(container, createOptionsRuntime());
  }
}

if (typeof chrome !== "undefined" && document.readyState !== "loading") {
  mount();
} else if (typeof chrome !== "undefined") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
}
